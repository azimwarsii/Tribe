import { allHalts, db, followingOf, getMeta, getUser, guardEvents, haltOf, pendingFor, reactionCounts, squadOf, userById } from "../db.js";
import { badgeProgress, questsOf, streakOf, traderStats } from "../stats.js";
import { face, ago, ORDER_LABEL, feed, initials, money, pct, portfolio, topTraders, type FeedFilter, type TradeCard } from "../data.js";
import { creatorEarnings } from "./me.js";
import { levelUpPrompt, levelView, squadBoard } from "./game.js";
import { txUrl } from "../flash.js";
import { reactBar } from "./reactions.js";
import { researchTrade } from "../research.js";
import { esc, icon, money2, page, seg, sheet, signCls } from "../ui.js";


/** Where the price sits between the stop and the target, with the entry marked. */
export function ladder(c: TradeCard): string {
  if (c.trade.side !== "buy" || c.stopPrice === null || c.targetPrice === null || !c.mark || c.targetPrice <= c.stopPrice) return "";
  const at = (p: number) => Math.max(0, Math.min(100, ((p - c.stopPrice!) / (c.targetPrice! - c.stopPrice!)) * 100));
  const toTarget = (c.targetPrice / c.mark - 1) * 100;
  const up = c.entry !== null && c.mark >= c.entry;
  return `<div class="ladder" role="img" aria-label="Price ${c.mark.toFixed(2)}, stop ${c.stopPrice}, target ${c.targetPrice}">
<div class="ladder-track"><i style="left:0;width:${at(c.mark).toFixed(1)}%;background:linear-gradient(90deg,rgba(248,113,113,.55),${up ? "rgba(52,211,153,.75)" : "rgba(248,113,113,.75)"})"></i>${c.entry !== null ? `<b class="ladder-entry" style="left:${at(c.entry).toFixed(1)}%"></b>` : ""}<b class="ladder-now${up ? "" : " down"}" style="left:${at(c.mark).toFixed(1)}%"></b></div>
<div class="row sp xs" style="margin-top:6px"><span class="down">Stop $${c.stopPrice.toFixed(0)}</span><span class="mut">${toTarget > 0 ? `${toTarget.toFixed(1)}% to target` : "Target hit"}</span><span class="up">Target $${c.targetPrice.toFixed(0)}</span></div></div>`;
}

/** Up to three copier avatars stacked, then a count. */
/** How many people copied this trade. A count only: who copied is private. */
export function copiedBy(c: TradeCard): string {
  if (!c.copiers) return `<span class="grow sm mut cpy-t" style="text-align:right">Be the first to copy</span>`;
  return `<span class="grow row sm" style="justify-content:flex-end;gap:5px;color:#D4D4D4" title="Who copied stays private">${icon("copy", 13, "currentColor", 2)}<b>${c.copiers}</b><span class="mut">copied</span></span>`;
}

/** The Flash order the trader placed, in plain words, under a "Flash <type>" tag. Wraps to two lines at most. */
export const orderStrip = (c: TradeCard) =>
  `<div class="ordstrip"><span class="pill flash">${icon("bolt", 11)}${esc(c.orderLabel)}</span><span class="sm">${esc(c.detail)}</span></div>`;

/** A trade card. `onPage` is the trade's own page: its Copy button always copies this trade (the panel below it). */
export function tradeCardHtml(c: TradeCard, viewer: number | undefined, hot = false, onPage = false): string {
  const paused = c.guard === "paused";
  const closing = c.trade.side === "sell" && c.realisedPct !== null;
  const flat = closing && Math.abs(c.realisedPct!) < 0.05;
  const verb = c.trade.side === "buy" ? (c.trade.orderType === "twap" ? "Accumulating" : c.trade.attach ? "Long with a bracket on" : c.trade.orderType === "stop" ? "Breakout buy on" : "Opened a long on")
    : c.trade.orderType === "bracket" ? "Set a bracket on" : c.trade.orderType === "stop-loss" ? "Set a stop on" : c.trade.orderType === "take-profit" ? "Set a target on"
    : closing ? (flat ? "Closed flat on" : c.realisedPct! > 0 ? "Took profit on" : "Cut a loss on") : "Closing";
  const twap = c.trade.orderType === "twap";
  const copying = c.viewerCopying && !onPage;
  const own = viewer === c.leader;
  const big = closing ? (flat ? null : { v: c.realisedPct!, label: "realised" }) : c.sincePct !== null ? { v: c.sincePct, label: "since entry" } : null;
  return `<article class="card post${paused ? " bad" : ""}${hot ? " hot" : ""}${closing && !flat && c.realisedPct! > 0 ? " win" : ""}" id="t${c.id}" data-href="/t/${c.id}">
${hot ? `<span class="ribbon">${icon("flame", 12, "currentColor", 2.2)}Hot today</span>` : ""}
<div class="row"><a href="/u/${esc(c.handle)}" class="lvl" aria-label="@${esc(c.handle)}, level ${c.level}"><span class="av ${paused ? "" : "w"}" style="${paused ? "color:#F87171" : ""}">${face(c.handle)}</span><b>${c.level}</b></a>
<div class="grow" style="min-width:0"><div class="row" style="gap:6px"><a href="/u/${esc(c.handle)}" style="color:#F5F5F5;font-size:14px;font-weight:600">@${esc(c.handle)}</a>${c.streak >= 2 ? `<span class="streak" title="${c.streak} green days in a row">${icon("flame", 11, "currentColor", 2.2)}${c.streak}d</span>` : ""}</div><div class="sm mut">${ago(c.at)} · ${paused ? "no new copies" : c.tx ? `<a href="${txUrl(c.tx)}" target="_blank" rel="noopener">filled onchain ↗</a>` : "filled onchain"}</div></div>
<span class="pill ${paused ? "bad" : "ok"}">${icon("shield", 11, "currentColor", 2)}${paused ? "Paused by Guard" : "Guard passed"}</span></div>
${c.source !== "user" ? `<div class="col" style="gap:6px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.25)"><span class="pill ok">${icon("bot", 12, "currentColor", 2)}${c.source === "bot" ? (c.botName ? `<a href="/bots/${c.botId}" style="color:inherit">@${esc(c.handle)}'s bot · ${esc(c.botName)}</a>` : `@${esc(c.handle)}'s bot · runs on Chainlink CRE`) : `@${esc(c.handle)}'s AI agent · confirmed by them`}</span>${c.note ? `<span class="md" style="color:#D1FAE5;line-height:1.45">${esc(c.note)}</span>` : ""}</div>` : c.note ? `<div class="md" style="color:#D4D4D4;line-height:1.45">${esc(c.note)}</div>` : ""}
<div class="row sp" style="align-items:flex-end"><a href="/t/${c.id}" style="color:inherit"><div class="mut" style="font-size:13px">${verb}</div><div style="font-size:22px;font-weight:600;letter-spacing:-.01em">${esc(c.symbol)}</div></a>
${big ? `<div style="text-align:right"><div class="${signCls(big.v)}" style="font-size:${closing ? 26 : 22}px;font-weight:600">${pct(big.v)}</div><div class="xs mut">${big.label}</div></div>` : ""}</div>
${ladder(c)}
${orderStrip(c)}
${twap ? `<div><div class="row sp sm mut"><span>TWAP</span><span style="color:#F5F5F5">${c.trade.twapBucketCount ?? "?"} slices</span></div><div class="bar" style="margin-top:6px"><i style="width:100%"></i></div></div>` : ""}
${paused ? `<div class="grid3"><div class="tile"><div class="k">Risk score</div><div class="v down">${c.risk}</div></div><div class="tile"><div class="k">Copies</div><div class="v">${c.copiers}</div></div><div class="tile"><div class="k">Status</div><div class="v down">Paused</div></div></div>` : ""}
<div class="row">
${reactBar(c.id, viewer)}
${onPage ? `<button type="button" class="chip" data-open="comments" aria-label="${c.comments} comments">${icon("chat", 14, "currentColor", 2)}${c.comments}</button>` : `<a class="chip" href="/t/${c.id}#comments" aria-label="${c.comments} comments">${icon("chat", 14, "currentColor", 2)}${c.comments}</a>`}
${own && !c.copiers ? '<span class="grow"></span>' : copiedBy(c)}</div>
${onPage ? "" : `<div style="display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:8px">
${own ? `<a class="btn" href="/u/${esc(c.handle)}">Your trade</a>` : paused ? `<a class="btn" href="/guard">${icon("shield", 15, "currentColor", 1.9)}Why paused</a>` : copying ? `<a class="btn" href="/traders">Copying · manage</a>` : c.trade.side === "buy" ? `<a class="btn p" href="/u/${esc(c.handle)}#baskets">${icon("cards", 14, "currentColor", 2)}Their trades</a>` : `<button class="btn" data-act="/api/watch" data-body='{"leader":"${esc(c.handle)}"}'>Follow @${esc(c.handle)}</button>`}
<a class="btn" style="padding:0" href="/t/${c.id}#share" aria-label="Share">${icon("share", 16, "currentColor", 2)}</a></div>`}</article>`;
}

// ---------- Social and game layer ----------

/** Story rail: you, the traders you copy, then this week's top traders. Green ring = traded in the last 24h, red = paused by Guard. */
export function storyRail(viewer: number): string {
  const week = new Map(topTraders(7, 50).map((t) => [t.id, t.pct]));
  // New creators (a published bot or trades, under 5 followers) get a spot right after the people you copy.
  const rising = new Set((db.prepare("SELECT owner FROM bots WHERE status = 'live' UNION SELECT owner FROM strategies WHERE kind = 'trades' AND public = 1").all() as { owner: number }[]).map((r) => r.owner).filter((id) => (db.prepare("SELECT COUNT(*) AS n FROM follows WHERE leader = ?").get(id) as { n: number }).n < 5));
  const ids = [...new Set([...followingOf(viewer).map((f) => f.leader), ...[...rising].slice(0, 4), ...topTraders(7, 12).map((t) => t.id)])].filter((id) => id !== viewer).slice(0, 12);
  const recent = new Set((db.prepare("SELECT DISTINCT leader FROM trades WHERE at >= ?").all(Date.now() - 86400e3) as unknown as { leader: number }[]).map((r) => r.leader));
  const story = (id: number) => {
    const u = userById(id);
    if (!u) return "";
    const ring = haltOf(id) ? "bad" : recent.has(id) ? "live" : "";
    const p = week.get(id);
    return `<a class="story" href="/u/${esc(u.handle)}" aria-label="@${esc(u.handle)}${ring === "bad" ? ", paused by Guard" : ring === "live" ? ", traded today" : ""}"><span class="ring ${ring}"><span>${face(u.handle)}</span>${getMeta(id).bot.on ? `<i class="botbadge" title="Runs a bot">${icon("bot", 11, "currentColor", 2.2)}</i>` : ""}</span><span class="h">@${esc(u.handle)}</span>${rising.has(id) && !p ? `<span class="p up">New</span>` : p !== undefined && p !== 0 ? `<span class="p ${signCls(p)}">${pct(p)}</span>` : ""}</a>`;
  };
  const me = getUser(viewer);
  return `<nav class="stories" aria-label="Your tribe"><a class="story" href="/share/me" aria-label="Share your PnL"><span class="ring"><span style="background:#F5F5F5;color:#0A0A0A">${face(me.handle)}</span></span><span class="h">You</span><span class="p up">${icon("plus", 10, "currentColor", 3)}Share</span></a>${ids.map(story).join("")}</nav>`;
}

/** Your level, XP to go, streak and today's quests, with a one-tap claim when one is ready. */
export async function gameStrip(viewer: number): Promise<string> {
  const s = await traderStats(viewer);
  const lv = levelView(s.xp);
  const streak = streakOf(viewer).current;
  const daily = questsOf(viewer).filter((q) => q.period === "Daily");
  const done = daily.filter((q) => q.done >= q.of).length;
  const claim = questsOf(viewer).find((q) => q.done >= q.of && !q.claimed);
  return `<section class="game" aria-label="Your progress"><a href="/progress" class="lvdial" style="--p:${Math.max(3, Math.round(lv.pct))}" aria-label="Level ${lv.level}, ${Math.round(lv.pct)}% to the next"><span><small>LV</small><b>${lv.level}</b></span></a>
<a href="/progress" class="grow" style="color:#F5F5F5;min-width:0"><b class="md" style="display:block">${lv.toNext.toLocaleString("en-US")} XP to Level ${lv.level + 1}</b><span class="sm mut row" style="gap:10px;margin-top:3px;flex-wrap:wrap"><span class="row" style="gap:3px;color:${streak ? "#FCD34D" : "#A3A3A3"}">${icon("flame", 12, "currentColor", 2.2)}${streak ? `${streak}-day streak` : "No streak yet"}</span><span>Daily quests ${done}/${daily.length}</span></span></a>
${claim ? `<button class="btn sm p" data-act="/api/quest-claim" data-body='{"id":"${claim.id}"}'>Claim +${claim.xp}</button>` : `<a class="ic s" href="/progress" aria-label="Quests">${icon("chev", 14, "currentColor", 2)}</a>`}</section>`;
}
