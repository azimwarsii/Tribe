import express from "express";
import { getAddress } from "viem";
import { signupTicketCookie, startSession } from "./auth.js";
import { db } from "./db.js";
import { privy, privyEnabled, verifyPrivyToken } from "./privy.js";
import { userByWallet } from "./wallet-api.js";

/**
 * Sign in with a wallet: MetaMask, Coinbase Wallet, Rabby or any browser wallet, or a phone wallet over WalletConnect.
 * Privy runs the wallet picker and the "sign to prove it's yours" step in the browser (web/signin.tsx). This checks the
 * access token with Privy, reads which wallet signed, and signs that wallet's account in, or starts sign-up (username).
 *
 *   POST /api/privy/session  { accessToken } -> { redirect: "/feed" } with a session, or { redirect: "/onboarding" }
 */
export const userByPrivy = (privyUserId: string) =>
  (db.prepare("SELECT id FROM users WHERE privy_user_id = ? AND handle NOT LIKE 'deleted\\_%' ESCAPE '\\'").get(privyUserId) as { id: number } | undefined)?.id;

type LinkedAccount = { type: string; chain_type?: string; address?: string; wallet_client_type?: string; connector_type?: string; latest_verified_at?: number | null };

/** The outside wallet (not a Privy embedded one) this Privy user most recently proved they own, checksummed. */
async function signedInWallet(privyUserId: string): Promise<`0x${string}` | undefined> {
  const u = await privy().users()._get(privyUserId);
  const wallets = (u.linked_accounts as LinkedAccount[])
    .filter((a) => a.type === "wallet" && a.chain_type === "ethereum" && a.address && a.wallet_client_type !== "privy" && a.connector_type !== "embedded")
    .sort((a, b) => (b.latest_verified_at ?? 0) - (a.latest_verified_at ?? 0));
  return wallets[0] ? getAddress(wallets[0].address!) : undefined;
}

export function privyRouter() {
  const r = express.Router();
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
