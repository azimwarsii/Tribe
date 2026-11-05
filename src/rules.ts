import type { Trade } from "./flash.js";

export interface FollowRules {
  mode: "auto" | "ask";
  ratio: number; // multiplier on the leader's size
  maxUsdPerTrade: number;
  dailyCapUsd: number;
  tokens: string[]; // allowed target token addresses (lowercase); empty = all
  orderTypes: string[]; // allowed order types; empty = all
  copyProtective: boolean; // false = skip stop-loss / take-profit / bracket orders
  requireStop: boolean; // only copy entries that come with a stop-loss
  paused: boolean; // paused by the follower
  guardOverride: boolean; // follower chose to resume against Guard's advice
  budgetUsd?: number; // most Tribe will ever put into copying this trader (open cost)
  stopPct?: number; // my own stop, % below entry: used when the leader has none, or when it is safer than theirs
  closeOnPause?: boolean; // sell what I copied from them when CopyGuard pauses them
}

export type Decision =
  | { action: "skip"; reason: string }
  | { action: "ask" | "auto"; qty: string; usd: number };

export interface DecideCtx {
  spentToday: number;
  halted: boolean; // CopyGuard onchain halt
  pausedAll?: boolean;
  risk?: number; // 0-100 risk score of the leader
  riskLine?: number; // follower's pause line from their Guard strictness
  autoPermission?: boolean; // follower granted the auto-copy permission (default true)
  budgetUsed?: number; // USD currently open from copying this trader
}

const PROTECTIVE = new Set(["stop-loss", "take-profit", "bracket", "stop"]);

/** Guard strictness -> risk score at which Guard stops copying for that follower. */
export const RISK_LINE = { Strict: 50, Balanced: 65, Relaxed: 80 } as const;

/**
 * Size convention (same as parse.ts): buys are denominated in USDC, sells in token units.
 * Only buys count toward USD caps, since the sell size has no USD value without a price.
 */
export function usdOf(t: Trade, ratio: number): number {
  return t.side === "buy" ? Number(t.qty) * ratio : 0;
}

export function decide(trade: Trade, rules: FollowRules, ctx: DecideCtx): Decision {
  if (ctx.pausedAll) return { action: "skip", reason: "all copying paused" };
  if (rules.paused) return { action: "skip", reason: "paused by you" };
  if (!rules.guardOverride) {
    if (ctx.halted) return { action: "skip", reason: "leader paused by CopyGuard" };
    if (ctx.risk !== undefined && ctx.riskLine !== undefined && ctx.risk >= ctx.riskLine) {
      return { action: "skip", reason: `CopyGuard: risk ${Math.round(ctx.risk)} is above your line of ${ctx.riskLine}` };
    }
  }
  if (rules.tokens.length && !rules.tokens.includes(trade.target.toLowerCase())) return { action: "skip", reason: "token not allowed" };
  if (rules.orderTypes.length && !rules.orderTypes.includes(trade.orderType)) return { action: "skip", reason: "order type not allowed" };
  if (!rules.copyProtective && PROTECTIVE.has(trade.orderType)) return { action: "skip", reason: "protective orders disabled" };
  // A follower with their own stop always ends up with a stopped copy (protectCopy), so the filter is met.
  if (rules.requireStop && trade.side === "buy" && !trade.hasStop && !(Number(rules.stopPct) > 0)) return { action: "skip", reason: "no stop-loss, your filter" };

  const qtyNum = Number(trade.qty) * rules.ratio;
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) return { action: "skip", reason: "invalid size" };

  let usd = usdOf(trade, rules.ratio);
  let qty = qtyNum;
  if (trade.side === "buy") {
    if (usd > rules.maxUsdPerTrade) {
      // Clamp to the per-trade max instead of skipping.
      usd = rules.maxUsdPerTrade;
      qty = usd;
    }
    if (ctx.spentToday + usd > rules.dailyCapUsd) return { action: "skip", reason: "daily cap reached" };
    if (rules.budgetUsd && (ctx.budgetUsed ?? 0) + usd > rules.budgetUsd) return { action: "skip", reason: "budget for this trader used up" };
  }
  // Auto needs the signing permission; without it the follower is asked instead.
  const action = rules.mode === "auto" && ctx.autoPermission === false ? "ask" : rules.mode;
  return { action, qty: String(qty), usd };
}

/**
 * The follower's own stop on a copied entry, `stopPct` below the current price. A copy with the leader's bracket
 * keeps whichever stop is safer (the higher one). A copy with no stop gets the follower's as a stop-loss placed once
 * the entry fills (`followStop`). Followers who turned off protective orders get neither.
 */
export function protectCopy(trade: Trade, rules: FollowRules, mark: number): Trade {
  const pct = Number(rules.stopPct);
  if (trade.side !== "buy" || !rules.copyProtective || !(pct > 0 && pct < 90) || !(mark > 0)) return trade;
  const mine = mark * (1 - pct / 100);
  if (trade.attach) return Number(trade.attach.sl) >= mine ? trade : { ...trade, attach: { ...trade.attach, sl: mine.toFixed(2) }, hasStop: true };
  return { ...trade, followStop: mine.toFixed(2), hasStop: true };
}
