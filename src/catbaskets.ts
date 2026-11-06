import type { Proposal } from "./ask.js";
import { ASSET_CLASSES, assetClassOf, exposure, MATCH_PCT, RISK_LEVELS, type AssetClass, type RiskLevel } from "./assets.js";
import { basketRead, checkCopy, copiesOf, liveBaskets, tokensText, type BasketRead, type BasketView } from "./baskets.js";
import { copyFee } from "./creator.js";
import { getMeta } from "./db.js";
import { isDry } from "./tracker.js";

/**
 * What Chief knows about baskets, used by the AI's tools and by the built-in answers when no model is available, so the
 * two can't disagree.
 *
 * Baskets are ranked on protection and fit, never on return alone. A basket's return is an index worked out from token
 * prices, not profit anyone banked, and a young basket's number mostly says what the market did last week.
 */

const days = (v: BasketView) => Math.max(1, Math.round((Date.now() - v.at) / 86400e3));
const mixText = (v: BasketView) => v.mix.map((m) => `${m.label} ${m.pct}%`).join(", ");
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const TONE_ORDER = { ok: 0, warn: 1, bad: 2 };

/** One basket as plain facts, for the model and for agents. */
export async function basketFacts(v: BasketView, read?: BasketRead) {
  const r = read ?? (await basketRead(v));
  return {
    id: v.id, name: v.name, creator: v.handle, url: `/b/${v.id}`, ageDays: days(v), version: v.version,
    mix: v.mix.map((m) => ({ assetClass: m.label, pct: m.pct })), risk: RISK_LEVELS[v.risk].label,
    tokens: v.weights.map((w) => ({ symbol: w.symbol, weightPct: w.weight, class: ASSET_CLASSES[assetClassOf(w.token)].label })),
    stopPctPerToken: v.stopPct || null, targetPctPerToken: v.tpPct || null, copiers: v.copiers,
    simulatedIndexReturnPct: Number(v.returnPct.toFixed(2)),
    read: { label: r.label, passes: r.checks.filter((c) => c.ok).map((c) => c.t), flags: r.checks.filter((c) => !c.ok).map((c) => c.t) },
  };
}

export interface BasketSearch { assetClass?: AssetClass; risk?: RiskLevel; requireStop?: boolean; limit?: number }

/** Baskets that fit, best protected first. A paused creator's basket, your own and ones you already copy are left out. */
export async function findBaskets(viewer: number, f: BasketSearch = {}): Promise<{ v: BasketView; read: BasketRead }[]> {
  const mine = new Set((await copiesOf(viewer)).map((c) => c.basket.id));
  const fits = (await liveBaskets()).filter((v) => v.owner !== viewer && !mine.has(v.id)
    && (!f.assetClass || exposure(v.mix, f.assetClass) >= MATCH_PCT) && (!f.risk || v.risk === f.risk) && (!f.requireStop || v.stopPct > 0));
  const read = await Promise.all(fits.map(async (v) => ({ v, read: await basketRead(v) })));
  return read.filter((x) => x.read.label !== "Paused").sort((a, b) =>
    TONE_ORDER[a.read.tone] - TONE_ORDER[b.read.tone]
    || (f.assetClass ? exposure(b.v.mix, f.assetClass) - exposure(a.v.mix, f.assetClass) : 0)
    || Number(b.v.stopPct > 0) - Number(a.v.stopPct > 0)
    || b.v.copiers - a.v.copiers
    || days(b.v) - days(a.v)).slice(0, f.limit ?? 5);
}

/** A live basket by id, or by a name in free text (the longest match, so "Base Blue Chips" beats "Base"). */
export async function basketNamed(ref: string | number): Promise<BasketView | undefined> {
  const all = await liveBaskets();
  if (typeof ref === "number") return all.find((v) => v.id === ref);
  const q = ref.toLowerCase();
  return all.filter((v) => q.includes(v.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
}

/** What this person holds in baskets now. */
export async function myBasketFacts(uid: number) {
  return (await copiesOf(uid)).map(({ copy, basket, value, request }) => ({
    basket: basket.name, url: `/b/${basket.id}`, inUsd: copy.usd, valueUsd: Number(value.value.toFixed(2)), profitUsd: Number(value.pnlUsd.toFixed(2)), profitPct: Number(value.pnlPct.toFixed(2)),
    status: copy.status === "partial" ? "partly filled" : "filled", rebalanceWaiting: !!request,
    holdings: value.holdings.map((h) => ({ token: h.symbol, valueUsd: Number(h.value.toFixed(2)), nowPct: Number(h.weightPct.toFixed(1)), targetPct: h.targetPct })),
  }));
}

/** A card for the user to confirm. Nothing is placed here; every check runs again when they press Confirm. */
export async function prepareCopy(uid: number, v: BasketView, usdIn: number): Promise<Proposal> {
  const { usd } = await checkCopy(uid, v.id, usdIn);
  const n = tokensText(v.weights.length);
  return {
    summary: `Copy ${v.name}: $${usd} across ${n}`, trades: [], basket: { id: v.id, usd },
    card: {
      title: `${v.name} · Trade`, usd, kind: v.weights.length === 1 ? "One market order" : `${v.weights.length} market orders, one per token`, token: v.name, href: `/b/${v.id}#copy`,
      fee: copyFee(v.owner, usd).fee, stopPct: v.stopPct || undefined, tpPct: v.tpPct || undefined,
      maxLoss: v.stopPct ? (usd * v.stopPct) / 100 : undefined, maxGain: v.tpPct ? (usd * v.tpPct) / 100 : undefined,
    },
  };
}

/** Which kind of basket a question is after. */
export function askedFor(text: string): BasketSearch {
  const t = text.toLowerCase();
  const assetClass: AssetClass | undefined = /\b(us stocks?|stocks?|equit(y|ies)|s&p|sp ?500|index funds?|nvidia|apple|microsoft|google|alphabet|amazon|tesla|spacex|sandisk)\b/.test(t) ? "stock" : /\bmemes?\b|\bmemecoins?\b/.test(t) ? "meme" : /\balt(coin)?s?\b/.test(t) ? "alt" : /\b(major|majors|blue.?chips?|bitcoin|btc)\b/.test(t) ? "major" : undefined;
  const risk: RiskLevel | undefined = /\b(safe|safer|safest|low(er)?[- ]risk|steady|conservative|cautious)\b/.test(t) ? "steady" : /\b(aggressive|high[- ]risk|risky|degen)\b/.test(t) ? "aggressive" : undefined;
  return { assetClass, risk };
}

const moneyAsked = (t: string) => { const m = /\$\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:usd|usdc|dollars|bucks)\b/i.exec(t); return m ? Number(m[1] ?? m[2]) : undefined; };
/** An order, not a question: "copy $20 of X" is, "is X worth copying?" isn't. */
const wantsToCopy = (t: string) => /\b(copy|buy|invest|put|ape)\b/i.test(t) && (moneyAsked(t) !== undefined || !/\?\s*$|\b(worth|should|good|safe|what|why|how)\b/i.test(t.trim()));

/** Follow-ups that stay on a basket the chat is already about. */
const followUp = (t: string) => /\b(worst|lose|risk|risky|stop|safe|worth|copy|hold|holds|tokens?|mix|make.?up|why|how much)\b/i.test(t);

/** Is this about baskets? Anything naming one counts, even "buy $20 of Steady Stack", so it can't turn into a token buy. */
export async function aboutBaskets(text: string, pinned?: number): Promise<boolean> {
  if (await basketNamed(text)) return true;
  if (/\bbaskets?\b/i.test(text)) return true;
  if (/\b(invest|diversif\w*|what (should|can) i (buy|copy)|recommend|looking for)\b/i.test(text)) return true;
  if (askedFor(text).assetClass && /\b(show|find|any|which|want|give|into|got)\b/i.test(text)) return true;
  return !!pinned && followUp(text);
}

export interface BasketAnswer { reply: string; read?: BasketRead; basket?: number; handle?: string; proposal?: Proposal; follow?: { label: string; text?: string; href?: string }[] }

function worstCase(v: BasketView, usd: number): string {
  return v.stopPct
    ? `On $${usd} the stops aim to cap the loss near $${((usd * v.stopPct) / 100).toFixed(2)}, but a stop is a trigger, not a guarantee: in a fast market it can fill lower.`
    : `It has no stop-loss, so nothing limits the fall: all $${usd} is at risk.`;
}

/** The built-in answer, for when no AI model is available. */
export async function basketAnswer(uid: number, text: string, pinned?: number): Promise<BasketAnswer | undefined> {
  if (/\bmy (baskets?|cop(y|ies))\b|\bbaskets? (do|am) i\b/i.test(text)) {
    const mine = await myBasketFacts(uid);
    if (!mine.length) return { reply: "You don't copy any trades yet. Tell me what you're after: major coins, US stocks, altcoins or memes.", follow: [{ label: "Find a steady basket", text: "show me steady baskets" }, { label: "All baskets", href: "/feed?tab=top" }] };
    const waiting = mine.filter((m) => m.rebalanceWaiting);
    return {
      reply: `You copy ${mine.length} trade${mine.length === 1 ? "" : "s"}: ${mine.map((m) => `${m.basket} $${m.valueUsd.toFixed(2)} (${signed(m.profitPct)})`).join(", ")}.${waiting.length ? ` ${waiting.map((m) => m.basket).join(", ")} ${waiting.length === 1 ? "has a rebalance" : "have rebalances"} waiting for you.` : ""}`,
      follow: mine.slice(0, 3).map((m) => ({ label: m.basket, href: m.url })),
    };
  }

  const named = (await basketNamed(text)) ?? (pinned && followUp(text) ? await basketNamed(pinned) : undefined);
  if (named) {
    const usd = moneyAsked(text);
    const max = getMeta(uid).defaults.max;
    if (wantsToCopy(text)) {
      if (usd === undefined) return { reply: `How much of ${named.name}? Your max per copy is $${max}.`, basket: named.id, handle: named.handle, follow: [10, 25].filter((x) => x <= max).map((x) => ({ label: `Copy $${x}`, text: `copy $${x} of ${named.name}` })) };
      try {
        const proposal = await prepareCopy(uid, named, usd);
        return { reply: `Here's ${named.name} at $${proposal.basket!.usd}: ${mixText(named)}, rated ${RISK_LEVELS[named.risk].label}. ${worstCase(named, proposal.basket!.usd)} Check the card and press Confirm & sign.`, basket: named.id, handle: named.handle, proposal };
      } catch (e) {
        return { reply: `I can't set that up: ${(e as Error).message}.`, basket: named.id, handle: named.handle };
      }
    }
    const read = await basketRead(named);
    const makeup = named.weights.map((w) => `${w.symbol} ${w.weight}%`).join(", ");
    const size = Math.min(25, max);
    const risky = /\b(worst|lose|risk|risky)\b/i.test(text);
    return {
      reply: `${named.name} by @${named.handle} holds ${makeup}: ${mixText(named)}, rated ${RISK_LEVELS[named.risk].label}. Its index is ${signed(named.returnPct)} over ${days(named)} day${days(named) === 1 ? "" : "s"}, which is worked out from prices, not profit anyone banked. ${risky ? worstCase(named, size) : named.stopPct ? `Every token has a stop at −${named.stopPct}%.` : "It has no stop-loss."} Copying places one Flash order per token from your own wallet, and CopyGuard checks @${named.handle} again first.`,
      read, basket: named.id, handle: named.handle,
      follow: [{ label: "Open the basket", href: `/b/${named.id}` }, { label: `More from @${named.handle}`, href: `/u/${named.handle}#baskets` }, { label: `Copy $${size}`, text: `copy $${size} of ${named.name}` }],
    };
  }

  const asked = askedFor(text);
  const found = await findBaskets(uid, { ...asked, limit: 3 });
  const what = [asked.risk ? RISK_LEVELS[asked.risk].label.toLowerCase() : "", asked.assetClass ? ASSET_CLASSES[asked.assetClass].label : ""].filter(Boolean).join(" ");
  if (!found.length) {
    if (!(await liveBaskets()).length) return { reply: "There are no trades yet. You can build the first one from Portfolio, under Creating.", follow: [{ label: "Build a basket", href: "/baskets/new" }] };
    return { reply: `Nothing fits ${what || "that"} right now, because I leave out paused creators and trades you already copy. You could build one, or look wider.`, follow: [{ label: "All baskets", href: "/feed?tab=top" }, { label: "Build a basket", href: "/baskets/new" }] };
  }
  const line = ({ v, read }: { v: BasketView; read: BasketRead }) => `${v.name} by @${v.handle} (${mixText(v)}; ${RISK_LEVELS[v.risk].label}; ${v.stopPct ? `stop −${v.stopPct}%` : "no stop"}; ${read.label})`;
  return {
    reply: `${what ? `For ${what}` : "Best protected first"}: ${found.map(line).join("; ")}. I rank on protection and fit, not on return: a basket's return is an index from prices, not profit anyone banked. These are options, not advice.`,
    follow: found.map(({ v }) => ({ label: `Is ${v.name} worth copying?`, text: `Is the trade "${v.name}" worth copying?` })),
  };
}

/** Rules for the model, kept with the tools they belong to. */
export const basketRules = () => [
  `Trades are Tribe's main product: a creator publishes a set of tokens with target weights, and a follower copies it into their own wallet with one Flash order per token. New weights never move anyone's money until they approve a rebalance. Each trade shows its make-up by class (Major coins, US stocks, Altcoins, Meme coins, Unclassified) and a risk band (Steady, Balanced, Aggressive).`,
  `Think like a careful trader. Lead with make-up, risk band, stop and the creator's Guard status. Never rank or recommend on return: simulatedIndexReturnPct comes from token prices, not profit anyone banked, so always call it simulated and give its age, and treat a young basket's number as noise. Point out concentration, and that a trade of correlated coins isn't really diversified. "Unclassified" means nobody has reviewed that token: say so.`,
  `Stops are triggers, not guarantees: in a fast market or a thin pool they can fill worse, so call max loss an estimate. US stocks here are Coinbase tokenized stocks (NVDAc, AAPLc and others) and the deSPXA S&P 500 fund token. They trade around the clock on onchain pools, but the underlying market closes and their Chainlink feeds freeze on nights, weekends and holidays, so a pool price can drift from the last real price and a stop can fire on a thin overnight market. They aren't shares in a brokerage account. The issuer offers them only in eligible places outside the US, and wallets can be blocked. A broad fund spreads risk; one stock doesn't, and several big tech names tend to move together. MSTRc trades like leveraged Bitcoin, so MSTRc with cbBTC is one bet, not two.`,
  `Give facts and trade-offs, never personal advice: don't say "you should", don't promise returns, and offer up to three options that fit. If someone asks what to invest in and hasn't said, ask what they're after and how much risk they want. Use find_baskets to search, basket_info for one trade, my_baskets for what they hold. To copy, call propose_basket_copy; they confirm on the card. If they say "buy" with a basket's name they mean copying it. If no amount was given, ask for one. Rebalances are approved on the basket's page, so link it.`,
  isDry() ? "" : `Trade copies use real money right now, so make that clear before offering one.`,
].filter(Boolean);
