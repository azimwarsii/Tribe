/**
 * What kind of asset a token is, and what that makes a basket.
 *
 * Classes come from a reviewed list of contract addresses, never from a token's name or a creator's own tag: names are
 * copied by fakes, and a creator could tag memes as majors to get into a filter. A token nobody has reviewed is
 * "Unclassified" and counts as the riskiest kind until it is. To add one, confirm its address with the issuer first.
 *
 * A basket's mix is worked out from its weights each time, so it follows every new version and needs no stored copy.
 */

export type AssetClass = "major" | "stock" | "alt" | "meme" | "other";
export type RiskLevel = "steady" | "balanced" | "aggressive";

/** `risk` is a rough size of swings next to ETH and BTC, used only to band baskets. It is not a forecast. */
export const ASSET_CLASSES: Record<AssetClass, { label: string; color: string; risk: number }> = {
  major: { label: "Major coins", color: "#34D399", risk: 1 },
  stock: { label: "US stocks", color: "#7DD3FC", risk: 1.2 },
  alt: { label: "Altcoins", color: "#FBBF24", risk: 2 },
  meme: { label: "Meme coins", color: "#F472B6", risk: 3 },
  other: { label: "Unclassified", color: "#A3A3A3", risk: 3 },
};

export const RISK_LEVELS: Record<RiskLevel, { label: string; color: string }> = {
  steady: { label: "Steady", color: "#34D399" },
  balanced: { label: "Balanced", color: "#FCD34D" },
  aggressive: { label: "Aggressive", color: "#F87171" },
};

const REGISTRY: Record<string, AssetClass> = {
  "0x4200000000000000000000000000000000000006": "major", // WETH
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "major", // cbBTC
  "0x9c5c365e764829876243d0b289733b9d2b729685": "stock", // deSPXA: Janus Henderson Anemoy S&P 500 fund, wrapped by Centrifuge
  // Coinbase tokenized stocks, checked against base.org/assets on 2026-11-06. Lookalikes exist, some sharing the 0xb200 start.
  "0xb20000000000000000000078ee7ce2fe4908108c": "stock", // NVDAc
  "0xb2000000000000000000008bc8786b856e61707c": "stock", // METAc
  "0xb200000000000000000000c2e324d24d7eecd1fb": "stock", // AAPLc
  "0xb2000000000000000000002d0ba3164cc74f58b7": "stock", // GOOGLc
  "0xb200000000000000000000d9192b6b456483c2e8": "stock", // AMZNc
  "0xb200000000000000000000ab99cfa739e253872b": "stock", // MSFTc
  "0xb2000000000000000000004884b426556b92883d": "stock", // MSTRc
  "0xb200000000000000000000397293cb8cda9a10c5": "stock", // SNDKc
  "0xb2000000000000000000007b9fcbd005511acbd5": "stock", // SPCXc
  "0xb2000000000000000000001e800a7f5189430cd0": "stock", // TSLAc
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": "alt", // AERO
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "alt", // VIRTUAL
  "0x1111111111166b7fe7bd91427724b487980afc69": "alt", // ZORA
  "0x532f27101965dd16442e59d40670faf5ebb142e4": "meme", // BRETT
  "0x4ed4e862860bed51a9570b96d89af5e1b0efefed": "meme", // DEGEN
  "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4": "meme", // TOSHI
};

export const assetClassOf = (token: string): AssetClass => REGISTRY[token.toLowerCase()] ?? "other";

/** One token, many companies: being mostly in a broad fund isn't concentration. A single stock wouldn't belong here. */
const BROAD_FUNDS = new Set(["0x9c5c365e764829876243d0b289733b9d2b729685"]);
export const isBroadFund = (token: string) => BROAD_FUNDS.has(token.toLowerCase());

/** Tokens that don't swing like the rest of their class: a broad fund less, Strategy more (it trades like leveraged Bitcoin). */
const TOKEN_RISK: Record<string, number> = { "0x9c5c365e764829876243d0b289733b9d2b729685": 0.6, "0xb2000000000000000000004884b426556b92883d": 2 };
const tokenRisk = (token: string) => TOKEN_RISK[token.toLowerCase()] ?? ASSET_CLASSES[assetClassOf(token)].risk;

export interface MixPart { cls: AssetClass; label: string; color: string; pct: number }

/** A basket's weight in each class, largest first, in whole percents that always add up to 100. */
export function basketMix(weights: { token: string; weight: number }[]): MixPart[] {
  const sums = new Map<AssetClass, number>();
  for (const w of weights) sums.set(assetClassOf(w.token), (sums.get(assetClassOf(w.token)) ?? 0) + w.weight);
  const total = [...sums.values()].reduce((a, b) => a + b, 0) || 1;
  const parts = [...sums].map(([cls, sum]) => { const exact = (sum / total) * 100; return { cls, exact, pct: Math.floor(exact) }; });
  // Largest remainders take the leftover points, so three thirds read 34, 33, 33 rather than 99 in total.
  let left = 100 - parts.reduce((a, p) => a + p.pct, 0);
  for (const p of [...parts].sort((a, b) => b.exact - b.pct - (a.exact - a.pct))) if (left-- > 0) p.pct++;
  return parts.sort((a, b) => b.pct - a.pct).map(({ cls, pct }) => ({ cls, label: ASSET_CLASSES[cls].label, color: ASSET_CLASSES[cls].color, pct }));
}

/** How much of a basket sits in one class. */
export const exposure = (mix: MixPart[], cls: AssetClass) => mix.find((m) => m.cls === cls)?.pct ?? 0;

/** A basket only counts as holding a class from this share up: a 5% stock sleeve doesn't make a meme basket "US stocks". */
export const MATCH_PCT = 25;

/** A band from what's in the basket; having no stop-loss moves it up one, since nothing limits the fall. */
export function basketRisk(weights: { token: string; weight: number }[], stopPct: number): RiskLevel {
  const total = weights.reduce((a, w) => a + w.weight, 0) || 1;
  const score = weights.reduce((a, w) => a + (w.weight / total) * tokenRisk(w.token), 0);
  const band = score <= 1.1 ? 0 : score <= 1.75 ? 1 : 2;
  return (["steady", "balanced", "aggressive"] as const)[Math.min(2, band + (stopPct > 0 ? 0 : 1))];
}

/** Filtering baskets by what's in them, for the agent API (`/api/v1/baskets?asset=`). */
export type AssetFilter = "all" | "major" | "stock" | "alt" | "meme" | "steady";
export const ASSET_FILTERS: [AssetFilter, string][] = [["all", "All"], ["major", "Major coins"], ["stock", "US stocks"], ["alt", "Altcoins"], ["meme", "Meme coins"], ["steady", "Steady"]];
export const assetFilter = (f: unknown): AssetFilter => ASSET_FILTERS.find(([k]) => k === f)?.[0] ?? "all";

export const matchesFilter = (v: { mix: MixPart[]; risk: RiskLevel }, f: AssetFilter) =>
  f === "all" ? true : f === "steady" ? v.risk === "steady" : exposure(v.mix, f) >= MATCH_PCT;
