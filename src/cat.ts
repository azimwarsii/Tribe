import { randomUUID } from "node:crypto";
import { ask, buildProposal, resolveIntent, type Card, type Intent, type Proposal } from "./ask.js";
import { mirror, type PendingNotice } from "./copy.js";
import { addCatRead, addMsg, allHalts, chatById, createChat, db, getMeta, guardEvents, patchMsgData, rulesOf, setChatState, spentToday, userByHandle, userById, followingOf, msgsOf } from "./db.js";
import { ago, ORDER_LABEL, money, portfolio, pct } from "./data.js";
import { traderStats } from "./stats.js";
import type { Trade } from "./flash.js";
import { researchTrade, subjectTrade, type TradeCtx, type Verdict } from "./research.js";

export type Source = "App" | "Telegram" | "X";
export interface CatData { card?: Card; proposalId?: string; steps?: { t: string; d: string }[]; sources?: string[]; follow?: { label: string; text?: string; href?: string; icon?: string }[]; signed?: boolean; receipt?: string; verdict?: Verdict; ctx?: TradeCtx }
export interface CatReply extends CatData { chatId: number; msgId: number; reply: string }

const proposals = new Map<string, { user: number; chat: number; msg: number; proposal: Proposal; at: number }>();
const sweep = () => { for (const [k, v] of proposals) if (Date.now() - v.at > 15 * 60_000) proposals.delete(k); };

/** What a rule like "Ask me before anything over $50" means numerically, if it states a dollar limit. */
export const ruleLimit = (text: string): number | undefined => {
  const m = /(?:over|above|more than|exceed\w*|max(?:imum)?|limit)\s*(?:of\s*)?\$\s*(\d+(?:\.\d+)?)/i.exec(text);
  return m ? Number(m[1]) : undefined;
};

type Tone = { usd: number; token: string; stop?: number; tp?: number; maxLoss?: number; maxGain?: number; kind: string; capLeft: number; guardNote: string };

/** Tone only: the numbers, limits and Guard rules are identical for every personality. */
export function proposalText(persona: "Sharp" | "Chill" | "Degen", t: Tone): string {
  const legs = [t.stop ? `stop −${t.stop}%` : "", t.tp ? `target +${t.tp}%` : ""].filter(Boolean).join(", ");
  const risk = [t.maxLoss !== undefined ? `max loss $${t.maxLoss.toFixed(2)}` : "", t.maxGain !== undefined ? `max gain $${t.maxGain.toFixed(2)}` : ""].filter(Boolean).join(", ");
  const cap = t.capLeft >= t.usd ? `It fits your daily cap with ${money(t.capLeft - t.usd)} left.` : `Heads up: this is above the ${money(t.capLeft)} left on your daily cap.`;
  if (persona === "Sharp") return `${t.kind} ready: $${t.usd} of ${t.token}${legs ? ", " + legs : ""}. ${risk ? risk[0].toUpperCase() + risk.slice(1) + ". " : ""}${cap} ${t.guardNote}`;
  if (persona === "Chill") return `Here's a Flash ${t.kind.toLowerCase()} for $${t.usd} of ${t.token}.${t.stop ? ` If it drops ${t.stop}% you lose at most $${t.maxLoss?.toFixed(2)}.` : ""}${t.tp ? ` If it rises ${t.tp}% you make $${t.maxGain?.toFixed(2)}.` : ""} ${cap} ${t.guardNote}`;
  return `Sending it. Responsibly. $${t.usd} ${t.token}${legs ? ", " + legs : ""}.${risk ? ` ${risk[0].toUpperCase() + risk.slice(1)}.` : ""} ${cap} ${t.guardNote}`;
}

/** Follow-up on the last order: "make the stop 3%", "make it $100", "target 15%". */
function applyFollowUp(prev: Intent, text: string): Intent | undefined {
  const t = text.toLowerCase();
  const next = { ...prev };
  let changed = false;
  const stop = /stop[^\d]{0,12}(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*stop/.exec(t);
  const tp = /(?:target|take[- ]?profit|tp)[^\d]{0,12}(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:target|tp)/.exec(t);
  const usd = /\$\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:usd|usdc|dollars)/.exec(t);
  if (stop) { next.stopPct = Number(stop[1] ?? stop[2]); changed = true; }
  if (tp) { next.tpPct = Number(tp[1] ?? tp[2]); changed = true; }
  if (usd && /\b(make|change|set|bump|up|raise|lower|size)\b/.test(t)) { next.usd = Number(usd[1] ?? usd[2]); changed = true; }
  return changed ? next : undefined;
}

async function compareText(uid: number): Promise<{ reply: string; sources: string[] }> {
  const follows = new Set(followingOf(uid).map((f) => f.leader));
  const rows = db.prepare("SELECT id, leader, trade, at FROM trades WHERE leader != ? AND json_extract(trade,'$.side') = 'buy' ORDER BY id DESC LIMIT 40").all(uid) as unknown as { id: number; leader: number; trade: string; at: number }[];
  const pick = rows.find((r) => follows.has(r.leader)) ?? rows[0];
  if (!pick) return { reply: "No recent trades from other traders to compare with yet.", sources: [] };
  const t = JSON.parse(pick.trade) as Trade;
  const lu = userById(pick.leader)!;
  const next = db.prepare("SELECT trade FROM trades WHERE leader = ? AND id > ? AND json_extract(trade,'$.orderType') IN ('bracket','stop-loss','take-profit') ORDER BY id LIMIT 1").get(pick.leader, pick.id) as { trade: string } | undefined;
  const prot = next ? (JSON.parse(next.trade) as Trade).triggers ?? [] : [];
  const lo = t.attach?.sl ?? prot.find((x) => x.triggerType === "lower")?.notionalPrice;
  const up = t.attach?.tp ?? prot.find((x) => x.triggerType === "upper")?.notionalPrice;
  const meta = getMeta(uid);
  return {
    reply: `@${lu.handle} opened ${ORDER_LABEL[t.orderType]?.toLowerCase() ?? t.orderType} for $${t.qty} ${ago(pick.at)} ago${lo || up ? ` with${lo ? ` a stop at $${lo}` : ""}${up ? `${lo ? " and" : ""} a target at $${up}` : ""}` : ""}. Copying them instead would use your copy rules (max ${money(meta.defaults.max)} per trade) and follow their exits.`,
    sources: [`@${lu.handle} fills`, "Your copy rules"],
  };
}

async function awayLine(uid: number): Promise<string> {
  const follows = new Set(followingOf(uid).map((f) => f.leader));
  const halts = guardEvents(undefined, 20).filter((e) => e.kind === "halt" && follows.has(e.leader) && e.at >= Date.now() - 86400e3);
  const pf = await portfolio(uid);
  const names = [...new Set(halts.map((h) => "@" + (userById(h.leader)?.handle ?? h.leader)))];
  const today = `${pf.todayUsd >= 0 ? "+" : "−"}${money(Math.abs(pf.todayUsd))} today`;
  return `${names.length ? names.join(", ") + " paused" : "All clear"} · ${today}`;
}
export { awayLine };

export async function catAsk(uid: number, text: string, opts: { chatId?: number; source?: Source; live?: boolean; trade?: number } = {}): Promise<CatReply> {
  const source = opts.source ?? "App";
  const meta = getMeta(uid);
  const clean = text.trim().slice(0, 300);
  const fresh = !(opts.chatId && chatById(opts.chatId, uid));
  const chatId = fresh ? createChat(uid, clean, source) : opts.chatId!;
  const chat = chatById(chatId, uid)!;
  const state = JSON.parse(chat.state || "{}") as { intent?: Intent; trade?: number };
  // A chat opened from a feed post stays about that post until the user asks for a concrete order.
  const order = /\b(buy|sell|long)\b[^?]*\d/i.test(clean) || !!(state.intent && applyFollowUp(state.intent, clean));
  // Or one named in the question ("is @nightowl worth copying?"); a new name switches the subject.
  const named = order ? undefined : subjectTrade(clean);
  const about = named ?? (state.trade ? undefined : opts.trade);
  if (about && about !== state.trade) { state.trade = about; setChatState(chatId, state); }
  addMsg(chatId, "user", clean);

  let reply = "";
  let data: CatData = {};
  const rules = meta.catMemory ? rulesOf(uid) : [];

  const research = state.trade && !order && !/\bcompar/i.test(clean) ? await researchTrade(uid, state.trade, clean) : undefined;
  const intent = research ? undefined : (state.intent && !/\b(buy|sell|long)\b/i.test(clean) ? applyFollowUp(state.intent, clean) : undefined) ?? (/\bcompar/i.test(clean) ? undefined : await resolveIntent(clean));
  if (research) {
    reply = research.reply;
    data = { steps: research.steps, sources: research.sources, follow: research.follow, verdict: research.verdict, ctx: research.ctx };
    // Cat's call on an entry, priced now, so its track record can be scored honestly later.
    if (research.verdict && research.ctx.buy && research.ctx.mark) addCatRead({ trade: research.ctx.id, user: uid, label: research.verdict.label, token: research.ctx.token, price: research.ctx.mark });
    if (fresh) db.prepare("UPDATE cat_chats SET title = ? WHERE id = ?").run(`@${research.ctx.handle} ${research.ctx.symbol}: ${clean}`.slice(0, 60), chatId);
  } else if (/\bcompar/i.test(clean)) {
    const c = await compareText(uid);
    reply = c.reply;
    data = { sources: c.sources };
  } else if (intent) {
    try {
      const proposal = await buildProposal(intent);
      const card = proposal.card;
      const capLeft = Math.max(0, meta.defaults.cap - spentToday(uid));
      const halted = allHalts();
      const guardNote = halted.length ? `Guard has ${halted.length} trader${halted.length > 1 ? "s" : ""} paused, none affect this order.` : "Guard sees nothing unusual right now.";
      if (card) {
        reply = proposalText(meta.catPersona, { usd: card.usd, token: card.token, stop: card.stopPct, tp: card.tpPct, maxLoss: card.maxLoss, maxGain: card.maxGain, kind: card.kind, capLeft, guardNote });
        const over = rules.map((r) => ({ r, lim: ruleLimit(r.text) })).find((x) => x.lim !== undefined && card.usd > x.lim!);
        if (over) reply += ` Your rule “${over.r.text}” applies, so nothing happens until you confirm.`;
      } else reply = proposal.summary + ".";
      const proposalId = randomUUID();
      sweep();
      const steps = [
        { t: "Your limits", d: `${money(meta.defaults.cap)} daily cap, ${money(spentToday(uid))} used` },
        { t: "Price", d: `Flash price feed${opts.live === false ? " (cached)" : ", live"}` },
        { t: "Guard", d: halted.length ? `${halted.length} paused, none for ${intent.token}` : `No market alerts on ${intent.token}` },
        { t: "Order", d: proposal.summary },
      ];
      const top = db.prepare("SELECT leader FROM trades WHERE leader != ? ORDER BY id DESC LIMIT 1").get(uid) as { leader: number } | undefined;
      const topHandle = top ? userById(top.leader)?.handle : undefined;
      const follow = [
        ...(card?.stopPct && card.stopPct > 3 ? [{ label: "Tighter stop, 3%", text: "make the stop 3%" }] : []),
        ...(card && card.usd < 100 ? [{ label: "Make it $100", text: "make it $100" }] : []),
        ...(topHandle ? [{ label: `Compare with @${topHandle}'s latest trade`, text: `compare with @${topHandle}'s latest trade` }] : []),
      ];
      data = { card, proposalId, steps, sources: ["Flash price", "Your limits", "Guard status"], follow };
      setChatState(chatId, { ...state, intent });
      proposals.set(proposalId, { user: uid, chat: chatId, msg: 0, proposal, at: Date.now() });
    } catch (e) {
      reply = (e as Error).message;
    }
  } else {
    const a = await ask(clean);
    reply = a.reply;
    data = { sources: a.sources };
  }
  const msgId = addMsg(chatId, "cat", reply, data);
  const p = data.proposalId ? proposals.get(data.proposalId) : undefined;
  if (p) p.msg = msgId;
  return { chatId, msgId, reply, ...data };
}

/** source "agent": confirmed through the user's own AI agent (MCP), so the trade is tagged Bot. */
export async function catConfirm(uid: number, id: string, notify?: (p: PendingNotice[], leader: number) => void, source: "user" | "agent" = "user"): Promise<{ ok: boolean; reply: string }> {
  const p = proposals.get(id);
  if (!p || p.user !== uid) return { ok: false, reply: "That proposal expired. Ask again." };
  proposals.delete(id);
  const lines: string[] = [];
  let offers = 0;
  let ok = true;
  for (const t of p.proposal.trades) {
    const m = await mirror(uid, t, source);
    lines.push(`${t.orderType} ${t.side}: ${m.own.startsWith("failed") ? m.own : "placed"}`);
    if (m.own.startsWith("failed")) { ok = false; break; }
    offers += m.pending.length + m.executed.length;
    notify?.(m.pending, uid);
  }
  const reply = `${ok ? "Placed." : "Stopped."}\n${lines.join("\n")}${ok ? `\n${offers} follower(s) copying or asked.` : ""}`;
  if (p.msg) patchMsgData(p.msg, { signed: ok, receipt: lines.join(" · ") });
  addMsg(p.chat, "cat", reply, { sources: [] });
  return { ok, reply };
}

// Memory screen data

export interface MemoryItem { key: string; t: string; src: string }
/** What Cat learned from real activity. Nothing here is stored; it is derived each time. */
export async function learnedMemory(uid: number): Promise<MemoryItem[]> {
  const out: MemoryItem[] = [];
  const u = userById(uid);
  if (u?.persona) out.push({ key: "persona", t: `${u.persona} risk profile`, src: "From your quiz" });
  const trades = db.prepare("SELECT trade, at FROM trades WHERE leader = ?").all(uid) as unknown as { trade: string; at: number }[];
  if (trades.length) {
    const kinds = new Map<string, number>();
    for (const r of trades) { const k = (JSON.parse(r.trade) as Trade).orderType; kinds.set(k, (kinds.get(k) ?? 0) + 1); }
    const [kind] = [...kinds].sort((a, b) => b[1] - a[1])[0];
    out.push({ key: "tokens", t: "Mostly trades ETH", src: `From ${trades.length} trade${trades.length > 1 ? "s" : ""}` });
    out.push({ key: "kind", t: `Prefers ${ORDER_LABEL[kind]?.toLowerCase() ?? kind} orders`, src: "From your orders" });
    if (trades.length >= 3) {
      const evening = trades.filter((r) => { const h = new Date(r.at).getHours(); return h >= 17 || h < 3; }).length;
      out.push({ key: "time", t: evening / trades.length >= 0.5 ? "Active in the evenings" : "Active in the daytime", src: "From when you trade" });
    }
  }
  const strict = getMeta(uid).strict;
  out.push({ key: "strict", t: `Guard strictness: ${strict}`, src: "From your settings" });
  const s = await traderStats(uid).catch(() => undefined);
  if (s && s.pnlPct) out.push({ key: "pnl", t: `Overall ${pct(s.pnlPct, 1)} so far`, src: "From your fills" });
  return out.filter((m) => !getMeta(uid).catForgot.includes(m.key));
}

export { chatById, msgsOf, userByHandle };
