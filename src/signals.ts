import { db, userByHandle, userById } from "./db.js";
import { getPrice } from "./prices.js";
import { TOKENS } from "./parse.js";
import { symOf } from "./data.js";

/**
 * Signals: a trader's public call (a long with an entry, a target and a stop, a time frame and why), scored by what the
 * price did next. A call is a hit if the target trades before the stop, stopped if the stop goes first, and expired if
 * neither happens in its time frame. Good callers gain followers, followers copy them with Flash, and they earn a share
 * of the fees on every copy.
 */
db.exec("CREATE TABLE IF NOT EXISTS signals (id INTEGER PRIMARY KEY AUTOINCREMENT, author INTEGER NOT NULL, token TEXT NOT NULL, entry REAL NOT NULL, target REAL NOT NULL, stop REAL NOT NULL, horizon TEXT NOT NULL, note TEXT NOT NULL, at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'live', closed_at INTEGER, closed_price REAL)");

// Reactions (one per person per call, same badges as trades) and comments on calls.
db.exec("CREATE TABLE IF NOT EXISTS signal_reactions (signal INTEGER NOT NULL, user INTEGER NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (signal, user))");
db.exec("CREATE TABLE IF NOT EXISTS signal_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, signal INTEGER NOT NULL, user INTEGER NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)");
export const signalExists = (id: number) => !!db.prepare("SELECT 1 FROM signals WHERE id = ?").get(id);
export const setSignalReaction = (signal: number, user: number, key: string | null) => {
  db.prepare("DELETE FROM signal_reactions WHERE signal = ? AND user = ?").run(signal, user);
  if (key) db.prepare("INSERT INTO signal_reactions (signal, user, emoji) VALUES (?, ?, ?)").run(signal, user, key);
};
export const signalReactionCounts = (signal: number, user?: number) =>
  db.prepare("SELECT emoji, COUNT(*) AS n, SUM(user = ?) AS mine FROM signal_reactions WHERE signal = ? GROUP BY emoji").all(user ?? -1, signal) as unknown as { emoji: string; n: number; mine: number }[];
export function addSignalComment(signal: number, user: number, text: string) {
  const t = text.trim();
  if (!t) throw new Error("Write something first");
  if (!signalExists(signal)) throw new Error("Signal not found");
  db.prepare("INSERT INTO signal_comments (signal, user, text, at) VALUES (?, ?, ?, ?)").run(signal, user, t.slice(0, 280), Date.now());
}
export const signalComments = (signal: number) =>
  db.prepare("SELECT c.id, c.user, c.text, c.at, u.handle FROM signal_comments c JOIN users u ON u.id = c.user WHERE c.signal = ? ORDER BY c.id").all(signal) as unknown as { id: number; user: number; text: string; at: number; handle: string }[];

export const HORIZONS ={ hours: { label: "Hours", ms: 12 * 3600e3 }, days: { label: "1–3 days", ms: 3 * 86400e3 }, week: { label: "This week", ms: 7 * 86400e3 } } as const;
export type Horizon = keyof typeof HORIZONS;
export type SignalStatus = "live" | "hit" | "stopped" | "expired";

export interface Signal {
  id: number; author: number; handle: string; token: string; symbol: string; entry: number; target: number; stop: number;
  horizon: Horizon; note: string; at: number; status: SignalStatus; closedAt: number | null;
  price: number; // the mark while live, the closing price once settled
  resultPct: number; // price vs entry
  progress: number; // 0 = at the stop, 100 = at the target
}

type Row = { id: number; author: number; token: string; entry: number; target: number; stop: number; horizon: string; note: string; at: number; status: string; closed_at: number | null; closed_price: number | null };

/** Post a call. The entry has to be near the market (within 10%), and the target above it with the stop below. */
export async function postSignal(author: number, b: { entry?: unknown; target?: unknown; stop?: unknown; horizon?: unknown; note?: unknown; token?: unknown }) {
  const token = TOKENS[String(b.token ?? "ETH").toUpperCase()];
  if (!token) throw new Error("Pick a token Tribe trades");
  const entry = Number(b.entry), target = Number(b.target), stop = Number(b.stop);
  if (![entry, target, stop].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Entry, target and stop need prices");
  if (!(target > entry && entry > stop)) throw new Error("A long needs the target above the entry and the stop below it");
  const mark = await getPrice(token);
  if (Math.abs(entry / mark - 1) > 0.1) throw new Error(`Entry has to be within 10% of the market ($${mark.toFixed(0)})`);
  const horizon = (b.horizon && String(b.horizon) in HORIZONS ? String(b.horizon) : "days") as Horizon;
  const note = String(b.note ?? "").trim();
  if (note.length < 3) throw new Error("Say why: a line on the setup");
  if (note.length > 280) throw new Error("Keep the why under 280 characters");
  const id = Number(db.prepare("INSERT INTO signals (author, token, entry, target, stop, horizon, note, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(author, token, entry, target, stop, horizon, note, Date.now()).lastInsertRowid);
  return { id, toast: "Signal posted. Your followers see it now.", redirect: "/signals?tab=mine" };
}

/** Score live calls against the market: target first is a hit, stop first is stopped, out of time is expired. Settled calls keep their result. */
export async function settleSignals() {
  for (const r of db.prepare("SELECT * FROM signals WHERE status = 'live'").all() as unknown as Row[]) {
    const mark = await getPrice(r.token).catch(() => null);
    if (mark === null) continue;
    const status = mark >= r.target ? "hit" : mark <= r.stop ? "stopped" : Date.now() - r.at > (HORIZONS[r.horizon as Horizon] ?? HORIZONS.days).ms ? "expired" : null;
    if (status) db.prepare("UPDATE signals SET status = ?, closed_at = ?, closed_price = ? WHERE id = ?").run(status, Date.now(), status === "hit" ? r.target : status === "stopped" ? r.stop : mark, r.id);
  }
}

async function toSignal(r: Row): Promise<Signal> {
  const price = r.closed_price ?? (await getPrice(r.token).catch(() => r.entry));
  return {
    id: r.id, author: r.author, handle: userById(r.author)?.handle ?? "?", token: r.token, symbol: symOf(r.token), entry: r.entry, target: r.target, stop: r.stop,
    horizon: (r.horizon in HORIZONS ? r.horizon : "days") as Horizon, note: r.note, at: r.at, status: r.status as SignalStatus, closedAt: r.closed_at,
    price, resultPct: (price / r.entry - 1) * 100, progress: Math.max(0, Math.min(100, ((price - r.stop) / (r.target - r.stop)) * 100)),
  };
}

/** Live calls (newest first), settled results (latest first), or one caller's calls. */
export async function signals(o: { status?: "live" | "closed"; author?: number; limit?: number } = {}): Promise<Signal[]> {
  await settleSignals();
  const where = [o.status === "live" ? "status = 'live'" : o.status === "closed" ? "status != 'live'" : "1", o.author !== undefined ? "author = ?" : "1"].join(" AND ");
  const rows = db.prepare(`SELECT * FROM signals WHERE ${where} ORDER BY COALESCE(closed_at, at) DESC LIMIT ?`).all(...(o.author !== undefined ? [o.author] : []), o.limit ?? 30) as unknown as Row[];
  return Promise.all(rows.map(toSignal));
}

/** One call, scored up to now (for its public share page). */
export async function signalById(id: number): Promise<Signal | undefined> {
  await settleSignals();
  const r = db.prepare("SELECT * FROM signals WHERE id = ?").get(id) as unknown as Row | undefined;
  return r ? toSignal(r) : undefined;
}

/** A caller's record: how many calls hit, got stopped or ran out of time. */
export function callerRecord(author: number) {
  const r = db.prepare("SELECT COUNT(*) AS calls, COALESCE(SUM(status = 'hit'), 0) AS hits, COALESCE(SUM(status = 'stopped'), 0) AS stopped, COALESCE(SUM(status = 'expired'), 0) AS expired, COALESCE(SUM(status = 'live'), 0) AS live FROM signals WHERE author = ?").get(author) as { calls: number; hits: number; stopped: number; expired: number; live: number };
  const closed = r.hits + r.stopped + r.expired;
  return { ...r, closed, hitRate: closed ? Math.round((r.hits / closed) * 100) : null };
}

/** Best callers: hit rate over settled calls, then most hits. */
export function topCallers(n = 5) {
  const ids = (db.prepare("SELECT DISTINCT author FROM signals").all() as unknown as { author: number }[]).map((r) => r.author);
  return ids.map((id) => ({ id, handle: userById(id)?.handle ?? "?", ...callerRecord(id) }))
    .filter((c) => c.closed >= 1)
    .sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0) || b.hits - a.hits)
    .slice(0, n);
}

/** Demo: a handful of calls from the seeded traders, some live and some already scored, so the page has a story. */
export async function seedDemoSignals() {
  if ((db.prepare("SELECT COUNT(*) AS n FROM signals").get() as { n: number }).n) return;
  const eth = TOKENS.ETH;
  const p = await getPrice(eth).catch(() => 2500);
  const H = 3600e3, D = 86400e3, now = Date.now();
  const calls: [string, number, number, number, Horizon, string, number, SignalStatus?][] = [
    ["nightowl", 0.996, 1.06, 0.972, "days", "Range low held three times on the 4h. Stop under the range, target the last high.", 40 * 60e3],
    ["traderx", 1.0, 1.035, 0.985, "hours", "Funding reset and spot bid came back. Quick scalp to the overnight high.", 2 * H],
    ["kestrel", 0.999, 1.09, 0.95, "week", "Weekly reclaim of the 20-week average. Patient swing, wide stop.", 5 * H],
    ["kestrel", 0.955, 0.99, 0.935, "days", "Bought the sweep of Monday's low.", 3 * D, "hit"],
    ["ember", 0.94, 0.975, 0.92, "days", "Accumulation range breakout, retest held.", 5 * D, "hit"],
    ["mav", 1.03, 1.08, 1.0, "days", "Breakout above the daily range.", 4 * D, "stopped"],
    ["nightowl", 0.93, 0.965, 0.91, "hours", "Overnight liquidation wick, bid the reclaim.", 6 * D, "hit"],
    ["mav", 0.97, 1.03, 0.94, "week", "Trend continuation off the weekly open.", 9 * D, "expired"],
  ];
  for (const [h, e, t, s, horizon, note, ago, status] of calls) {
    const u = userByHandle(h);
    if (!u) continue;
    const entry = Math.round(p * e), target = Math.round(p * t), stop = Math.round(p * s);
    const closed = status ? (status === "hit" ? target : status === "stopped" ? stop : Math.round(p * 0.985)) : null;
    db.prepare("INSERT INTO signals (author, token, entry, target, stop, horizon, note, at, status, closed_at, closed_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(u.id, eth, entry, target, stop, horizon, note, now - ago, status ?? "live", status ? now - ago + D : null, closed);
  }
}
