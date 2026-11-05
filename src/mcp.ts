/**
 * Tribe MCP server: use Tribe from any MCP client (Claude Code, Claude Desktop, Cursor).
 * Your agent can read the leaderboard, check a trader and Guard, copy a trader with limits, and propose a bracketed
 * Flash trade that it can only place after you confirm. Copy rules, Guard pauses and confirm-to-sign all still apply.
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

server.registerTool("tribe_copy", {
  title: "Copy a trader",
  description: "Start copying a trader with limits. 'ask' sends you a request to approve for every trade; 'auto' copies within the limits. Guard pauses still block copies.",
  inputSchema: {
    handle: z.string(),
    mode: z.enum(["ask", "auto"]).default("ask"),
    maxPerTradeUsd: z.number().positive().default(25),
    dailyCapUsd: z.number().positive().default(100),
    requireStop: z.boolean().default(true).describe("Only copy entries that come with a stop-loss"),
    ratio: z.number().positive().max(10).default(1).describe("Multiplier on the trader's size"),
  },
  annotations: { destructiveHint: false },
}, safe(async (a: { handle: string; mode: "ask" | "auto"; maxPerTradeUsd: number; dailyCapUsd: number; requireStop: boolean; ratio: number }) => {
  await api("/api/follow", { leader: a.handle.replace(/^@/, ""), mode: a.mode, max: a.maxPerTradeUsd, cap: a.dailyCapUsd, stop: a.requireStop ? "1" : "0", ratio: a.ratio, budget: a.dailyCapUsd * 5 });
  return `Now copying @${a.handle.replace(/^@/, "")} (${a.mode}, max $${a.maxPerTradeUsd} per trade, $${a.dailyCapUsd} a day${a.requireStop ? ", stop-loss required" : ""}).`;
}));

server.registerTool("tribe_research", {
  title: "Research a trader or trade",
  description: "Ask Cat whether a trader's latest trade (or a specific feed post) is worth copying. Returns Cat's read: checks on the stop, payoff, track record, drawdown, the latest Chainlink CRE CopyGuard verdict and the Chainlink-vs-DEX price check, plus what copying would risk under the user's rules.",
  inputSchema: {
    handle: z.string().optional().describe("Trader username, e.g. nightowl"),
    tradeId: z.number().int().optional().describe("A specific feed post id"),
    question: z.string().optional().describe("Defaults to 'Is this a good trade?'. Ask about 'track record' or 'worst case if I copy' for those answers."),
  },
  annotations: { readOnlyHint: true },
}, safe(async (a: { handle?: string; tradeId?: number; question?: string }) => {
  if (!a.tradeId && !a.handle) throw new Error("Give a handle or a tradeId");
  const r = await api("/api/cat/ask", { text: a.question ?? "Is this a good trade?", trade: a.tradeId, handle: a.tradeId ? undefined : a.handle });
  if (!r.ctx) throw new Error(`No trades found for ${a.handle ?? `post ${a.tradeId}`}`);
  return { reply: r.reply, read: r.verdict ?? null, post: r.ctx ?? null, sources: r.sources };
}));

server.registerTool("tribe_propose_trade", {
  title: "Propose a trade",
  description: "Ask Tribe's Cat to turn plain words into a Flash order, e.g. 'buy $20 ETH with a 5% stop and 12% target' (one order with a take-profit/stop-loss bracket attached). Nothing is placed: it returns a proposal id to confirm.",
  inputSchema: { request: z.string().describe("What to trade, in plain words") },
}, safe(async ({ request }: { request: string }) => {
  const r = await api("/api/cat/ask", { text: request });
  return { reply: r.reply, proposalId: r.proposalId ?? null, order: r.card ?? null, next: r.proposalId ? "Show this to the user. Call tribe_confirm_trade only after they say yes." : "No order proposed." };
}));

server.registerTool("tribe_confirm_trade", {
  title: "Confirm a proposed trade",
  description: "Place a proposed trade as a Flash order, signed with the user's wallet, and offer it to their followers. Only call after the user explicitly confirms.",
  inputSchema: { proposalId: z.string() },
  annotations: { destructiveHint: true },
}, safe(async ({ proposalId }: { proposalId: string }) => api("/api/cat/confirm", { id: proposalId })));

if (!TOKEN) console.error("TRIBE_TOKEN is not set: copy it from Settings → AI agent access.");
await server.connect(new StdioServerTransport());
