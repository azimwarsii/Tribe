import { searchAsset } from "./flash.js";

export type PriceFn = (token: string) => Promise<number>;

const cache = new Map<string, { at: number; price: number }>();

/** Mark price in USD from Flash /search. Cached briefly to stay inside rate limits. */
const flashPrice: PriceFn = async (token) => {
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < 15_000) return hit.price;
  const a = await searchAsset(token);
  const price = Number(a?.price);
  if (!price) throw new Error(`no price for ${token}`);
  cache.set(token, { at: Date.now(), price });
  return price;
};

let provider: PriceFn = flashPrice;
/** Tests and offline demos can inject a price source. */
export const setPriceProvider = (fn: PriceFn) => (provider = fn);
export const getPrice: PriceFn = (t) => provider(t);

let demoP = Number(process.env.DEMO_START_PRICE ?? 2500);
/** DEMO=true: offline, gently moving ETH price so the whole app runs without a Flash key. */
export function enableDemoPrices() {
  setPriceProvider(async () => (demoP *= 1 + (Math.random() - 0.5) * 0.0008));
}
/** Start the demo price from a given level (the seed uses the live Flash price when recording with real prices). */
export const setDemoPrice = (p: number) => (demoP = p);
/** Demo director: move the demo price by a percentage (e.g. 4 = +4%). */
export const nudgeDemoPrice = (pct: number) => (demoP *= 1 + pct / 100);
