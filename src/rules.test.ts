import test from "node:test";
import assert from "node:assert/strict";
import { decide, protectCopy, type FollowRules } from "./rules.js";
import type { Trade } from "./flash.js";

const WETH = "0x4200000000000000000000000000000000000006";
const rules: FollowRules = { mode: "ask", ratio: 1, maxUsdPerTrade: 50, dailyCapUsd: 100, tokens: [], orderTypes: [], copyProtective: true, requireStop: false, paused: false, guardOverride: false };
const buy: Trade = { chain: "base", target: WETH, contra: "0xusdc", side: "buy", qty: "30", orderType: "market" };
const ctx = { spentToday: 0, halted: false };

test("passes through with follower mode", () => {
  assert.deepEqual(decide(buy, rules, ctx), { action: "ask", qty: "30", usd: 30 });
  assert.equal(decide(buy, { ...rules, mode: "auto" }, ctx).action, "auto");
});
test("halted leader is skipped", () => {
  assert.equal(decide(buy, rules, { ...ctx, halted: true }).action, "skip");
});
test("clamps to max per trade", () => {
  const d = decide({ ...buy, qty: "500" }, rules, ctx);
  assert.deepEqual(d, { action: "ask", qty: "50", usd: 50 });
});
test("daily cap blocks", () => {
  assert.equal(decide(buy, rules, { ...ctx, spentToday: 80 }).action, "skip");
});
test("token and order type filters", () => {
  assert.equal(decide(buy, { ...rules, tokens: ["0xother"] }, ctx).action, "skip");
  assert.equal(decide(buy, { ...rules, tokens: [WETH.toLowerCase()] }, ctx).action, "ask");
  assert.equal(decide(buy, { ...rules, orderTypes: ["bracket"] }, ctx).action, "skip");
});
test("protective toggle", () => {
  const sl: Trade = { ...buy, side: "sell", qty: "0.01", orderType: "stop-loss" };
  assert.equal(decide(sl, { ...rules, copyProtective: false }, ctx).action, "skip");
  assert.equal(decide(sl, rules, ctx).action, "ask");
});
test("ratio scales size", () => {
  assert.equal((decide(buy, { ...rules, ratio: 0.5 }, ctx) as any).qty, "15");
});

test("pause switches", () => {
  assert.equal(decide(buy, rules, { ...ctx, pausedAll: true }).action, "skip");
  assert.equal(decide(buy, { ...rules, paused: true }, ctx).action, "skip");
});
test("risk line skips unless overridden", () => {
  const hi = { ...ctx, risk: 91, riskLine: 65 };
  const d = decide(buy, rules, hi);
  assert.equal(d.action, "skip");
  assert.match((d as { reason: string }).reason, /CopyGuard/);
  assert.equal(decide(buy, rules, { ...ctx, risk: 40, riskLine: 65 }).action, "ask");
  assert.equal(decide(buy, { ...rules, guardOverride: true }, hi).action, "ask");
  assert.equal(decide(buy, { ...rules, guardOverride: true }, { ...hi, halted: true }).action, "ask");
});
test("stop-loss required filter", () => {
  const r = { ...rules, requireStop: true };
  assert.equal(decide(buy, r, ctx).action, "skip");
  assert.equal(decide({ ...buy, hasStop: true }, r, ctx).action, "ask");
});
test("auto without permission falls back to ask", () => {
  assert.equal(decide(buy, { ...rules, mode: "auto" }, { ...ctx, autoPermission: false }).action, "ask");
  assert.equal(decide(buy, { ...rules, mode: "auto" }, { ...ctx, autoPermission: true }).action, "auto");
});

test("per-trader budget", () => {
  const r = { ...rules, budgetUsd: 100 };
  assert.equal(decide(buy, r, { ...ctx, budgetUsed: 60 }).action, "ask");
  const d = decide(buy, r, { ...ctx, budgetUsed: 80 });
  assert.equal(d.action, "skip");
});
test("own stop: added to a copy without one, replaces the leader's only when safer", () => {
  const mine = { ...rules, stopPct: 8 };
  assert.equal(protectCopy(buy, mine, 2000).followStop, "1840.00");
  assert.equal(protectCopy(buy, rules, 2000).followStop, undefined); // no own stop set
  const bracket: Trade = { ...buy, attach: { tp: "2300", sl: "1900" } };
  assert.equal(protectCopy(bracket, mine, 2000).attach?.sl, "1900"); // theirs (5%) is safer than 8%
  assert.equal(protectCopy(bracket, { ...rules, stopPct: 3 }, 2000).attach?.sl, "1940.00");
  assert.equal(protectCopy(bracket, { ...mine, copyProtective: false }, 2000), bracket); // protective orders off
  assert.equal(protectCopy({ ...buy, side: "sell" }, mine, 2000).followStop, undefined);
});
test("stop-required filter is met by the follower's own stop", () => {
  assert.equal(decide(buy, { ...rules, requireStop: true }, ctx).action, "skip");
  assert.equal(decide(buy, { ...rules, requireStop: true, stopPct: 8 }, ctx).action, "ask");
});
