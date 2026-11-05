import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";
import express from "express";
import { privateKeyToAccount } from "viem/accounts";
import {
  claimPending, db, followersOf, getFollowRules, getMeta, getUser, haltLeader, haltListeners, haltOf, recentTrades, resumeLeader, saveSeasonBoard, setFollow, setHandle, setMeta, userByHandle,
  type SeasonBoardRow,
} from "./db.js";
import { closeCopiesOf, execute, mirror, type PendingNotice } from "./copy.js";
import { parseTrade, TOKENS } from "./parse.js";
import type { FollowRules } from "./rules.js";
import { makeLoginToken, verify } from "./auth.js";
import { onPending, appRouter } from "./app.js";
import { watchCopyGuard } from "./guard.js";
import { creRouter } from "./cre-api.js";
import { isDry, startTracker } from "./tracker.js";
import { startOrderStream } from "./stream.js";
import { ranking } from "./stats.js";
import { catAsk, catConfirm } from "./cat.js";
import { researchTrade, verdictText } from "./research.js";
import { latestChat } from "./db.js";
import { enableDemoPrices } from "./prices.js";
import { seedDemoSignals } from "./signals.js";
import { assertSafeConfig } from "./preflight.js";
import { rateLimit } from "./ratelimit.js";
import { privyRouter } from "./privy-api.js";
import { walletRouter } from "./wallet-api.js";
import { tickBots } from "./creator.js";
import { startLocalCre } from "./cre-local.js";

assertSafeConfig();
// Copiers who opted in sell what they copied from a trader as soon as CopyGuard pauses them.
haltListeners.push((leader) => void closeCopiesOf(leader).catch((e) => console.error(`close copies of ${leader}:`, (e as Error).message)));

const bot = process.env.TELEGRAM_BOT_TOKEN ? new Bot(process.env.TELEGRAM_BOT_TOKEN) : undefined;
const baseUrl = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
// Telegram rejects URL buttons to localhost (and the whole message with them), so link buttons need a public https URL.
const linkable = () => (process.env.PUBLIC_URL ?? "").startsWith("https://");
// DEMO=true gives the /demo sign-in, the director and seeded data. Its offline prices can be turned off
// (DEMO_PRICES=false) to record the seeded app with real Flash prices and, with DRY_RUN=false, real orders.
if (process.env.DEMO === "true" && process.env.DEMO_PRICES !== "false") enableDemoPrices();
// Demo: a few calls from the seeded traders on the Signals page (once; posted calls are kept).
if (process.env.DEMO === "true") void seedDemoSignals().catch(() => undefined);

// Live demo: trade from funded wallets instead of the generated demo wallets (Base mainnet, real Flash orders with DRY_RUN=false).
// LIVE_WALLET_PRIVATE_KEY binds one wallet to LIVE_WALLET_HANDLE (default "you"); LIVE_WALLETS="you:0x…,kestrel:0x…" (kestrel runs a bot in the demo, so its key makes bot trades real too)
// binds several, which a live copy needs (the leader's own order must fill before followers copy it).
const liveWallets = [
  ...(process.env.LIVE_WALLET_PRIVATE_KEY ? [`${process.env.LIVE_WALLET_HANDLE ?? "you"}:${process.env.LIVE_WALLET_PRIVATE_KEY}`] : []),
  ...(process.env.LIVE_WALLETS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
];
for (const entry of liveWallets) {
  const [handle, raw] = entry.split(":");
  const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  const u = userByHandle(handle);
  if (!u) {
    console.log(`Live wallet for @${handle}: no such user`);
    continue;
  }
  const address = privateKeyToAccount(pk).address;
  db.prepare("UPDATE users SET pk = ?, address = ? WHERE id = ?").run(pk, address, u.id);
  console.log(`@${u.handle} trades from ${address}`);
}

const describe = (t: PendingNotice["trade"]) => `${t.orderType} ${t.side} ${t.qty}${t.triggers ? " @ " + t.triggers.map((x) => x.notionalPrice).join("/") : ""}`;

/** Telegram chat for a user: Telegram-born users are their own chat; web users link one with /start link_<token>. */
const chatIdOf = (user: number): number | undefined => (user < 1e10 ? user : getMeta(user).tgId);

async function notifyPending(list: PendingNotice[], leader: number) {
  if (!bot) return;
  for (const p of list) {
    if (!getMeta(p.follower).aReq) continue;
    const chat = chatIdOf(p.follower);
    if (!chat) continue;
    // Cat's read on the leader's trade, so the decision is made with the same checks as in the app.
    const v = (await researchTrade(p.follower, p.tradeId, "Is this a good trade?").catch(() => undefined))?.verdict;
    const kb = new InlineKeyboard().text("Approve", `ok:${p.pendingId}`).text("Skip", `no:${p.pendingId}`);
    if (linkable()) kb.row().url("Ask Cat more", `${baseUrl()}/cat/chat?new=1&trade=${p.tradeId}&q=${encodeURIComponent("Is this a good trade?")}`);
    await bot.api.sendMessage(chat, `@${getUser(leader).handle} just traded. Your copy: ${describe(p.trade)}${v ? `\n\n${verdictText(v)}` : ""}\n\nApprove within ${getMeta(p.follower).timerSec}s (or use the web inbox).`, { reply_markup: kb }).catch(() => undefined);
  }
}
onPending((p, l) => void notifyPending(p, l));

async function notifyHalt(leader: number, halted: boolean, reason?: string) {
  if (!bot) return;
  const text = halted ? `🛡️ CopyGuard paused ${getUser(leader).handle}: ${reason}\nNew trades will not be copied.` : `✅ CopyGuard cleared ${getUser(leader).handle}. Copying resumed.`;
  for (const f of followersOf(leader)) { const chat = chatIdOf(f.follower); if (chat && getMeta(f.follower).aGuard) await bot.api.sendMessage(chat, text).catch(() => undefined); }
}

if (bot) {
  bot.command("start", (c) => {
    const u = getUser(c.from!.id);
    const m = /^follow_(\w+)$/.exec(c.match);
    if (m) {
      const leader = userByHandle(m[1]);
      if (leader && leader.id !== u.id) {
        setFollow(u.id, leader.id);
        return c.reply(`Now copying ${leader.handle} in ask-first mode. Tune it at ${baseUrl()}/u/${leader.handle} (send /web to sign in).`);
      }
    }
    return c.reply(
      `Tribe: social trading on Flash.\nTrading wallet (fund with USDC on Base): ${u.address}\nHandle: ${u.handle} (change with /handle name)\n\n` +
        `/web: open the app (feed, Ask Cat, leaderboard)\n/follow <handle> [auto|ask]\n/rules <handle> max=50 cap=200 ratio=1 tokens=ETH types=bracket,stop-loss protective=on\n` +
        `/trade long ETH 50 2600 2300 (buy with take-profit and stop attached) | buy ETH 50 | stop ETH 0.01 1800 | tp ETH 0.01 5000 | bracket ETH 0.01 5000 1800 | limit ETH 100 2000 | stopbuy ETH 50 2600 | twap ETH 100 1800 12\n/board\n\nOr just talk to Cat: "buy $50 ETH with a 5% stop and 12% target".`,
    );
  });

  bot.command("web", (c) => {
    getUser(c.from!.id);
    // Sign-in is wallet-only: the bot points to it rather than handing out a link that would skip the wallet.
    return c.reply(`Sign in with your wallet at ${baseUrl()}/signin`);
  });

  bot.command("handle", (c) => (setHandle(getUser(c.from!.id).id, c.match.trim()) ? c.reply("Handle updated.") : c.reply("3-20 letters, numbers or _, and not taken.")));

  bot.command("follow", (c) => {
    const [name, mode] = c.match.split(/\s+/);
    const leader = userByHandle(name ?? "");
    if (!leader || leader.id === c.from!.id) return c.reply("Usage: /follow <handle> [auto|ask]");
    getUser(c.from!.id);
    const r = setFollow(c.from!.id, leader.id, mode === "auto" ? { mode: "auto" } : {});
    return c.reply(`Copying ${leader.handle} in ${r.mode} mode. Tune with /rules ${leader.handle} ...`);
  });

  bot.command("rules", (c) => {
    const [name, ...kvs] = c.match.split(/\s+/).filter(Boolean);
    const leader = userByHandle(name ?? "");
    const cur = leader && getFollowRules(c.from!.id, leader.id);
    if (!leader || !cur) return c.reply("Follow them first: /follow <handle>");
    const patch: Partial<FollowRules> = {};
    for (const kv of kvs) {
      const [k, v] = kv.split("=");
      if (k === "max") patch.maxUsdPerTrade = Number(v);
      else if (k === "cap") patch.dailyCapUsd = Number(v);
      else if (k === "ratio") patch.ratio = Number(v);
      else if (k === "mode" && (v === "auto" || v === "ask")) patch.mode = v;
      else if (k === "protective") patch.copyProtective = v === "on";
      else if (k === "types") patch.orderTypes = v ? v.split(",") : [];
      else if (k === "tokens") patch.tokens = v ? v.split(",").map((s) => (TOKENS[s.toUpperCase()] ?? s).toLowerCase()) : [];
      else return c.reply(`Unknown rule ${k}`);
    }
    if ([patch.maxUsdPerTrade, patch.dailyCapUsd, patch.ratio].some((n) => n !== undefined && !(n > 0))) return c.reply("Numbers must be > 0");
    return c.reply(JSON.stringify(setFollow(c.from!.id, leader.id, patch), null, 1));
  });

  bot.command("board", async (c) =>
    c.reply((await ranking("profit", 10)).map((s, i) => `${i + 1}. ${s.handle} L${s.level} ${s.pnlPct.toFixed(2)}% (${s.followers} followers)`).join("\n") || "No traders yet"),
  );

  bot.command("trade", async (c) => {
    try {
      const t = parseTrade(c.match.split(/\s+/).filter(Boolean));
      getUser(c.from!.id);
      const res = await mirror(c.from!.id, t, "user");
      await notifyPending(res.pending, c.from!.id);
      return c.reply(`Trade #${res.tradeId} (${res.own}): ${res.executed.length} copied, ${res.pending.length} awaiting approval, ${res.skipped.length} skipped\nShare: ${baseUrl()}/t/${res.tradeId}`);
    } catch (e) {
      return c.reply((e as Error).message);
    }
  });

  // Free text goes to Cat: the same Cat, chats and memory as the app.
  bot.on("message:text", async (c) => {
    if (c.message.text.startsWith("/")) return;
    const uid = c.from!.id;
    getUser(uid);
    const chatId = latestChat(uid, "Telegram", 30 * 60_000)?.id;
    const r = await catAsk(uid, c.message.text, { chatId, source: "Telegram" });
    const card = r.card;
    const extra = card ? `\n\n${card.title} · ${card.kind}: $${card.usd.toFixed(2)}${card.maxLoss !== undefined ? ` · max loss $${card.maxLoss.toFixed(2)}` : ""}${card.maxGain !== undefined ? ` · max gain $${card.maxGain.toFixed(2)}` : ""} · fee $${card.fee.toFixed(2)}` : "";
    const read = r.verdict ? `\n\n${verdictText(r.verdict)}` : "";
    // A research answer links back to the post and to copying it in the app.
    const kb = r.proposalId ? new InlineKeyboard().text("Confirm & sign", `cat:${r.proposalId}`)
      : r.ctx && linkable() ? new InlineKeyboard().url("Open the post", `${baseUrl()}/t/${r.ctx.id}`).url(r.ctx.copying ? "Manage copy" : "Copy with Flash", `${baseUrl()}${r.ctx.copying ? "/traders" : `/copy/${r.ctx.handle}`}`) : undefined;
    return c.reply(r.reply + extra + read, kb ? { reply_markup: kb } : undefined);
  });

  bot.on("callback_query:data", async (c) => {
    if (c.callbackQuery.data.startsWith("cat:")) {
      const out = await catConfirm(c.from.id, c.callbackQuery.data.slice(4), (p, l) => void notifyPending(p, l));
      await c.editMessageText(out.reply).catch(() => undefined);
      return c.answerCallbackQuery({ text: out.ok ? "Signed" : "Not placed" });
    }
    const [kind, idStr] = c.callbackQuery.data.split(":");
    const claim = claimPending(Number(idStr), c.from.id, kind === "ok" ? "approved" : "skipped");
    if (!claim) return c.answerCallbackQuery({ text: "Already handled or expired" });
    if (kind === "ok") await c.editMessageText(`Approved: ${await execute(claim.tradeId, c.from.id, claim.leader, claim.trade)}`);
    else await c.editMessageText("Skipped");
    return c.answerCallbackQuery();
  });
}

const app = express();
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || true);
// CRE endpoints (src/cre-api.ts). express.json is applied per route there, so the web router keeps its own body parsing.
app.use(creRouter({ pending: notifyPending, halt: notifyHalt }));
// Per IP and minute: Ask Cat calls a paid model; sign-in links are guessable only by brute force; the rest is headroom
// for the deck's polling (about 16 requests a minute per open tab).
app.use("/api/cat", rateLimit(20, 60_000));
app.use(["/signin", "/login", "/demo"], rateLimit(20, 60_000));
app.use("/api", rateLimit(300, 60_000));
app.get("/api/recent", (_q, r) => r.json(recentTrades()));
// Privy wallets: the Connect wallet page and its API (src/privy-api.ts), and the page's browser bundle (web/).
app.use("/static", express.static(new URL("../public", import.meta.url).pathname, { maxAge: "1h" }));
app.use(privyRouter());
app.use(walletRouter());
app.use(appRouter());

startTracker();
// Live orders update from Flash's orders stream; polling becomes a slow safety sweep while the stream is healthy.
if (!isDry()) startOrderStream();
watchCopyGuard((leader, halted, reason) => void notifyHalt(leader, halted, reason));
// Chainlink CRE from this machine until the workflows are deployed (CRE_LOCAL=true).
startLocalCre();

// Creators' bots: record prices and give every running bot a look, once a minute (BOT_TICK_MS to change).
setInterval(() => void tickBots().catch((e) => console.error("bots:", (e as Error).message)), Number(process.env.BOT_TICK_MS ?? 60_000));

app.listen(Number(process.env.PORT ?? 8787), () => console.log(`Tribe on ${baseUrl()} (bot ${bot ? "on" : "off: set TELEGRAM_BOT_TOKEN"}, DRY_RUN=${process.env.DRY_RUN !== "false"})`));
void bot?.start();
