/**
 * Tribe MCP server: use Tribe from any MCP client (Claude Code, Claude Desktop, Cursor).
 * Your agent can read the leaderboard and baskets, check a trader and Guard, and copy a basket. Copy rules and Guard
 * pauses all still apply.
 *
 * Config (Settings → AI agent access shows it with your token filled in):
 *   { "mcpServers": { "tribe": { "command": "npx", "args": ["tsx", "src/mcp.ts"], "env": { "TRIBE_URL": "http://localhost:8787", "TRIBE_TOKEN": "<agent token>" } } } }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const URL_ = (process.env.TRIBE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const TOKEN = process.env.TRIBE_TOKEN ?? "";

async function api(path: string, body?: unknown) {
  const r = await fetch(URL_ + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String((j as { error?: string }).error ?? `Tribe returned ${r.status}`));
  return j;
}
const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const safe = <A>(fn: (a: A) => Promise<unknown>) => async (a: A) => {
  try {
    return text(await fn(a));
  } catch (e) {
    return { ...text(`Error: ${(e as Error).message}`), isError: true };
  }
};

const server = new McpServer({ name: "tribe", version: "0.2.0" });

server.registerTool("tribe_leaderboard", {
  title: "Top traders",
  description: "Traders ranked by realised return from filled Flash orders over the last N days, with whether Chainlink CRE Guard has paused them.",
  inputSchema: { days: z.number().int().min(1).max(90).optional().describe("Window in days, default 7") },
  annotations: { readOnlyHint: true },
}, safe(async ({ days }: { days?: number }) => api(`/api/v1/top?days=${days ?? 7}`)));

server.registerTool("tribe_trader", {
  title: "Trader profile",
  description: "One trader's track record (return, win rate, max drawdown, trades, followers), their risk score and Guard status.",
  inputSchema: { handle: z.string().describe("Trader handle, with or without @") },
  annotations: { readOnlyHint: true },
}, safe(async ({ handle }: { handle: string }) => api(`/api/v1/traders/${encodeURIComponent(handle.replace(/^@/, ""))}`)));

server.registerTool("tribe_guard", {
  title: "Guard status",
  description: "Traders currently paused by the Chainlink CRE CopyGuard workflow (with reasons and onchain proof) and the latest Chainlink-vs-DEX price check.",
  annotations: { readOnlyHint: true },
}, safe(async () => api("/api/v1/guard")));

server.registerTool("tribe_me", {
  title: "My account",
  description: "Your balance, open positions (with their stops and targets) and the traders you copy with their rules.",
  annotations: { readOnlyHint: true },
}, safe(async () => api("/api/v1/me")));

server.registerTool("tribe_baskets", {
  title: "List baskets",
  description: "Baskets on Tribe: each creator's make-up by asset class (Major coins, US stocks, Altcoins, Meme coins), risk band, tokens and weights, simulated index return since launch, stop, target, copiers and whether CopyGuard has the creator paused. Optionally only one kind.",
  inputSchema: { asset: z.enum(["major", "stock", "alt", "meme", "steady"]).optional().describe("Keep baskets with at least 25% in this class, or in the Steady risk band") },
  annotations: { readOnlyHint: true },
}, safe(async (a: { asset?: string }) => api(`/api/v1/baskets${a.asset ? `?asset=${a.asset}` : ""}`)));

server.registerTool("tribe_copy_basket", {
  title: "Copy a basket",
  description: "Copy a basket at a size the user picked: one Flash order per token at its weight, inside their max per copy and daily cap. CopyGuard can still block it. Only call after the user explicitly confirms the amount. Baskets run in practice mode for now.",
  inputSchema: { basket: z.number().int().describe("Basket id, from tribe_baskets"), usd: z.number().positive().describe("Total amount in dollars") },
  annotations: { destructiveHint: true },
}, safe(async (a: { basket: number; usd: number }) => api("/api/basket-copy", a)));

if (!TOKEN) console.error("TRIBE_TOKEN is not set: copy it from Settings → AI agent access.");
await server.connect(new StdioServerTransport());
