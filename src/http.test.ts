process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";
process.env.SESSION_SECRET = "test";
process.env.ALLOW_PLAIN_SIGNUP = "1"; // most tests sign up without a wallet; the wallet path has its own test

import test, { after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

const prices = await import("./prices.js");
const { appRouter } = await import("./app.js");
const db = await import("./db.js");
const { riskScore } = await import("./risk.js");

prices.enableDemoPrices(); // token lookups answer from the demo list, with no network
prices.setPriceProvider(async () => 2500);
process.env.CRE_SHARED_SECRET = "cre-test";
const { creRouter } = await import("./cre-api.js");
const halts: [number, boolean][] = [];
const app = express();
app.use(creRouter({ halt: (leader, halted) => void halts.push([leader, halted]) }));
app.use((await import("./wallet-api.js")).walletRouter());
app.use((await import("./chief-api.js")).chiefRouter()); // Ask Chief is parked: only these tests still mount it, and many use it to place trades
app.use(appRouter());
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

const basketWeights = [{ token: "0x4200000000000000000000000000000000000006", weight: 60 }, { token: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", weight: 40 }];

/** Minimal cookie-carrying client. */
function client() {
  let cookie = "";
  const call = async (path: string, body?: unknown) => {
    const r = await fetch(base + path, { method: body === undefined ? "GET" : "POST", redirect: "manual", headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const type = r.headers.get("content-type") ?? "";
    return { status: r.status, loc: r.headers.get("location"), json: type.includes("json") ? await r.json() : undefined, text: type.includes("html") ? await r.text() : "" };
  };
  return call;
}

test("risk score", () => {
  assert.equal(riskScore({ drawdown24h: 0, tradesLastHour: 0, topPositionPct: 0, riskFlaggedToken: false }), 0);
  assert.ok(riskScore({ drawdown24h: 22, tradesLastHour: 8, topPositionPct: 100, riskFlaggedToken: false }) >= 90);
  assert.equal(riskScore({ drawdown24h: 99, tradesLastHour: 99, topPositionPct: 100, riskFlaggedToken: true }), 100);
});

test("pages need a session, public pages do not", async () => {
  const c = client();
  assert.equal((await c("/feed")).loc, "/signin");
  assert.equal((await c("/intro")).status, 200);
  assert.equal((await c("/api/pause-all", {})).status, 401);
});

test("signup, trade through Ask Chief, follow, approve", async () => {
  const lead = client();
  const fol = client();
  assert.ok((await lead("/api/signup", { handle: "leader1", avatar: 1, persona: "Sniper" })).json.redirect);
  assert.ok((await fol("/api/signup", { handle: "follower1", avatar: 2, persona: "Hodler" })).json.redirect);
  assert.equal((await fol("/api/signup", { handle: "leader1", persona: "Sniper" })).json.error?.includes("taken"), true);

  // Follower copies the leader, ask-first.
  const f = await fol("/api/follow", { leader: "leader1", mode: "ask", budget: 100, ratio: 1, max: 20, cap: 80, stop: "0" });
  assert.equal(f.json.redirect, "/copy/leader1?done=1");

  // Leader asks Chief to trade, then confirms.
  const a = await lead("/api/ask", { text: "buy $30 ETH with 5% stop and 12% take profit" });
  assert.ok(a.json.proposalId && a.json.card.maxLoss === 1.5);
  const ok = await lead("/api/confirm", { id: a.json.proposalId });
  assert.equal(ok.json.ok, true);
  // A proposal can only be confirmed once.
  assert.equal((await lead("/api/confirm", { id: a.json.proposalId })).json.ok, false);

  // The follower has a request, approves it, and ends up with a position.
  const inbox = await fol("/requests");
  assert.match(inbox.text, /just traded/);
  const pending = db.pendingFor(db.userByHandle("follower1")!.id);
  assert.ok(pending.length >= 1);
  const ap = await fol("/api/pending", { id: pending[0].id, action: "approve" });
  assert.equal(ap.json.redirect, "/requests?result=ok");
  const pos = await fol("/positions");
  assert.match(pos.text, /ETH · Long/);

  // Pages render with data.
  for (const p of ["/feed", "/feed?tab=top", "/guard", "/me", "/traders", "/u/leader1", "/portfolio?tab=creating", "/activity", "/settings", "/share/me"]) {
    assert.equal((await fol(p)).status, 200, p);
  }
});

test("balance gating and pause-all", async () => {
  const c = client();
  await c("/api/signup", { handle: "broke1", persona: "Degen" });
  const uid = db.userByHandle("broke1")!.id;
  db.setMeta(uid, { simBalance: 0 });
  const a = await c("/api/ask", { text: "buy $50 ETH" });
  const r = await c("/api/confirm", { id: a.json.proposalId });
  assert.equal(r.json.ok, false);
  assert.match(r.json.reply, /free balance/);
  assert.equal((await c("/api/pause-all", { value: true })).json.toast, "All copying paused");
  assert.equal(db.getMeta(uid).pausedAll, true);
});

test("squads: create, join, leaderboard tab and feed chip", async () => {
  const a = client();
  const b = client();
  await a("/api/signup", { handle: "sqa1", persona: "Sniper" });
  await b("/api/signup", { handle: "sqb1", persona: "Sniper" });
  const made = (await a("/api/squad", { name: "Night Shift" })).json;
  assert.equal(made.toast, "Squad Night Shift created");
  assert.equal(made.redirect, "/squad");
  assert.equal((await b("/api/squad", { name: "Night Shift" })).json.error, "That name is taken."); // unique names
  const sq = db.allSquads()[0];
  assert.equal((await b("/api/squad-join", { id: sq.id })).json.toast, "You joined Night Shift");
  assert.equal(db.squadMembers(sq.id).length, 2);
  const tab = await a("/feed?tab=top&board=Squads");
  assert.match(tab.text, /Night Shift/);
  assert.equal((await a("/feed?tab=Squad")).status, 200);
  const page = await a("/squad");
  assert.match(page.text, /Night Shift/);
  assert.match(page.text, /@sqb1/); // members list
  assert.match((await a("/squads?q=night")).text, /Night Shift/);
  assert.match((await a("/squads?q=zzz")).text, /No squad called/);
  const left = (await b("/api/squad-leave", {})).json;
  assert.equal(left.toast, "You left Night Shift");
  assert.equal(left.redirect, "/squads");
  assert.equal((await b("/squad")).status, 200); // no squad: falls back to find and create
});

test("game: progress, badges, quests and level up", async () => {
  const c = client();
  await c("/api/signup", { handle: "gamer1", persona: "Sniper" });
  const me = db.userByHandle("gamer1")!;
  for (const path of ["/progress", "/progress?tab=Weekly", "/badges", "/levelup"]) assert.equal((await c(path)).status, 200, path);
  assert.match((await c("/progress")).text, /Level 1/);
  assert.equal((await c("/api/quest-claim", { id: "d-trade" })).json.error, "Finish the quest first");
  db.recordTrade(me.id, { chain: "base", target: "0x4200000000000000000000000000000000000006", contra: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", side: "buy", qty: "30", orderType: "bracket" } as never, "user");
  const claim = (await c("/api/quest-claim", { id: "d-trade" })).json;
  assert.equal(claim.toast, "+10 XP");
  assert.equal((await c("/api/quest-claim", { id: "d-trade" })).json.error, "Already claimed");
  // trade 10 + bracket 5 + quest 10
  assert.match((await c("/progress")).text, /25 XP/);
  assert.match((await c("/badges")).text, /First Trade, earned/);
});

test("CRE endpoints: snapshot, verdicts, agent signal, season board", async () => {
  const cre = (path: string, body?: unknown, secret = "cre-test") =>
    fetch(base + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-cre-secret": secret }, body: body ? JSON.stringify(body) : undefined });
  assert.equal((await cre("/guard/snapshot", undefined, "wrong")).status, 401);
  const c = client();
  await c("/api/signup", { handle: "crelead", persona: "Sniper" });
  const lead = db.userByHandle("crelead")!.id;
  db.setMeta(lead, { simBalance: 500 });
  await c("/api/ask", { text: "buy $20 ETH with 5% stop" }).then((r) => c("/api/confirm", { id: r.json.proposalId }));
  const snap = (await (await cre("/guard/snapshot")).json()) as { leader: number; risk: number }[];
  assert.ok(snap.some((s) => s.leader === lead && typeof s.risk === "number"));

  // CopyGuard posts a batch with the price check; a halt notifies once and blocks copying.
  const v = await (await cre("/cre/guard", { oracle: 2490, dex: 2500, deviationPct: 0.4, verdicts: [{ leader: lead, severity: "halt", reason: "22pp drawdown in 24h", tx: "0xabc" }] })).json();
  assert.deepEqual(v, { ok: true, received: 1 });
  assert.equal(db.haltOf(lead)?.tx, "0xabc");
  assert.equal(db.creRuns(1)[0].verdicts[0].reason, "22pp drawdown in 24h"); // the Guard log keeps every run
  assert.match((await c("/guard")).text, /Guard log/);
  await cre("/cre/guard", { verdicts: [{ leader: lead, severity: "halt", reason: "still bad" }] });
  assert.equal(halts.filter(([l]) => l === lead).length, 1); // idempotent: no second notification
  await cre("/cre/guard", { verdicts: [{ leader: lead, severity: "ok", reason: "checks passed" }] });
  assert.equal(db.haltOf(lead), undefined);

  // Bot signal: every user whose bot is on trades it under their own name, sized by their bot settings, tagged Bot.
  assert.equal((await c("/api/bot", { on: true, usd: 25, perDay: 1 })).json.toast, "Your bot is on");
  const s = await (await cre("/cre/signal", { args: ["long", "ETH", "10", "2650", "2400"], thesis: "Buying a pullback." })).json();
  const mine = s.placed.find((p: { handle: string }) => p.handle === "crelead");
  assert.ok(mine?.tradeId > 0, JSON.stringify(s));
  const t = db.tradeById(mine.tradeId)!;
  assert.deepEqual([t.leader, t.source, t.trade.qty, t.note], [lead, "bot", "25", "Buying a pullback."]);
  assert.deepEqual((t.trade as { attach?: unknown }).attach, { tp: "2650", sl: "2400" });
  const watcher = client();
  await watcher("/api/signup", { handle: "botwatcher", persona: "Sniper" });
  assert.doesNotMatch((await watcher(`/t/${mine.tradeId}`)).text, /srctag/); // on the record, with no Bot or Manual tag
  // Its daily limit holds, and a bot that is off doesn't trade.
  const again = await (await cre("/cre/signal", { args: ["long", "ETH", "10", "2650", "2400"] })).json();
  assert.match(again.skipped.find((x: { handle: string }) => x.handle === "crelead").why, /daily limit/);
  await c("/api/bot", { on: false });
  assert.equal((await (await cre("/cre/signal", { args: ["long", "ETH", "10", "2650", "2400"] })).json()).placed.some((p: { handle: string }) => p.handle === "crelead"), false);
  assert.equal((await c("/api/bot", { usd: 1 })).status, 400);
  assert.equal((await cre("/cre/signal", { args: ["nonsense"] })).status, 400);

  // Season board: traders list is public data only; the attested ranking is stored.
  const traders = (await (await cre("/cre/traders")).json()) as Record<string, unknown>[];
  assert.ok(traders.length > 0 && traders.every((x) => Object.keys(x).sort().join() === "address,handle,leader"));
  assert.equal((await cre("/cre/board", { season: 3, hash: "0x01", tx: "0xdef", computedAt: 1761900000, ranking: [{ leader: lead, handle: "crelead", pnlBps: 120, pnlUsd: 1.2, investedUsd: 100, fills: 2 }] })).status, 200);
  assert.equal(db.seasonBoard(3)?.tx, "0xdef");
  assert.equal((await cre("/cre/board", { season: "x" })).status, 400);
});

test("agents use the API with a bearer token (the MCP server's path)", async () => {
  const c = client();
  await c("/api/signup", { handle: "agentuser", persona: "Sniper" });
  const { createSession } = await import("./auth.js");
  const token = createSession(db.userByHandle("agentuser")!.id, "agent");
  const get = (path: string, t = token) => fetch(base + path, { headers: { authorization: `Bearer ${t}` } });
  const me = await (await get("/api/v1/me")).json();
  assert.equal(me.handle, "agentuser");
  assert.ok(Array.isArray((await (await get("/api/v1/top?days=7")).json()).traders));
  assert.ok("paused" in (await (await get("/api/v1/guard")).json()));
  assert.equal((await get("/api/v1/traders/nobody-here")).status, 400);
  assert.equal((await get("/api/v1/me", token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).status, 401); // tampered token
});

test("desktop split pages bring their own aside instead of the rail", async () => {
  const c = client();
  await c("/api/signup", { handle: "splitter", persona: "Sniper" });
  for (const path of ["/activity", "/alerts", "/funds", "/season", "/requests", "/strategy/new", "/progress", "/squads"]) {
    const r = await c(path);
    assert.equal(r.status, 200, path);
    assert.match(r.text, /class="paside"/, path);
    assert.doesNotMatch(r.text, /class="rail"/, path);
  }
  assert.equal((await c("/activity.csv")).status, 200);
  assert.equal((await client()("/activity.csv")).loc, "/signin");
  // logged-out share page has the join and share aside
  const pub = await client()("/u/splitter");
  assert.match(pub.text, /Share this trader/);
  assert.match(pub.text, /Join and copy @splitter/);
});

test("share cards render as PNG", async () => {
  const r = await fetch(`${base}/og/u/sqa1.png`);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal(buf.subarray(1, 4).toString(), "PNG");
  assert.ok(buf.length > 2000);
  assert.equal((await fetch(`${base}/og/u/nobody-here.png`)).status, 404);
});

test("demo director beats run in order", async () => {
  const { BEATS } = await import("./director.js");
  for (const h of ["nightowl", "traderx", "you"]) {
    const u = db.createWebUser(h === "you" ? "you_demo" : h, 0, "Sniper")!;
    if (h === "you") db.setHandle(u.id, "you", true); // "you" is reserved; only the demo seed claims it
    db.setMeta(u.id, { simBalance: 1000 });
  }
  db.setFollow(db.userByHandle("you")!.id, db.userByHandle("nightowl")!.id, { mode: "ask", requireStop: true });
  db.setFollow(db.userByHandle("you")!.id, db.userByHandle("traderx")!.id, { mode: "auto" });
  const out: string[] = [];
  for (const b of BEATS) out.push(await b.run());
  const said = (id: string) => out[BEATS.findIndex((b) => b.id === id)];
  assert.match(said("basket-launch"), /Night Index 1 published/);
  assert.match(said("basket-copy"), /Copied \$20 across 3 tokens/);
  assert.match(said("basket-rebalance"), /Version 2 published\. 1 copier/);
  assert.match(said("basket-partial"), /1 of 2 tokens filled/);
  assert.match(said("trade"), /1 copy request/);
  assert.match(said("guard"), /1 copy skipped by Guard/);
  assert.equal(db.haltOf(db.userByHandle("traderx")!.id), undefined); // cleared by beat 4
  assert.equal(db.guardEvents(db.userByHandle("traderx")!.id).map((e) => e.kind).join(","), "resume,halt");
});

test("Chief: persona tone, follow-ups, rules, memory and history", async () => {
  const c = client();
  await c("/api/signup", { handle: "catfan", persona: "Sniper" });
  const uid = db.userByHandle("catfan")!.id;
  db.setMeta(uid, { simBalance: 1000 });

  // Same numbers, different tone.
  const sharp = await c("/api/cat/ask", { text: "buy $50 ETH with 5% stop and 12% take profit" });
  assert.match(sharp.json.reply, /^Bracket order ready: \$50 of ETH/);
  assert.equal(sharp.json.card.maxLoss, 2.5);
  assert.ok(sharp.json.steps.length === 4 && sharp.json.sources.length === 3);
  await c("/api/cat/persona", { persona: "Chill" });
  const chill = await c("/api/cat/ask", { text: "buy $50 ETH with 5% stop and 12% take profit" });
  assert.match(chill.json.reply, /^Here's a Flash bracket order for \$50/);
  assert.equal(chill.json.card.maxLoss, sharp.json.card.maxLoss);
  assert.equal((await c("/api/cat/persona", { persona: "Pirate" })).status, 400);

  // Follow-ups edit the previous order inside the same chat.
  const tight = await c("/api/cat/ask", { text: "make the stop 3%", chat: chill.json.chatId });
  assert.equal(tight.json.card.stopPct, 3);
  assert.equal(tight.json.card.maxLoss, 1.5);
  const big = await c("/api/cat/ask", { text: "make it $100", chat: chill.json.chatId });
  assert.equal(big.json.card.usd, 100);
  assert.equal(big.json.card.maxLoss, 3);

  // Rules with a dollar limit add a warning; memory off ignores them.
  await c("/api/cat/memory", { op: "rule", text: "Ask me before anything over $50" });
  const over = await c("/api/cat/ask", { text: "buy $80 ETH with 5% stop" });
  assert.match(over.json.reply, /Your rule/);
  await c("/api/cat/memory", { op: "toggle" });
  assert.doesNotMatch((await c("/api/cat/ask", { text: "buy $80 ETH with 5% stop" })).json.reply, /Your rule/);
  await c("/api/cat/memory", { op: "toggle" });

  // Confirm marks the message signed; chats and pages persist.
  assert.equal((await c("/api/cat/confirm", { id: big.json.proposalId })).json.ok, true);
  assert.equal(db.msgsOf(big.json.chatId).find((m) => m.id === big.json.msgId)!.data!.signed, true);
  assert.equal((await c("/api/cat/vote", { msg: big.json.msgId, vote: 1 })).status, 200);
  // Ask Chief is off: every old link lands on the feed.
  for (const p of ["/cat", "/cat/chat?new=1&q=hello", "/cat/voice", "/cat/memory", "/settings/chief"]) assert.equal((await c(p)).loc, "/feed", p);
  // Chats like a chat app: follow-ups stay in their chat, a message with no chat starts a new one, titled by its question.
  assert.equal(new Set([chill.json.chatId, tight.json.chatId, big.json.chatId]).size, 1, "follow-ups land in the same chat");
  assert.notEqual(sharp.json.chatId, chill.json.chatId, "a message without a chat starts a new one");
  // Nothing in the app points at Chief any more.
  for (const p of ["/feed", "/feed?tab=top", "/settings", "/guard", "/me", "/portfolio"]) {
    const page = (await c(p)).text.replace(/<style>[\s\S]*?<\/style>/g, "");
    assert.doesNotMatch(page, /Ask Chief|id="chief"|data-ask=|\/feed\?ask=/, p);
  }
  assert.equal((await c("/api/cat/chat/delete", { id: sharp.json.chatId })).status, 200);
  assert.ok(!db.chatsOf(uid).some((x) => x.id === sharp.json.chatId), "deleted chats are gone");
  assert.equal((await c("/api/cat/chat/delete", { id: 999999 })).status, 400);

  // Forget one learned memory, then everything.
  await c("/api/cat/memory", { op: "forget", key: "kind" });
  await c("/api/cat/memory", { op: "wipe" });
  assert.equal(db.rulesOf(uid).length, 0);
  assert.equal(db.chatsOf(uid).length, 0);
});

test("Ask Chief about a feed post: verdict, history, worst case, and the way back", async () => {
  const lead = client();
  const me = client();
  await lead("/api/signup", { handle: "postlead", persona: "Sniper" });
  await me("/api/signup", { handle: "researcher", persona: "Sniper" });
  db.setMeta(db.userByHandle("postlead")!.id, { simBalance: 1000 });
  const a = await lead("/api/cat/ask", { text: "buy $40 ETH with 4% stop and 10% take profit" });
  await lead("/api/cat/confirm", { id: a.json.proposalId });
  const trade = (db.db.prepare("SELECT MAX(id) AS id FROM trades WHERE leader = ?").get(db.userByHandle("postlead")!.id) as { id: number }).id;

  // Every post links to a research chat about itself.
  const v = await me("/api/cat/ask", { text: "Is this a good trade?", trade });
  assert.ok(v.json.verdict && ["Looks solid", "Mixed", "Risky"].includes(v.json.verdict.label));
  assert.ok(v.json.verdict.checks.some((x: { t: string }) => /Has a stop/.test(x.t)));
  assert.equal(v.json.ctx.handle, "postlead");
  assert.ok(v.json.follow.some((f: { href?: string }) => f.href === `/t/${trade}`));

  // Follow-ups in the same chat stay about the post without resending it.
  const h = await me("/api/cat/ask", { text: "Show their track record", chat: v.json.chatId });
  assert.match(h.json.reply, /@postlead has traded/);
  const w = await me("/api/cat/ask", { text: "What's the worst case if I copy?", chat: v.json.chatId });
  assert.match(w.json.reply, /If the stop hits \(−4\.0%\), you lose about \$1\.00/); // $25 default max × 4%
  // A concrete order still becomes an order.
  assert.ok((await me("/api/cat/ask", { text: "buy $20 ETH with 5% stop", chat: v.json.chatId })).json.proposalId);

  // The chat page pins the post with a way back and a link to the trader's baskets.

  // Asked by name from anywhere (Chief home, Telegram, MCP): research their latest entry.
  const named = await me("/api/cat/ask", { text: "Is @postlead worth copying?" });
  assert.equal(named.json.ctx?.id, trade);
  assert.ok(named.json.verdict);
  assert.equal((await me("/api/cat/ask", { text: "Why was @postlead paused?" })).json.ctx, undefined); // Guard questions keep their answer
  assert.equal((await me("/api/cat/ask", { text: "What's the worst case if I copy?", handle: "@postlead" })).json.ctx?.id, trade); // the MCP tool's path

  // CRE CopyGuard verdicts show up in Chief's read once the workflow reports.
  await fetch(`${base}/cre/guard`, { method: "POST", headers: { "content-type": "application/json", "x-cre-secret": "cre-test" }, body: JSON.stringify({ oracle: 2500, dex: 2502, deviationPct: 0.08, verdicts: [{ leader: db.userByHandle("postlead")!.id, severity: "ok", risk: 20, reason: "checks passed" }] }) });
  const cre = await me("/api/cat/ask", { text: "Is this a good trade?", trade });
  assert.ok(cre.json.verdict.checks.some((x: { t: string; ok: boolean }) => /CRE CopyGuard .* clear/.test(x.t) && x.ok));
  assert.ok(cre.json.verdict.checks.some((x: { t: string }) => /Chainlink ETH\/USD \$2500 vs DEX \$2502/.test(x.t)));

  // Research is part of the game: a daily quest, and Chief's read before you copy.
  const uid = db.userByHandle("researcher")!.id;
  const { questsOf } = await import("./stats.js");
  assert.match((await me("/copy/postlead")).text, /Safety read on their latest trade/);
  assert.match((await me("/u/postlead")).text, /Safety read on their latest trade/);

  // Chief's calls are scored by what the trader did next: the call above, then a green exit.
  const { catCalls, topicOf } = await import("./research.js");
  const solidOrNot = v.json.verdict.label as string;
  assert.equal(catCalls().find((c) => c.label === solidOrNot)?.closed, 0);
  const { mirror } = await import("./copy.js");
  const { heldTokens } = await import("./tracker.js");
  const { parseTrade, TOKENS } = await import("./parse.js");
  const leadId = db.userByHandle("postlead")!.id;
  prices.setPriceProvider(async () => 2600);
  await mirror(leadId, parseTrade(["sell", "ETH", String(heldTokens(leadId, TOKENS.ETH))]));
  prices.setPriceProvider(async () => 2500);
  const scored = catCalls().find((c) => c.label === solidOrNot)!;
  assert.deepEqual([scored.closed, scored.green], [1, 1]);

  assert.equal(topicOf("What's the worst case if I copy? (the cat agent worth copying?)"), "risk");
  assert.equal(topicOf("Show the agent's history"), "history");
  assert.equal(topicOf("Is this a good trade? (@x worth copying?)"), "verdict");
});

test("web chrome: shell for signed-in pages, landing and sign-in when logged out", async () => {
  const anon = client();
  const landing = await anon("/");
  assert.equal(landing.status, 200);
  assert.match(landing.text, /Copy great traders/);
  assert.doesNotMatch(landing.text, /class="side"/);
  assert.equal((await anon("/signin")).status, 200);
  assert.equal((await anon("/portfolio")).loc, "/signin");
  assert.equal((await anon("/creator")).loc, "/portfolio?tab=creating"); // merged: old links land on the Creating tab
  assert.equal((await anon("/ranks?tab=Streaks&period=Month&q=x")).loc, "/feed?tab=top&board=Streaks&period=Month&q=x"); // the leaderboard is the feed's Top tab now

  const c = client();
  await c("/api/signup", { handle: "webuser", persona: "Sniper" });
  const feed = await c("/feed");
  // The feed is the deck, with everything else in its own side panel; other pages keep the global rail.
  for (const part of ['class="side"', 'class="topbar"', 'class="paside"', 'id="brief"', 'id="bstats"']) assert.match(feed.text, new RegExp(part), part);
  assert.doesNotMatch(feed.text, /Top this week/); // no leaderboard on the feed
  assert.doesNotMatch(feed.text, /Live from the tribe/);
  assert.match((await c("/guard")).text, /class="rail"/);
  assert.equal((await c("/search?q=webuser")).loc, "/u/webuser");
  assert.doesNotMatch(feed.text, /SHELL_(OPEN|CLOSE)/);
  assert.match((await c("/feed?tab=top&board=Profit")).text, /<table class="tbl">/);
  assert.match((await c("/guard")).text, /Guard/);
  const pf = await c("/portfolio");
  assert.equal(pf.status, 200);
  assert.match(pf.text, /Copy requests/);
  assert.equal((await c("/")).loc, "/feed");
  // voice mode sits in the shell on desktop, with its own transcript aside instead of the rail
  // focus pages stay chrome-free
  assert.doesNotMatch((await anon("/onboarding")).text, /class="rail"/);
  // active sidebar item follows the path
  assert.match((await c("/guard")).text, /class="side-item on" href="\/guard"/);
  // desktop profile copy opens the embedded wizard
  const lead = client();
  await lead("/api/signup", { handle: "lead9", persona: "Sniper" });
  assert.match((await c("/u/lead9")).text, /copy\/lead9\?embed=1/);
  assert.doesNotMatch((await c("/copy/lead9?embed=1")).text, /class="side"/);
});

test("profiles: unique usernames, photos, free follows, portfolio, and Manual vs Bot trades", async () => {
  const a = client();
  const b = client();
  await a("/api/signup", { handle: "PhotoGal", persona: "Sniper" });
  assert.ok(db.userByHandle("photogal"), "usernames are stored lowercase");
  // Unique ignoring case, and app words are reserved.
  assert.equal((await b("/api/signup", { handle: "photogal", persona: "Sniper" })).status, 400);
  assert.equal((await b("/api/signup", { handle: "PHOTOGAL", persona: "Sniper" })).status, 400);
  assert.equal((await b("/api/signup", { handle: "admin", persona: "Sniper" })).status, 400);
  assert.equal((await (await fetch(`${base}/api/handle?h=PhotoGal`)).json()).why, "That username is taken");
  await b("/api/signup", { handle: "watcher1", persona: "Sniper" });

  // Rename and bio; the old name is free again.
  assert.equal((await a("/api/profile", { handle: "photo_gal", bio: "Brackets only." })).json.toast, "Profile saved");
  assert.equal(db.userByHandle("photo_gal")?.bio, "Brackets only.");
  assert.equal((await a("/api/profile", { handle: "watcher1" })).json.error, "That username is taken");

  // Profile photo: a small data URL, served with a cache-busting URL, shown wherever the avatar is.
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  assert.equal((await a("/api/photo", { photo: "data:text/html;base64,PHNjcmlwdD4=" })).status, 400);
  assert.equal((await a("/api/photo", { photo: png })).json.toast, "Photo updated");
  const uid = db.userByHandle("photo_gal")!.id;
  const img = await fetch(`${base}/avatar/${uid}`);
  assert.deepEqual([img.status, img.headers.get("content-type")], [200, "image/png"]);
  assert.ok((await b("/u/photo_gal")).text.includes(`<img src="/avatar/${uid}?v=`), "the photo replaces the initials");

  // A manual trade, then one placed through the user's AI agent (Bearer token = the MCP path) is tagged Bot.
  db.setMeta(uid, { simBalance: 500 });
  const m = await a("/api/cat/ask", { text: "buy $20 ETH with 5% stop and 10% take profit" });
  const mc = await a("/api/cat/confirm", { id: m.json.proposalId });
  assert.equal(mc.json.ok, true, JSON.stringify([m.json, mc.json]));
  const { createSession } = await import("./auth.js");
  const auth = { "content-type": "application/json", authorization: `Bearer ${createSession(uid, "agent")}` };
  const p = await (await fetch(`${base}/api/cat/ask`, { method: "POST", headers: auth, body: JSON.stringify({ text: "buy $15 ETH with 4% stop" }) })).json();
  await fetch(`${base}/api/cat/confirm`, { method: "POST", headers: auth, body: JSON.stringify({ id: p.proposalId }) });
  const sources = (db.db.prepare("SELECT source FROM trades WHERE leader = ? ORDER BY id").all(uid) as { source: string }[]).map((r) => r.source);
  // The manual bracket is one trade; the agent's buy-with-stop is an entry plus its stop-loss, both the agent's.
  assert.equal(sources[0], "user");
  assert.ok(sources.length >= 2 && sources.slice(1).every((x) => x === "agent"), sources.join());

  // Free follow: no copying, but their trades show in Following and the count goes up.
  assert.equal((await b("/api/watch", { leader: "photo_gal" })).json.toast, "Following @photo_gal");
  assert.equal(db.isFollowing(db.userByHandle("watcher1")!.id, uid), false, "following is not copying");
  assert.match((await b("/u/photo_gal")).text, /id="baskets"/);
  const prof = (await b("/u/photo_gal")).text;
  assert.match(prof, /<b>1<\/b><span>follower<\/span>/);
  assert.match(prof, /aria-pressed="true"/);

  // Profile tabs: Manual vs Bot record, portfolio (no dollar amounts for visitors), trades filtered by who placed them.
  assert.doesNotMatch((await b("/u/photo_gal?tab=Overview")).text, /Manual vs Bot/);
  const port = (await b("/u/photo_gal?tab=Portfolio")).text;
  assert.match(port, /Live now/);
  assert.ok(!port.includes("/api/copy-trade"), "a single position can't be copied: people copy baskets");
  assert.match(port, /What they've made/); // past trades: month by month, on the profile portfolio
  assert.match(port, /% of portfolio</);
  assert.match((await a("/u/photo_gal?tab=Portfolio")).text, /% of portfolio · \$/); // the owner sees amounts
  for (const path of ["/profile/edit", "/bot"]) assert.equal((await a(path)).status, 200, path);
  assert.equal((await b("/api/watch", { leader: "photo_gal" })).json.toast, "Unfollowed @photo_gal");
});

test("baskets over HTTP: build, copy, change weights, approve, close, and every page renders", async () => {
  const maker = client(), fan = client(), anon = client();
  await maker("/api/signup", { handle: "basketmaker", persona: "Sniper" });
  await fan("/api/signup", { handle: "basketfan", persona: "Sniper" });
  const F = db.userByHandle("basketfan")!.id;
  db.setMeta(F, { simBalance: 500 });
  assert.equal((await maker("/api/baskets", { name: "x", weights: basketWeights })).status, 400);
  assert.match((await maker("/api/baskets", { name: "Half and Half", weights: [] })).json.error, /at least one token/);
  const made = await maker("/api/baskets", { name: "Half <b>Half", thesis: "Two big names", stopPct: 10, tpPct: 30, weights: basketWeights });
  const id = Number(made.json.redirect.split("/").pop());

  // Public page, escaped, with no way to copy until you sign in.
  const pub = (await anon(`/b/${id}`)).text;
  assert.match(pub, /Half &lt;b&gt;Half/);
  assert.match(pub, /Sign in to copy/);
  assert.match(pub, /What's in it/);
  assert.equal((await anon("/baskets")).status, 404); // the page is gone: Leaderboard lists baskets, Portfolio your copies, Creator yours
  assert.equal((await anon(`/b/${id + 999}`)).status, 200); // friendly not-found page

  // The creator's page has their controls, the follower's the copy form; the builder only opens for its owner.
  assert.match((await maker(`/b/${id}`)).text, /Change weights/);
  assert.match((await fan(`/b/${id}`)).text, /action="\/api\/basket-copy"/);
  assert.match((await fan(`/b/${id}/edit`)).text, /Basket not found/);
  assert.match((await maker(`/u/basketmaker`)).text, new RegExp(`href="/b/${id}"`));

  const copied = await fan("/api/basket-copy", { basket: id, usd: 20 });
  assert.equal(copied.json.redirect, `/b/${id}#yours`);
  const mine = (await fan(`/b/${id}`)).text;
  assert.match(mine, /Your copy/);
  assert.match(mine, /Close this copy/);
  assert.equal((await fan("/baskets")).status, 404);
  const studio = (await maker("/portfolio?tab=creating")).text;
  assert.match(studio, /Your baskets/);
  assert.match(studio, /New basket/);
  assert.doesNotMatch(studio, /New trade|New bot|href="\/trade\/new"|href="\/bots\/new"/);
  assert.match((await fan("/feed?tab=top")).text, /Half &lt;b&gt;Half/);
  assert.match((await fan("/portfolio")).text, /Half &lt;b&gt;Half/);
  assert.match((await fan("/activity")).text, /Half &lt;b&gt;Half/);

  // New weights: copiers get a request, and only they can answer it.
  assert.equal((await fan(`/api/baskets/${id}/weights`, { weights: basketWeights })).status, 400);
  const next = [{ token: basketWeights[0].token, weight: 30 }, { token: basketWeights[1].token, weight: 70 }];
  assert.match((await maker(`/api/baskets/${id}/weights`, { weights: next, note: "More AERO" })).json.toast, /1 copier asked to rebalance/);
  const page = (await fan(`/b/${id}`)).text;
  assert.match(page, /Rebalance Half/);
  assert.match(page, /More AERO/);
  const req = db.db.prepare("SELECT r.id FROM basket_requests r WHERE r.basket = ? AND r.status = 'open'").get(id) as { id: number };
  assert.equal((await maker("/api/basket-rebalance", { id: req.id, action: "approve" })).status, 400);
  assert.equal((await fan("/api/basket-rebalance", { id: req.id, action: "approve" })).json.toast, "Rebalanced");

  const c = db.db.prepare("SELECT id FROM basket_copies WHERE follower = ?").get(F) as { id: number };
  assert.equal((await maker(`/api/basket-copy/${c.id}/close`, {})).status, 400);
  assert.match((await fan(`/api/basket-copy/${c.id}/close`, {})).json.toast, /Sold 2 tokens/);
  assert.ok(!(await fan(`/b/${id}`)).text.includes("Your copy"));

  assert.equal((await fan(`/api/baskets/${id}/retire`, {})).status, 400);
  assert.equal((await maker(`/api/baskets/${id}/retire`, {})).json.toast, "Basket retired");
  assert.match((await fan(`/b/${id}`)).text, /retired/);
});

test("the MetaMask bridge stops on a dead session and waits on errors, so a stale tab can't flood the server", async () => {
  const js = await (await fetch(`${base}/app.js`)).text();
  assert.match(js, /if\(w\.status===401\)return;/);
  assert.match(js, /if\(!w\.ok\)throw new Error/);
  // A wait with no session answers 401, which is what stops the loop.
  assert.equal((await fetch(`${base}/api/sign/wait?tab=x`)).status, 401);
});

test("Chief answers about baskets by name, and suggests the best ones otherwise", async () => {
  const maker = client(), me = client();
  await maker("/api/signup", { handle: "chiefmaker", persona: "Sniper" });
  await me("/api/signup", { handle: "chiefasker", persona: "Sniper" });
  await maker("/api/baskets", { name: "Chief Check Basket", stopPct: 10, weights: basketWeights });
  const named = (await me("/api/cat/ask", { text: 'Is the basket "Chief Check Basket" worth copying?', newChat: true })).json;
  assert.match(named.reply, /Chief Check Basket by @chiefmaker holds ETH 60%/);
  assert.equal(named.verdict.label, "Looks solid");
  assert.ok(named.follow.some((f: { href?: string }) => /^\/b\/\d+$/.test(String(f.href))));
  assert.match((await me("/api/cat/ask", { text: "which baskets are best?", newChat: true })).json.reply, /Best protected first/);
  // Agents can ask for one kind.
  const listed = (await me("/api/v1/baskets?asset=major")).json.baskets.find((b: { name: string }) => b.name === "Chief Check Basket");
  assert.deepEqual(listed.mix[0], { assetClass: "Major coins", pct: 60 });
  assert.equal((await me("/api/v1/baskets?asset=stock")).json.baskets.some((b: { name: string }) => b.name === "Chief Check Basket"), false);
  // Agents read the same list.
  assert.ok((await me("/api/v1/baskets")).json.baskets.some((b: { name: string; creator: string }) => b.name === "Chief Check Basket" && b.creator === "chiefmaker"));
});

test("reactions: one per person, picked from the bar, replaced or removed", async () => {
  const lead = client();
  const fan = client();
  await lead("/api/signup", { handle: "reactlead", persona: "Sniper" });
  await fan("/api/signup", { handle: "reactfan", persona: "Sniper" });
  db.setMeta(db.userByHandle("reactlead")!.id, { simBalance: 500 });
  const p = await lead("/api/cat/ask", { text: "buy $20 ETH with 5% stop and 10% take profit" });
  await lead("/api/cat/confirm", { id: p.json.proposalId });
  const trade = (db.db.prepare("SELECT MAX(id) AS id FROM trades WHERE leader = ?").get(db.userByHandle("reactlead")!.id) as { id: number }).id;
  const fanId = db.userByHandle("reactfan")!.id;

  // The feed card carries the bar with all six badges in its picker.
  const feedHtml = (await fan(`/t/${trade}`)).text; // reactions live on the trade's page
  assert.ok(feedHtml.includes(`data-react="${trade}"`));
  for (const k of ["fire", "rocket", "diamond", "bull", "bear", "bulb"]) assert.ok(feedHtml.includes(`data-rx="${k}"`), k);

  const r1 = await fan("/api/react", { trade, emoji: "rocket" });
  assert.match(r1.json.html, /data-mine="rocket"/);
  assert.match(r1.json.html, /1 reaction, yours: To the moon/);
  // Picking another replaces it (one per person); empty removes it.
  await fan("/api/react", { trade, emoji: "bull" });
  assert.deepEqual(db.reactionCounts(trade, fanId).map((r) => [r.emoji, r.n, r.mine]), [["bull", 1, 1]]);
  assert.match((await lead("/api/react", { trade, emoji: "fire" })).json.html, /2 reactions/);
  assert.match((await fan("/api/react", { trade, emoji: "" })).json.html, /data-mine=""/);
  assert.equal(db.reactionCounts(trade).reduce((a, r) => a + r.n, 0), 1);
  assert.equal((await fan("/api/react", { trade, emoji: "🙃" })).status, 400);
  assert.equal((await fan("/api/react", { trade: 999999, emoji: "fire" })).status, 400);
  // The trade page shows the reaction picker on its card (no badge breakdown); the script that drives it ships in /app.js.
  assert.match((await fan(`/t/${trade}`)).text, /data-mine="[a-z]*"/);
  assert.match(await (await fetch(`${base}/app.js`)).text(), /data-rx/);
});

test("discover deck: one basket at a time, requests first, swipe to skip or copy within your limits", async () => {
  const lead = client();
  const me = client();
  await lead("/api/signup", { handle: "decklead", persona: "Sniper" });
  await me("/api/signup", { handle: "deckuser", persona: "Sniper" });
  const leadId = db.userByHandle("decklead")!.id, meId = db.userByHandle("deckuser")!.id;
  db.setMeta(leadId, { simBalance: 500 });
  db.setMeta(meId, { simBalance: 500 });
  const place = async (text: string) => {
    const p = await lead("/api/cat/ask", { text });
    await lead("/api/cat/confirm", { id: p.json.proposalId });
    return (db.db.prepare("SELECT MAX(id) AS id FROM trades WHERE leader = ? AND json_extract(trade,'$.side') = 'buy'").get(leadId) as { id: number }).id;
  };
  const publish = async (name: string, stopPct = 10) => Number((await lead("/api/baskets", { name, stopPct, weights: basketWeights })).json.redirect.split("/").pop());
  const b1 = await publish("Deck One"), b2 = await publish("Deck Two");

  // The deck shows each basket as a card with Chief's read and a count of copiers (never who). Single trades aren't on it.
  await place("buy $20 ETH with 5% stop and 10% take profit");
  let deck = (await me("/feed")).text;
  assert.ok(deck.includes(`data-basket="${b1}"`) && deck.includes(`data-basket="${b2}"`));
  assert.ok(!/class="swcard[^"]*" data-trade=/.test(deck), "no single trades in the deck");
  assert.match(deck, /Safety read/);
  assert.match(deck, /Copied by<\/div><div class="v" data-live="copiers">0 people/);
  assert.doesNotMatch(deck, /id="swfollow"|class="dtabs"/); // no follow button, no feed tabs
  assert.match(deck, /data-open="mytribe"/); // portfolio, quests and the tribe sit behind one button on phones
  // The page keeps itself current: fresh numbers for the cards on screen, and new cards as baskets are published.
  const live = (await me(`/api/deck/live?ids=${b1},${b2}`)).json;
  assert.ok(live[b1] && /people/.test(live[b1].copiers) && "since" in live[b1]);
  const more = (await me(`/api/deck/cards?have=b${b1},b${b2}`)).json.html as string;
  assert.ok(!more.includes(`data-basket="${b1}"`) && !more.includes(`data-basket="${b2}"`), "cards already on screen aren't sent again");
  assert.ok((await me(`/api/deck/cards?have=b${b1}`)).json.html.includes(`data-basket="${b2}"`));
  assert.doesNotMatch(deck, /data-react=/); // no comments or reactions in the deck

  // Swipe left: gone for good.
  await me("/api/swipe", { basket: b1, dir: "left" });
  assert.ok(!(await me("/feed")).text.includes(`data-basket="${b1}"`));

  // Swipe right: one copy, sized by you, inside your limits.
  assert.match((await me("/api/basket-copy", { basket: b2, usd: 9999 })).json.error, /your max per copy/);
  const ok = await me("/api/basket-copy", { basket: b2, usd: 20 });
  assert.match(ok.json.toast, /Copied \$20 across 2 tokens/);
  assert.match((await me("/api/basket-copy", { basket: b2, usd: 20 })).json.error, /already copy/);
  assert.ok(!(await me("/feed")).text.includes(`data-basket="${b2}"`));
  // The copy shows up in your active trades, and Chief's brief on the creator still reads from their fills.
  const act1 = (await me("/api/deck/active")).json.html as string;
  assert.match(act1, /ETH/);
  const bj = (await me("/api/deck/brief?h=decklead")).json;
  const brief = bj.html as string;
  assert.match(brief, /@decklead/);
  assert.match(brief, /\d+ fills? read/);
  assert.match(bj.stats, /max DD/); // their record goes in its own card under the brief
  assert.match((await me("/api/deck/brief?h=nobody-here")).json.html, /couldn't find/i);
  assert.equal((await me(`/api/deck/live?ids=${b2}`)).json[b2].copiers, "1 person"); // a count, not names
  assert.match((await lead("/api/basket-copy", { basket: b2, usd: 5 })).json.error, /your own basket/);

  // Ask-first copy requests jump to the front of the deck with their countdown.
  await publish("Deck Three");
  db.setFollow(meId, leadId, { mode: "ask", maxUsdPerTrade: 15 });
  const t3 = await place("buy $25 ETH with 5% stop and 10% take profit");
  deck = (await me("/feed")).text;
  const pend = db.pendingFor(meId).find((p) => p.trade_id === t3)!;
  const first = deck.indexOf('class="swcard');
  assert.ok(first > -1 && deck.indexOf(`data-pending="${pend.id}"`, first) < deck.indexOf('class="swcard', first + 1), "the request is the top card");
  assert.match(deck, /Copy request from a trader you copy/);
});

test("social feed: why each basket is here, and the For you / Following / Trending tabs", async () => {
  const star = client(), friend = client(), me = client();
  await star("/api/signup", { handle: "socstar", persona: "Sniper" });
  await friend("/api/signup", { handle: "socfriend", persona: "Sniper" });
  await me("/api/signup", { handle: "socme", persona: "Sniper" });
  const basket = Number((await star("/api/baskets", { name: "Social Basket", stopPct: 10, weights: basketWeights })).json.redirect.split("/").pop());
  const card = (html: string) => html.slice(html.indexOf(`data-basket="${basket}"`), html.indexOf("</article>", html.indexOf(`data-basket="${basket}"`)));

  // Nobody in your network trades them yet: a suggestion.
  assert.match(card((await me("/feed")).text), /Suggested for you/);

  // You follow @socfriend, who follows @socstar: LinkedIn-style "Followed by".
  await me("/api/watch", { leader: "socfriend" });
  await friend("/api/watch", { leader: "socstar" });
  assert.match(card((await me("/feed")).text), /Followed by @socfriend/);

  // Follow them yourself and the card says so. Follows still work from their profile.
  await me("/api/watch", { leader: "socstar" });
  assert.match(card((await me("/feed")).text), /You follow @socstar/);
  assert.ok((await me("/api/deck/cards")).json.html !== undefined);
});

test("leaderboard: in the nav next to Baskets, with search and new traders", async () => {
  const fresh = client();
  await fresh("/api/signup", { handle: "freshface", persona: "Sniper" });
  db.setMeta(db.userByHandle("freshface")!.id, { simBalance: 500 });
  const p = await fresh("/api/cat/ask", { text: "buy $20 ETH with 5% stop and 10% take profit" });
  await fresh("/api/cat/confirm", { id: p.json.proposalId });
  const viewer = client();
  await viewer("/api/signup", { handle: "explorer1", persona: "Sniper" });

  const board = (await viewer("/feed?tab=top")).text;
  assert.match(board, /aria-label="Leaderboard"/);
  assert.doesNotMatch(board, /aria-label="Baskets"/);
  assert.doesNotMatch(board, /aria-label="Signals"/);
  assert.equal((await fresh("/signals")).status, 404); // the Signals feature is gone; bots still trade through /cre/signal
  assert.match(board, /name="q"/);
  assert.match((await viewer("/feed?tab=top&board=New")).text, /@freshface/); // new traders show before they qualify for the ranked boards
  const found = (await viewer("/feed?tab=top&q=FRESH")).text;
  assert.match(found, /@freshface/);
  assert.match(found, /matching “fresh”/);
  assert.match((await viewer("/feed?tab=top&q=nobodyhere")).text, /Nobody called “nobodyhere” has traded yet/);
});

test("sessions: sign-out ends the session server-side, other devices can be signed out, agents can't manage access", async () => {
  const { createSession, sessionsOf } = await import("./auth.js");
  const laptop = client();
  await laptop("/api/signup", { handle: "sessionuser", persona: "Sniper" });
  const uid = db.userByHandle("sessionuser")!.id;
  // A second browser, signed in through its own session, and the cookie it holds.
  const phoneCookie = `tribe=${createSession(uid, "web")}`;
  const asPhone = (path: string) => fetch(base + path, { redirect: "manual", headers: { cookie: phoneCookie } });
  assert.equal((await asPhone("/api/v1/me")).status, 200);
  assert.equal(sessionsOf(uid, "web").length, 2);
  // From the laptop: sign out every other device. The phone's cookie stops working at once.
  assert.match((await laptop("/api/sessions/revoke-others", {})).json.toast, /Signed out 1 other device/);
  assert.equal((await asPhone("/api/v1/me")).status, 401);
  assert.equal((await laptop("/api/v1/me")).status, 200);
  // An agent token can read and trade, but not mint tokens, sign out devices or delete the account.
  const bearer = { "content-type": "application/json", authorization: `Bearer ${createSession(uid, "agent", { name: "Test agent" })}` };
  const asAgent = (path: string) => fetch(base + path, { method: "POST", headers: bearer, body: "{}" });
  for (const path of ["/api/agent-tokens", "/api/sessions/revoke-others", "/api/delete-account"]) {
    assert.match(((await (await asAgent(path)).json()) as { error: string }).error, /Agent tokens can't/, path);
  }
  // Settings shows the device and the agent; revoking the agent token signs the agent out.
  const agentId = sessionsOf(uid, "agent")[0].id;
  assert.match((await laptop("/settings")).text, /this device[\s\S]*Test agent/);
  await laptop("/api/agent-tokens/revoke", { id: agentId });
  assert.equal((await fetch(base + "/api/v1/me", { headers: bearer })).status, 401);
  // Signing out ends the laptop's session too: replaying its old cookie no longer works.
  const before = await laptop("/api/v1/me");
  assert.equal(before.status, 200);
  await laptop("/api/signout", {});
  assert.equal((await laptop("/api/v1/me")).status, 401);
});

test("a new agent token is shown once, then only its name is listed", async () => {
  const c = client();
  await c("/api/signup", { handle: "tokenuser", persona: "Sniper" });
  await c("/api/agent-tokens", { name: "Claude Desktop" });
  const first = (await c("/settings")).text;
  assert.match(first, /Copy your new token now/);
  assert.match(first, /s\.[0-9a-f]{36}\.[0-9a-f]{32}/);
  const again = (await c("/settings")).text;
  assert.doesNotMatch(again, /s\.[0-9a-f]{36}\.[0-9a-f]{32}/);
  assert.match(again, /Claude Desktop/);
});

test("sign-up: a wallet signs in through Privy, then picks a username; Tribe never gets a key", async () => {
  const { signupTicketCookie } = await import("./auth.js");
  const wallet = "0x8aAB6863d537e47D75f2fF7Ddbbb7C5b076c4Eb8" as const;
  // A browser with a real cookie jar (sign-up sets more than one cookie).
  const jar = new Map<string, string>();
  const call = async (path: string, body?: unknown) => {
    const r = await fetch(base + path, { method: body === undefined ? "GET" : "POST", redirect: "manual", headers: { "content-type": "application/json", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); const v = kv.slice(i + 1); if (v) jar.set(kv.slice(0, i), v); else jar.delete(kv.slice(0, i)); }
    return { status: r.status, json: (r.headers.get("content-type") ?? "").includes("json") ? await r.json() : undefined };
  };
  // /api/privy/session sets this after Privy verified the wallet's signature (a new wallet, so no account yet).
  const ticket = (t: { privy: string; wallet?: `0x${string}` }) => jar.set("tribe_signup", signupTicketCookie(t).split(";")[0].slice("tribe_signup=".length));

  delete process.env.ALLOW_PLAIN_SIGNUP;
  try {
    assert.equal((await fetch(base + "/onboarding", { redirect: "manual" })).headers.get("location"), "/signin");
    assert.match((await call("/api/signup", { handle: "nowallet" })).json.error, /Sign in with/);
    ticket({ privy: "did:privy:no-wallet" });
    assert.match((await call("/api/signup", { handle: "nowallet" })).json.error, /Connect your wallet first/);
    ticket({ privy: "did:privy:wallet-user", wallet });
    assert.match(await (await fetch(base + "/onboarding", { headers: { cookie: `tribe_signup=${jar.get("tribe_signup")}` } })).text(), /Wallet connected · <span[^>]*>0x8aAB…4Eb8/);
    assert.equal((await call("/api/v1/me")).status, 401, "no account or session until a username is picked");
    // First time: splash, then the intro, then the feed.
    const first = (await call("/api/signup", { handle: "walletuser", avatar: 2 })).json.redirect;
    assert.equal(first, "/splash?next=%2Ffeed");
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    assert.match(await (await fetch(base + first, { headers: { cookie } })).text(), /data-auto="\/intro\?next=%2Ffeed"/);
    assert.match(await (await fetch(base + "/intro?next=%2Ffeed", { headers: { cookie } })).text(), /id="start" href="\/feed">Get started/);
    // The same wallet can't start a second account.
    jar.clear();
    ticket({ privy: "did:privy:someone-else", wallet });
    assert.match((await call("/api/signup", { handle: "walletuser2" })).json.error, /already belongs to another account/);
  } finally {
    process.env.ALLOW_PLAIN_SIGNUP = "1";
  }
  const u = db.userByHandle("walletuser")!;
  assert.deepEqual([u.address, u.wallet_kind, u.pk, u.privy_user_id, u.persona], [wallet, "external", "", "did:privy:wallet-user", null]);
});

test("MetaMask followers are always asked: Tribe can't sign for them, so auto rules become requests", async () => {
  const { mirror } = await import("./copy.js");
  const { parseTrade } = await import("./parse.js");
  const { linkWallet } = await import("./wallet-api.js");
  const lead = 7001, fol = 7002;
  for (const id of [lead, fol]) { db.getUser(id); db.setMeta(id, { simBalance: 1000, perm: true }); }
  db.setFollow(fol, lead, { mode: "auto" });
  linkWallet(fol, "0x00000000000000000000000000000000000c0ffe");
  assert.equal(db.getFollowRules(fol, lead)!.mode, "ask", "linking switches existing follows to ask-first");
  db.setFollow(fol, lead, { mode: "auto" }); // even if a rule says auto again
  const r = await mirror(lead, parseTrade(["buy", "ETH", "20"]));
  assert.deepEqual([r.executed.length, r.pending.length], [0, 1]);
});

test("every trade has a public page: details, share, comments; old links forward to it", async () => {
  const c = client();
  await c("/api/signup", { handle: "tradepageuser", persona: "Sniper" });
  const lead = db.userByHandle("tradepageuser")!.id;
  const { mirror } = await import("./copy.js");
  const { parseTrade } = await import("./parse.js");
  const { tradeId } = await mirror(lead, parseTrade(["long", "ETH", "40", "2800", "2300"]));
  await c("/api/comment", { trade: tradeId, text: "Tight stop on this one" });
  // Signed out: the page opens for anyone, with the trade, its details, sharing and comments, and invites sign-in.
  const anon = await (await fetch(`${base}/t/${tradeId}`)).text();
  for (const s of ['aria-label="Trade details"', "2300", "2800", 'aria-label="Share this trade"', `/t/${tradeId}`, "x.com/intent/post", "t.me/share", "wa.me", "Tight stop on this one", "On Tribe you copy baskets", "Sign in to react and comment", 'property="og:image"']) {
    assert.ok(anon.includes(s), `signed-out page shows ${s}`);
  }
  // Signed in as someone else: the comment box and a way to their baskets, but no copying this one trade.
  const fan = client();
  await fan("/api/signup", { handle: "tradepagefan", persona: "Sniper" });
  const seen = (await fan(`/t/${tradeId}`)).text;
  assert.ok(!seen.includes("data-copyamt") && !seen.includes("/api/copy-trade"), "a single trade can't be copied");
  assert.ok(seen.includes(`href="/u/tradepageuser#baskets"`), "copying goes through their baskets");
  assert.ok(seen.includes('action="/api/comment"'));
  const { tradeCard: tc } = await import("./data.js");
  const { tradeCardHtml: cardHtml } = await import("./views/feed.js");
  assert.ok(cardHtml((await tc(tradeId))!, undefined).includes(`href="/u/tradepageuser#baskets"`), "elsewhere, a card links to their baskets");
  assert.ok(!seen.includes("Copy all of"), "no option to copy all of a trader's trades");
  assert.match(seen, /data-act="\/api\/watch" data-body='\{"leader":"tradepageuser"\}'>Follow</);
  await fan("/api/watch", { leader: "tradepageuser" });
  assert.match((await fan(`/t/${tradeId}`)).text, /data-body='\{"leader":"tradepageuser"\}'>[^<]*<svg[\s\S]*?<\/svg>Following</);
  assert.ok(!seen.includes(`data-href="/t/${tradeId}"`), "the card on its own page doesn't link to itself");
  // The feed card opens it, and the old links forward to it.
  const { tradeCard } = await import("./data.js");
  const { tradeCardHtml } = await import("./views/feed.js");
  assert.ok(tradeCardHtml((await tradeCard(tradeId))!, undefined).includes(`data-href="/t/${tradeId}"`), "a feed card opens the trade page");
  assert.equal((await fetch(`${base}/thread/${tradeId}`, { redirect: "manual" })).headers.get("location"), `/t/${tradeId}#comments`);
  assert.equal((await fetch(`${base}/s/${tradeId}`, { redirect: "manual" })).headers.get("location"), `/t/${tradeId}`);
  assert.equal((await fetch(`${base}/t/999999`)).status, 404);
});

test("Creator studio: trade ticket, bot trial, publish, copies and pay", async () => {
  const c = client(), f = client(), poor = client();
  await c("/api/signup", { handle: "botmaker", persona: "Sniper" });
  await f("/api/signup", { handle: "botfan", persona: "Hodler" });
  await poor("/api/signup", { handle: "nofunds", persona: "Hodler" });
  const maker = db.userByHandle("botmaker")!.id, fan = db.userByHandle("botfan")!.id;
  db.setMeta(maker, { simBalance: 1000 });
  db.setMeta(fan, { simBalance: 1000 });
  db.setMeta(db.userByHandle("nofunds")!.id, { simBalance: 50 });
  db.setFollow(fan, maker, { mode: "auto" });
  const copiesOf = (trade: number) => (db.db.prepare("SELECT COUNT(*) AS n FROM copies WHERE trade_id = ? AND follower = ? AND status IN ('executed','dry-run')").get(trade, fan) as { n: number }).n;

  // A trade by hand needs a stop, then lands on its own page and is copied.
  for (const p of ["/portfolio?tab=creating", "/trade/new", "/bots/new", "/creator/verify"]) assert.equal((await c(p)).status, 200, p);
  assert.equal((await c("/api/trade/new", { usd: 20, stop: 0 })).status, 400, "no trade without a stop");
  const t = await c("/api/trade/new", { usd: 20, stop: 5, tp: 10, note: "Range low held" });
  assert.match(t.json.redirect, /^\/t\/\d+$/);
  const manualId = Number(t.json.redirect.split("/").pop());
  assert.equal(db.tradeById(manualId)!.note, "Range low held");
  assert.equal(copiesOf(manualId), 1, "followers copy a manual trade");
  // Other order types from the ticket: a limit entry with a trailing stop, and a TWAP.
  const lim = await c("/api/trade/new", { usd: 10, stop: 4, type: "limit", price: 1900, stopType: "trailing-stop", activation: 2100 });
  assert.match(lim.json.redirect, /^\/t\/\d+$/);
  const limTrades = (db.db.prepare("SELECT json_extract(trade,'$.orderType') AS t FROM trades WHERE id >= ? ORDER BY id").all(Number(lim.json.redirect.split("/").pop())) as { t: string }[]).map((r) => r.t);
  assert.deepEqual(limTrades, ["limit", "trailing-stop"]);
  assert.match((await c("/api/trade/new", { usd: 10, stop: 4, type: "twap", minutes: 2 })).json.error, /TWAP runs 5 minutes/);

  // A bot needs a $100 stake and a stop.
  const spec = { name: "Steady test", template: "dca", usd: 10, perDay: 5, stopPct: 5, tpPct: 0, maxDdPct: 15, p_dca: 4 };
  assert.match((await poor("/api/bots", spec)).json.error, /at least \$100/);
  assert.match((await c("/api/bots", { ...spec, stopPct: 0 })).json.error, /stop/);
  const made = await c("/api/bots", spec);
  const botId = Number(made.json.redirect.split("/").pop());
  assert.equal((await c(`/bots/${botId}`)).status, 200);
  assert.equal((await f(`/bots/${botId}`)).status, 404, "a bot on trial is private");

  // Trial trades build its record but stay private and uncopied.
  for (let i = 0; i < 3; i++) assert.equal((await c(`/api/bots/${botId}/run`, {})).status, 200);
  const trial = db.db.prepare("SELECT id, private, source FROM trades WHERE bot_id = ? AND json_extract(trade,'$.side') = 'buy'").all(botId) as { id: number; private: number; source: string }[];
  assert.equal(trial.length, 3);
  assert.ok(trial.every((x) => x.private === 1 && x.source === "bot"));
  assert.equal(copiesOf(trial[0].id), 0, "nobody copies a trial trade");
  assert.equal((await f(`/t/${trial[0].id}`)).status, 404);
  assert.equal((await f("/api/copy-trade", { trade: trial[0].id, usd: 5 })).status, 404, "single trades can't be copied at all");
  assert.equal((await c(`/t/${trial[0].id}`)).status, 200, "the owner sees their trial trades");
  assert.ok(!(await f("/feed")).text.includes(`/t/${trial[0].id}"`), "trial trades stay out of the feed");

  // Publishing waits for the 14-day trial (demo mode can skip it), then its trades are copied.
  assert.match((await c(`/api/bots/${botId}/publish`, {})).json.error, /14 days/);
  process.env.DEMO = "true";
  try { await c(`/api/bots/${botId}/fastforward`, {}); } finally { delete process.env.DEMO; }
  assert.match((await c(`/api/bots/${botId}/publish`, {})).json.toast, /is live/);
  assert.equal((await f(`/bots/${botId}`)).status, 200, "a live bot has a public page");
  await c(`/api/bots/${botId}/run`, {});
  const live = db.db.prepare("SELECT id, private FROM trades WHERE bot_id = ? ORDER BY id DESC LIMIT 1").get(botId) as { id: number; private: number };
  assert.equal(live.private, 0);
  assert.equal(copiesOf(live.id), 1, "followers copy a published bot");
  assert.match((await c("/portfolio?tab=creating")).text, /Steady test/);
  assert.match((await c(`/api/bots/${botId}/pause`, {})).json.toast, /paused/);
  assert.match((await c(`/api/bots/${botId}/check`, {})).json.error, /Resume/);

  // Pay: a share of the fee, half held for the season; payouts only after verifying.
  const { earningsOf } = await import("./creator.js");
  process.env.FLASH_API_KEY = "tribe-own-key"; // creators earn from Tribe's own integrator fee
  const e = earningsOf(maker);
  assert.ok(e.accrued > 0 && Math.abs(e.held - e.accrued / 2) < 1e-9 && Math.abs(e.claimable - e.accrued / 2) < 1e-9);
  assert.equal((await c("/api/claim", {})).json.redirect, "/creator/verify");
  assert.match((await c("/api/creator/verify", { country: "US", adult: true, honest: true })).json.error, /aren't available/);
  assert.match((await c("/api/creator/verify", { country: "IN", adult: false, honest: true })).json.error, /Tick both/);
  assert.equal((await c("/api/creator/verify", { country: "IN", adult: true, honest: true })).json.redirect, "/portfolio?tab=creating");
  assert.match((await c("/api/claim", {})).json.toast, /added to your balance/);
  const after = earningsOf(maker);
  assert.ok(after.claimable < 1e-9 && after.held > 0, "claiming pays the released half; the held half waits for the season");
  delete process.env.FLASH_API_KEY;
});

test("Creator bots: the dip rule buys only after a real drop", async () => {
  const { evaluate, createBot } = await import("./creator.js");
  const owner = db.userByHandle("botmaker")!.id;
  const b = await createBot(owner, "Dip watcher", "dip", { usd: 10, perDay: 2, stopPct: 5, p: 3 });
  assert.match(evaluate(b, 2500).why, /Watching the price/);
  const now = Date.now();
  for (let i = 0; i < 12; i++) db.db.prepare("INSERT INTO price_ticks (token, price, at) VALUES (?, ?, ?)").run("0x4200000000000000000000000000000000000006", 2600, now - (i + 1) * 60e3);
  assert.equal(evaluate(b, 2590).buy, false, "a 0.4% dip isn't enough");
  assert.equal(evaluate(b, 2500).buy, true, "a 3.8% dip from the high triggers a buy");
});

test("Deleting an account frees its wallet and ends the wallet session", async () => {
  const c = client();
  await c("/api/signup", { handle: "leaving", persona: "Hodler" });
  const u = db.userByHandle("leaving")!;
  db.db.prepare("UPDATE users SET wallet_kind = 'external', privy_user_id = 'did:privy:leaving' WHERE id = ?").run(u.id);
  const { userByWallet } = await import("./wallet-api.js");
  assert.equal(userByWallet(u.address), u.id);
  const r = await c("/api/delete-account", {});
  assert.equal(r.json.redirect, "/signin?out=1", "the sign-in page also signs out of the wallet");
  assert.equal(userByWallet(u.address), undefined, "the wallet no longer leads into the deleted account");
  assert.equal(db.getUser(u.id).privy_user_id ?? null, null);
  assert.equal((await c("/feed")).status, 302, "signed out");
});

test("MetaMask bridge: an action's signature request reaches the open tab and the answer comes back", async () => {
  const c = client();
  await c("/api/signup", { handle: "mmuser", persona: "Hodler" });
  const u = db.userByHandle("mmuser")!;
  db.db.prepare("UPDATE users SET wallet_kind = 'external' WHERE id = ?").run(u.id);
  const { interactive, browserSigner } = await import("./browsersign.js");
  const { signerOf } = await import("./wallet.js");
  assert.throws(() => signerOf(u.id), /from the app/, "background work can't ask MetaMask");
  const s = interactive(u.id, () => signerOf(u.id)) as { remote?: boolean };
  assert.equal(s.remote, true, "inside an action, the user's browser signs");

  const signed = browserSigner(u.id, u.address as `0x${string}`).signMessage("Definitive Flash v1 — Cancel Order", "Cancel the order");
  const w = await c("/api/sign/wait?tab=t1");
  assert.equal(w.json.req.kind, "message");
  assert.equal(w.json.req.label, "Cancel the order");
  assert.equal((await c(`/api/sign/${w.json.req.id}`, { result: "0xabcdef" })).status, 200);
  assert.equal(await signed, "0xabcdef");

  const rejected = browserSigner(u.id, u.address as `0x${string}`).signTypedData("{}", "Sign the order");
  const check = assert.rejects(rejected, /Not signed: User rejected/);
  const w2 = await c("/api/sign/wait?tab=t1");
  await c(`/api/sign/${w2.json.req.id}`, { error: "User rejected the request." });
  await check;
  const other = client();
  await other("/api/signup", { handle: "notmm", persona: "Hodler" });
  assert.equal((await other(`/api/sign/${w2.json.req.id}`, { result: "0x01" })).status, 400, "nobody else can answer");
});

test("Token prices are written as plain decimals Flash accepts, even for tiny prices", async () => {
  const { priceStr, qtyStr } = await import("./tokens.js");
  assert.equal(priceStr(2263.5), "2263.50");
  assert.equal(priceStr(0.0008691), "0.00086910");
  assert.ok(!/e/i.test(priceStr(5.179e-8)) && Number(priceStr(5.179e-8)) > 0);
  assert.ok(!/e/i.test(qtyStr(1e-7)) && Number(qtyStr(1e-7)) > 0);
  assert.equal(qtyStr(3450.123456), "3450.1235");
});

test("Closing a position asks everyone holding a copy to sell theirs, and their copy's stop is cancelled first", async () => {
  const lead = client(), fan = client();
  await lead("/api/signup", { handle: "closer", persona: "Sniper" });
  await fan("/api/signup", { handle: "onecopy", persona: "Hodler" });
  const L = db.userByHandle("closer")!.id, F = db.userByHandle("onecopy")!.id;
  // Copied while following, then unfollowed: they still hold it.
  db.setFollow(F, L, { mode: "auto" });
  await lead("/api/trade/new", { usd: 20, stop: 5, tp: 10 });
  db.unfollow(F, L);
  assert.ok(!db.db.prepare("SELECT 1 FROM follows WHERE follower = ? AND leader = ?").get(F, L));
  const { copiedTokens } = await import("./copy.js");
  const weth = "0x4200000000000000000000000000000000000006";
  assert.ok(copiedTokens(F, L, weth) > 0);
  // The leader closes: their position is sold and the copier is asked to sell theirs.
  const close = await lead("/api/position-close", { token: weth });
  assert.match(close.json.toast, /1 copier selling too/);
  const req = db.db.prepare("SELECT id, trade FROM pending_copies WHERE follower = ? AND status = 'open'").get(F) as { id: number; trade: string };
  assert.equal(JSON.parse(req.trade).side, "sell");
  assert.match((await fan(`/requests?id=${req.id}`)).text, /closed their ETH position: sell your copy too\?/);
  assert.equal((await fan("/api/pending", { id: req.id, action: "approve" })).status, 200);
  assert.ok(copiedTokens(F, L, weth) < 1e-9, "the copier's copy is sold");
  const open = db.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE trader = ? AND role = 'copy' AND status IN ('open','waiting') AND json_extract(trade,'$.side') = 'sell' AND json_extract(trade,'$.orderType') != 'market'").get(F) as { n: number };
  assert.equal(open.n, 0, "the copy's stop / target were cancelled");
});

test("Every inline script on the main pages parses (a stray quote breaks a whole page)", async () => {
  const c = client();
  await c("/api/signup", { handle: "scriptcheck", persona: "Hodler" });
  for (const path of ["/feed", "/baskets/new", "/trade/new", "/bots/new", "/portfolio?tab=creating", "/portfolio", "/settings", "/feed?tab=top"]) {
    const html = (await c(path)).text;
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const code of scripts) assert.doesNotThrow(() => new Function(code), `${path}: inline script has a syntax error`);
  }
});
