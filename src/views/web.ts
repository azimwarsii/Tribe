import { CARD_TIERS } from "../card-tiers.js";
import { openCopies } from "../baskets.js";
import { basketHoldingsHtml } from "./baskets.js";
import { allHalts, db, followingOf, getMeta, pendingFor, userById } from "../db.js";
import { face, copyPnlByLeader, initials, money, monthlyHistory, ORDER_LABEL, openPositions, pct, portfolio, ago, topTraders, type MonthRow } from "../data.js";
import { signingBar } from "./chrome.js";
import { creatorEarnings } from "./me.js";
import { creatingTabHtml } from "./creator.js";
import { bundleVersion, esc, header, icon, money2, page, seg, signCls } from "../ui.js";
import type { Trade } from "../flash.js";

const BOT = () => process.env.BOT_USERNAME ?? "TribeTradeBot";

// ---------- Portfolio (desktop-first, stacks on mobile) ----------

/**
 * Running realised result, trade by trade: a line from zero that steps with every closed trade, so a quiet month and
 * a busy one read honestly. Hover (or touch) shows the total at that point. Others see it in % instead of dollars.
 */
function pnlCurve(months: MonthRow[], dollars: boolean): string {
  const trades = months.flatMap((m) => m.trades).sort((a, b) => a.at - b.at);
  if (!trades.length) return "";
  let run = 0;
  const pts = [{ at: trades[0].at, v: 0 }, ...trades.map((t) => ({ at: t.at, v: (run += dollars ? t.pnlUsd : t.pct) }))];
  const W = 600, H = 170, pad = 8;
  const lo = Math.min(0, ...pts.map((p) => p.v)), hi = Math.max(0, ...pts.map((p) => p.v));
  const span = hi - lo || 1;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const zero = y(0).toFixed(1);
  const up = run >= 0;
  const col = up ? "#34D399" : "#F87171";
  const fmt = (v: number) => (dollars ? `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}` : pct(v));
  const day = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const data = esc(JSON.stringify(pts.map((p) => [day(p.at), fmt(p.v)])));
  return `<div class="pcurve" data-pts="${data}"><div class="row sp xs mut"><span>${trades.length} closed trade${trades.length === 1 ? "" : "s"}</span><span class="pc-read"><b class="${up ? "up" : "down"}">${fmt(run)}</b> by ${day(trades[trades.length - 1].at)}</span></div>
<div class="pc-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Realised result over time, now ${fmt(run)}"><defs><linearGradient id="pcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
<line x1="0" x2="${W}" y1="${zero}" y2="${zero}" stroke="#3A3A3A" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/><path d="${line}L${W},${zero}L0,${zero}Z" fill="url(#pcg)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><line class="pc-x" x1="0" x2="0" y1="0" y2="${H}" stroke="#666" vector-effect="non-scaling-stroke" visibility="hidden"/></svg>
<span class="pc-zero xs mut" style="top:${((Number(zero) / H) * 100).toFixed(1)}%">0</span><i class="pc-dot" style="background:${col};left:100%;top:${((y(run) / H) * 100).toFixed(1)}%"></i></div>
<div class="row sp xs mut"><span>${day(pts[0].at)}</span><span>${day(pts[pts.length - 1].at)}</span></div></div>
<script>(function(){var el=document.currentScript.previousElementSibling,pts=JSON.parse(el.dataset.pts),plot=el.querySelector('.pc-plot'),xl=el.querySelector('.pc-x'),dot=el.querySelector('.pc-dot'),rd=el.querySelector('.pc-read'),rest=rd.innerHTML,svg=plot.querySelector('svg'),path=svg.querySelectorAll('path')[1];
var ys=(path.getAttribute('d').match(/[ML][^ML]+/g)||[]).map(function(s){return parseFloat(s.slice(1).split(',')[1])});
function at(e){var r=plot.getBoundingClientRect(),cx=((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width,i=Math.max(0,Math.min(pts.length-1,Math.round(cx*(pts.length-1))));
 var px=i/(pts.length-1);xl.setAttribute('x1',px*${W});xl.setAttribute('x2',px*${W});xl.setAttribute('visibility','visible');dot.style.left=px*100+'%';dot.style.top=ys[i]/${H}*100+'%';
 var v=pts[i][1];rd.innerHTML='<b class="'+(v.charAt(0)==='−'?'down':'up')+'">'+v+'</b> on '+pts[i][0]}
function off(){xl.setAttribute('visibility','hidden');dot.style.left='100%';dot.style.top=ys[ys.length-1]/${H}*100+'%';rd.innerHTML=rest}
plot.addEventListener('mousemove',at);plot.addEventListener('touchmove',at,{passive:true});plot.addEventListener('mouseleave',off);plot.addEventListener('touchend',off)})()</script>`;
}

/**
 * Past trades live here (and on each trader's profile portfolio), not in the feed: realised results month by month,
 * as a bar chart and an expandable list per month. `dollars` is false when someone else is looking: returns in % only.
 */
export function madeByMonth(months: MonthRow[], dollars: boolean): string {
  if (!months.length) return `<section class="card"><h2>What ${dollars ? "you've" : "they've"} made</h2><div class="sm mut" style="padding-top:8px">No closed trades yet. Results show up here month by month.</div></section>`;
  const val = (m: MonthRow) => (dollars ? m.pnlUsd : m.pct);
  const total = months.reduce((a, m) => a + m.pnlUsd, 0);
  const fmt = (m: MonthRow) => (dollars ? `${m.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(m.pnlUsd))}` : pct(m.pct));
  const curve = pnlCurve(months, dollars);
  const list = months.map((m, i) => `<details class="mrow"${i === 0 ? " open" : ""}><summary class="row sp"><span><b class="md">${esc(m.label)}</b><span class="xs mut" style="display:block">${m.closed} closed · ${m.wins} green${dollars ? ` · ${money(m.investedUsd)} put in` : ""}</span></span><span style="text-align:right"><b class="${signCls(val(m))}">${fmt(m)}</b>${dollars ? `<span class="xs mut" style="display:block">${pct(m.pct)}</span>` : ""}</span></summary>
${m.trades.map((t) => `<div class="row sp sm" style="min-height:40px;border-top:1px solid #1C1C1C"><span class="row" style="gap:8px"><span>${esc(t.symbol)}${t.from ? ` <span class="mut">copied from @${esc(t.from)}</span>` : ""}</span></span><span class="row" style="gap:10px"><span class="xs mut">${new Date(t.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><b class="${signCls(t.pnlUsd)}">${dollars ? `${t.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(t.pnlUsd))}` : pct(t.pct)}</b></span></div>`).join("") || '<div class="sm mut" style="padding:8px 0">Entries only this month, nothing closed.</div>'}</details>`).join("");
  return `<section class="card col" style="gap:12px" aria-label="Results by month"><div class="row sp"><h2>What ${dollars ? "you've" : "they've"} made</h2><span class="sm ${signCls(total)}">${dollars ? `${total >= 0 ? "+" : "−"}${money(Math.abs(total))} realised` : ""}</span></div>
${curve}<div class="col" style="gap:0">${list}</div></section>`;
}

export type PortfolioTab = "investing" | "creating";
export const portfolioTab = (t: unknown): PortfolioTab => (t === "creating" ? t : "investing");

export async function portfolioPage(uid: number, tab: PortfolioTab = "investing"): Promise<string> {
  const head = `${header("Portfolio", tab === "creating" ? "Build trades, get paid when people copy you" : "Positions, requests, traders and funds", "/feed", tab === "creating" ? `<a class="ic" href="/share" aria-label="Share a card">${icon("share", 17, "currentColor", 2)}</a>` : "")}
<div class="main" style="flex:none;padding-bottom:14px">${signingBar(uid)}${seg([{ label: "Investing", href: "/portfolio", on: tab === "investing" }, { label: "Creating", href: "/portfolio?tab=creating", on: tab === "creating" }], false, "Portfolio")}</div>`;
  if (tab === "creating") return page({ title: "Portfolio", nav: "me", body: `${head}${await creatingTabHtml(uid)}` });
  const pf = await portfolio(uid);
  const open = await openPositions(uid);
  const unreal = open.reduce((a, p) => a + p.pnlUsd, 0);
  const cr = creatorEarnings(uid);
  const pend = pendingFor(uid);
  const meta = getMeta(uid);
  const follows = followingOf(uid);
  const pnl = await copyPnlByLeader(uid);
  const halted = new Set(allHalts().map((h) => h.leader));
  const tile = (k: string, v: string, sub: string, cls = "") => `<div class="card" style="padding:16px"><div class="sm mut">${k}</div><div style="font-size:24px;font-weight:600;margin-top:4px" class="${cls}">${v}</div><div class="sm mut" style="margin-top:2px">${sub}</div></div>`;

  const rows = open.map((p) => `<tr><td><b>${esc(p.symbol)}</b></td><td class="mut">${p.from === "you" ? "you" : "@" + esc(p.from)}</td><td>${money(p.sizeUsd)}</td><td><span class="down">${p.stopPct !== null ? "−" + p.stopPct.toFixed(1) + "%" : "—"}</span> <span class="dim">/</span> <span class="up">${p.tpPct !== null ? "+" + p.tpPct.toFixed(1) + "%" : "—"}</span></td><td class="${signCls(p.pnlUsd)}"><b>${p.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(p.pnlUsd))}</b> <span class="sm">${pct(p.pnlPct)}</span></td>
<td class="r"><div class="row posacts"><button class="btn sm" data-act="/api/position-stop" data-body='{"token":"${p.token}","stop":${Math.max(1, Math.round((p.stopPct ?? 5) - 1))}}'>Tighter</button> <button class="btn sm danger" data-act="/api/position-close" data-body='{"token":"${p.token}"}' data-confirm="Close ${esc(p.symbol)} at market?">Close</button></div></td></tr>`).join("");
  const cards = open.map((p) => `<div class="line"><span class="av sm">${esc(p.symbol.slice(0, 3))}</span><span class="grow"><span class="t">${esc(p.symbol)} · ${money(p.sizeUsd)}</span><span class="s">from ${p.from === "you" ? "you" : "@" + esc(p.from)} · stop ${p.stopPct !== null ? "−" + p.stopPct.toFixed(1) + "%" : "—"} · target ${p.tpPct !== null ? "+" + p.tpPct.toFixed(1) + "%" : "—"}</span></span><b class="${signCls(p.pnlUsd)}">${p.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(p.pnlUsd))}</b></div>`).join("");

  const history = madeByMonth(monthlyHistory(uid), true);
  const body = `${head}<main class="main" style="gap:16px">
<div class="grid2 pgrid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${tile("Wallet balance", money(pf.total), `${money(pf.free)} free`)}${tile("In copies", money(pf.inCopies), `Copying ${follows.length + openCopies(uid)}`)}${tile("Unrealized PnL", `${unreal >= 0 ? "+" : "−"}${money(Math.abs(unreal))}`, `${open.length} positions`, signCls(unreal))}${tile("Creator earned", money(cr.accrued), `${cr.copiers} copiers`, "up")}</div>
<div class="col" style="gap:16px">
<section class="card" style="padding:0"><div class="row sp" style="padding:16px 16px 8px"><h2>Positions</h2><span class="sm mut">Each keeps its own stop and target</span></div>
<div class="only-d" style="padding:0 8px 8px;overflow-x:auto"><table class="tbl"><thead><tr><th>Token</th><th>From</th><th>Size</th><th>Stop / target</th><th>PnL</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="mut">Nothing open. Copy a trade from the feed.</td></tr>'}</tbody></table></div>
<div class="only-m" style="padding:0 16px 12px">${cards || '<div class="sm mut" style="padding:8px 0">Nothing open.</div>'}<a class="sm" href="/positions" style="display:block;padding-top:10px">Manage positions ›</a></div></section>
<section class="card"><div class="row sp"><h2>Trades</h2><a class="sm" href="/feed?tab=top">All trades ›</a></div>${await basketHoldingsHtml(uid)}</section>
${history}
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;align-items:start">
<section class="card"><div class="row sp"><h2>Copy requests</h2><span class="sm mut">${pend.length} pending</span></div>
${pend.map((p) => { const t = p.trade as Trade; const lh = userById(p.leader)?.handle ?? ""; return `<div class="tile" style="margin-top:10px"><div class="row sp"><b class="md">@${esc(lh)} · ${esc(ORDER_LABEL[t.orderType] ?? "")}</b><span class="pill ok" data-expire="${p.expires_at}" data-total="${meta.timerSec * 1000}"></span></div><div class="sm mut" style="margin:4px 0 8px">${t.side === "buy" ? "$" : ""}${t.qty}${t.triggers ? " · stop/target attached" : ""}</div><div class="grid2"><button class="btn sm p" style="width:100%" data-act="/api/pending" data-body='{"id":${p.id},"action":"approve","back":"/portfolio"}'>Approve</button><button class="btn sm" style="width:100%" data-act="/api/pending" data-body='{"id":${p.id},"action":"skip","back":"/portfolio"}'>Skip</button></div></div>`; }).join("") || '<div class="sm mut" style="padding-top:10px">All caught up.</div>'}</section>
<section class="card"><div class="row sp"><h2>My traders</h2><button class="btn sm ${meta.pausedAll ? "p" : "danger"}" data-act="/api/pause-all" data-body='{"value":${!meta.pausedAll}}'>${meta.pausedAll ? "Resume all" : "Pause all"}</button></div>
${follows.map((f) => { const lu = userById(f.leader)!; const st = halted.has(f.leader) && !f.rules.guardOverride ? ["Paused by Guard", "down"] : meta.pausedAll ? ["Paused (all)", "warn"] : f.rules.paused ? ["Paused by you", "mut"] : ["Copying", "up"]; const v = pnl.get(f.leader); return `<a class="row" href="/u/${esc(lu.handle)}" style="min-height:48px;gap:10px;color:#F5F5F5;border-bottom:1px solid #1C1C1C"><span class="av sm">${face(lu.handle)}</span><span class="grow"><b class="md">@${esc(lu.handle)}</b><span class="xs mut" style="display:block">${f.rules.mode === "auto" ? "Auto" : "Ask first"}${v ? ` · ${v.pnl >= 0 ? "+" : "−"}${money(Math.abs(v.pnl))}` : ""}</span></span><span class="sm ${st[1]}">${st[0]}</span></a>`; }).join("") || '<div class="sm mut" style="padding-top:10px">Not copying anyone yet.</div>'}
<a class="sm" href="/traders" style="display:block;padding-top:10px">Manage rules ›</a></section></div></div></main>`;
  return page({ title: "Portfolio", nav: "me", body });
}

// ---------- Public landing and sign-in ----------

export function landingPage(): string {
  const { n: minted } = db.prepare("SELECT COUNT(*) AS n FROM basket_cards k LEFT JOIN basket_copies c ON c.id = k.copy_id WHERE k.at >= ? AND (c.status IS NULL OR c.status != 'failed')").get(Date.now() - 7 * 86400e3) as { n: number };
  const { glitter, holo } = CARD_TIERS.copy;
  const feat = (ic: string, c: string, t: string, p: string) => `<article class="card" style="padding:24px"><span aria-hidden="true" style="width:44px;height:44px;border-radius:14px;background:#262626;color:${c};display:flex;align-items:center;justify-content:center">${icon(ic, 20)}</span><h3 style="margin:16px 0 0;font-size:20px;font-weight:600">${t}</h3><p style="margin:8px 0 0;font-size:15px;color:#A3A3A3;line-height:1.55">${p}</p></article>`;
  const step = (t: string, p: string) => `<li style="padding:20px 20px 20px 50px;border-radius:20px;border:1px solid rgba(255,255,255,.08)"><div style="font-size:17px;font-weight:600;color:#F5F5F5">${t}</div><div style="font-size:14px;color:#A3A3A3;margin-top:4px;line-height:1.5">${p}</div></li>`;
  const body = `<style>
.landing{max-width:1280px!important;width:100%;background-image:radial-gradient(ellipse 60% 35% at 50% 0%,rgba(52,211,153,.10),rgba(255,255,255,0) 70%)!important}
.lh{display:flex;align-items:center;gap:28px;padding:22px 24px}.lh nav{display:flex;gap:24px;font-size:14px}.lh nav a{color:#C4C4C4}
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:56px;align-items:center;padding:48px 24px 72px}
.hero h1{margin:22px 0 0;font-size:clamp(38px,6vw,68px);line-height:1.02;font-weight:600;letter-spacing:-.035em}
.feat,.steps{display:grid;gap:16px;padding:0 24px 64px}.feat{grid-template-columns:repeat(3,minmax(0,1fr))}.steps{grid-template-columns:repeat(4,minmax(0,1fr));list-style:none;margin:0}
.landing .steps li::before{left:18px;top:20px}.lsec{padding:0 24px 48px}.lsec h2{margin:0 0 20px;font-size:clamp(26px,3.5vw,36px);letter-spacing:-.02em}
.cta{margin:0 24px 64px;padding:36px;border-radius:28px;background:linear-gradient(180deg,#1C1C1C,#121212);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:32px}
.mock{position:relative;height:clamp(300px,calc(100vw - 48px),490px)}.mock img{position:absolute;width:min(250px,54%);height:auto;border-radius:18px;box-shadow:0 24px 48px rgba(0,0,0,.6)}.mock p{position:absolute;left:0;right:0;bottom:0;margin:0;text-align:center;font-size:12px;color:#8A8A8A}
@media (max-width:1099px){.hero,.feat{grid-template-columns:minmax(0,1fr)}.steps{grid-template-columns:repeat(2,minmax(0,1fr))}.lh nav{display:none}}
@media (max-width:899px){.cta{flex-direction:column;align-items:flex-start}.steps{grid-template-columns:minmax(0,1fr)}.hero{padding-top:24px}}
</style>
<header class="lh"><span style="font-size:26px;font-weight:700;letter-spacing:-.05em">tribe<span style="color:#34D399">.</span></span><nav aria-label="Site"><a href="#how">How it works</a><a href="#cards">Cards</a><a href="#creators">Creators</a></nav><span style="flex:1"></span><a href="/signin" style="color:#F5F5F5;font-size:14px">Sign in</a><a class="btn sm w" href="/onboarding" style="height:42px;border-radius:21px">Get started</a></header>
<section class="hero"><div><span class="pill ok" style="padding:6px 12px;font-size:13px;border-radius:16px"><span class="live" style="width:6px;height:6px"></span>${minted ? `${minted} card${minted === 1 ? "" : "s"} minted this week` : "Custom ETF-style trades, collectible cards"}</span>
<h1>Custom ETF-style trades.<br><span class="dim">Cards that level up with your profit.</span></h1><p style="margin:22px 0 0;font-size:19px;color:#B5B5B5;line-height:1.55;max-width:540px">Creators turn a thesis into a custom index of up to 10 tokens. Copy it in one swipe and you mint a trading card that upgrades as your profit grows. The tokens stay in your own wallet.</p>
<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:32px"><a class="btn p big" href="/signin" style="width:auto;padding:0 24px">${icon("wallet", 14)}Connect wallet</a></div>
<div class="sm dim" style="margin-top:14px">Non-custodial wallets by Privy · Flash orders</div></div>
<div class="mock"><img src="/card/sample/base.svg" alt="" style="left:0;top:9%;transform:rotate(-8deg)"><img src="/card/sample/glitter.svg" alt="" style="right:0;top:9%;transform:rotate(8deg)"><img src="/card/sample/holo.svg" alt="Example Tribe trading card in its top Holo tier" style="left:50%;top:0;margin-left:calc(min(250px,54%) / -2);z-index:1"><p>Example cards, not real results.</p></div></section>
<section id="cards" class="feat">${feat("bolt", "#34D399", "Custom ETF-style trades", "Like an ETF anyone can build: a theme, a set of tokens and target weights. Unlike a fund, nothing is pooled, and the tokens sit in your own wallet.")}${feat("trend", "#34D399", "Cards that upgrade", `Every copy mints a numbered card. Reach +${glitter.returnPct}% and it turns Glitter, reach +${holo.returnPct}% and it goes Holo. It never drops a tier.`)}${feat("shield", "#34D399", "Guard", "Tribe reads an onchain Guard before every copy, so a paused creator can't be copied.")}</section>
<section id="how" class="lsec"><h2>How it works</h2><ol class="steps" style="padding:0">${step("Pick a trade", "See its tokens, weights, risk band and record.")}${step("Copy it", "Choose your amount. The tokens land in your own wallet.")}${step("Mint your card", "Your numbered card arrives right after the copy.")}${step("Watch it upgrade", "Your profit takes it from Base to Glitter to Holo.")}</ol></section>
<section id="creators" class="cta"><div style="flex:1"><h2 style="margin:0;font-size:clamp(24px,3vw,32px);letter-spacing:-.02em">Launch your own index. Get paid when people copy it.</h2><p style="margin:10px 0 0;font-size:16px;color:#A3A3A3;line-height:1.55">Publish a custom trade of up to 10 tokens and you mint its Original card, which upgrades as its return and copiers grow. Every copy earns you a share of the Flash fee.</p></div><a class="btn w big" href="/onboarding" style="width:auto;padding:0 26px">Become a creator</a></section>
<footer style="padding:26px 24px;border-top:1px solid #1A1A1A;display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap;font-size:13px;color:#8A8A8A"><span style="max-width:760px">Trading is risky. Past results don't predict future ones. Tribe trades are not ETFs or registered funds. Guard reduces but can't remove losses. Not financial advice.</span><span>Terms · Privacy · Risk disclosure</span></footer>
`;
  return page({ title: "Custom ETF-style trades", body, focus: true, extraClass: "landing" });
}

/** Changes whenever the bundle is rebuilt, so browsers never run a stale cached copy. */
export function signinPage(demo: boolean): string {
  const ready = !!process.env.PRIVY_APP_ID;
  const body = `${header("Sign in", "Tribe", "/")}<main class="main"><div class="card col" style="gap:10px"><h2>Welcome to Tribe</h2><p class="mut md" style="margin:0;line-height:1.5">Sign in with your wallet. New here? You'll pick a username next.</p>
${ready ? `<div id="signin-root"><p class="mut">Loading…</p></div><script>window.TRIBE=${JSON.stringify({ appId: process.env.PRIVY_APP_ID }).replace(/</g, "\\u003c")}</script><script src="/static/signin.js?v=${bundleVersion("signin.js")}" defer></script>` : `<div class="sm down">Sign-in isn't set up on this server yet: add PRIVY_APP_ID and PRIVY_APP_SECRET to .env.</div>`}</div>
${demo ? `<div class="card col"><h2>Demo</h2><p class="mut md" style="margin:0">Continue as the seeded demo viewer.</p><a class="btn" href="/demo">Continue as demo viewer</a></div>` : ""}
<p class="note">Your money stays in your own wallet. Tribe never holds your key.</p></main>`;
  return page({ title: "Sign in", body, focus: true });
}

// ---------- Public leaderboard (shareable to X; the link preview is the rendered board) ----------

const SITE = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;

export function topPage(signedIn: boolean): string {
  const top = topTraders(7, 10);
  const rows = top.map((t, i) => `<div class="row" style="min-height:64px;border-bottom:1px solid #1C1C1C;gap:12px"><span style="width:22px;text-align:center;font-weight:600;color:${i < 3 ? "#34D399" : "#8A8A8A"}">${i + 1}</span><span class="av ${i === 0 ? "w" : ""}">${face(t.handle)}</span>
<span class="grow"><a href="/u/${esc(t.handle)}" style="color:#F5F5F5;font-weight:600">@${esc(t.handle)}</a><span class="sm mut" style="display:block">${esc(t.persona ?? "Trader")} · ${t.n} fills</span></span><b class="${signCls(t.pct)}">${pct(t.pct)}</b><a class="btn sm" href="${signedIn ? `/copy/${esc(t.handle)}` : `/onboarding?follow=${esc(t.handle)}`}" style="height:32px">Copy</a></div>`).join("");
  const body = `<style>.app.pub{max-width:720px}</style><header class="hd" style="gap:16px"><a href="/" style="font-size:22px;font-weight:700;letter-spacing:-.04em;color:#F5F5F5">tribe<span style="color:#34D399">.</span></a><span class="grow"></span>${signedIn ? '<a class="btn sm" href="/feed?tab=top">Full leaderboard</a>' : '<a class="mut md" href="/signin">Sign in</a><a class="btn sm w" href="/onboarding">Get started</a>'}</header>
<main class="main" style="gap:14px"><div><h1 class="h1">Top traders this week</h1><p class="mut md" style="margin:6px 0 0">Realised returns from filled Flash orders. Copy any of them with your own wallet and limits.</p></div>
<section>${rows || '<div class="empty"><div class="md" style="font-weight:600">No fills this week yet</div></div>'}</section>
<p class="note">Past results don't predict future ones. Not financial advice.</p></main>`;
  const head = `<meta property="og:title" content="Top traders this week on Tribe"><meta property="og:description" content="Copy them with your own limits."><meta property="og:image" content="${esc(SITE())}/og/top.png"><meta name="twitter:card" content="summary_large_image">`;
  return page({ title: "Top traders this week", body, head, focus: true, extraClass: "pub" });
}

/** 1200x630 leaderboard card for X. */
export function topSvg(): string {
  const top = topTraders(7, 5);
  const row = (t: (typeof top)[number], i: number) => `<g transform="translate(60,${200 + i * 78})"><text x="0" y="40" fill="${i < 3 ? "#34D399" : "#8A8A8A"}" font-size="34" font-family="sans-serif" font-weight="700">${i + 1}</text><text x="70" y="40" fill="#F5F5F5" font-size="36" font-family="sans-serif" font-weight="600">@${esc(t.handle)}</text><text x="1080" y="40" text-anchor="end" fill="${t.pct >= 0 ? "#2ee59d" : "#ff5c7a"}" font-size="38" font-family="sans-serif" font-weight="700">${esc(pct(t.pct))}</text><rect x="0" y="64" width="1080" height="1" fill="#262626"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1b1b"/><stop offset="1" stop-color="#070707"/></linearGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>
<text x="60" y="95" fill="#F5F5F5" font-size="46" font-family="sans-serif" font-weight="700">tribe<tspan fill="#34D399">.</tspan></text><text x="1140" y="92" text-anchor="end" fill="#A3A3A3" font-size="30" font-family="sans-serif">Top traders this week</text>
${top.map(row).join("") || '<text x="60" y="260" fill="#A3A3A3" font-size="34" font-family="sans-serif">No fills this week yet</text>'}
<text x="60" y="605" fill="#8A8A8A" font-size="24" font-family="sans-serif">Copy them on Tribe · trades on Flash</text></svg>`;
}

void ago;
