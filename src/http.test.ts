process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";
process.env.SESSION_SECRET = "test";

import test, { after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

const prices = await import("./prices.js");
const { appRouter } = await import("./app.js");
const db = await import("./db.js");
const { riskScore } = await import("./risk.js");

prices.setPriceProvider(async () => 2500);
process.env.CRE_SHARED_SECRET = "cre-test";
const { creRouter } = await import("./cre-api.js");
const halts: [number, boolean][] = [];
const app = express();
app.use(creRouter({ halt: (leader, halted) => void halts.push([leader, halted]) }));
app.use(appRouter());
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

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
  assert.equal((await c("/feed")).loc, "/splash");
  assert.equal((await c("/intro")).status, 200);
  assert.equal((await c("/api/pause-all", {})).status, 401);
});

test("signup, trade through Ask Cat, follow, approve", async () => {
  const lead = client();
  const fol = client();
  assert.ok((await lead("/api/signup", { handle: "leader1", avatar: 1, persona: "Sniper" })).json.redirect);
  assert.ok((await fol("/api/signup", { handle: "follower1", avatar: 2, persona: "Hodler" })).json.redirect);
  assert.equal((await fol("/api/signup", { handle: "leader1", persona: "Sniper" })).json.error?.includes("taken"), true);

  // Follower copies the leader, ask-first.
  const f = await fol("/api/follow", { leader: "leader1", mode: "ask", budget: 100, ratio: 1, max: 20, cap: 80, stop: "0" });
  assert.equal(f.json.redirect, "/copy/leader1?done=1");

  // Leader asks Cat to trade, then confirms.
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
  for (const p of ["/feed", "/ranks", "/guard", "/me", "/traders", "/u/leader1", "/creator", "/activity", "/settings", "/share/me"]) {
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
  const tab = await a("/ranks?tab=Squads");
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
  assert.match((await watcher("/feed")).text, /class="srctag bot"/); // others see it in their deck, tagged Bot
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
  const { makeSession } = await import("./auth.js");
  const token = makeSession(db.userByHandle("agentuser")!.id);
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
  for (const path of ["/activity", "/alerts", "/funds", "/season", "/requests", "/cat/memory", "/cat/voice", "/strategy/new", "/progress", "/squads"]) {
    const r = await c(path);
    assert.equal(r.status, 200, path);
    assert.match(r.text, /class="paside"/, path);
    assert.doesNotMatch(r.text, /class="rail"/, path);
  }
  assert.equal((await c("/activity.csv")).status, 200);
  assert.equal((await client()("/activity.csv")).loc, "/splash");
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
  assert.match(out[0], /1 copy request/);
  assert.match(out[2], /1 copy skipped by Guard/);
  assert.equal(db.haltOf(db.userByHandle("traderx")!.id), undefined); // cleared by beat 4
  assert.equal(db.guardEvents(db.userByHandle("traderx")!.id).map((e) => e.kind).join(","), "resume,halt");
});

test("Cat: persona tone, follow-ups, rules, memory and history", async () => {
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
  for (const p of ["/cat", `/cat/chat?id=${big.json.chatId}`, "/cat/chat?new=1&q=hello", "/cat/voice", "/cat/memory"]) assert.equal((await c(p)).status, 200, p);
  assert.match((await c("/cat")).text, /Chats/);
  assert.equal((await c("/cat/chat?id=999999")).status, 200); // not found page, not a crash

  // Forget one learned memory, then everything.
  assert.match((await c("/cat/memory")).text, /Prefers/);
  await c("/api/cat/memory", { op: "forget", key: "kind" });
  assert.doesNotMatch((await c("/cat/memory")).text, /Prefers/);
  await c("/api/cat/memory", { op: "wipe" });
  assert.equal(db.rulesOf(uid).length, 0);
  assert.equal(db.chatsOf(uid).length, 0);
});

test("Ask Cat about a feed post: verdict, history, worst case, and the way back", async () => {
  const lead = client();
  const me = client();
  await lead("/api/signup", { handle: "postlead", persona: "Sniper" });
  await me("/api/signup", { handle: "researcher", persona: "Sniper" });
  db.setMeta(db.userByHandle("postlead")!.id, { simBalance: 1000 });
  const a = await lead("/api/cat/ask", { text: "buy $40 ETH with 4% stop and 10% take profit" });
  await lead("/api/cat/confirm", { id: a.json.proposalId });
  const trade = (db.db.prepare("SELECT MAX(id) AS id FROM trades WHERE leader = ?").get(db.userByHandle("postlead")!.id) as { id: number }).id;

  // Every feed card links to a research chat about itself.
  assert.match((await me("/feed")).text, new RegExp(`/cat/chat\\?new=1&amp;trade=${trade}|/cat/chat\\?new=1&trade=${trade}`));
  const v = await me("/api/cat/ask", { text: "Is this a good trade?", trade });
  assert.ok(v.json.verdict && ["Looks solid", "Mixed", "Risky"].includes(v.json.verdict.label));
  assert.ok(v.json.verdict.checks.some((x: { t: string }) => /Has a stop/.test(x.t)));
  assert.equal(v.json.ctx.handle, "postlead");
  assert.ok(v.json.follow.some((f: { href?: string }) => f.href === `/thread/${trade}`));

  // Follow-ups in the same chat stay about the post without resending it.
  const h = await me("/api/cat/ask", { text: "Show their track record", chat: v.json.chatId });
  assert.match(h.json.reply, /@postlead has traded/);
  const w = await me("/api/cat/ask", { text: "What's the worst case if I copy?", chat: v.json.chatId });
  assert.match(w.json.reply, /If the stop hits \(−4\.0%\), you lose about \$1\.00/); // $25 default max × 4%
  // A concrete order still becomes an order.
  assert.ok((await me("/api/cat/ask", { text: "buy $20 ETH with 5% stop", chat: v.json.chatId })).json.proposalId);

  // The chat page pins the post with a way back and a Copy with Flash button.
  const page = await me(`/cat/chat?id=${v.json.chatId}`);
  assert.ok(page.text.includes(`href="/thread/${trade}"`), "the pinned post links back to it");
  assert.match(page.text, /href="\/copy\/postlead"/);
  assert.match(await (await fetch(`${base}/cat/ctxbar/${trade}`)).text(), /^$|splash/); // needs a session

  // Asked by name from anywhere (Cat home, Telegram, MCP): research their latest entry.
  const named = await me("/api/cat/ask", { text: "Is @postlead worth copying?" });
  assert.equal(named.json.ctx?.id, trade);
  assert.ok(named.json.verdict);
  assert.equal((await me("/api/cat/ask", { text: "Why was @postlead paused?" })).json.ctx, undefined); // Guard questions keep their answer
  assert.equal((await me("/api/cat/ask", { text: "What's the worst case if I copy?", handle: "@postlead" })).json.ctx?.id, trade); // the MCP tool's path

  // CRE CopyGuard verdicts show up in Cat's read once the workflow reports.
  await fetch(`${base}/cre/guard`, { method: "POST", headers: { "content-type": "application/json", "x-cre-secret": "cre-test" }, body: JSON.stringify({ oracle: 2500, dex: 2502, deviationPct: 0.08, verdicts: [{ leader: db.userByHandle("postlead")!.id, severity: "ok", risk: 20, reason: "checks passed" }] }) });
  const cre = await me("/api/cat/ask", { text: "Is this a good trade?", trade });
  assert.ok(cre.json.verdict.checks.some((x: { t: string; ok: boolean }) => /CRE CopyGuard .* clear/.test(x.t) && x.ok));
  assert.ok(cre.json.verdict.checks.some((x: { t: string }) => /Chainlink ETH\/USD \$2500 vs DEX \$2502/.test(x.t)));

  // Research is part of the game: a daily quest, and Cat's read before you copy.
  const uid = db.userByHandle("researcher")!.id;
  const { questsOf } = await import("./stats.js");
  assert.equal(questsOf(uid).find((q) => q.id === "d-research")!.done, 1);
  assert.match((await me("/copy/postlead")).text, /Cat’s read on their latest trade/);
  assert.match((await me("/u/postlead")).text, /Cat’s read on their latest trade/);

  // Cat's calls are scored by what the trader did next: the call above, then a green exit.
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
  assert.match((await me("/cat")).text, /Cat’s calls/);

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
  assert.equal((await anon("/portfolio")).loc, "/splash");

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
  assert.match((await c("/ranks")).text, /<table class="tbl">/);
  assert.match((await c("/guard")).text, /Guard/);
  const pf = await c("/portfolio");
  assert.equal(pf.status, 200);
  assert.match(pf.text, /Copy requests/);
  assert.equal((await c("/")).loc, "/feed");
  // voice mode sits in the shell on desktop, with its own transcript aside instead of the rail
  const voice = (await c("/cat/voice")).text;
  assert.match(voice, /class="side"/);
  assert.doesNotMatch(voice, /class="rail"/);
  // focus pages stay chrome-free
  assert.doesNotMatch((await anon("/onboarding")).text, /class="rail"/);
  // active sidebar item follows the path
  assert.match((await c("/cat/chat")).text, /class="side-item on" href="\/cat"/);
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
  const { makeSession } = await import("./auth.js");
  const auth = { "content-type": "application/json", authorization: `Bearer ${makeSession(uid)}` };
  const p = await (await fetch(`${base}/api/cat/ask`, { method: "POST", headers: auth, body: JSON.stringify({ text: "buy $15 ETH with 4% stop" }) })).json();
  await fetch(`${base}/api/cat/confirm`, { method: "POST", headers: auth, body: JSON.stringify({ id: p.proposalId }) });
  const sources = (db.db.prepare("SELECT source FROM trades WHERE leader = ? ORDER BY id").all(uid) as { source: string }[]).map((r) => r.source);
  // The manual bracket is one trade; the agent's buy-with-stop is an entry plus its stop-loss, both the agent's.
  assert.equal(sources[0], "user");
  assert.ok(sources.length >= 2 && sources.slice(1).every((x) => x === "agent"), sources.join());

  // Free follow: no copying, but their trades show in Following and the count goes up.
  assert.equal((await b("/api/watch", { leader: "photo_gal" })).json.toast, "Following @photo_gal");
  assert.equal(db.isFollowing(db.userByHandle("watcher1")!.id, uid), false, "following is not copying");
  assert.match((await b("/feed?tab=Following")).text, /@photo_gal/);
  const prof = (await b("/u/photo_gal")).text;
  assert.match(prof, /<b>1<\/b><span>follower<\/span>/);
  assert.match(prof, /aria-pressed="true"/);

  // Profile tabs: Manual vs Bot record, portfolio (no dollar amounts for visitors), trades filtered by who placed them.
  assert.match((await b("/u/photo_gal?tab=Overview")).text, /Manual vs Bot/);
  const port = (await b("/u/photo_gal?tab=Portfolio")).text;
  assert.match(port, /Live now/);
  assert.ok(port.includes('data-act="/api/copy-trade"'), "every live position can be copied with Flash");
  assert.match(port, /What they've made/); // past trades: month by month, on the profile portfolio
  assert.match(port, /% of portfolio</);
  assert.match((await a("/u/photo_gal?tab=Portfolio")).text, /% of portfolio · \$/); // the owner sees amounts
  assert.ok(!(await a("/u/photo_gal?tab=Portfolio")).text.includes('data-act="/api/copy-trade"'), "no copy button on your own portfolio");
  // Copy a live position straight from the portfolio.
  db.setMeta(db.userByHandle("watcher1")!.id, { simBalance: 500 });
  const held = await import("./data.js").then((d) => d.liveBook(uid));
  const copied = await b("/api/copy-trade", { trade: held.held[0].tradeId, usd: 10 });
  assert.ok(String(copied.json.toast).startsWith("Copied $10 of @photo_gal"), JSON.stringify(copied.json));
  for (const path of ["/profile/edit", "/bot"]) assert.equal((await a(path)).status, 200, path);
  assert.equal((await b("/api/watch", { leader: "photo_gal" })).json.toast, "Unfollowed @photo_gal");
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
  const feedHtml = (await fan(`/thread/${trade}`)).text; // reactions live on the trade's page
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
  // The thread page shows the bar and the breakdown; the script that drives the picker ships in /app.js.
  assert.match((await fan(`/thread/${trade}`)).text, /Fire<\/span><b>1<\/b>/);
  assert.match(await (await fetch(`${base}/app.js`)).text(), /data-rx/);
});

test("discover deck: one trade at a time, requests first, swipe to skip or copy within your limits", async () => {
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
  const t1 = await place("buy $20 ETH with 5% stop and 10% take profit");
  const t2 = await place("buy $30 ETH with 4% stop and 9% take profit");

  // The deck shows each fresh entry as a card with Cat's read and a count of copiers (never who).
  let deck = (await me("/feed")).text;
  assert.ok(deck.includes(`data-trade="${t1}"`) && deck.includes(`data-trade="${t2}"`));
  assert.match(deck, /Cat’s read/);
  assert.match(deck, /Copied by<\/div><div class="v" data-live="copiers">0 people/);
  assert.match(deck, /id="swfollow"/); // follow the trader on the top card
  assert.match(deck, /data-open="mytribe"/); // portfolio, quests and the tribe sit behind one button on phones
  // The page keeps itself current: fresh numbers for the cards on screen, and new cards as trades are placed.
  const live = (await me(`/api/deck/live?ids=${t1},${t2}`)).json;
  assert.ok(live[t1] && /people/.test(live[t1].copiers) && "since" in live[t1]);
  const more = (await me(`/api/deck/cards?have=${t1},${t2}`)).json.html as string;
  assert.ok(!more.includes(`data-trade="${t1}"`) && !more.includes(`data-trade="${t2}"`), "cards already on screen aren't sent again");
  assert.ok((await me(`/api/deck/cards?have=${t1}`)).json.html.includes(`data-trade="${t2}"`));
  assert.ok(deck.includes(`/cat/chat?new=1&trade=${t1}`), "swipe up asks Cat about this trade");
  assert.doesNotMatch(deck, /data-react=/); // no comments or reactions in the deck

  // Swipe left: gone for good.
  await me("/api/swipe", { trade: t1, dir: "left" });
  assert.ok(!(await me("/feed")).text.includes(`data-trade="${t1}"`));

  // Swipe right: one copy, sized by you, inside your limits.
  assert.match((await me("/api/copy-trade", { trade: t2, usd: 9999 })).json.error, /your max per trade/);
  const ok = await me("/api/copy-trade", { trade: t2, usd: 20 });
  assert.match(ok.json.toast, /Copied \$20 of @decklead/);
  assert.match((await me("/api/copy-trade", { trade: t2, usd: 20 })).json.error, /already copied/);
  assert.ok(!(await me("/feed")).text.includes(`data-trade="${t2}"`));
  // The copy shows up in your active trades, and Cat's brief on the trader reads from their fills.
  const act1 = (await me("/api/deck/active")).json.html as string;
  assert.match(act1, /from @decklead/);
  assert.ok(act1.includes(`class="aslide on" href="/thread/${t2}"`), "one live entry per slide, linking to the trade");
  const bj = (await me("/api/deck/brief?h=decklead")).json;
  const brief = bj.html as string;
  assert.match(brief, /@decklead/);
  assert.match(brief, /\d+ fills? read/);
  assert.match(bj.stats, /max DD/); // their record goes in its own card under the brief
  assert.match((await me("/api/deck/brief?h=nobody-here")).json.html, /couldn't find/);
  assert.equal((await me(`/api/deck/live?ids=${t2}`)).json[t2].copiers, "1 person"); // a count, not names
  assert.match((await lead("/api/copy-trade", { trade: t2, usd: 5 })).json.error, /your own trade/);

  // Ask-first copy requests jump to the front of the deck with their countdown.
  db.setFollow(meId, leadId, { mode: "ask", maxUsdPerTrade: 15 });
  const t3 = await place("buy $25 ETH with 5% stop and 10% take profit");
  deck = (await me("/feed")).text;
  const pend = db.pendingFor(meId).find((p) => p.trade_id === t3)!;
  const first = deck.indexOf('class="swcard');
  assert.ok(first > -1 && deck.indexOf(`data-pending="${pend.id}"`, first) < deck.indexOf('class="swcard', first + 1), "the request is the top card");
  assert.match(deck, /Copy request from a trader you copy/);
});

test("social feed: why each trade is here, and the For you / Following / Trending tabs", async () => {
  const star = client(), friend = client(), me = client();
  await star("/api/signup", { handle: "socstar", persona: "Sniper" });
  await friend("/api/signup", { handle: "socfriend", persona: "Sniper" });
  await me("/api/signup", { handle: "socme", persona: "Sniper" });
  db.setMeta(db.userByHandle("socstar")!.id, { simBalance: 500 });
  const p = await star("/api/cat/ask", { text: "buy $20 ETH with 5% stop and 10% take profit" });
  await star("/api/cat/confirm", { id: p.json.proposalId });
  const trade = (db.db.prepare("SELECT MAX(id) AS id FROM trades WHERE leader = ?").get(db.userByHandle("socstar")!.id) as { id: number }).id;
  const card = (html: string) => html.slice(html.indexOf(`data-trade="${trade}"`), html.indexOf("</article>", html.indexOf(`data-trade="${trade}"`)));

  // Nobody in your network trades them yet: a suggestion, and not on Following.
  assert.match(card((await me("/feed")).text), /Suggested for you/);
  assert.ok(!(await me("/feed?tab=following")).text.includes(`data-trade="${trade}"`));

  // You follow @socfriend, who follows @socstar: LinkedIn-style "Followed by".
  await me("/api/watch", { leader: "socfriend" });
  await friend("/api/watch", { leader: "socstar" });
  assert.match(card((await me("/feed")).text), /Followed by @socfriend/);

  // Follow them yourself and they're on Following too, with the reason.
  await me("/api/watch", { leader: "socstar" });
  const following = (await me("/feed?tab=following")).text;
  assert.match(card(following), /You follow @socstar/);
  assert.match(following, /class="on" aria-current="page">Following</);
  assert.ok((await me("/api/deck/cards?tab=following")).json.html !== undefined);
});

test("signals: post a call, scored by price, and the caller's showcase", async () => {
  const caller = client(), fan = client();
  await caller("/api/signup", { handle: "sigcaller", persona: "Sniper" });
  await fan("/api/signup", { handle: "sigfan", persona: "Sniper" });
  prices.setPriceProvider(async () => 2000);

  // Bad calls are refused with a reason.
  assert.match((await caller("/api/signal", { entry: 2000, target: 1900, stop: 1950, note: "nope" })).json.error, /target above the entry/);
  assert.match((await caller("/api/signal", { entry: 3000, target: 3200, stop: 2900, note: "far away" })).json.error, /within 10%/);
  assert.match((await caller("/api/signal", { entry: 2000, target: 2100, stop: 1950, note: "" })).json.error, /Say why/);

  const ok = await caller("/api/signal", { entry: 2000, target: 2100, stop: 1950, horizon: "days", note: "Range low held." });
  assert.ok(ok.json.id && ok.json.redirect === "/signals?tab=mine");
  let page = (await fan("/signals")).text;
  assert.match(page, /@sigcaller/);
  assert.match(page, /Range low held/);
  assert.ok(!page.includes("Copy with Flash"), "signals are for following and talking, not copying");
  assert.match(page, /\+ Follow @sigcaller/);
  assert.match(page, /Risks 1 to make 2\.0/);
  assert.ok(!page.includes("Results"), "Live calls and Mine only");

  // Custom reactions (one per person, swapped or removed) and a comment thread on each call.
  assert.ok(page.includes(`data-react="${ok.json.id}" data-kind="signal"`));
  let rx = await fan("/api/react", { signal: ok.json.id, emoji: "rocket" });
  assert.match(rx.json.html, /rx-rocket/);
  assert.match(rx.json.html, /<span>1<\/span>/);
  rx = await fan("/api/react", { signal: ok.json.id, emoji: "bull" });
  assert.match(rx.json.html, /rx-bull/);
  assert.ok(!rx.json.html.includes('rxstack"><span class="rx rx-rocket'), "a new reaction replaces the old one");
  assert.match((await fan("/api/react", { signal: 999999, emoji: "fire" })).json.error, /Signal not found/);
  assert.match((await fan("/api/signal-comment", { signal: ok.json.id, text: "  " })).json.error, /Write something/);
  const cm = await fan("/api/signal-comment", { signal: ok.json.id, text: "Clean level, watching the retest <b>" });
  assert.equal(cm.json.count, 1);
  assert.match(cm.json.html, /@sigfan/);
  assert.match(cm.json.html, /watching the retest &lt;b&gt;/); // escaped
  page = (await fan("/signals")).text;
  assert.match(page, /Clean level, watching the retest/);
  assert.match(page, /data-cmcount>1<\/span><span class="cml">comment</);
  // Each call can go out to other platforms, linking to its public page.
  assert.ok(page.includes(`data-share-id="${ok.json.id}"`));
  for (const host of ["x.com/intent/post", "t.me/share", "wa.me", "linkedin.com/sharing", "warpcast.com", "reddit.com/submit"]) assert.ok(page.includes(host), host);
  assert.ok(page.includes(`/signal/${ok.json.id}`));

  // The shared link works for anyone, with a link preview.
  const pub = await client()(`/signal/${ok.json.id}`);
  assert.equal(pub.status, 200);
  assert.match(pub.text, /property="og:title" content="@sigcaller: ETH long \$2,000 → \$2,100"/);
  assert.match(pub.text, /Join and follow @sigcaller/);
  assert.equal((await client()("/signal/999999")).status, 404);

  // The price runs to the target: the call is scored a hit and counts on the caller's record.
  prices.setPriceProvider(async () => 2110);
  page = (await caller("/signals?tab=mine")).text;
  assert.match(page, /Target hit/);
  assert.match(page, /1\/1 calls hit/);
  assert.match(page, /Your call/);
  assert.match((await client()(`/signal/${ok.json.id}`)).text, /@sigcaller called it/); // the shared text says how it went
  assert.match(page, /aria-label="Signals"/); // in the nav where Leaderboard was
});

test("leaderboard: back in the nav next to Signals, with search and new traders", async () => {
  const fresh = client();
  await fresh("/api/signup", { handle: "freshface", persona: "Sniper" });
  db.setMeta(db.userByHandle("freshface")!.id, { simBalance: 500 });
  const p = await fresh("/api/cat/ask", { text: "buy $20 ETH with 5% stop and 10% take profit" });
  await fresh("/api/cat/confirm", { id: p.json.proposalId });
  const viewer = client();
  await viewer("/api/signup", { handle: "explorer1", persona: "Sniper" });

  const board = (await viewer("/ranks")).text;
  assert.match(board, /aria-label="Leaderboard"/);
  assert.match(board, /aria-label="Signals"/);
  assert.match(board, /name="q"/);
  assert.match((await viewer("/ranks?tab=New")).text, /@freshface/); // new traders show before they qualify for the ranked boards
  const found = (await viewer("/ranks?q=FRESH")).text;
  assert.match(found, /@freshface/);
  assert.match(found, /matching “fresh”/);
  assert.match((await viewer("/ranks?q=nobodyhere")).text, /Nobody called “nobodyhere” has traded yet/);
});
