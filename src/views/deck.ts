import { allHalts, followingOf, getMeta, getUser, isWatching, pendingFor, swipedTrades, userByHandle } from "../db.js";
import { activeTrades, ago, face, initials, money, pct, portfolio, socialGraph, tradeCard, type ActiveTrade, type Social, type TradeCard } from "../data.js";
import { ranksHtml } from "./social.js";
import { basketOfOrder, copiesOf, liveBaskets, openCopies, openCopy, type BasketView } from "../baskets.js";
import { basketCardHtml, basketLive } from "./baskets.js";
import { researchTrade, traderBrief, type Brief } from "../research.js";
import { esc, header, icon, page, sheet, signCls, split } from "../ui.js";
import { ladder, orderStrip } from "./feed.js";
import { copyFee } from "../creator.js";

/**
 * The feed: one basket at a time. Swipe right to copy it (a confirm sheet shows size and worst case first), left to skip,
 * and follow the creator from the button underneath. Copy requests from a bot you copy come first. The
 * card's numbers refresh while you look at it, and new baskets slide in as they're published.
 */

const verbOf = (c: TradeCard) => (c.trade.orderType === "twap" ? "Accumulating" : c.trade.attach ? "Long with a bracket" : c.trade.orderType === "stop" ? "Breakout buy" : "Long");
const sinceHtml = (s: number | null) => (s === null ? "" : `<div class="${Math.abs(s) < 0.05 ? "mut" : signCls(s)}" style="font-size:26px;font-weight:600">${Math.abs(s) < 0.05 ? "flat" : pct(s)}</div><div class="xs mut">since their entry</div>`);

/** The "why you're seeing this" line: who in your network follows or copies them, or that they're trending. */
export const socialLine = (s: Social) =>
  `<div class="soc ${s.kind}">${s.faces.length ? `<span class="socfaces">${s.faces.map((h) => `<span class="av stack">${face(h)}</span>`).join("")}</span>` : `<span class="socic">${icon(s.kind === "trending" ? "flame" : s.kind === "suggested" ? "star" : s.kind === "copying" ? "copy" : "people", 13, "currentColor", 2)}</span>`}<span>${esc(s.text)}</span></div>`;

async function cardHtml(c: TradeCard, viewer: number, req?: { id: number; expires: number; usd: number }, soc?: Social): Promise<string> {
  const v = (await researchTrade(viewer, c.id, "Is this a good trade?"))?.verdict;
  const tone = v ? { ok: "#34D399", warn: "#FCD34D", bad: "#F87171" }[v.tone] : "#A3A3A3";
  const checks = v ? [...v.checks.filter((x) => x.ok === false), ...v.checks.filter((x) => x.ok === true)].slice(0, 3) : [];
  const entry = c.entry ?? c.mark;
  const slPct = c.stopPrice !== null && entry ? (1 - c.stopPrice / entry) * 100 : null;
  const tpPct = c.targetPrice !== null && entry ? (c.targetPrice / entry - 1) * 100 : null;
  const meta = getMeta(viewer);
  const max = meta.defaults.max;
  const usd = req ? req.usd : Math.min(Number(c.trade.qty) || max, max);
  const needStop = meta.defaults.stop && !(c.trade.hasStop || c.trade.attach);
  const fee = copyFee(c.leader, 1);
  const following = c.viewerCopying || isWatching(viewer, c.leader);
  return `<article class="swcard${req ? " req" : ""}" data-trade="${c.id}" data-handle="${esc(c.handle)}" data-symbol="${esc(c.symbol)}" data-usd="${usd}" data-max="${max}" data-needstop="${needStop ? 1 : ""}" data-fee="${fee.bps}" data-share="${fee.sharePct}" data-sl="${slPct?.toFixed(2) ?? ""}" data-tp="${tpPct?.toFixed(2) ?? ""}" data-following="${following ? 1 : ""}" data-copying="${c.viewerCopying ? 1 : ""}" data-verdict="${esc(v?.label ?? "")}" data-tone="${v?.tone ?? ""}" data-ini="${initials(c.handle)}"${req ? ` data-pending="${req.id}"` : ``} aria-label="@${esc(c.handle)} ${esc(verbOf(c))} ${esc(c.symbol)}">
<span class="stamp copy" aria-hidden="true">${req ? "APPROVE" : "COPY"}</span><span class="stamp skip" aria-hidden="true">SKIP</span>
${req ? `<div class="reqband" role="status">${icon("inbox", 14, "currentColor", 2)}Copy request from a trader you copy · <b data-expire="${req.expires}"></b> left</div>`
    : `<div class="freshband" role="status"><span class="live" aria-hidden="true"></span>Live trade · placed ${ago(c.at)} ago</div>`}
${soc ? socialLine(soc) : ""}
<div class="row"><a href="/u/${esc(c.handle)}" class="lvl"><span class="av w">${face(c.handle)}</span><b>${c.level}</b></a><div class="grow" style="min-width:0"><a href="/u/${esc(c.handle)}" style="color:#F5F5F5;font-weight:600">@${esc(c.handle)}</a><div class="sm mut">${c.persona ? esc(c.persona) + " · " : ""}${c.streak >= 2 ? `${c.streak}-day streak` : "Base"}</div></div><span class="pill ok">${icon("shield", 11, "currentColor", 2)}Guard passed</span></div>
<div class="row sp" style="align-items:flex-end"><div><div class="mut" style="font-size:14px">${esc(verbOf(c))}</div><div style="font-size:34px;font-weight:700;letter-spacing:-.02em">${esc(c.symbol)}</div></div>
<div style="text-align:right" data-live="since">${sinceHtml(c.sincePct)}</div></div>
${orderStrip(c)}
${c.note ? `<p class="md" style="margin:0;line-height:1.45;color:${c.source === "user" ? "#D4D4D4" : "#D1FAE5"}">${c.source !== "user" ? `${icon("bot", 13, "currentColor", 2)} ` : ""}“${esc(c.note)}”</p>` : ""}
${ladder(c)}
${needStop ? `<div class="sm warn row" style="gap:6px">${icon("shield", 13, "currentColor", 2)}No stop-loss: your rules won't copy this one</div>` : ""}
<div class="grid3"><div class="tile"><div class="k">You'd copy</div><div class="v">${money(usd)}</div></div><div class="tile"><div class="k">Worst case</div><div class="v ${slPct !== null ? "down" : "warn"}">${slPct !== null ? `−${money((usd * slPct) / 100)}` : "No stop"}</div></div><div class="tile"><div class="k">Copied by</div><div class="v" data-live="copiers">${c.copiers} ${c.copiers === 1 ? "person" : "people"}</div></div></div>
${await phoneRecord(c)}
${v ? `<section class="swread" style="border-color:${tone}55"><div class="row sp"><span class="row" style="gap:8px">${icon("shield", 15, "#A3A3A3", 2)}<b class="sm">Safety read</b></span><span class="pill" style="color:${tone};border:1px solid ${tone}66;background:${tone}14">${esc(v.label)}</span></div><ul class="vchecks" style="margin-top:8px">${checks.map((x) => `<li class="${x.ok ? "ok" : "bad"}"><i aria-hidden="true">${x.ok ? icon("check", 11, "currentColor", 3.2) : "!"}</i>${esc(x.t)}</li>`).join("")}</ul></section>` : ""}
</article>`;
}

/**
 * Testing: the deck never runs dry. Baskets you skipped come back round (anything you already copy stays out, since a
 * basket can't be copied twice). On by default in the demo; DECK_LOOP=false turns it off, DECK_LOOP=true turns it on anywhere.
 */
export const deckLoops = () => process.env.DECK_LOOP === "true" || (process.env.DEMO === "true" && process.env.DECK_LOOP !== "false");

/**
 * The cards on offer: your pending copy requests first, then baskets you haven't swiped or copied, each with why it's
 * here. For you ranks by your network (creators you copy or follow, then ones people you follow follow or copy, then
 * trending); Following keeps only creators you copy or follow; Trending keeps the most copied. `have` and `haveBaskets`
 * skip cards the page already shows.
 */
export async function deckCards(viewer: number, have = new Set<number>(), haveBaskets = new Set<number>()): Promise<{ html: string; count: number }> {
  const why = socialGraph(viewer);
  // A skipped basket is stored as a swipe on its negative id, next to the swipes on old trades.
  const swiped = deckLoops() ? new Set<number>() : swipedTrades(viewer);
  const pend = pendingFor(viewer).filter((p) => !have.has(p.trade_id));
  const reqCards = (await Promise.all(pend.map(async (p) => {
    const c = await tradeCard(p.trade_id, viewer);
    return c ? cardHtml(c, viewer, { id: p.id, expires: p.expires_at, usd: Number(p.trade.qty) || 0 }, why(c.leader, c.copiers)) : "";
  }))).join("");
  const halted = new Set(allHalts().map((h) => h.leader));
  await copiesOf(viewer); // closes copies whose stops sold everything, so those trades can be offered again
  const baskets = (await liveBaskets())
    .filter((v) => v.owner !== viewer && !halted.has(v.owner) && !swiped.has(-v.id) && !haveBaskets.has(v.id) && !openCopy(viewer, v.id))
    .map((v) => ({ v, s: why(v.owner, v.copiers) }));
  // Baskets your rules would refuse (no stop while you require one) go to the back; otherwise closest to you first
  // (Trending: most copied first), best return first among equals.
  const needStop = getMeta(viewer).defaults.stop;
  const refused = (stop: number) => Number(needStop && !(stop > 0));
  baskets.sort((a, b) => refused(a.v.stopPct) - refused(b.v.stopPct) || b.s.score - a.s.score || b.v.returnPct - a.v.returnPct);
  const top = baskets.slice(0, 12);
  return { html: reqCards + (await Promise.all(top.map(({ v, s }) => basketCardHtml(v, viewer, socialLine({ ...s, text: s.text.replace(/^You copy/, "You follow") }))))).join(""), count: pend.length + top.length };
}

/** What changes on a card while you look at it: its return since launch and how many people copied. */
export const deckLive = (ids: number[]) => basketLive(ids);

/**
 * The brief on the trader behind the top card (what matters most in their portfolio, what they hold, their P&L and last
 * three closed trades), and their record (win rate, closed, max drawdown, copiers) for the card under it.
 */
export async function briefHtml(handle: string): Promise<{ html: string; stats: string }> {
  const u = userByHandle(handle);
  const b = u ? await traderBrief(u.id) : undefined;
  if (!b) return { html: `<span class="sm mut">Couldn't find @${esc(handle)}.</span>`, stats: STATS_EMPTY };
  const col = { ok: "#34D399", warn: "#FCD34D", bad: "#F87171" };
  const curve = pnlCurve(b.curve, "bcg");
  const holding = b.held.length ? `<div class="bheld"><div class="xs mut">Holding now</div>${b.held.map((h) => `<div class="row sp"><span><b>${esc(h.symbol)}</b> <span class="xs mut">${money(h.value)}</span></span><span class="row" style="gap:10px"><span class="xs ${h.stopPct === null ? "warn" : "mut"}">${h.stopPct === null ? "no stop" : `stop −${h.stopPct.toFixed(1)}%`}</span><b class="${flatCls(h.pnlPct)}">${flatPct(h.pnlPct)}</b></span></div>`).join("")}</div>` : "";
  const html = `<div class="row bhead" style="gap:10px"><a href="/u/${esc(b.handle)}" class="av">${face(b.handle)}</a><a href="/u/${esc(b.handle)}" class="grow" style="color:#F5F5F5;min-width:0"><b>@${esc(b.handle)}</b><span class="xs mut" style="display:block">${b.scanned} fill${b.scanned === 1 ? "" : "s"} read · holding ${b.holding}</span></a><a class="sm" href="/u/${esc(b.handle)}?tab=Portfolio">Portfolio ›</a></div>
<ul class="brief">${b.picks.map((x) => `<li><i style="background:${col[x.tone]}" aria-hidden="true"></i><span>${esc(x.t)}</span></li>`).join("") || `<li><i style="background:#A3A3A3" aria-hidden="true"></i><span>Nothing stands out yet.</span></li>`}</ul>
${holding}${curve}
${lastChips(b)}`;
  return { html, stats: statsHtml(b) };
}

const flatCls = (n: number) => (Math.abs(n) < 0.05 ? "mut" : signCls(n));
const flatPct = (n: number) => (Math.abs(n) < 0.05 ? "flat" : pct(n));
/** A trader's P&L % over time as a sparkline (at most 60 points), green if they're up overall. `gid` keeps each chart's gradient its own. */
function pnlCurve(curve: number[], gid: string): string {
  const pts = curve.length > 60 ? curve.filter((_, i) => i % Math.ceil(curve.length / 60) === 0 || i === curve.length - 1) : curve;
  if (pts.length < 2) return "";
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
  const xy = pts.map((v, i) => `${((i / (pts.length - 1)) * 300).toFixed(1)},${(4 + (1 - (v - lo) / span) * 52).toFixed(1)}`);
  const last = pts[pts.length - 1], c = last >= 0 ? "#34D399" : "#F87171", zero = (4 + (1 - (0 - lo) / span) * 52).toFixed(1);
  return `<div class="bcurve"><div class="row sp xs mut"><span>P&amp;L over time</span><b class="${flatCls(last)}">${flatPct(last)}</b></div><svg viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label="P&amp;L over time, now ${flatPct(last)}"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><line x1="0" x2="300" y1="${zero}" y2="${zero}" stroke="#333" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><polygon points="0,60 ${xy.join(" ")} 300,60" fill="url(#${gid})"/><polyline points="${xy.join(" ")}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div>`;
}
/** Their last three closed trades as chips. */
const lastChips = (b: Brief) =>
  `<div class="blast"><span class="xs mut">Last ${b.last.length || ""}</span>${b.last.length ? b.last.map((t) => `<span class="btrade" title="${esc(t.symbol)} · ${ago(t.at)} ago"><b class="${flatCls(t.pct)}">${flatPct(t.pct)}</b></span>`).join("") : `<span class="xs mut">no closed trades yet</span>`}</div>`;
/** Win rate, closed trades, max drawdown, copiers. */
const statsHtml = (b: Brief) => {
  const st = b.stats;
  return `<span><b>${st.winRate === null ? "—" : st.winRate + "%"}</b> win</span><span><b>${st.closed}</b> closed</span><span><b class="${st.maxDd >= 10 ? "warn" : ""}">${st.maxDd.toFixed(1)}%</b> max DD</span><span><b>${st.followers}</b> ${st.followers === 1 ? "copier" : "copiers"}</span>`;
};

// The brief per trader, kept for a few seconds so a deck of cards from the same few traders builds it once.
const briefMemo = new Map<number, { at: number; b: Promise<Brief | undefined> }>();
function briefOf(leader: number) {
  const hit = briefMemo.get(leader);
  if (hit && Date.now() - hit.at < 15_000) return hit.b;
  const b = traderBrief(leader);
  briefMemo.set(leader, { at: Date.now(), b });
  return b;
}

/**
 * Phones only (desktop has the side panel): the trader's record on the card itself, in the room above the safety read.
 * On shorter phones the chips go first, then the whole section, so the safety read always fits.
 */
async function phoneRecord(c: TradeCard): Promise<string> {
  const b = await briefOf(c.leader).catch(() => undefined);
  if (!b) return "";
  return `<section class="mrec only-m" aria-label="@${esc(c.handle)}'s record"><div class="row sp xs mut"><span>@${esc(c.handle)}'s record</span><span>${b.scanned} fill${b.scanned === 1 ? "" : "s"} · holding ${b.holding}</span></div>
<div class="bstats">${statsHtml(b)}</div>
<div class="mlast">${lastChips(b)}</div>
</section>`;
}
const STATS_EMPTY = `<span><b>—</b> win</span><span><b>—</b> closed</span><span><b>—</b> max DD</span><span><b>—</b> copiers</span>`;

/**
 * Your live trades as one slim card: one trade at a time, each entry on its own (not merged per token). It cycles by
 * itself, pauses while you hover, and the arrows, ←/→ or a swipe take you back and forth through all of them.
 */
export async function activeHtml(viewer: number): Promise<string> {
  const list = await activeTrades(viewer);
  const top = (nav: string) => `<div class="row" style="gap:6px"><h2 class="grow" style="font-size:14px">Active trades</h2>${nav}<a class="xs" href="/positions" style="margin-left:4px">All ›</a></div>`;
  if (!list.length) return `<div class="acar">${top("")}<span class="sm mut">Nothing live yet. Swipe right on a trade to copy it.</span></div>`;
  const usd0 = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  // Two lines per trade: what it is and how it's doing, then the money in, the price path and the stop.
  const slide = (t: ActiveTrade, i: number) => {
    const who = `${esc(t.label)} · ${t.from === "you" ? "yours" : `from @${esc(t.from)}`} · ${ago(t.at)}`;
    const stop = t.stopPrice !== null ? `Stop ${usd0(t.stopPrice)}` : `<span class="warn">No stop</span>`;
    const flat = t.kind === "held" && Math.abs(t.pnlPct!) < 0.05;
    const right = t.kind === "held"
      ? `<b class="${flat ? "mut" : signCls(t.pnlPct!)}">${flat ? "flat" : pct(t.pnlPct!)}</b><span class="xs ${flat ? "mut" : signCls(t.pnlUsd!)}">${!flat && t.pnlUsd! >= 0 ? "+" : ""}${money(t.pnlUsd!)}</span>`
      : `<b>${t.limit !== null ? usd0(t.limit) : "—"}</b><span class="xs mut">waiting</span>`;
    const line2 = t.kind === "held" ? `${money(t.usd)} in · ${usd0(t.entry!)} → ${usd0(t.mark!)}` : `${money(t.usd)} to fill${t.limit !== null ? ` at or under ${usd0(t.limit)}` : ""}`;
    return `<a class="aslide${i ? "" : " on"}" href="${t.tradeId < 0 ? `/b/${basketOfOrder(t.tradeId)}#yours` : `/t/${t.tradeId}`}" aria-label="${esc(t.symbol)} trade ${i + 1} of ${list.length}"><div class="row" style="gap:8px"><span class="av xs">${face(t.from === "you" ? getUser(viewer).handle : t.from)}</span><span class="grow" style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b class="sm">${esc(t.symbol)}</b> <span class="xs mut">${who}</span></span><span class="row" style="gap:6px;align-items:baseline">${right}</span></div><div class="row sp xs mut"><span>${line2}</span><span>${stop}</span></div></a>`;
  };
  const nav = list.length > 1 ? `<span class="xs mut" data-acar-pos>1 of ${list.length}</span><button type="button" class="acbtn" data-acar-go="-1" aria-label="Previous trade">${icon("chevl", 13, "currentColor", 2.4)}</button><button type="button" class="acbtn" data-acar-go="1" aria-label="Next trade">${icon("chev", 13, "currentColor", 2.4)}</button>` : "";
  return `<div class="acar" data-acar role="region" aria-roledescription="carousel" aria-label="Your active trades">${top(nav)}<div class="aslides">${list.map(slide).join("")}</div></div>`;
}

/** Desktop: everything that isn't the deck, in one panel beside it. Phones get the portfolio and active trades from the wallet button. */
async function deckAside(viewer: number): Promise<string> {
  const pf = await portfolio(viewer);
  const meta = getMeta(viewer);
  const quick = ([["Add funds", "/wallet", "plus"], ["Positions", "/positions", "trend"], ["Traders", "/traders", "people"], ["Requests", "/requests", "inbox"]] as const)
    .map(([l, h, i]) => `<a href="${h}" class="ic s" title="${l}" aria-label="${l}">${icon(i, 15)}</a>`).join("");
  // One row: the balance, then the quick actions as icons, so the brief and your active trades fit on a laptop screen.
  return `<section class="card row sp" style="gap:10px;padding:12px 14px"><a href="/wallet" style="color:#F5F5F5;min-width:0"><div class="xs mut">Copy portfolio · Flash</div><div style="font-size:22px;font-weight:700;letter-spacing:-.01em">${meta.hideBalance ? "••••" : money(pf.total)}</div><div class="xs ${signCls(pf.todayUsd)}" style="white-space:nowrap">${pf.todayUsd >= 0 ? "↑" : "↓"} ${money(Math.abs(pf.todayUsd))} today · copying ${followingOf(viewer).length + openCopies(viewer)}</div></a>
<nav class="row" style="gap:6px;flex:none" aria-label="Quick actions">${quick}</nav></section>
<section class="flat col bcard" style="gap:8px" aria-label="About this trader" aria-live="polite"><h2 class="row" style="font-size:14px;gap:8px">About this trader</h2><div id="brief" class="col" style="gap:8px"><span class="sm mut">Swipe a trade to see who's behind it.</span></div></section>
<section class="flat col bstatcard" aria-label="Their record"><div class="row sp"><h2 style="font-size:14px">Their record</h2><span class="xs mut" id="bstatwho"></span></div><div class="bstats" id="bstats">${STATS_EMPTY}</div></section>`;
}

/** Top: the leaderboard, for browsing everything the deck deals one card at a time. Reached from "All baskets" links. */
export async function feedTopPage(viewer: number, q: Record<string, unknown>): Promise<string> {
  const share = `<a class="ic" target="_blank" rel="noopener" aria-label="Share this week's top traders on X" href="https://x.com/intent/post?text=${encodeURIComponent("This week's top traders on Tribe. Copy them with your own limits, guarded onchain by Chainlink CRE. Built on @DefinitiveFi Flash")}&url=${encodeURIComponent(`${process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`}/top`)}">${icon("share", 17, "currentColor", 2)}</a><a class="ic" href="/season" aria-label="Last season">${icon("star", 18)}</a>`;
  const body = `${header("Top", "The best trades, traders and squads", "/feed", share)}
${await ranksHtml(viewer, q)}`;
  return page({ title: "Top · Tribe", nav: "feed", body });
}

export async function deckPage(viewer: number): Promise<string> {
  const { html } = await deckCards(viewer);
  const pend = pendingFor(viewer);
  const pf = await portfolio(viewer);
  const meta = getMeta(viewer);
  const waiting = `<div class="swempty"><span class="orb" aria-hidden="true" style="width:64px;height:64px"><i></i></span><h2>Nothing new right now</h2><p class="mut md" style="margin:0;max-width:300px">New ones slide in here on their own, one at a time.</p><div class="grid2" style="width:100%;max-width:320px"><a class="btn" href="/feed?tab=top">See Top</a><a class="btn p" href="/trades/new">Build one</a></div></div>`;
  // The heading sits in the deck column so the side panel starts at the top and fits the screen.
  const body = split(`<main class="main swmain"><header class="hd only-m" style="justify-content:space-between;padding:8px 0 0"><a class="row" href="/wallet" aria-label="Balance ${meta.hideBalance ? "hidden" : money(pf.free)}. Add USDC and automatic signing" style="gap:8px;min-height:40px;padding:0 6px 0 14px;border-radius:20px;background:#1A1A1A;border:1px solid rgba(255,255,255,.1);color:#F5F5F5"><b style="font-size:15px">${meta.hideBalance ? "••••" : money(pf.free)}</b><span aria-hidden="true" style="width:28px;height:28px;border-radius:14px;background:var(--ac);color:var(--ac-ink);display:flex;align-items:center;justify-content:center">${icon("plus", 15, "currentColor", 2.6)}</span></a><div class="row" style="gap:8px"><button class="ic only-m" data-open="mytribe" aria-label="Your portfolio and active trades">${icon("wallet", 18)}</button><a class="ic only-m" href="/requests" aria-label="Copy requests, ${pend.length} pending">${icon("inbox", 18)}${pend.length ? `<span class="badge">${pend.length}</span>` : ""}</a></div></header>
<div class="deck" id="deck" aria-live="polite">${html}${waiting}</div>
<div class="swbar" role="toolbar" aria-label="Decide on this trade"><button class="swbtn skip" data-sw="left" aria-label="Skip (left arrow)">${icon("close", 26, "currentColor", 2.6)}</button><button class="swbtn copy" data-sw="right" aria-label="Copy with Flash (right arrow)">${icon("bolt", 26, "currentColor", 2.2)}</button></div>
<p class="xs mut only-d" style="text-align:center;margin:0">← skip · → copy with Flash</p></main>`, await deckAside(viewer), "Trader brief and active trades");
  const myTribe = sheet("mytribe", `<div class="row sp"><h2>Your portfolio</h2><button class="ic s" data-close="mytribe" aria-label="Close">${icon("close", 14, "currentColor", 2.4)}</button></div>
<a class="card" href="/me" style="display:block;color:#F5F5F5;margin-top:12px"><div class="sm mut">Copy portfolio · Flash</div><div class="big" style="font-size:30px;margin-top:4px">${meta.hideBalance ? "••••" : money(pf.total)}</div><div class="${signCls(pf.todayUsd)}" style="font-size:13px">${pf.todayUsd >= 0 ? "↑" : "↓"} ${money(Math.abs(pf.todayUsd))} today · copying ${followingOf(viewer).length + openCopies(viewer)}</div></a>
<div class="grid4" style="margin-top:12px">${([["Add funds", "/wallet", "plus"], ["Positions", "/positions", "trend"], ["My traders", "/traders", "people"], ["Portfolio", "/portfolio", "list"]] as const).map(([l, h, i]) => `<a href="${h}" class="col" style="align-items:center;gap:6px;color:#F5F5F5;font-size:12px"><span class="ic" aria-hidden="true">${icon(i, 18)}</span>${l}</a>`).join("")}</div>
<div data-active style="margin-top:14px">${await activeHtml(viewer)}</div>`);
  const sheets = `${myTribe}<div class="backdrop" id="bd-swconfirm" data-close="swconfirm"></div>
<div class="sheet" id="swconfirm" role="dialog" aria-label="Copy this trade"><div class="grab"></div>
<h2 id="swc-t">Copy this trade</h2><p class="sm mut" style="margin:4px 0 12px" id="swc-s"></p>
<div class="chips" id="swc-amt" role="radiogroup" aria-label="Amount"></div>
<div class="row" style="gap:10px;margin-top:8px"><label class="chip camt"><span>$</span><input id="swc-custom" type="number" inputmode="decimal" min="1" step="any" placeholder="Custom" aria-label="Custom amount in dollars"></label><span class="xs down" id="swc-err" role="alert" hidden></span></div>
<div class="grid2" style="margin-top:12px"><div class="tile"><div class="k">If the stop hits</div><div class="v down" id="swc-loss"></div></div><div class="tile"><div class="k">If the target hits</div><div class="v up" id="swc-gain"></div></div></div>
<p class="xs mut" style="margin:10px 0 0" id="swc-n"></p><p class="xs mut" style="margin:6px 0 0" id="swc-fee"></p>
<div class="grid2" style="margin-top:14px"><button class="btn" data-close="swconfirm">Not now</button><button class="btn p" id="swc-go">${icon("bolt", 14)}Confirm &amp; sign</button></div></div>
<script>${DECK_JS}</script>`;
  return page({ title: "Feed", nav: "feed", body, sheets, split: true });
}

const DECK_JS = `(function(){
var deck=document.getElementById('deck'),cur=null,amt=0;
function cards(){return [].slice.call(deck.querySelectorAll('.swcard:not(.gone)'))}
function key(c){return c.dataset.basket?'b'+c.dataset.basket:c.dataset.trade}
// Coverflow positions: p0 in front, p1 peeking on the right, pn waiting behind it (CSS does the moving).
function restack(){cards().forEach(function(c,i){c.style.zIndex=50-i;c.classList.toggle('p0',i===0);c.classList.toggle('p1',i===1);c.classList.toggle('pn',i>1)})}
function top(){return deck.querySelector('.swcard:not(.gone)')}
function count(){deck.classList.toggle('done',!cards().length);brief();if(cards().length<3)more()}
// Desktop side panel: The brief on whoever is behind the top card, fetched once per trader per minute.
var briefs={},shown='';
// Their record (win rate, closed, max DD, copiers) sits in the card underneath and follows the same trader.
var stEmpty=(document.getElementById('bstats')||{}).innerHTML||'';
function put(h,j){document.getElementById('brief').innerHTML=j.html;var s=document.getElementById('bstats'),w=document.getElementById('bstatwho');if(s)s.innerHTML=j.stats;if(w)w.textContent=h?'@'+h:''}
function brief(){var box=document.getElementById('brief');if(!box||getComputedStyle(box.closest('.paside')).display==='none')return;var c=top(),h=c?c.dataset.handle:'';if(h===shown)return;shown=h;
 if(!h){put('',{html:'<span class="sm mut">Swipe a trade to see who\\u2019s behind it.</span>',stats:stEmpty});return}
 var hit=briefs[h];if(hit&&Date.now()-hit.at<60000){put(h,hit);return}
 box.classList.add('loading');if(!hit)box.innerHTML='<span class="sm mut">Reading @'+h+'\\u2019s portfolio\\u2026</span>';
 fetch('/api/deck/brief?h='+encodeURIComponent(h)).then(function(r){return r.json()}).then(function(j){briefs[h]={html:j.html,stats:j.stats,at:Date.now()};if(shown===h)put(h,j)}).catch(function(){}).then(function(){if(shown===h)box.classList.remove('loading')})}
// Your active trades, in the side panel and the phone sheet; refreshed after a copy and every 15s, keeping your place.
// One trade at a time: it moves on every 6s unless you're hovering over it or using its buttons; arrows, dots, keys and swipes move it by hand.
function boxes(){return [].slice.call(document.querySelectorAll('#active,[data-active]'))}
function acGo(box,i){var s=box.querySelectorAll('.aslide'),n=s.length;if(!n)return;i=((i%n)+n)%n;box._i=i;box._t=0;
 s.forEach(function(x,j){x.classList.toggle('on',j===i)});box.querySelectorAll('[data-acar-to]').forEach(function(d,j){d.classList.toggle('on',j===i)});
 var p=box.querySelector('[data-acar-pos]');if(p)p.textContent=(i+1)+' of '+n}
function active(){fetch('/api/deck/active').then(function(r){return r.json()}).then(function(j){boxes().forEach(function(b){var t=b._t;b.innerHTML=j.html;acGo(b,b._i||0);b._t=t||0})}).catch(function(){})}
document.addEventListener('click',function(e){var g=e.target.closest('[data-acar-go],[data-acar-to]');if(!g)return;e.preventDefault();var box=g.closest('#active,[data-active]');acGo(box,g.dataset.acarTo!=null?Number(g.dataset.acarTo):(box._i||0)+Number(g.dataset.acarGo))});
boxes().forEach(function(b){b.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')b._h=1});b.addEventListener('pointerleave',function(){b._h=0})});
setInterval(function(){if(document.hidden)return;boxes().forEach(function(box){if(box.querySelectorAll('.aslide').length<2||box._h||box.contains(document.activeElement))return;
 box._t=(box._t||0)+200;if(box._t>=6000)acGo(box,(box._i||0)+1)})},200);
var ax=null,swiped=0;
document.addEventListener('pointerdown',function(e){var s=e.target.closest('.aslides');ax=s?{x:e.clientX,s:s}:null});
document.addEventListener('pointerup',function(e){if(!ax)return;var dx=e.clientX-ax.x,box=ax.s.closest('#active,[data-active]');ax=null;if(box&&Math.abs(dx)>40){acGo(box,(box._i||0)+(dx<0?1:-1));swiped=Date.now()}});
document.addEventListener('click',function(e){if(Date.now()-swiped<400&&e.target.closest('.aslides'))e.preventDefault()},true);
setInterval(function(){if(!document.hidden)active()},15000);
function post(u,b){return fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json()})}
// The decided card flies off with a tilt while the next one slides in from the right; then it settles on the left,
// dimmed, with its stamp, as the trade you just decided on (replacing the one there before).
function fly(c,dir){seen.push(key(c));c.classList.add('gone');c.classList.remove('p0','p1','pn');c.style.zIndex=60;c.style.transition='transform .38s ease-in, opacity .38s';c.style.transform=dir==='left'?'translate(-140%,30px) rotate(-22deg)':dir==='right'?'translate(140%,30px) rotate(22deg)':dir==='fade'?'scale(.9)':'translate(0,-140%)';c.style.opacity='0';restack();
 setTimeout(function(){deck.querySelectorAll('.swcard.was').forEach(function(w){if(w!==c)w.remove()});
  if(dir!=='left'&&dir!=='right'){c.remove();count();return}
  c.querySelectorAll('.stamp').forEach(function(s){s.style.opacity=''});c.dataset.did=dir;c.style.transition='none';c.style.transform='';c.classList.add('was');c.style.zIndex='';void c.offsetWidth;c.style.transition='';c.style.opacity='';count()},380)}
function reset(c){c.style.transition='transform .25s cubic-bezier(.3,1.4,.5,1)';c.style.transform='';c.querySelectorAll('.stamp').forEach(function(s){s.style.opacity=0})}
function fmt(n){return '$'+n.toFixed(2)}
function decide(dir){var c=top();if(!c)return;
 if(c.dataset.pending){post('/api/pending',{id:Number(c.dataset.pending),action:dir==='right'?'approve':'skip',back:'/feed'}).then(function(j){tribe.toast(j.error||(dir==='right'?(j.toast||'Approved'):'Skipped'));if(dir==='right')active()});fly(c,dir);return}
 if(dir==='left'){post('/api/swipe',{basket:Number(c.dataset.basket),dir:'left'});fly(c,'left');return}
 cur=c;openConfirm(c)}
function openConfirm(c){var max=Number(c.dataset.max),usd=Math.min(Number(c.dataset.usd),max),opts=[];[5,10,25,50,100].forEach(function(v){if(v<max)opts.push(v)});opts.push(max);opts=opts.filter(function(v,i,a){return a.indexOf(v)===i}).slice(-4);
 amt=opts.indexOf(usd)>-1?usd:opts[opts.length-1];
 document.getElementById('swc-t').textContent='Copy '+c.dataset.symbol;
 document.getElementById('swc-s').textContent='Pick how much. '+(c.dataset.legs==='1'?'It buys one token':'It splits across '+c.dataset.legs+' tokens')+'. Your max per copy is '+fmt(max)+'.';
 var box=document.getElementById('swc-amt');box.innerHTML='';opts.forEach(function(v){var b=document.createElement('button');b.type='button';b.className='chip'+(v===amt?' on':'');b.setAttribute('role','radio');b.textContent=fmt(v);b.onclick=function(){amt=v;document.getElementById('swc-custom').value='';document.getElementById('swc-err').hidden=true;box.querySelectorAll('.chip').forEach(function(x){x.classList.toggle('on',x===b)});risk()};box.appendChild(b)});
 var cu=document.getElementById('swc-custom');cu.value='';cu.max=max;document.getElementById('swc-err').hidden=true;
 // A typed amount: $1 up to the max per trade (the server checks the same), to the cent.
 cu.oninput=function(){var v=Math.round(parseFloat(cu.value)*100)/100,e=document.getElementById('swc-err'),ok=v>=1&&v<=max;e.hidden=ok||!cu.value;e.textContent=v>max?'Your max per copy is '+fmt(max)+'.':'At least $1.';
  if(ok){amt=v;box.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on')});risk()}else document.getElementById('swc-go').disabled=true};
 risk();document.getElementById('swconfirm').classList.add('open');document.getElementById('bd-swconfirm').classList.add('open')}
function risk(){var fb=Number(cur.dataset.fee),fs=Number(cur.dataset.share),fe=document.getElementById('swc-fee');if(fe&&fb)fe.textContent='Fee about '+fmt(amt*fb/1e4)+' ('+(fb/100)+'%), and @'+cur.dataset.handle+' gets '+fs+'% of it ('+fmt(amt*fb/1e4*fs/100)+') for being copied.';var sl=parseFloat(cur.dataset.sl),tp=parseFloat(cur.dataset.tp),block=!!cur.dataset.needstop,go=document.getElementById('swc-go');go.disabled=block;
 document.getElementById('swc-n').textContent=block?'This trade has no stop-loss, and your rules only copy trades with one. Change that in Settings, or skip it.':(cur.dataset.legs==='1'?'One Flash order from your wallet':cur.dataset.legs+' Flash orders from your wallet, one per token')+(isNaN(sl)?', with no stop-loss.':(cur.dataset.legs==='1'?', with the stop':', each with the stop')+(isNaN(tp)?'':' and target')+' attached.')+' CopyGuard checks the creator again right before '+(cur.dataset.legs==='1'?'it\\u2019s':'they\\u2019re')+' placed.';document.getElementById('swc-loss').textContent=isNaN(sl)?'No stop':'\\u2212'+fmt(amt*sl/100);document.getElementById('swc-gain').textContent=isNaN(tp)?'No target':'+'+fmt(amt*tp/100)}
function closeConfirm(back){document.getElementById('swconfirm').classList.remove('open');document.getElementById('bd-swconfirm').classList.remove('open');if(back&&cur)reset(cur)}
document.addEventListener('click',function(e){if(e.target.closest('[data-close=swconfirm]'))closeConfirm(true)});
document.getElementById('swc-go').onclick=function(){var b=this,c=cur;b.disabled=true;post('/api/basket-copy',{basket:Number(c.dataset.basket),usd:amt}).then(function(j){b.disabled=false;if(j.error){tribe.toast(j.error);if(/retired|already copy/.test(j.error)){closeConfirm(false);fly(c,'fade')}return}closeConfirm(false);tribe.toast(j.toast);fly(c,'right');active();if(j.unlock)tribe.unlock(j.unlock)}).catch(function(){b.disabled=false;tribe.toast('Network error')})};
document.querySelectorAll('[data-sw]').forEach(function(b){b.onclick=function(){var c=top();if(!c)return;var d=b.dataset.sw;if(d!=='right'||c.dataset.pending){c.style.transform=d==='left'?'translateX(-30px) rotate(-6deg)':d==='right'?'translateX(30px) rotate(6deg)':'translateY(-30px)'}decide(d)}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&cur&&!cur.classList.contains('gone')){closeConfirm(true);return}
 var ac=e.target.closest&&e.target.closest('#active,[data-active]');if(ac){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();acGo(ac,(ac._i||0)+(e.key==='ArrowLeft'?-1:1))}return}
 if(document.querySelector('.sheet.open'))return;if(e.target.closest('input,textarea'))return;var m={ArrowLeft:'left',ArrowRight:'right'}[e.key];if(m){e.preventDefault();decide(m)}});
var sx,sy,dx=0,dy=0,drag=null;
deck.addEventListener('pointerdown',function(e){var c=top();if(!c||!c.contains(e.target)||e.target.closest('a,button'))return;drag=c;sx=e.clientX;sy=e.clientY;dx=dy=0;c.style.transition='none';c.setPointerCapture(e.pointerId)});
deck.addEventListener('pointermove',function(e){if(!drag)return;dx=e.clientX-sx;dy=e.clientY-sy;drag.style.transform='translate('+dx+'px,'+Math.min(dy,40)+'px) rotate('+(dx/18)+'deg)';
 var s=function(k,o){var el=drag.querySelector('.stamp.'+k);if(el)el.style.opacity=Math.max(0,Math.min(1,o))};s('copy',dx/110);s('skip',-dx/110)});
function end(){if(!drag)return;var c=drag;drag=null;if(dx>110)decide('right');else if(dx<-110)decide('left');else{reset(c);if(Math.abs(dx)<6&&Math.abs(dy)<6)location.href=c.dataset.basket?'/b/'+c.dataset.basket:'/t/'+c.dataset.trade}}
deck.addEventListener('pointerup',end);deck.addEventListener('pointercancel',end);
// Live numbers on the cards you can see, and new baskets as they're published.
function ids(){return cards().map(function(c){return c.dataset.basket}).filter(Boolean)}
setInterval(function(){if(document.hidden)return;var l=ids().slice(0,3);if(!l.length)return;fetch('/api/deck/live?ids='+l.join(',')).then(function(r){return r.json()}).then(function(j){Object.keys(j).forEach(function(id){var c=deck.querySelector('.swcard[data-basket="'+id+'"]');if(!c)return;var s=c.querySelector('[data-live=since]'),p=c.querySelector('[data-live=copiers]');if(s&&s.innerHTML!==j[id].since){s.innerHTML=j[id].since;s.classList.remove('flash');void s.offsetWidth;s.classList.add('flash')}if(p)p.textContent=j[id].copiers;['base','glitter','holo'].forEach(function(t){c.classList.toggle('fin-'+t,j[id].finish===t)});var n=c.querySelector('[data-live=next]');if(n&&n.innerHTML!==j[id].next)n.innerHTML=j[id].next})}).catch(function(){})},4000);
// Top the queue up as soon as it runs low (and every 5s for new baskets). Cards on screen, including the one on the left, aren't sent again.
// Baskets already swiped this round stay out too, so a looping deck goes all the way round before repeating.
var busy=0,seen=[];
function more(){if(busy||document.hidden||cards().length>=4)return;busy=1;var have=[].slice.call(deck.querySelectorAll('.swcard')).map(key).concat(seen);fetch('/api/deck/cards?have='+have.join(',')).then(function(r){return r.json()}).then(function(j){busy=0;if(!j.html){if(seen.length){seen=[];more()}return}var t=document.createElement('div');t.innerHTML=j.html;var empty=deck.querySelector('.swempty');[].slice.call(t.children).forEach(function(n){deck.insertBefore(n,empty)});restack();count()}).catch(function(){busy=0})}
setInterval(more,5000);
restack();count()})()`;
