import { basketMix, basketRisk, isBroadFund, type MixPart, type RiskLevel } from "./assets.js";
import { copyFreeze, db, getMeta, getUser, recordCopy, spentToday } from "./db.js";
import { freeBalance, symOf } from "./data.js";
import type { Trade } from "./flash.js";
import { guardGate, riskOf } from "./guard.js";
import { priceStr } from "./numfmt.js";
import { USDC } from "./parse.js";
import { getPrice } from "./prices.js";
import { RISK_LINE } from "./rules.js";
import { rememberToken, tradableToken } from "./tokens.js";
import { heldTokens, isDry, placeAndTrack } from "./tracker.js";

/**
 * Baskets: what people copy on Tribe. A creator publishes a named set of tokens with target weights; a follower puts
 * in an amount and Tribe buys every token in their own wallet, one Flash order per token.
 *
 * - A published version never changes. New weights make a new version, and copiers approve a rebalance to it.
 * - A basket's value is an index: 100 at launch, moved by its weights and token prices, carried across versions. The
 *   creator doesn't have to hold it, so the record is the same for everyone.
 * - Each order is a "leg" with its own negative trade id and the role `basket`. Nothing that reads the `trades` table
 *   or the `own` / `copy` roles sees a leg, so a 5-token copy is one copy in XP, win rate, the feed and Guard's burst count.
 * - What a copy holds comes from its own legs, because `positions` blends every source of a token into one row.
 */

export const MIN_TOKENS = 1;
export const MAX_TOKENS = 10;
/** "1 token", "3 tokens". */
export const tokensText = (n: number) => `${n} token${n === 1 ? "" : "s"}`;
export const MIN_LEG_USD = 1;
const DUST_USD = 1; // a rebalance ignores moves smaller than this
const OPEN = "('filling','filled','partial')";

export interface Weight { token: string; symbol: string; weight: number }
export interface BasketRow { id: number; owner: number; name: string; thesis: string | null; stop_pct: number; tp_pct: number; status: string; at: number }
export interface VersionRow { id: number; basket: number; n: number; weights: Weight[]; prices: Record<string, number>; nav_start: number; note: string | null; at: number }
export interface CopyRow { id: number; basket: number; follower: number; version: number; usd: number; status: string; note: string | null; at: number; closed_at: number | null }
export interface Holding { token: string; symbol: string; qty: number; cost: number; price: number; value: number; pnlPct: number; weightPct: number; targetPct: number }
export interface CopyValue { holdings: Holding[]; invested: number; proceeds: number; value: number; pnlUsd: number; pnlPct: number }
export interface BasketView {
  id: number; owner: number; handle: string; name: string; thesis: string | null; stopPct: number; tpPct: number; status: string; at: number;
  version: number; versionAt: number; weights: (Weight & { price: number; changePct: number })[]; nav: number; returnPct: number; copiers: number; volume: number;
  mix: MixPart[]; risk: RiskLevel;
}

/** Where the money would move to bring a copy to a version's weights. */
export interface RebalancePlan { total: number; sells: { token: string; symbol: string; qty: number; usd: number }[]; buys: { token: string; symbol: string; usd: number }[] }

/** Baskets are simulated in this release: multi-order signing, limits and partial fills haven't been proven on live Flash. */
function requireSim() {
  if (!isDry()) throw new Error("Baskets run in practice mode for now. Real-money baskets aren't switched on yet.");
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Check a creator's tokens and weights: 1 to 10 different tokens, at least 1% each, adding up to 100%. */
export function checkWeights(input: { token: string; weight: number }[]): { token: string; weight: number }[] {
  if (!Array.isArray(input) || input.length < MIN_TOKENS) throw new Error("Pick at least one token");
  if (input.length > MAX_TOKENS) throw new Error(`A basket holds up to ${MAX_TOKENS} tokens`);
  const out = input.map((w) => ({ token: String(w.token ?? "").toLowerCase(), weight: Number(w.weight) }));
  if (new Set(out.map((w) => w.token)).size !== out.length) throw new Error("Each token can only be in a basket once");
  for (const w of out) if (!(Number.isFinite(w.weight) && w.weight >= 1)) throw new Error("Every token needs at least 1%");
  const total = out.reduce((a, w) => a + w.weight, 0);
  if (Math.abs(total - 100) > 0.01) throw new Error(`Weights must add up to 100% (now ${round2(total)}%)`);
  return out;
}

/** Split an amount across weights, to the cent. The last token takes the rounding, so the parts add up exactly. */
export function splitUsd(usd: number, weights: { weight: number }[]): number[] {
  const parts = weights.map((w) => Math.floor(usd * w.weight) / 100);
  parts[parts.length - 1] = round2(usd - parts.slice(0, -1).reduce((a, b) => a + b, 0));
  return parts;
}

const pricesOf = async (tokens: string[]) => Object.fromEntries(await Promise.all(tokens.map(async (t) => [t, await getPrice(t)] as const)));

async function resolveWeights(input: { token: string; weight: number }[]): Promise<Weight[]> {
  const checked = checkWeights(input);
  const out: Weight[] = [];
  for (const w of checked) {
    const t = await tradableToken(w.token); // not flagged, liquid enough
    rememberToken({ address: t.address, symbol: t.symbol, name: t.name });
    out.push({ token: t.address.toLowerCase(), symbol: t.symbol, weight: w.weight });
  }
  return out;
}

function addVersion(basket: number, n: number, weights: Weight[], prices: Record<string, number>, navStart: number, note?: string) {
  return Number(db.prepare("INSERT INTO basket_versions (basket, n, weights, prices, nav_start, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(basket, n, JSON.stringify(weights), JSON.stringify(prices), navStart, note?.slice(0, 200) ?? null, Date.now()).lastInsertRowid);
}

export async function createBasket(owner: number, input: { name: string; thesis?: string; stopPct?: number; tpPct?: number; weights: { token: string; weight: number }[] }): Promise<number> {
  const name = String(input.name ?? "").trim().slice(0, 40);
  if (name.length < 3) throw new Error("Give the basket a name of at least 3 characters");
  const stop = Number(input.stopPct ?? 0), tp = Number(input.tpPct ?? 0);
  if (!(stop === 0 || (stop >= 0.5 && stop <= 50))) throw new Error("Stop is none, or 0.5% to 50%");
  if (!(tp === 0 || (tp >= 0.5 && tp <= 500))) throw new Error("Target is none, or 0.5% to 500%");
  const weights = await resolveWeights(input.weights);
  const prices = await pricesOf(weights.map((w) => w.token));
  const id = Number(db.prepare("INSERT INTO baskets (owner, name, thesis, stop_pct, tp_pct, at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(owner, name, String(input.thesis ?? "").trim().slice(0, 200) || null, stop, tp, Date.now()).lastInsertRowid);
  addVersion(id, 1, weights, prices, 100);
  db.prepare("INSERT INTO basket_nav (basket, at, nav) VALUES (?, ?, 100)").run(id, Date.now());
  return id;
}

export const basketById = (id: number) => db.prepare("SELECT * FROM baskets WHERE id = ?").get(id) as unknown as BasketRow | undefined;
const parseVersion = (r: Record<string, unknown>): VersionRow => ({ ...r, weights: JSON.parse(String(r.weights)), prices: JSON.parse(String(r.prices)) }) as VersionRow;
export const versionOf = (basket: number, n?: number): VersionRow => {
  const r = (n === undefined
    ? db.prepare("SELECT * FROM basket_versions WHERE basket = ? ORDER BY n DESC LIMIT 1").get(basket)
    : db.prepare("SELECT * FROM basket_versions WHERE basket = ? AND n = ?").get(basket, n)) as Record<string, unknown> | undefined;
  if (!r) throw new Error("Basket not found");
  return parseVersion(r);
};
export const versionsOf = (basket: number) => (db.prepare("SELECT * FROM basket_versions WHERE basket = ? ORDER BY n DESC").all(basket) as Record<string, unknown>[]).map(parseVersion);

/** The index today: the version's starting value, moved by each token's price change at its weight. */
export async function navOf(basket: number): Promise<{ nav: number; prices: Record<string, number> }> {
  const v = versionOf(basket);
  const prices: Record<string, number> = {};
  let growth = 0;
  for (const w of v.weights) {
    const p = await getPrice(w.token).catch(() => v.prices[w.token]);
    prices[w.token] = p;
    growth += (w.weight / 100) * (p / v.prices[w.token]);
  }
  return { nav: v.nav_start * growth, prices };
}

/** A creator changes the weights: a new version from the index's current value, and a rebalance request to every copier. */
export async function updateWeights(owner: number, id: number, input: { token: string; weight: number }[], note?: string): Promise<{ version: number; asked: number }> {
  const b = basketById(id);
  if (!b || b.owner !== owner) throw new Error("Basket not found");
  if (b.status !== "live") throw new Error("This basket is retired");
  const cur = versionOf(id);
  const weights = await resolveWeights(input);
  const key = (ws: { token: string; weight: number }[]) => JSON.stringify(ws.map((w) => [w.token, w.weight]).sort());
  if (key(weights) === key(cur.weights)) throw new Error("Those are already the weights");
  const { nav } = await navOf(id);
  const prices = await pricesOf(weights.map((w) => w.token));
  const n = cur.n + 1;
  addVersion(id, n, weights, prices, nav, note);
  db.prepare("UPDATE basket_requests SET status = 'superseded' WHERE basket = ? AND status = 'open'").run(id);
  const copies = db.prepare(`SELECT * FROM basket_copies WHERE basket = ? AND status IN ('filled','partial')`).all(id) as unknown as CopyRow[];
  let asked = 0;
  for (const c of copies) {
    if (await settleCopy(c)) continue; // stopped out: nothing left to rebalance
    db.prepare("INSERT INTO basket_requests (copy_id, basket, version, at) VALUES (?, ?, ?, ?)").run(c.id, id, n, Date.now());
    asked++;
  }
  return { version: n, asked };
}

/** A retired basket can't be copied any more. People already in it keep what they hold and can close when they like. */
export function retireBasket(owner: number, id: number) {
  const b = basketById(id);
  if (!b || b.owner !== owner) throw new Error("Basket not found");
  db.prepare("UPDATE baskets SET status = 'retired' WHERE id = ?").run(id);
  db.prepare("UPDATE basket_requests SET status = 'superseded' WHERE basket = ? AND status = 'open'").run(id);
}

export async function basketView(id: number): Promise<BasketView | undefined> {
  const b = basketById(id);
  if (!b) return undefined;
  const v = versionOf(id);
  const { nav, prices } = await navOf(id);
  const stats = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(usd), 0) AS usd FROM basket_copies WHERE basket = ? AND status IN ('filled','partial')`).get(id) as { n: number; usd: number };
  const mix = basketMix(v.weights);
  return {
    id, owner: b.owner, handle: getUser(b.owner).handle, name: b.name, thesis: b.thesis, stopPct: b.stop_pct, tpPct: b.tp_pct, status: b.status, at: b.at,
    version: v.n, versionAt: v.at, nav, returnPct: nav - 100, copiers: stats.n, volume: stats.usd, mix, risk: basketRisk(v.weights, b.stop_pct),
    weights: v.weights.map((w) => ({ ...w, symbol: w.symbol || symOf(w.token), price: prices[w.token], changePct: (prices[w.token] / v.prices[w.token] - 1) * 100 })),
  };
}

/** Demo seed: give a new basket a past, ending at `returnPct`, with a gently wobbling chart. */
export function backdateBasket(id: number, daysAgo: number, returnPct: number) {
  const v = versionOf(id);
  const at = Date.now() - daysAgo * 86400e3;
  const start = Object.fromEntries(Object.entries(v.prices).map(([t, p]) => [t, p / (1 + returnPct / 100)]));
  db.prepare("UPDATE basket_versions SET prices = ?, at = ? WHERE id = ?").run(JSON.stringify(start), at, v.id);
  db.prepare("UPDATE baskets SET at = ? WHERE id = ?").run(at, id);
  db.prepare("DELETE FROM basket_nav WHERE basket = ?").run(id);
  const points = 60;
  for (let i = 0; i <= points; i++) {
    const f = i / points;
    db.prepare("INSERT INTO basket_nav (basket, at, nav) VALUES (?, ?, ?)").run(id, at + f * daysAgo * 86400e3, 100 + returnPct * f + Math.sin(i / 3 + id) * 1.4 * (1 - Math.abs(2 * f - 1)));
  }
}

const idsOf = (sql: string, ...args: (string | number)[]) => (db.prepare(sql).all(...args) as { id: number }[]).map((r) => r.id);
const viewsOf = async (ids: number[]) => (await Promise.all(ids.map(basketView))).filter((v): v is BasketView => !!v);
export const liveBaskets = () => viewsOf(idsOf("SELECT id FROM baskets WHERE status = 'live' ORDER BY id DESC"));
export const basketsBy = (owner: number) => viewsOf(idsOf("SELECT id FROM baskets WHERE owner = ? ORDER BY status = 'live' DESC, id DESC", owner));
/** Live baskets, best return first. */
export const basketBoard = async (limit = 20) => (await liveBaskets()).sort((a, b) => b.returnPct - a.returnPct).slice(0, limit);

/** Record every live basket's index value, for its chart. */
export async function snapshotBaskets() {
  for (const { id } of db.prepare("SELECT id FROM baskets WHERE status = 'live'").all() as { id: number }[]) {
    const { nav } = await navOf(id);
    db.prepare("INSERT INTO basket_nav (basket, at, nav) VALUES (?, ?, ?)").run(id, Date.now(), nav);
  }
}
/** The index over time, oldest first. */
export const navSeries = (basket: number, limit = 200) =>
  (db.prepare("SELECT nav FROM (SELECT nav, at FROM basket_nav WHERE basket = ? ORDER BY at DESC LIMIT ?) ORDER BY at").all(basket, limit) as { nav: number }[]).map((r) => r.nav);

// ---------- Copying ----------

const copyById = (id: number) => db.prepare("SELECT * FROM basket_copies WHERE id = ?").get(id) as unknown as CopyRow | undefined;
const setCopy = (id: number, status: string, note?: string) =>
  db.prepare("UPDATE basket_copies SET status = ?, note = ?, closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END WHERE id = ?").run(status, note ?? null, status, Date.now(), id);
/** The basket a copy order belongs to. A basket order's trade id is its leg id, negated, so it has no trade page. */
export const basketOfOrder = (tradeId: number) => (db.prepare("SELECT c.basket FROM basket_legs l JOIN basket_copies c ON c.id = l.copy_id WHERE l.id = ?").get(-tradeId) as { basket: number } | undefined)?.basket;
export const openCopy = (viewer: number, basket: number) => db.prepare(`SELECT * FROM basket_copies WHERE basket = ? AND follower = ? AND status IN ${OPEN}`).get(basket, viewer) as unknown as CopyRow | undefined;

/** A copy whose stops and targets sold everything is over: close it, and say whether it did. */
async function settleCopy(c: CopyRow, value?: CopyValue): Promise<boolean> {
  if (c.status === "filling" || (value ?? (await copyValue(c.id))).holdings.length) return false;
  setCopy(c.id, "closed", "Every token's stop or target sold");
  db.prepare("UPDATE basket_requests SET status = 'superseded' WHERE copy_id = ? AND status = 'open'").run(c.id);
  return true;
}

/** This person's open copy of a basket, if it still holds anything. */
export async function liveCopy(viewer: number, basket: number): Promise<CopyRow | undefined> {
  const c = openCopy(viewer, basket);
  return c && !(await settleCopy(c)) ? c : undefined;
}

/** Place one order of a copy. A failed order is recorded on its leg rather than thrown, so the other tokens still go. */
async function placeLeg(c: CopyRow, owner: number, token: string, kind: string, trade: Trade, usd: number): Promise<boolean> {
  const leg = Number(db.prepare("INSERT INTO basket_legs (copy_id, token, kind, trade, usd, at) VALUES (?, ?, ?, ?, ?, ?)").run(c.id, token, kind, JSON.stringify(trade), usd, Date.now()).lastInsertRowid);
  try {
    await placeAndTrack(-leg, c.follower, owner, "basket", trade);
    db.prepare("UPDATE basket_legs SET status = 'placed' WHERE id = ?").run(leg);
    return true;
  } catch (e) {
    db.prepare("UPDATE basket_legs SET status = 'failed', note = ? WHERE id = ?").run((e as Error).message.slice(0, 200), leg);
    return false;
  }
}

/** The exits every token in a copy carries, measured from the price now. */
function exitsAt(b: BasketRow, mark: number): { tp: string; sl: string } | undefined {
  if (!(b.stop_pct > 0)) return undefined;
  // Flash's attached bracket needs both sides; with no target the upper side sits far out of reach.
  return { sl: priceStr(mark * (1 - b.stop_pct / 100)), tp: priceStr(mark * (b.tp_pct > 0 ? 1 + b.tp_pct / 100 : 10)) };
}

async function buyLeg(c: CopyRow, b: BasketRow, token: string, usd: number, kind: string): Promise<boolean> {
  const mark = await getPrice(token).catch(() => 0);
  const attach = mark > 0 ? exitsAt(b, mark) : undefined;
  const trade: Trade = { chain: "base", target: token, contra: USDC, side: "buy", qty: String(usd), orderType: "market", ...(attach ? { attach, hasStop: true } : {}) };
  return placeLeg(c, b.owner, token, kind, trade, usd);
}

const sellTrade = (token: string, qty: number): Trade => ({ chain: "base", target: token, contra: USDC, side: "sell", qty: String(Number(qty.toPrecision(12))), orderType: "market" });

/** Close the resting stops and targets of a copy's token, so they can't fire on what is about to be sold. */
function cancelExits(copyId: number, token: string) {
  db.prepare(`UPDATE orders SET status = 'closed', close_reason = 'CANCELLED_BY_USER' WHERE status IN ('open','waiting') AND json_extract(trade, '$.side') = 'sell' AND json_extract(trade, '$.orderType') != 'market'
    AND lower(json_extract(trade, '$.target')) = ? AND trade_id IN (SELECT -id FROM basket_legs WHERE copy_id = ?)`).run(token, copyId);
}

/** Put a stop back on what's left of a token after a partial sell. */
async function reprotect(c: CopyRow, b: BasketRow, token: string, qty: number) {
  const mark = await getPrice(token).catch(() => 0);
  const ex = mark > 0 ? exitsAt(b, mark) : undefined;
  if (!ex || qty <= 1e-12) return;
  const trade: Trade = { chain: "base", target: token, contra: USDC, side: "sell", qty: String(Number(qty.toPrecision(12))), orderType: "bracket", triggers: [{ notionalPrice: ex.tp, triggerType: "upper" }, { notionalPrice: ex.sl, triggerType: "lower" }] };
  await placeLeg(c, b.owner, token, "protect", trade, 0);
}

/** Copy a basket: every check once for the whole amount, then one order per token at its weight. */
/** Everything that must hold before a copy is placed. Copying runs it, and anything preparing a copy can run it first. */
export async function checkCopy(viewer: number, id: number, usdIn: number) {
  requireSim();
  const b = basketById(id);
  if (!b) throw new Error("Basket not found");
  if (b.status !== "live") throw new Error("This basket is retired");
  if (b.owner === viewer) throw new Error("That's your own basket");
  if (await liveCopy(viewer, id)) throw new Error("You already copy this basket");
  const frozen = copyFreeze();
  if (frozen) throw new Error(`Tribe paused all copying: ${frozen}`);
  const meta = getMeta(viewer);
  if (meta.pausedAll) throw new Error("All copying is paused. Resume it in Me first");
  const usd = round2(usdIn);
  if (!(usd >= 1 && usd <= meta.defaults.max)) throw new Error(`Pick $1 to $${meta.defaults.max} (your max per copy)`);
  if (spentToday(viewer) + usd > meta.defaults.cap) throw new Error(`That would pass your $${meta.defaults.cap} daily cap`);
  if (meta.defaults.stop && !(b.stop_pct > 0)) throw new Error("Your rules only copy baskets with a stop-loss");
  const gate = await guardGate(b.owner);
  if (gate.halted) throw new Error("This creator is paused by CopyGuard");
  const risk = await riskOf(b.owner);
  if (risk >= RISK_LINE[meta.strict]) throw new Error(`CopyGuard: risk ${Math.round(risk)} is above your line of ${RISK_LINE[meta.strict]}`);
  const v = versionOf(id);
  const parts = splitUsd(usd, v.weights);
  const small = parts.findIndex((p) => p < MIN_LEG_USD);
  if (small >= 0) throw new Error(`Too small to split: ${v.weights[small].symbol} would get under $${MIN_LEG_USD}. Copy at least $${Math.ceil((MIN_LEG_USD * 100) / Math.min(...v.weights.map((w) => w.weight)))}`);
  const free = await freeBalance(viewer);
  if (usd > free + 1e-6) throw new Error(`Not enough balance: $${free.toFixed(2)} free, this copy needs $${usd.toFixed(2)}`);
  return { b, v, usd, parts };
}

export async function copyBasket(viewer: number, id: number, usdIn: number): Promise<{ copy: number; status: string; placed: number; failed: number; usd: number }> {
  const { b, v, usd, parts } = await checkCopy(viewer, id, usdIn);
  let copyId: number;
  try {
    copyId = Number(db.prepare("INSERT INTO basket_copies (basket, follower, version, usd, at) VALUES (?, ?, ?, ?, ?)").run(id, viewer, v.n, usd, Date.now()).lastInsertRowid);
  } catch {
    throw new Error("You already copy this basket"); // two taps at once: the unique index lets one through
  }
  const c = copyById(copyId)!;
  let placed = 0, spent = 0;
  for (let i = 0; i < v.weights.length; i++) {
    if (await buyLeg(c, b, v.weights[i].token, parts[i], "entry")) { placed++; spent += parts[i]; }
  }
  const failed = v.weights.length - placed;
  const status = placed === 0 ? "failed" : failed ? "partial" : "filled";
  setCopy(copyId, status, failed ? `${failed} of ${tokensText(v.weights.length)} didn't fill` : undefined);
  // One copy, however many tokens: creator pay and daily caps count the amount once.
  if (placed) recordCopy({ tradeId: -copyId, follower: viewer, leader: b.owner, usd: round2(spent), status: "dry-run", note: `Basket: ${b.name}` });
  return { copy: copyId, status, placed, failed, usd: round2(spent) };
}

/** What a copy holds, from its own filled orders, valued at the prices now. */
export async function copyValue(copyId: number): Promise<CopyValue> {
  const c = copyById(copyId);
  if (!c) throw new Error("Copy not found");
  const rows = db.prepare(`SELECT lower(json_extract(o.trade, '$.target')) AS token, json_extract(o.trade, '$.side') AS side, SUM(o.tokens) AS tokens, SUM(o.usd) AS usd
    FROM orders o JOIN basket_legs l ON o.trade_id = -l.id WHERE l.copy_id = ? AND o.status = 'filled' AND o.tokens IS NOT NULL GROUP BY 1, 2`).all(copyId) as { token: string; side: string; tokens: number; usd: number }[];
  const target = versionOf(c.basket, c.version);
  const by = new Map<string, { bought: number; boughtUsd: number; sold: number; soldUsd: number }>();
  for (const r of rows) {
    const e = by.get(r.token) ?? { bought: 0, boughtUsd: 0, sold: 0, soldUsd: 0 };
    if (r.side === "buy") { e.bought += r.tokens; e.boughtUsd += r.usd; } else { e.sold += r.tokens; e.soldUsd += r.usd; }
    by.set(r.token, e);
  }
  let invested = 0, proceeds = 0, value = 0;
  const holdings: Holding[] = [];
  for (const [token, e] of by) {
    invested += e.boughtUsd;
    proceeds += e.soldUsd;
    // Never more than the wallet has: the same token can also be sold from Positions.
    const qty = Math.max(0, Math.min(e.bought - e.sold, heldTokens(c.follower, token)));
    if (qty <= 1e-12) continue;
    const price = await getPrice(token).catch(() => (e.bought > 0 ? e.boughtUsd / e.bought : 0));
    const cost = e.bought > 0 ? (e.boughtUsd / e.bought) * qty : 0;
    value += qty * price;
    holdings.push({ token, symbol: symOf(token), qty, cost, price, value: qty * price, pnlPct: cost > 0 ? ((qty * price) / cost - 1) * 100 : 0, weightPct: 0, targetPct: target.weights.find((w) => w.token === token)?.weight ?? 0 });
  }
  for (const h of holdings) h.weightPct = value > 0 ? (h.value / value) * 100 : 0;
  holdings.sort((a, b) => b.value - a.value);
  const pnlUsd = value + proceeds - invested;
  return { holdings, invested, proceeds, value, pnlUsd, pnlPct: invested > 0 ? (pnlUsd / invested) * 100 : 0 };
}

/** Every copy a person has open, newest first. A copy whose stops sold everything shows as closed from here on. */
export async function copiesOf(viewer: number) {
  const rows = db.prepare(`SELECT * FROM basket_copies WHERE follower = ? AND status IN ${OPEN} ORDER BY id DESC`).all(viewer) as unknown as CopyRow[];
  const out: { copy: CopyRow; basket: BasketRow; value: CopyValue; request?: RequestRow }[] = [];
  for (const c of rows) {
    const value = await copyValue(c.id);
    if (await settleCopy(c, value)) continue;
    out.push({ copy: c, basket: basketById(c.basket)!, value, request: requestOf(c.id) });
  }
  return out;
}

/** Try the orders of a partly filled copy again. */
export async function retryCopy(viewer: number, copyId: number): Promise<{ placed: number; failed: number }> {
  requireSim();
  const c = copyById(copyId);
  if (!c || c.follower !== viewer) throw new Error("Copy not found");
  if (c.status !== "partial") throw new Error("Nothing to retry");
  const b = basketById(c.basket)!;
  const legs = db.prepare("SELECT id, token, trade, usd, kind FROM basket_legs WHERE copy_id = ? AND status = 'failed'").all(copyId) as { id: number; token: string; trade: string; usd: number; kind: string }[];
  // Guard stops new money going in, so a retry waits while the creator is paused.
  if ((await guardGate(b.owner)).halted && legs.some((l) => (JSON.parse(l.trade) as Trade).side === "buy")) throw new Error("This creator is paused by CopyGuard");
  let placed = 0, spent = 0;
  for (const l of legs) {
    db.prepare("UPDATE basket_legs SET status = 'retried' WHERE id = ?").run(l.id);
    const trade = JSON.parse(l.trade) as Trade;
    const ok = trade.side === "buy" ? await buyLeg(c, b, l.token, l.usd, l.kind) : await placeLeg(c, b.owner, l.token, l.kind, trade, l.usd);
    if (ok) { placed++; if (l.kind === "entry") spent += l.usd; }
  }
  const failed = legs.length - placed;
  setCopy(copyId, failed ? "partial" : "filled", failed ? `${failed} token${failed === 1 ? "" : "s"} still didn't fill` : undefined);
  if (spent) recordCopy({ tradeId: -copyId, follower: viewer, leader: b.owner, usd: round2(spent), status: "dry-run", note: `Basket: ${b.name}` });
  return { placed, failed };
}

/** Sell everything in a copy at market, after cancelling its stops. Also how a partly filled copy is unwound. */
export async function closeCopy(viewer: number, copyId: number): Promise<{ sold: number; failed: number; value: number }> {
  requireSim();
  const c = copyById(copyId);
  if (!c || c.follower !== viewer) throw new Error("Copy not found");
  if (c.status === "closed" || c.status === "failed") throw new Error("This copy is already closed");
  const b = basketById(c.basket)!;
  const { holdings, value } = await copyValue(copyId);
  let sold = 0, failed = 0;
  for (const h of holdings) {
    cancelExits(copyId, h.token);
    if (await placeLeg(c, b.owner, h.token, "close", sellTrade(h.token, h.qty), h.value)) sold++;
    else failed++;
  }
  // Anything still failing stays open, so it can be retried; the money is never shown as gone.
  setCopy(copyId, failed ? "partial" : "closed", failed ? `${failed} token${failed === 1 ? "" : "s"} couldn't be sold` : undefined);
  db.prepare("UPDATE basket_requests SET status = 'superseded' WHERE copy_id = ? AND status = 'open'").run(copyId);
  return { sold, failed, value };
}

// ---------- Rebalancing ----------

export interface RequestRow { id: number; copy_id: number; basket: number; version: number; status: string; at: number }
const requestOf = (copyId: number) => db.prepare("SELECT * FROM basket_requests WHERE copy_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").get(copyId) as unknown as RequestRow | undefined;
/** Rebalance requests waiting on this person. */
export const rebalanceRequests = (viewer: number) =>
  db.prepare("SELECT r.* FROM basket_requests r JOIN basket_copies c ON c.id = r.copy_id WHERE c.follower = ? AND r.status = 'open' ORDER BY r.id DESC").all(viewer) as unknown as RequestRow[];

/** The sells and buys that bring a copy to a version's weights, at today's prices. Moves under $1 are left alone. */
export async function rebalancePlan(copyId: number, version: number): Promise<RebalancePlan> {
  const c = copyById(copyId);
  if (!c) throw new Error("Copy not found");
  const { holdings, value } = await copyValue(copyId);
  const v = versionOf(c.basket, version);
  const held = new Map(holdings.map((h) => [h.token, h]));
  const plan: RebalancePlan = { total: value, sells: [], buys: [] };
  for (const h of holdings) {
    const want = (value * (v.weights.find((w) => w.token === h.token)?.weight ?? 0)) / 100;
    const excess = h.value - want;
    // A token leaving the basket sells in full, whatever its size.
    if (want === 0 || excess >= DUST_USD) plan.sells.push({ token: h.token, symbol: h.symbol, qty: want === 0 ? h.qty : excess / h.price, usd: excess });
  }
  for (const w of v.weights) {
    const short = (value * w.weight) / 100 - (held.get(w.token)?.value ?? 0);
    if (short >= DUST_USD) plan.buys.push({ token: w.token, symbol: w.symbol || symOf(w.token), usd: round2(short) });
  }
  return plan;
}

/** A follower approves a rebalance: sells first, then buys with what they raised. Nothing moves without this. */
export async function approveRebalance(viewer: number, requestId: number): Promise<{ sold: number; bought: number; failed: number }> {
  requireSim();
  const r = db.prepare("SELECT r.*, c.follower FROM basket_requests r JOIN basket_copies c ON c.id = r.copy_id WHERE r.id = ?").get(requestId) as unknown as (RequestRow & { follower: number }) | undefined;
  if (!r || r.follower !== viewer) throw new Error("Request not found");
  const b = basketById(r.basket)!;
  if ((await guardGate(b.owner)).halted) throw new Error("This creator is paused by CopyGuard. You can still close the copy.");
  // Claim it first: a second tap finds nothing open.
  if (db.prepare("UPDATE basket_requests SET status = 'approved' WHERE id = ? AND status = 'open'").run(requestId).changes === 0) throw new Error("That request was already handled");
  const c = copyById(r.copy_id)!;
  const plan = await rebalancePlan(c.id, r.version);
  let sold = 0, bought = 0, failed = 0, raised = 0;
  for (const s of plan.sells) {
    const before = (await copyValue(c.id)).holdings.find((h) => h.token === s.token);
    cancelExits(c.id, s.token);
    const ok = await placeLeg(c, b.owner, s.token, "rebalance", sellTrade(s.token, s.qty), s.usd);
    if (ok) { sold++; raised += s.usd; } else failed++;
    await reprotect(c, b, s.token, ok ? Math.max(0, (before?.qty ?? 0) - s.qty) : before?.qty ?? 0);
  }
  // Spend what was raised, never more: buys scale down if prices moved or a sale failed.
  const want = plan.buys.reduce((a, x) => a + x.usd, 0);
  const scale = want > 0 ? Math.min(1, raised / want) : 0;
  for (const x of plan.buys) {
    const usd = round2(x.usd * scale);
    if (usd < MIN_LEG_USD) continue;
    if (await buyLeg(c, b, x.token, usd, "rebalance")) bought++;
    else failed++;
  }
  db.prepare("UPDATE basket_copies SET version = ? WHERE id = ?").run(r.version, c.id);
  setCopy(c.id, failed ? "partial" : "filled", failed ? `${failed} rebalance order${failed === 1 ? "" : "s"} didn't fill` : undefined);
  return { sold, bought, failed };
}

/** A follower skips a rebalance: they keep what they hold, on the version they copied. */
export function skipRebalance(viewer: number, requestId: number) {
  const r = db.prepare("SELECT c.follower FROM basket_requests r JOIN basket_copies c ON c.id = r.copy_id WHERE r.id = ? AND r.status = 'open'").get(requestId) as { follower: number } | undefined;
  if (!r || r.follower !== viewer) throw new Error("Request not found");
  db.prepare("UPDATE basket_requests SET status = 'skipped' WHERE id = ?").run(requestId);
}

// ---------- Safety read ----------

export interface BasketRead { label: string; tone: "ok" | "warn" | "bad"; checks: { t: string; ok: boolean }[] }

/** The safety read on a basket: its protection, spread, record and creator, from the same data the page shows. */
export async function basketRead(v: BasketView): Promise<BasketRead> {
  const top = [...v.weights].sort((a, b) => b.weight - a.weight)[0];
  const paused = (await guardGate(v.owner)).halted;
  const checks = [
    paused ? { t: `@${v.handle} is paused by CopyGuard`, ok: false } : { t: `@${v.handle} passed CopyGuard`, ok: true },
    v.stopPct > 0 ? { t: `Every token has a stop at −${v.stopPct}%`, ok: true } : { t: "No stop-loss on any token", ok: false },
    isBroadFund(top.token) ? { t: `${top.symbol} is ${top.weight}% of it, a fund spread across hundreds of companies`, ok: true } : v.weights.length === 1 ? { t: `Holds only ${top.symbol}, so there's no spread`, ok: false } : top.weight > 60 ? { t: `${top.symbol} is ${top.weight}% of it, so it moves like one token`, ok: false } : { t: `Spread over ${v.weights.length} tokens, largest ${top.symbol} at ${top.weight}%`, ok: true },
    v.returnPct >= 0 ? { t: `Up ${v.returnPct.toFixed(1)}% since launch`, ok: true } : { t: `Down ${Math.abs(v.returnPct).toFixed(1)}% since launch`, ok: false },
  ];
  const bad = checks.filter((c) => !c.ok).length;
  return paused ? { label: "Paused", tone: "bad", checks } : bad === 0 ? { label: "Looks solid", tone: "ok", checks } : bad === 1 ? { label: "Check first", tone: "warn", checks } : { label: "Risky", tone: "bad", checks };
}
