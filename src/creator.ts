import { buildProposal } from "./ask.js";
import { integratorFeeBps } from "./flash.js";
import { mirror } from "./copy.js";
import { portfolio, seasonOf, seasonRange } from "./data.js";
import { db, followCount, getMeta, haltOf, userById } from "./db.js";
import { TOKENS } from "./parse.js";
import { getPrice } from "./prices.js";
import { isDry } from "./tracker.js";
import { isExternal } from "./wallet.js";

/**
 * Creator Studio: creators' own bots and how creators get paid.
 *
 * A bot is one of three templates with the creator's settings. It trades from the creator's own wallet under their
 * name, tagged Bot, always with a stop. A new bot runs a private trial first (its trades build a record but nobody sees
 * or copies them); after 14 days it can be published, and from then its trades are copied like any of the creator's.
 * MetaMask wallets can't be signed for, so there a bot asks the creator to approve each trade instead of placing it.
 *
 * Pay: a share of Tribe's fee on every copied order, by tier. Half of each season's share is held until the season
 * ends and released by how the copiers did; copies made while CopyGuard had the creator paused earn nothing.
 */

export const FEE_BPS = () => integratorFeeBps();
export const TRIAL_DAYS = 14;
export const STAKE_USD = 100;
const HOUR = 3600e3;
const DAY = 24 * HOUR;

export type TemplateKey = "dip" | "trend" | "dca";
export interface Template { name: string; icon: string; blurb: string; param: { label: string; unit: string; options: number[]; def: number }; lookbackH: number }
export const TEMPLATES: Record<TemplateKey, Template> = {
  dip: { name: "Buy the dip", icon: "down", blurb: "Buys when ETH falls a set % below its high of the last 24 hours.", param: { label: "Buy after a drop of", unit: "%", options: [2, 3, 5, 8], def: 3 }, lookbackH: 24 },
  trend: { name: "Ride the trend", icon: "rise", blurb: "Buys when ETH climbs a set % above its average price of the last 6 hours.", param: { label: "Buy when above its average by", unit: "%", options: [0.5, 1, 2, 3], def: 1 }, lookbackH: 6 },
  dca: { name: "Steady buyer", icon: "clock", blurb: "Buys a fixed amount on a schedule, whatever the price.", param: { label: "Buy every", unit: "h", options: [4, 8, 12, 24], def: 12 }, lookbackH: 0 },
};

export interface BotParams { token: string; usd: number; perDay: number; stopPct: number; tpPct: number; maxDdPct: number; p: number }
export type BotStatus = "trial" | "live" | "paused" | "stopped";
export interface Bot { id: number; owner: number; name: string; template: TemplateKey; params: BotParams; status: BotStatus; reason: string | null; created_at: number; trial_from: number; published_at: number | null; last_check: number | null; last_why: string | null }

const rowToBot = (r: any): Bot => ({ ...r, params: JSON.parse(r.params) as BotParams });
export const botById = (id: number): Bot | undefined => { const r = db.prepare("SELECT * FROM bots WHERE id = ?").get(id); return r ? rowToBot(r) : undefined; };
export const botsOf = (owner: number): Bot[] => (db.prepare("SELECT * FROM bots WHERE owner = ? AND status != 'stopped' ORDER BY id DESC").all(owner) as any[]).map(rowToBot);
export const liveBotsOf = (owner: number): Bot[] => (db.prepare("SELECT * FROM bots WHERE owner = ? AND status = 'live' ORDER BY id").all(owner) as any[]).map(rowToBot);
const activeBots = (): Bot[] => (db.prepare("SELECT * FROM bots WHERE status IN ('trial','live') ORDER BY id").all() as any[]).map(rowToBot);
const setStatus = (id: number, status: BotStatus, reason: string | null = null) => db.prepare("UPDATE bots SET status = ?, reason = ? WHERE id = ?").run(status, reason, id);

/** Checks a bot's settings; throws with a plain reason. */
export function checkParams(template: string, p: Partial<BotParams>): BotParams {
  const t = TEMPLATES[template as TemplateKey];
  if (!t) throw new Error("Pick a bot type");
  const n = (v: unknown, def: number) => (v === undefined || v === null || v === "" ? def : Number(v));
  const out: BotParams = {
    token: String(p.token ?? "ETH").toUpperCase(),
    usd: n(p.usd, 25), perDay: Math.round(n(p.perDay, 2)), stopPct: n(p.stopPct, 0), tpPct: n(p.tpPct, 0), maxDdPct: n(p.maxDdPct, 15), p: n(p.p, t.param.def),
  };
  if (!TOKENS[out.token]) throw new Error("Bots trade ETH for now");
  if (!(out.usd >= 5 && out.usd <= 500)) throw new Error("Size per trade is $5 to $500");
  if (!(out.perDay >= 1 && out.perDay <= 10)) throw new Error("1 to 10 trades a day");
  if (!(out.stopPct >= 1 && out.stopPct <= 25)) throw new Error("Every bot needs a stop between 1% and 25%");
  if (!(out.tpPct === 0 || (out.tpPct >= 1 && out.tpPct <= 100))) throw new Error("Take-profit is off, or 1% to 100%");
  if (!(out.maxDdPct >= 5 && out.maxDdPct <= 50)) throw new Error("The auto-stop is 5% to 50%");
  if (!(out.p >= Math.min(...t.param.options) && out.p <= Math.max(...t.param.options))) throw new Error(`${t.param.label}: ${t.param.options.join(", ")}${t.param.unit}`);
  return out;
}

/** The creator's stake: a bot only runs from a wallet with at least $100 free, the creator's own money at risk. */
export async function stakeOf(owner: number) {
  const free = (await portfolio(owner)).free;
  return { free, ok: free >= STAKE_USD };
}

export async function createBot(owner: number, name: string, template: string, params: Partial<BotParams>): Promise<Bot> {
  const clean = name.trim().slice(0, 40);
  if (clean.length < 3) throw new Error("Give your bot a name (3+ characters)");
  const p = checkParams(template, params);
  if (botsOf(owner).length >= 5) throw new Error("Up to 5 bots each. Stop one first.");
  const stake = await stakeOf(owner);
  if (!stake.ok) throw new Error(`Bots run from your own wallet: you need at least $${STAKE_USD} free (you have $${stake.free.toFixed(2)}). Add funds first.`);
  const now = Date.now();
  const id = Number(db.prepare("INSERT INTO bots (owner, name, template, params, status, created_at, trial_from) VALUES (?, ?, ?, ?, 'trial', ?, ?)").run(owner, clean, template, JSON.stringify(p), now, now).lastInsertRowid);
  return botById(id)!;
}

export function updateBot(owner: number, id: number, params: Partial<BotParams>) {
  const b = botById(id);
  if (!b || b.owner !== owner) throw new Error("Bot not found");
  const p = checkParams(b.template, { ...b.params, ...params });
  db.prepare("UPDATE bots SET params = ? WHERE id = ?").run(JSON.stringify(p), id);
}

/** Pause, resume or stop. A resumed bot goes back to where it was: trial if never published, otherwise live. */
export function controlBot(owner: number, id: number, action: string): string {
  const b = botById(id);
  if (!b || b.owner !== owner) throw new Error("Bot not found");
  if (action === "pause") { setStatus(id, "paused", "Paused by you"); return `${b.name} is paused`; }
  if (action === "resume") {
    if (b.status === "stopped") throw new Error("A stopped bot can't restart. Make a new one.");
    setStatus(id, b.published_at ? "live" : "trial");
    return `${b.name} is running again`;
  }
  if (action === "stop") { setStatus(id, "stopped", "Stopped by you"); return `${b.name} is stopped. Its record stays on your profile.`; }
  throw new Error("Unknown action");
}

// ---------- Records ----------

export interface BotRecord { entries: number; closed: number; wins: number; realized: number; deployed: number; returnPct: number | null; copiers: number; copiedUsd: number; today: number; lastBuy: number | null; pausesDuringTrial: number; days: number }

export function botRecord(b: Bot): BotRecord {
  const entries = db.prepare("SELECT COUNT(*) AS n, MAX(at) AS last FROM trades WHERE bot_id = ? AND json_extract(trade,'$.side') = 'buy'").get(b.id) as { n: number; last: number | null };
  const fills = db.prepare("SELECT COALESCE(SUM(CASE WHEN json_extract(o.trade,'$.side') = 'buy' THEN o.usd END), 0) AS deployed, COALESCE(SUM(CASE WHEN json_extract(o.trade,'$.side') = 'sell' THEN o.pnl END), 0) AS realized, COUNT(CASE WHEN json_extract(o.trade,'$.side') = 'sell' AND o.pnl IS NOT NULL THEN 1 END) AS closed, COALESCE(SUM(json_extract(o.trade,'$.side') = 'sell' AND o.pnl > 0), 0) AS wins FROM orders o JOIN trades t ON t.id = o.trade_id WHERE t.bot_id = ? AND o.trader = t.leader AND o.status = 'filled'").get(b.id) as { deployed: number; realized: number; closed: number; wins: number };
  const copies = db.prepare("SELECT COUNT(DISTINCT c.follower) AS n, COALESCE(SUM(c.usd), 0) AS usd FROM copies c JOIN trades t ON t.id = c.trade_id WHERE t.bot_id = ? AND c.status IN ('executed','dry-run')").get(b.id) as { n: number; usd: number };
  const today = (db.prepare("SELECT COUNT(*) AS n FROM trades WHERE bot_id = ? AND json_extract(trade,'$.side') = 'buy' AND at >= ?").get(b.id, new Date().setUTCHours(0, 0, 0, 0)) as { n: number }).n;
  const pauses = (db.prepare("SELECT COUNT(*) AS n FROM guard_events WHERE leader = ? AND kind = 'halt' AND at >= ?").get(b.owner, b.trial_from) as { n: number }).n;
  return {
    entries: entries.n, closed: fills.closed, wins: fills.wins, realized: fills.realized, deployed: fills.deployed,
    returnPct: fills.deployed > 0 && fills.closed > 0 ? (fills.realized / fills.deployed) * 100 : null,
    copiers: copies.n, copiedUsd: copies.usd, today, lastBuy: entries.last, pausesDuringTrial: pauses,
    days: Math.floor((Date.now() - b.trial_from) / DAY),
  };
}

/** What a bot needs before it can be published: a real record from its own trial, and the creator's stake. */
export async function publishChecks(b: Bot): Promise<{ label: string; detail: string; ok: boolean }[]> {
  const r = botRecord(b);
  const stake = await stakeOf(b.owner);
  return [
    { label: `${TRIAL_DAYS} days on trial`, detail: `${Math.min(r.days, TRIAL_DAYS)} of ${TRIAL_DAYS} days`, ok: r.days >= TRIAL_DAYS },
    { label: "3+ trades on its own record", detail: `${r.entries} so far`, ok: r.entries >= 3 },
    { label: "No Guard pauses during the trial", detail: r.pausesDuringTrial ? `${r.pausesDuringTrial} pause${r.pausesDuringTrial > 1 ? "s" : ""}` : "None", ok: r.pausesDuringTrial === 0 && !haltOf(b.owner) },
    { label: "A stop on every trade", detail: `${b.params.stopPct}% stop, set by the bot`, ok: true },
    { label: `$${STAKE_USD}+ of your own money in the wallet`, detail: `$${stake.free.toFixed(2)} free`, ok: stake.ok },
  ];
}

export async function publishBot(owner: number, id: number) {
  const b = botById(id);
  if (!b || b.owner !== owner) throw new Error("Bot not found");
  if (b.status === "live") throw new Error("It's already published");
  if (b.status !== "trial") throw new Error("Resume the bot first");
  const failed = (await publishChecks(b)).filter((c) => !c.ok);
  if (failed.length) throw new Error(`Not yet: ${failed.map((c) => c.label.toLowerCase()).join(", ")}`);
  db.prepare("UPDATE bots SET status = 'live', reason = NULL, published_at = ? WHERE id = ?").run(Date.now(), id);
  return b.name;
}

/** Demo only: skip the 14-day wait so the whole flow can be tried in one sitting. */
export function fastForwardTrial(owner: number, id: number) {
  if (process.env.DEMO !== "true") throw new Error("Only in demo mode");
  const b = botById(id);
  if (!b || b.owner !== owner) throw new Error("Bot not found");
  db.prepare("UPDATE bots SET trial_from = ? WHERE id = ?").run(Date.now() - TRIAL_DAYS * DAY - 60e3, id);
}

// ---------- Running ----------

const ticks = (token: string, sinceMs: number) =>
  (db.prepare("SELECT price, at FROM price_ticks WHERE token = ? AND at >= ? ORDER BY at").all(token, Date.now() - sinceMs) as { price: number; at: number }[]);

/** Whether the bot's rule says buy now, and why (in plain words, shown on the bot's page). */
export function evaluate(b: Bot, price: number, rec = botRecord(b)): { buy: boolean; why: string } {
  const t = TEMPLATES[b.template];
  const p = b.params;
  if (b.template === "dca") {
    const due = rec.lastBuy === null ? 0 : rec.lastBuy + p.p * HOUR - Date.now();
    return due <= 0 ? { buy: true, why: `Scheduled buy: every ${p.p}h` } : { buy: false, why: `Next scheduled buy in ${Math.ceil(due / 60e3)} min` };
  }
  // The price rules wait an hour after a buy so one move doesn't trigger a run of entries.
  if (rec.lastBuy !== null && Date.now() - rec.lastBuy < HOUR) return { buy: false, why: "Waiting an hour after its last buy" };
  const s = ticks(TOKENS[p.token], t.lookbackH * HOUR);
  const span = s.length ? (Date.now() - s[0].at) / HOUR : 0;
  if (s.length < 10) return { buy: false, why: `Watching the price (${s.length} readings so far)` };
  if (b.template === "dip") {
    const high = Math.max(price, ...s.map((x) => x.price));
    const drop = (1 - price / high) * 100;
    return drop >= p.p ? { buy: true, why: `ETH is ${drop.toFixed(1)}% below its ${span.toFixed(0)}h high of $${high.toFixed(0)}` } : { buy: false, why: `ETH is ${drop.toFixed(2)}% below its recent high; buys at ${p.p}%` };
  }
  const avg = s.reduce((a, x) => a + x.price, 0) / s.length;
  const above = (price / avg - 1) * 100;
  return above >= p.p ? { buy: true, why: `ETH is ${above.toFixed(1)}% above its ${span.toFixed(0)}h average of $${avg.toFixed(0)}` } : { buy: false, why: `ETH is ${above.toFixed(2)}% vs its average; buys at +${p.p}%` };
}

export interface RunResult { placed?: number; asked?: number; why: string }

/** Place the bot's trade: from the creator's wallet, or as a request for them to approve when only they can sign. */
async function place(b: Bot, why: string): Promise<RunResult> {
  const p = b.params;
  const intent = { side: "buy" as const, usd: p.usd, token: p.token, stopPct: p.stopPct, tpPct: p.tpPct || undefined };
  if (isExternal(b.owner) && !isDry()) {
    const asked = Number(db.prepare("INSERT INTO bot_signals (bot, owner, intent, why, at) VALUES (?, ?, ?, ?, ?)").run(b.id, b.owner, JSON.stringify(intent), why, Date.now()).lastInsertRowid);
    return { asked, why: `${why}. Waiting for you to approve it in MetaMask.` };
  }
  return execIntent(b, intent, why);
}

async function execIntent(b: Bot, intent: { side: "buy"; usd: number; token: string; stopPct: number; tpPct?: number }, why: string): Promise<RunResult> {
  const proposal = await buildProposal(intent, { oneOrder: isExternal(b.owner) && !isDry() });
  let first: number | undefined;
  for (const t of proposal.trades) {
    const m = await mirror(b.owner, t, "bot", `${b.name}: ${why}`, { bot: b.id, private: b.status === "trial" });
    if (m.own.startsWith("failed")) return { why: `Couldn't place it: ${m.own.replace(/^failed: /, "")}` };
    first ??= m.tradeId;
  }
  return { placed: first, why: `Bought $${intent.usd} of ${intent.token}: ${why}` };
}

/** Auto-stop: a bot whose realised loss passes its limit pauses itself. */
function checkDrawdown(b: Bot) {
  const r = botRecord(b);
  if (r.deployed <= 0 || r.realized >= 0) return;
  const dd = (-r.realized / r.deployed) * 100;
  if (dd >= b.params.maxDdPct) setStatus(b.id, "paused", `Auto-stopped: down ${dd.toFixed(1)}%, past its ${b.params.maxDdPct}% limit`);
}

/** One check of one bot: should it buy now? `force` skips the price rule (the "Buy now" test button), never the limits. */
export async function runBot(b: Bot, opts: { force?: boolean } = {}): Promise<RunResult> {
  let res: RunResult;
  const rec = botRecord(b);
  if (b.status !== "trial" && b.status !== "live") res = { why: b.reason ?? "Not running" };
  else if (haltOf(b.owner)) res = { why: "CopyGuard has you paused: the bot waits until it clears" };
  else if (getMeta(b.owner).pausedAll) res = { why: "You paused all copying and trading" };
  else if (rec.today >= b.params.perDay) res = { why: `Done for today: ${b.params.perDay} trade${b.params.perDay > 1 ? "s" : ""} a day` };
  else if (db.prepare("SELECT 1 FROM bot_signals WHERE bot = ? AND status = 'open'").get(b.id)) res = { why: "Waiting for you to approve its last trade" };
  else {
    const price = await getPrice(TOKENS[b.params.token]).catch(() => 0);
    if (!(price > 0)) res = { why: "No price right now" };
    else {
      const e = opts.force ? { buy: true, why: "Manual test buy" } : evaluate(b, price, rec);
      res = e.buy ? await place(b, e.why) : { why: e.why };
    }
  }
  db.prepare("UPDATE bots SET last_check = ?, last_why = ? WHERE id = ?").run(Date.now(), res.why.slice(0, 200), b.id);
  if (res.placed) checkDrawdown(botById(b.id)!);
  return res;
}

let running = false;
/** The bot runner: record prices, then give every running bot a look. Called every minute by the server. */
export async function tickBots(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const bots = activeBots();
    const tokens = new Set(bots.map((b) => TOKENS[b.params.token]));
    for (const t of tokens) {
      const price = await getPrice(t).catch(() => 0);
      if (price > 0) db.prepare("INSERT INTO price_ticks (token, price, at) VALUES (?, ?, ?)").run(t, price, Date.now());
    }
    db.prepare("DELETE FROM price_ticks WHERE at < ?").run(Date.now() - 8 * DAY);
    for (const b of bots) {
      try { await runBot(b); checkDrawdown(botById(b.id)!); } catch (e) { console.error(`bot ${b.id}:`, (e as Error).message); }
    }
  } finally {
    running = false;
  }
}

export const openSignals = (owner: number) =>
  db.prepare("SELECT s.id, s.bot, s.intent, s.why, s.at, b.name FROM bot_signals s JOIN bots b ON b.id = s.bot WHERE s.owner = ? AND s.status = 'open' ORDER BY s.id").all(owner) as { id: number; bot: number; intent: string; why: string; at: number; name: string }[];

/** The creator approves (signs) or declines a trade their bot asked for. Requests older than 30 minutes lapse. */
export async function answerSignal(owner: number, id: number, approve: boolean): Promise<RunResult> {
  const s = db.prepare("SELECT * FROM bot_signals WHERE id = ? AND owner = ? AND status = 'open'").get(id, owner) as { bot: number; intent: string; why: string; at: number } | undefined;
  if (!s) throw new Error("That request was already handled");
  const fresh = Date.now() - s.at < 30 * 60e3;
  db.prepare("UPDATE bot_signals SET status = ? WHERE id = ?").run(!approve ? "declined" : fresh ? "approved" : "expired", id);
  if (!approve) return { why: "Declined" };
  if (!fresh) throw new Error("That request lapsed (30 minutes). The bot will ask again when its rule fires.");
  return execIntent(botById(s.bot)!, JSON.parse(s.intent), s.why);
}

// ---------- Creator pay ----------

export interface Tier { key: string; label: string; share: number; next?: string }
/** The creator's share of Tribe's fee: 30% to start, 40% once copiers are net positive, 50% for the best (or founding). */
export function tierOf(uid: number, out = copierOutcomes(uid)): Tier {
  const founding = (getMeta(uid).foundingUntil ?? 0) > Date.now();
  if (founding) return { key: "founding", label: "Founding creator", share: 0.5 };
  if (out.copiers >= 20 && out.inProfitPct >= 60) return { key: "top", label: "Top creator", share: 0.5 };
  if (out.copiers >= 5 && out.netUsd >= 0) return { key: "proven", label: "Proven", share: 0.4, next: "20+ copiers with 60% in profit: 50%" };
  return { key: "new", label: "New creator", share: 0.3, next: "5+ copiers who are net positive: 40%" };
}

export interface Outcomes { copiers: number; inProfit: number; inProfitPct: number; netUsd: number; investedUsd: number; netPct: number | null; following: number; retained30: number | null }
/** How the people who copied this creator did, from their filled copy orders (since `since`, if given). */
export function copierOutcomes(uid: number, since = 0, until = Infinity): Outcomes {
  const rows = db.prepare("SELECT trader, COALESCE(SUM(pnl), 0) AS pnl, COALESCE(SUM(CASE WHEN json_extract(trade,'$.side') = 'buy' THEN usd END), 0) AS inv FROM orders WHERE leader = ? AND role = 'copy' AND trader != leader AND status = 'filled' AND placed_at >= ? AND placed_at < ? GROUP BY trader").all(uid, since, Number.isFinite(until) ? until : 9e15) as { trader: number; pnl: number; inv: number }[];
  const netUsd = rows.reduce((a, r) => a + r.pnl, 0);
  const investedUsd = rows.reduce((a, r) => a + r.inv, 0);
  const inProfit = rows.filter((r) => r.pnl > 0).length;
  // Retention: of the people who first copied 30+ days ago, how many still follow.
  const old = db.prepare("SELECT follower FROM copies WHERE leader = ? AND follower != leader AND status IN ('executed','dry-run') GROUP BY follower HAVING MIN(at) <= ?").all(uid, Date.now() - 30 * DAY) as { follower: number }[];
  const still = old.filter((r) => db.prepare("SELECT 1 FROM follows WHERE follower = ? AND leader = ?").get(r.follower, uid)).length;
  return {
    copiers: rows.length, inProfit, inProfitPct: rows.length ? Math.round((inProfit / rows.length) * 100) : 0, netUsd, investedUsd,
    netPct: investedUsd > 0 ? (netUsd / investedUsd) * 100 : null, following: followCount(uid), retained30: old.length ? Math.round((still / old.length) * 100) : null,
  };
}

/** Time ranges when CopyGuard had this creator paused. */
function haltWindows(uid: number): [number, number][] {
  const ev = db.prepare("SELECT kind, at FROM guard_events WHERE leader = ? ORDER BY at").all(uid) as { kind: string; at: number }[];
  const out: [number, number][] = [];
  let from: number | undefined;
  for (const e of ev) {
    if (e.kind === "halt" && from === undefined) from = e.at;
    else if (e.kind !== "halt" && from !== undefined) { out.push([from, e.at]); from = undefined; }
  }
  if (from !== undefined || haltOf(uid)) out.push([from ?? haltOf(uid)!.at, Infinity]);
  return out;
}

/** Released share of a past season's held-back half: all of it if copiers were net positive, less the more they lost. */
export const releaseFactor = (netPct: number | null) => (netPct === null || netPct >= 0 ? 1 : Math.max(0, 1 + netPct / 10));

export interface Earnings { volume: number; orders: number; accrued: number; released: number; held: number; weekly: number; claimed: number; claimable: number; copiers: number; shareBps: number; tier: Tier; excludedPaused: number; season: number; seasonEnds: number; outcomes: Outcomes }

export function earningsOf(uid: number): Earnings {
  const outcomes = copierOutcomes(uid);
  const tier = tierOf(uid, outcomes);
  const rows = db.prepare("SELECT usd, at FROM copies WHERE leader = ? AND follower != ? AND status IN ('executed','dry-run')").all(uid, uid) as { usd: number; at: number }[];
  const halts = haltWindows(uid);
  const rate = (FEE_BPS() / 1e4) * tier.share;
  const cur = seasonOf(Date.now());
  const bySeason = new Map<number, number>();
  let volume = 0, orders = 0, weekly = 0, excludedPaused = 0;
  for (const r of rows) {
    if (halts.some(([a, b]) => r.at >= a && r.at < b)) { excludedPaused++; continue; }
    volume += r.usd; orders++;
    const e = r.usd * rate;
    if (r.at >= Date.now() - 7 * DAY) weekly += e;
    const s = seasonOf(r.at);
    bySeason.set(s, (bySeason.get(s) ?? 0) + e);
  }
  let released = 0, held = 0, accrued = 0;
  for (const [s, e] of bySeason) {
    accrued += e;
    if (s >= cur) { released += e / 2; held += e / 2; continue; }
    const range = seasonRange(s);
    released += e / 2 + (e / 2) * releaseFactor(copierOutcomes(uid, range.start, range.end).netPct);
  }
  const claimed = getMeta(uid).claimed;
  return {
    volume, orders, accrued, released, held, weekly, claimed, claimable: Math.max(0, released - claimed), copiers: followCount(uid),
    shareBps: Math.round(tier.share * 100), tier, excludedPaused, season: cur, seasonEnds: seasonRange(cur).end, outcomes,
  };
}

/** The fee on a copy and the creator's cut of it, shown before the copier confirms. */
export function copyFee(leader: number, usd: number) {
  const fee = (usd * FEE_BPS()) / 1e4;
  const share = tierOf(leader).share;
  return { fee, creator: fee * share, bps: FEE_BPS(), sharePct: Math.round(share * 100), handle: userById(leader)?.handle ?? "" };
}

// ---------- Copy ledger ----------

export interface LedgerRow { id: number; at: number; label: string; botName: string | null; private: boolean; copied: number; skipped: number; declined: number; pending: number; reasons: string[] }
/** Every recent trade of the creator and what happened to each copy of it: copied, skipped (and why), declined, waiting. */
export function copyLedger(uid: number, limit = 12): LedgerRow[] {
  const trades = db.prepare("SELECT t.id, t.at, t.trade, t.private, b.name AS bot FROM trades t LEFT JOIN bots b ON b.id = t.bot_id WHERE t.leader = ? ORDER BY t.id DESC LIMIT ?").all(uid, limit) as { id: number; at: number; trade: string; private: number; bot: string | null }[];
  return trades.map((t) => {
    const c = db.prepare("SELECT status, note FROM copies WHERE trade_id = ?").all(t.id) as { status: string; note: string | null }[];
    const pend = db.prepare("SELECT status FROM pending_copies WHERE trade_id = ?").all(t.id) as { status: string }[];
    const tr = JSON.parse(t.trade) as { side: string; qty: string; orderType: string };
    const reasons = [...new Set(c.filter((x) => x.status === "skipped" && x.note).map((x) => x.note!))].slice(0, 2);
    return {
      id: t.id, at: t.at, label: `${tr.side === "buy" ? `Buy $${Number(tr.qty).toFixed(0)}` : "Sell"} ETH · ${tr.orderType}`, botName: t.bot, private: !!t.private,
      copied: c.filter((x) => x.status === "executed" || x.status === "dry-run").length,
      skipped: c.filter((x) => x.status === "skipped").length,
      declined: pend.filter((x) => x.status === "skipped" || x.status === "expired").length,
      pending: pend.filter((x) => x.status === "open").length,
      reasons,
    };
  });
}
