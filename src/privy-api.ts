import express from "express";
import { getAddress } from "viem";
import { currentUser, isAgent, signupTicketCookie, startSession } from "./auth.js";
import { db, getUser } from "./db.js";
import { createWalletPolicy, privy, privyEnabled, tribeSignerActive, verifyPrivyToken } from "./privy.js";
import { linkWallet, userByWallet } from "./wallet-api.js";

/**
 * Sign in with a wallet: MetaMask, Coinbase Wallet, Rabby or any browser wallet, or a phone wallet over WalletConnect.
 * Privy runs the wallet picker and the "sign to prove it's yours" step in the browser (web/signin.tsx). This checks the
 * access token with Privy, reads which wallet signed, and signs that wallet's account in, or starts sign-up (username).
 *
 *   POST /api/privy/session  { accessToken } -> { redirect: "/feed" } with a session, or { redirect: "/onboarding" }
 *
 * Automatic signing: an outside wallet can't delegate, so the user gets a Privy embedded wallet and adds Tribe as a
 * policy-limited signer from their browser (web/wallet.tsx). Only the wallet's owner can add a signer, which makes that
 * step their consent. The server never takes a browser's word for it: it reads the wallet back from Privy.
 *
 *   POST /api/privy/wallet/prepare  { accessToken } -> { signerId, policyId, added }
 *   POST /api/privy/wallet/confirm  { accessToken } -> the embedded wallet becomes the trading wallet
 *   POST /api/privy/wallet/disable  { accessToken } -> back to the outside wallet, once Tribe's signer is gone
 */
export const userByPrivy = (privyUserId: string) =>
  (db.prepare("SELECT id FROM users WHERE privy_user_id = ? AND handle NOT LIKE 'deleted\\_%' ESCAPE '\\'").get(privyUserId) as { id: number } | undefined)?.id;

type LinkedAccount = { type: string; id?: string | null; chain_type?: string; address?: string; wallet_client_type?: string; connector_type?: string; latest_verified_at?: number | null };

/** The outside wallet (not a Privy embedded one) this Privy user most recently proved they own, checksummed. */
async function signedInWallet(privyUserId: string): Promise<`0x${string}` | undefined> {
  const u = await privy().users()._get(privyUserId);
  const wallets = (u.linked_accounts as LinkedAccount[])
    .filter((a) => a.type === "wallet" && a.chain_type === "ethereum" && a.address && a.wallet_client_type !== "privy" && a.connector_type !== "embedded")
    .sort((a, b) => (b.latest_verified_at ?? 0) - (a.latest_verified_at ?? 0));
  return wallets[0] ? getAddress(wallets[0].address!) : undefined;
}

/** This Privy user's embedded Ethereum wallet, if they have one. */
export const pickEmbedded = (accounts: LinkedAccount[]) =>
  accounts.find((a) => a.type === "wallet" && a.chain_type === "ethereum" && a.address && a.id && (a.wallet_client_type === "privy" || a.connector_type === "embedded"));

/** Holdings and resting orders belong to the current wallet: moving the account would strand them. */
function assertNothingOpen(uid: number) {
  const open = db.prepare("SELECT 1 FROM orders WHERE trader = ? AND status = 'open' UNION ALL SELECT 1 FROM positions WHERE trader = ? AND qty > 0 LIMIT 1").get(uid, uid);
  if (open) throw new Error("Close your open positions and orders first: they belong to your current wallet.");
}

/** Make a verified embedded wallet the account's trading wallet. Copies stay on ask until the user turns auto on. */
export function enrollWallet(uid: number, walletId: string, address: string) {
  assertNothingOpen(uid);
  db.prepare("UPDATE users SET address = ?, pk = '', wallet_kind = 'privy', privy_wallet_id = ? WHERE id = ?").run(getAddress(address), walletId, uid);
}

/** The signed-in account, its Privy user (the token must match it) and their embedded wallet. */
async function walletRequest(req: express.Request) {
  if (!privyEnabled() || !process.env.PRIVY_KEY_QUORUM_ID) throw new Error("Automatic signing isn't set up on this server yet.");
  const uid = currentUser(req);
  if (uid === undefined) throw new Error("Sign in first.");
  if (isAgent(req)) throw new Error("Agent tokens can't change the account's wallet. Use the app.");
  const privyUserId = await verifyPrivyToken(String(req.body?.accessToken ?? "")).catch(() => undefined);
  if (!privyUserId) throw new Error("Your wallet session expired. Sign in again.");
  if (getUser(uid).privy_user_id !== privyUserId) throw new Error("That wallet session belongs to a different account. Sign out and sign in again.");
  const account = pickEmbedded((await privy().users()._get(privyUserId)).linked_accounts as LinkedAccount[]);
  return { uid, privyUserId, quorumId: process.env.PRIVY_KEY_QUORUM_ID, account };
}

export function privyRouter() {
  const r = express.Router();
  const walletRoute = (path: string, fn: (w: Awaited<ReturnType<typeof walletRequest>>) => Promise<unknown>) =>
    r.post(path, express.json(), async (req, res) => {
      try {
        res.json(await fn(await walletRequest(req)));
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

  walletRoute("/api/privy/wallet/prepare", async ({ uid, privyUserId, quorumId, account }) => {
    if (!account) throw new Error("Your Tribe wallet isn't ready yet. Try again.");
    assertNothingOpen(uid);
    // Kept across retries: the policy is per address, and the user's embedded wallet doesn't change.
    const policyId = getUser(uid).privy_policy_id ?? (await createWalletPolicy(account.address!, privyUserId));
    db.prepare("UPDATE users SET privy_policy_id = ? WHERE id = ?").run(policyId, uid);
    return { signerId: quorumId, policyId, added: tribeSignerActive(await privy().wallets().get(account.id!), quorumId, policyId) };
  });

  walletRoute("/api/privy/wallet/confirm", async ({ uid, quorumId, account }) => {
    const policyId = getUser(uid).privy_policy_id;
    if (!account || !policyId || !tribeSignerActive(await privy().wallets().get(account.id!), quorumId, policyId)) throw new Error("Automatic signing wasn't turned on. Try again.");
    enrollWallet(uid, account.id!, account.address!);
    return { redirect: "/wallet", toast: "Automatic signing is on" };
  });

  walletRoute("/api/privy/wallet/disable", async ({ uid, privyUserId, quorumId, account }) => {
    const u = getUser(uid);
    if (u.wallet_kind !== "privy") throw new Error("Automatic signing is already off.");
    assertNothingOpen(uid);
    const signers = account ? (await privy().wallets().get(account.id!)).additional_signers ?? [] : [];
    if (signers.some((s) => s.signer_id === quorumId)) throw new Error("Tribe can still sign for this wallet. Try again.");
    const outside = await signedInWallet(privyUserId);
    if (!outside) throw new Error("Sign in with your outside wallet first.");
    linkWallet(uid, outside);
    return { redirect: "/wallet", toast: "Automatic signing is off" };
  });

  r.post("/api/privy/session", express.json(), async (req, res) => {
    if (!privyEnabled()) return res.status(503).json({ error: "Sign-in isn't set up on this server yet (PRIVY_APP_ID, PRIVY_APP_SECRET)." });
    const token = String((req.body as { accessToken?: string })?.accessToken ?? "");
    const privyUserId = token ? await verifyPrivyToken(token).catch(() => undefined) : undefined;
    if (!privyUserId) return res.status(401).json({ error: "Your sign-in expired. Try again." });
    const wallet = await signedInWallet(privyUserId).catch(() => undefined);
    if (!wallet) return res.status(400).json({ error: "Sign in with a wallet to use Tribe." });
    // The wallet is the account: whichever Privy login proved it, the same wallet signs into the same account.
    const uid = userByWallet(wallet) ?? userByPrivy(privyUserId);
    if (uid !== undefined) {
      db.prepare("UPDATE users SET privy_user_id = COALESCE(privy_user_id, ?) WHERE id = ?").run(privyUserId, uid);
      startSession(res, uid, req);
      return res.json({ redirect: "/feed" });
    }
    // New wallet: proven by its signature, so sign-up only needs a username.
    res.setHeader("Set-Cookie", signupTicketCookie({ privy: privyUserId, wallet }));
    res.json({ redirect: "/onboarding" });
  });
  return r;
}
