import express, { type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { createPublicClient, getAddress, http, verifyMessage } from "viem";
import { base } from "viem/chains";
import { currentUser, isAgent } from "./auth.js";
import { db, getMeta, getUser, setMeta } from "./db.js";
import { privyEnabled } from "./privy.js";
import { isDry } from "./tracker.js";
import { balancesOf } from "./wallet.js";
import { bundleVersion, esc, header, icon, page } from "./ui.js";

/**
 * The user's own wallet. Sign-in proves it through Privy (src/privy-api.ts); switching to another wallet here proves the
 * new one with a signed one-time message, like Sign-In with Ethereum. Nothing is sent onchain and Tribe never gets a
 * key. Trades are approved in the wallet, unless the user turns on automatic signing (see src/privy-api.ts).
 *
 *   GET  /wallet                     the Wallet page: connect, or the address and live Base balances
 *   POST /api/wallet/challenge       { address } -> { id, message } to connect a wallet to the signed-in account
 *   POST /api/wallet/link            { id, signature } -> the wallet becomes the account's trading wallet (or replaces it)
 */
const site = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;

type Purpose = "link";
interface Challenge { purpose: Purpose; address: `0x${string}`; message: string; expires: number; uid?: number }
const challenges = new Map<string, Challenge>();

export function walletMessage(address: string, nonce: string, issued: string, handle?: string) {
  return `Tribe wants to connect this wallet to @${handle} instead of the current one.\n\nWallet: ${address}\nSite: ${site()}\nNonce: ${nonce}\nIssued: ${issued}\n\nSigning is free and doesn't move any funds.`;
}

function challenge(purpose: Purpose, address: string, uid?: number) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("That isn't a wallet address.");
  for (const [k, c] of challenges) if (c.expires < Date.now()) challenges.delete(k);
  const id = randomBytes(12).toString("hex");
  const message = walletMessage(address, id, new Date().toISOString(), uid === undefined ? undefined : getUser(uid).handle);
  challenges.set(id, { purpose, address: address as `0x${string}`, message, expires: Date.now() + 10 * 60_000, uid });
  return { id, message };
}

/** The address that signed a challenge, or throws. Each challenge is checked once. */
async function verified(purpose: Purpose, body: { id?: string; signature?: string }, uid?: number): Promise<`0x${string}`> {
  const c = challenges.get(String(body?.id ?? ""));
  challenges.delete(String(body?.id ?? ""));
  if (!c || c.purpose !== purpose || c.uid !== uid || c.expires < Date.now()) throw new Error("That request expired. Try again.");
  const signature = String(body?.signature ?? "") as `0x${string}`;
  // A normal wallet's signature checks offline; a smart-contract wallet (EIP-1271) needs the chain.
  const ok =
    (await verifyMessage({ address: c.address, message: c.message, signature }).catch(() => false)) ||
    (await createPublicClient({ chain: base, transport: http(process.env.BASE_RPC) }).verifyMessage({ address: c.address, message: c.message, signature }).catch(() => false));
  if (!ok) throw new Error("The signature doesn't match that wallet.");
  return c.address;
}

/** The account a wallet belongs to, if any. A wallet trades for one account only. */
export const userByWallet = (address: string) =>
  (db.prepare("SELECT id FROM users WHERE lower(address) = lower(?) AND wallet_kind = 'external' AND handle NOT LIKE 'deleted\\_%' ESCAPE '\\'").get(address) as { id: number } | undefined)?.id;

/**
 * Browser side of both flows: pick an account in MetaMask, sign the one-time message, then follow the server's
 * redirect, or call window[onDone](reply) when given (sign-up moves on to the username step).
 */
export function walletButtonScript(buttonId: string, msgId: string, challengeUrl: string, verifyUrl: string, onDone?: string) {
  return `<script>(function(){var b=document.getElementById(${JSON.stringify(buttonId)}),m=document.getElementById(${JSON.stringify(msgId)});
function say(t,bad){m.textContent=t;m.className='sm '+(bad?'down':'mut')}
function post(p,o){return fetch(p,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(o)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Request failed');return j})})}
function hex(s){return '0x'+Array.from(new TextEncoder().encode(s)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
b.onclick=async function(){var eth=window.ethereum;if(!eth){say("MetaMask isn't installed in this browser. Install it from metamask.io, then reload this page.",true);return}
b.disabled=true;try{say('Choose your account in MetaMask…');var a=(await eth.request({method:'eth_requestAccounts'}))[0];
var c=await post(${JSON.stringify(challengeUrl)},{address:a});say("Sign the message in MetaMask. It's free and moves nothing.");
var sig=await eth.request({method:'personal_sign',params:[hex(c.message),a]});var r=await post(${JSON.stringify(verifyUrl)},{id:c.id,signature:sig});${onDone ? `say('');b.disabled=false;window[${JSON.stringify(onDone)}](r)` : "location.href=r.redirect"}}
catch(e){say(e&&e.code===4001?'You cancelled in MetaMask. Nothing happened.':(e.message||'Something went wrong'),true);b.disabled=false}}})()</script>`;
}

export function walletRouter() {
  const r = express.Router();
  const json = express.json();
  const reply = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => async (req: Request, res: Response) => {
    try {
      res.json(await fn(req, res));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  };
  const owner = (fn: (uid: number, req: Request, res: Response) => Promise<unknown> | unknown) => async (req: Request, res: Response) => {
    const uid = currentUser(req);
    if (uid === undefined) return res.status(401).json({ error: "Sign in first." });
    if (isAgent(req)) return res.status(403).json({ error: "Agent tokens can't change the account's wallet. Use the app." });
    return reply((rq, rs) => fn(uid, rq, rs))(req, res);
  };

  // ---- The Wallet page and connecting a wallet to an existing account ----
  r.get("/wallet", async (req, res) => {
    const uid = currentUser(req);
    if (uid === undefined) return res.redirect("/signin");
    const u = getUser(uid);
    const auto = u.wallet_kind === "privy";
    const b = u.wallet_kind === "demo" ? undefined : await balancesOf(u.address).catch(() => undefined);
    // Funding sends real money, so a practice server never offers it. The address comes from here, not the browser.
    const funding = auto && !isDry() ? { fundTo: u.address, needsGas: !!b && b.eth < 0.0002 } : {};
    // The browser part: turn automatic signing on or off, and export the key. Needs the Privy login behind the account.
    const signing = privyEnabled() && process.env.PRIVY_KEY_QUORUM_ID && u.privy_user_id
      ? `<div id="wallet-root" class="col" style="gap:14px"><section class="card" aria-label="Automatic signing" style="padding:16px;border-radius:18px"><b style="font-size:17px">Automatic signing</b><div class="sm mut" style="margin-top:6px">Loading…</div></section></div><script>window.TRIBE=${JSON.stringify({ appId: process.env.PRIVY_APP_ID, auto, ...funding }).replace(/</g, "\\u003c")}</script><script src="/static/wallet.js?v=${bundleVersion("wallet.js")}" defer></script>`
      : "";
    let body: string;
    if (u.wallet_kind === "external" || auto) {
      const bal = (label: string, v: string, sub: string) => `<div class="line"><span class="grow"><span class="t">${label}</span><span class="s">${sub}</span></span><b>${v}</b></div>`;
      body = `${signing}<div class="card col" style="gap:6px"><div class="sm mut">Your wallet · ${auto ? "Tribe wallet" : "MetaMask"} · Base</div><div class="md" style="font-family:ui-monospace,monospace;word-break:break-all">${esc(u.address)}</div>
<div class="row" style="gap:8px;margin-top:6px"><button class="btn sm" data-copy="${esc(u.address)}">Copy address</button><a class="btn sm" href="https://basescan.org/address/${esc(u.address)}" target="_blank" rel="noopener">Basescan ↗</a></div></div>
<section class="tile" style="padding:2px 14px">${
        b
          ? bal("USDC", `$${b.usdc.toFixed(2)}`, "What you trade with") + bal("ETH", b.eth.toFixed(5), "For network fees (approvals)") + bal("WETH", b.weth.toFixed(6), "ETH you've bought through Flash")
          : `<div class="line"><span class="grow s">Couldn't read balances from Base right now. Try again in a moment.</span></div>`
      }</section>
<div class="card col" style="gap:6px"><b>Add funds</b><span class="sm" style="line-height:1.5">Send USDC on the <b>Base</b> network to the address above, from an exchange or another wallet. Keep about $1 of ETH on Base for approvals. Sending on another network won't arrive here.</span></div>
<div class="card col" style="gap:6px"><b>How trades work</b><span class="sm" style="line-height:1.5">${
        auto
          ? "Tribe never holds your key. It can sign Flash trades that pay back to this wallet, within your limits. It can't send your funds anywhere else."
          : "Tribe never holds your key. When a trader you copy trades, you get a request, and the trade runs only after you approve it in MetaMask."
      }</span></div>
${
        auto
          ? ""
          : `<div class="card col" style="gap:6px"><b>Switch to another wallet</b><span class="sm" style="line-height:1.5">You sign in with your wallet, so the new one must sign too before it replaces this one. Funds in this wallet stay in it.</span><div id="mm-msg" class="sm" role="status"></div><button class="btn" id="mm">${icon("wallet", 16)}Switch wallet in MetaMask</button></div>
${walletButtonScript("mm", "mm-msg", "/api/wallet/challenge", "/api/wallet/link")}`
      }`;
    } else {
      body = `<div class="card col" style="gap:8px"><b>Connect your wallet</b><span class="sm" style="line-height:1.5">Use MetaMask on Base. Connecting is a free signature that proves the wallet is yours; nothing moves. Tribe never holds your key: every trade is approved in MetaMask.</span>
<div id="mm-msg" class="sm" role="status"></div><button class="btn p big" id="mm">${icon("wallet", 16)}Connect MetaMask</button></div>
<p class="note">You're on a practice wallet with simulated funds. Connecting MetaMask replaces it for trading.</p>
${walletButtonScript("mm", "mm-msg", "/api/wallet/challenge", "/api/wallet/link")}`;
    }
    res.type("html").send(page({ title: "Wallet", body: `${header("Wallet", "Your money, your keys", "/me")}<main class="main">${body}</main>` }));
  });

  r.post("/api/wallet/challenge", json, owner((uid, req) => {
    const address = String(req.body?.address ?? "");
    const other = userByWallet(address);
    if (other !== undefined && other !== uid) throw new Error("This wallet is already connected to another Tribe account.");
    return challenge("link", address, uid);
  }));

  r.post("/api/wallet/link", json, owner(async (uid, req) => {
    const address = await verified("link", req.body, uid);
    linkWallet(uid, address);
    return { redirect: "/wallet", toast: "Wallet connected" };
  }));

  return r;
}

/**
 * Make a verified wallet the account's trading wallet. Tribe can't sign for it, so the demo key goes and every copy
 * becomes a request the user approves in MetaMask.
 */
export function linkWallet(uid: number, address: `0x${string}`) {
  db.prepare("UPDATE users SET address = ?, pk = '', wallet_kind = 'external', privy_wallet_id = NULL WHERE id = ?").run(getAddress(address), uid);
  db.prepare("UPDATE follows SET rules = json_set(rules, '$.mode', 'ask') WHERE follower = ?").run(uid);
  setMeta(uid, { perm: false, permUntil: 0, defaults: { ...getMeta(uid).defaults, mode: "ask" } });
}
