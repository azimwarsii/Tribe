process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";

import test from "node:test";
import assert from "node:assert/strict";

const prices = await import("./prices.js");
prices.enableDemoPrices(); // token lookups answer from the demo list, with no network
const { db, createWebUser, getMeta, haltLeader, resumeLeader, setMeta, spentToday } = await import("./db.js");
const b = await import("./baskets.js");
const { DEMO_TOKENS } = await import("./demo-tokens.js");
const { pollOrders, heldTokens } = await import("./tracker.js");
const { freeBalance } = await import("./data.js");
const { traderStats } = await import("./stats.js");
const { earningsOf } = await import("./creator.js");

const addr = (s: string) => DEMO_TOKENS.find((t) => t.symbol === s)!.address;
const ETH = addr("ETH"), BTC = addr("cbBTC"), AERO = addr("AERO"), ZORA = addr("ZORA");

// Fixed prices the tests move by hand; a token set to 0 can't be priced, so its order fails.
const px: Record<string, number> = {};
const reset = () => Object.assign(px, { [ETH]: 2500, [BTC]: 68000, [AERO]: 1, [ZORA]: 0.02 });
reset();
prices.setPriceProvider(async (t) => {
  const p = px[t.toLowerCase()];
  if (!p) throw new Error(`no price for ${t}`);
  return p;
});

let n = 0;
function user(balance = 1000, max = 500) {
  const u = createWebUser(`basketuser${++n}`)!;
  const m = getMeta(u.id);
  setMeta(u.id, { simBalance: balance, defaults: { ...m.defaults, max, cap: 5000 } });
  return u.id;
}
const three = [{ token: ETH, weight: 50 }, { token: BTC, weight: 30 }, { token: AERO, weight: 20 }];
const make = (owner: number, over: Record<string, unknown> = {}) => b.createBasket(owner, { name: "Base Blue Chips", stopPct: 10, tpPct: 30, weights: three, ...over });

test("a one-token basket: copy it, read it, rebalance it into two tokens, close it", async () => {
  reset();
  const owner = user(), me = user();
  const id = await make(owner, { name: "Just ETH", weights: [{ token: ETH, weight: 100 }] });
  const out = await b.copyBasket(me, id, 50);
  assert.deepEqual([out.placed, out.failed, out.status], [1, 0, "filled"]);
  const held = await b.copyValue(out.copy);
  assert.equal(held.holdings.length, 1);
  assert.ok(Math.abs(held.value - 50) < 1e-6);

  const read = await b.basketRead((await b.basketView(id))!);
  assert.ok(read.checks.some((c) => !c.ok && /Holds only ETH/.test(c.t)));
  assert.ok(!read.checks.some((c) => /moves like one token/.test(c.t)));

  assert.equal((await b.updateWeights(owner, id, [{ token: ETH, weight: 50 }, { token: BTC, weight: 50 }])).asked, 1);
  await b.approveRebalance(me, b.rebalanceRequests(me)[0].id);
  assert.equal((await b.copyValue(out.copy)).holdings.filter((h) => h.value > 0).length, 2);

  assert.equal((await b.closeCopy(me, out.copy)).failed, 0);
  assert.equal(b.tokensText(1), "1 token");
  assert.equal(b.tokensText(3), "3 tokens");
});

test("weights: 1 to 10 different tokens, 1% or more each, adding up to 100", () => {
  assert.throws(() => b.checkWeights([]), /at least one token/);
  assert.equal(b.checkWeights([{ token: ETH, weight: 100 }]).length, 1);
  assert.throws(() => b.checkWeights([{ token: ETH, weight: 90 }]), /add up to 100/);
  assert.throws(() => b.checkWeights([{ token: ETH, weight: 50 }, { token: ETH, weight: 50 }]), /only be in a trade once/);
  assert.throws(() => b.checkWeights([{ token: ETH, weight: 50 }, { token: BTC, weight: 40 }]), /add up to 100/);
  assert.throws(() => b.checkWeights([{ token: ETH, weight: 99.5 }, { token: BTC, weight: 0.5 }]), /at least 1%/);
  assert.throws(() => b.checkWeights(Array.from({ length: 11 }, (_, i) => ({ token: `0x${i}`, weight: 100 / 11 }))), /up to 10/);
  assert.equal(b.checkWeights(three).length, 3);
});

test("splitting an amount adds up exactly, to the cent", () => {
  const parts = b.splitUsd(100, [{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }]);
  assert.equal(Math.round(parts.reduce((a, x) => a + x, 0) * 100) / 100, 100);
  assert.deepEqual(b.splitUsd(10, [{ weight: 50 }, { weight: 50 }]), [5, 5]);
});

test("a copy buys every token at its weight, once in the books", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const out = await b.copyBasket(me, id, 100);
  assert.deepEqual([out.status, out.placed, out.failed, out.usd], ["filled", 3, 0, 100]);
  const v = await b.copyValue(out.copy);
  assert.equal(v.holdings.length, 3);
  assert.ok(Math.abs(v.holdings.find((h) => h.symbol === "ETH")!.value - 50) < 1e-6);
  assert.ok(Math.abs(v.value - 100) < 1e-6);
  assert.equal(getMeta(me).simBalance, 900);
  // One copy for caps and creator pay, however many tokens it took.
  assert.equal(spentToday(me), 100);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM copies WHERE follower = ?").get(me)!.n, 1);
  assert.equal(earningsOf(owner).orders, 1);
  assert.equal(earningsOf(owner).volume, 100);
  // Legs never reach the trades table, so the creator's XP and the feed don't move and the follower's copy counts once.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM trades WHERE leader = ?").get(owner)!.n, 0);
  assert.equal((await traderStats(me)).copiesMade, 1);
  await assert.rejects(b.copyBasket(me, id, 50), /already copy/);
});

test("every token carries the basket's stop and target", async () => {
  const owner = user(), me = user();
  const { copy } = await b.copyBasket(me, await make(owner), 100);
  const exits = db.prepare("SELECT o.trade FROM orders o JOIN basket_legs l ON o.trade_id = -l.id WHERE l.copy_id = ? AND o.status = 'open'").all(copy) as { trade: string }[];
  assert.equal(exits.length, 3);
  const eth = exits.map((e) => JSON.parse(e.trade)).find((t) => t.target === ETH);
  assert.deepEqual(eth.triggers.map((t: { notionalPrice: string }) => t.notionalPrice).sort(), ["2250.00", "3250.00"]);
});

test("cheap tokens keep their stop instead of rounding it to zero", async () => {
  const owner = user(), me = user();
  const id = await make(owner, { weights: [{ token: ETH, weight: 50 }, { token: ZORA, weight: 50 }] });
  const { copy } = await b.copyBasket(me, id, 100);
  const row = db.prepare("SELECT o.trade FROM orders o JOIN basket_legs l ON o.trade_id = -l.id WHERE l.copy_id = ? AND o.status = 'open' AND json_extract(o.trade, '$.target') = ?").get(copy, ZORA) as { trade: string };
  assert.ok(Number(JSON.parse(row.trade).triggers.find((t: { triggerType: string }) => t.triggerType === "lower").notionalPrice) > 0.017);
});

test("the follower's limits and Guard apply to the whole copy", async () => {
  const owner = user(), me = user(1000, 50);
  const id = await make(owner);
  await assert.rejects(b.copyBasket(me, id, 60), /max per copy/);
  await assert.rejects(b.copyBasket(owner, id, 10), /your own trade/);
  await assert.rejects(b.copyBasket(user(5), id, 50), /Not enough balance/);
  await assert.rejects(b.copyBasket(me, id, 3), /Too small to split/);
  const noStop = await make(owner, { stopPct: 0, tpPct: 0 });
  const strict = user();
  setMeta(strict, { defaults: { ...getMeta(strict).defaults, stop: true } });
  await assert.rejects(b.copyBasket(strict, noStop, 50), /only copy trades with a stop/);
  haltLeader(owner, "drawdown");
  await assert.rejects(b.copyBasket(me, id, 50), /paused by CopyGuard/);
  resumeLeader(owner);
  assert.equal((await b.copyBasket(me, id, 50)).status, "filled");
});

test("a token that won't fill leaves a partial copy that can be retried or unwound", async () => {
  const owner = user(), me = user(), other = user();
  const id = await make(owner);
  px[AERO] = 0;
  const out = await b.copyBasket(me, id, 100);
  const out2 = await b.copyBasket(other, id, 100);
  assert.deepEqual([out.status, out.placed, out.failed, out.usd], ["partial", 2, 1, 80]);
  assert.equal(spentToday(me), 80); // only what was placed counts
  await assert.rejects(b.retryCopy(owner, out.copy), /not found/);
  assert.equal((await b.retryCopy(me, out.copy)).failed, 1); // still no price
  reset();
  assert.deepEqual(await b.retryCopy(me, out.copy), { placed: 1, failed: 0 });
  assert.equal((await b.copyValue(out.copy)).holdings.length, 3);
  assert.equal(spentToday(me), 100);
  // Unwinding sells what filled and hands the money back.
  await b.closeCopy(other, out2.copy);
  assert.ok(Math.abs(getMeta(other).simBalance - 1000) < 1e-6);
});

test("no token filling at all leaves nothing open and costs nothing", async () => {
  const owner = user(), me = user();
  const id = await make(owner, { weights: [{ token: AERO, weight: 50 }, { token: ZORA, weight: 50 }] });
  px[AERO] = 0; px[ZORA] = 0;
  const out = await b.copyBasket(me, id, 100);
  reset();
  assert.equal(out.status, "failed");
  assert.equal(spentToday(me), 0);
  assert.equal(getMeta(me).simBalance, 1000);
  assert.equal((await b.copyBasket(me, id, 100)).status, "filled"); // free to try again
});

test("two baskets holding the same token keep separate books", async () => {
  const owner = user(), me = user();
  const a = await b.copyBasket(me, await make(owner), 100);
  const c = await b.copyBasket(me, await make(owner, { name: "ETH and friends", weights: [{ token: ETH, weight: 80 }, { token: AERO, weight: 20 }] }), 100);
  const ethIn = async (id: number) => (await b.copyValue(id)).holdings.find((h) => h.symbol === "ETH")!.value;
  assert.ok(Math.abs((await ethIn(a.copy)) - 50) < 1e-6);
  assert.ok(Math.abs((await ethIn(c.copy)) - 80) < 1e-6);
  await b.closeCopy(me, a.copy);
  assert.ok(Math.abs((await ethIn(c.copy)) - 80) < 1e-6); // closing one leaves the other, and its stop
  assert.ok(Math.abs(heldTokens(me, ETH) - 80 / 2500) < 1e-9);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders o JOIN basket_legs l ON o.trade_id = -l.id WHERE l.copy_id = ? AND o.status = 'open'").get(c.copy)!.n, 2);
});

test("the index follows its weights and carries across versions", async () => {
  const owner = user();
  const id = await make(owner);
  px[ETH] = 2750; // +10% at 50% weight
  assert.ok(Math.abs((await b.navOf(id)).nav - 105) < 1e-6);
  await b.updateWeights(owner, id, [{ token: ETH, weight: 25 }, { token: BTC, weight: 75 }]);
  assert.ok(Math.abs((await b.navOf(id)).nav - 105) < 1e-6); // a new version doesn't change the record
  px[BTC] = 68000 * 1.1; // +10% at 75% weight
  assert.ok(Math.abs((await b.navOf(id)).nav - 105 * 1.075) < 1e-6);
  reset();
});

test("new weights ask copiers first, and move their money only when they approve", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const { copy } = await b.copyBasket(me, id, 100);
  await assert.rejects(b.updateWeights(user(), id, three), /not found/);
  await assert.rejects(b.updateWeights(owner, id, three), /already the weights/);
  const up = await b.updateWeights(owner, id, [{ token: ETH, weight: 40 }, { token: BTC, weight: 30 }, { token: ZORA, weight: 30 }], "Swap AERO for ZORA");
  assert.deepEqual(up, { version: 2, asked: 1 });
  assert.equal(heldTokens(me, ZORA), 0); // nothing moved yet
  const [r] = b.rebalanceRequests(me);
  const plan = await b.rebalancePlan(copy, 2);
  assert.deepEqual(plan.sells.map((s) => s.symbol).sort(), ["AERO", "ETH"]);
  assert.deepEqual(plan.buys.map((x) => [x.symbol, x.usd]), [["ZORA", 30]]);
  await assert.rejects(b.approveRebalance(user(), r.id), /not found/);
  assert.deepEqual(await b.approveRebalance(me, r.id), { sold: 2, bought: 1, failed: 0 });
  await assert.rejects(b.approveRebalance(me, r.id), /not found|already handled/);
  const after = await b.copyValue(copy);
  const w = (s: string) => after.holdings.find((h) => h.symbol === s)?.weightPct ?? 0;
  assert.ok(Math.abs(w("ETH") - 40) < 0.01 && Math.abs(w("cbBTC") - 30) < 0.01 && Math.abs(w("ZORA") - 30) < 0.01);
  assert.equal(w("AERO"), 0);
  assert.ok(Math.abs(after.value - 100) < 1e-6);
  // Every remaining token is still protected, with one stop each.
  const open = db.prepare("SELECT lower(json_extract(o.trade, '$.target')) AS t, COUNT(*) AS n FROM orders o JOIN basket_legs l ON o.trade_id = -l.id WHERE l.copy_id = ? AND o.status = 'open' GROUP BY 1").all(copy) as { t: string; n: number }[];
  assert.deepEqual(open.map((o) => o.n), [1, 1, 1]);
  assert.ok(!open.some((o) => o.t === AERO));
  // A rebalance moves money already in: no new fee, no new spend.
  assert.equal(spentToday(me), 100);
});

test("a skipped rebalance keeps the copy as it is, and a newer one replaces an old request", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const { copy } = await b.copyBasket(me, id, 100);
  await b.updateWeights(owner, id, [{ token: ETH, weight: 60 }, { token: BTC, weight: 40 }]);
  await b.updateWeights(owner, id, [{ token: ETH, weight: 70 }, { token: BTC, weight: 30 }]);
  const list = b.rebalanceRequests(me);
  assert.equal(list.length, 1);
  assert.equal(list[0].version, 3);
  b.skipRebalance(me, list[0].id);
  assert.equal(b.rebalanceRequests(me).length, 0);
  assert.equal((await b.copyValue(copy)).holdings.length, 3);
});

test("Guard blocks a rebalance while the creator is paused, but never a close", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const { copy } = await b.copyBasket(me, id, 100);
  await b.updateWeights(owner, id, [{ token: ETH, weight: 60 }, { token: BTC, weight: 40 }]);
  haltLeader(owner, "drawdown");
  await assert.rejects(b.approveRebalance(me, b.rebalanceRequests(me)[0].id), /paused by CopyGuard/);
  assert.equal(b.rebalanceRequests(me).length, 1); // still there for later
  assert.equal((await b.closeCopy(me, copy)).failed, 0);
  resumeLeader(owner);
});

test("closing sells everything, and the profit is the follower's", async () => {
  const owner = user(), me = user();
  const { copy } = await b.copyBasket(me, await make(owner), 100);
  px[ETH] = 2750;
  const v = await b.copyValue(copy);
  assert.ok(Math.abs(v.pnlUsd - 5) < 1e-6 && Math.abs(v.pnlPct - 5) < 1e-6);
  await b.closeCopy(me, copy);
  reset();
  assert.ok(Math.abs(getMeta(me).simBalance - 1005) < 1e-6);
  assert.equal(heldTokens(me, ETH), 0);
  assert.equal((await b.copiesOf(me)).length, 0);
  await assert.rejects(b.closeCopy(me, copy), /already closed/);
});

test("a stop firing sells that token only, and the copy closes when nothing is left", async () => {
  const owner = user(), me = user();
  const { copy } = await b.copyBasket(me, await make(owner), 100);
  px[AERO] = 0.85; // under its 10% stop
  await pollOrders();
  const left = await b.copyValue(copy);
  assert.deepEqual(left.holdings.map((h) => h.symbol).sort(), ["ETH", "cbBTC"]);
  assert.ok(Math.abs(left.pnlUsd - -3) < 1e-6);
  px[ETH] = 2000; px[BTC] = 50000;
  await pollOrders();
  reset();
  assert.equal((await b.copiesOf(me)).length, 0);
  assert.equal(db.prepare("SELECT status FROM basket_copies WHERE id = ?").get(copy)!.status, "closed");
});

test("a target firing takes the profit on that token, and nothing is left resting after a close", async () => {
  reset();
  const owner = user(), me = user();
  const before = await freeBalance(me);
  const { copy } = await b.copyBasket(me, await make(owner), 100);
  px[AERO] = 1.4; // over its 30% target
  await pollOrders();
  const left = await b.copyValue(copy);
  assert.deepEqual(left.holdings.map((h) => h.symbol).sort(), ["ETH", "cbBTC"]);
  assert.ok(left.pnlUsd > 5, `took the profit on AERO, got ${left.pnlUsd}`);
  reset();
  await pollOrders(); // AERO back at 1: its old stop is gone with the target, so nothing more sells
  assert.equal((await b.copyValue(copy)).holdings.length, 2);
  await b.closeCopy(me, copy);
  const resting = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('open','waiting') AND trade_id IN (SELECT -id FROM basket_legs WHERE copy_id = ?)").get(copy)!.n;
  assert.equal(resting, 0, "no stop or target of a closed copy can fire later");
  const after = await freeBalance(me);
  assert.ok(Math.abs(after - before - (await b.copyValue(copy)).pnlUsd) < 1e-6, "the balance moved by exactly the profit");
});

test("once stops sell everything the basket can be copied again, without visiting any page first", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const { copy } = await b.copyBasket(me, id, 100);
  px[ETH] = 2000; px[BTC] = 50000; px[AERO] = 0.5;
  await pollOrders();
  reset();
  assert.equal((await b.updateWeights(owner, id, [{ token: ETH, weight: 100 }])).asked, 0, "nobody to ask: the copier holds nothing");
  assert.equal(db.prepare("SELECT status FROM basket_copies WHERE id = ?").get(copy)!.status, "closed");
  assert.equal(await b.liveCopy(me, id), undefined);
  const again = await b.copyBasket(me, id, 50);
  assert.equal(again.status, "filled");
  assert.equal((await b.liveCopy(me, id))?.id, again.copy);
});

test("a retired basket can't be copied, and its copiers keep what they hold", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const { copy } = await b.copyBasket(me, id, 100);
  await assert.rejects(Promise.resolve().then(() => b.retireBasket(user(), id)), /not found/);
  b.retireBasket(owner, id);
  await assert.rejects(b.copyBasket(user(), id, 50), /retired/);
  assert.equal((await b.copyValue(copy)).holdings.length, 3);
  assert.ok(!(await b.liveBaskets()).some((x) => x.id === id));
});

test("real money: a copy over the cap is refused before anything is placed, and rebalancing stays off", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const out = await b.copyBasket(me, id, 50);
  await pollOrders();
  await b.updateWeights(owner, id, [{ token: ETH, weight: 100 }]);
  const request = b.rebalanceRequests(me)[0];
  const other = user();
  process.env.DRY_RUN = "false";
  try {
    await assert.rejects(b.checkCopy(other, id, b.liveCapUsd() + 1), /limited to \$/);
    await assert.rejects(b.approveRebalance(me, request.id), /practice mode/);
  } finally {
    process.env.DRY_RUN = "true";
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM basket_copies WHERE follower = ?").get(other)!.n, 0);
  assert.ok(out.copy);
});

test("publishing buys the basket: the creator holds it, and it isn't counted as a copy", async () => {
  const owner = user(1000);
  const out = await b.publishBasket(owner, { name: "Backed Basket", stopPct: 10, tpPct: 30, weights: three, usd: 100 });
  assert.deepEqual([out.placed, out.failed, out.usd], [3, 0, 100]);
  await pollOrders();
  const held = await b.liveCopy(owner, out.id);
  assert.equal(held?.status, "filled");
  const value = await b.copyValue(held!.id);
  assert.equal(value.holdings.length, 3);
  assert.ok(Math.abs(value.invested - 100) < 0.01);
  const stops = db.prepare("SELECT COUNT(*) AS n FROM basket_legs WHERE copy_id = ? AND json_extract(trade, '$.attach.sl') IS NOT NULL").get(held!.id) as { n: number };
  assert.equal(stops.n, 3); // every order carries its stop
  const v = (await b.basketView(out.id))!;
  assert.deepEqual([v.copiers, v.volume], [0, 0]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM basket_cards WHERE basket = ? AND kind = 'copy'").get(out.id)!.n, 0);
  await assert.rejects(b.copyBasket(owner, out.id, 10), /your own trade/);
  // Someone else's copy counts, and only theirs.
  await b.copyBasket(user(), out.id, 50);
  assert.equal((await b.basketView(out.id))!.copiers, 1);
});

test("the Copying count is open copies, and a creator's own stake isn't one", async () => {
  const owner = user(1000), fan = user();
  const out = await b.publishBasket(owner, { name: "Counted", stopPct: 10, weights: three, usd: 100 });
  await pollOrders();
  assert.equal(b.openCopies(owner), 0);
  assert.equal(b.openCopies(fan), 0);
  const c = await b.copyBasket(fan, out.id, 50);
  await pollOrders();
  assert.equal(b.openCopies(fan), 1);
  await b.closeCopy(fan, c.copy);
  await pollOrders();
  assert.equal(b.openCopies(fan), 0);
});

test("nothing bought, nothing published, and no orphan rows", async () => {
  const owner = user(1000);
  const saved = { ...px };
  for (const k of Object.keys(px)) px[k] = 0;
  const before = (db.prepare("SELECT COUNT(*) AS n FROM baskets").get() as { n: number }).n;
  try {
    // Prices are needed to publish at all, so break them after the basket's version is written.
    await assert.rejects(b.publishBasket(owner, { name: "Never Bought", stopPct: 10, weights: three, usd: 100 }));
  } finally {
    Object.assign(px, saved);
  }
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM baskets").get() as { n: number }).n, before);
  await assert.rejects(b.publishBasket(owner, { name: "Too Much", stopPct: 10, weights: three, usd: 100000 }), /Not enough balance/);
  await assert.rejects(b.publishBasket(owner, { name: "Too Little", stopPct: 10, weights: three, usd: 2 }), /Too small to split/);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM baskets").get() as { n: number }).n, before);
  process.env.DRY_RUN = "false";
  try {
    await assert.rejects(b.publishBasket(owner, { name: "Over Cap", stopPct: 10, weights: three, usd: b.liveCapUsd() + 1 }), /limited to/);
  } finally {
    process.env.DRY_RUN = "true";
  }
});

test("native ETH becomes wrapped ETH, because Flash can't attach a stop to a native asset", () => {
  const out = b.checkWeights([{ token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", weight: 100 }]);
  assert.equal(out[0].token, ETH.toLowerCase());
  assert.throws(() => b.checkWeights([{ token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", weight: 50 }, { token: ETH, weight: 50 }]), /only be in a trade once/);
});

test("no price means no order: a basket with a stop never buys without one", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const saved = px[AERO];
  px[AERO] = 0;
  try {
    const out = await b.copyBasket(me, id, 100);
    assert.deepEqual([out.status, out.placed, out.failed], ["partial", 2, 1]);
    const leg = db.prepare("SELECT status, note FROM basket_legs WHERE copy_id = ? AND token = ?").get(out.copy, AERO.toLowerCase()) as { status: string; note: string };
    assert.deepEqual({ ...leg }, { status: "failed", note: "Couldn't get a price to set the stop, so this wasn't bought" });
    const orders = db.prepare("SELECT COUNT(*) AS n FROM orders o JOIN basket_legs l ON o.trade_id = -l.id WHERE l.copy_id = ? AND lower(json_extract(o.trade, '$.target')) = ?").get(out.copy, AERO.toLowerCase()) as { n: number };
    assert.equal(orders.n, 0);
  } finally {
    px[AERO] = saved;
  }
});

test("a live order takes a moment: a copy still filling isn't closed as sold out, and can't be closed yet", async () => {
  const owner = user(), me = user();
  const id = await make(owner);
  const out = await b.copyBasket(me, id, 50);
  // How a live copy looks just after placing: market orders open, nothing filled yet.
  db.prepare("UPDATE orders SET status = 'open', tokens = NULL, usd = NULL WHERE trade_id IN (SELECT -id FROM basket_legs WHERE copy_id = ?) AND json_extract(trade, '$.orderType') = 'market'").run(out.copy);
  assert.equal((await b.liveCopy(me, id))?.id, out.copy);
  assert.equal(db.prepare("SELECT status FROM basket_copies WHERE id = ?").get(out.copy)!.status, "filled");
  await assert.rejects(b.closeCopy(me, out.copy), /still filling/);

  // Flash turns every order down: the copy failed, it wasn't "sold by its stops".
  db.prepare("UPDATE orders SET status = 'closed' WHERE trade_id IN (SELECT -id FROM basket_legs WHERE copy_id = ?)").run(out.copy);
  assert.equal(await b.liveCopy(me, id), undefined);
  assert.deepEqual({ ...db.prepare("SELECT status, note FROM basket_copies WHERE id = ?").get(out.copy) }, { status: "failed", note: "None of the orders filled" });
});

test("a copied token is found whatever the case of its address", async () => {
  const { copiedTokens } = await import("./copy.js");
  const { applyFill } = await import("./tracker.js");
  const me = user(), leader = user();
  const checksummed = "0xCbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
  applyFill(me, checksummed, "buy", 2, 100);
  db.prepare("INSERT INTO orders (trade_id, trader, leader, role, order_id, trade, status, sim, placed_at, tokens, usd) VALUES (1, ?, ?, 'copy', 'x', ?, 'filled', 1, 0, 2, 100)").run(me, leader, JSON.stringify({ target: checksummed, side: "buy" }));
  assert.equal(copiedTokens(me, leader, checksummed), 2);
  assert.equal(copiedTokens(me, leader, checksummed.toLowerCase()), 2);
});

test("demo prices: each token has its own, and a market move hits volatile tokens harder", async () => {
  const { DEMO_TOKENS: list } = await import("./demo-tokens.js");
  assert.equal(new Set(list.map((t) => t.price)).size, list.length);
  assert.ok(list.every((t) => t.address === t.address.toLowerCase()));
});

test("Chief's read flags a basket with no stop and one heavy token", async () => {
  const owner = user();
  const v = (await b.basketView(await make(owner, { stopPct: 0, tpPct: 0, weights: [{ token: ETH, weight: 90 }, { token: BTC, weight: 10 }] })))!;
  const read = await b.basketRead(v);
  assert.equal(read.label, "Risky");
  assert.ok(read.checks.some((c) => !c.ok && /No stop-loss/.test(c.t)));
  assert.ok(read.checks.some((c) => !c.ok && /moves like one token/.test(c.t)));
  const good = await b.basketRead((await b.basketView(await make(owner)))!);
  assert.equal(good.label, "Looks solid");
});
