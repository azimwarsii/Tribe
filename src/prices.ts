import { searchAsset } from "./flash.js";
import { DEMO_TOKENS, demoToken } from "./demo-tokens.js";

export type PriceFn = (token: string) => Promise<number>;

const cache = new Map<string, { at: number; price: number }>();

/** Mark price in USD from Flash /search. Cached briefly to stay inside rate limits. */
const flashPrice: PriceFn = async (token) => {
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < 15_000) return hit.price;
  // The price source allows one call a second, so a recent price stands in when it's busy.
  const a = await searchAsset(token).catch((e) => {
    if (hit && Date.now() - hit.at < 120_000) return undefined;
    throw e;
  });
  if (!a && hit) return hit.price;
  const price = Number(a?.price);
  if (!price) throw new Error(`no price for ${token}`);
  cache.set(token, { at: Date.now(), price });
  return price;
};

let provider: PriceFn = flashPrice;
/** Tests and offline demos can inject a price source. */
export const setPriceProvider = (fn: PriceFn) => (provider = fn);
const broken = new Set<string>();
/** Demo director: make a token fail for a moment, to show a partly filled basket. */
export const breakToken = (token: string, on: boolean) => void (on ? broken.add(token.toLowerCase()) : broken.delete(token.toLowerCase()));
export const getPrice: PriceFn = (t) => (broken.has(t.toLowerCase()) ? Promise.reject(new Error(`no price for ${t}`)) : provider(t));

let demoP = Number(process.env.DEMO_START_PRICE ?? 2500);
let demoOn = false;
/** Every demo token other than ETH walks on its own; ETH is `demoP`, and any unknown token follows it. */
const demoOthers = new Map(DEMO_TOKENS.filter((t) => t.symbol !== "ETH").map((t) => [t.address, t.price]));
const walk = (p: number, beta = 1) => p * (1 + (Math.random() - 0.5) * 0.0008 * beta);

/** DEMO=true: offline, gently moving prices (one per token) so the whole app runs without a Flash key. */
export function enableDemoPrices() {
  demoOn = true;
  setPriceProvider(async (token) => {
    const t = demoToken(token);
    const p = t && demoOthers.get(t.address);
    if (t && p !== undefined) {
      const next = walk(p, t.beta);
      demoOthers.set(t.address, next);
      return next;
    }
    return (demoP = walk(demoP));
  });
}
/** Back to the starting list, which is where a freshly started server begins. */
export const resetDemoPrices = () => {
  demoP = Number(process.env.DEMO_START_PRICE ?? 2500);
  for (const t of DEMO_TOKENS) if (demoOthers.has(t.address)) demoOthers.set(t.address, t.price);
};
/** Offline demo prices are on: token lookups answer from the demo list instead of Flash. */
export const demoPricesOn = () => demoOn;
/** Start the demo price from a given level (the seed uses the live Flash price when recording with real prices). */
export const setDemoPrice = (p: number) => (demoP = p);
/** Demo director: move the market by a percentage (e.g. 4 = ETH +4%). Other tokens move by their beta. */
export const nudgeDemoPrice = (pct: number) => {
  demoP *= 1 + pct / 100;
  for (const t of DEMO_TOKENS) {
    const p = demoOthers.get(t.address);
    if (p !== undefined) demoOthers.set(t.address, p * Math.max(0.05, 1 + (pct * t.beta) / 100));
  }
};
/** Move one demo token by a percentage, so a demo can show a single holding running away from the rest. */
export const nudgeDemoToken = (token: string, pct: number) => {
  const t = demoToken(token);
  const p = t && demoOthers.get(t.address);
  if (p !== undefined && t) demoOthers.set(t.address, p * (1 + pct / 100));
  else demoP *= 1 + pct / 100;
};
