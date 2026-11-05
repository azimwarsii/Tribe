import { getUser } from "./db.js";
import { callFlashTool, flashTools } from "./flashmcp.js";

/**
 * Ask Chief answers live Flash questions (quotes, prices, balances, fees, order status) by letting the AI model call the
 * read-only Flash MCP tools. Needs an OpenAI-compatible model with tool calling (OPENAI_COMPAT_*). Returns undefined
 * when it can't answer, so Chief falls back to its usual answers. It never trades: those tools aren't offered.
 */
export const wantsFlash = (q: string) =>
  /\b(quote|prices?|how much|get me|would .{0,30} get|balances?|wallet|holdings?|my orders?|order status|filled|fill|fees?|slippage)\b/i.test(q);

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export async function flashAnswer(uid: number, question: string): Promise<{ reply: string; steps: { t: string; d: string }[]; sources: string[] } | undefined> {
  const key = process.env.OPENAI_COMPAT_API_KEY;
  if (!key) return undefined;
  const url = `${(process.env.OPENAI_COMPAT_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const tools = (await flashTools()).map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description.slice(0, 900), parameters: t.parameters } }));
  const messages: Msg[] = [
    {
      role: "system",
      content: [
        "You are Chief, the trading assistant in Tribe, a copy-trading app on Base. Answer with the Flash tools, which read live data from Flash (Definitive's trading API).",
        `The user's wallet on Base is ${getUser(uid).address}. Use chain "base". USDC is ${USDC}; ETH trades as WETH ${WETH}.`,
        'For "what would $X of ETH get me": flash_quote with side "buy", targetAsset WETH, contraAsset USDC, qty in USDC (e.g. "50"), orderType "market".',
        "You can't place, change or cancel orders; if asked, say the user can do it from a trade card or by asking Chief to buy.",
        "Answer in at most three short sentences, plain words, with the key numbers. No markdown tables.",
      ].join(" "),
    },
    { role: "user", content: question },
  ];
  const steps: { t: string; d: string }[] = [];
  const deadline = Date.now() + 30_000;
  for (let round = 0; round < 4 && Date.now() < deadline; round++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "Tribe" },
      body: JSON.stringify({ model: process.env.OPENAI_COMPAT_MODEL ?? "openai/gpt-oss-20b", temperature: 0, max_tokens: 1200, messages, tools, tool_choice: "auto" }),
      signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
    });
    const j = (await r.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
    const m = j.choices?.[0]?.message;
    if (!m) return undefined;
    if (!m.tool_calls?.length) {
      const reply = (m.content ?? "").trim();
      return reply && steps.length ? { reply, steps, sources: ["Flash MCP"] } : undefined;
    }
    messages.push({ role: "assistant", content: m.content ?? null, tool_calls: m.tool_calls });
    for (const call of m.tool_calls) {
      let out: string;
      try {
        const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        out = await callFlashTool(call.function.name, args);
        steps.push({ t: "Flash MCP", d: `${call.function.name}${args.qty ? ` · ${args.qty}` : ""}${args.address ? " · your wallet" : ""}` });
      } catch (e) {
        out = `Error: ${(e as Error).message}`;
      }
      // The tool's human summary is enough; its raw JSON block only costs tokens.
      messages.push({ role: "tool", tool_call_id: call.id, content: out.split("<details>")[0].slice(0, 3000) });
    }
  }
  return undefined;
}
