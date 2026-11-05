import { addLedger, db, followCount, followingOf, getMeta, getUser, guardEvents, ledgerOf, seasonBoard, setMeta, strategiesOf, userById } from "../db.js";
import { face, initials, money, openPositions, pct, portfolio, profile, seasonOf, seasonRange, seasonRanked, rankMin } from "../data.js";
import { traderStats } from "../stats.js";
import { isDry } from "../tracker.js";
import { txUrl } from "../flash.js";
import { sessionsOf, takeReveal, type Session } from "../auth.js";
import { DISCLAIMER, esc, header, icon, money2, page, seg, sheet, signCls, split, sw } from "../ui.js";

const guardTxUrl = (tx: string) => `https://${process.env.GUARD_CHAIN === "base" ? "" : "sepolia."}basescan.org/tx/${tx}`;
const FEE_BPS = () => Number(process.env.FLASH_FEE_BPS ?? 50);
const SHARE = () => Number(process.env.CREATOR_SHARE ?? 0.5);

/** Creator fee-share, estimated from copies of this user's trades: copied USD x Flash fee x creator share. */
export function creatorEarnings(user: number) {
  const q = (since: number) =>
    db.prepare("SELECT COALESCE(SUM(usd), 0) AS v, COUNT(*) AS n FROM copies WHERE leader = ? AND follower != ? AND status IN ('executed','dry-run') AND at >= ?").get(user, user, since) as { v: number; n: number };
  const all = q(0);
  const week = q(Date.now() - 7 * 86400e3);
  const rate = (FEE_BPS() / 1e4) * SHARE();
  // Live: the integrator fee Flash actually charged on copies of this trader (from fills). Demo: copied volume x fee.
  const live = db.prepare("SELECT COALESCE(SUM(fee), 0) AS f, COUNT(*) AS n FROM orders WHERE leader = ? AND trader != ? AND role = 'copy' AND sim = 0 AND fee IS NOT NULL").get(user, user) as { f: number; n: number };
  const accrued = live.n ? live.f * SHARE() : all.v * rate;
  const claimed = getMeta(user).claimed;
  return { volume: all.v, orders: all.n, accrued, weekly: week.v * rate, claimed, claimable: Math.max(0, accrued - claimed), copiers: followCount(user), shareBps: Math.round(SHARE() * 100) };
}

const row = (ic: string, title: string, sub: string, right: string, href?: string) => {
  const inner = `<span class="ico" aria-hidden="true">${icon(ic, 16)}</span><span class="grow"><span class="t">${esc(title)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ""}</span>${right}`;
  return href ? `<a class="line" href="${href}" style="color:#F5F5F5">${inner}${icon("chev", 14, "#8A8A8A", 2)}</a>` : `<div class="line">${inner}</div>`;
};

export async function mePage(uid: number): Promise<string> {
  const u = getUser(uid);
  const s = await traderStats(uid);
  const pf = await portfolio(uid);
  const meta = getMeta(uid);
  const open = await openPositions(uid);
  const unreal = open.reduce((a, p) => a + p.pnlUsd, 0);
  const cr = creatorEarnings(uid);
  const follows = followingOf(uid);
  const permOn = meta.perm && (!meta.permUntil || meta.permUntil > Date.now());
  const tile = (label: string, sub: string, subCls: string, href: string, ic: string) =>
    `<a class="tile" href="${href}" style="padding:12px;border-radius:16px;color:#F5F5F5;min-height:92px;display:flex;flex-direction:column;gap:8px"><span aria-hidden="true" style="width:32px;height:32px;border-radius:10px;background:#262626;display:flex;align-items:center;justify-content:center">${icon(ic, 16, "#F5F5F5")}</span><span><span style="display:block;font-size:14px;font-weight:600">${label}</span><span class="${subCls}" style="display:block;font-size:12px">${sub}</span></span></a>`;
  const body = `<header class="hd" style="gap:14px;padding:22px 20px 16px"><a class="av w lg pav" href="/profile/edit" aria-label="Edit profile">${face(u.handle)}<i>${icon("camera", 12, "currentColor", 2.2)}</i></a>
<div class="grow"><h1 style="font-size:20px">@${esc(u.handle)}</h1><div class="row" style="gap:6px;margin-top:4px"><span class="pill">${esc(u.persona ?? "Trader")}</span><a class="pill" href="/progress" style="color:#E5E5E5">Lv ${s.level} · ${s.xp.toLocaleString()} XP ›</a></div></div>
<a class="ic" href="/share/me" aria-label="Share your profile">${icon("share", 17, "currentColor", 2)}</a></header>
<main class="main" style="gap:18px">
<a class="card row" href="/funds" style="color:#F5F5F5;gap:12px"><span class="grow"><span class="sm mut" style="display:block">Wallet balance • Base</span><span class="big" style="display:block;font-size:28px;margin-top:4px">${meta.hideBalance ? "••••" : money2(pf.total)}</span><span class="mut" style="display:block;font-size:13px">${money(pf.free)} free · ${money(pf.inCopies)} in copies</span></span>${icon("chev", 14, "#8A8A8A", 2)}</a>
<div class="grid2">${tile("Positions", `${open.length} open · ${unreal >= 0 ? "+" : "−"}${money(Math.abs(unreal))}`, signCls(unreal), "/positions", "trend")}${tile("My traders", `${follows.length} copied`, "mut", "/traders", "people")}${tile("Creator studio", `${money(cr.accrued)} earned`, "up", "/creator", "star")}${tile("Activity", "Every fill, with receipts", "mut", "/activity", "clock")}${tile("My profile", "Photo, username, portfolio", "mut", `/u/${esc(u.handle)}`, "user")}${tile("Your bot", meta.bot.on ? `On · ${meta.bot.usd} a trade` : "Off · trades under your name", meta.bot.on ? "up" : "mut", "/bot", "bot")}</div>
<section class="card" aria-label="Copy permission" style="padding:14px;border-radius:18px;display:flex;flex-direction:column;gap:10px;border-color:${permOn ? "rgba(52,211,153,.35)" : "rgba(248,113,113,.35)"};background:${permOn ? "rgba(52,211,153,.05)" : "rgba(248,113,113,.05)"}">
<div class="row sp"><h2 style="font-size:15px">Auto-copy permission</h2><span class="sm ${permOn ? "up" : "down"}" style="font-weight:600">${permOn ? "Active" : "Revoked"}</span></div>
<div style="font-size:13px;color:#C4C4C4;line-height:1.45">${permOn ? `Tribe can place Flash orders for you: up to ${money(meta.defaults.max)} each, ${money(meta.defaults.cap)} a day, only for traders on Auto.${meta.permUntil ? ` Expires in ${Math.max(0, Math.ceil((meta.permUntil - Date.now()) / 86400e3))} days.` : ""}` : "Auto-copy is off. Traders on Auto now wait for your approval in Requests."}</div>
<button class="btn sm ${permOn ? "danger" : "p"}" style="width:100%;height:40px;border-radius:20px" data-act="/api/perm" data-body='{"value":${!permOn}}'>${permOn ? "Revoke permission" : "Grant again"}</button></section>
<section aria-label="Settings"><div class="row sp" style="margin-bottom:4px"><h2>Settings</h2><a href="/settings" style="font-size:13px;color:#F5F5F5;min-height:32px;display:flex;align-items:center">All settings ›</a></div>
<div class="line"><span class="ico">${icon("swap", 16)}</span><span class="grow">Max slippage</span>${seg(["0.3%", "0.5%", "1%"].map((v) => ({ label: v, on: meta.slip === v, attrs: `data-act="/api/meta" data-body='{"slip":"${v}"}'` })), true, "Max slippage")}</div>
<div class="line"><span class="ico">${icon("bell", 16)}</span><span class="grow"><span class="t">Push notifications</span><span class="s">Copy requests, Guard pauses, fills</span></span>${sw(meta.push, "Push notifications", `data-act="/api/meta" data-body='{"key":"push"}'`)}</div>
<div class="line"><span class="ico">${icon("tg", 16)}</span><span class="grow"><span class="t">Telegram</span><span class="s">${meta.tgId || uid < 1e10 ? "Approve copies and chat with Cat in Telegram" : "Link it in Alerts to approve copies there"}</span></span>${sw(meta.tg, "Telegram", `data-act="/api/meta" data-body='{"key":"tg"}'`)}</div>

${row("wallet", "Wallet", u.wallet_kind === "external" ? `MetaMask · ${u.address.slice(0, 6)}…${u.address.slice(-4)}` : `Practice wallet · connect MetaMask`, "", "/wallet")}
<button class="line" style="background:none;border:0;width:100%;text-align:left;color:#F87171" data-act="/api/signout"><span class="ico">${icon("logout", 16)}</span><span class="grow">Sign out</span></button></section>
<p class="note" style="margin:0 0 100px">${DISCLAIMER}</p></main>`;
  return page({ title: "Me", nav: "me", body });
}

/** "Chrome on macOS" from a user agent; good enough to tell your own devices apart. */
function deviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /curl|node|undici/i.test(ua) ? "Script" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60_000);
  return m < 2 ? "active now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export function settingsPage(uid: number, sessionId?: string): string {
  const u = getUser(uid);
  const m = getMeta(uid);
  const segr = (key: string, opts: string[], cur: string) => seg(opts.map((v) => ({ label: v, on: cur === v, attrs: `data-act="/api/meta" data-body='{"${key}":"${v}"}'` })), true, key);
  const toggle = (ic: string, label: string, sub: string, key: string, on: boolean) => `<div class="line"><span class="ico">${icon(ic, 16)}</span><span class="grow"><span class="t">${label}</span><span class="s">${sub}</span></span>${sw(on, label, `data-act="/api/meta" data-body='{"key":"${key}"}'`)}</div>`;
  const section = (t: string, inner: string, sub = "") => `<section class="setsec"><div class="sethd"><h2>${t}</h2>${sub ? `<span>${sub}</span>` : ""}</div><div class="setcard">${inner}</div></section>`;
  const opt = (ic: string, label: string, sub: string, control: string) => `<div class="line"><span class="ico">${icon(ic, 16)}</span><span class="grow"><span class="t">${label}</span><span class="s">${sub}</span></span>${control}</div>`;
  const devices = sessionsOf(uid, "web");
  const agents = sessionsOf(uid, "agent");
  const fresh = takeReveal(uid);
  const mcpConfig = (token: string) => JSON.stringify({ mcpServers: { tribe: { command: "npx", args: ["tsx", "src/mcp.ts"], env: { TRIBE_URL: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`, TRIBE_TOKEN: token } } } }, null, 2);
  const deviceRow = (d: Session) => `<div class="line"><span class="ico">${icon("user", 16)}</span><span class="grow"><span class="t">${esc(deviceName(d.user_agent))}${d.id === sessionId ? ' <span class="xs up">· this device</span>' : ""}</span><span class="s">Signed in ${new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${ago(d.last_seen)}</span></span>${d.id === sessionId ? "" : `<button class="btn sm" data-act="/api/sessions/revoke" data-body='{"id":"${d.id}"}'>Sign out</button>`}</div>`;
  const agentRow = (a: Session) => `<div class="line"><span class="ico">${icon("cat", 16)}</span><span class="grow"><span class="t">${esc(a.name ?? "Agent")}</span><span class="s">Created ${new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · last used ${ago(a.last_seen)} · expires ${new Date(a.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span><button class="btn sm" data-act="/api/agent-tokens/revoke" data-body='{"id":"${a.id}"}' data-confirm="Revoke ${esc(a.name ?? "this token")}? Agents using it stop working at once.">Revoke</button></div>`;
  const body = `${header("Settings", "Account, copying, Guard and alerts", "/me")}<main class="main setmain">
<div class="card row setme"><span class="av w">${face(u.handle)}</span><span class="grow"><b>@${esc(u.handle)}</b><span class="sm mut" style="display:block">${esc(u.persona ?? "Trader")} · ${esc(u.address.slice(0, 6))}…${esc(u.address.slice(-4))}</span></span><a class="btn sm" href="/me">View profile</a></div>
${section("Account", `${row("user", "Handle", "Shown on the feed and leaderboard", `<form data-form action="/api/handle" class="row" style="gap:6px"><input class="f" name="handle" value="${esc(u.handle)}" style="height:36px;width:130px;font-size:14px;padding:0 10px" aria-label="Handle"><button class="btn sm">Save</button></form>`)}${row("wallet", "Wallet", `${u.address}`, `<button class="btn sm" data-copy="${u.address}">Copy</button>`)}`)}
${section("Copying", `${opt("bolt", "Default mode", "Ask first sends you a request to approve each copy", segr("mode", ["Ask first", "Auto"], m.defaults.mode === "auto" ? "Auto" : "Ask first"))}
${opt("clock", "Approval timer", "How long a copy request waits for you", segr("timer", ["60s", "2m", "5m"], ({ 60: "60s", 120: "2m", 300: "5m" } as Record<number, string>)[m.timerSec] ?? ""))}
${opt("swap", "Max slippage", "The most a fill may move against you", segr("slip", ["0.3%", "0.5%", "1%"], m.slip))}
${opt("target", "Chase limit", "Never pay more than this above the trader's entry; past it, the copy waits as a 30-minute limit order", segr("chase", ["Off", "0.5%", "1%", "2%"], m.defaults.chase ? `${m.defaults.chase}%` : "Off"))}
${toggle("shieldok", "Tight approvals", "Flash spends only what each order needs (Permit2, minimal allowance). No standing unlimited approval on your wallet.", "tightApprovals", m.tightApprovals)}`)}
${section("Guard", opt("shield", "Strictness", "Pause line: Strict 50 · Balanced 65 · Relaxed 80", segr("strict", ["Strict", "Balanced", "Relaxed"], m.strict)), "Chainlink CRE checks every trader you copy")}
${section("Alerts", `${toggle("bell", "Push notifications", "Copy requests, Guard pauses, fills", "push", m.push)}${toggle("tg", "Telegram", "Approve copies and chat with Cat", "tg", m.tg)}${row("tg", "Link Telegram", "Connect this account to the Tribe bot", "", "/alerts")}${toggle("clock", "Quiet hours", "Hold non-urgent alerts overnight", "quiet", m.quiet)}`)}
${section("Privacy", toggle("eye", "Hide balances", "Mask your wallet balance on Me", "hideBalance", m.hideBalance))}
${section("Signed-in devices", `${devices.map(deviceRow).join("")}${devices.length > 1 ? `<div style="padding:8px 0"><button class="btn sm" data-act="/api/sessions/revoke-others" data-confirm="Sign out every other device?">Sign out all other devices</button></div>` : ""}`)}
${section("AI agent access", `<div class="line" style="align-items:flex-start;padding:10px 0"><span class="ico">${icon("cat", 16)}</span><span class="grow"><span class="t">Use Tribe from your own AI agent</span><span class="s" style="line-height:1.45">Claude, Cursor or any MCP client can read the leaderboard, check Guard, copy traders and propose trades through the Tribe MCP server. Trades still need your confirmation. A token can't change your account, devices or wallet, and you can revoke it any time.</span></span></div>
${fresh ? `<div class="card good col" style="gap:8px" role="status"><b class="up">Copy your new token now</b><span class="sm">It won't be shown again. Paste this into your MCP client's config:</span><pre class="tile" style="white-space:pre-wrap;word-break:break-all;font-size:12px;line-height:1.5;margin:0">${esc(mcpConfig(fresh))}</pre><div class="row" style="gap:8px"><button class="btn sm" data-copy="${esc(mcpConfig(fresh))}">Copy config</button><button class="btn sm" data-copy="${esc(fresh)}">Copy token only</button></div></div>` : ""}
${agents.map(agentRow).join("")}
<form data-form action="/api/agent-tokens" class="row" style="gap:6px;padding:8px 0 10px"><input class="f" name="name" placeholder="Name, e.g. Claude Desktop" maxlength="40" style="height:36px;flex:1;min-width:0;font-size:14px;padding:0 10px" aria-label="Token name"><button class="btn sm">Create token</button></form>`)}
<div class="grid2 setout"><button class="btn" data-act="/api/signout">Sign out</button><button class="btn danger" data-act="/api/delete-account" data-confirm="Delete your Tribe account? Copying stops and your profile disappears. Your wallet funds stay yours, so export first.">Delete account</button></div>
<p class="note" style="text-align:center;margin:4px 0 100px">Tribe v0.2 · hackathon build</p></main>`;
  return page({ title: "Settings", body });
}

export async function fundsPage(uid: number, tab: string): Promise<string> {
  const pf = await portfolio(uid);
  const u = getUser(uid);
  const add = tab !== "out";
  const method = (t: string, sub: string, ic: string, href: string, soon = false) =>
    `<${soon ? "div" : "a"} ${soon ? "" : `href="${href}"`} class="row" style="padding:12px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,#1C1C1C,#141414);color:#F5F5F5;${soon ? "opacity:.55" : ""}"><span aria-hidden="true" style="width:38px;height:38px;border-radius:12px;background:#262626;display:flex;align-items:center;justify-content:center">${icon(ic, 18, "#F5F5F5")}</span><span class="grow"><span style="display:block;font-size:15px;font-weight:600">${t}</span><span class="sm mut" style="display:block">${sub}</span></span>${soon ? '<span class="pill">Soon</span>' : icon("chev", 14, "#8A8A8A", 2)}</${soon ? "div" : "a"}>`;
  const addMethods = method("Transfer from a wallet", `Send USDC on Base to your address`, "send", "/transfer?dir=add") + (isDry() ? method("Add test funds", "Demo mode: simulated USDC, no real money", "plus", "/transfer?dir=add&m=test") : "") + method("Buy with card", "Apple Pay, Google Pay or card", "card", "#", true) + method("Bring from another chain", "Bridge in one step", "swap", "#", true);
  const outMethods = (isDry() ? method("Withdraw (simulated)", "Demo mode: reduces your simulated balance", "send", "/transfer?dir=out") : method("To a wallet", "Available once embedded wallets (Privy) are connected", "send", "#", true)) + method("To your bank", "Cash out through an off-ramp partner", "card", "#", true) + method("Close copies first", "Money in open positions isn't withdrawable", "trend", "/positions");
  const cr = creatorEarnings(uid);
  const traders = followingOf(uid).length;
  const tile = (k: string, v: string, sub: string, cls = "") => `<div class="tile" style="padding:14px"><div class="sm mut">${k}</div><div class="${cls}" style="font-size:20px;font-weight:600;margin-top:4px">${v}</div><div class="sm mut" style="margin-top:2px">${sub}</div></div>`;
  const kinds: Record<string, string> = { deposit: "Added", withdraw: "Withdrew", payout: "Creator payout" };
  const transfers = ledgerOf(uid).slice(0, 8).map((l) => `<tr><td><b>${esc(kinds[l.kind] ?? l.kind)}</b></td><td class="mut">${esc(l.note ?? "")}</td><td class="mut">Base</td><td class="mut">${new Date(l.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td class="r ${l.usd >= 0 ? "up" : ""}"><b>${l.usd >= 0 ? "+" : "−"}${money(Math.abs(l.usd))}</b></td></tr>`).join("");
  const chains = `<section class="flat" aria-label="By chain"><div class="row sp" style="margin-bottom:6px"><h2 style="font-size:16px">By chain</h2><span class="sm mut">Chains Flash supports</span></div>
<div class="line"><span class="av sm">B</span><span class="grow"><span class="t" style="font-weight:600">Base</span><span class="s">${money(pf.free)} free · ${money(pf.inCopies)} in copies</span></span><b>${money(pf.total)}</b></div>
<p class="note">Flash also supports Ethereum, Arbitrum, Solana and more. This build trades on Base; cross-chain copies are next.</p></section>`;
  const main = `<main class="main">
<section class="card" aria-label="Balance"><div class="row" style="gap:10px;align-items:flex-end"><div class="grow"><div class="sm mut">Total • Base</div><div class="big" style="font-size:32px;margin-top:4px">${money2(pf.total)}</div></div><button class="btn sm w only-d" data-open="addf">${icon("plus", 14, "currentColor", 2.6)}Add funds</button><button class="btn sm only-d" data-open="outf">Withdraw</button></div>
<div class="only-m"><div aria-hidden="true" style="display:flex;height:6px;border-radius:3px;overflow:hidden;gap:2px;margin-top:12px"><span style="flex:${Math.max(pf.free, 0.001)};background:#F5F5F5"></span><span style="flex:${Math.max(pf.inCopies, 0.001)};background:#34D399"></span></div>
<div class="row sm mut" style="gap:14px;margin-top:8px"><span class="row" style="gap:5px"><i style="width:8px;height:8px;border-radius:2px;background:#F5F5F5;display:inline-block"></i>Free ${money(pf.free)}</span><span class="row" style="gap:5px"><i style="width:8px;height:8px;border-radius:2px;background:#34D399;display:inline-block"></i>In copies ${money(pf.inCopies)}</span></div></div>
<div class="only-d"><div class="grid3" style="gap:10px;margin-top:16px">${tile("Free", money(pf.free), "Can be copied or withdrawn")}${tile("In copies", money(pf.inCopies), `Open positions, ${traders} trader${traders === 1 ? "" : "s"}`)}${tile("Creator earnings", money(cr.accrued), "All time", "up")}</div></div></section>
<div class="only-m"><div class="col" style="gap:16px">${seg([{ label: "Add funds", href: "/funds", on: add }, { label: "Withdraw", href: "/funds?tab=out", on: !add }], false, "Move money")}
<section class="col" style="gap:8px" aria-label="${add ? "Ways to add funds" : "Ways to withdraw"}">${add ? addMethods : outMethods}</section>${chains}</div></div>
<section class="card only-d" style="padding:6px 8px" aria-label="Recent transfers"><div class="row sp" style="padding:12px 12px 4px"><h2 style="font-size:16px">Recent transfers</h2><a class="sm" href="/activity?tab=Money">All activity</a></div><table class="tbl"><thead><tr><th>Type</th><th>Details</th><th>Chain</th><th>When</th><th class="r">Amount</th></tr></thead><tbody>${transfers || '<tr><td colspan="5" class="mut">No transfers yet.</td></tr>'}</tbody></table></section></main>`;
  const body = `${header("Funds", `${isDry() ? "Demo wallet" : "Embedded wallet"} · ${u.address.slice(0, 6)}…${u.address.slice(-4)} · non-custodial`, "/me")}${split(main, chains, "Balance by chain")}`;
  const sheets = sheet("addf", `<h2>Add funds</h2><p class="sm mut" style="margin:6px 0 14px">Arrives as USDC on Base</p><div class="col" style="gap:8px">${addMethods}</div><button class="btn" data-close="addf" style="margin-top:14px">Close</button>`)
    + sheet("outf", `<h2>Withdraw</h2><p class="sm mut" style="margin:6px 0 14px">You can withdraw up to ${money(pf.free)} free balance</p><div class="col" style="gap:8px">${outMethods}</div><button class="btn" data-close="outf" style="margin-top:14px">Close</button>`);
  return page({ title: "Funds", body, sheets, split: true });
}

export function transferPage(uid: number, dir: string, m: string): string {
  const u = getUser(uid);
  const add = dir !== "out";
  const test = add && m === "test" && isDry();
  const amounts = (add ? [50, 100, 200, 500] : [50, 100, 250]).map((a, i) => `<button type="button" class="chip${i === 1 ? " on" : ""}" data-pick data-name="amt" data-val="${a}">$${a}</button>`).join("");
  const body = `${header(add ? "Add funds" : "Withdraw", add ? (test ? "Simulated USDC (demo)" : "Transfer from a wallet") : "Simulated (demo)", "/funds" + (add ? "" : "?tab=out"))}
<main class="main" data-scope id="tf">
${add && !test ? `<div class="card col"><div class="md" style="font-weight:600">Your Base deposit address</div><div class="sm mut" style="word-break:break-all">${u.address}</div><button class="btn" data-copy="${u.address}">${icon("copy", 16, "currentColor", 2)}Copy address</button>
<p class="note">Send USDC on Base only. Funds show up after confirmations. Sending other tokens or other chains can lose them.</p></div>`
: `<div style="text-align:center;padding:16px 0"><div class="big" style="font-size:44px">$<span data-bind="amt">100</span></div><div class="sm mut" style="margin-top:4px">${add ? "Added to your free balance" : "Taken from your free balance"}</div></div>
<div class="chips" style="justify-content:center">${amounts}</div><input type="hidden" name="amt" value="100">
<div class="tile" style="padding:4px 14px"><div class="row sp md" style="min-height:44px"><span class="mut">${add ? "You get" : "You send"}</span><b>$<span data-bind="amt">100</span></b></div><div class="row sp md" style="min-height:44px;border-top:1px solid #222"><span class="mut">Fee</span><b>$0.00 (simulated)</b></div></div>
<button class="btn p big" data-act="${add ? "/api/demo-funds" : "/api/withdraw"}" data-collect="#tf">${add ? "Add test funds" : "Withdraw"}</button><p class="note">Demo build: this only changes a simulated balance. Real deposits and withdrawals need Privy embedded wallets.</p>`}
</main>`;
  return page({ title: add ? "Add funds" : "Withdraw", body });
}

export type ActivityItem = { at: number; cat: string; icon: string; tone: "ok" | "mut" | "bad" | "warn"; title: string; sub: string; amt: string; amtCls: string; usd: number; skip?: string; receipt?: string };

/** Copies, skips, Guard pauses and money movements for one user, newest first. */
export function activityItems(uid: number): ActivityItem[] {
  type Item = ActivityItem;
  const items: Item[] = [];
  const names = (id: number) => userById(id)?.handle ?? String(id);
  const copies = db.prepare("SELECT c.*, t.trade, (SELECT o.tx FROM orders o WHERE o.trade_id = c.trade_id AND o.trader = c.follower AND o.role = 'copy' AND o.tx IS NOT NULL LIMIT 1) AS tx FROM copies c LEFT JOIN trades t ON t.id = c.trade_id WHERE c.follower = ? ORDER BY c.id DESC LIMIT 60").all(uid) as any[];
  for (const c of copies) {
    const tr = c.trade ? JSON.parse(c.trade) : {};
    const sym = tr.target ? ({ "0x4200000000000000000000000000000000000006": "ETH" } as Record<string, string>)[String(tr.target).toLowerCase()] ?? "token" : "token";
    const label = `${tr.orderType ?? ""} ${tr.side ?? ""} ${sym}`.trim();
    const guard = String(c.note ?? "").includes("CopyGuard");
    if (c.status === "skipped") items.push({ at: c.at, cat: guard ? "Guard" : "Copies", icon: guard ? "shield" : "close", tone: guard ? "bad" : "mut", title: `${guard ? "Blocked" : "Skipped"} ${sym} ${tr.side ?? ""}`, sub: `@${names(c.leader)} · ${c.note}`, amt: "—", amtCls: "mut", usd: 0, skip: guard ? undefined : String(c.note ?? "Skipped") });
    else if (c.status === "failed") items.push({ at: c.at, cat: "Copies", icon: "close", tone: "bad", title: `Failed ${sym}`, sub: `@${names(c.leader)} · ${c.note}`, amt: "—", amtCls: "mut", usd: 0 });
    else items.push({ at: c.at, cat: "Copies", icon: "bolt", tone: "ok", title: `Copied ${label}`, sub: `@${names(c.leader)} · ${c.status === "dry-run" ? "simulated" : "onchain"}${c.note ? ` · ${c.note}` : ""}`, amt: c.usd ? money(c.usd) : "—", amtCls: "", usd: c.usd ?? 0, receipt: c.tx ? txUrl(c.tx) : undefined });
  }
  const follows = new Set(followingOf(uid).map((f) => f.leader));
  for (const e of guardEvents(undefined, 40)) {
    if (!follows.has(e.leader)) continue;
    items.push({ at: e.at, cat: "Guard", icon: "shield", tone: e.kind === "halt" ? "bad" : "ok", title: e.kind === "halt" ? `Guard paused @${names(e.leader)}` : `Guard cleared @${names(e.leader)}`, sub: e.reason ?? "Copying resumed", amt: "$0", amtCls: "mut", usd: 0, receipt: e.tx ? guardTxUrl(e.tx) : undefined });
  }
  for (const l of ledgerOf(uid)) items.push({ at: l.at, cat: "Money", icon: l.kind === "withdraw" ? "out" : "plus", tone: l.kind === "withdraw" ? "mut" : "ok", title: ({ deposit: "Added funds", withdraw: "Withdrew", payout: "Fee-share payout" } as Record<string, string>)[l.kind] ?? l.kind, sub: l.note ?? "", amt: `${l.usd >= 0 ? "+" : "−"}${money(Math.abs(l.usd))}`, amtCls: l.usd >= 0 ? "up" : "", usd: l.usd });
  return items.sort((a, b) => b.at - a.at);
}

/** Activity as CSV, for the desktop Export button. */
export function activityCsv(uid: number, tab: string): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = activityItems(uid).filter((i) => tab === "All" || i.cat === tab);
  return ["time,category,event,details,amount", ...rows.map((i) => [new Date(i.at).toISOString(), i.cat, q(i.title), q(i.sub), q(i.amt)].join(","))].join("\n");
}

export async function activityPage(uid: number, tab: string): Promise<string> {
  type Item = ActivityItem;
  const items = activityItems(uid);
  const filtered = items.filter((i) => tab === "All" || i.cat === tab);
  const day = (t: number) => { const d = new Date(t).setHours(0, 0, 0, 0), n = new Date().setHours(0, 0, 0, 0); return d === n ? "Today" : d === n - 86400e3 ? "Yesterday" : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const groups = new Map<string, Item[]>();
  for (const i of filtered) groups.set(day(i.at), [...(groups.get(day(i.at)) ?? []), i]);
  const tone = { ok: ["rgba(52,211,153,.12)", "#34D399"], mut: ["#262626", "#A3A3A3"], bad: ["rgba(248,113,113,.12)", "#F87171"], warn: ["rgba(252,211,77,.12)", "#FCD34D"] };
  const dot = (i: Item) => `<span aria-hidden="true" style="width:36px;height:36px;border-radius:18px;background:${tone[i.tone][0]};color:${tone[i.tone][1]};display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(i.icon, 16, "currentColor", 2.2)}</span>`;
  const empty = `<div class="empty"><div class="md" style="font-weight:600">Nothing here yet</div><div class="sm mut">Copies, Guard checks and payouts show up here.</div></div>`;
  const list = `<div class="only-m">${[...groups].map(([d, list]) => `<section aria-label="${d}"><h2 style="margin:8px 0 2px;font-size:13px;color:#A3A3A3">${d}</h2>${list.map((i) => `<div class="row" style="min-height:62px;border-bottom:1px solid #1C1C1C;gap:12px">${dot(i)}<span class="grow"><span style="display:block;font-size:14px;font-weight:600">${esc(i.title)}</span><span class="sm mut" style="display:block;line-height:1.4">${esc(i.sub)}</span></span><span style="text-align:right;flex-shrink:0"><span class="${i.amtCls}" style="display:block;font-size:14px;font-weight:600">${esc(i.amt)}</span>${i.receipt ? `<a class="sm" href="${i.receipt}" target="_blank" rel="noopener">Receipt ↗</a>` : ""}</span></div>`).join("")}</section>`).join("") || empty}</div>`;
  const time = (t: number) => `${day(t)} · ${new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const table = `<div class="only-d">${filtered.length ? `<section class="card" style="padding:6px 8px"><table class="tbl"><thead><tr><th style="width:52px"></th><th>Event</th><th>Details</th><th>When</th><th class="r">Amount</th><th style="width:90px"></th></tr></thead><tbody>${filtered.slice(0, 60).map((i) => `<tr><td>${dot(i)}</td><td><b>${esc(i.title)}</b></td><td class="mut sm">${esc(i.sub)}</td><td class="mut sm" style="white-space:nowrap">${time(i.at)}</td><td class="r ${i.amtCls}"><b>${esc(i.amt)}</b></td><td class="r">${i.receipt ? `<a class="sm" href="${i.receipt}" target="_blank" rel="noopener">Receipt ↗</a>` : ""}</td></tr>`).join("")}</tbody></table></section>` : empty}</div>`;

  const recent = items.filter((i) => i.at >= Date.now() - 2 * 86400e3);
  const n = (f: (i: Item) => boolean) => recent.filter(f).length;
  const moneyIn = recent.filter((i) => i.cat === "Money" && i.usd > 0).reduce((a, i) => a + i.usd, 0);
  const reasons = new Map<string, number>();
  for (const i of recent) if (i.skip) reasons.set(i.skip, (reasons.get(i.skip) ?? 0) + 1);
  const stat2 = (k: string, v: string, cls = "") => `<div style="padding:12px;border-radius:14px;background:#101010"><div class="sm mut">${k}</div><div class="${cls}" style="font-size:20px;font-weight:600">${v}</div></div>`;
  const aside = `<section class="card col" style="gap:14px"><h2 style="font-size:16px">Last 2 days</h2><div class="grid2" style="gap:10px">${stat2("Copied", String(n((i) => i.cat === "Copies" && i.tone === "ok")))}${stat2("Skipped", String(n((i) => !!i.skip)))}${stat2("Blocked by Guard", String(n((i) => i.cat === "Guard" && i.title.startsWith("Blocked"))), "down")}${stat2("Money in", `+${money(moneyIn)}`, "up")}</div></section>
<section class="flat col" style="gap:10px"><h2 style="font-size:16px">Why copies were skipped</h2>${[...reasons].map(([r, c]) => `<div class="row sp md" style="min-height:36px;border-top:1px solid #1F1F1F"><span style="color:#C4C4C4">${esc(r)}</span><b>${c}</b></div>`).join("") || '<div class="sm mut">Nothing skipped in the last 2 days.</div>'}<a class="sm" href="/traders">Adjust your copy rules</a></section>`;

  const main = `<main class="main" style="gap:8px"><div class="row" style="gap:12px;margin-bottom:4px"><div class="grow">${seg(["All", "Copies", "Guard", "Money"].map((t) => ({ label: t, href: `/activity?tab=${t}`, on: t === tab })), false, "Filter activity")}</div><a class="btn sm only-d" href="/activity.csv?tab=${encodeURIComponent(tab)}" download>Export CSV</a></div>${list}${table}<div class="only-m" style="height:90px"></div></main>`;
  const body = `${header("Activity", "Every copy, skip, pause and payout", "/me")}${split(main, aside, "Summary")}`;
  return page({ title: "Activity", nav: "me", body, split: true });
}

export function alertsPage(uid: number, tgLink: string | null, bot: string): string {
  const m = getMeta(uid);
  const linked = uid < 1e10 || !!m.tgId;
  const handle = getUser(uid).handle;
  const toggle = (key: string, title: string, sub: string, on: boolean, ic?: string) => `<div class="line">${ic ? `<span class="ico" aria-hidden="true">${icon(ic, 16)}</span>` : ""}<span class="grow"><span class="t">${title}</span><span class="s">${sub}</span></span>${sw(on, title, `data-act="/api/meta" data-body='{"key":"${key}"}'`)}</div>`;
  const events: [keyof typeof m & string, string, string][] = [
    ["aReq", "Copy requests", "When a trader you copy in ask-first mode trades"],
    ["aGuard", "Guard pauses and clears", "When Guard pauses or clears a trader you copy"],
    ["aFills", "Copies filled", "When a copy lands onchain"],
    ["aHits", "Stop or target hit", "When a position closes at its stop or target"],
    ["aPayout", "Creator payouts", "When fee share reaches your wallet"],
    ["aWeekly", "Weekly summary", "Sunday recap of PnL, copies and XP"],
  ];
  const timer = seg((["30s", "60s", "120s"] as const).map((t) => ({ label: t, on: m.timerSec === Number(t.replace("s", "")), attrs: `data-act="/api/meta" data-body='{"timer":"${t}"}'` })), true, "Approval time");
  const notif = (title: string, when: string, text: string) => `<div class="tile" style="padding:12px 14px;border-radius:18px;background:rgba(38,38,38,.85);border-color:rgba(255,255,255,.08)"><div class="row sp"><span class="md" style="font-weight:600"><b style="display:inline-flex;width:22px;height:22px;border-radius:6px;background:#F5F5F5;color:#0A0A0A;font-size:9px;align-items:center;justify-content:center;margin-right:6px;vertical-align:-5px">tr.</b>${title}</span><span class="sm mut">${when}</span></div><div class="md" style="color:#D4D4D4;line-height:1.4;margin-top:4px">${text}</div></div>`;
  const previews = `<section class="col" aria-label="Push preview" style="gap:8px"><div class="xs mut" style="font-weight:600;letter-spacing:.08em">PUSH · PREVIEW</div>${notif(`Copy request · ${m.timerSec}s left`, "now", "@nightowl went long ETH (Bracket). Copy $25 with stop −5%?")}${notif("Guard paused @traderx", "2m", "Your $15 PEPE copy was blocked. Open positions keep their stops.")}${notif("Copied ETH long", "1h", "$25 landed onchain with stop and target.")}</section>
<section aria-label="Telegram preview" class="col" style="gap:8px;border-radius:22px;padding:14px 12px;background:#0E1621;border:1px solid rgba(255,255,255,.06)"><div class="xs" style="font-weight:600;letter-spacing:.08em;color:#8BA4BF">TELEGRAM · @${esc(bot)}</div>
<div style="align-self:flex-start;max-width:88%;padding:10px 12px;border-radius:16px 16px 16px 4px;background:#182533;font-size:14px;line-height:1.45"><b>@nightowl</b> just went long <b>ETH</b> (Flash Bracket).<br>Your copy: <b>$25</b>, stop −5%, target +12%. Guard: passed.</div>
<div aria-hidden="true" class="grid2" style="gap:6px;max-width:88%"><span class="row" style="justify-content:center;height:40px;border-radius:10px;background:#2A3441;color:#DCE7F5;font-size:13px;font-weight:600">Approve $25</span><span class="row" style="justify-content:center;height:40px;border-radius:10px;background:#2A3441;color:#DCE7F5;font-size:13px;font-weight:600">Skip</span></div></section>`;
  const tgLine = `<div class="line"><span class="ico" aria-hidden="true">${icon("tg", 16)}</span><span class="grow"><span class="t">Telegram${linked ? ` · linked as @${esc(handle)}` : ""}</span><span class="s">${linked ? `Approve copies and chat with Cat in @${esc(bot)}` : "Connect this account to the Tribe bot to get alerts and approve copies there"}</span></span>${sw(m.tg, "Telegram alerts", `data-act="/api/meta" data-body='{"key":"tg"}'`)}</div>
${linked ? `<a class="btn sm" style="align-self:flex-start;margin-top:10px" href="https://t.me/${esc(bot)}">Open @${esc(bot)}</a>` : tgLink ? `<a class="btn sm p" style="align-self:flex-start;margin-top:10px" href="${esc(tgLink)}">Link Telegram</a><p class="note">Opens the bot with a one-time link code (valid 15 minutes).</p>` : ""}`;
  const main = `<main class="main"><div class="only-m">${previews.replace("PUSH · PREVIEW", "WHAT YOU'LL GET")}</div>
<section class="flat col" aria-label="Channels" style="gap:0"><h2 style="font-size:16px;margin-bottom:4px">Channels</h2>${toggle("push", "Push notifications", "On this browser and your phone", m.push, "bell")}${tgLine}</section>
<section class="flat col" aria-label="What to send" style="gap:0"><h2 style="font-size:16px;margin-bottom:4px">What to send</h2>${events.map(([k, t, s]) => toggle(k, t, s, !!m[k])).join("")}
<div class="line" style="border:0;flex-wrap:wrap;padding:8px 0"><span class="grow"><span class="t">Time to approve a copy request</span><span class="s">After this the request expires and nothing is sent</span></span>${timer}</div></section>
<p class="note">Copy-request and Guard alerts go to Telegram today. Push needs the mobile app; these choices are saved for when it ships.</p><div class="only-m" style="height:90px"></div></main>`;
  const body = `${header("Alerts", "Push on your devices, and the same Cat in Telegram", "/me")}${split(main, previews, "Alert previews")}`;
  return page({ title: "Alerts", nav: "me", body, split: true });
}

export async function creatorPage(uid: number): Promise<string> {
  const cr = creatorEarnings(uid);
  const p = await profile(uid);
  const strategies = strategiesOf(uid);
  const payouts = ledgerOf(uid).filter((l) => l.kind === "payout");
  const card = (id: string, name: string, kind: string, on: boolean, ic: string, copiers: number, pnlTxt: string, toggle: string) =>
    `<article class="tile" style="border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:10px"><div class="row"><span aria-hidden="true" style="width:38px;height:38px;border-radius:12px;background:#262626;display:flex;align-items:center;justify-content:center">${icon(ic, 18)}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:600">${esc(name)}</span><span class="sm mut" style="display:block">${esc(kind)}</span></span>${toggle}</div>
<div class="grid4 xs mut"><span>Copiers<b style="display:block;font-size:13px;color:#F5F5F5">${copiers}</b></span><span>PnL<b class="${pnlTxt.startsWith("−") ? "down" : "up"}" style="display:block;font-size:13px">${pnlTxt}</b></span><span>To copy<b style="display:block;font-size:13px;color:#F5F5F5">Free</b></span><span>Earned<b style="display:block;font-size:13px;color:#F5F5F5">${money(cr.accrued)}</b></span></div>
<div class="xs ${on ? "mut" : "warn"}">${on ? "Public · listed on Leaderboard and Feed" : "Private · nobody new can copy"}</div></article>`;
  const body = `${header("Creator studio", "Earn when others copy you", "/me", `<a class="ic" href="/share/me" aria-label="Share your profile">${icon("share", 17, "currentColor", 2)}</a>`)}<main class="main" style="gap:12px">
<section class="card" aria-label="Earnings"><div class="row sp"><span class="sm mut">Earnings • All time</span><span class="pill ok">Estimate</span></div>
<div class="big" style="margin-top:6px">${money2(cr.accrued)}</div><div class="up" style="font-size:13px">↑ ${money(cr.weekly)} this week</div>
<div class="sm mut" style="line-height:1.5;margin-top:10px">${cr.shareBps}% of the Flash fee on ${cr.orders} copied orders (${money(cr.volume)} copied)</div>
<div class="row sp" style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)"><span class="sm mut">Claimable <b style="color:#F5F5F5">${money(cr.claimable)}</b></span>
<button class="btn p sm" data-act="/api/claim" ${cr.claimable < 0.01 ? "disabled" : ""}>${cr.claimable < 0.01 ? "Nothing to claim" : "Claim"}</button></div>
<p class="note" style="margin-top:8px">${isDry() ? "Demo: claiming credits your simulated balance." : "Estimated from copied volume. Onchain fee-share payouts are not built yet."}</p></section>
<div class="grid2">${[["Your copiers", String(cr.copiers)], ["Volume copied", money(cr.volume)], ["Win rate", p.winRate === null ? "—" : p.winRate + "%"], ["Guard record", `${p.guardPauses} halts`]].map(([k, v]) => `<div class="tile"><div class="sm mut">${k}</div><div class="md" style="font-weight:600;margin-top:4px">${v}</div></div>`).join("")}</div>
<div class="row sp" style="margin-top:4px"><h2 style="font-size:16px">Your strategies</h2><a href="/strategy/new" style="color:#F5F5F5;font-size:13px;min-height:32px;display:flex;align-items:center">+ New</a></div>
${card("me", "My trades", "Manual · every Flash order you place", true, "people", p.followers, pct(p.pnlPct), "")}
${strategies.map((s) => card(String(s.id), s.name, `${s.kind === "bot" ? "Bot" : "Manual"} · ${s.description ?? ""}`, !!s.public, "cat", p.followers, "—", sw(!!s.public, `Public: ${s.name}`, `data-act="/api/strategy-public" data-body='{"id":${s.id}}'`))).join("")}
<div class="row sp" style="margin-top:4px"><h2 style="font-size:16px">Payouts</h2></div>
<div>${payouts.map((l) => `<div class="row sp md" style="min-height:44px;border-bottom:1px solid #1F1F1F"><span>${new Date(l.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} <span class="mut">· ${esc(l.note ?? "to your wallet")}</span></span><b>${money(l.usd)}</b></div>`).join("") || '<div class="sm mut">No payouts yet.</div>'}</div><div style="height:90px"></div></main>`;
  return page({ title: "Creator studio", nav: "me", body });
}

export async function newStrategyPage(uid: number): Promise<string> {
  const p = await profile(uid);
  const need = rankMin();
  const demo = process.env.DEMO === "true";
  const own = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(json_extract(trade, '$.orderType') IN ('bracket','stop-loss') OR json_extract(trade, '$.attach') IS NOT NULL OR json_extract(trade, '$.hasStop') = 1 OR json_array_length(json_extract(trade, '$.triggers')) > 0), 0) AS s FROM trades WHERE leader = ?`).get(uid) as { n: number; s: number };
  const stopPct = own.n ? Math.round((own.s / own.n) * 100) : 0;
  const halts30 = (db.prepare("SELECT COUNT(*) AS n FROM guard_events WHERE leader = ? AND kind = 'halt' AND at >= ?").get(uid, Date.now() - 30 * 86400e3) as { n: number }).n;
  const checks = [
    ["14+ days of trading", `You: ${p.days} days`, p.days >= 14],
    ["10+ trades", `You: ${p.trades} trades`, p.trades >= 10],
    ["No Guard pauses in 30 days", `You: ${halts30} pauses`, halts30 === 0],
    ["Stops on half your trades", `You: ${stopPct}%`, stopPct >= 50],
  ] as const;
  const eligible = demo || checks.every((c) => c[2]);
  void need;
  const handle = getUser(uid).handle;
  const typeBtn = (v: string, t: string, d: string, on: boolean) => `<button type="button" class="opt${on ? " on" : ""}" data-pick data-name="kind" data-val="${v}" role="radio" aria-checked="${on}" style="min-height:76px"><span class="dot"></span><span class="grow" style="margin-left:12px"><b style="display:block">${t}</b><span class="sm mut">${d}</span></span></button>`;
  const n = (i: number) => `<span class="only-d" style="color:#A3A3A3">${i} · </span>`;
  const preview = `<div class="xs mut" style="font-weight:600;letter-spacing:.08em">PREVIEW · HOW COPIERS SEE IT</div>
<section class="card col" style="gap:12px"><div class="row" style="gap:12px"><span class="av w">${face(handle)}</span><div class="grow"><b data-bind="name" data-ph="Your strategy" style="display:block;font-size:16px">Your strategy</b><span class="sm mut">by @${esc(handle)} · <span data-bind="kind" data-ph="Bot">Bot</span></span></div></div>
<div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill ok">Stops on ${stopPct}% of trades</span><span class="pill ${p.halted ? "bad" : "ok"}">Guard: ${p.halted ? "paused" : "clear"}</span></div>
<div class="grid2"><div class="tile"><div class="k">Track record</div><div class="v">${p.days} days</div></div><div class="tile"><div class="k">Copiers</div><div class="v">${p.followers || "New"}</div></div></div>
<span class="btn p" aria-hidden="true" style="pointer-events:none">${icon("bolt", 14)}Copy with Flash</span></section>`;
  const body = `<style>@media (min-width:900px){#ns .step.hide{display:flex!important}#ns [data-goto],#ns .nsbar,#ns .nsprev{display:none!important}#ns .step{gap:14px;padding:18px;border-radius:20px;background:#141414;border:1px solid rgba(255,255,255,.07)}#ns .step .h1{font-size:18px}}</style>
<header class="hd">${`<a class="ic" href="/creator" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a>`}<div class="grow"><h1><span class="only-m">New strategy</span><span class="only-d">Publish a strategy</span></h1><div class="sub only-m" data-steplabel data-labels="Eligibility|Type|Rules|Earnings|Review">Eligibility</div><div class="sub only-d">Let people copy you, and earn fee share on every copy</div></div></header>
<div data-scope id="ns">${split(`<main class="main"><div class="nsbar" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px">${[1, 2, 3, 4, 5].map((i) => `<span data-bar="${i}" style="height:4px;border-radius:2px;background:${i === 1 ? "#34D399" : "#262626"}"></span>`).join("")}</div>
<section class="step col" data-step-id="1"><div><h1 class="h1">${n(1)}Can you publish?</h1><p class="mut" style="margin:8px 0 0;font-size:15px">A real track record first, so copiers aren't buying hype.</p></div>
<div class="tile" style="padding:4px 14px">${checks.map(([r, y, ok]) => `<div class="row sp md" style="min-height:48px;border-bottom:1px solid #222"><span class="row" style="gap:10px"><i style="width:10px;height:10px;border-radius:5px;background:${ok ? "#34D399" : "transparent"};border:2px solid ${ok ? "#34D399" : "#FCD34D"}"></i>${r}</span><span class="sm ${ok ? "mut" : "warn"}">${y}</span></div>`).join("")}</div>
<div class="sm ${eligible ? "up" : "warn"}">${eligible ? (demo && !checks.every((c) => c[2]) ? "Demo mode: rules bypassed." : "You're eligible.") : "Keep trading, you're not there yet."}</div>
<button class="btn p big" data-goto="2" ${eligible ? "" : "disabled"} style="margin-top:auto">Continue</button></section>
<section class="step col hide" data-step-id="2"><div><h1 class="h1">${n(2)}What will people copy?</h1></div><div class="col d2" style="gap:10px" role="radiogroup" aria-label="Strategy type">${typeBtn("trades", "My trades", "Every Flash order you place, live", false)}${typeBtn("bot", "A bot", "Describe a rule to Cat and publish it", true)}</div><input type="hidden" name="kind" value="bot">
<div class="row" style="margin-top:auto;gap:8px"><button class="btn" data-goto="1">Back</button><button class="btn p" data-goto="3">Continue</button></div></section>
<section class="step col hide" data-step-id="3"><div><h1 class="h1">${n(3)}Name and rules</h1></div><div><label class="l" for="sname">Name</label><input class="f" id="sname" name="name" maxlength="40" placeholder="SOL Dip Buyer"></div>
<div><label class="l" for="sdesc">Describe it to Cat</label><textarea class="f" id="sdesc" name="description" rows="3" maxlength="300" placeholder="Buy $10 of ETH on every 5% dip, stop at −8%, take profit at +15%"></textarea></div>
<p class="note">Bots are listed with your rules. Automated execution of bot rules is not built in this version: it publishes your rule so people can follow your manual trades under this strategy.</p>
<div class="row" style="margin-top:auto;gap:8px"><button class="btn" data-goto="2">Back</button><button class="btn p" data-goto="4">Continue</button></div></section>
<section class="step col hide" data-step-id="4"><div><h1 class="h1">${n(4)}How you earn</h1></div><div class="card col"><div class="md">Free for people to copy.</div><div class="up lg">${Math.round(SHARE() * 100)}% of the Flash fee</div><div class="sm mut" style="line-height:1.5">on every order your copiers place through you. Example: 100 copiers each copy a $25 trade → $2,500 copied → you earn ${money(2500 * (FEE_BPS() / 1e4) * SHARE())}.</div></div>
<div class="row" style="margin-top:auto;gap:8px"><button class="btn" data-goto="3">Back</button><button class="btn p" data-goto="5">Continue</button></div></section>
<section class="step col hide" data-step-id="5"><div class="nsprev"><h1 class="h1">Preview and publish</h1></div><div class="tile nsprev" style="border-radius:18px;padding:14px"><div class="row"><span class="av w">${face(handle)}</span><span class="grow"><b data-bind="name" data-ph="Your strategy">Your strategy</b><span class="sm mut" style="display:block">by @${esc(handle)}</span></span><span class="pill ok">Guarded</span></div></div>
<label class="row md" style="gap:10px;color:#D4D4D4"><input type="checkbox" id="nsack" style="width:20px;height:20px;accent-color:#34D399">I understand copiers see my results, and Guard can pause me</label>
<p class="note">I won't promise returns. My trades and stats are public, and Guard can pause this strategy for everyone.</p>
<div class="row" style="margin-top:auto;gap:8px"><button class="btn" data-goto="4">Back</button><button class="btn p" id="nspub" data-act="/api/strategy" data-collect="#ns" disabled ${eligible ? "" : 'data-noelig="1"'}>Publish strategy</button></div></section></main>`, preview, "Preview")}</div>
<script>(function(){var a=document.getElementById('nsack'),b=document.getElementById('nspub');a.onchange=function(){b.disabled=!a.checked||!!b.dataset.noelig};
window.nsKind=function(sc,name,val){if(name!=='kind')return;document.querySelectorAll('[data-bind=kind]').forEach(function(x){x.textContent=val==='bot'?'Bot':'Manual trades'})};document.getElementById('ns').dataset.onpick='nsKind'})()</script>`;
  return page({ title: "New strategy", body, split: true });
}

export async function seasonPage(uid: number): Promise<string> {
  const cur = seasonOf(Date.now());
  const prev = Math.max(1, cur - 1);
  const { end } = seasonRange(prev);
  const ranked = seasonRanked(prev);
  const mine = ranked.findIndex((r) => r.id === uid);
  const medal = ["#F5F5F5", "#D4D4D4", "#A3A3A3"];
  const h = (id: number) => esc(userById(id)?.handle ?? "");
  const pauses = (id: number) => (db.prepare("SELECT COUNT(*) AS n FROM guard_events WHERE leader = ? AND kind = 'halt' AND at < ?").get(id, end) as { n: number }).n;
  const finish = `<section class="card col"><div class="row sp"><span class="sm mut">Your finish</span>${mine >= 0 ? `<span class="pill ok">Top ${Math.max(1, Math.ceil(((mine + 1) / ranked.length) * 100))}%</span>` : ""}</div><div class="big" style="font-size:30px">${mine >= 0 ? `#${mine + 1}<small> / ${ranked.length.toLocaleString("en-US")}</small>` : "Not ranked"}</div>
<div class="sm mut">${mine >= 0 ? `Realised ${pct(ranked[mine].pct)} from ${ranked[mine].n} fills.` : "Trade next season to get ranked."} Rewards are XP and badges, which are derived from your activity.</div>
<div class="grid2"><a class="btn" href="/share/me">Share result</a><a class="btn p" href="/ranks">Season ${cur} →</a></div></section>`;
  const how = `<section class="flat col" style="gap:8px"><h2 style="font-size:16px">How seasons work</h2><p class="sm mut" style="margin:0;line-height:1.5">Each calendar month is a season, ranked on realised PnL from filled Flash orders.</p><a class="sm" href="/progress">See your progress</a></section>`;
  // Podium order on desktop: 2nd, 1st, 3rd.
  const podium = ranked.length ? `<section aria-label="Podium" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:end">${[1, 0, 2].filter((i) => ranked[i]).map((i) => `<a class="card col" href="/u/${h(ranked[i].id)}" style="align-items:center;text-align:center;gap:6px;color:#F5F5F5;padding:${i === 0 ? "26px" : "18px"} 16px;${i === 0 ? "border-color:rgba(52,211,153,.35)" : ""}"><span style="width:32px;height:32px;border-radius:16px;background:${medal[i]};color:#0A0A0A;font-weight:700;display:flex;align-items:center;justify-content:center">${i + 1}</span><span class="av ${i === 0 ? "w lg" : ""}">${face(userById(ranked[i].id)?.handle ?? "")}</span><b>@${h(ranked[i].id)}</b><span class="${signCls(ranked[i].pct)}" style="font-size:${i === 0 ? 26 : 20}px;font-weight:600">${pct(ranked[i].pct)}</span><span class="sm mut">${ranked[i].n} fills · ${pauses(ranked[i].id)} Guard pause${pauses(ranked[i].id) === 1 ? "" : "s"}</span></a>`).join("")}</section>` : "";
  const rest = ranked.map((r, i) => ({ r, i })).filter(({ r, i }) => i >= 3 && (i < 10 || r.id === uid));
  const table = rest.length ? `<section class="card" style="padding:6px 8px"><table class="tbl"><thead><tr><th>#</th><th>Trader</th><th>Fills</th><th>Guard pauses</th><th class="r">Realised</th></tr></thead><tbody>${rest.map(({ r, i }) => `<tr style="${r.id === uid ? "background:rgba(52,211,153,.05)" : ""}"><td class="mut">${i + 1}</td><td><a href="/u/${h(r.id)}" style="color:#F5F5F5"><b>@${h(r.id)}</b>${r.id === uid ? " · you" : ""}</a></td><td>${r.n}</td><td>${pauses(r.id)}</td><td class="r ${signCls(r.pct)}"><b>${pct(r.pct)}</b></td></tr>`).join("")}</tbody></table></section>` : "";
  const b = seasonBoard(prev);
  const board = b?.tx && b.ranking.length ? b : undefined; // only an onchain attestation that ranked someone counts
  const proof = board
    ? `<a class="flat row" href="${board.tx ? `https://sepolia.basescan.org/tx/${board.tx}` : "#"}" target="_blank" rel="noopener" style="gap:10px;color:#F5F5F5;border-color:rgba(52,211,153,.35)"><span class="pill ok" style="flex-shrink:0">${icon("shieldok", 12, "currentColor", 2)}Verified by Chainlink CRE</span><span class="grow sm mut">Recomputed from ${board.ranking.length} traders' Flash fills · ranking hash ${board.hash.slice(0, 10)}…</span>${board.tx ? '<span class="sm up">Proof ↗</span>' : ""}</a>`
    : `<div class="pill ok" style="align-self:flex-start">Computed from filled Flash orders</div>`;
  const main = `<main class="main">${proof}
<div class="only-m"><div class="col">${ranked.slice(0, 3).map((r, i) => `<a class="card row" href="/u/${h(r.id)}" style="color:#F5F5F5;gap:12px"><span style="width:32px;height:32px;border-radius:16px;background:${medal[i]};color:#0A0A0A;font-weight:700;display:flex;align-items:center;justify-content:center">${i + 1}</span><span class="grow"><b>@${h(r.id)}</b><span class="sm mut" style="display:block">${r.n} fills</span></span><span class="${signCls(r.pct)} lg">${pct(r.pct)}</span></a>`).join("")}${finish}</div></div>
<div class="only-d"><div class="col" style="gap:16px">${podium}${table}</div></div>
${ranked.length ? "" : '<div class="empty"><div class="md" style="font-weight:600">No trades in that season</div></div>'}</main>`;
  const body = `${header(`Season ${prev} results`, `Ended ${new Date(end - 1).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ranked on realised PnL`, "/ranks")}${split(main, finish + how, "Your result")}`;
  return page({ title: "Season results", nav: "ranks", body, split: true });
}
