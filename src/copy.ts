import type { Trade } from "./flash.js";
import { type TradeSource, createPending, followersOf, getMeta, getUser, haltOf, recordCopy, recordTrade, spentToday, tradeById } from "./db.js";
import { decide, RISK_LINE } from "./rules.js";
import { heldTokens, placeAndTrack } from "./tracker.js";
import { getPrice } from "./prices.js";
import { guardGate, riskOf, type GuardGate } from "./guard.js";
import { db } from "./db.js";

/** USD of open position cost that came from copying this leader (buys minus sold cost). */
export function openCostFrom(follower: number, leader: number): number {
  const r = db.prepare("SELECT COALESCE(SUM(CASE WHEN json_extract(trade,'$.side')='buy' THEN usd ELSE -usd END), 0) AS s FROM orders WHERE trader = ? AND leader = ? AND role = 'copy' AND status = 'filled'").get(follower, leader) as { s: number };
  return Math.max(0, r.s);
}

export interface PendingNotice { pendingId: number; follower: number; trade: Trade; tradeId: number }
export interface MirrorResult { tradeId: number; own: string; executed: string[]; skipped: string[]; pending: PendingNotice[]; guard?: GuardGate }

/** Execute one sized copy for a follower with their own key. Records the outcome. */
export async function execute(tradeId: number, follower: number, leader: number, trade: Trade): Promise<string> {
  const usd = trade.side === "buy" ? Number(trade.qty) : 0;
  try {
    const chased = await chaseGuard(tradeId, leader, follower, trade);
    const p = await placeAndTrack(tradeId, follower, leader, "copy", chased.trade);
    recordCopy({ tradeId, follower, leader, usd, status: p.sim ? "dry-run" : "executed", orderId: p.orderId, note: chased.note });
    return `${p.sim ? "[sim] " : ""}order ${p.orderId}`;
  } catch (e) {
    const note = (e as Error).message;
    recordCopy({ tradeId, follower, leader, usd, status: "failed", note });
    return `failed: ${note}`;
  }
}

/**
 * Chase limit: if the price has already run more than the follower's limit past the leader's fill, don't buy at
 * market. Place a Flash limit order at the leader's price plus the limit instead, good for 30 minutes (expireTime),
 * so the copy fills at a fair price or not at all. The attached bracket rides along (Flash allows it on limit entries).
 */
export async function chaseGuard(tradeId: number, leader: number, follower: number, trade: Trade): Promise<{ trade: Trade; note?: string }> {
  if (trade.side !== "buy" || trade.orderType !== "market") return { trade };
  const chase = getMeta(follower).defaults.chase;
  if (!(chase > 0)) return { trade };
  const entry = (db.prepare("SELECT price FROM orders WHERE trade_id = ? AND trader = ? AND role = 'own' AND price IS NOT NULL").get(tradeId, leader) as { price: number } | undefined)?.price;
  if (!entry) return { trade }; // the leader's own order hasn't filled yet: nothing to chase
  const mark = await getPrice(trade.target).catch(() => entry);
  const ceiling = entry * (1 + chase / 100);
  if (mark <= ceiling) return { trade };
  return {
    trade: { ...trade, orderType: "limit", limitNotionalPrice: ceiling.toFixed(2), expireTime: new Date(Date.now() + 30 * 60_000).toISOString() },
    note: `Limit at $${ceiling.toFixed(2)}: price was ${(((mark / entry) - 1) * 100).toFixed(1)}% above their entry (your chase limit is ${chase}%)`,
  };
}

/** Tokens a follower holds because of this leader: copied buys minus copied sells, never more than they hold. */
export function copiedTokens(follower: number, leader: number, token: string): number {
  const r = db.prepare("SELECT COALESCE(SUM(CASE WHEN json_extract(trade,'$.side')='buy' THEN tokens ELSE -tokens END), 0) AS t FROM orders WHERE trader = ? AND leader = ? AND role = 'copy' AND tokens IS NOT NULL AND json_extract(trade,'$.target') = ?").get(follower, leader, token) as { t: number };
  return Math.max(0, Math.min(r.t, heldTokens(follower, token)));
}

/** How long a trade stays copyable from the deck. */
export const FRESH_MS = 86400e3;

/**
 * Swipe right: copy one trade now, from the viewer's wallet, at a size they pick. The same guards as auto-copy apply:
 * CopyGuard (onchain when deployed), the viewer's max per trade, daily cap, stop-loss rule and free balance.
 */
export async function copyOne(viewer: number, tradeId: number, usd: number): Promise<{ handle: string; usd: number; receipt: string }> {
  const t = tradeById(tradeId);
  if (!t) throw new Error("Trade not found");
  const trade = t.trade as Trade;
  if (t.leader === viewer) throw new Error("That's your own trade");
  if (trade.side !== "buy") throw new Error("Only entries can be copied");
  // Copyable while it's fresh, or for as long as the trader still holds it (their live book) or it's still resting.
  const live = heldTokens(t.leader, trade.target) > 1e-12 || !!db.prepare("SELECT 1 FROM orders WHERE trade_id = ? AND role = 'own' AND status = 'open'").get(tradeId);
  if (Date.now() - t.at > FRESH_MS && !live) throw new Error("This trade is closed: the trader no longer holds it");
  if (trade.attach) {
    const mark = await getPrice(trade.target).catch(() => 0);
    if (mark && mark >= Number(trade.attach.tp)) throw new Error("The price is already past their target, so there's nothing left to copy");
    if (mark && mark <= Number(trade.attach.sl)) throw new Error("The price is already below their stop");
  }
  if (db.prepare("SELECT 1 FROM orders WHERE trade_id = ? AND trader = ? AND role = 'copy'").get(tradeId, viewer)) throw new Error("You already copied this trade");
  const gate = await guardGate(t.leader);
  if (gate.halted) throw new Error("This trader is paused by CopyGuard");
  const meta = getMeta(viewer);
  if (meta.pausedAll) throw new Error("All copying is paused. Resume it in Me first");
  usd = Math.round(usd * 100) / 100;
  if (!(usd >= 1 && usd <= meta.defaults.max)) throw new Error(`Pick $1 to $${meta.defaults.max} (your max per trade)`);
  if (spentToday(viewer) + usd > meta.defaults.cap) throw new Error(`That would pass your $${meta.defaults.cap} daily cap`);
  if (meta.defaults.stop && !(trade.hasStop || trade.attach)) throw new Error("Your rules only copy trades with a stop-loss");
  const out = await execute(tradeId, viewer, t.leader, { ...trade, qty: String(usd) });
  if (out.startsWith("failed")) throw new Error(out.replace(/^failed: /, ""));
  return { handle: getUser(t.leader).handle, usd, receipt: out };
}

/**
 * A leader trades: place the leader's own order, then fan out to followers by their rules
 * (skip, auto-execute, or queue an ask-first request).
 */
export async function mirror(leader: number, trade: Trade, source: TradeSource = "user", note?: string): Promise<MirrorResult> {
  getUser(leader); // ensure wallet exists
  const tradeId = recordTrade(leader, trade, source, note);
  const out: MirrorResult = { tradeId, own: "", executed: [], skipped: [], pending: [] };
  // A sell copies as the same share of the position: the leader selling 40% of what they hold sells 40% of what each
  // follower copied from them (Flash sells are sized in tokens, and followers hold different amounts).
  const leaderHeld = trade.side === "sell" ? heldTokens(leader, trade.target) : 0;
  const share = trade.side === "sell" ? (leaderHeld > 1e-12 ? Math.min(1, Number(trade.qty) / leaderHeld) : 1) : 1;

  try {
    out.own = (await placeAndTrack(tradeId, leader, leader, "own", trade)).orderId;
  } catch (e) {
    out.own = `failed: ${(e as Error).message}`;
    return out; // do not copy a trade the leader could not place
  }

  const followers = followersOf(leader);
  const risk = followers.length ? await riskOf(leader) : 0;
  // Read after the leader's own order, right before fan-out: the latest CopyGuard state, onchain when deployed.
  const gate = followers.length ? await guardGate(leader) : { halted: !!haltOf(leader), stale: false };
  const halted = gate.halted;
  out.guard = gate;
  for (const { follower, rules } of followers) {
    const meta = getMeta(follower);
    const permOk = meta.perm && (!meta.permUntil || meta.permUntil > Date.now());
    const d = decide(trade, rules, {
      spentToday: spentToday(follower),
      halted,
      pausedAll: meta.pausedAll,
      risk,
      riskLine: RISK_LINE[meta.strict],
      autoPermission: permOk,
      budgetUsed: openCostFrom(follower, leader),
    });
    if (d.action === "skip") {
      recordCopy({ tradeId, follower, leader, usd: 0, status: "skipped", note: d.reason });
      out.skipped.push(`${follower}: ${d.reason}`);
      continue;
    }
    // A follower who turned off protective orders copies the entry without its attached bracket.
    let qty = d.qty;
    if (trade.side === "sell") {
      const mine = copiedTokens(follower, leader, trade.target) * share;
      if (mine <= 1e-12) {
        recordCopy({ tradeId, follower, leader, usd: 0, status: "skipped", note: "nothing copied from this trader to sell" });
        out.skipped.push(`${follower}: nothing copied from this trader to sell`);
        continue;
      }
      qty = String(Number(mine.toPrecision(12)));
    }
    const sized: Trade = rules.copyProtective ? { ...trade, qty } : { ...trade, qty, attach: undefined };
    // CopyGuard silent or unreadable: nothing signs on its own; the follower decides.
    if (d.action === "ask" || gate.stale) {
      out.pending.push({ pendingId: createPending(tradeId, follower, leader, sized, meta.timerSec * 1000), follower, trade: sized, tradeId });
    } else {
      out.executed.push(`${follower}: ${await execute(tradeId, follower, leader, sized)}`);
    }
  }
  return out;
}
