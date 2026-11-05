process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";
process.env.SESSION_SECRET = "test";

import test from "node:test";
import assert from "node:assert/strict";

const db = await import("./db.js");
const prices = await import("./prices.js");
const copy = await import("./copy.js");
const tracker = await import("./tracker.js");
const stats = await import("./stats.js");
const askMod = await import("./ask.js");
const parse = await import("./parse.js");
const auth = await import("./auth.js");

let price = 2000;
prices.setPriceProvider(async () => price);
const WETH = parse.TOKENS.ETH;

test("leader trade fans out by rules and tracks PnL", async () => {
  for (const id of [1, 2, 3]) { db.getUser(id); db.setMeta(id, { simBalance: 1000 }); }
  db.setFollow(2, 1, { mode: "auto" });
  db.setFollow(3, 1); // ask-first
  const res = await copy.mirror(1, parse.parseTrade(["buy", "ETH", "100"]));
  assert.equal(res.executed.length, 1);
  assert.equal(res.pending.length, 1);
  price = 2200; // +10%
  assert.ok(Math.abs((await stats.totalPnl(1)).pct - 10) < 1e-6);
  assert.ok(Math.abs((await stats.totalPnl(2)).pct - 10) < 1e-6);
  assert.equal((await stats.totalPnl(3)).invested, 0); // never approved
});

test("approved pending executes once", async () => {
  price = 2000; // back at the leader's entry: within the chase limit, so it buys at market
  const [p] = db.pendingFor(3);
  const claim = db.claimPending(p.id, 3, "approved");
  assert.ok(claim);
  await copy.execute(claim!.tradeId, 3, claim!.leader, claim!.trade);
  assert.equal(db.claimPending(p.id, 3, "approved"), undefined);
  assert.ok((await stats.totalPnl(3)).invested > 0);
});

test("simulated bracket take-profit realises PnL", async () => {
  price = 2000;
  const bracket = parse.parseTrade(["bracket", "ETH", "0.05", "2400", "1800"]);
  await copy.mirror(1, bracket);
  price = 2450;
  await tracker.pollOrders();
  const p = stats.positionsOf(1).find((x) => x.token === WETH.toLowerCase())!;
  assert.ok(p.realized > 0);
  assert.ok(p.qty < 100 / 2000 + 1e-9);
});

test("CopyGuard halt skips copies and is recorded as Saved by Guard", async () => {
  db.haltLeader(1, "drawdown 22% in 1h");
  const res = await copy.mirror(1, parse.parseTrade(["buy", "ETH", "10"]));
  assert.equal(res.executed.length, 0);
  assert.equal(res.skipped.length, 2);
  db.resumeLeader(1);
  assert.ok((await stats.traderStats(2)).badges.some((b) => b.id === "saved-by-guard"));
});

test("ranking and leaderboard tabs", async () => {
  const top = await stats.ranking("profit");
  assert.ok(top.length >= 1);
  assert.ok((await stats.ranking("copied"))[0].copiedByOthers >= 1);
});

test("ask intent parsing and proposal", async () => {
  const i = askMod.parseIntent("buy $50 ETH with 5% stop and 12% take profit")!;
  assert.deepEqual([i.side, i.usd, i.stopPct, i.tpPct], ["buy", 50, 5, 12]);
  price = 2000;
  const p = await askMod.buildProposal(i);
  // One Flash order: the bracket rides the entry.
  assert.equal(p.trades.length, 1);
  assert.equal(p.trades[0].orderType, "market");
  assert.deepEqual(p.trades[0].attach, { tp: "2240.00", sl: "1900.00" });
  assert.equal(p.card?.kind, "Bracket order");
  // Stop only: entry plus a separate stop-loss.
  const s = await askMod.buildProposal(askMod.parseIntent("buy $50 ETH with 5% stop")!);
  assert.deepEqual(s.trades.map((t) => t.orderType), ["market", "stop-loss"]);
  assert.equal(askMod.parseIntent("hello"), undefined);
  // "target" works as well as "take profit"
  for (const s of ["buy $20 ETH with a 5% stop and 12% target", "buy $20 eth, stop 5%, target +12%"]) {
    const x = askMod.parseIntent(s)!;
    assert.deepEqual([x.usd, x.stopPct, x.tpPct], [20, 5, 12], s);
  }
});

test("attached bracket becomes a protective order sized from the fill, for leader and followers", async () => {
  price = 2000;
  db.getUser(41);
  db.getUser(42);
  db.setMeta(41, { simBalance: 1000 });
  db.setMeta(42, { simBalance: 1000, perm: true });
  db.setFollow(42, 41, { mode: "auto", ratio: 0.5, maxUsdPerTrade: 50 });
  const r = await copy.mirror(41, parse.parseTrade(["long", "ETH", "100", "2300", "1900"]));
  assert.equal(r.executed.length, 1);
  const prot = (trader: number) => db.db.prepare("SELECT trade, parent, status FROM orders WHERE trader = ? AND json_extract(trade,'$.orderType') = 'bracket'").get(trader) as { trade: string; parent: number; status: string };
  for (const [trader, usd] of [[41, 100], [42, 50]] as const) {
    const b = prot(trader);
    assert.equal(b.status, "open");
    assert.ok(b.parent > 0);
    const t = JSON.parse(b.trade);
    assert.equal(Number(t.qty).toFixed(6), (usd / 2000).toFixed(6)); // exactly what the entry received
    assert.deepEqual(t.triggers.map((x: { notionalPrice: string }) => x.notionalPrice), ["2300", "1900"]);
  }
  // The stop fires on a price drop and closes the position.
  price = 1850;
  await tracker.pollOrders();
  assert.equal(prot(41).status, "filled");
  assert.ok(tracker.heldTokens(41, parse.TOKENS.ETH) < 1e-9);
});

test("a protective sell waits until the tokens are held", async () => {
  price = 2000;
  db.getUser(43);
  db.setMeta(43, { simBalance: 500 });
  await copy.mirror(43, parse.parseTrade(["stop", "ETH", "0.01", "1900"]));
  const row = () => db.db.prepare("SELECT status, trade FROM orders WHERE trader = 43 AND json_extract(trade,'$.orderType') = 'stop-loss'").get() as { status: string; trade: string };
  assert.equal(row().status, "waiting");
  await copy.mirror(43, parse.parseTrade(["buy", "ETH", "10"])); // 0.005 ETH
  await tracker.pollOrders();
  assert.equal(row().status, "open");
  assert.equal(Number(JSON.parse(row().trade).qty).toFixed(6), "0.005000"); // clamped to what is held
});

test("login tokens verify and expire", () => {
  const t = auth.makeLoginToken(7);
  const res: any = { setHeader() {} };
  assert.equal(auth.consumeLogin(t, res), 7);
  assert.equal(auth.consumeLogin(t.slice(0, -1) + (t.endsWith("0") ? "1" : "0"), res), undefined);
  assert.equal(auth.consumeLogin(auth.makeLoginToken(7, -1), res), undefined);
});

test("simulated balance is debited, credited and gated", async () => {
  const before = db.getMeta(2).simBalance;
  await copy.mirror(3, parse.parseTrade(["buy", "ETH", "10"]));
  db.getUser(9);
  db.setFollow(9, 1, { mode: "auto" });
  const res = await copy.mirror(1, parse.parseTrade(["buy", "ETH", "10"]));
  assert.ok(res.executed.some((x) => x.startsWith("9:") && x.includes("failed: Not enough free balance")));
  assert.ok(db.getMeta(2).simBalance <= before);
});

test("per-trader copy PnL and open positions", async () => {
  price = 2600;
  const m = await (await import("./data.js")).copyPnlByLeader(2);
  assert.ok((m.get(1)?.copied ?? 0) > 0);
  const open = await (await import("./data.js")).openPositions(2);
  assert.ok(open.length >= 1 && open[0].symbol === "ETH");
});

// ---------- Flash conformance: request shapes, fills, cancels, sizing ----------

test("Flash request shapes: expireTime and tight approvals are quote-only; batch cancel message is exact", async () => {
  const flash = await import("./flash.js");
  const base = { chain: "base", target: WETH, contra: parse.USDC } as const;
  const until = "2026-12-01T00:00:00.000Z";
  const limit = { ...base, side: "buy" as const, qty: "5", orderType: "limit" as const, limitNotionalPrice: "2000", expireTime: until };
  const q = flash.quoteBody(limit, "0xabc", undefined, { tight: true }) as Record<string, unknown>;
  assert.equal(q.expireTime, until);
  assert.equal(q.evmUsePermit2, true);
  assert.equal(q.forceMinimalAllowance, true);
  assert.equal(q.flashIntegratorFeeBps, "0", "no fee on the shared public key: it would go to Definitive, not Tribe");
  process.env.FLASH_API_KEY = "tribe-own-key";
  try {
    assert.equal((flash.quoteBody(limit, "0xabc", undefined, { tight: true }) as Record<string, unknown>).flashIntegratorFeeBps, "50"); // a string, as Flash requires
  } finally { delete process.env.FLASH_API_KEY; }
  const echo = flash.submitEcho(limit, "0xabc", undefined, { tight: true });
  for (const k of ["expireTime", "evmUsePermit2", "forceMinimalAllowance", "durationSeconds", "attachedBracket"]) assert.ok(!(k in echo), `${k} must not be echoed on submit`);
  // Market and TWAP never carry expireTime (Flash rejects it on TWAP; market has its own ~5 min deadline).
  assert.ok(!("expireTime" in flash.quoteBody({ ...limit, orderType: "market" }, "0xabc")));
  assert.ok(!("expireTime" in flash.quoteBody({ ...limit, orderType: "twap", durationSeconds: 600 }, "0xabc")));
  assert.equal(flash.batchCancelMessage(["AAA-1", "bbb-2"]), "Definitive Flash v1 — Cancel Orders\nOrders:\naaa-1\nbbb-2");
  assert.match(flash.closeReasonText("REASON_EXECUTION_COST_EXCEEDS_LIMIT")!, /over 30%/);
});

test("fills apply as they grow: a TWAP partly filled then cancelled keeps what filled", async () => {
  const uid = 61;
  db.getUser(uid);
  const t = parse.parseTrade(["twap", "ETH", "100", "1800", "6"]);
  db.db.prepare("INSERT INTO orders (trade_id, trader, leader, role, order_id, trade, sim, placed_at, status) VALUES (999, ?, ?, 'own', 'live-twap-1', ?, 0, ?, 'open')").run(uid, uid, JSON.stringify(t), Date.now());
  const row = db.db.prepare("SELECT id, trade_id, trader, leader, role, order_id, trade, sim, status FROM orders WHERE order_id = 'live-twap-1'").get() as unknown as import("./tracker.js").OrderRow;
  const slice = (n: number) => ({ targetAmount: String(0.01 * n), contraAmount: String(20 * n), averagePrice: "2000", averageNotionalPrice: "2000" });
  await tracker.applyOrderInfo(row, { status: "ORDER_STATUS_PARTIALLY_FILLED", closeReason: null, filled: slice(1), attachedBracket: null });
  assert.ok(Math.abs(tracker.heldTokens(uid, WETH) - 0.01) < 1e-12);
  await tracker.applyOrderInfo(row, { status: "ORDER_STATUS_PARTIALLY_FILLED", closeReason: null, filled: slice(2), attachedBracket: null });
  assert.ok(Math.abs(tracker.heldTokens(uid, WETH) - 0.02) < 1e-12, "only the new slice is applied");
  await tracker.applyOrderInfo(row, { status: "ORDER_STATUS_CANCELLED", closeReason: "REASON_MAXIMUM_SLIPPAGE_EXCEEDED", filled: slice(2), attachedBracket: null });
  const after = db.db.prepare("SELECT status, tokens, usd, close_reason FROM orders WHERE id = ?").get(row.id) as { status: string; tokens: number; usd: number; close_reason: string };
  assert.deepEqual([after.status, after.tokens, after.usd, after.close_reason], ["filled", 0.02, 40, "REASON_MAXIMUM_SLIPPAGE_EXCEEDED"]);
  assert.ok(Math.abs(tracker.heldTokens(uid, WETH) - 0.02) < 1e-12, "the partial fill stays in the position");
});

test("a leader cancelling a resting order cancels followers' matching copies", async () => {
  const [lead, fol] = [71, 72];
  for (const id of [lead, fol]) { db.getUser(id); db.setMeta(id, { simBalance: 1000 }); }
  db.setFollow(fol, lead, { mode: "auto" });
  price = 2000;
  const res = await copy.mirror(lead, { ...parse.parseTrade(["limit", "ETH", "50", "1800"]), hasStop: true }); // rests: price is above the limit
  const copyRow = db.db.prepare("SELECT status FROM orders WHERE trade_id = ? AND trader = ? AND role = 'copy'").get(res.tradeId, fol) as { status: string };
  assert.equal(copyRow.status, "open", "the copied limit rests like the leader's");
  const own = db.db.prepare("SELECT id, trade_id, trader, leader, role, order_id, trade, sim, status FROM orders WHERE trade_id = ? AND role = 'own'").get(res.tradeId) as unknown as import("./tracker.js").OrderRow;
  await tracker.applyOrderInfo(own, { status: "ORDER_STATUS_CANCELLED", closeReason: null, filled: null, attachedBracket: null });
  const after = db.db.prepare("SELECT status, close_reason FROM orders WHERE trade_id = ? AND trader = ? AND role = 'copy'").get(res.tradeId, fol) as { status: string; close_reason: string };
  assert.deepEqual([after.status, after.close_reason], ["closed", "LEADER_CANCELLED"]);
});

test("a leader's partial sell copies as the same share of what each follower copied", async () => {
  const [lead, small, big] = [81, 82, 83];
  for (const id of [lead, small, big]) { db.getUser(id); db.setMeta(id, { simBalance: 1000 }); }
  db.setFollow(small, lead, { mode: "auto", ratio: 0.25 });
  db.setFollow(big, lead, { mode: "auto", ratio: 1 });
  price = 2000;
  await copy.mirror(lead, { ...parse.parseTrade(["buy", "ETH", "40"]), hasStop: true });
  const held = (id: number) => tracker.heldTokens(id, WETH);
  const before = { small: held(small), big: held(big) };
  assert.ok(before.small > 0 && before.big > before.small);
  await copy.mirror(lead, parse.parseTrade(["sell", "ETH", String(held(lead) * 0.4)])); // the leader sells 40%
  assert.ok(Math.abs(held(small) - before.small * 0.6) < 1e-9, "small follower sold 40% of theirs");
  assert.ok(Math.abs(held(big) - before.big * 0.6) < 1e-9, "big follower sold 40% of theirs");
});

test("chase limit: a copy after the price ran away becomes a 30-minute limit at the leader's price plus the limit", async () => {
  const [lead, fol] = [91, 92];
  for (const id of [lead, fol]) { db.getUser(id); db.setMeta(id, { simBalance: 1000 }); }
  db.setMeta(fol, { defaults: { ...db.getMeta(fol).defaults, chase: 1 } });
  db.setFollow(fol, lead, { mode: "ask" });
  price = 2000;
  const res = await copy.mirror(lead, { ...parse.parseTrade(["buy", "ETH", "20"]), hasStop: true });
  price = 2100; // +5% before the follower approves
  await copy.execute(res.tradeId, fol, lead, res.pending[0].trade);
  const row = db.db.prepare("SELECT status, trade FROM orders WHERE trade_id = ? AND trader = ? AND role = 'copy'").get(res.tradeId, fol) as { status: string; trade: string };
  const t = JSON.parse(row.trade);
  assert.deepEqual([row.status, t.orderType, t.limitNotionalPrice], ["open", "limit", "2020.00"]);
  assert.ok(Date.parse(t.expireTime) > Date.now() + 29 * 60_000);
  assert.match((db.db.prepare("SELECT note FROM copies WHERE trade_id = ? AND follower = ?").get(res.tradeId, fol) as { note: string }).note, /Limit at \$2020\.00/);
  price = 2015; // comes back under the limit
  await tracker.pollOrders();
  assert.ok(tracker.heldTokens(fol, WETH) > 0, "the limit filled once the price came back");
  price = 2000;
});

test("own stop: a copy without a stop gets the follower's; a leader's bracket keeps the safer stop", async () => {
  price = 2000;
  const [lead, eight, none, three] = [301, 302, 303, 304];
  for (const id of [lead, eight, none, three]) { db.getUser(id); db.setMeta(id, { simBalance: 1000, perm: true }); }
  db.setFollow(eight, lead, { mode: "auto", stopPct: 8 });
  db.setFollow(none, lead, { mode: "auto" });
  db.setFollow(three, lead, { mode: "auto", stopPct: 3 });
  const stops = (trader: number, type: string) => db.db.prepare("SELECT trade, status FROM orders WHERE trader = ? AND json_extract(trade,'$.orderType') = ?").all(trader, type) as { trade: string; status: string }[];
  await copy.mirror(lead, parse.parseTrade(["buy", "ETH", "100"]));
  const [own] = stops(eight, "stop-loss");
  assert.equal(own.status, "open");
  assert.deepEqual(JSON.parse(own.trade).triggers, [{ notionalPrice: "1840.00", triggerType: "lower" }]);
  assert.equal(Number(JSON.parse(own.trade).qty).toFixed(6), (50 / 2000).toFixed(6)); // the $50 copy, not more
  assert.equal(stops(none, "stop-loss").length, 0);
  await copy.mirror(lead, parse.parseTrade(["long", "ETH", "100", "2300", "1900"]));
  const sl = (trader: number) => JSON.parse(stops(trader, "bracket")[0].trade).triggers.map((x: { notionalPrice: string }) => x.notionalPrice);
  assert.deepEqual(sl(eight), ["2300", "1900"]); // the leader's 5% stop is safer than 8%
  assert.deepEqual(sl(three), ["2300", "1940.00"]); // 3% is safer than the leader's
  // The follower's own stop fires on a drop and sells only that copy.
  price = 1830;
  await tracker.pollOrders();
  assert.equal(stops(eight, "stop-loss")[0].status, "filled");
  price = 2000;
});

test("a leader raising their stop raises copiers' stops, never lowers them", async () => {
  price = 2000;
  const [lead, fol] = [311, 312];
  for (const id of [lead, fol]) { db.getUser(id); db.setMeta(id, { simBalance: 1000, perm: true }); }
  db.setFollow(fol, lead, { mode: "auto" });
  await copy.mirror(lead, parse.parseTrade(["long", "ETH", "100", "2300", "1900"]));
  await tracker.moveStop(lead, WETH, 1950, tracker.heldTokens(lead, WETH));
  assert.equal(await copy.mirrorStopMove(lead, WETH, 1950), 1);
  assert.equal(tracker.stopOf(fol, WETH), 1950);
  assert.equal(await copy.mirrorStopMove(lead, WETH, 1920), 0); // lower than theirs: left alone
  assert.equal(tracker.stopOf(fol, WETH), 1950);
  assert.equal(await copy.mirrorStopMove(lead, WETH, 2050), 0); // above the price: would fire at once
});

test("a CopyGuard pause sells what opted-in copiers copied from that trader, and nothing else", async () => {
  price = 2000;
  const [lead, other, optIn, optOut] = [321, 324, 322, 323];
  for (const id of [lead, other, optIn, optOut]) { db.getUser(id); db.setMeta(id, { simBalance: 1000, perm: true }); }
  db.setFollow(optIn, lead, { mode: "auto", closeOnPause: true });
  db.setFollow(optOut, lead, { mode: "auto" });
  db.setFollow(optIn, other, { mode: "auto" });
  await copy.mirror(other, parse.parseTrade(["buy", "ETH", "40"]));
  await copy.mirror(lead, parse.parseTrade(["long", "ETH", "100", "2300", "1900"]));
  const fired: number[] = [];
  db.haltListeners.push((l) => fired.push(l));
  db.haltLeader(lead, "test pause");
  db.haltLeader(lead, "seen again"); // only the first transition fires
  db.haltListeners.pop();
  assert.deepEqual(fired, [lead]);
  const out = await copy.closeCopiesOf(lead);
  assert.equal(out.length, 1);
  assert.ok(copy.copiedTokens(optIn, lead, WETH) < 1e-12);
  assert.ok(Math.abs(tracker.heldTokens(optIn, WETH) - 40 / 2000) < 1e-9, "the copy from the other trader stays");
  const bracket = db.db.prepare("SELECT status FROM orders WHERE trader = ? AND leader = ? AND json_extract(trade,'$.orderType') = 'bracket'").get(optIn, lead) as { status: string };
  assert.equal(bracket.status, "closed");
  assert.ok(Math.abs(tracker.heldTokens(optOut, WETH) - 50 / 2000) < 1e-9, "a copier who did not opt in keeps theirs");
  db.resumeLeader(lead);
});

test("the operator's freeze stops every copy, leaders still trade, and lifting it resumes copying", async () => {
  price = 2000;
  const [lead, fol] = [331, 332];
  for (const id of [lead, fol]) { db.getUser(id); db.setMeta(id, { simBalance: 1000, perm: true }); }
  db.setFollow(fol, lead, { mode: "auto" });
  db.setCopyFreeze("Flash outage");
  const r = await copy.mirror(lead, parse.parseTrade(["buy", "ETH", "20"]));
  assert.ok(!r.own.startsWith("failed"), "the leader's own trade still goes through");
  assert.deepEqual([r.executed.length, r.skipped.length], [0, 1]);
  assert.match(await copy.execute(r.tradeId, fol, lead, { ...parse.parseTrade(["buy", "ETH", "20"]) }), /^failed: Tribe paused all copying: Flash outage/);
  assert.equal(tracker.heldTokens(fol, WETH), 0);
  db.setCopyFreeze(undefined);
  assert.equal(db.copyFreeze(), undefined);
  assert.equal((await copy.mirror(lead, parse.parseTrade(["buy", "ETH", "20"]))).executed.length, 1);
});

test("a Telegram sign-in link works once and is never a session by itself", () => {
  const t = auth.makeLoginToken(8);
  const cookies: string[] = [];
  const res = { setHeader: (_k: string, v: string) => cookies.push(v) } as never;
  assert.equal(auth.consumeLogin(t, res), 8);
  assert.equal(auth.consumeLogin(t, res), undefined, "second use is refused");
  assert.equal(auth.sessionOf(t), undefined, "a link token is not a session token");
  const session = /tribe=([^;]+)/.exec(cookies[0])![1];
  assert.equal(auth.sessionOf(session)?.user, 8);
});
