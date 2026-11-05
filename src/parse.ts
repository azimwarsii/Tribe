import type { Trade } from "./flash.js";

export const USDC ="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base
export const TOKENS: Record<string, string> = {
  WETH: "0x4200000000000000000000000000000000000006",
  ETH: "0x4200000000000000000000000000000000000006",
};

/**
 * buy ETH 50 | sell ETH 0.01 | limit ETH 100 2000 | stop ETH 0.01 1800 | tp ETH 0.01 5000
 * bracket ETH 0.01 5000 1800 | twap ETH 100 1800 12   (duration seconds, buckets)
 * long ETH 50 5000 1800 (buy $50 with take-profit and stop attached: one Flash order) | stopbuy ETH 50 2600 (breakout buy)
 */
export function parseTrade(args: string[]): Trade {
  const [kind, sym, qty, a, b] = args;
  const target = TOKENS[(sym ?? "").toUpperCase()];
  if (!target) throw new Error(`Unknown token ${sym}. Try ETH.`);
  const base = { chain: "base", target, contra: USDC, qty };
  switch (kind) {
    case "buy":
    case "sell":
      return { ...base, side: kind, orderType: "market" };
    case "limit":
      return { ...base, side: "buy", orderType: "limit", limitNotionalPrice: a };
    case "stop":
      return { ...base, side: "sell", orderType: "stop-loss", triggers: [{ notionalPrice: a, triggerType: "lower" }] };
    case "tp":
      return { ...base, side: "sell", orderType: "take-profit", triggers: [{ notionalPrice: a, triggerType: "upper" }] };
    case "bracket":
      return {
        ...base,
        side: "sell",
        orderType: "bracket",
        triggers: [
          { notionalPrice: a, triggerType: "upper" },
          { notionalPrice: b, triggerType: "lower" },
        ],
      };
    case "twap":
      return { ...base, side: "buy", orderType: "twap", durationSeconds: Number(a), twapBucketCount: Number(b) };
    case "long":
      if (!(Number(a) > Number(b))) throw new Error("Usage: /trade long ETH <usd> <take-profit> <stop>, take-profit above stop");
      return { ...base, side: "buy", orderType: "market", attach: { tp: a, sl: b }, hasStop: true };
    case "stopbuy":
      return { ...base, side: "buy", orderType: "stop", triggers: [{ notionalPrice: a, triggerType: "upper" }] };
    default:
      throw new Error("Usage: /trade buy|sell|long|limit|stop|tp|bracket|stopbuy|twap <TOKEN> <qty> [args]");
  }
}
