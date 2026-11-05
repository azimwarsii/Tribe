import { isWatching, watchersCount, watchingOf, allHalts, commentsOf, db, DEFAULT_RULES, followingOf, getFollowRules, getMeta, getUser, guardEvents, haltOf, pendingFor, reactionCounts, tradeById, userByHandle, userById } from "../db.js";
import { face, liveBook, monthlyHistory, sourceSplit, type SideRecord, ago, closedPositions, copyPnlByLeader, feed, freeBalance, initials, money, ORDER_LABEL, openPositions, pct, profile, symOf, tradeCard, windowPnl } from "../data.js";
import { decide, RISK_LINE, type FollowRules } from "../rules.js";
import { riskWord } from "../risk.js";
import { riskOf } from "../guard.js";
import { getPrice } from "../prices.js";
import type { Trade } from "../flash.js";
import { DISCLAIMER, esc, header, icon, money2, notFound, page, polyline, seg, sheet, signCls, split, stat, sw } from "../ui.js";
import { sourceTag, tradeCardHtml } from "./feed.js";
import { madeByMonth } from "./web.js";
import { catReadCard } from "./cat.js";
import { reactBar, reactBreakdown } from "./reactions.js";
import { Resvg } from "@resvg/resvg-js";
import { botsStrip } from "./creator.js";

/** Render the share card SVG to a 1200x630 PNG so X, Telegram and TikTok show it (they ignore SVG). */
export const svgToPng = (svg: string): Buffer => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng());

const BASE_URL = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;

// ---------- Profile ----------

const RANGE_MS: Record<string, number> = { "1D": 86400e3, "1W": 7 * 86400e3, "1M": 30 * 86400e3, All: 1e15 };

/** Manual vs Bot: the same trader's record split by who placed the entry. */
function splitCard(leader: number): string {
  const s = sourceSplit(leader);
  if (!s.bot.trades) return "";
  const col = (label: string, ic: string, r: SideRecord, bot: boolean) => `<div class="tile" style="${bot ? "border-color:rgba(52,211,153,.25)" : ""}"><div class="row" style="gap:6px"><span class="srctag${bot ? " bot" : ""}">${icon(ic, 11, "currentColor", 2)}${label}</span></div>
<div style="font-size:20px;font-weight:600;margin-top:8px" class="${r.pnlPct === null ? "" : signCls(r.pnlPct)}">${r.pnlPct === null ? "—" : pct(r.pnlPct)}</div><div class="xs mut">${r.trades} entr${r.trades === 1 ? "y" : "ies"} · ${r.closed ? `${r.wins} of ${r.closed} closed green` : "none closed"}</div></div>`;
  return `<h2>Manual vs Bot</h2><div class="grid2">${col("Manual", "hand", s.manual, false)}${col("Bot", "bot", s.bot, true)}</div>`;
}

/**
 * A trader's portfolio: their live book (positions they hold and orders still resting), each copyable with Flash,
 * then what they've made month by month. Others see allocation and returns in %; dollar amounts only for the owner.
 */
async function portfolioTab(u: { id: number; handle: string }, me: boolean, viewer: number): Promise<string> {
  const book = await liveBook(u.id);
  const total = book.held.reduce((a, p) => a + p.sizeUsd, 0);
  const max = getMeta(viewer).defaults.max;
  const copyBtn = (tradeId: number | null, what: string, worst: string) => !me && tradeId
    ? `<button class="btn sm p" style="width:auto" data-act="/api/copy-trade" data-body='{"trade":${tradeId},"usd":${max}}' data-confirm="${esc(`Copy $${max} of @${u.handle}'s ${what} with Flash? One order from your wallet${worst}. CopyGuard checks them first.`)}">${icon("bolt", 13)}Copy with Flash</button>` : "";
  const held = book.held.map((p) => {
    const alloc = total ? (p.sizeUsd / total) * 100 : 0;
    const worst = p.stopPct !== null ? `, stop ${p.stopPct.toFixed(1)}% below entry: worst case about −$${((max * p.stopPct) / 100).toFixed(2)}` : ", with no stop-loss";
    return `<div class="tile"><div class="row" style="gap:12px"><span class="av sm">${esc(p.symbol.slice(0, 3))}</span><span class="grow" style="min-width:0"><b class="md">${esc(p.symbol)} <span class="pill ok" style="margin-left:4px">Live</span></b><span class="sm mut" style="display:block">${alloc.toFixed(0)}% of portfolio${me ? ` · ${money(p.sizeUsd)}` : ""}${p.from !== "you" ? ` · copied from @${esc(p.from)}` : ""}</span></span><span style="text-align:right"><b class="${signCls(p.pnlPct)}">${pct(p.pnlPct)}</b><span class="xs mut" style="display:block">since entry</span></span></div>
<div class="bar" style="margin-top:10px" aria-hidden="true"><i style="width:${alloc.toFixed(0)}%"></i></div>
<div class="row sp" style="margin-top:8px;gap:8px"><span class="xs row" style="gap:10px">${p.stopPct !== null ? `<span class="down">Stop −${p.stopPct.toFixed(1)}%</span>` : '<span class="warn">No stop</span>'}${p.tpPct !== null ? `<span class="up">Target +${p.tpPct.toFixed(1)}%</span>` : '<span class="mut">No target</span>'}</span>${copyBtn(p.tradeId, `${p.symbol} position`, worst)}</div></div>`;
  }).join("");
  const resting = book.resting.map((r) => `<div class="tile row sp" style="gap:10px"><span class="row" style="gap:12px"><span class="av sm">${esc(r.symbol.slice(0, 3))}</span><span><b class="md">${esc(r.label)} buy · ${esc(r.symbol)}</b><span class="sm mut" style="display:block">${r.price ? `at $${Number(r.price).toFixed(2)} · ` : ""}waiting · placed ${ago(r.at)} ago</span></span></span>${copyBtn(r.tradeId, `${r.symbol} ${r.label.toLowerCase()} order`, ", resting at the same price")}</div>`).join("");
  return `<div class="row sp"><h2 class="row" style="gap:8px"><span class="live" aria-hidden="true"></span>Live now</h2><span class="sm mut">${book.held.length + book.resting.length} open</span></div>
${held}${resting}${held || resting ? "" : '<div class="sm mut">Nothing open right now.</div>'}
${madeByMonth(monthlyHistory(u.id), me)}`;
}

export async function profilePage(viewer: number, handle: string, q: Record<string, unknown>): Promise<string> {
  const u = userByHandle(handle);
  if (!u) return notFound("Trader not found");
  handle = u.handle;
  const p = await profile(u.id);
  const range = String(q.r ?? "All");
  const tab = String(q.tab ?? "Overview");
  const src = String(q.src ?? "All");
  const href = (extra: Record<string, string>) => `/u/${esc(handle)}?` + new URLSearchParams({ r: range, tab, ...extra }).toString();
  const curve = (db.prepare("SELECT pnl_pct FROM snapshots WHERE trader = ? AND at >= ? ORDER BY at").all(u.id, Date.now() - (RANGE_MS[range] ?? 1e15)) as unknown as { pnl_pct: number }[]).map((r) => r.pnl_pct);
  const line = polyline(curve, 390, 150);
  const me = viewer === u.id;
  const rules = getFollowRules(viewer, u.id);
  const watching = isWatching(viewer, u.id);
  const bot = getMeta(u.id).bot;
  const events = guardEvents(u.id);
  const all = (await feed(viewer, { time: "30d" }, 80)).filter((c) => c.leader === u.id);
  const trades = all.filter((c) => src === "All" || (src === "Bot" ? c.source !== "user" : c.source === "user"));
  const dd = p.maxDd;
  const followers = watchersCount(u.id);
  const following = new Set([...watchingOf(u.id), ...followingOf(u.id).map((f) => f.leader)]).size;
  const tabBody =
    // Past trades show only in the portfolio (live book + what they made each month); "Trades" is an old link to it.
    tab === "Portfolio" || tab === "Trades" ? await portfolioTab(u, me, viewer)
    : tab === "Guard" ? `<div class="card ${p.halted ? "bad" : ""}"><div class="row sp"><b>Risk score ${p.risk}</b><span class="pill ${p.halted ? "bad" : "ok"}">${p.halted ? "Paused" : riskWord(p.risk)}</span></div><div class="bar ${p.risk >= 65 ? "r" : ""}" style="margin-top:10px"><i style="width:${p.risk}%"></i></div><div class="sm mut" style="margin-top:6px">Pause line ${RISK_LINE.Balanced} (Balanced)</div></div>
${events.map((e) => `<div class="tile"><div class="row sp"><b class="md">${e.kind === "halt" ? "Paused by Guard" : "Cleared by Guard"}</b><span class="sm mut">${ago(e.at)} ago</span></div><div class="sm mut" style="margin-top:4px">${esc(e.reason ?? "Checks passed")}</div>${e.tx ? `<div class="sm up" style="margin-top:4px">tx ${esc(e.tx.slice(0, 18))}…</div>` : ""}</div>`).join("") || '<div class="sm mut">No Guard incidents.</div>'}`
    : tab === "Badges" ? (p.badges.length ? `<div class="grid3">${p.badges.map((b) => `<div class="tile col" style="align-items:center;text-align:center;gap:8px;padding:14px 8px"><span class="medal on" aria-hidden="true">${icon(b.icon, 22)}</span><span class="sm" style="font-weight:600">${esc(b.label)}</span></div>`).join("")}</div>` : '<span class="sm mut">No badges yet.</span>')
    : `<h2>Stats</h2><div class="grid2">${stat("Win rate", p.winRate === null ? "—" : p.winRate + "%")}${stat("Guard pauses", `${p.guardPauses} in ${p.days || 0} days`)}${stat("Copies", String(p.copies))}${stat("Track record", `${p.days} days · ${p.trades} trades`)}</div>
${splitCard(u.id)}
${botsStrip(u.id)}
<div class="tile"><div class="row sp sm mut"><span>Max drawdown</span><span>${riskWord(Math.min(100, dd * 3.5))}</span></div><div style="font-size:18px;font-weight:600;margin-top:4px">${dd ? "−" + dd.toFixed(1) + "pp" : "—"}</div><div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, (dd / 25) * 100)}%"></i></div></div>`;
  const cta = me ? `<a class="btn p" href="/profile/edit" style="flex:2">Edit profile</a>`
    : rules ? `<a class="btn" href="/traders" style="flex:2">Copying · manage</a>`
    : p.halted ? `<a class="btn" href="/guard" style="flex:2">Paused by Guard</a>`
    : `<a class="btn p only-m" href="/copy/${esc(handle)}" style="flex:2">${icon("bolt", 14)}Copy with Flash</a><button class="btn p only-d" data-open="copymodal" style="flex:2">${icon("bolt", 14)}Copy with Flash</button>`;
  const count = (n: number, label: string, link?: string) => `<${link ? `a href="${link}"` : "span"} class="pcount"><b>${n}</b><span>${label}</span></${link ? "a" : "span"}>`;
  const botBanner = bot.on
    ? `<a class="card row" href="${me ? "/bot" : href({ tab: "Trades", src: "Bot" })}" style="margin:0 20px 12px;gap:12px;color:#F5F5F5;border-color:rgba(52,211,153,.3);background:linear-gradient(135deg,rgba(52,211,153,.08),#141414 60%)"><span class="ic36" style="color:#34D399;background:rgba(52,211,153,.12)">${icon("bot", 18, "currentColor", 2)}</span><span class="grow"><b class="md" style="display:block">${me ? "Your bot is on" : `@${esc(handle)} runs a bot`}</b><span class="sm mut">Chainlink CRE strategy · $${bot.usd} a trade · up to ${bot.perDay} a day · tagged Bot</span></span><span class="mut" aria-hidden="true">›</span></a>`
    : me ? `<a class="flat row" href="/bot" style="margin:0 20px 12px;gap:12px;color:#F5F5F5"><span class="ic36">${icon("bot", 18, "currentColor", 2)}</span><span class="grow"><b class="md" style="display:block">Turn on your bot</b><span class="sm mut">It trades the CRE strategy under your name, tagged Bot</span></span><span class="mut" aria-hidden="true">›</span></a>` : "";
  const body = `<header class="hd" style="justify-content:space-between">${`<a class="ic" href="/feed" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a>`}<a class="ic" href="/share/${esc(handle)}" aria-label="Share">${icon("share", 17, "currentColor", 2)}</a></header>
<div class="row" style="padding:0 20px 10px;gap:14px;align-items:flex-start"><a class="av w lg pav" ${me ? 'href="/profile/edit" aria-label="Change photo"' : 'aria-hidden="true"'}>${face(handle)}${me ? `<i>${icon("camera", 12, "currentColor", 2.2)}</i>` : ""}</a>
<div class="grow" style="min-width:0"><h1 style="margin:0;font-size:20px">@${esc(handle)}</h1><div class="sm mut">${esc(u.persona ?? "Trader")} · Lv ${p.level} · ${p.days ? `trading ${p.days} day${p.days === 1 ? "" : "s"}` : "new"}</div>${u.bio ? `<p class="md" style="margin:6px 0 0;color:#D4D4D4;line-height:1.45">${esc(u.bio)}</p>` : me ? `<a class="sm" href="/profile/edit" style="display:inline-block;margin-top:6px">Add a bio</a>` : ""}</div>
<div style="text-align:right"><div class="${signCls(p.pnlPct)} lg" style="font-size:22px">${pct(p.pnlPct, 1)}</div><div class="xs mut">total return</div></div></div>
<div class="row" style="padding:0 20px 12px;gap:18px">${count(followers, followers === 1 ? "follower" : "followers")}${count(p.followers, p.followers === 1 ? "copier" : "copiers")}${count(following, "following")}</div>
${me ? "" : `<div class="grid2" style="padding:0 20px 12px"><button class="btn sm${watching ? "" : " p"}" style="width:100%" data-act="/api/watch" data-body='{"leader":"${esc(handle)}"}' aria-pressed="${watching}">${watching ? `${icon("check", 13, "currentColor", 2.4)}Following` : `${icon("userplus", 14, "currentColor", 2)}Follow`}</button><a class="btn sm" style="width:100%" href="/cat/chat?new=1&q=${encodeURIComponent(`Is @${handle} worth copying?`)}" aria-label="Ask Cat about @${esc(handle)}"><span class="orb" aria-hidden="true" style="width:16px;height:16px"><i></i></span>Ask Cat</a></div>`}
${p.halted ? `<div class="card bad" style="margin:0 20px 12px"><div class="row" style="gap:8px">${icon("shield", 16, "#F87171")}<b class="down">Paused by CopyGuard</b></div><div class="sm" style="color:#FECACA;margin-top:4px">${esc(p.halted.reason)}</div></div>` : ""}
${botBanner}
${me ? "" : await catReadCard(viewer, u.id, "margin:0 20px 12px")}
<section aria-label="Equity curve"><svg viewBox="0 0 390 150" width="100%" height="150" preserveAspectRatio="none" role="img" aria-label="Return since start"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#34D399" stop-opacity=".25"/><stop offset="1" stop-color="#34D399" stop-opacity="0"/></linearGradient></defs><path d="${line} L390 150 L0 150 Z" fill="url(#g)"/><path d="${line}" fill="none" stroke="#34D399" stroke-width="2"/></svg></section>
<div class="row sp" style="padding:8px 20px">${seg(["1D", "1W", "1M", "All"].map((r) => ({ label: r, href: href({ r }), on: r === range })), true, "Range")}</div>
<div style="padding:0 20px 8px">${seg(["Overview", "Portfolio", "Guard", "Badges"].map((t) => ({ label: t, href: href({ tab: t }), on: t === tab || (t === "Portfolio" && tab === "Trades") })), false, "Profile")}</div>
<main class="main" style="padding-bottom:120px;gap:12px">${tabBody}<p class="note">${DISCLAIMER}</p></main>
<div style="position:fixed;left:var(--cx,50%);bottom:0;transform:translateX(-50%);width:100%;max-width:820px;padding:12px 20px 24px;background:linear-gradient(180deg,rgba(10,10,10,0),#0A0A0A 40%);z-index:20"><div class="row" style="gap:8px"><a class="btn" href="/share/${esc(handle)}" style="flex:1">${icon("share", 16, "currentColor", 2)}Share</a>${cta}</div></div>`;
  const modal = rules || me || p.halted ? "" : sheet("copymodal", `<div class="row sp" style="margin-bottom:8px"><b>Copy @${esc(handle)}</b><button class="ic s" data-close="copymodal" aria-label="Close">${icon("close", 14, "currentColor", 2.4)}</button></div><iframe title="Copy @${esc(handle)}" src="/copy/${esc(handle)}?embed=1" style="width:100%;height:640px;border:0;background:transparent"></iframe>`);
  return page({ title: `@${handle}`, body, sheets: modal });
}

// ---------- Copy wizard ----------

const PRESETS = {
  Guardian: { max: 10, cap: 40, stop: true, strict: "Strict", sub: "Safest" },
  Hodler: { max: 20, cap: 80, stop: true, strict: "Balanced", sub: "Steady" },
  Sniper: { max: 25, cap: 100, stop: true, strict: "Balanced", sub: "Quiz default" },
  Degen: { max: 50, cap: 200, stop: false, strict: "Relaxed", sub: "Riskiest" },
} as const;

/** What these rules would have done on the leader's last 30 days of buys, marked to market. Real fills, not a promise. */
export async function simulateCopy(leader: number, rules: FollowRules) {
  const since = Date.now() - 30 * 86400e3;
  const rows = db.prepare("SELECT t.id, t.trade, o.price FROM trades t JOIN orders o ON o.trade_id = t.id AND o.trader = t.leader AND o.role = 'own' WHERE t.leader = ? AND t.private = 0 AND t.at >= ? AND o.price IS NOT NULL").all(leader, since) as unknown as { id: number; trade: string; price: number }[];
  let copied = 0, pnl = 0, invested = 0, worst = 0, total = 0;
  for (const r of rows) {
    const t = JSON.parse(r.trade) as Trade;
    if (t.side !== "buy") continue;
    total++;
    const d = decide(t, { ...rules, mode: "ask" }, { spentToday: 0, halted: false });
    if (d.action === "skip") continue;
    const mark = await getPrice(t.target).catch(() => r.price);
    const ret = mark / r.price - 1;
    copied++; invested += d.usd; pnl += d.usd * ret; worst = Math.min(worst, ret * 100);
  }
  return { copied, total, pnlPct: invested ? (pnl / invested) * 100 : 0, worst };
}

export async function copyPage(viewer: number, handle: string, done: boolean, embed = false): Promise<string> {
  const lu = userByHandle(handle);
  if (!lu || lu.id === viewer) return notFound("Trader not found");
  const meta = getMeta(viewer);
  const cur = getFollowRules(viewer, lu.id);
  const d = meta.defaults;
  const ext = getUser(viewer).wallet_kind === "external";
  const mode = ext ? "ask" : cur?.mode ?? d.mode;
  const maxv = cur?.maxUsdPerTrade ?? d.max, capv = cur?.dailyCapUsd ?? d.cap, stop = cur?.requireStop ?? d.stop, ratio = cur?.ratio ?? 1, budget = cur?.budgetUsd ?? 250;
  const myStop = cur?.stopPct ?? 0, closeP = cur?.closeOnPause ?? false;
  const persona = (getUser(viewer).persona ?? "Sniper") as keyof typeof PRESETS;
  const initial = await simulateCopy(lu.id, { ...DEFAULT_RULES, maxUsdPerTrade: maxv, dailyCapUsd: capv, requireStop: stop, ratio });
  const free = meta.simBalance;
  const radio = (name: string, val: string, label: string, on: boolean, sub = "") => `<button type="button" class="opt${on ? " on" : ""}" data-pick data-name="${name}" data-val="${val}" role="radio" aria-checked="${on}" style="${sub ? "" : "justify-content:center"}">${label}${sub ? `<span class="sm dim">${sub}</span>` : ""}</button>`;
  const stepper = (name: string, label: string, v: number, delta: number, min: number) => `<div class="row sp" style="min-height:52px;border-bottom:1px solid #222"><span class="md">${label}</span><span class="row" style="gap:10px"><button type="button" class="ic s" data-step data-name="${name}" data-delta="${-delta}" data-min="${min}" aria-label="Decrease ${label}">−</button><b style="min-width:52px;text-align:center">$<span data-bind="${name}">${v}</span></b><button type="button" class="ic s" data-step data-name="${name}" data-delta="${delta}" data-min="${min}" aria-label="Increase ${label}">+</button></span></div>`;
  const body = done
    ? `<header class="hd"><a class="ic" href="/u/${esc(handle)}" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a><div class="grow"><h1>Copy @${esc(handle)}</h1><div class="sub">Done</div></div></header>
<main class="main" style="justify-content:center;text-align:center;gap:14px"><span style="width:72px;height:72px;border-radius:36px;background:rgba(52,211,153,.12);color:#34D399;display:flex;align-items:center;justify-content:center;margin:0 auto">${icon("check", 32, "currentColor", 2.6)}</span><h1 class="h1">You're copying @${esc(handle)}</h1>
<p class="mut" style="margin:0;font-size:15px;line-height:1.5">${mode === "auto" ? `Their next trade that passes Guard copies automatically, up to ${money(maxv)}.` : "When they trade, you'll get a request to approve. Link Telegram in Alerts to approve from there."}</p>
<div class="grid2" style="margin-top:12px"><a class="btn" ${embed ? 'target="_top" ' : ""}href="/traders">My traders</a><a class="btn p" ${embed ? 'target="_top" ' : ""}href="/feed">Back to feed</a></div></main>`
    : `<header class="hd"><a class="ic" href="/u/${esc(handle)}" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a><div class="grow"><h1>Copy @${esc(handle)}</h1><div class="sub" data-steplabel data-labels="Step 1 of 4 · Budget|Step 2 of 4 · Mode|Step 3 of 4 · Safety|Step 4 of 4 · Review">Step 1 of 4 · Budget</div></div><span class="av w">${face(handle)}</span></header>
<main class="main" data-scope id="cp" data-leader="${lu.id}"><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px">${[1, 2, 3, 4].map((i) => `<span data-bar="${i}" style="height:4px;border-radius:2px;background:${i === 1 ? "#34D399" : "#262626"}"></span>`).join("")}</div>
<input type="hidden" name="leader" value="${esc(handle)}"><input type="hidden" name="budget" value="${budget}"><input type="hidden" name="ratio" value="${ratio}"><input type="hidden" name="mode" value="${mode}"><input type="hidden" name="max" value="${maxv}"><input type="hidden" name="cap" value="${capv}"><input type="hidden" name="stop" value="${stop ? 1 : 0}"><input type="hidden" name="stopPct" value="${myStop}"><input type="hidden" name="close" value="${closeP ? 1 : 0}">
<section class="step col" data-step-id="1"><div><h1 class="h1">How much to put in?</h1><p class="mut" style="margin:8px 0 0;font-size:15px">This is the most Tribe will ever use to copy @${esc(handle)}.</p></div>
${await catReadCard(viewer, lu.id)}
<div class="card" style="text-align:center"><div class="big" style="font-size:44px">$<span data-bind="budget">${budget}</span></div><div class="sm mut">of ${money(free)} free in your wallet</div><div class="chips" style="justify-content:center;margin-top:12px">${[50, 100, 250, 500].map((a) => `<button type="button" class="chip${a === budget ? " on" : ""}" data-pick data-name="budget" data-val="${a}">$${a}</button>`).join("")}</div></div>
<div class="card"><div class="row sp"><b class="md">Copy ratio</b><span class="sm mut"><span data-bind="ratio">${ratio}</span>× their size</span></div><div class="grid4" style="margin-top:10px" role="radiogroup">${[0.25, 0.5, 1, 2].map((r) => `<button type="button" class="chip${r === ratio ? " on" : ""}" data-pick data-name="ratio" data-val="${r}" style="justify-content:center">${r}×</button>`).join("")}</div><div class="note" style="margin-top:8px">If they buy $250, you buy <span id="ex">$${Math.min(250 * ratio, maxv)}</span>, within your limits.</div></div>
<button type="button" class="btn p big" data-goto="2" style="margin-top:auto">Continue</button></section>
<section class="step col hide" data-step-id="2"><div><h1 class="h1">Approve each trade, or copy automatically?</h1><p class="mut" style="margin:8px 0 0;font-size:15px">You can switch any time in My traders.</p></div>
<div class="col" role="radiogroup" style="gap:10px"><button type="button" class="opt${mode === "ask" ? " on" : ""}" data-pick data-name="mode" data-val="ask" role="radio" aria-checked="${mode === "ask"}" style="align-items:flex-start;padding:16px;gap:12px;justify-content:flex-start"><span class="dot" style="margin-top:2px"></span><span><b style="display:block">Ask me first</b><span class="sm mut" style="display:block;margin-top:4px;line-height:1.45">${ext ? `Each trade waits ${meta.timerSec} seconds for you to approve it in MetaMask. Nothing is signed without you.` : `Each trade waits for your OK with a ${meta.timerSec} second timer. Nothing is signed without you.`}</span><span class="xs dim">No extra permission needed</span></span></button>
${ext
    ? `<div class="opt" aria-disabled="true" style="align-items:flex-start;padding:16px;gap:12px;justify-content:flex-start;opacity:.55"><span class="dot" style="margin-top:2px"></span><span><b style="display:block">Copy automatically</b><span class="sm mut" style="display:block;margin-top:4px;line-height:1.45">Not available with MetaMask: Tribe never holds your key, so you approve each copy in your wallet.</span></span></div>`
    : `<button type="button" class="opt${mode === "auto" ? " on" : ""}" data-pick data-name="mode" data-val="auto" role="radio" aria-checked="${mode === "auto"}" style="align-items:flex-start;padding:16px;gap:12px;justify-content:flex-start"><span class="dot" style="margin-top:2px"></span><span><b style="display:block">Copy automatically</b><span class="sm mut" style="display:block;margin-top:4px;line-height:1.45">Trades that pass Guard and your limits are placed right away, even while you sleep.</span><span class="xs warn">Needs a limited signing permission in step 4</span></span></button>`}</div>
<div class="row" style="margin-top:auto;gap:8px"><button type="button" class="btn" data-goto="1">Back</button><button type="button" class="btn p" data-goto="3">Continue</button></div></section>
<section class="step col hide" data-step-id="3"><div><h1 class="h1">Safety limits</h1><p class="mut" style="margin:8px 0 0;font-size:15px">Start from a preset. Yours is from your quiz.</p></div>
<div class="grid4" role="radiogroup">${(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => `<button type="button" class="chip${k === persona ? " on" : ""}" data-pick data-name="preset" data-val="${k}" data-max="${PRESETS[k].max}" data-cap="${PRESETS[k].cap}" data-stop="${PRESETS[k].stop ? 1 : 0}" style="flex-direction:column;height:56px;border-radius:14px;justify-content:center;gap:0;padding:0 4px"><span>${k}</span><span class="xs dim">${PRESETS[k].sub}</span></button>`).join("")}</div><input type="hidden" name="preset" value="${persona}">
<div class="tile" style="padding:2px 14px">${stepper("max", "Max per trade", maxv, 5, 5)}${stepper("cap", "Daily cap", capv, 20, 20)}<div class="row sp" style="min-height:52px;border-bottom:1px solid #222"><span class="md">Only trades with a stop-loss</span>${sw(stop, "Only trades with a stop-loss", `id="stopsw" type="button"`)}</div>
<div style="padding:12px 0;border-bottom:1px solid #222"><div class="row sp"><span class="md">My own stop-loss</span><span class="xs dim">below entry</span></div><div class="grid4" role="radiogroup" aria-label="My own stop-loss" style="margin-top:10px">${[0, 5, 8, 12].map((p) => `<button type="button" class="chip${p === myStop ? " on" : ""}" data-pick data-name="stopPct" data-val="${p}" role="radio" aria-checked="${p === myStop}" style="justify-content:center">${p ? `${p}%` : "Off"}</button>`).join("")}</div><div class="xs dim" style="margin-top:8px;line-height:1.45">Used when they trade without a stop, or when yours is safer than theirs.</div></div>
<div class="row sp" style="min-height:52px;gap:12px"><span class="md">Sell my copies if Guard pauses them</span>${sw(closeP, "Sell my copies if Guard pauses them", `id="closesw" type="button"`)}</div></div>
<div class="tile"><div class="sm mut">With these limits, last 30 days</div><div class="md" style="margin-top:4px">You'd have copied <span id="s-n">${initial.copied}</span> of <span id="s-t">${initial.total}</span> trades: <span id="s-p" class="${signCls(initial.pnlPct)}">${pct(initial.pnlPct)}</span></div><div class="xs dim" style="margin-top:4px">Worst dip <span id="s-w">${initial.worst ? pct(initial.worst) : "—"}</span> · marked to market on real fills, not a promise</div></div>
<div class="row" style="margin-top:auto;gap:8px"><button type="button" class="btn" data-goto="2">Back</button><button type="button" class="btn p" data-goto="4">Continue</button></div></section>
<section class="step col hide" data-step-id="4"><div><h1 class="h1">Review and sign</h1><p class="mut" style="margin:8px 0 0;font-size:15px">One signature. Nothing moves until @${esc(handle)} trades.</p></div>
<div class="tile" style="padding:4px 14px" id="summary"></div>
<div id="autoNote" class="card hide" style="border-color:rgba(252,211,77,.35)"><b class="warn sm" style="display:block">Auto-copy permission</b><span class="sm" style="color:#C4C4C4;line-height:1.5">Lets Tribe place Flash orders for you: up to $<span data-bind="max">${maxv}</span> each and $<span data-bind="cap">${capv}</span> a day, only when @${esc(handle)} trades, for 30 days. Revoke any time in Me.</span></div>
<label class="row" style="gap:12px;align-items:flex-start;font-size:13px;color:#D4D4D4;line-height:1.45"><input type="checkbox" id="ack" style="width:22px;height:22px;accent-color:#34D399;flex-shrink:0;margin-top:2px">I understand copying is risky, past results aren't a promise, and Guard reduces but can't remove losses.</label>
<div class="row" style="margin-top:auto;gap:8px"><button type="button" class="btn" data-goto="3">Back</button><button type="button" class="btn p" id="go" data-act="/api/follow" data-collect="#cp" disabled>Start copying</button></div></section></main>
<script>(function(){var sc=document.getElementById('cp');function v(n){return sc.querySelector('input[name='+n+']').value}
var RL={'0.25':'0.25×','0.5':'0.5×','1':'1×','2':'2×'};
function summary(){var rows=[['Budget','$'+v('budget')],['Copy ratio',RL[v('ratio')]||v('ratio')+'×'],['Mode',v('mode')==='ask'?'Ask me first':'Automatic'],['Limits','$'+v('max')+' a trade · $'+v('cap')+' a day'],['Stop-loss required',v('stop')==='1'?'Yes':'No'],['My own stop',v('stopPct')==='0'?'Off':v('stopPct')+'% below entry'],['If Guard pauses them',v('close')==='1'?'Sell my copies':'Keep my copies']];
document.getElementById('summary').innerHTML=rows.map(function(r){return '<div class="row sp md" style="min-height:44px;border-bottom:1px solid #222"><span class="mut">'+r[0]+'</span><b>'+r[1]+'</b></div>'}).join('');document.getElementById('autoNote').classList.toggle('hide',v('mode')!=='auto');document.getElementById('go').textContent=v('mode')==='auto'?'Sign permission & start':'Start copying';document.getElementById('ex').textContent='$'+Math.min(250*Number(v('ratio')),Number(v('max')))}
var t;function sim(){clearTimeout(t);t=setTimeout(function(){fetch('/api/simulate?leader='+sc.dataset.leader+'&max='+v('max')+'&cap='+v('cap')+'&stop='+v('stop')+'&ratio='+v('ratio')).then(function(r){return r.json()}).then(function(j){document.getElementById('s-n').textContent=j.copied;document.getElementById('s-t').textContent=j.total;var p=document.getElementById('s-p');p.textContent=(j.pnlPct>=0?'+':'−')+Math.abs(j.pnlPct).toFixed(1)+'%';p.className=j.pnlPct>=0?'up':'down';document.getElementById('s-w').textContent=j.worst?(j.worst>=0?'+':'−')+Math.abs(j.worst).toFixed(1)+'%':'—'})},200)}
sc.addEventListener('click',function(e){var b=e.target.closest('[data-pick][data-name=preset]');if(b){sc.querySelector('input[name=max]').value=b.dataset.max;sc.querySelector('input[name=cap]').value=b.dataset.cap;sc.querySelector('input[name=stop]').value=b.dataset.stop;['max','cap'].forEach(function(n){sc.querySelectorAll('[data-bind='+n+']').forEach(function(x){x.textContent=b.dataset[n]})});document.getElementById('stopsw').setAttribute('aria-checked',b.dataset.stop==='1'?'true':'false')}
var s=e.target.closest('#stopsw');if(s){e.stopPropagation();var on=s.getAttribute('aria-checked')!=='true';s.setAttribute('aria-checked',on?'true':'false');sc.querySelector('input[name=stop]').value=on?1:0}
var c=e.target.closest('#closesw');if(c){e.stopPropagation();var cl=c.getAttribute('aria-checked')!=='true';c.setAttribute('aria-checked',cl?'true':'false');sc.querySelector('input[name=close]').value=cl?1:0}
setTimeout(function(){summary();sim()},0)},true);
document.getElementById('ack').onchange=function(){document.getElementById('go').disabled=!this.checked};summary()})()</script>`;
  return page({ title: `Copy @${handle}`, body, focus: embed, extraClass: embed ? "embed" : "", head: embed ? "<style>body{background:transparent!important}.app.embed{background:transparent!important;min-height:0}</style>" : "" });
}

// ---------- Requests (approve copy) ----------

export async function requestsPage(viewer: number, q: Record<string, unknown>): Promise<string> {
  const pend = pendingFor(viewer);
  const meta = getMeta(viewer);
  const result = String(q.result ?? "");
  const sel = pend.find((p) => String(p.id) === String(q.id)) ?? pend[0];
  const expired = !sel ? (db.prepare("SELECT leader, trade FROM pending_copies WHERE follower = ? AND status = 'open' AND expires_at <= ? ORDER BY expires_at DESC LIMIT 1").get(viewer, Date.now()) as { leader: number; trade: string } | undefined) : undefined;
  const issues: Record<string, [string, string, string, string, boolean]> = {
    insufficient: ["Not enough free balance", "This copy needs more free USDC than you have.", "Add funds", "/funds", true],
    failed: ["Not copied", String(q.msg ?? "The order could not be placed. Nothing was spent."), "Check Activity", "/activity", true],
    ok: ["Copied", "Your Flash order was placed with its stop and target.", "See position", "/positions", false],
    skipped: ["Skipped", "Nothing was sent.", "Back to feed", "/feed", false],
  };
  const resultCard = result && issues[result] ? `<div class="card ${issues[result][4] ? "bad" : "good"}" role="status"><b class="${issues[result][4] ? "down" : "up"}">${issues[result][0]}</b><div class="sm" style="margin:4px 0 10px;color:#D4D4D4">${esc(issues[result][1])}</div><a class="btn sm" href="${issues[result][3]}">${issues[result][2]}</a></div>` : "";
  let main = "";
  let aside = "";
  if (sel) {
    const c = await tradeCard(sel.trade_id, viewer);
    const lh = userById(sel.leader)!.handle;
    const orig = tradeById(sel.trade_id)?.trade as Trade | undefined;
    const risk = await riskOf(sel.leader);
    const rules = getFollowRules(viewer, sel.leader);
    const st = sel.trade as Trade;
    // Standalone protective orders carry triggers; an entry with a bracket attached carries its legs in `attach`.
    const trig = st.triggers ?? (st.attach ? [{ triggerType: "upper", notionalPrice: st.attach.tp }, { triggerType: "lower", notionalPrice: st.attach.sl }] : []);
    const legs =trig.length ? trig.map((t) => `<div><div class="xs mut">${t.triggerType === "upper" ? "Take profit" : "Stop-loss"}</div><div class="md" style="font-weight:600">$${t.notionalPrice}</div></div>`).join("") : "";
    const free = await freeBalance(viewer);
    const waiting = `<section><h2 style="font-size:15px;margin-bottom:6px">Also waiting</h2>${pend.filter((p) => p.id !== sel.id).map((p) => `<a class="line" href="/requests?id=${p.id}" style="color:#F5F5F5"><span class="av sm">${face(userById(p.leader)?.handle ?? "?")}</span><span class="grow"><span class="t">@${esc(userById(p.leader)?.handle ?? "")} · ${esc(ORDER_LABEL[p.trade.orderType] ?? "")}</span><span class="s">Your copy ${p.trade.side === "buy" ? "$" : ""}${p.trade.qty}</span></span><span class="sm mut" data-expire="${p.expires_at}"></span></a>`).join("")}</section>`;
    const spent = (db.prepare("SELECT COALESCE(SUM(usd), 0) AS s FROM copies WHERE follower = ? AND leader = ? AND at >= ? AND status IN ('executed','dry-run')").get(viewer, sel.leader, new Date().setUTCHours(0, 0, 0, 0)) as { s: number }).s;
    const kv = (k: string, v: string) => `<div class="row sp md" style="min-height:40px;border-top:1px solid #1F1F1F"><span class="mut">${k}</span><b>${v}</b></div>`;
    aside = `${pend.length > 1 ? `<section class="flat">${waiting}</section>` : ""}
<section class="flat"><div class="row sp" style="margin-bottom:6px"><h2 style="font-size:16px">Your rules for @${esc(lh)}</h2><a class="sm" href="/copy/${esc(lh)}">Edit</a></div>${rules ? kv("Mode", rules.mode === "auto" ? "Auto" : "Ask me first") + kv("Ratio", `${rules.ratio}×`) + kv("Max per trade", money(rules.maxUsdPerTrade)) + kv("Daily cap", `${money(rules.dailyCapUsd)} · ${money(spent)} used`) + kv("Stop-loss required", rules.requireStop ? "Yes" : "No") : '<div class="sm mut">Default rules</div>'}</section>
<div class="note" style="padding:0 4px">You can also approve from Telegram.</div>`;
    const checks: [string, string, string][] = [
      ["Trader filled onchain", "Real fill, not a screenshot", ago(c?.at ?? Date.now()) + " ago"],
      ["CRE Guard check", `Risk ${risk} of 100 · ${haltOf(sel.leader) ? "paused" : "not paused"}`, haltOf(sel.leader) ? "Paused" : "Passed"],
      ["Your filters", rules ? `${rules.requireStop ? "Needs stop · " : ""}max ${money(rules.maxUsdPerTrade)} · cap ${money(rules.dailyCapUsd)}` : "Defaults", "Passed"],
      ["Sign Flash order", "Waiting for you", "Now"],
    ];
    main = `<section class="card col" data-card><div class="row"><span class="av w">${face(lh)}</span><div class="grow"><div style="font-weight:600">@${esc(lh)} just traded</div><div class="sm mut">${esc(c?.symbol ?? "")} ${esc(sel.trade.side)} · ${esc(c?.orderLabel ?? "")}</div></div><span role="timer" class="pill ok" data-expire="${sel.expires_at}" data-total="${meta.timerSec * 1000}" data-reload="1"></span></div>
<div class="bar" aria-hidden="true"><i data-expire-bar style="width:100%"></i></div>
<div class="row sp" style="align-items:flex-end"><div><div class="xs mut">Their size</div><div style="font-size:22px;font-weight:600">${orig ? (orig.side === "buy" ? "$" : "") + orig.qty : "—"}</div></div>${icon("chev", 16, "#8A8A8A", 2)}<div style="text-align:right"><div class="xs mut">Your copy</div><div class="up" style="font-size:22px;font-weight:600">${sel.trade.side === "buy" ? "$" : ""}${sel.trade.qty}</div></div><div class="only-d" style="text-align:right;padding-left:24px;border-left:1px solid #262626"><div class="xs mut">Free balance after</div><div style="font-size:22px;font-weight:600">${money(free - (sel.trade.side === "buy" ? Number(sel.trade.qty) : 0))}</div></div></div>
<div class="sm mut">${rules ? `${rules.ratio}× ratio, capped by your ${money(rules.maxUsdPerTrade)} max per trade` : ""}</div>
<div class="tile"><div class="row" style="gap:6px;margin-bottom:6px"><span class="pill flash">${icon("bolt", 11)}Flash</span><span class="sm mut">${trig.length ? "Protective legs copied with the entry" : "Single order"}</span></div><div class="grid3"><div><div class="xs mut">Entry</div><div class="md" style="font-weight:600">${esc(ORDER_LABEL[sel.trade.orderType] ?? "")}</div></div>${legs}</div></div></section>
${await catReadCard(viewer, sel.leader, "", sel.trade_id)}
<section><h2 style="font-size:15px;margin-bottom:6px">Checks</h2><ol style="list-style:none;margin:0;padding:0">${checks.map((s, i) => `<li class="row" style="gap:12px;min-height:56px;align-items:center"><span style="width:22px;height:22px;border-radius:11px;border:2px solid ${i < 3 ? "#34D399" : "#5A5A5A"};background:${i < 3 ? "#34D399" : "transparent"};color:#052E1C;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i < 3 ? icon("check", 12, "currentColor", 3.2) : ""}</span><span class="grow"><span class="md" style="display:block;font-weight:600">${s[0]}</span><span class="sm mut" style="display:block">${esc(s[1])}</span></span><span class="sm ${i < 3 ? "up" : "mut"}">${s[2]}</span></li>`).join("")}</ol></section>
${pend.length > 1 ? `<div class="only-m">${waiting}</div>` : ""}
<div style="position:sticky;bottom:0;padding:12px 0 24px;background:linear-gradient(180deg,rgba(10,10,10,0),#0A0A0A 30%)" id="act"><label class="row sm" style="gap:10px;margin-bottom:10px;color:#D4D4D4"><input type="checkbox" id="always" style="width:20px;height:20px;accent-color:#34D399">Always approve @${esc(lh)} (switch to Auto)</label>
<div class="grid2"><button class="btn" data-act="/api/pending" data-body='{"id":${sel.id},"action":"skip"}'>Skip</button><button class="btn p" id="approve" data-act="/api/pending" data-body='{"id":${sel.id},"action":"approve"}'>${icon("bolt", 14)}Approve &amp; sign<span class="kbd only-d" style="margin-left:6px;color:#052E1C;border-color:rgba(5,46,28,.35)">A</span></button></div>
<div class="note only-m" style="text-align:center;margin-top:8px">You can also approve from Telegram</div></div>
<script>document.getElementById('always').onchange=function(){var a=document.getElementById('approve');var b=JSON.parse(a.dataset.body);b.always=this.checked;a.dataset.body=JSON.stringify(b)}</script>`;
  } else if (expired) {
    const lh = userById(expired.leader)?.handle ?? "";
    main = `<div class="card bad" role="status"><b class="down">Request expired</b><div class="sm" style="margin:4px 0 10px;color:#D4D4D4">The ${meta.timerSec} second window passed, so nothing was sent. Turn on Auto for @${esc(lh)} if you don't want to miss trades.</div><a class="btn sm" href="/copy/${esc(lh)}">Turn on Auto</a></div>`;
  } else if (!resultCard) {
    main = `<div class="empty"><div class="md" style="font-weight:600">No copy requests</div><div class="sm mut">When a trader you copy in ask-first mode trades, it appears here.</div><a class="btn sm" href="/traders">My traders</a></div>`;
  }
  const body = `${header("Copy requests", `Ask-me-first mode · ${pend.length} pending`, "/feed")}${split(`<main class="main" style="gap:14px">${resultCard}${main}</main>`, aside || `<section class="flat"><h2 style="font-size:16px">How requests work</h2><p class="sm mut" style="line-height:1.5;margin:6px 0 0">When a trader you copy in ask-first mode trades, the copy waits here with its stop and target. Nothing is signed until you approve. Press A to approve the open request.</p></section>`, "Request details")}`;
  return page({ title: "Copy requests", body, split: true });
}

// ---------- Positions ----------

export async function positionsPage(viewer: number, tab: string): Promise<string> {
  const open = await openPositions(viewer);
  const closed = closedPositions(viewer);
  const unreal = open.reduce((a, p) => a + p.pnlUsd, 0);
  const card = (p: (typeof open)[number]) => {
    const sl = p.stopPct ?? 0, tp = p.tpPct ?? 0, span = sl + tp || 1;
    const pos = (v: number) => Math.max(2, Math.min(98, ((v + sl) / span) * 100)).toFixed(0) + "%";
    return `<article class="card post" id="p-${p.symbol}"><div class="row"><span class="av">${esc(p.symbol.slice(0, 3))}</span><span class="grow"><b>${esc(p.symbol)} · Long</b><span class="sm mut" style="display:block">from ${p.from === "you" ? "you" : "@" + esc(p.from)} · ${esc(p.type)} · ${money(p.sizeUsd)}</span></span><span style="text-align:right"><b class="${signCls(p.pnlPct)}">${pct(p.pnlPct)}</b><span class="${signCls(p.pnlUsd)} sm" style="display:block">${p.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(p.pnlUsd))}</span></span></div>
${p.fromHalted ? `<div class="sm warn">@${esc(p.from)} is paused by Guard. This position still has its stop.</div>` : ""}${p.from !== "you" ? `<a class="chip askcat" style="align-self:flex-start" href="/cat/chat?new=1&q=${encodeURIComponent(`Is @${p.from} still worth copying?`)}"><span class="orb" aria-hidden="true"><i></i></span>Ask Cat about @${esc(p.from)}</a>` : ""}
${p.stopPct !== null || p.tpPct !== null ? `<div><div role="img" aria-label="Price is ${pct(p.pnlPct)} from entry" style="position:relative;height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(248,113,113,.5),#262626 ${pos(0)},rgba(52,211,153,.5))"><span style="position:absolute;left:${pos(p.pnlPct)};top:-4px;width:2px;height:14px;background:#F5F5F5"></span></div>
<div class="row sp xs mut" style="margin-top:6px"><span>Stop <b style="color:#F87171">${p.stopPct !== null ? "−" + p.stopPct.toFixed(1) + "%" : "—"}</b></span><span>Entry $${p.entry.toFixed(2)} · now $${p.mark.toFixed(2)}</span><span>Target <b style="color:#34D399">${p.tpPct !== null ? "+" + p.tpPct.toFixed(1) + "%" : "—"}</b></span></div></div>` : `<div class="xs mut">No stop or target on this position.</div>`}
<div class="grid2"><button class="btn sm" style="width:100%" data-toggle="e-${p.symbol}">Edit stop</button><button class="btn sm danger" style="width:100%" data-act="/api/position-close" data-body='{"token":"${p.token}"}' data-confirm="Close ${esc(p.symbol)} at market for ${p.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(p.pnlUsd))}?">Close</button></div>
<div class="row hide" id="e-${p.symbol}" style="gap:8px"><span class="sm mut">New stop −</span><input class="f" name="stop" type="number" step="0.5" min="0.5" value="${(p.stopPct ?? 5).toFixed(1)}" style="height:40px;font-size:14px" aria-label="Stop distance percent"><span class="sm mut">%</span><button class="btn sm" data-act="/api/position-stop" data-body='{"token":"${p.token}"}' data-collect="#e-${p.symbol}">Save</button></div></article>`;
  };
  const body = `${header("Positions", "Copied trades you hold right now", "/me")}<main class="main" style="gap:12px">
<section class="card"><div class="row sp"><div><div class="sm mut">Open positions</div><div class="lg">${open.length}</div></div><div style="text-align:right"><div class="sm mut">Unrealized PnL</div><div class="lg ${signCls(unreal)}">${unreal >= 0 ? "+" : "−"}${money(Math.abs(unreal))}</div></div></div><p class="note" style="margin:10px 0 0">Every position keeps its own stop and target, even if you pause or stop copying the trader.</p></section>
${seg([{ label: "Open", href: "/positions", on: tab !== "closed" }, { label: `Closed · ${closed.length}`, href: "/positions?tab=closed", on: tab === "closed" }], false, "Positions")}
${tab === "closed" ? closed.map((c) => `<div class="line"><span class="av sm">${esc(c.symbol.slice(0, 3))}</span><span class="grow"><span class="t">${esc(c.symbol)} sold</span><span class="s">from ${c.from === "you" ? "you" : "@" + esc(c.from)} · ${ago(c.at)} ago</span></span><b class="${signCls(c.pnlUsd)}">${c.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(c.pnlUsd))}</b></div>`).join("") || '<div class="empty"><div class="md" style="font-weight:600">No closed positions yet</div></div>' : open.map(card).join("") || '<div class="empty"><div class="md" style="font-weight:600">Nothing open</div><div class="sm mut">Copy a trader or place a trade with Ask Cat.</div><a class="btn sm" href="/feed">Find traders</a></div>'}
<div style="height:90px"></div></main>`;
  return page({ title: "Positions", nav: "me", body });
}

// ---------- My traders ----------

export async function myTradersPage(viewer: number): Promise<string> {
  const follows = followingOf(viewer);
  const meta = getMeta(viewer);
  const pnl = await copyPnlByLeader(viewer);
  const halted = new Set(allHalts().map((h) => h.leader));
  const totalCopied = [...pnl.values()].reduce((a, v) => a + v.copied, 0);
  const items = follows.map(({ leader, rules }) => {
    const lu = userById(leader)!;
    const v = pnl.get(leader) ?? { pnl: 0, copied: 0 };
    const status = halted.has(leader) && !rules.guardOverride ? ["Paused by Guard", "bad"] : meta.pausedAll ? ["Paused (all)", "warn"] : rules.paused ? ["Paused by you", ""] : ["Copying", "ok"];
    const desc = `${rules.ratio}× · max ${money(rules.maxUsdPerTrade)}${rules.requireStop ? " · stops only" : ""}`;
    return `<article class="card post" style="gap:10px"><div class="row"><span class="av ${status[1] === "bad" ? "" : "w"}" style="${status[1] === "bad" ? "color:#F87171" : ""}">${face(lu.handle)}</span><span class="grow"><a href="/u/${esc(lu.handle)}" style="color:#F5F5F5;font-weight:600">@${esc(lu.handle)}</a><span class="sm mut" style="display:block">${desc}</span></span><span style="text-align:right"><b class="${signCls(v.pnl)}">${v.pnl >= 0 ? "+" : "−"}${money(Math.abs(v.pnl))}</b><span class="sm mut" style="display:block">${money(v.copied)} copied</span></span></div>
<div class="row" style="gap:6px"><span class="pill ${status[1]}">${status[0]}</span><span class="pill">${rules.mode === "auto" ? "Auto" : "Ask first"}</span></div>
<div class="grid3" style="gap:8px"><a class="btn sm" style="width:100%" href="/copy/${esc(lu.handle)}">Rules</a>${halted.has(leader) && !rules.guardOverride ? `<a class="btn sm" style="width:100%" href="/guard">Guard hold</a>` : `<button class="btn sm" style="width:100%" data-act="/api/follow-pause" data-body='{"leader":${leader},"value":${!rules.paused}}' ${meta.pausedAll ? "disabled" : ""}>${rules.paused ? "Resume" : "Pause"}</button>`}<button class="btn sm danger" style="width:100%" data-act="/api/unfollow" data-body='{"leader":${leader}}' data-confirm="Stop copying @${esc(lu.handle)}? Open positions keep their stops.">Stop</button></div></article>`;
  });
  const body = `${header("My traders", `${follows.length} copied · ${money(totalCopied)} in copies`, "/me")}<main class="main" style="gap:12px">
<div class="card row" style="gap:12px"><span class="grow"><b>${meta.pausedAll ? "All copying paused" : "Copying is on"}</b><span class="sm mut" style="display:block">${meta.pausedAll ? "Open positions keep their stops and targets." : "Pause everything with one tap."}</span></span><button class="btn sm ${meta.pausedAll ? "p" : "danger"}" data-act="/api/pause-all" data-body='{"value":${!meta.pausedAll}}'>${meta.pausedAll ? "Resume all" : "Pause all"}</button></div>
${items.join("") || '<div class="empty"><div class="md" style="font-weight:600">You are not copying anyone</div><a class="btn sm" href="/ranks">Browse leaderboard</a></div>'}<div style="height:90px"></div></main>`;
  return page({ title: "My traders", nav: "me", body });
}

// ---------- Thread ----------

export async function threadPage(viewer: number, id: number): Promise<string> {
  const c = await tradeCard(id, viewer);
  if (!c) return notFound("Trade not found");
  const comments = commentsOf(id);
  const copiers = new Set((db.prepare("SELECT follower FROM copies WHERE trade_id = ? AND status IN ('executed','dry-run')").all(id) as unknown as { follower: number }[]).map((r) => r.follower));
  const p = await profile(c.leader);
  const month = windowPnl(c.leader, Date.now() - 30 * 86400e3);
  const main = `<main class="main" style="gap:14px"><a class="sm only-d" href="/feed" style="color:#A3A3A3">← Back to feed</a>
<div class="card post" style="padding:12px"><div class="row"><span class="av w">${face(c.handle)}</span><span class="grow"><b>${c.trade.side === "buy" ? "Opened" : "Closed"} ${esc(c.symbol)}</b><span class="sm mut" style="display:block">@${esc(c.handle)} · ${esc(c.orderLabel)} · ${esc(c.detail)} · ${ago(c.at)}</span></span><span class="pill ${c.guard === "paused" ? "bad" : "ok"}">${c.guard === "paused" ? "Paused by Guard" : "Guard passed"}</span>${c.sincePct !== null ? `<span style="text-align:right"><b class="${signCls(c.sincePct)} lg" style="display:block">${pct(c.sincePct)}</b><span class="xs mut">since entry</span></span>` : ""}</div></div>
<div class="row" style="gap:12px;flex-wrap:wrap">${reactBar(id, viewer)}${reactBreakdown(id)}</div>
<section aria-label="Comments"><h2 style="font-size:16px">${comments.length} comment${comments.length === 1 ? "" : "s"}</h2><div id="cm" class="col" style="gap:0">${comments.map(commentHtml(copiers)).join("") || '<div class="sm mut" style="padding-top:8px">No comments yet. Be first.</div>'}</div></section>
<form data-form action="/api/comment" class="row" style="gap:8px;position:sticky;bottom:0;padding:10px 0 24px;background:linear-gradient(180deg,rgba(10,10,10,0),#0A0A0A 30%)"><input type="hidden" name="trade" value="${id}"><input class="f" name="text" maxlength="280" placeholder="Add a comment" aria-label="Add a comment" autocomplete="off" required><button class="btn p" style="width:auto">Post</button></form></main>`;
  const aside = `<section class="card col" style="gap:14px"><div class="row" style="gap:12px"><span class="av w lg">${face(c.handle)}</span><div class="grow"><b style="display:block;font-size:16px">@${esc(c.handle)}</b><span class="sm mut">${esc(p.user.persona ?? "Trader")} · Lv ${p.level} · ${p.followers} copier${p.followers === 1 ? "" : "s"}</span></div></div>
<div class="grid3">${stat("30d", pct(month.pct), signCls(month.pct))}${stat("Win rate", p.winRate === null ? "—" : p.winRate + "%")}${stat("Guard", `${p.guardPauses} pause${p.guardPauses === 1 ? "" : "s"}`)}</div>
${viewer === c.leader ? "" : `<a class="btn p" href="/copy/${esc(c.handle)}">${icon("bolt", 14)}Copy with Flash</a>`}<a class="btn" href="/u/${esc(c.handle)}">View profile</a></section>
<section class="flat col" style="gap:6px"><h2 style="font-size:16px">${c.copiers} copied this trade</h2><div class="sm mut" style="line-height:1.5">Each copy carried the same stop and target, sized by each follower's own rules.</div></section>`;
  const body = `${header("Comments", `@${c.handle} · ${c.symbol} ${c.trade.side === "buy" ? "long" : "sell"}`, "/feed")}${split(main, aside, "About this trader")}`;
  return page({ title: "Comments", body, split: true });
}
export const commentHtml = (copiers: Set<number>) => (c: { user: number; text: string; at: number; handle: string }) =>
  `<div class="row" style="align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #1C1C1C"><span class="av sm">${face(c.handle)}</span><div class="grow"><div class="row" style="gap:6px"><b class="md">@${esc(c.handle)}</b><span class="xs mut">${ago(c.at)}</span>${copiers.has(c.user) ? '<span class="pill ok">Copied this</span>' : ""}</div><div class="md" style="margin-top:2px;line-height:1.4">${esc(c.text)}</div></div></div>`;

// ---------- Public landing + share ----------

export async function publicPage(handle: string, tradeId?: number): Promise<string> {
  const u = userByHandle(handle);
  if (!u) return notFound("Trader not found");
  const p = await profile(u.id);
  const month = windowPnl(u.id, Date.now() - 30 * 86400e3);
  const url = `${BASE_URL()}/u/${encodeURIComponent(handle)}`;
  const recent = (await Promise.all((db.prepare("SELECT id FROM trades WHERE leader = ? AND private = 0 ORDER BY id DESC LIMIT 5").all(u.id) as unknown as { id: number }[]).map((r) => tradeCard(r.id)))).filter((c) => c !== undefined);
  const spark = p.curve.length > 1 ? `<svg class="only-d" width="100%" height="80" viewBox="0 0 310 80" preserveAspectRatio="none" aria-hidden="true" style="margin-top:12px"><path d="${polyline(p.curve.slice(-40), 310, 80)}" fill="none" stroke="#34D399" stroke-width="2"/></svg>` : "";
  const pitch = `<ul class="mut md" style="margin:0;padding-left:18px;line-height:1.7"><li>Every trade is copied with its stop and target</li><li>A Chainlink-powered Guard pauses risky traders onchain</li><li>Your wallet stays yours, and you set the limits</li></ul>`;
  const join = `<a class="btn p big" href="/onboarding?follow=${esc(handle)}">${icon("bolt", 14)}Join and copy @${esc(handle)}</a>`;
  const shareText = encodeURIComponent(`Copying @${handle} on Tribe, guarded onchain. @DefinitiveFi`);
  const main = `<main class="main" style="gap:16px"><div class="row" style="gap:12px"><span class="av w lg">${face(handle)}</span><div class="grow"><h1 style="margin:0;font-size:22px">@${esc(handle)}</h1><div class="sm mut">${esc(u.persona ?? "Trader")} · ${p.followers} people copy them · on Tribe ${p.days} days</div></div><span class="pill ok only-d">${icon("shield", 11, "currentColor", 2)} Verified onchain</span></div>
<span class="pill ok only-m" style="align-self:flex-start">${icon("shield", 11, "currentColor", 2)} Verified onchain</span>
<section class="card"><div class="row sp"><span class="sm mut">Total return · from filled orders</span><span class="sm ${signCls(month.pct)}">30 days ${pct(month.pct)}</span></div><div class="big ${signCls(p.pnlPct)}" style="margin-top:4px">${pct(p.pnlPct, 1)}</div>${spark}
<div class="grid4 pgrid" style="margin-top:14px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">${stat("Win rate", p.winRate === null ? "—" : p.winRate + "%")}${stat("Max drawdown", p.maxDd ? "−" + p.maxDd.toFixed(1) + "pp" : "—")}${stat("Guard pauses", `${p.guardPauses} in ${p.days} days`)}${stat("Trades", String(p.trades))}</div></section>
${recent.length ? `<section class="card only-d" style="padding:6px 8px"><h2 style="font-size:16px;padding:12px 12px 4px">Recent trades</h2><table class="tbl"><thead><tr><th>Token</th><th>Flash order</th><th>Chain</th><th>When</th><th class="r">Since entry</th></tr></thead><tbody>${recent.map((c) => `<tr><td><b>${esc(c.symbol)}</b> <span class="mut sm">${c.trade.side === "buy" ? "long" : "sold"}</span></td><td>${esc(c.orderLabel.replace("Flash ", ""))}</td><td class="mut">Base</td><td class="mut">${ago(c.at)} ago</td><td class="r ${c.sincePct === null ? "mut" : signCls(c.sincePct)}"><b>${c.sincePct === null ? "—" : pct(c.sincePct)}</b></td></tr>`).join("")}</tbody></table></section>` : ""}
<div class="only-m"><div class="col"><h2 style="margin-top:8px">Copy this trader on Tribe</h2>${pitch}${join}</div></div>
<p class="note">Past results don't predict future ones. Not financial advice.</p></main>`;
  const aside = `<section class="card col" style="gap:14px"><h2>Copy @${esc(handle)} on Tribe</h2>${pitch}${join}<a class="sm" href="/signin" style="text-align:center;color:#A3A3A3">I have an account · Sign in</a></section>
<section class="flat col" style="gap:10px"><h2 style="font-size:16px">Share this trader</h2><div class="grid3"><a class="btn sm" style="width:100%" href="https://x.com/intent/post?text=${shareText}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Post on X</a><a class="btn sm" style="width:100%" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${shareText}" target="_blank" rel="noopener">Telegram</a><button class="btn sm" style="width:100%" data-copy="${esc(url)}">Copy link</button></div></section>`;
  const body = `<style>.app.pub{max-width:1180px}</style><header class="hd" style="gap:24px"><a href="/" style="font-size:22px;font-weight:700;letter-spacing:-.04em;color:#F5F5F5">tribe<span style="color:#34D399">.</span></a><nav class="only-d" aria-label="Site"><span class="row" style="gap:22px;font-size:14px"><a href="/#how" style="color:#C4C4C4">How it works</a><a href="/#guard" style="color:#C4C4C4">Guard</a><a href="/#creators" style="color:#C4C4C4">Creators</a></span></nav><span class="grow"></span><a class="mut md" href="/signin">Sign in</a><a class="btn sm w only-d" href="/onboarding">Get started</a></header>
<div class="sm mut" style="padding:0 20px 12px">Shared from X · ${esc(url.replace(/^https?:\/\//, ""))}</div>${split(main, aside, `Copy @${handle}`)}`;
  return page({ title: `@${handle} on Tribe`, body, head: ogHead(handle, p.pnlPct, tradeId), focus: true, split: true, extraClass: "pub" });
}

export function ogHead(handle: string, pnlPct: number, tradeId?: number): string {
  const img = `${BASE_URL()}/og/${tradeId ? "t/" + tradeId : "u/" + encodeURIComponent(handle)}.png`;
  return `<meta property="og:title" content="@${esc(handle)} ${esc(pct(pnlPct, 1))} on Tribe"><meta property="og:description" content="Copy this trader. Guarded onchain."><meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image">`;
}

export async function sharePage(viewer: number, who: string, tradeId?: number): Promise<string> {
  const handle = who === "me" ? getUser(viewer).handle : who;
  const u = userByHandle(handle);
  if (!u) return notFound("Trader not found");
  const p = await profile(u.id);
  const url = tradeId ? `${BASE_URL()}/t/${tradeId}` : `${BASE_URL()}/u/${handle}`;
  const tweet = `I'm ${pct(p.pnlPct, 1)} on Tribe. Copy my trades, protected by Chainlink CRE. Built on @DefinitiveFi Flash ${url}`;
  const img = `/og/${tradeId ? "t/" + tradeId : "u/" + encodeURIComponent(handle)}.png`;
  const curve = polyline(p.curve, 400, 150);
  const body = `${header("Share", "Post your PnL card to X or TikTok", tradeId ? "/feed" : "/me")}<main class="main" style="gap:14px">
<section class="card" style="padding:20px;background:linear-gradient(180deg,#262626,#111)" aria-label="Share card"><div class="row sp"><span style="font-size:20px;font-weight:700;letter-spacing:-.04em">tribe<span style="color:#34D399">.</span></span><span class="pill ok">${icon("shield", 11, "currentColor", 2)} Verified onchain</span></div>
<div class="row" style="gap:10px;margin-top:16px"><span class="av w">${face(handle)}</span><div><b>@${esc(handle)}</b><div class="xs mut">Total return</div></div></div>
<div class="big ${signCls(p.pnlPct)}" style="font-size:56px;margin-top:6px">${pct(p.pnlPct, 1)}</div><div class="sm mut">↑ ${p.trades} trades · ${p.followers} copiers</div>
<svg viewBox="0 0 400 150" width="100%" height="110" preserveAspectRatio="none" style="margin-top:8px" aria-label="Equity curve"><path d="${curve}" fill="none" stroke="#34D399" stroke-width="2.5"/></svg>
<div class="grid3" style="margin-top:8px">${stat("Win rate", p.winRate === null ? "—" : p.winRate + "%")}${stat("Max drawdown", p.maxDd ? "−" + p.maxDd.toFixed(1) + "pp" : "—")}${stat("Guard halts", String(p.guardPauses))}</div>
<div class="row sp sm" style="margin-top:12px"><span class="mut">${esc(url.replace(/^https?:\/\//, ""))}</span><span class="pill ok">+ Copy</span></div></section>
<a class="btn p big" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(tweet)}">${icon("share", 16, "currentColor", 2)}Share on X</a>
<div class="grid2"><button class="btn" id="story" data-img="${img}?f=story" data-text="${esc(tweet)}">TikTok / Reels</button><a class="btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(tweet.replace(url, "").trim())}">${icon("tg", 16, "currentColor", 2)}Telegram</a></div>
<div class="grid2"><button class="btn" data-copy="${esc(url)}">${icon("copy", 16, "currentColor", 2)}Copy link</button><a class="btn" href="${img}" download="tribe-${esc(handle)}.png">Image for X (PNG)</a></div>
<p class="note">Tag @DefinitiveFi. The link lands on ${esc(handle)}'s portfolio with a copy button. TikTok / Reels sends a 9:16 card to your phone's share sheet, or downloads it on desktop.</p></main>
<script>document.getElementById('story').onclick=async function(){var b=this,u=b.dataset.img,t=b.dataset.text;try{var blob=await (await fetch(u)).blob();var f=new File([blob],'tribe-story.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],text:t});return}var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tribe-story.png';a.click();navigator.clipboard&&navigator.clipboard.writeText(t);tribe.toast('Story card downloaded, caption copied')}catch(e){if(e&&e.name!=='AbortError')tribe.toast('Could not share the card')}}</script>`;
  return page({ title: "Share", body, head: ogHead(handle, p.pnlPct, tradeId) });
}

/** 9:16 card (1080x1920) for TikTok, Instagram and YouTube Shorts. Same data as the X card. */
export async function storySvg(handle: string, tradeId?: number): Promise<string | undefined> {
  const u = userByHandle(handle);
  if (!u) return undefined;
  const p = await profile(u.id);
  const t = tradeId ? tradeById(tradeId) : undefined;
  const tr = t?.trade as Trade | undefined;
  const col = p.pnlPct >= 0 ? "#2ee59d" : "#ff5c7a";
  const curve = polyline(p.curve.slice(-40), 960, 360);
  const big = tr ? `${tr.side === "buy" ? "Long" : "Sold"} ${symOf(tr.target)}` : esc(pct(p.pnlPct, 1));
  const legs = tr?.attach ? `Stop $${tr.attach.sl} · Target $${tr.attach.tp}` : tr ? esc(ORDER_LABEL[tr.orderType] ?? tr.orderType) : `${p.trades} trades · ${p.followers} copiers`;
  const row = (y: number, k: string, v: string) => `<text x="60" y="${y}" fill="#8A8A8A" font-size="40" font-family="sans-serif">${k}</text><text x="1020" y="${y}" text-anchor="end" fill="#F5F5F5" font-size="44" font-family="sans-serif" font-weight="600">${v}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2a20"/><stop offset="0.35" stop-color="#0d0d0d"/><stop offset="1" stop-color="#050505"/></linearGradient><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34D399" stop-opacity=".35"/><stop offset="1" stop-color="#34D399" stop-opacity="0"/></linearGradient></defs>
<rect width="1080" height="1920" fill="url(#bg)"/>
<text x="60" y="160" fill="#F5F5F5" font-size="72" font-family="sans-serif" font-weight="700">tribe<tspan fill="#34D399">.</tspan></text>
<text x="60" y="360" fill="#F5F5F5" font-size="84" font-family="sans-serif" font-weight="600">@${esc(handle)}</text>
<text x="60" y="430" fill="#A3A3A3" font-size="40" font-family="sans-serif">${esc(u.persona ?? "Trader")} on Tribe</text>
<text x="60" y="640" fill="${tr ? "#F5F5F5" : col}" font-size="${tr ? 150 : 190}" font-family="sans-serif" font-weight="700">${big}</text>
<text x="60" y="720" fill="#C4C4C4" font-size="44" font-family="sans-serif">${legs}</text>
<g transform="translate(60,800)"><path d="${curve} L960 360 L0 360 Z" fill="url(#fill)"/><path d="${curve}" fill="none" stroke="#34D399" stroke-width="7" stroke-linejoin="round"/></g>
${row(1300, "Total return", `<tspan fill="${col}">${esc(pct(p.pnlPct, 1))}</tspan>`)}${row(1390, "Win rate", p.winRate === null ? "—" : p.winRate + "%")}${row(1480, "Max drawdown", p.maxDd ? "−" + p.maxDd.toFixed(1) + "pp" : "—")}${row(1570, "Guard pauses", String(p.guardPauses))}
<rect x="60" y="1660" width="960" height="130" rx="65" fill="#34D399"/><text x="540" y="1742" text-anchor="middle" fill="#052E1C" font-size="48" font-family="sans-serif" font-weight="700">Copy me on Tribe</text>
<text x="540" y="1860" text-anchor="middle" fill="#8A8A8A" font-size="32" font-family="sans-serif">Guarded onchain by Chainlink CRE · trades on Flash</text></svg>`;
}

export async function ogSvg(handle: string, tradeId?: number): Promise<string | undefined> {
  const u = userByHandle(handle);
  if (!u) return undefined;
  const p = await profile(u.id);
  const t = tradeId ? tradeById(tradeId) : undefined;
  const col = p.pnlPct >= 0 ? "#2ee59d" : "#ff5c7a";
  const curve = polyline(p.curve.slice(-40), 1080, 150);
  const sub = t ? esc(`${(t.trade as Trade).orderType} ${(t.trade as Trade).side} ${symOf((t.trade as Trade).target)}`) : `${p.trades} trades · ${p.followers} copiers`;
  const chip = (x: number, label: string, value: string, c = "#F5F5F5") =>
    `<g transform="translate(${x},250)"><rect width="250" height="96" rx="20" fill="#151515" stroke="#2a2a2a"/><text x="22" y="36" fill="#8A8A8A" font-size="22" font-family="sans-serif">${label}</text><text x="22" y="76" fill="${c}" font-size="34" font-family="sans-serif" font-weight="600">${value}</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1b1b"/><stop offset="0.35" stop-color="#0A0A0A"/></linearGradient><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34D399" stop-opacity=".28"/><stop offset="1" stop-color="#34D399" stop-opacity="0"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<text x="60" y="95" fill="#F5F5F5" font-size="46" font-family="sans-serif" font-weight="700">tribe<tspan fill="#34D399">.</tspan></text>
<rect x="900" y="56" width="240" height="46" rx="14" fill="rgba(52,211,153,.1)" stroke="#34D399" stroke-opacity=".5"/><text x="1020" y="87" text-anchor="middle" fill="#34D399" font-size="22" font-family="sans-serif">Verified onchain</text>
<text x="60" y="190" fill="#F5F5F5" font-size="54" font-family="sans-serif" font-weight="600">@${esc(handle)}</text>
<text x="60" y="320" fill="${col}" font-size="120" font-family="sans-serif" font-weight="700">${esc(pct(p.pnlPct, 1))}</text>
<text x="60" y="372" fill="#A3A3A3" font-size="30" font-family="sans-serif">${sub}</text>
${chip(640, "Win rate", p.winRate === null ? "—" : p.winRate + "%")}${chip(910, "Max drawdown", p.maxDd ? "−" + p.maxDd.toFixed(1) + "pp" : "—")}
<g transform="translate(60,410)"><path d="${curve} L1080 150 L0 150 Z" fill="url(#fill)"/><path d="${curve}" fill="none" stroke="#34D399" stroke-width="4" stroke-linejoin="round"/></g>
<text x="60" y="610" fill="#8A8A8A" font-size="26" font-family="sans-serif">Copy this trader on Tribe · guarded onchain by Chainlink CRE · powered by Flash</text></svg>`;
}
