import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Definitive's Flash MCP server (@definitive-fi/flash-mcp), read-only, for Ask Chief: live quotes, wallet balances and
 * order status. It runs as a child process with a bare environment (no wallet key ever reaches it), and only the
 * read-only tools below are offered or allowed; trading stays in Tribe, where the user approves and signs.
 */
export const READ_ONLY_TOOLS = new Set(["flash_quote", "flash_balances", "flash_get_order", "flash_list_orders", "flash_status"]);

export interface FlashTool { name: string; description: string; parameters: Record<string, unknown> }

let session: Promise<{ client: Client; tools: FlashTool[] }> | undefined;

async function start() {
  const entry = createRequire(import.meta.url).resolve("@definitive-fi/flash-mcp/dist/index.js");
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" };
  if (process.env.FLASH_API_KEY) env.DEFINITIVE_API_KEY = process.env.FLASH_API_KEY;
  if (process.env.BASE_RPC) env.DEFINITIVE_RPC_BASE = process.env.BASE_RPC;
  const client = new Client({ name: "tribe-ask-cat", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env, stderr: "ignore" }));
  const { tools } = await client.listTools();
  return {
    client,
    tools: tools.filter((t) => READ_ONLY_TOOLS.has(t.name)).map((t) => ({ name: t.name, description: t.description ?? "", parameters: t.inputSchema as Record<string, unknown> })),
  };
}

/** The connection, started on first use and reused; a failed start is retried next time. */
function connect() {
  session ??= start().catch((e) => {
    session = undefined;
    throw e;
  });
  return session;
}

export const flashTools = async () => (await connect()).tools;

/** Call one read-only Flash MCP tool and return its text. Anything that could trade or change settings is refused. */
export async function callFlashTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (!READ_ONLY_TOOLS.has(name)) throw new Error(`${name} isn't available to Ask Chief: Tribe only reads from Flash MCP.`);
  const { client } = await connect();
  const r = (await client.callTool({ name, arguments: args })) as { content?: { type: string; text?: string }[]; isError?: boolean };
  const text = (r.content ?? []).map((c) => c.text ?? "").join("\n").trim();
  return r.isError ? `Error: ${text}` : text;
}
