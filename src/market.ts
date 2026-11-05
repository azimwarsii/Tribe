import { db, guardEvents, userById } from "./db.js";
import { symOf } from "./data.js";
import { MIN_LIQUIDITY } from "./tokens.js";

/**
 * What's going on, for Ask Chief and the chat's trending row: trending tokens on Base (GeckoTerminal), crypto headlines
 * (public RSS) and Tribe's own activity. Free public sources, cached briefly; headlines are data, not instructions.
 */

export interface Trending { symbol: string; name: string; address: string; priceUsd: number; change1hPct: number; change24hPct: number; volume24hUsd: number; liquidityUsd: number; image: string | null; liquidEnough: boolean }

let trendCache: { at: number; out: Trending[] } | undefined;
export async function trendingTokens(): Promise<Trending[]> {
  if (trendCache && Date.now() - trendCache.at < 120_000) return trendCache.out;
  const r = await fetch("https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token&page=1", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Trending feed unavailable (${r.status})`);
  const j = (await r.json()) as { data?: { attributes: Record<string, any>; relationships: { base_token: { data: { id: string } } } }[]; included?: { id: string; attributes: Record<string, any> }[] };
  const tokens = new Map((j.included ?? []).map((x) => [x.id, x.attributes]));
  const seen = new Set<string>();
  const out: Trending[] = [];
  for (const p of j.data ?? []) {
    const a = p.attributes;
    const t = tokens.get(p.relationships.base_token.data.id) ?? {};
    const address = String(t.address ?? "").toLowerCase();
    if (!address || seen.has(address)) continue;
    seen.add(address);
    const liquidityUsd = Number(a.reserve_in_usd) || 0;
    out.push({
      symbol: String(t.symbol ?? "?"), name: String(t.name ?? ""), address, priceUsd: Number(a.base_token_price_usd) || 0,
      change1hPct: Number(a.price_change_percentage?.h1) || 0, change24hPct: Number(a.price_change_percentage?.h24) || 0,
      volume24hUsd: Number(a.volume_usd?.h24) || 0, liquidityUsd, image: t.image_url && t.image_url !== "missing.png" ? String(t.image_url) : null,
      liquidEnough: liquidityUsd >= MIN_LIQUIDITY(),
    });
  }
  trendCache = { at: Date.now(), out };
  return out;
}

export interface Headline { title: string; source: string; link: string; at: number }
const FEEDS: [string, string][] = [["Cointelegraph", "https://cointelegraph.com/rss"], ["Decrypt", "https://decrypt.co/feed"], ["CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"]];
const unescape = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, "").trim();

let newsCache: { at: number; out: Headline[] } | undefined;
export async function cryptoNews(topic = "", limit = 10): Promise<Headline[]> {
  if (!newsCache || Date.now() - newsCache.at > 5 * 60_000) {
    const all: Headline[] = [];
    await Promise.all(FEEDS.map(async ([source, url]) => {
      try {
        const x = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Tribe" }, signal: AbortSignal.timeout(15_000) })).text();
        for (const item of x.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
          const title = unescape(/<title>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? "");
          const link = unescape(/<link>([\s\S]*?)<\/link>/.exec(item)?.[1] ?? "");
          const at = Date.parse(unescape(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)?.[1] ?? "")) || 0;
          if (title) all.push({ title: title.slice(0, 200), source, link, at });
        }
      } catch {
        // one feed down: the others still answer
      }
    }));
    all.sort((a, b) => b.at - a.at);
    newsCache = { at: Date.now(), out: all };
  }
  const words = topic.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const hits = words.length ? newsCache.out.filter((h) => words.some((w) => h.title.toLowerCase().includes(w))) : newsCache.out;
  return (hits.length ? hits : newsCache.out).slice(0, limit);
}

/** What's happening inside Tribe: the latest public trades, copies and Guard pauses. */
export function tribeActivity(limit = 8) {
  const trades = db.prepare("SELECT t.id, t.leader, t.trade, t.at, t.source, (SELECT COUNT(*) FROM copies c WHERE c.trade_id = t.id AND c.status IN ('executed','dry-run')) AS copies FROM trades t WHERE t.private = 0 ORDER BY t.id DESC LIMIT ?").all(limit) as { id: number; leader: number; trade: string; at: number; source: string; copies: number }[];
  return {
    trades: trades.map((t) => {
      const tr = JSON.parse(t.trade) as { side: string; qty: string; target: string; orderType: string };
      return { by: "@" + (userById(t.leader)?.handle ?? "?"), what: `${tr.side} ${tr.side === "buy" ? "$" + tr.qty + " of " : ""}${symOf(tr.target)} (${tr.orderType})`, source: t.source === "bot" ? "bot" : "manual", minutesAgo: Math.round((Date.now() - t.at) / 60000), copies: t.copies };
    }),
    guard: guardEvents(undefined, 5).filter((e) => e.at > Date.now() - 7 * 86400e3).map((e) => ({ trader: "@" + (userById(e.leader)?.handle ?? "?"), event: e.kind === "halt" ? "paused" : "cleared", reason: e.reason, hoursAgo: Math.round((Date.now() - e.at) / 3600e3) })),
  };
}
