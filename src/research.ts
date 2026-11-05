import { catReadsSince, creRuns, db, getFollowRules, getMeta, haltOf, userByHandle } from "./db.js";
import { ago, money, openPositions, pct, profile, RISK_LINE, sourceSplit, symOf, tradeCard, type SideRecord, type TradeCard } from "./data.js";

/** Ask Chief about one feed post: is it a good trade, the trader's record, what copying it would risk. Grounded in fills, Guard and the viewer's own copy rules; no LLM, so every number is checkable. */

export type Topic = "verdict" | "history" | "risk";
export interface Check { ok: boolean | null; t: string; key?: boolean } // ok null = not enough data to judge; key = failing it caps the verdict at Mixed
export interface Verdict { label: string; tone: "ok" | "warn" | "bad"; checks: Check[] }
export interface TradeCtx { id: number; handle: string; leader: number; verb: string; symbol: string; sincePct: number | null; own: boolean; copying: boolean; paused: boolean; bot: boolean; buy: boolean; token: string; mark: number | null }
export interface Research { reply: string; verdict?: Verdict; steps: { t: string; d: string }[]; sources: string[]; follow: { label: string; text?: string; href?: string; icon?: string }[]; ctx: TradeCtx }

export const topicOf = (text: string): Topic => {
  const t = text.toLowerCase();
  // Risk first: "worst case if I copy" stays a risk question even when it names the agent or asks "before".
  if (/\b(risk|worst|lose|loss|size|how much|if i copy|copy (it|this)|downside|safe)\b/.test(t)) return "risk";
  if (/\b(history|record|track|past|win ?rate|stats|how (has|have|did))\b/.test(t)) return "history";
  return "verdict";
};

/** "Is @nightowl worth copying?" asked anywhere (app, Telegram, MCP): research that trader's latest entry. Pause questions stay with the Guard answer. */
export function subjectTrade(text: string): number | undefined {
  const t = text.toLowerCase();
  if (!/\b(good|safe|should i|worth|copy|copying|track record|history|record|research|legit|trust|solid|risky)\b/.test(t) || /\b(paus|halt|why)/.test(t)) return undefined;
  const handle = /@([\w-]+)/.exec(text)?.[1];
  const leader = handle ? userByHandle(handle)?.id : undefined;
  return leader === undefined ? undefined : latestEntry(leader);
}

/**
 * Chief's track record: each call (the first read per entry) scored by what the trader did next. A call is "closed" once the
 * trader sells after it, and green if that sell made money. Price moves alone would score every call the same in a
 * one-token market, so outcomes are the honest measure.
 */
export function catCalls(days = 30) {
  const out = new Map<string, { calls: number; closed: number; green: number }>();
  for (const r of catReadsSince(Date.now() - days * 86400e3)) {
    const leader = (db.prepare("SELECT leader FROM trades WHERE id = ?").get(r.trade) as { leader: number } | undefined)?.leader;
    if (leader === undefined) continue;
    const exit = db.prepare("SELECT pnl FROM orders WHERE trader = ? AND role = 'own' AND status = 'filled' AND json_extract(trade,'$.side') = 'sell' AND filled_at > ? AND pnl IS NOT NULL ORDER BY filled_at LIMIT 1").get(leader, r.at) as { pnl: number } | undefined;
    const g = out.get(r.label) ?? { calls: 0, closed: 0, green: 0 };
    g.calls++;
    if (exit) { g.closed++; if (exit.pnl > 0) g.green++; }
    out.set(r.label, g);
  }
  return ["Looks solid", "Mixed", "Risky", "Avoid for now"].filter((l) => out.has(l)).map((label) => ({ label, ...out.get(label)! }));
}

/** "nightowl" or "@nightowl" to that trader's latest entry (for agents that name a trader, e.g. MCP). */
export const handleEntry = (h: string) => {
  const leader = userByHandle(h)?.id;
  return leader === undefined ? undefined : latestEntry(leader);
};

/** A trader's latest buy, or their latest trade if they have never bought. */
export const latestEntry = (leader: number) =>
  (db.prepare("SELECT id FROM trades WHERE leader = ? AND private = 0 ORDER BY json_extract(trade,'$.side') = 'buy' DESC, id DESC LIMIT 1").get(leader) as { id: number } | undefined)?.id;

/** Chief's read as plain text, for Telegram and MCP where there is no card. */
export const verdictText = (v: Verdict) => `Chief's read: ${v.label}\n${v.checks.map((c) => `${c.ok === true ? "✅" : c.ok === false ? "⚠️" : "▫️"} ${c.t}`).join("\n")}`;

const verbOf = (c: TradeCard) => c.trade.side === "buy" ? (c.trade.orderType === "twap" ? "Accumulating" : c.trade.attach ? "Bracket long" : "Long") : c.realisedPct !== null ? (c.realisedPct > 0 ? "Took profit" : "Closed") : "Protective order";

export function contextOf(c: TradeCard, viewer: number): TradeCtx {
  return { id: c.id, handle: c.handle, leader: c.leader, verb: verbOf(c), symbol: c.symbol, sincePct: c.sincePct, own: c.leader === viewer, copying: c.viewerCopying, paused: c.guard === "paused", bot: c.source !== "user", buy: c.trade.side === "buy", token: c.trade.target, mark: c.mark ?? c.entry };
}

/** What one copy of this entry would cost the viewer under their rules for this trader (or their defaults). */
function copySize(c: TradeCard, viewer: number) {
  const r = getFollowRules(viewer, c.leader);
  const d = getMeta(viewer).defaults;
  const leaderUsd = Number(c.trade.qty) || 0;
  const ratio = r?.ratio ?? 1, max = r?.maxUsdPerTrade ?? d.max;
  return { usd: Math.min(leaderUsd * ratio, max), leaderUsd, ratio, max, requireStop: r?.requireStop ?? d.stop, custom: !!r };
}

/** The latest CRE CopyGuard verdict on a trader and the latest Chainlink-vs-DEX price check, as the workflow reported them. */
export function creEvidence(leader: number) {
  const runs = creRuns(30);
  const run = runs.find((r) => r.verdicts.some((v) => v.leader === leader));
  const price = runs.find((r) => r.oracle && r.dex);
  return { run, v: run?.verdicts.find((x) => x.leader === leader), price };
}

function creChecks(c: TradeCard): Check[] {
  const { run, v, price } = creEvidence(c.leader);
  const out: Check[] = [v && run
    ? { ok: v.severity === "ok", key: true, t: `CRE CopyGuard ${ago(run.at)} ago: ${v.severity === "ok" ? "clear" : v.severity === "warn" ? `flagged, ${v.reason}` : `halted, ${v.reason}`}${v.ai ? " (AI reviewed, nodes agreed)" : ""}` }
    : { ok: null, t: "No CRE CopyGuard run has checked them yet" }];
  if (price && c.symbol === "ETH") {
    const dev = Math.abs(price.deviation ?? 0);
    out.push({ ok: dev < 1, t: `Chainlink ETH/USD $${price.oracle!.toFixed(0)} vs DEX $${price.dex!.toFixed(0)}: ${dev.toFixed(2)}% apart${dev < 1 ? "" : ", the prices disagree"}` });
  }
  return out;
}

function checksOf(c: TradeCard, p: Awaited<ReturnType<typeof profile>>, line: number): Check[] {
  const out: Check[] = [];
  const entry = c.entry ?? c.mark;
  if (c.trade.side === "buy") {
    if (c.stopPrice !== null && entry) out.push({ ok: true, t: `Has a stop at $${c.stopPrice.toFixed(0)}, ${((1 - c.stopPrice / entry) * 100).toFixed(1)}% under entry` });
    else out.push({ ok: c.hasStop ? true : false, key: true, t: c.hasStop ? "Trader ships protection with this entry" : "No stop: nothing limits the loss if it drops" });
    if (c.stopPrice !== null && c.targetPrice !== null && entry && entry > c.stopPrice) {
      const rr = Math.round(((c.targetPrice - entry) / (entry - c.stopPrice)) * 10) / 10; // judged as shown, so "1.5" never reads as thin
      out.push({ ok: rr >= 1.5, t: `Risks 1 to make ${rr.toFixed(1)}${rr >= 1.5 ? "" : ", a thin payoff for the risk"}` });
    }
    if (c.sincePct !== null) {
      const s = c.sincePct;
      out.push(s > 3 ? { ok: false, t: `Already ${pct(s)} since their entry, so you'd buy higher than they did` }
        : s < -3 ? { ok: false, t: `${pct(s)} since entry, moving toward the stop` }
        : { ok: true, t: `Still near their entry (${Math.abs(s) < 0.05 ? "flat" : pct(s)}), so you'd get a similar price` });
    }
  }
  out.push(p.closed >= 3 && p.winRate !== null ? { ok: p.winRate >= 55, t: `Won ${p.winRate}% of ${p.closed} closed trades` } : { ok: null, t: `Only ${p.closed} closed trade${p.closed === 1 ? "" : "s"}, too early to judge the record` });
  out.push({ ok: p.maxDd < 10, t: `Worst drawdown ${p.maxDd.toFixed(1)}%${p.maxDd < 10 ? "" : ", a bumpy ride"}` });
  out.push(c.guard === "paused" ? { ok: false, t: "Paused by Guard: new trades from them are not copied" } : { ok: c.risk < line, t: `Guard risk score ${c.risk} of 100 (pauses at ${line})` });
  out.push(...creChecks(c));
  if (c.source === "bot") out.push({ ok: true, t: `Placed by @${c.handle}'s bot, which only trades when the Chainlink ETH/USD feed and the DEX price agree` });
  if (c.source === "agent") out.push({ ok: null, t: `Proposed by @${c.handle}'s AI agent and confirmed by them` });
  return out;
}

function verdictOf(checks: Check[], paused: boolean): Verdict {
  const judged = checks.filter((x) => x.ok !== null);
  const score = judged.length ? judged.filter((x) => x.ok).length / judged.length : 0;
  const solid = score >= 0.8 && !checks.some((x) => x.key && x.ok === false);
  const label = paused ? "Avoid for now" : solid ? "Looks solid" : score >= 0.5 ? "Mixed" : "Risky";
  return { label, tone: paused || score < 0.5 ? "bad" : solid ? "ok" : "warn", checks };
}

export interface Brief {
  handle: string; leader: number; scanned: number; holding: number;
  picks: { tone: "ok" | "warn" | "bad"; t: string }[];
  last: { symbol: string; pct: number; at: number; source: TradeCard["source"] }[];
  stats: { winRate: number | null; closed: number; maxDd: number; followers: number };
  held: { symbol: string; pnlPct: number; value: number; stopPct: number | null }[];
  curve: number[]; // their total P&L % over time, oldest first
}

/**
 * Chief's brief on a trader, for the panel beside the deck: their last three closed trades, then the few facts from their
 * portfolio that matter most right now (a Guard pause, their worst recent hit, a position riding without a stop, a streak,
 * bot vs manual), ranked so the riskiest surface first. Built from fills like the rest of Chief's reads, so every line is checkable.
 */
export async function traderBrief(leader: number): Promise<Brief | undefined> {
  const p = await profile(leader).catch(() => undefined);
  if (!p) return undefined;
  const closed = (db.prepare("SELECT o.trade, o.pnl, o.usd, o.filled_at, t.source FROM orders o LEFT JOIN trades t ON t.id = o.trade_id WHERE o.trader = ? AND o.role = 'own' AND o.status = 'filled' AND json_extract(o.trade,'$.side') = 'sell' AND o.pnl IS NOT NULL ORDER BY o.filled_at DESC LIMIT 50").all(leader) as unknown as { trade: string; pnl: number; usd: number; filled_at: number; source: string | null }[])
    .map((r) => ({ symbol: symOf(JSON.parse(r.trade).target), pct: (r.pnl / Math.max(1e-9, r.usd - r.pnl)) * 100, at: r.filled_at, source: (r.source === "bot" || r.source === "cre" ? "bot" : r.source === "agent" ? "agent" : "user") as TradeCard["source"] }));
  const held = await openPositions(leader).catch(() => []);
  const picks: { w: number; tone: "ok" | "warn" | "bad"; t: string }[] = [];
  const halt = haltOf(leader);
  if (halt) picks.push({ w: 100, tone: "bad", t: `Paused by Guard: ${halt.reason}. Nothing from them gets copied right now.` });
  const cre = creEvidence(leader);
  if (cre.v && cre.run && cre.v.severity === "warn") picks.push({ w: 90, tone: "warn", t: `CRE CopyGuard flagged them ${ago(cre.run.at)} ago: ${cre.v.reason}` });
  const month = closed.filter((c) => c.at >= Date.now() - 30 * 86400e3);
  const worst = month.reduce<(typeof closed)[number] | undefined>((a, c) => (!a || c.pct < a.pct ? c : a), undefined);
  if (worst && worst.pct <= -3) picks.push({ w: 80, tone: "bad", t: `Biggest hit this month: ${pct(worst.pct)} on ${worst.symbol}, ${ago(worst.at)} ago` });
  for (const h of held.filter((x) => x.stopPct === null).slice(0, 1)) picks.push({ w: 75, tone: "warn", t: `Holding ${h.symbol} with no stop (${pct(h.pnlPct)} now), so that loss isn't capped` });
  if (p.closed < 3) picks.push({ w: 65, tone: "warn", t: `Only ${p.closed} closed trade${p.closed === 1 ? "" : "s"}: too early to trust the record` });
  let run = 0;
  for (const c of closed) { if (c.pct > 0 === closed[0].pct > 0) run++; else break; }
  if (closed.length && run >= 2 && closed[0].pct <= 0) picks.push({ w: 70, tone: "bad", t: `On a ${run}-trade losing run` });
  if (closed.length && run >= 3 && closed[0].pct > 0) picks.push({ w: 45, tone: "ok", t: `On a ${run}-trade winning run` });
  if (p.maxDd >= 10) picks.push({ w: 60, tone: "warn", t: `Worst drawdown ${p.maxDd.toFixed(1)}%: expect a bumpy ride` });
  const split = sourceSplit(leader);
  if (split.bot.closed >= 2 && split.manual.closed >= 2 && split.bot.pnlPct !== null && split.manual.pnlPct !== null && Math.abs(split.bot.pnlPct - split.manual.pnlPct) >= 3) {
    const botBetter = split.bot.pnlPct > split.manual.pnlPct;
    picks.push({ w: 50, tone: botBetter ? "ok" : "warn", t: `Their bot ${botBetter ? "beats" : "trails"} their manual trades (${pct(split.bot.pnlPct)} vs ${pct(split.manual.pnlPct)})` });
  }
  const best = month.reduce<(typeof closed)[number] | undefined>((a, c) => (!a || c.pct > a.pct ? c : a), undefined);
  if (best && best.pct >= 3) picks.push({ w: 35, tone: "ok", t: `Best this month: ${pct(best.pct)} on ${best.symbol}` });
  if (p.closed >= 3 && p.winRate !== null) picks.push({ w: 30, tone: p.winRate >= 55 ? "ok" : "warn", t: `Won ${p.winRate}% of ${p.closed} closed trades` });
  if (!halt && !held.some((x) => x.stopPct === null) && held.length) picks.push({ w: 25, tone: "ok", t: `Every open position has a stop` });
  const fills = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE trader = ? AND role = 'own' AND status = 'filled'").get(leader) as { n: number }).n;
  return {
    handle: p.user.handle, leader, scanned: fills, holding: held.length,
    picks: picks.sort((a, b) => b.w - a.w).slice(0, 5).map(({ tone, t }) => ({ tone, t })),
    last: closed.slice(0, 3),
    stats: { winRate: p.winRate, closed: p.closed, maxDd: p.maxDd, followers: p.followers },
    held: held.slice(0, 3).map((h) => ({ symbol: h.symbol, pnlPct: h.pnlPct, value: h.value, stopPct: h.stopPct })),
    curve: p.curve,
  };
}

export async function researchTrade(viewer: number, tradeId: number, text: string): Promise<Research | undefined> {
  const c = await tradeCard(tradeId, viewer);
  if (!c) return undefined;
  const p = await profile(c.leader);
  const topic = topicOf(text);
  const who = `@${c.handle}`;
  const ctx = contextOf(c, viewer);
  const line = RISK_LINE[getMeta(viewer).strict];
  const checks = checksOf(c, p, line);
  const verdict = verdictOf(checks, c.guard === "paused");
  const size = copySize(c, viewer);
  let reply: string;

  if (topic === "history") {
    const rows = db.prepare("SELECT pnl, usd, filled_at FROM orders WHERE trader = ? AND role = 'own' AND status = 'filled' AND json_extract(trade,'$.side') = 'sell' AND pnl IS NOT NULL ORDER BY filled_at DESC LIMIT 5").all(c.leader) as unknown as { pnl: number; usd: number; filled_at: number }[];
    const last = rows.map((r) => `${pct((r.pnl / Math.max(1e-9, r.usd - r.pnl)) * 100)} (${ago(r.filled_at)} ago)`);
    const halt = haltOf(c.leader);
    const split = sourceSplit(c.leader);
    const side = (r: SideRecord) => `${r.trades} entr${r.trades === 1 ? "y" : "ies"}${r.closed ? `, ${r.wins} of ${r.closed} closed green${r.pnlPct !== null ? ` (${pct(r.pnlPct)})` : ""}` : ", none closed"}`;
    reply = [
      `${who} has traded for ${p.days} day${p.days === 1 ? "" : "s"}: ${p.trades} trades, ${p.closed} closed${p.winRate !== null ? `, ${p.winRate}% winners` : ""}. Overall ${pct(p.pnlPct)}, worst drawdown ${p.maxDd.toFixed(1)}%.`,
      last.length ? `Last closed: ${last.join(", ")}.` : "No closed trades yet, so there is no realised record to go on.",
      split.bot.trades ? `Manual: ${side(split.manual)}. Bot: ${side(split.bot)}. Their bot runs on Chainlink CRE: it only buys when the Chainlink ETH/USD feed and the DEX price agree, always with a stop and target.` : `All ${split.manual.trades} entries were placed by hand.`,
      `${p.followers} ${p.followers === 1 ? "person copies" : "people copy"} them and Guard has paused them ${p.guardPauses} time${p.guardPauses === 1 ? "" : "s"}${halt ? ` (paused now: ${halt.reason})` : ""}.`,
    ].filter(Boolean).join("\n");
  } else if (topic === "risk") {
    const entry = c.entry ?? c.mark;
    const slPct = c.stopPrice !== null && entry ? (1 - c.stopPrice / entry) * 100 : null;
    const tpPct = c.targetPrice !== null && entry ? (c.targetPrice / entry - 1) * 100 : null;
    reply = c.trade.side !== "buy" ? `This post is an exit, so there is nothing to copy from it. Copying ${who} copies their next entries, sized by your rules (up to ${money(size.max)} each).`
      : [
        `With your ${size.custom ? `rules for ${who}` : "default copy rules"}, this would be a ${money(size.usd)} copy (${size.ratio}× their ${money(size.leaderUsd)}, capped at ${money(size.max)}).`,
        slPct !== null ? `If the stop hits (−${slPct.toFixed(1)}%), you lose about ${money((size.usd * slPct) / 100)}.` : `There is no stop, so the loss is not capped.${size.requireStop ? " Your rules require a stop, so Tribe would ask before copying it." : ""}`,
        tpPct !== null ? `If the target hits (+${tpPct.toFixed(1)}%), you make about ${money((size.usd * tpPct) / 100)}.` : "",
        c.guard === "paused" ? "Guard has paused them, so no new copies go through right now." : `Guard keeps watching: if their risk score passes ${line}, new copies stop automatically and your open position keeps its stop.`,
      ].filter(Boolean).join(" ");
  } else {
    const good = checks.filter((x) => x.ok === true).length, bad = checks.filter((x) => x.ok === false).length;
    reply = `${verdict.label}. ${good} check${good === 1 ? "" : "s"} pass${good === 1 ? "es" : ""}${bad ? `, ${bad} to watch` : ""}. ${c.trade.side === "buy" ? `If you copy, it's about ${money(size.usd)} with your rules.` : "This post is an exit; copying follows their next entries."} Not financial advice: it's what the fills and Guard show.`;
  }

  const follow: Research["follow"] = [
    ...(topic !== "verdict" ? [{ label: "Is this a good trade?", text: "Is this a good trade?" }] : []),
    ...(topic !== "history" ? [{ label: c.source === "user" ? "Their track record" : "Bot vs manual record", text: "Show their track record" }] : []),
    ...(topic !== "risk" ? [{ label: "Worst case if I copy", text: "What's the worst case if I copy?" }] : []),
    ...(!ctx.own && !ctx.copying && !ctx.paused ? [{ label: "Copy with Flash", href: `/copy/${c.handle}`, icon: "bolt" }] : []),
    { label: "← Back to the post", href: `/t/${c.id}` },
  ];
  const cre = creEvidence(c.leader);
  return {
    reply, verdict: topic === "verdict" ? verdict : undefined, ctx, follow,
    steps: [
      { t: "The post", d: `${verbOf(c)} ${c.symbol}, ${ago(c.at)} ago${c.tx ? ", settled onchain" : ""}` },
      { t: "Track record", d: `${p.closed} closed trades, worst drawdown ${p.maxDd.toFixed(1)}%` },
      { t: "CRE CopyGuard", d: c.guard === "paused" ? "Paused" : cre.v && cre.run ? `${cre.v.severity} ${ago(cre.run.at)} ago, risk ${c.risk}/100` : `No run yet, risk ${c.risk}/100` },
      { t: "Your rules", d: `${money(size.usd)} per copy, max ${money(size.max)}` },
    ],
    sources: [`${who} fills`, cre.v ? "CRE CopyGuard report" : "Guard status", ...(cre.price ? ["Chainlink ETH/USD"] : []), "Your copy rules", ...(c.source === "bot" ? ["Chainlink CRE bot"] : [])],
  };
}
