import { db, followCount, haltOf } from "./db.js";
import { getPrice } from "./prices.js";

interface Pos { token: string; qty: number; cost: number; realized: number; invested: number }
export const positionsOf = (trader: number) => db.prepare("SELECT token, qty, cost, realized, invested FROM positions WHERE trader = ?").all(trader) as unknown as Pos[];

/** Total PnL in USD (realised + mark-to-market on open positions) and as % of capital invested. */
export async function totalPnl(trader: number): Promise<{ usd: number; pct: number; invested: number }> {
  let usd = 0;
  let invested = 0;
  for (const p of positionsOf(trader)) {
    invested += p.invested;
    usd += p.realized;
    if (p.qty > 1e-12) usd += p.qty * (await getPrice(p.token)) - p.cost;
  }
  return { usd, invested, pct: invested > 0 ? (usd / invested) * 100 : 0 };
}
export const totalPnlPct = async (t: number) => (await totalPnl(t)).pct;

/** Max peak-to-trough fall in PnL% over the last `hours`, in percentage points. */
export function drawdown(trader: number, hours = 24): number {
  const rows = db.prepare("SELECT pnl_pct FROM snapshots WHERE trader = ? AND at >= ? ORDER BY at").all(trader, Date.now() - hours * 3600_000) as unknown as { pnl_pct: number }[];
  let peak = -Infinity;
  let dd = 0;
  for (const r of rows) {
    peak = Math.max(peak, r.pnl_pct);
    dd = Math.max(dd, peak - r.pnl_pct);
  }
  return dd;
}

const count = (sql: string, ...args: (number | string)[]) => (db.prepare(sql).get(...args) as { n: number }).n;

export interface Badge { id: string; label: string; icon: string }

export interface TraderStats {
  id: number; handle: string; trades: number; followers: number; copiesMade: number; copiedByOthers: number;
  pnlPct: number; pnlUsd: number; drawdown: number; xp: number; level: number; badges: Badge[]; halted: boolean;
}

/** Research chats: Ask Chief opened about a feed post (the chat state names the trade). */
const RESEARCH_SQL = "SELECT COUNT(*) AS n FROM cat_chats WHERE user = ? AND state LIKE '%\"trade\":%'";
export const researched = (id: number, since = 0) => (db.prepare(RESEARCH_SQL + " AND at >= ?").get(id, since) as { n: number }).n;

export const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1;

export async function traderStats(id: number): Promise<TraderStats> {
  const u = db.prepare("SELECT handle FROM users WHERE id = ?").get(id) as { handle: string };
  const trades = count("SELECT COUNT(*) AS n FROM trades WHERE leader = ?", id);
  const followers = followCount(id);
  const copiesMade = count("SELECT COUNT(*) AS n FROM copies WHERE follower = ? AND status IN ('executed','dry-run')", id);
  const copiedByOthers = count("SELECT COUNT(*) AS n FROM copies WHERE leader = ? AND status IN ('executed','dry-run')", id);
  const brackets = count("SELECT COUNT(*) AS n FROM trades WHERE leader = ? AND (json_extract(trade, '$.orderType') IN ('bracket','stop-loss','take-profit') OR json_extract(trade, '$.attach') IS NOT NULL)", id);
  const guardSaves = count("SELECT COUNT(*) AS n FROM copies WHERE follower = ? AND note LIKE '%CopyGuard%'", id);
  const pnl = await totalPnl(id).catch(() => ({ usd: 0, pct: 0, invested: 0 }));
  const dd = drawdown(id);

  // XP is derived from activity (plus claimed quests) so it can never drift from the underlying data.
  const quests = (db.prepare("SELECT COALESCE(SUM(xp), 0) AS n FROM quest_claims WHERE user = ?").get(id) as { n: number }).n;
  const xp = trades * 10 + copiesMade * 5 + copiedByOthers * 3 + followers * 20 + brackets * 5 + guardSaves * 15 + (pnl.pct > 0 ? 100 : 0) + quests;
  const badges: Badge[] = [];
  const add = (cond: boolean, id: string, label: string, icon: string) => cond && badges.push({ id, label, icon });
  add(trades >= 1, "first-trade", "First Trade", "rise");
  add(copiesMade >= 1, "first-copy", "First Copy", "copy");
  add(brackets >= 3, "bracket-master", "Bracket Master", "target");
  add(followers >= 3, "tribe-leader", "Tribe Leader", "crown");
  add(guardSaves >= 1, "saved-by-guard", "Saved by Guard", "shieldok");
  add(pnl.pct >= 5, "green-5", "+5% Club", "up");
  add(researched(id) >= 5, "homework", "Did the Homework", "cat");
  return { id, handle: u.handle, trades, followers, copiesMade, copiedByOthers, pnlPct: pnl.pct, pnlUsd: pnl.usd, drawdown: dd, xp, level: levelOf(xp), badges, halted: !!haltOf(id) };
}

export type Tab = "profit" | "copied" | "safest";

export async function ranking(tab: Tab, limit = 20) {
  const ids = (db.prepare("SELECT DISTINCT leader AS id FROM trades").all() as unknown as { id: number }[]).map((r) => r.id);
  const all = await Promise.all(ids.map(traderStats));
  const sorted =
    tab === "profit" ? all.sort((a, b) => b.pnlPct - a.pnlPct)
    : tab === "copied" ? all.sort((a, b) => b.copiedByOthers - a.copiedByOthers || b.followers - a.followers)
    : all.filter((s) => s.trades >= 2).sort((a, b) => a.drawdown - b.drawdown || b.pnlPct - a.pnlPct);
  return sorted.slice(0, limit);
}

// ---------- Game: levels, XP timeline, streaks, quests and badge progress ----------

const DAY = 86400e3;
/** A trade that sets a stop or target: a protective order, or an entry with a bracket attached. */
const PROTECTIVE_SQL = "(json_extract(trade, '$.orderType') IN ('bracket','stop-loss','take-profit') OR json_extract(trade, '$.attach') IS NOT NULL)";

/** XP needed to start a level and to reach the next one (inverse of levelOf). */
export const levelRange = (level: number) => ({ lo: 50 * (level - 1) ** 2, hi: 50 * level ** 2 });

export type XpKind = "trade" | "bracket" | "copy" | "copied" | "follower" | "guard" | "quest" | "pnl";
export interface XpEvent { at: number; kind: XpKind; xp: number }

/** Every XP source with its time, using the same rules as traderStats, so the events sum to the same XP. */
export function xpEvents(id: number, pnlPositive: boolean): XpEvent[] {
  const ev: XpEvent[] = [];
  const ats = (sql: string, kind: XpKind, xp: number) => {
    for (const r of db.prepare(sql).all(id) as unknown as { at: number }[]) ev.push({ at: r.at, kind, xp });
  };
  ats("SELECT at FROM trades WHERE leader = ?", "trade", 10);
  ats(`SELECT at FROM trades WHERE leader = ? AND ${PROTECTIVE_SQL}`, "bracket", 5);
  ats("SELECT at FROM copies WHERE follower = ? AND status IN ('executed','dry-run')", "copy", 5);
  ats("SELECT at FROM copies WHERE leader = ? AND status IN ('executed','dry-run')", "copied", 3);
  ats("SELECT created_at AS at FROM follows WHERE leader = ?", "follower", 20);
  ats("SELECT at FROM copies WHERE follower = ? AND note LIKE '%CopyGuard%'", "guard", 15);
  for (const q of db.prepare("SELECT xp, at FROM quest_claims WHERE user = ?").all(id) as unknown as { xp: number; at: number }[]) ev.push({ at: q.at, kind: "quest", xp: q.xp });
  if (pnlPositive) ev.push({ at: 0, kind: "pnl", xp: 100 });
  return ev.sort((a, b) => a.at - b.at);
}

const XP_LABEL: Record<XpKind, (n: number) => string> = {
  trade: (n) => `${n} trade${n === 1 ? "" : "s"}`,
  bracket: (n) => `${n} bracket order${n === 1 ? "" : "s"}`,
  copy: (n) => `${n} cop${n === 1 ? "y" : "ies"} you made`,
  copied: (n) => `Copied ${n} time${n === 1 ? "" : "s"}`,
  follower: (n) => `${n} new follower${n === 1 ? "" : "s"}`,
  guard: (n) => (n === 1 ? "Saved by Guard" : `Saved by Guard ${n} times`),
  quest: (n) => `${n} quest${n === 1 ? "" : "s"} claimed`,
  pnl: () => "Positive PnL",
};

/** Where the XP since reaching the previous level came from, grouped by source. */
export function xpSinceLastLevel(ev: XpEvent[], level: number): { rows: [string, number][]; total: number } {
  const { lo } = levelRange(Math.max(1, level - 1));
  let sum = 0;
  let from = 0;
  if (level > 1) {
    for (let i = 0; i < ev.length; i++) {
      sum += ev[i].xp;
      if (sum >= lo) { from = i + 1; break; }
    }
  }
  const counts = new Map<XpKind, { n: number; xp: number }>();
  for (const e of ev.slice(from)) {
    const c = counts.get(e.kind) ?? { n: 0, xp: 0 };
    counts.set(e.kind, { n: c.n + 1, xp: c.xp + e.xp });
  }
  const rows = [...counts].map(([k, c]) => [XP_LABEL[k](c.n), c.xp] as [string, number]);
  return { rows, total: rows.reduce((a, r) => a + r[1], 0) };
}

/** Realised PnL per UTC day, newest first. A green day closes with positive realised PnL. */
function dailyPnl(trader: number) {
  return db.prepare("SELECT strftime('%Y-%m-%d', filled_at/1000, 'unixepoch') AS d, SUM(pnl) AS p FROM orders WHERE trader = ? AND status = 'filled' AND json_extract(trade,'$.side') = 'sell' GROUP BY d ORDER BY d DESC").all(trader) as unknown as { d: string; p: number }[];
}

/** Consecutive green trading days, counting back from the latest day with a closed trade. */
export const greenDays = (trader: number): number => {
  let n = 0;
  for (const r of dailyPnl(trader)) { if (r.p > 0) n++; else break; }
  return n;
};

/** Current and best green-day streaks, plus the last 7 calendar days for the streak strip. */
export function streakOf(trader: number) {
  const rows = dailyPnl(trader);
  let best = 0, run = 0;
  for (const r of rows) { run = r.p > 0 ? run + 1 : 0; best = Math.max(best, run); }
  const byDay = new Map(rows.map((r) => [r.d, r.p]));
  const today = dayStart();
  const week = Array.from({ length: 7 }, (_, i) => {
    const t = today - (6 - i) * DAY;
    return { label: "SMTWTFS"[new Date(t).getUTCDay()], green: (byDay.get(new Date(t).toISOString().slice(0, 10)) ?? 0) > 0 };
  });
  return { current: greenDays(trader), best, week };
}

export interface Quest { id: string; period: "Daily" | "Weekly"; key: string; title: string; done: number; of: number; xp: number; icon: string; claimed: boolean }

export const dayStart = (t = Date.now()) => new Date(t).setUTCHours(0, 0, 0, 0);
/** Monday 00:00 UTC of the week containing t. */
export const weekStart = (t = Date.now()) => dayStart(t) - ((new Date(t).getUTCDay() + 6) % 7) * DAY;

/** Daily and weekly quests, measured from real activity in the current UTC day or week. */
export function questsOf(id: number): Quest[] {
  const d = dayStart(), w = weekStart();
  const dKey = new Date(d).toISOString().slice(0, 10), wKey = "w" + new Date(w).toISOString().slice(0, 10);
  const claimed = new Set((db.prepare("SELECT quest || '|' || period AS k FROM quest_claims WHERE user = ?").all(id) as unknown as { k: string }[]).map((r) => r.k));
  const n = (sql: string, since: number) => (db.prepare(sql).get(id, since) as { n: number }).n;
  const defs: [Quest["period"], string, string, number, number, number, string][] = [
    ["Daily", "d-trade", "Make a trade", n("SELECT COUNT(*) AS n FROM trades WHERE leader = ? AND at >= ?", d), 1, 10, "rise"],
    ["Daily", "d-copystop", "Copy a trade that has a stop", n("SELECT COUNT(*) AS n FROM basket_copies c JOIN baskets b ON b.id = c.basket WHERE c.follower = ? AND c.at >= ? AND c.status IN ('filled','partial','closed') AND b.stop_pct > 0", d) + n("SELECT COUNT(*) AS n FROM copies c JOIN trades t ON t.id = c.trade_id WHERE c.follower = ? AND c.at >= ? AND c.status IN ('executed','dry-run') AND (json_extract(t.trade, '$.orderType') IN ('bracket','stop-loss') OR json_extract(t.trade, '$.attach') IS NOT NULL OR json_array_length(json_extract(t.trade, '$.triggers')) > 0)", d), 1, 5, "list"],
    ["Daily", "d-bracket", "Place a bracket order", n("SELECT COUNT(*) AS n FROM trades WHERE leader = ? AND at >= ? AND (json_extract(trade, '$.orderType') = 'bracket' OR json_extract(trade, '$.attach') IS NOT NULL)", d), 1, 5, "updown"],
    ["Weekly", "w-follower", "Gain a new follower", n("SELECT COUNT(*) AS n FROM follows WHERE leader = ? AND created_at >= ?", w), 1, 20, "userplus"],
    ["Weekly", "w-copied", "Get copied 5 times", n("SELECT COUNT(*) AS n FROM copies WHERE leader = ? AND at >= ? AND status IN ('executed','dry-run')", w), 5, 15, "copy"],
    ["Weekly", "w-brackets", "Place 3 bracket orders", n("SELECT COUNT(*) AS n FROM trades WHERE leader = ? AND at >= ? AND (json_extract(trade, '$.orderType') = 'bracket' OR json_extract(trade, '$.attach') IS NOT NULL)", w), 3, 15, "star"],
  ];
  return defs.map(([period, qid, title, done, of, xp, icon]) => {
    const key = period === "Daily" ? dKey : wKey;
    return { id: qid, period, key, title, done: Math.min(done, of), of, xp, icon, claimed: claimed.has(`${qid}|${key}`) };
  });
}

export interface BadgeProgress { id: string; label: string; rule: string; how: string; done: number; of: number; unit: string; when: number | null; icon: string; cta: [string, string] }

/** The seven badges with progress toward each, and when each was earned where the data has a date. */
export async function badgeProgress(id: number): Promise<BadgeProgress[]> {
  const s = await traderStats(id);
  const nth = (sql: string, k: number) => (db.prepare(`${sql} ORDER BY 1 LIMIT 1 OFFSET ${k - 1}`).get(id) as { at: number } | undefined)?.at || null;
  const brackets = (db.prepare(`SELECT COUNT(*) AS n FROM trades WHERE leader = ? AND ${PROTECTIVE_SQL}`).get(id) as { n: number }).n;
  const saves = (db.prepare("SELECT COUNT(*) AS n FROM copies WHERE follower = ? AND note LIKE '%CopyGuard%'").get(id) as { n: number }).n;
  return [
    { id: "first-trade", label: "First Trade", rule: "Place your first trade", how: "Place any trade through Flash, from a bot or a trader you copy.", done: s.trades, of: 1, unit: "", when: nth("SELECT at FROM trades WHERE leader = ?", 1), icon: "rise", cta: ["Ask Chief to trade", "/cat"] },
    { id: "first-copy", label: "First Copy", rule: "Copy a trade for the first time", how: "Copy any trade from the feed.", done: s.copiesMade, of: 1, unit: "", when: nth("SELECT at FROM copies WHERE follower = ? AND status IN ('executed','dry-run')", 1), icon: "copy", cta: ["Find traders", "/ranks"] },
    { id: "bracket-master", label: "Bracket Master", rule: "Place 3 bracket orders", how: "A bracket order sets a stop and a target together. Place three of them.", done: brackets, of: 3, unit: "", when: nth(`SELECT at FROM trades WHERE leader = ? AND ${PROTECTIVE_SQL}`, 3), icon: "target", cta: ["Ask Chief for a bracket", "/cat"] },
    { id: "saved-by-guard", label: "Saved by Guard", rule: "Guard blocks a risky copy for you", how: "Earned when Guard pauses a trader you copy and stops a copy before it fills.", done: saves, of: 1, unit: "", when: nth("SELECT at FROM copies WHERE follower = ? AND note LIKE '%CopyGuard%'", 1), icon: "shieldok", cta: ["Open Guard", "/guard"] },
    { id: "tribe-leader", label: "Tribe Leader", rule: "Reach 3 followers", how: "Get three people to copy you. Share a good trade to find them.", done: s.followers, of: 3, unit: "", when: nth("SELECT created_at AS at FROM follows WHERE leader = ? AND created_at > 0", 3), icon: "crown", cta: ["Share a trade", "/share/me"] },
    { id: "green-5", label: "+5% Club", rule: "Reach +5% PnL", how: "Grow your total PnL, realised plus open positions, to 5% or more.", done: Math.max(0, Math.round(s.pnlPct * 10) / 10), of: 5, unit: "%", when: null, icon: "up", cta: ["Open positions", "/positions"] },
  ];
}
