/**
 * Preview what the CRE workflows will decide, using their own decision code (cre-workflow/*\/{guard,agent,board}.ts)
 * against the real data sources: the Chainlink ETH/USD Data Feed on Base, the Flash API and the running Tribe app.
 * This is NOT a CRE simulation (that is `npm run cre:simulate`, which needs `cre login`); it checks configs, secrets and data.
 *
 *   npm run cre:preview                 # print verdicts, the agent's decision and the season ranking
 *   npm run cre:preview -- --post       # also post them to Tribe like the workflows do (/cre/guard, /cre/signal, /cre/board)
 */
import "dotenv/config";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { deviationPct, heuristic, type Snap } from "../cre-workflow/guard-workflow/guard.js";
import guardCfg from "../cre-workflow/guard-workflow/config.staging.json" with { type: "json" };
import { decide, signalBody } from "../cre-workflow/agent-workflow/agent.js";
import agentCfg from "../cre-workflow/agent-workflow/config.staging.json" with { type: "json" };
import { rank, rankingHash, seasonOf, seasonRange, standing, type FlashOrder, type Trader } from "../cre-workflow/board-workflow/board.js";
import boardCfg from "../cre-workflow/board-workflow/config.staging.json" with { type: "json" };

const APP = process.env.PREVIEW_APP_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
const SECRET = process.env.CRE_SHARED_SECRET ?? "";
const post = process.argv.includes("--post");
const flashHeaders = { "x-definitive-api-key": guardCfg.flashApiKey };

const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC || "https://mainnet.base.org") });
const FEED = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)", "function decimals() view returns (uint8)"]);
const feed = guardCfg.feed.address as `0x${string}`;
const [dec, round] = await Promise.all([client.readContract({ address: feed, abi: FEED, functionName: "decimals" }), client.readContract({ address: feed, abi: FEED, functionName: "latestRoundData" })]);
const oracle = Number(formatUnits(round[1], dec));
const asset = (await (await fetch(`${guardCfg.flashSearchUrl}?query=${guardCfg.feed.token}&chain=base&limit=1`, { headers: flashHeaders })).json()).assets?.[0];
const dex = Number(asset?.price);
const dev = deviationPct(dex, oracle);
console.log(`\nPrice check  Chainlink ETH/USD $${oracle.toFixed(2)} · Flash DEX $${dex.toFixed(2)} · ${dev.toFixed(2)}% apart`);

const call = async (path: string, init?: RequestInit) => {
  const r = await fetch(APP + path, { ...init, headers: { "content-type": "application/json", "x-cre-secret": SECRET, ...(init?.headers ?? {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status}${r.status === 401 ? " (CRE_SHARED_SECRET in .env must match the running app's)" : ""}`);
  return r.json();
};

// Guard
const snaps = (await call("/guard/snapshot")) as Snap[];
const verdicts = snaps.map((s) => ({ ...heuristic(s, guardCfg, dev), s }));
console.log(`\nCopyGuard    ${snaps.length} traders`);
for (const v of verdicts) console.log(`  @${v.s.handle.padEnd(12)} ${v.sev.padEnd(5)} risk ${String(v.s.risk).padStart(3)}  ${v.reason}${v.sev === "warn" ? "  (the LLM decides this one in CRE)" : ""}`);
if (post) console.log("  posted:", await call("/cre/guard", { method: "POST", body: JSON.stringify({ oracle, dex, deviationPct: dev, verdicts: verdicts.map((v) => ({ leader: v.s.leader, handle: v.s.handle, severity: v.sev, risk: v.s.risk, reason: `${v.reason} (preview, not CRE)`, ai: false })) }) }));

// Agent
const s = decide({ oracle, dex, change24hPct: Number(asset?.priceChange24h ?? 0) * 100, liquidityUsd: Number(asset?.liquidity ?? 0) }, agentCfg);
console.log(`\nBot strategy ${s.action === "long" ? `long $${s.usd} ETH, take profit $${s.tp}, stop $${s.sl}` : "no trade"} (${s.why})`);
if (post && s.action === "long") console.log("  posted:", await call("/cre/signal", { method: "POST", body: JSON.stringify(signalBody("ETH", s, `Buying the dip: ${s.why}.`)) }));

// Season board
const traders = ((await call("/cre/traders")) as Trader[]).slice(0, 12);
const season = seasonOf(Date.now(), boardCfg.seasonEpochYear, boardCfg.seasonEpochMonth);
const { start, end } = seasonRange(season, boardCfg.seasonEpochYear, boardCfg.seasonEpochMonth);
const standings = [];
for (const t of traders) {
  const j = await (await fetch(`${boardCfg.flashOrdersUrl}?funderAddress=${t.address}&pageSize=100`, { headers: flashHeaders })).json();
  standings.push(standing(t, (j.orders ?? []) as FlashOrder[], boardCfg.usdc, start, end));
}
const ranking = rank(standings);
console.log(`\nSeason board season ${season}: ${ranking.length} of ${traders.length} traders have Flash fills this season`);
for (const [i, r] of ranking.entries()) console.log(`  #${i + 1} @${r.handle} ${(r.pnlBps / 100).toFixed(2)}% ($${r.pnlUsd} on $${r.investedUsd}, ${r.fills} fills)`);
console.log(`  ranking hash ${rankingHash(season, ranking)}`);
if (post) console.log("  posted:", await call("/cre/board", { method: "POST", body: JSON.stringify({ season, hash: rankingHash(season, ranking), computedAt: Math.floor(Date.now() / 1000), ranking }) }));
console.log("\nThis was a preview with the workflows' own logic. Run the real thing with `npm run cre:simulate`.");
