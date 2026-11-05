import type { Trade } from "./flash.js";
import { TOKENS, USDC } from "./parse.js";
import { getPrice } from "./prices.js";
import { allHalts, haltOf, userByHandle, userById } from "./db.js";
import { riskOf } from "./guard.js";
import { ranking } from "./stats.js";
import { priceStr, qtyStr } from "./tokens.js";
import { symOf } from "./data.js";
import { integratorFeeBps } from "./flash.js";

export interface Intent { side: "buy" | "sell"; usd?: number; qty?: number; token: string; stopPct?: number; tpPct?: number }
/**
 * A wallet only its owner signs for (MetaMask, live) can't sign a stop later, after the entry fills: its stop must ride
 * the entry as one Flash order. With no target, the attached target is set far away (10x), where it never triggers.
 */
export interface BuildOpts { oneOrder?: boolean }
export interface Card { title: string; usd: number; kind: string; maxGain?: number; maxLoss?: number; fee: number; stopPct?: number; tpPct?: number; token: string }
export interface Proposal { summary: string; trades: Trade[]; card?: Card }
export interface Answer { reply: string; proposal?: Proposal; sources?: string[] }

/** Rule-based parse: "buy $50 ETH with 5% stop and 12% take profit". Used when no LLM key is set or the LLM fails. */
export function parseIntent(text: string): Intent | undefined {
  const t = text.toLowerCase();
  const side = /\b(sell|dump|exit)\b/.test(t) ? "sell" : /\b(buy|long|ape|get)\b/.test(t) ? "buy" : undefined;
  if (!side) return undefined;
  const token = Object.keys(TOKENS).find((k) => new RegExp(`\\b${k.toLowerCase()}\\b`).test(t)) ?? "ETH";
  const usd = /\$\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:usd|usdc|dollars|bucks)/.exec(t);
  const amount = usd ? Number(usd[1] ?? usd[2]) : undefined;
  const qty = side === "sell" ? Number(/(\d+(?:\.\d+)?)\s*(?:eth|weth)/.exec(t)?.[1]) || undefined : undefined;
  const stop = /(\d+(?:\.\d+)?)\s*%\s*(?:stop|sl)|(?:stop(?:[- ]loss)?|sl)\s*(?:at|of)?\s*(\d+(?:\.\d+)?)\s*%/.exec(t);
  const tp = /(\d+(?:\.\d+)?)\s*%\s*(?:tp|take[- ]?profit|(?:profit )?target)|(?:take[- ]?profit|tp|target)\s*(?:at|of)?\s*\+?(\d+(?:\.\d+)?)\s*%/.exec(t);
  const i: Intent = { side, token: token.toUpperCase(), usd: amount, qty };
  if (stop) i.stopPct = Number(stop[1] ?? stop[2]);
  if (tp) i.tpPct = Number(tp[1] ?? tp[2]);
  return i;
}

const INTENT_PROMPT =
  'Convert the trading request to JSON only: {"side":"buy|sell","usd":number|null,"qty":number|null,"token":"ETH","stopPct":number|null,"tpPct":number|null}. Reply {"none":true} if it is not a trade request.';

/**
 * The model's raw JSON reply for a trade request. Any OpenAI-compatible API when OPENAI_COMPAT_API_KEY is set
 * (OpenRouter, OpenAI, a local server), else Anthropic when ANTHROPIC_API_KEY is set, else none.
 */
async function llmReply(text: string): Promise<string | undefined> {
  if (process.env.OPENAI_COMPAT_API_KEY) {
    const r = await fetch(`${(process.env.OPENAI_COMPAT_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_COMPAT_API_KEY}`, "content-type": "application/json", "x-title": "Tribe" },
      body: JSON.stringify({
        model: process.env.OPENAI_COMPAT_MODEL ?? "openai/gpt-oss-20b",
        // Reasoning models spend part of the budget thinking; 600 leaves room for the short JSON answer.
        max_tokens: 600,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: INTENT_PROMPT }, { role: "user", content: text }],
      }),
    });
    const j: any = await r.json();
    return j.choices?.[0]?.message?.content;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ASK_MODEL ?? "claude-sonnet-5-5", max_tokens: 200, system: INTENT_PROMPT, messages: [{ role: "user", content: text }] }),
    });
    const j: any = await r.json();
    return j.content?.[0]?.text;
  }
  return undefined;
}

/** Optional LLM parse (an AI key in .env). Returns undefined on any failure so callers fall back to the rules. */
async function llmIntent(text: string): Promise<Intent | undefined> {
  try {
    const reply = await llmReply(text);
    if (!reply) return undefined;
    const o = JSON.parse(String(reply).match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    if (o.none || !["buy", "sell"].includes(o.side) || !TOKENS[String(o.token ?? "ETH").toUpperCase()]) return undefined;
    return { side: o.side, usd: o.usd ?? undefined, qty: o.qty ?? undefined, token: String(o.token ?? "ETH").toUpperCase(), stopPct: o.stopPct ?? undefined, tpPct: o.tpPct ?? undefined };
  } catch {
    return undefined;
  }
}

/** Parse a trade request with the AI model when a key is set, else rules. */
export const resolveIntent = async (text: string) => (await llmIntent(text)) ?? parseIntent(text);

export async function buildProposal(i: Intent, opts: BuildOpts = {}): Promise<Proposal> {
  // A symbol Tribe knows (ETH) or any Base token address picked from Flash search.
  const target = TOKENS[i.token.toUpperCase()] ?? (/^0x[0-9a-fA-F]{40}$/.test(i.token) ? i.token : undefined);
  if (!target) throw new Error(`Tribe can't trade ${i.token} yet`);
  const sym = TOKENS[i.token.toUpperCase()] ? i.token.toUpperCase() : symOf(target);
  const price = await getPrice(target);
  const base = { chain: "base", target, contra: USDC };
  if (i.side === "sell") {
    if (!i.qty) throw new Error("How much? e.g. 'sell 0.01 ETH'.");
    return { summary: `Sell ${i.qty} ${sym} at market (~$${priceStr(price)})`, trades: [{ ...base, side: "sell", qty: String(i.qty), orderType: "market" }] };
  }
  if (!i.usd || i.usd <= 0) throw new Error("How much? e.g. 'buy $50 ETH'.");
  const trades: Trade[] = [{ ...base, side: "buy", qty: String(i.usd), orderType: "market", hasStop: !!i.stopPct }];
  let summary = `Buy $${i.usd} of ${sym} at market (~$${priceStr(price)})`;
  if (i.stopPct || i.tpPct) {
    const tokens = qtyStr(i.usd / price);
    const sl = priceStr(price * (1 - (i.stopPct ?? 0) / 100));
    const tp = priceStr(price * (1 + (i.tpPct ?? 0) / 100));
    if (i.stopPct && !i.tpPct && opts.oneOrder) {
      const far = priceStr(price * 10);
      trades[0] = { ...trades[0], attach: { tp: far, sl } };
      summary += ` with its stop attached: stop $${sl} (no target)`;
    } else if (i.stopPct && i.tpPct) {
      // One Flash order: the take-profit / stop-loss pair rides the entry and activates on its fill.
      trades[0] = { ...trades[0], attach: { tp, sl } };
      summary += ` with a bracket attached: take profit $${tp} / stop $${sl}`;
    } else if (i.stopPct) {
      trades.push({ ...base, side: "sell", qty: tokens, orderType: "stop-loss", triggers: [{ notionalPrice: sl, triggerType: "lower" }] });
      summary += `, then a stop-loss at $${sl}`;
    } else {
      trades.push({ ...base, side: "sell", qty: tokens, orderType: "take-profit", triggers: [{ notionalPrice: tp, triggerType: "upper" }] });
      summary += `, then a take-profit at $${tp}`;
    }
  }
  const feeBps = integratorFeeBps();
  const card: Card = {
    title: `${sym} · Long`, usd: i.usd, fee: (i.usd * feeBps) / 1e4,
    kind: trades[0].attach ? "Bracket order" : trades.length > 1 ? (trades[1].orderType === "stop-loss" ? "Market + stop-loss" : "Market + take-profit") : "Market order",
    maxGain: i.tpPct ? (i.usd * i.tpPct) / 100 : undefined, maxLoss: i.stopPct ? (i.usd * i.stopPct) / 100 : undefined,
    stopPct: i.stopPct, tpPct: i.tpPct, token: sym,
  };
  return { summary, trades, card };
}

export async function ask(text: string): Promise<Answer> {
  const t = text.toLowerCase();
  const who = /@(\w+)/.exec(text)?.[1];
  if (who && /\b(pause|paused|halt|guard|why|risk)\b/.test(t)) {
    const u = userByHandle(who);
    if (!u) return { reply: `I don't know a trader called @${who}.` };
    const h = haltOf(u.id);
    if (h) {
      return {
        reply: `Guard paused @${who}: ${h.reason}. New trades from them are not copied; your open positions keep their stops.`,
        sources: [`Guard report ${new Date(h.at).toLocaleTimeString()}`, h.tx ? "CopyGuard tx" : "CRE verdict", `@${who} fills`],
      };
    }
    return { reply: `@${who} is not paused. Their risk score is ${await riskOf(u.id)} of 100.`, sources: [`@${who} fills`] };
  }
  if (/\b(best|top|leader|who)\b/.test(t)) {
    const top = (await ranking("profit", 3)).map((s, i) => `${i + 1}. @${s.handle}: ${s.pnlPct.toFixed(2)}% (${s.followers} followers)`);
    return { reply: top.length ? `Top traders by profit:\n${top.join("\n")}` : "No traders have placed trades yet." };
  }
  if (/\b(pause|paused|halt|guard|safe|risk)\b/.test(t)) {
    const h = allHalts();
    return { reply: h.length ? h.map((x) => `@${userById(x.leader)?.handle ?? x.leader} paused by CopyGuard: ${x.reason}`).join("\n") : "CopyGuard has no active pauses. All traders are clear." };
  }
  const intent = (await llmIntent(text)) ?? parseIntent(text);
  if (!intent) return { reply: "I can place trades (\"buy $50 ETH with 5% stop and 12% take profit\"), show the best traders, or explain CopyGuard pauses." };
  try {
    const proposal = await buildProposal(intent);
    return { reply: `${proposal.summary}. Confirm to place it. Your followers will be offered the same trade.`, proposal };
  } catch (e) {
    return { reply: (e as Error).message };
  }
}
