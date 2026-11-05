import { db, getMeta, haltOf, userById } from "./db.js";
import { mirror, type MirrorResult } from "./copy.js";
import { parseTrade } from "./parse.js";
import { dayStart } from "./stats.js";

/**
 * Users' own bots. The CRE agent workflow (cre-workflow/agent-workflow) decides when the strategy trades and why;
 * every user who switched their bot on gets that trade placed from their own wallet, under their own username,
 * sized by their bot settings and tagged Bot. Their copiers copy it like any other trade, by their own rules.
 */
export const botUsers = () =>
  (db.prepare("SELECT id FROM users WHERE json_extract(meta, '$.bot.on') = 1 ORDER BY id").all() as unknown as { id: number }[]).map((r) => r.id);

export const botTradesToday = (uid: number) =>
  (db.prepare("SELECT COUNT(*) AS n FROM trades WHERE leader = ? AND source IN ('bot','cre') AND at >= ?").get(uid, dayStart()) as { n: number }).n;

export interface BotRun { user: number; handle: string; result?: MirrorResult; skipped?: string }

export async function runBots(args: string[], thesis?: string): Promise<BotRun[]> {
  const base = parseTrade(args);
  const out: BotRun[] = [];
  for (const uid of botUsers()) {
    const handle = userById(uid)?.handle ?? String(uid);
    const bot = getMeta(uid).bot;
    if (haltOf(uid)) { out.push({ user: uid, handle, skipped: "paused by CopyGuard" }); continue; }
    if (botTradesToday(uid) >= bot.perDay) { out.push({ user: uid, handle, skipped: `daily limit of ${bot.perDay} bot trades reached` }); continue; }
    // The strategy's prices (entry, take-profit, stop) stay; only the size is the user's.
    const trade = base.side === "buy" ? { ...base, qty: String(bot.usd) } : base;
    out.push({ user: uid, handle, result: await mirror(uid, trade, "bot", thesis) });
  }
  return out;
}
