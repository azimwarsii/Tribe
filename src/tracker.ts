import { db, getMeta, getUser, setMeta } from "./db.js";
import { cancelOrder, cancelOrders, closeReasonText, getOrder, placeOrder, updateTrigger, type FlashOrderInfo, type Trade } from "./flash.js";
import { getPrice } from "./prices.js";
import { signerOf } from "./wallet.js";
import { totalPnlPct } from "./stats.js";

export const isDry = () => process.env.DRY_RUN !== "false";

/** Apply a fill to the trader's position. Returns realised PnL in USD for sells (0 for buys). */
export function applyFill(trader: number, token: string, side: "buy" | "sell", tokens: number, usd: number): number {
  token = token.toLowerCase();
  db.prepare("INSERT OR IGNORE INTO positions (trader, token) VALUES (?, ?)").run(trader, token);
  const p = db.prepare("SELECT qty, cost FROM positions WHERE trader = ? AND token = ?").get(trader, token) as { qty: number; cost: number };
  if (side === "buy") {
    db.prepare("UPDATE positions SET qty = qty + ?, cost = cost + ?, invested = invested + ? WHERE trader = ? AND token = ?").run(tokens, usd, usd, trader, token);
    return 0;
  }
  const sold = Math.min(tokens, p.qty); // never sell more than held
  if (sold <= 0) return 0;
  const avg = p.cost / p.qty;
  const proceeds = usd * (sold / tokens);
  const pnl = proceeds - avg * sold;
  db.prepare("UPDATE positions SET qty = qty - ?, cost = cost - ?, realized = realized + ? WHERE trader = ? AND token = ?").run(sold, avg * sold, pnl, trader, token);
  return pnl;
}

export interface Placed { orderId: string; sim: boolean; note?: string }

const PROTECTIVE = new Set(["stop-loss", "take-profit", "bracket"]);
const ENTRY = new Set(["market", "twap", "limit"]);

async function placeLive(trader: number, trade: Trade) {
  const u = getUser(trader);
  const slip = parseFloat(getMeta(trader).slip) / 100; // "0.5%" -> 0.005
  return placeOrder(trade, u.address, signerOf(trader), Number.isFinite(slip) ? String(slip) : undefined, { tight: getMeta(trader).tightApprovals });
}

/** The bracket an attached take-profit / stop-loss becomes once its entry has filled `tokens`. */
const bracketFor = (entry: Trade, tokens: number): Trade => ({
  chain: entry.chain, target: entry.target, contra: entry.contra, side: "sell", qty: String(tokens), orderType: "bracket",
  triggers: [{ notionalPrice: entry.attach!.tp, triggerType: "upper" }, { notionalPrice: entry.attach!.sl, triggerType: "lower" }],
});

/**
 * Place one order for `trader` (own trade or copy) and track it for fills.
 * Dry-run simulates fills at the live mark price and keeps a simulated USDC balance,
 * so PnL, feed and leaderboard work without funds.
 */
export async function placeAndTrack(tradeId: number, trader: number, leader: number, role: "own" | "copy", trade: Trade): Promise<Placed> {
  const sim = isDry();
  const insert = (orderId: string | null, t: Trade, status = "open", setup: string[] = []) =>
    Number(db.prepare("INSERT INTO orders (trade_id, trader, leader, role, order_id, trade, sim, placed_at, status, setup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(tradeId, trader, leader, role, orderId, JSON.stringify(t), sim ? 1 : 0, Date.now(), status, setup.length ? JSON.stringify(setup) : null).lastInsertRowid);

  // A protective sell needs the tokens in the wallet. Until the entry has filled, it waits and pollOrders places it.
  if (trade.side === "sell" && PROTECTIVE.has(trade.orderType)) {
    const held = heldTokens(trader, trade.target);
    if (held <= 1e-12) {
      insert(null, trade, "waiting");
      return { orderId: "waiting", sim, note: "waits for the entry to fill" };
    }
    trade = { ...trade, qty: String(Math.min(Number(trade.qty), held)) };
  }

  if (sim) {
    if (trade.side === "buy" && ENTRY.has(trade.orderType) && Number(trade.qty) > getMeta(trader).simBalance + 1e-9) throw new Error("Not enough free balance");
    const orderId = `sim-${tradeId}-${trader}`;
    const row = insert(orderId, trade);
    // A limit rests until the price reaches it, like on Flash; pollOrders fills or expires it.
    if (trade.orderType === "limit" && !limitReached(trade, await getPrice(trade.target))) return { orderId, sim, note: "resting limit" };
    if (ENTRY.has(trade.orderType)) {
      const tokens = await simFill(row, trade, trader, await getPrice(trade.target));
      // Simulate Flash's attached bracket: it activates on the entry's fill and protects what was received.
      if (trade.attach && tokens > 0) db.prepare("UPDATE orders SET parent = ? WHERE id = ?").run(row, insert(`${orderId}-bracket`, bracketFor(trade, tokens)));
    }
    return { orderId, sim };
  }
  const placed = await placeLive(trader, trade);
  insert(placed.orderId, trade, "open", placed.setupTxs);
  return { orderId: placed.orderId, sim };
}

function markFilled(rowId: number, trader: number, trade: Trade, tokens: number, usd: number, price: number, sim: boolean) {
  const pnl = applyFill(trader, trade.target, trade.side, tokens, usd);
  db.prepare("UPDATE orders SET status = 'filled', price = ?, tokens = ?, usd = ?, pnl = ?, filled_at = ? WHERE id = ?").run(price, tokens, usd, pnl, Date.now(), rowId);
  if (sim) setMeta(trader, { simBalance: getMeta(trader).simBalance + (trade.side === "buy" ? -usd : usd) });
}

async function simFill(rowId: number, trade: Trade, trader: number, price: number): Promise<number> {
  const qty = Number(trade.qty);
  // Buys are sized in USDC, sells in token units (same convention as rules.ts).
  const tokens = trade.side === "buy" ? qty / price : Math.min(qty, heldTokens(trader, trade.target));
  if (tokens <= 0) {
    db.prepare("UPDATE orders SET status = 'closed' WHERE id = ?").run(rowId);
    return 0;
  }
  markFilled(rowId, trader, trade, tokens, tokens * price, price, true);
  return tokens;
}

/** Has the price reached a limit order? A buy fills at or below its limit, a sell at or above. */
const limitReached = (t: Trade, price: number) => (t.side === "buy" ? price <= Number(t.limitNotionalPrice) : price >= Number(t.limitNotionalPrice));

export const heldTokens = (trader: number, token: string) =>
  ((db.prepare("SELECT qty FROM positions WHERE trader = ? AND token = ?").get(trader, token.toLowerCase()) as { qty: number } | undefined)?.qty ?? 0);

export type OrderRow = { id: number; trade_id: number; trader: number; leader: number; role: string; order_id: string | null; trade: string; sim: number; status: string };

/**
 * Poll open orders: live ones against Flash, simulated conditional ones against the mark price.
 * Also places protective orders that were waiting for their entry to fill.
 */
export async function pollOrders() {
  const rows = db.prepare("SELECT id, trade_id, trader, leader, role, order_id, trade, sim, status FROM orders WHERE status IN ('open','waiting')").all() as unknown as OrderRow[];
  const sweep = liveSweepDue(); // decided once per poll: every live order, or none while the stream carries them
  for (const o of rows) {
    const trade = JSON.parse(o.trade) as Trade;
    try {
      if (o.status === "waiting") {
        const held = heldTokens(o.trader, trade.target);
        if (held <= 1e-12) continue;
        const sized = { ...trade, qty: String(Math.min(Number(trade.qty), held)) };
        const id = o.sim ? `sim-${o.trade_id}-${o.trader}` : (await placeLive(o.trader, sized)).orderId;
        db.prepare("UPDATE orders SET status = 'open', order_id = ?, trade = ? WHERE id = ?").run(id, JSON.stringify(sized), o.id);
        continue;
      }
      if (o.sim) {
        const price = await getPrice(trade.target);
        if (trade.orderType === "limit") {
          if (limitReached(trade, price)) {
            const tokens = await simFill(o.id, trade, o.trader, Math.min(price, Number(trade.limitNotionalPrice)));
            if (trade.attach && tokens > 0) db.prepare("UPDATE orders SET parent = ? WHERE id = ?").run(o.id, db.prepare("INSERT INTO orders (trade_id, trader, leader, role, order_id, trade, sim, placed_at, status) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'open')").run(o.trade_id, o.trader, o.leader, o.role, `${o.order_id}-bracket`, JSON.stringify(bracketFor(trade, tokens)), Date.now()).lastInsertRowid);
          } else if (trade.expireTime && Date.parse(trade.expireTime) < Date.now()) {
            db.prepare("UPDATE orders SET status = 'closed', close_reason = 'EXPIRED' WHERE id = ?").run(o.id);
            if (o.role === "copy") db.prepare("UPDATE copies SET status = 'failed', note = ? WHERE trade_id = ? AND follower = ? AND status IN ('executed','dry-run')").run("Limit expired: the price never came back to it", o.trade_id, o.trader);
          }
          continue;
        }
        const hit = (trade.triggers ?? []).some((t) => (t.triggerType === "upper" ? price >= Number(t.notionalPrice) : price <= Number(t.notionalPrice)));
        if (hit) {
          // A bracket is one order: when one leg fires the order is done.
          await simFill(o.id, trade, o.trader, price);
        }
        continue;
      }
      if (sweep) await refreshOrder(o);
    } catch (e) {
      console.error(`poll order ${o.order_id}:`, (e as Error).message);
    }
  }
  await snapshotAll();
}

/** With the orders stream healthy, live orders update from it; polling every order is then only a slow safety sweep. */
let streamOk = () => false;
let lastSweep = 0;
export const useStreamHealth = (fn: () => boolean) => (streamOk = fn);
const liveSweepDue = () => !streamOk() || Date.now() - lastSweep > 120_000 ? ((lastSweep = Date.now()), true) : false;

const TERMINAL = new Set(["ORDER_STATUS_CANCELLED", "ORDER_STATUS_REJECTED", "ORDER_STATUS_TERMINATED"]);

/** Fetch one live order with its fills (settlement tx, fees) and apply it. Called by the stream and the sweep. */
export async function refreshOrder(o: OrderRow) {
  const info = await getOrder(o.order_id!, getUser(o.trader).address);
  const fee = info.fills.reduce((a, f) => a + (Number(f.integratorFeeNotional) || 0), 0);
  const tx = info.fills.at(-1)?.transactionId ?? null;
  if (tx || fee) db.prepare("UPDATE orders SET tx = COALESCE(?, tx), fee = ? WHERE id = ?").run(tx, fee, o.id);
  await applyOrderInfo(o, info);
}

/**
 * Apply Flash's view of an order to Tribe's books. Fills are applied as they grow (a TWAP fills in slices, and an
 * order can end cancelled after a partial fill), the close reason is kept, an attached bracket is tracked and its
 * protected amount follows the entry's fills, and a leader's cancel is mirrored to their followers' resting copies.
 */
export async function applyOrderInfo(o: OrderRow, info: Pick<FlashOrderInfo, "status" | "closeReason" | "filled" | "attachedBracket">) {
  const trade = JSON.parse(o.trade) as Trade;
  const row = db.prepare("SELECT tokens, usd, pnl, status FROM orders WHERE id = ?").get(o.id) as { tokens: number | null; usd: number | null; pnl: number | null; status: string };
  if (row.status !== "open") return;
  const tokens = Number(info.filled?.targetAmount ?? 0) || 0;
  const usd = Number(info.filled?.contraAmount ?? 0) || 0;
  const dTokens = tokens - (row.tokens ?? 0), dUsd = usd - (row.usd ?? 0);
  if (dTokens > 1e-12) {
    const pnl = applyFill(o.trader, trade.target, trade.side, dTokens, dUsd);
    const price = Number(info.filled?.averageNotionalPrice ?? info.filled?.averagePrice) || usd / tokens;
    db.prepare("UPDATE orders SET tokens = ?, usd = ?, price = ?, pnl = COALESCE(pnl, 0) + ?, filled_at = ? WHERE id = ?").run(tokens, usd, price, pnl, Date.now(), o.id);
  }
  // Flash activates an attached bracket on the entry's first fill; later fills grow what it protects.
  const ab = info.attachedBracket;
  if (trade.attach && ab?.bracketOrderId) {
    const child = db.prepare("SELECT id, trade, status FROM orders WHERE order_id = ?").get(ab.bracketOrderId) as { id: number; trade: string; status: string } | undefined;
    const protectedTokens = tokens || Number(ab.signedMaxFromAmount) || 0;
    if (!child) {
      db.prepare("INSERT INTO orders (trade_id, trader, leader, role, order_id, trade, sim, placed_at, status, parent) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'open', ?)")
        .run(o.trade_id, o.trader, o.leader, o.role, ab.bracketOrderId, JSON.stringify(bracketFor(trade, protectedTokens)), Date.now(), o.id);
    } else if (child.status === "open" && Number((JSON.parse(child.trade) as Trade).qty) < protectedTokens) {
      db.prepare("UPDATE orders SET trade = ? WHERE id = ?").run(JSON.stringify(bracketFor(trade, protectedTokens)), child.id);
    }
  }
  if (info.status === "ORDER_STATUS_FILLED") {
    db.prepare("UPDATE orders SET status = 'filled', close_reason = NULL WHERE id = ?").run(o.id);
  } else if (TERMINAL.has(info.status)) {
    // Keep what did fill; record why the rest didn't.
    db.prepare("UPDATE orders SET status = ?, close_reason = ? WHERE id = ?").run(tokens > 0 ? "filled" : "closed", info.closeReason ?? info.status, o.id);
    if (o.role === "copy" && tokens === 0) db.prepare("UPDATE copies SET status = 'failed', note = ? WHERE trade_id = ? AND follower = ? AND status IN ('executed','dry-run')").run(closeReasonText(info.closeReason) ?? "Closed by Flash before it filled", o.trade_id, o.trader);
    if (o.role === "own" && info.status === "ORDER_STATUS_CANCELLED" && tokens === 0) await cancelFollowerCopies(o.trade_id);
  }
}

/** The leader cancelled a resting order: cancel every follower's matching resting copy, one signed batch per follower. */
export async function cancelFollowerCopies(tradeId: number) {
  const rows = db.prepare("SELECT id, trader, order_id, sim FROM orders WHERE trade_id = ? AND role = 'copy' AND status IN ('open','waiting')").all(tradeId) as unknown as { id: number; trader: number; order_id: string | null; sim: number }[];
  const byFollower = new Map<number, typeof rows>();
  for (const r of rows) byFollower.set(r.trader, [...(byFollower.get(r.trader) ?? []), r]);
  for (const [follower, list] of byFollower) {
    const live = list.filter((r) => !r.sim && r.order_id && r.order_id !== "waiting").map((r) => r.order_id!);
    try {
      if (live.length) await cancelOrders(live, signerOf(follower));
    } catch (e) {
      console.error(`cancel copies of trade ${tradeId} for ${follower}:`, (e as Error).message);
      continue; // leave them open; the next sweep retries
    }
    for (const r of list) db.prepare("UPDATE orders SET status = 'closed', close_reason = 'LEADER_CANCELLED' WHERE id = ?").run(r.id);
  }
  return rows.length;
}

/** Cancel a trader's open protective orders on a token (before closing the position, or replacing a stop). */
export async function cancelProtective(trader: number, token: string) {
  const open = db.prepare("SELECT id, order_id, sim FROM orders WHERE trader = ? AND status = 'open' AND json_extract(trade, '$.target') = ? AND json_extract(trade, '$.side') = 'sell' AND json_extract(trade, '$.orderType') IN ('bracket','stop-loss','take-profit')").all(trader, token) as unknown as { id: number; order_id: string; sim: number }[];
  const live = open.filter((o) => !o.sim).map((o) => o.order_id);
  // One signature for all of them (Flash batch cancel); a single order uses the plain cancel.
  if (live.length === 1) await cancelOrder(live[0], signerOf(trader));
  else if (live.length > 1) await cancelOrders(live, signerOf(trader));
  for (const o of open) db.prepare("UPDATE orders SET status = 'closed', close_reason = 'CANCELLED_BY_USER' WHERE id = ?").run(o.id);
  return open.length;
}

const PROTECTIVE_SQL = "json_extract(trade, '$.side') = 'sell' AND json_extract(trade, '$.orderType') IN ('bracket','stop-loss','take-profit')";

/** Cancel the protective orders (open or waiting for their entry) that came from copying one leader on a token. */
export async function cancelCopiedProtective(follower: number, leader: number, token: string) {
  const rows = db.prepare(`SELECT id, order_id, sim FROM orders WHERE trader = ? AND leader = ? AND role = 'copy' AND status IN ('open','waiting') AND lower(json_extract(trade, '$.target')) = lower(?) AND ${PROTECTIVE_SQL}`).all(follower, leader, token) as unknown as { id: number; order_id: string | null; sim: number }[];
  const live = rows.filter((r) => !r.sim && r.order_id && r.order_id !== "waiting").map((r) => r.order_id!);
  if (live.length === 1) await cancelOrder(live[0], signerOf(follower));
  else if (live.length > 1) await cancelOrders(live, signerOf(follower));
  for (const r of rows) db.prepare("UPDATE orders SET status = 'closed', close_reason = 'CANCELLED_BY_USER' WHERE id = ?").run(r.id);
  return rows.length;
}

/** A trader's current stop price on a token: the lower trigger of their newest open or waiting bracket or stop-loss. */
export function stopOf(trader: number, token: string): number | undefined {
  const o = db.prepare("SELECT trade FROM orders WHERE trader = ? AND status IN ('open','waiting') AND lower(json_extract(trade, '$.target')) = lower(?) AND json_extract(trade, '$.orderType') IN ('bracket','stop-loss') ORDER BY id DESC LIMIT 1").get(trader, token) as { trade: string } | undefined;
  const lower = o && (JSON.parse(o.trade) as Trade).triggers?.find((x) => x.triggerType === "lower");
  return lower ? Number(lower.notionalPrice) : undefined;
}

/**
 * Move a trader's stop on a token to `price` for `qty` tokens: a gasless Flash update for a stop-loss, a cancel and
 * re-place for a bracket (Flash can't update one), or a new stop-loss when there is none.
 */
export async function moveStop(trader: number, token: string, price: number, qty: number, leader = trader, role: "own" | "copy" = "own") {
  const at = price.toFixed(2);
  const open = db.prepare("SELECT id, order_id, trade, sim FROM orders WHERE trader = ? AND status = 'open' AND json_extract(trade, '$.target') = ? AND json_extract(trade, '$.orderType') IN ('bracket','stop-loss') ORDER BY id DESC LIMIT 1").get(trader, token) as { id: number; order_id: string; trade: string; sim: number } | undefined;
  if (open && !open.sim) {
    const t = JSON.parse(open.trade) as Trade;
    if (t.orderType === "stop-loss") {
      await updateTrigger(open.order_id, signerOf(trader), "lower", at);
      t.triggers = [{ notionalPrice: at, triggerType: "lower" }];
      db.prepare("UPDATE orders SET trade = ? WHERE id = ?").run(JSON.stringify(t), open.id);
    } else {
      await cancelProtective(trader, token);
      t.triggers = (t.triggers ?? []).filter((x) => x.triggerType !== "lower").concat({ notionalPrice: at, triggerType: "lower" });
      await placeAndTrack(0, trader, leader, role, { ...t, qty: String(qty) });
    }
  } else if (open) {
    const t = JSON.parse(open.trade) as Trade;
    t.triggers = (t.triggers ?? []).filter((x) => x.triggerType !== "lower").concat({ notionalPrice: at, triggerType: "lower" });
    db.prepare("UPDATE orders SET trade = ? WHERE id = ?").run(JSON.stringify(t), open.id);
  } else {
    const t: Trade = { chain: "base", target: token, contra: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", side: "sell", qty: String(qty), orderType: "stop-loss", triggers: [{ notionalPrice: at, triggerType: "lower" }] };
    await placeAndTrack(0, trader, leader, role, t);
  }
}

/** Record each trader's PnL% so drawdown can be computed for the leaderboard and CopyGuard. */
export async function snapshotAll() {
  const traders = db.prepare("SELECT DISTINCT trader FROM positions").all() as unknown as { trader: number }[];
  for (const { trader } of traders) {
    try {
      db.prepare("INSERT INTO snapshots (trader, at, pnl_pct) VALUES (?, ?, ?)").run(trader, Date.now(), await totalPnlPct(trader));
    } catch (e) {
      console.error(`snapshot ${trader}:`, (e as Error).message);
    }
  }
}

export const startTracker = (ms = 20_000) => setInterval(() => void pollOrders(), ms);
