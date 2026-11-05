import { type TradeSource, commentCount, db, squadMembers, squadOf, followCount, getMeta, getUser, haltOf, reactionCounts, tradeById, userById, type User } from "./db.js";
import type { Trade } from "./flash.js";
import { TOKENS } from "./parse.js";
import { getPrice } from "./prices.js";
import { riskOf } from "./guard.js";
import { RISK_LINE } from "./rules.js";
import { isDry } from "./tracker.js";
import { drawdown, greenDays, positionsOf, totalPnl, traderStats } from "./stats.js";
import { createPublicClient, erc20Abi, http } from "viem";
import { base } from "viem/chains";
import { knownSymbol, priceStr } from "./tokens.js";

const SYMBOLS: Record<string, string> = {};
for (const [k, v] of Object.entries(TOKENS)) SYMBOLS[v.toLowerCase()] ??= k === "WETH" ? "ETH" : k;
export const symOf = (addr: string) => SYMBOLS[addr.toLowerCase()] ?? knownSymbol(addr) ?? addr.slice(0, 6);

export const initials = (handle: string) => handle.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "??";
/** What goes inside an avatar circle: the user's profile photo if they set one, else their initials (only [A-Z0-9], safe as HTML). */
export const face = (handle: string) => {
  const u = db.prepare("SELECT id, photo_at FROM users WHERE handle = ? COLLATE NOCASE").get(handle) as { id: number; photo_at: number } | undefined;
  return u?.photo_at ? `<img src="/avatar/${u.id}?v=${u.photo_at}" alt="" loading="lazy">` : initials(handle);
};
export const money = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pct = (n: number, d = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}%`;
export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
}

export const ORDER_LABEL: Record<string, string> = {
  market: "Market", limit: "Limit", twap: "TWAP", "stop-loss": "Stop-loss", "take-profit": "Take profit", bracket: "Bracket", stop: "Stop",
};

export interface TradeCard {
  id: number; leader: number; handle: string; level: number; persona: string | null; at: number; trade: Trade; symbol: string;
  entry: number | null; sincePct: number | null; guard: "passed" | "paused"; risk: number; copiers: number; reactions: number; comments: number;
  detail: string; orderLabel: string; hasStop: boolean; viewerCopying: boolean;
  botId: number | null; botName: string | null; // the creator bot that placed it, if any
  source: TradeSource; note: string | null; // bot = the user's bot (CRE strategy), agent = their AI agent over MCP; both are tagged Bot
  tx: string | null; // settlement transaction of the trader's own Flash order
  mark: number | null; stopPrice: number | null; targetPrice: number | null; // the price ladder on open longs
  realisedPct: number | null; // a closing sell's realised result on what was sold
  copierHandles: string[]; streak: number; // social proof and the trader's green-day streak
}

/** Token amounts for people: 0.0039972 -> "0.0040". */
/** A price as people read it: $2,790.60. */
const usdFmt = (p: string | number) => { const n = Number(p); return n > 0 && n < 1 ? `$${priceStr(n).replace(/0+$/, "").replace(/\.$/, "")}` : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };

/**
 * The Flash order a trade placed, in plain words: what kind, how much, at what price or trigger, and the attached
 * take-profit / stop-loss. One phrase per part, e.g. ["Market buy $200 now", "Take-profit $2,790.60", "Stop-loss $2,367.03"].
 */
export function orderSteps(t: Trade): string[] {
  const sym = symOf(t.target);
  const amount = t.side === "buy" ? `$${Number(t.qty).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `${qtyFmt(t.qty)} ${sym}`;
  const trig = (k: "upper" | "lower") => t.triggers?.find((x) => x.triggerType === k)?.notionalPrice;
  const until = t.expireTime ? `Good until ${new Date(t.expireTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "";
  const legs = t.attach ? [`Take-profit ${usdFmt(t.attach.tp)}`, `Stop-loss ${usdFmt(t.attach.sl)}`] : [];
  const verb = t.side === "buy" ? "buy" : "sell";
  const main =
    t.orderType === "market" ? `Market ${verb} ${amount} now`
    : t.orderType === "limit" ? `Limit ${verb} ${amount} at ${usdFmt(t.limitNotionalPrice ?? 0)} or ${t.side === "buy" ? "lower" : "higher"}`
    : t.orderType === "stop" ? `Breakout ${verb} ${amount} once ${sym} rises to ${usdFmt(trig("upper") ?? trig("lower") ?? 0)}`
    : t.orderType === "twap" ? `TWAP ${verb} ${amount} in ${t.twapBucketCount ?? "several"} slices over ${Math.round((t.durationSeconds ?? 0) / 60)} min`
    : t.orderType === "stop-loss" ? `Sells ${amount} if it falls to ${usdFmt(trig("lower") ?? 0)}`
    : t.orderType === "take-profit" ? `Sells ${amount} if it rises to ${usdFmt(trig("upper") ?? 0)}`
    : t.orderType === "bracket" ? `Sells ${amount} at ${usdFmt(trig("upper") ?? 0)} or ${usdFmt(trig("lower") ?? 0)}, whichever comes first`
    : `${verb} ${amount}`;
  return [main, ...legs, until].filter(Boolean);
}

export const qtyFmt = (q: string | number) => {
  const n = Number(q);
  return !Number.isFinite(n) ? String(q) : n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toPrecision(2);
};

export async function tradeCard(id: number, viewer?: number): Promise<TradeCard | undefined> {
  const t = tradeById(id);
  if (!t) return undefined;
  const s = await traderStats(t.leader);
  const u = userById(t.leader)!;
  const own = db.prepare("SELECT price, tx, pnl, usd, status FROM orders WHERE trade_id = ? AND trader = ? AND role = 'own' ORDER BY id LIMIT 1").get(id, t.leader) as { price: number | null; tx: string | null; pnl: number | null; usd: number | null; status: string } | undefined;
  const entry = own?.price ?? null;
  const mark = entry && t.trade.side === "buy" ? await getPrice(t.trade.target).catch(() => entry) : null;
  const copiers = (db.prepare("SELECT COUNT(*) AS n FROM copies WHERE trade_id = ? AND status IN ('executed','dry-run')").get(id) as { n: number }).n;
  const trade = t.trade as Trade;
  const trig = trade.triggers ?? [];
  const up = trig.find((x) => x.triggerType === "upper")?.notionalPrice ?? trade.attach?.tp;
  const lo = trig.find((x) => x.triggerType === "lower")?.notionalPrice ?? trade.attach?.sl;
  const sym = symOf(trade.target);
  const legs = `${lo ? ` · Stop $${lo}` : ""}${up ? ` · Target $${up}` : ""}`;
  const detail = orderSteps(trade).join(" · ");
  const reactions = reactionCounts(id).reduce((a, r) => a + r.n, 0);
  const sold = trade.side === "sell" && own?.status === "filled" && own.usd && own.pnl !== null ? own : undefined;
  const copierHandles = (db.prepare("SELECT u.handle FROM copies c JOIN users u ON u.id = c.follower WHERE c.trade_id = ? AND c.status IN ('executed','dry-run') ORDER BY c.id LIMIT 3").all(id) as unknown as { handle: string }[]).map((r) => r.handle);
  return {
    id, leader: t.leader, handle: u.handle, level: s.level, persona: u.persona, at: t.at, trade, symbol: sym,
    entry, sincePct: entry && mark ? (mark / entry - 1) * 100 : null,
    guard: haltOf(t.leader) ? "paused" : "passed", risk: await riskOf(t.leader), copiers, reactions, comments: commentCount(id), detail,
    orderLabel: `Flash ${trade.attach ? "Bracket" : ORDER_LABEL[trade.orderType] ?? trade.orderType}`,
    hasStop: !!trade.hasStop || !!trade.attach || ["bracket", "stop-loss"].includes(trade.orderType),
    source: t.source === "cre" || t.source === "bot" ? "bot" : t.source === "agent" ? "agent" : "user", note: t.note ?? null, tx: own?.tx ?? null,
    mark, stopPrice: lo ? Number(lo) : null, targetPrice: up ? Number(up) : null,
    realisedPct: sold ? (sold.pnl! / Math.max(1e-9, sold.usd! - sold.pnl!)) * 100 : null,
    copierHandles, streak: greenDays(t.leader),
    viewerCopying: viewer !== undefined && !!db.prepare("SELECT 1 FROM follows WHERE follower = ? AND leader = ?").get(viewer, t.leader),
    botId: t.bot_id ?? null,
    botName: t.bot_id ? (db.prepare("SELECT name FROM bots WHERE id = ?").get(t.bot_id) as { name: string } | undefined)?.name ?? null : null,
  };
}

export interface FeedFilter { tab?: string; time?: string; coins?: string[]; types?: string[]; guard?: string; stop?: boolean; copyable?: boolean }
const WINDOW: Record<string, number> = { "1h": 3600e3, "24h": 86400e3, "7d": 7 * 86400e3, "30d": 30 * 86400e3 };

export async function feed(viewer: number | undefined, f: FeedFilter, limit = 30): Promise<TradeCard[]> {
  const since = Date.now() - (WINDOW[f.time ?? "7d"] ?? WINDOW["7d"]);
  const rows = db.prepare("SELECT id FROM trades WHERE at >= ? AND private = 0 ORDER BY id DESC LIMIT 200").all(since) as unknown as { id: number }[];
  const following = new Set(viewer === undefined ? [] : (db.prepare("SELECT leader FROM follows WHERE follower = ? UNION SELECT leader FROM watches WHERE follower = ?").all(viewer, viewer) as unknown as { leader: number }[]).map((r) => r.leader));
  const sq = viewer === undefined ? undefined : squadOf(viewer);
  const mates = new Set(sq ? squadMembers(sq.id) : []);
  const out: TradeCard[] = [];
  for (const r of rows) {
    const c = await tradeCard(r.id, viewer);
    if (!c) continue;
    if (f.tab === "Following" && !following.has(c.leader)) continue;
    if (f.tab === "Guarded" && c.guard !== "paused") continue;
    if (f.tab === "Squad" && !mates.has(c.leader)) continue;
    if (f.coins?.length && !f.coins.includes(c.symbol)) continue;
    if (f.types?.length && !f.types.includes(c.trade.attach ? "Bracket" : ORDER_LABEL[c.trade.orderType])) continue;
    if (f.guard === "Passed only" && c.guard !== "passed") continue;
    if (f.guard === "Paused" && c.guard !== "paused") continue;
    if (f.stop && !c.hasStop) continue;
    if (f.copyable && c.guard === "paused") continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

// Portfolio

const symbolsHeld = (u: number) => positionsOf(u).filter((p) => p.qty > 1e-12);

/** USDC on Base in the user's wallet. Throws when the chain can't be read, so callers can tell "empty" from "unknown". */
export async function usdcBalance(user: number): Promise<number> {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC) });
  const raw = await client.readContract({ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", abi: erc20Abi, functionName: "balanceOf", args: [getUser(user).address] });
  return Number(raw) / 1e6;
}

export async function freeBalance(user: number): Promise<number> {
  if (isDry()) return getMeta(user).simBalance;
  return usdcBalance(user).catch(() => 0);
}

export async function portfolio(user: number) {
  let inCopies = 0;
  for (const p of symbolsHeld(user)) inCopies += p.qty * (await getPrice(p.token).catch(() => p.cost / p.qty));
  const free = await freeBalance(user);
  const pnl = await totalPnl(user);
  const startOfDay = new Date().setUTCHours(0, 0, 0, 0);
  const before = db.prepare("SELECT pnl_pct FROM snapshots WHERE trader = ? AND at < ? ORDER BY at DESC LIMIT 1").get(user, startOfDay) as { pnl_pct: number } | undefined;
  const todayUsd = ((pnl.pct - (before?.pnl_pct ?? 0)) / 100) * pnl.invested;
  return { free, inCopies, total: free + inCopies, allUsd: pnl.usd, allPct: pnl.pct, todayUsd, todayPct: pnl.invested ? (todayUsd / pnl.invested) * 100 : 0 };
}

export interface Position {
  token: string; symbol: string; qty: number; entry: number; mark: number; value: number; pnlPct: number; pnlUsd: number;
  stopPct: number | null; tpPct: number | null; orderId: number | null; from: string; type: string; sizeUsd: number; fromLeader: number; fromHalted: boolean;
}

export async function openPositions(user: number): Promise<Position[]> {
  const out: Position[] = [];
  for (const p of symbolsHeld(user)) {
    const mark = await getPrice(p.token).catch(() => p.cost / p.qty);
    const entry = p.cost / p.qty;
    const prot = db.prepare("SELECT id, trade, leader FROM orders WHERE trader = ? AND status = 'open' AND json_extract(trade, '$.target') = ? AND json_extract(trade, '$.orderType') IN ('bracket','stop-loss','take-profit') ORDER BY id DESC LIMIT 1").get(user, p.token) as { id: number; trade: string } | undefined;
    const trig = prot ? ((JSON.parse(prot.trade) as Trade).triggers ?? []) : [];
    const lo = trig.find((t) => t.triggerType === "lower");
    const up = trig.find((t) => t.triggerType === "upper");
    const src = db.prepare("SELECT leader, trade, role FROM orders WHERE trader = ? AND status = 'filled' AND json_extract(trade, '$.target') = ? AND json_extract(trade, '$.side') = 'buy' ORDER BY id DESC LIMIT 1").get(user, p.token) as { leader: number; trade: string; role: string } | undefined;
    const leaderUser = src ? userById(src.leader) : undefined;
    out.push({
      token: p.token, symbol: symOf(p.token), qty: p.qty, entry, mark, value: p.qty * mark, pnlPct: (mark / entry - 1) * 100, pnlUsd: p.qty * mark - p.cost,
      stopPct: lo ? (1 - Number(lo.notionalPrice) / entry) * 100 : null, tpPct: up ? (Number(up.notionalPrice) / entry - 1) * 100 : null,
      orderId: prot?.id ?? null, from: src && src.role === "copy" ? leaderUser?.handle ?? "?" : "you", type: src ? ORDER_LABEL[(JSON.parse(src.trade) as Trade).orderType] ?? "Market" : "Market",
      sizeUsd: p.cost, fromLeader: src?.leader ?? user, fromHalted: !!(src && src.role === "copy" && haltOf(src.leader)),
    });
  }
  return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function closedPositions(user: number, limit = 20) {
  return (db.prepare("SELECT id, trade, price, tokens, usd, pnl, filled_at, role, leader FROM orders WHERE trader = ? AND status = 'filled' AND json_extract(trade, '$.side') = 'sell' ORDER BY id DESC LIMIT ?").all(user, limit) as any[]).map((r) => ({
    id: r.id, symbol: symOf((JSON.parse(r.trade) as Trade).target), pnlUsd: r.pnl as number, usd: r.usd as number, at: r.filled_at as number,
    from: r.role === "copy" ? userById(r.leader)?.handle ?? "?" : "you",
  }));
}

/** Copy PnL per followed trader: sum over filled copy buys marked to market. */
export async function copyPnlByLeader(follower: number): Promise<Map<number, { pnl: number; copied: number }>> {
  const rows = db.prepare("SELECT leader, trade, tokens, usd FROM orders WHERE trader = ? AND role = 'copy' AND status = 'filled' AND json_extract(trade, '$.side') = 'buy'").all(follower) as unknown as { leader: number; trade: string; tokens: number; usd: number }[];
  const m = new Map<number, { pnl: number; copied: number }>();
  for (const r of rows) {
    const mark = await getPrice((JSON.parse(r.trade) as Trade).target).catch(() => r.usd / r.tokens);
    const cur = m.get(r.leader) ?? { pnl: 0, copied: 0 };
    cur.pnl += r.tokens * mark - r.usd;
    cur.copied += r.usd;
    m.set(r.leader, cur);
  }
  const sells = db.prepare("SELECT leader, COALESCE(SUM(pnl), 0) AS p FROM orders WHERE trader = ? AND role = 'copy' AND status = 'filled' AND json_extract(trade, '$.side') = 'sell' GROUP BY leader").all(follower) as unknown as { leader: number; p: number }[];
  for (const s of sells) {
    const cur = m.get(s.leader) ?? { pnl: 0, copied: 0 };
    // Realised sell PnL replaces the mark-to-market of the part already sold, so no double count of the sold quantity.
    cur.pnl += s.p;
    m.set(s.leader, cur);
  }
  return m;
}

// Profile stats

export async function profile(id: number) {
  const s = await traderStats(id);
  const u = userById(id)!;
  const sells = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(pnl > 0), 0) AS w FROM orders WHERE trader = ? AND status = 'filled' AND json_extract(trade, '$.side') = 'sell'").get(id) as { n: number; w: number };
  const first = (db.prepare("SELECT MIN(at) AS t FROM trades WHERE leader = ?").get(id) as { t: number | null }).t;
  const curve = (db.prepare("SELECT pnl_pct FROM snapshots WHERE trader = ? ORDER BY at").all(id) as unknown as { pnl_pct: number }[]).map((r) => r.pnl_pct);
  const slip = db.prepare("SELECT COUNT(*) AS n FROM copies WHERE leader = ? AND status IN ('executed','dry-run')").get(id) as { n: number };
  const guardPauses = (db.prepare("SELECT COUNT(*) AS n FROM guard_events WHERE leader = ? AND kind = 'halt'").get(id) as { n: number }).n;
  return {
    ...s, user: u, winRate: sells.n ? Math.round((sells.w / sells.n) * 100) : null, closed: sells.n,
    days: first ? Math.max(1, Math.ceil((Date.now() - first) / 86400e3)) : 0, curve,
    maxDd: drawdown(id, 24 * 365), guardPauses, copies: slip.n, risk: await riskOf(id), halted: haltOf(id),
  };
}

export interface SideRecord { trades: number; closed: number; wins: number; pnlPct: number | null }
/**
 * One trader's record split by who placed the entry: Manual (the user) or Bot (their CRE bot or their AI agent).
 * Exits count toward the entry they close, including stop and target fills.
 */
export function sourceSplit(leader: number): { manual: SideRecord; bot: SideRecord } {
  const kind = "CASE WHEN t.source IN ('bot','cre','agent') THEN 'bot' ELSE 'manual' END";
  const out = { manual: { trades: 0, closed: 0, wins: 0, pnlPct: null }, bot: { trades: 0, closed: 0, wins: 0, pnlPct: null } } as { manual: SideRecord; bot: SideRecord };
  for (const r of db.prepare(`SELECT ${kind} AS k, COUNT(*) AS n FROM trades t WHERE t.leader = ? AND json_extract(t.trade,'$.side') = 'buy' GROUP BY k`).all(leader) as unknown as { k: "manual" | "bot"; n: number }[]) out[r.k].trades = r.n;
  const closed = db.prepare(`SELECT ${kind} AS k, COUNT(*) AS n, SUM(o.pnl > 0) AS w, SUM(o.pnl) AS p, SUM(o.usd - o.pnl) AS c FROM orders o JOIN trades t ON t.id = o.trade_id WHERE o.trader = ? AND o.role = 'own' AND o.status = 'filled' AND json_extract(o.trade,'$.side') = 'sell' AND o.pnl IS NOT NULL GROUP BY k`).all(leader) as unknown as { k: "manual" | "bot"; n: number; w: number; p: number; c: number }[];
  for (const r of closed) Object.assign(out[r.k], { closed: r.n, wins: r.w, pnlPct: r.c > 0 ? (r.p / r.c) * 100 : null });
  return out;
}

export interface MonthRow { key: string; label: string; pnlUsd: number; investedUsd: number; pct: number; closed: number; wins: number; trades: { at: number; symbol: string; pnlUsd: number; pct: number; source: TradeSource; from: string | null }[] }
/**
 * What a trader made, month by month: realised PnL from closed trades (their own and their copies), money put in,
 * and each closed trade with who placed it. Newest month first.
 */
export function monthlyHistory(trader: number, months = 12): MonthRow[] {
  const since = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1);
  const rows = db.prepare(`SELECT o.filled_at AS at, o.trade, o.pnl, o.usd, o.role, o.leader, t.source FROM orders o LEFT JOIN trades t ON t.id = o.trade_id WHERE o.trader = ? AND o.status = 'filled' AND o.filled_at >= ? ORDER BY o.filled_at DESC`).all(trader, since) as unknown as { at: number; trade: string; pnl: number | null; usd: number | null; role: string; leader: number; source: string | null }[];
  const by = new Map<string, MonthRow>();
  for (const r of rows) {
    const d = new Date(r.at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const m = by.get(key) ?? { key, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), pnlUsd: 0, investedUsd: 0, pct: 0, closed: 0, wins: 0, trades: [] };
    const t = JSON.parse(r.trade) as Trade;
    if (t.side === "buy") m.investedUsd += r.usd ?? 0;
    else if (r.pnl !== null && r.usd) {
      m.pnlUsd += r.pnl;
      m.closed++;
      if (r.pnl > 0) m.wins++;
      const src: TradeSource = r.source === "bot" || r.source === "cre" ? "bot" : r.source === "agent" ? "agent" : "user";
      m.trades.push({ at: r.at, symbol: symOf(t.target), pnlUsd: r.pnl, pct: (r.pnl / Math.max(1e-9, r.usd - r.pnl)) * 100, source: src, from: r.role === "copy" ? userById(r.leader)?.handle ?? null : null });
    }
    by.set(key, m);
  }
  return [...by.values()].map((m) => ({ ...m, pct: m.investedUsd ? (m.pnlUsd / m.investedUsd) * 100 : 0 }));
}

/**
 * A trader's live book: positions they still hold and orders still resting (limits, stops), each tied to the trade
 * that opened it so someone can copy it with Flash.
 */
export async function liveBook(trader: number) {
  const pos = await openPositions(trader);
  const held = pos.map((p) => {
    const entry = db.prepare("SELECT t.id FROM trades t JOIN orders o ON o.trade_id = t.id AND o.trader = t.leader AND o.role = 'own' WHERE t.private = 0 AND t.leader = ? AND json_extract(t.trade,'$.target') = ? AND json_extract(t.trade,'$.side') = 'buy' AND o.status = 'filled' ORDER BY t.id DESC LIMIT 1").get(trader, p.token) as { id: number } | undefined;
    return { ...p, tradeId: entry?.id ?? null };
  });
  const resting = (db.prepare("SELECT o.trade_id, o.trade, o.placed_at FROM orders o WHERE o.trader = ? AND o.role = 'own' AND o.status = 'open' AND json_extract(o.trade,'$.side') = 'buy'").all(trader) as unknown as { trade_id: number; trade: string; placed_at: number }[])
    .map((r) => { const t = JSON.parse(r.trade) as Trade; return { tradeId: r.trade_id, at: r.placed_at, symbol: symOf(t.target), label: ORDER_LABEL[t.orderType] ?? t.orderType, price: t.limitNotionalPrice ?? t.triggers?.[0]?.notionalPrice ?? null, usd: Number(t.qty) || 0 }; });
  return { held, resting };
}

export interface ActiveTrade {
  kind: "held" | "resting"; tradeId: number; symbol: string; from: string; at: number; label: string;
  usd: number; entry: number | null; mark: number | null; pnlPct: number | null; pnlUsd: number | null;
  stopPrice: number | null; targetPrice: number | null; limit: number | null;
}
/**
 * Every trade of yours that is still live, one per entry rather than merged per token: filled buys you still hold
 * (sells take the oldest first, so what's left sits in the newest buys) and buy orders still waiting to fill.
 */
export async function activeTrades(user: number): Promise<ActiveTrade[]> {
  const out: ActiveTrade[] = [];
  const buys = db.prepare("SELECT id, trade_id, trade, role, leader, tokens, usd, price, filled_at FROM orders WHERE trader = ? AND status = 'filled' AND json_extract(trade,'$.side') = 'buy' AND tokens > 0 ORDER BY filled_at DESC, id DESC").all(user) as unknown as { id: number; trade_id: number; trade: string; role: string; leader: number; tokens: number; usd: number; price: number | null; filled_at: number }[];
  const left = new Map(symbolsHeld(user).map((p) => [p.token.toLowerCase(), p.qty]));
  for (const b of buys) {
    const t = JSON.parse(b.trade) as Trade;
    const key = t.target.toLowerCase();
    const qty = Math.min(b.tokens, left.get(key) ?? 0);
    if (qty <= 1e-12) continue;
    left.set(key, (left.get(key) ?? 0) - qty);
    const entry = b.price ?? b.usd / b.tokens;
    const mark = await getPrice(t.target).catch(() => entry);
    const prot = db.prepare("SELECT trade FROM orders WHERE trader = ? AND trade_id = ? AND status = 'open' AND json_extract(trade,'$.side') = 'sell' ORDER BY id DESC LIMIT 1").get(user, b.trade_id) as { trade: string } | undefined;
    const trig = prot ? ((JSON.parse(prot.trade) as Trade).triggers ?? []) : [];
    const lo = trig.find((x) => x.triggerType === "lower")?.notionalPrice ?? t.attach?.sl;
    const up = trig.find((x) => x.triggerType === "upper")?.notionalPrice ?? t.attach?.tp;
    const cost = (b.usd * qty) / b.tokens;
    out.push({
      kind: "held", tradeId: b.trade_id, symbol: symOf(t.target), from: b.role === "copy" ? userById(b.leader)?.handle ?? "?" : "you", at: b.filled_at,
      label: t.attach || prot ? "Bracket" : ORDER_LABEL[t.orderType] ?? "Market", usd: cost, entry, mark, pnlPct: (mark / entry - 1) * 100, pnlUsd: qty * mark - cost,
      stopPrice: lo ? Number(lo) : null, targetPrice: up ? Number(up) : null, limit: null,
    });
  }
  for (const r of db.prepare("SELECT trade_id, trade, role, leader, placed_at FROM orders WHERE trader = ? AND status = 'open' AND json_extract(trade,'$.side') = 'buy' ORDER BY id DESC").all(user) as unknown as { trade_id: number; trade: string; role: string; leader: number; placed_at: number }[]) {
    const t = JSON.parse(r.trade) as Trade;
    const lim = t.limitNotionalPrice ?? t.triggers?.[0]?.notionalPrice;
    out.push({
      kind: "resting", tradeId: r.trade_id, symbol: symOf(t.target), from: r.role === "copy" ? userById(r.leader)?.handle ?? "?" : "you", at: r.placed_at,
      label: ORDER_LABEL[t.orderType] ?? t.orderType, usd: Number(t.qty) || 0, entry: null, mark: null, pnlPct: null, pnlUsd: null,
      stopPrice: t.attach?.sl ? Number(t.attach.sl) : null, targetPrice: t.attach?.tp ? Number(t.attach.tp) : null, limit: lim ? Number(lim) : null,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

export type SocialKind = "copying" | "following" | "network" | "trending" | "suggested";
export interface Social { kind: SocialKind; text: string; faces: string[]; score: number }

/**
 * Why a trade is in your feed, X / LinkedIn style: you copy or follow the trader, people you follow follow them (named)
 * or copy them (a count: who copies whom stays private), or they're trending. `score` ranks the For you deck.
 */
export function socialGraph(viewer: number) {
  const copying = new Set((db.prepare("SELECT leader FROM follows WHERE follower = ?").all(viewer) as unknown as { leader: number }[]).map((r) => r.leader));
  const watching = new Set((db.prepare("SELECT leader FROM watches WHERE follower = ?").all(viewer) as unknown as { leader: number }[]).map((r) => r.leader));
  const network = [...new Set([...copying, ...watching])].filter((id) => id !== viewer);
  const links = new Map<number, { follows: Set<number>; copies: Set<number> }>();
  const link = (leader: number) => links.get(leader) ?? (links.set(leader, { follows: new Set(), copies: new Set() }), links.get(leader)!);
  if (network.length) {
    const ph = network.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT follower, leader FROM watches WHERE follower IN (${ph})`).all(...network) as unknown as { follower: number; leader: number }[]) link(r.leader).follows.add(r.follower);
    for (const r of db.prepare(`SELECT follower, leader FROM follows WHERE follower IN (${ph})`).all(...network) as unknown as { follower: number; leader: number }[]) link(r.leader).copies.add(r.follower);
  }
  const hot = new Map(topTraders(7, 3).filter((t) => t.pct > 0).map((t, i) => [t.id, i + 1]));
  const name = (id: number) => userById(id)?.handle ?? "?";
  const why = (leader: number, copiers = 0): Social => {
    const h = name(leader);
    if (copying.has(leader)) return { kind: "copying", text: `You copy @${h}`, faces: [], score: 100 };
    if (watching.has(leader)) return { kind: "following", text: `You follow @${h}`, faces: [], score: 90 };
    const l = links.get(leader);
    const fol = l ? [...l.follows].filter((id) => id !== viewer && id !== leader) : [];
    const cop = l ? [...l.copies].filter((id) => id !== viewer && id !== leader).length : 0;
    if (fol.length || cop) {
      const names = fol.slice(0, 2).map((id) => `@${name(id)}`);
      const more = fol.length - names.length;
      const followed = fol.length ? `Followed by ${names.join(fol.length === 2 && !more ? " and " : ", ")}${more ? ` and ${more} other${more === 1 ? "" : "s"} you follow` : ""}` : "";
      const copied = cop ? `${followed ? "copied" : "Copied"} by ${cop} ${cop === 1 ? "person" : "people"} you follow` : "";
      return { kind: "network", text: [followed, copied].filter(Boolean).join(" · "), faces: fol.slice(0, 3).map(name), score: 60 + 6 * fol.length + 8 * cop };
    }
    if (hot.has(leader)) return { kind: "trending", text: `Trending · #${hot.get(leader)} this week`, faces: [], score: 50 };
    if (copiers >= 2) return { kind: "trending", text: `Trending · copied by ${copiers} people`, faces: [], score: 40 + copiers };
    return { kind: "suggested", text: "Suggested for you", faces: [], score: 10 };
  };
  /** Top three this week by realised P&L, whatever your relation to them. */
  return Object.assign(why, { isHot: (leader: number) => hot.has(leader) });
}

// Seasons: calendar months; Season 1 = Aug 2026 so Oct 2026 is Season 3.
export const seasonOf = (t: number) => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth() - (2026 * 12 + 7) + 1; };
export const seasonRange = (n: number) => {
  const m = n - 1 + 2026 * 12 + 7;
  return { start: Date.UTC(Math.floor(m / 12), m % 12, 1), end: Date.UTC(Math.floor((m + 1) / 12), (m + 1) % 12, 1) };
};

/** Realised PnL% in a window: sum(sell pnl) / sum(buy usd). Used for Week/Month/Season rankings. */
export function windowPnl(trader: number, from: number, to = Date.now()) {
  const r = db.prepare("SELECT COALESCE(SUM(CASE WHEN json_extract(trade,'$.side')='sell' THEN pnl END), 0) AS pnl, COALESCE(SUM(CASE WHEN json_extract(trade,'$.side')='buy' THEN usd END), 0) AS inv, COUNT(*) AS n FROM orders WHERE trader = ? AND status = 'filled' AND filled_at >= ? AND filled_at < ?").get(trader, from, to) as { pnl: number; inv: number; n: number };
  return { pnlUsd: r.pnl, pct: r.inv ? (r.pnl / r.inv) * 100 : 0, n: r.n };
}

/** Traders ranked by realised PnL% over the last `days` (the rail's "Top this week", the public /top page and its image). */
export function topTraders(days: number, n: number) {
  const ids = (db.prepare("SELECT DISTINCT leader AS id FROM trades").all() as unknown as { id: number }[]).map((r) => r.id);
  const since = Date.now() - days * 86400e3;
  return ids
    .map((id) => ({ id, handle: userById(id)?.handle ?? String(id), persona: userById(id)?.persona ?? null, ...windowPnl(id, since) }))
    .sort((a, b) => b.pct - a.pct || b.n - a.n)
    .slice(0, n);
}

/** Everyone with a filled order in a season, ranked on realised PnL%. */
export function seasonRanked(n: number) {
  const { start, end } = seasonRange(n);
  const ids = (db.prepare("SELECT DISTINCT trader AS id FROM orders WHERE role IN ('own','copy') AND status = 'filled' AND filled_at >= ? AND filled_at < ?").all(start, end) as unknown as { id: number }[]).map((r) => r.id);
  return ids.map((id) => ({ id, ...windowPnl(id, start, end) })).sort((a, b) => b.pct - a.pct);
}

export const rankMin = () => (process.env.DEMO === "true" ? { days: 0, trades: 0 } : { days: Number(process.env.RANK_MIN_DAYS ?? 14), trades: Number(process.env.RANK_MIN_TRADES ?? 10) });

export { RISK_LINE, followCount, type User };
