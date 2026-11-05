import { db } from "./db.js";
import { searchAsset, type FlashAsset } from "./flash.js";
import { TOKENS } from "./parse.js";
import { DEMO_TOKENS, demoToken, type DemoToken } from "./demo-tokens.js";
import { demoPricesOn } from "./prices.js";

export { priceStr, qtyStr } from "./numfmt.js";

/**
 * Tokens you can trade on Base: anything Flash can route, found through Flash search. Search results include fakes
 * and dust pools, so a token is tradable only if Flash doesn't risk-flag it and it has real liquidity.
 * Tokens seen are remembered (symbol, decimals, image) so cards and positions can name them.
 */

db.exec("CREATE TABLE IF NOT EXISTS tokens (address TEXT PRIMARY KEY, symbol TEXT NOT NULL, name TEXT, decimals INTEGER, image TEXT, updated INTEGER NOT NULL)");

export const MIN_LIQUIDITY = () => Number(process.env.MIN_TOKEN_LIQUIDITY ?? 100_000);
const BASE_SEARCH = "https://flash.definitive.fi/v1/search";
const PUBLIC = "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";
const KEY = () => process.env.FLASH_API_KEY || PUBLIC;

export interface TokenView { address: string; symbol: string; name: string; price: number; change24h: number; liquidity: number; image: string | null; ok: boolean; why?: string }

const view = (a: FlashAsset & { name?: string; imageUrl?: string }): TokenView => {
  const liquidity = Number(a.liquidity) || 0;
  const why = a.riskFlagged ? "Flagged as risky by Flash" : liquidity < MIN_LIQUIDITY() ? `Too thin to trade safely ($${Math.round(liquidity).toLocaleString("en-US")} liquidity)` : undefined;
  return { address: a.address, symbol: a.symbol, name: a.name ?? a.symbol, price: Number(a.price) || 0, change24h: Number(a.priceChange24h) * 100 || 0, liquidity, image: a.imageUrl ?? null, ok: !why, why };
};

export function rememberToken(a: { address: string; symbol: string; name?: string; decimals?: number; imageUrl?: string | null }) {
  db.prepare("INSERT INTO tokens (address, symbol, name, decimals, image, updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(address) DO UPDATE SET symbol = excluded.symbol, name = excluded.name, decimals = excluded.decimals, image = excluded.image, updated = excluded.updated")
    .run(a.address.toLowerCase(), a.symbol, a.name ?? null, a.decimals ?? null, a.imageUrl ?? null, Date.now());
}

const demoView = (t: DemoToken): TokenView => ({ address: t.address, symbol: t.symbol, name: t.name, price: t.price, change24h: t.change24h, liquidity: t.liquidity, image: null, ok: true });

export const knownSymbol = (address: string) =>
  (db.prepare("SELECT symbol FROM tokens WHERE address = ?").get(address.toLowerCase()) as { symbol: string } | undefined)?.symbol;

const cache = new Map<string, { at: number; out: TokenView[] }>();
/** Flash search on Base: best matches first (most liquid), safe ones before flagged or thin ones. */
export async function searchTokens(q: string, limit = 8): Promise<TokenView[]> {
  const key = q.trim().toLowerCase().slice(0, 60);
  if (!key) return [];
  if (demoPricesOn()) return DEMO_TOKENS.filter((t) => t.symbol.toLowerCase().includes(key) || t.name.toLowerCase().includes(key) || t.address === key).map(demoView);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.out;
  const url = `${BASE_SEARCH}?query=${encodeURIComponent(key)}&chain=base&limit=${limit}`;
  let r = await fetch(url, { headers: { "x-definitive-api-key": KEY() }, signal: AbortSignal.timeout(15_000) });
  // Search not enabled for Tribe's own key yet: the shared public key (search carries no fee).
  if (r.status === 403 && KEY() !== PUBLIC) r = await fetch(url, { headers: { "x-definitive-api-key": PUBLIC }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(r.status === 429 ? "Flash is busy, try again in a moment" : `Token search failed (${r.status})`);
  const j = (await r.json()) as { assets?: (FlashAsset & { name?: string; imageUrl?: string; decimals?: number })[] };
  const out = (j.assets ?? []).filter((a) => a.address.toLowerCase() !== "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913").map(view)
    .sort((a, b) => Number(b.ok) - Number(a.ok) || b.liquidity - a.liquidity);
  for (const a of j.assets ?? []) rememberToken(a);
  cache.set(key, { at: Date.now(), out });
  return out;
}

/** One token by address, checked: Flash knows it, it isn't flagged, and it's liquid enough. Throws with the reason. */
export async function tradableToken(address: string): Promise<TokenView> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Pick a token from the list");
  if (demoPricesOn()) {
    const t = demoToken(address);
    if (!t) throw new Error("That token isn't in the demo list");
    return demoView(t);
  }
  const a = (await searchAsset(address)) as (FlashAsset & { name?: string; imageUrl?: string; decimals?: number }) | undefined;
  if (!a || a.address.toLowerCase() !== address.toLowerCase()) throw new Error("Flash can't trade that token on Base");
  rememberToken(a);
  const v = view(a);
  if (!v.ok) throw new Error(`${v.symbol}: ${v.why}`);
  return v;
}

const POPULAR = ["WETH", "cbBTC", "AERO", "VIRTUAL", "BRETT", "DEGEN", "TOSHI", "ZORA"];
let popular: { at: number; out: TokenView[] } | undefined;
/** A starting list before anything is typed: the most liquid safe match for each well-known Base token. */
export async function popularTokens(): Promise<TokenView[]> {
  if (demoPricesOn()) return DEMO_TOKENS.map(demoView);
  if (popular && Date.now() - popular.at < 10 * 60_000) return popular.out;
  const out: TokenView[] = [];
  for (const sym of POPULAR) {
    const best = (await searchTokens(sym, 5).catch(() => [])).find((t) => t.ok && t.symbol.toLowerCase() === sym.toLowerCase());
    if (best) out.push(sym === "WETH" ? { ...best, symbol: "ETH", name: "Ether" } : best);
  }
  if (out.length) popular = { at: Date.now(), out };
  return out;
}

export const WETH = TOKENS.ETH;

