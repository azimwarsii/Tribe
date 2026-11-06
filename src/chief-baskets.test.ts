process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";
delete process.env.OPENAI_COMPAT_API_KEY;

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const prices = await import("./prices.js");
prices.enableDemoPrices();
const { db, createWebUser, getMeta, haltLeader, resumeLeader, setMeta } = await import("./db.js");
const b = await import("./baskets.js");
const { DEMO_TOKENS } = await import("./demo-tokens.js");
const a = await import("./assets.js");
const { catAsk, catConfirm } = await import("./cat.js");
const { deckCards, deckPage } = await import("./views/deck.js");
const { basketRow } = await import("./views/baskets.js");

const addr = (s: string) => DEMO_TOKENS.find((t) => t.symbol === s)!.address;
const [ETH, BTC, AERO, BRETT, DEGEN, SPX] = ["ETH", "cbBTC", "AERO", "BRETT", "DEGEN", "deSPXA"].map(addr);
const FAKE = "0x000000000000000000000000000000000000beef";

let n = 0;
const user = (over: Partial<ReturnType<typeof getMeta>["defaults"]> = {}) => {
  const u = createWebUser(`chief${++n}`)!;
  setMeta(u.id, { simBalance: 1000, defaults: { ...getMeta(u.id).defaults, max: 500, cap: 5000, ...over } });
  return u.id;
};
const make = (owner: number, name: string, weights: [string, number][], stopPct = 10) => b.createBasket(owner, { name, stopPct, tpPct: 30, weights: weights.map(([token, weight]) => ({ token, weight })) });
const creator = user();
const core = await make(creator, "Core Test", [[SPX, 80], [ETH, 20]], 8);
const blue = await make(creator, "Blue Test", [[ETH, 60], [BTC, 40]]);
const memes = await make(creator, "Meme Test", [[BRETT, 60], [DEGEN, 40]], 20);
const nostop = await make(creator, "Naked Test", [[AERO, 100]], 0);

// ---------- Classes ----------

test("a token's class comes from its address, so a fake with a major's name is Unclassified", () => {
  assert.equal(a.assetClassOf(ETH), "major");
  assert.equal(a.assetClassOf(ETH.toUpperCase().replace("0X", "0x")), "major");
  assert.equal(a.assetClassOf(SPX), "stock");
  assert.equal(a.assetClassOf(BRETT), "meme");
  assert.equal(a.assetClassOf(FAKE), "other");
});

test("Coinbase stocks are US stocks at their exact addresses; lookalikes aren't, even with the same start", () => {
  for (const s of ["NVDAc", "AAPLc", "MSFTc", "GOOGLc", "AMZNc", "METAc", "MSTRc", "SPCXc", "SNDKc"]) assert.equal(a.assetClassOf(addr(s)), "stock", s);
  assert.equal(a.assetClassOf("0xb2000000000000000000001e800a7f5189430cd0"), "stock", "TSLAc");
  // Real lookalikes seen on Flash: a fake GOOGLc, a fake SPCXc, and two that copy the 0xb200 start.
  for (const fake of ["0xcfc39f1e697f04ee74254d59aced4af05d9c4b3b", "0x636bd5a07e09510b3d4c15a1b68998258ed3708d", "0xb200000000000000000000cf40161791de536101", "0xb200000000000000000000d3cb8dde527eddbb01"]) assert.equal(a.assetClassOf(fake), "other", fake);
});

test("risk is per token: a fund, single stocks and Strategy aren't the same bet", () => {
  const risk = (w: [string, number][]) => a.basketRisk(w.map(([s, weight]) => ({ token: addr(s), weight })), 10);
  assert.equal(risk([["deSPXA", 100]]), "steady");
  assert.equal(risk([["AAPLc", 50], ["MSFTc", 50]]), "balanced");
  assert.equal(risk([["MSTRc", 100]]), "aggressive", "trades like leveraged Bitcoin");
});

test("one stock at a high weight is concentration, unlike a broad fund", async () => {
  const id = await make(creator, "Nvidia Heavy Test", [[addr("NVDAc"), 80], [ETH, 20]]);
  assert.ok((await b.basketRead((await b.basketView(id))!)).checks.some((c) => !c.ok && /NVDAc is 80%.*moves like one token/.test(c.t)));
  await b.retireBasket(creator, id);
});

test("Chief hears the caveats on stock tokens, and a company name finds stock baskets", async () => {
  const { basketRules, askedFor } = await import("./catbaskets.js");
  const rules = basketRules().join(" ");
  assert.match(rules, /feeds freeze on nights, weekends and holidays/);
  assert.match(rules, /only in eligible places outside the US/);
  assert.equal(askedFor("any baskets with nvidia?").assetClass, "stock");
});

test("the mix always adds up to 100, and adds a class's tokens together", () => {
  const mix = a.basketMix([{ token: ETH, weight: 33.33 }, { token: AERO, weight: 33.33 }, { token: BRETT, weight: 33.34 }]);
  assert.equal(mix.reduce((s, m) => s + m.pct, 0), 100);
  assert.deepEqual(a.basketMix([{ token: ETH, weight: 50 }, { token: BTC, weight: 30 }, { token: BRETT, weight: 20 }]).map((m) => [m.label, m.pct]), [["Major coins", 80], ["Meme coins", 20]]);
  assert.deepEqual(a.basketMix([{ token: FAKE, weight: 100 }]).map((m) => [m.label, m.pct]), [["Unclassified", 100]]);
});

test("risk bands: what's in it sets the band, and no stop-loss moves it up", () => {
  const risk = (w: [string, number][], stop = 10) => a.basketRisk(w.map(([token, weight]) => ({ token, weight })), stop);
  assert.equal(risk([[ETH, 60], [BTC, 40]]), "steady");
  assert.equal(risk([[SPX, 80], [ETH, 20]]), "steady");
  assert.equal(risk([[ETH, 50], [BTC, 30], [AERO, 20]]), "balanced");
  assert.equal(risk([[BRETT, 100]]), "aggressive");
  assert.equal(risk([[FAKE, 100]]), "aggressive", "unreviewed counts as the riskiest kind");
  assert.equal(risk([[ETH, 60], [BTC, 40]], 0), "balanced");
  assert.equal(risk([[AERO, 100]], 0), "aggressive");
});

test("a basket's tags follow a new version of its weights", async () => {
  const id = await make(creator, "Shifting Test", [[ETH, 100]]);
  assert.equal((await b.basketView(id))!.mix[0].label, "Major coins");
  await b.updateWeights(creator, id, [{ token: BRETT, weight: 70 }, { token: ETH, weight: 30 }]);
  const v = (await b.basketView(id))!;
  assert.deepEqual(v.mix.map((m) => [m.label, m.pct]), [["Meme coins", 70], ["Major coins", 30]]);
  assert.match(basketRow(v), /Meme coins <b>70%<\/b>/);
  await b.retireBasket(creator, id);
});

// ---------- The feed ----------

const shown = (html: string) => [...html.matchAll(/data-symbol="([^"]+)"/g)].map((m) => m[1]);

test("a basket only counts for a class from 25% up, so a small sleeve doesn't get it listed", () => {
  const m = (w: [string, number][]) => { const weights = w.map(([token, weight]) => ({ token, weight })); return { mix: a.basketMix(weights), risk: a.basketRisk(weights, 10) }; };
  assert.ok(a.matchesFilter(m([[SPX, 80], [ETH, 20]]), "stock"));
  assert.ok(!a.matchesFilter(m([[SPX, 80], [ETH, 20]]), "major"));
  assert.ok(!a.matchesFilter(m([[BRETT, 90], [SPX, 10]]), "stock"));
  assert.ok(a.matchesFilter(m([[ETH, 60], [BTC, 40]]), "steady"));
});

test("the feed has no filter row and no Basket labels, and an old saved filter has no effect", async () => {
  const me = user();
  setMeta(me, { feedAsset: "stock" } as never);
  const page = await deckPage(me);
  assert.doesNotMatch(page, /class="dfilter"|data-asset=/);
  assert.ok(shown((await deckCards(me)).html).includes("Blue Test"), "every basket is dealt");
  const body = page.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  assert.doesNotMatch(body, />Baskets?</);
  assert.doesNotMatch(body, /Basket · /);
});

test("active trades from a basket open the basket: its orders have no trade page", async () => {
  const { activeHtml } = await import("./views/deck.js");
  const me = user();
  await b.copyBasket(me, blue, 20);
  const html = await activeHtml(me);
  assert.match(html, new RegExp(`href="/b/${blue}#yours"`));
  assert.doesNotMatch(html, /href="\/t\/-/);
});

test("Portfolio holds both jobs: Investing by default, Creating as a tab, with one sidebar item", async () => {
  const { portfolioPage, portfolioTab } = await import("./views/web.js");
  assert.equal(portfolioTab("nonsense"), "investing");
  const invest = await portfolioPage(creator);
  assert.match(invest, /Wallet balance/);
  assert.match(invest, /href="\/portfolio\?tab=creating"/);
  const create = await portfolioPage(creator, "creating");
  assert.match(create, /New basket/);
  assert.match(create, /Your baskets/);
  assert.match(create, /Earned · all time/);
  assert.doesNotMatch(create, /Wallet balance/);
});

// ---------- Chief with no model ----------

const ask = (uid: number, text: string, chatId?: number) => catAsk(uid, text, { chatId, newChat: !chatId, live: false });

test("offline: asking by kind lists baskets of that kind, best protected first, without leading on return", async () => {
  const me = user();
  const stocks = await ask(me, "Show me baskets with US stocks");
  assert.match(stocks.reply, /Core Test/);
  assert.doesNotMatch(stocks.reply, /Meme Test/);
  assert.match(stocks.reply, /not on return/);
  const safe = await ask(me, "show me steady baskets");
  assert.match(safe.reply, /Blue Test|Core Test/);
  assert.doesNotMatch(safe.reply, /Naked Test/);
  assert.match((await ask(me, "what should I invest in?")).reply, /Best protected first/);
});

test("offline: 'buy $20 of' a basket prepares a copy of it, never a token order", async () => {
  const me = user();
  const r = await ask(me, "buy $20 of Blue Test");
  assert.ok(r.proposalId, r.reply);
  assert.match(r.card!.title, /Blue Test/);
  assert.equal(r.card!.href, `/b/${blue}#copy`);
  assert.equal(r.card!.maxLoss, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM basket_copies WHERE follower = ?").get(me)!.n, 0, "nothing moves until Confirm");
  const done = await catConfirm(me, r.proposalId!);
  assert.ok(done.ok, done.reply);
  assert.match(done.reply, /Copied \$20 across 2 tokens/);
  assert.equal(db.prepare("SELECT status FROM basket_copies WHERE follower = ?").get(me)!.status, "filled");
  assert.match((await ask(me, "how are my baskets doing?")).reply, /You copy 1 basket: Blue Test/);
});

test("offline: copying asks how much, and your limits answer back", async () => {
  const me = user({ max: 25 });
  const noAmount = await ask(me, "copy Blue Test");
  assert.match(noAmount.reply, /How much of Blue Test\? Your max per copy is \$25/);
  assert.ok(noAmount.follow?.some((f) => f.text === "copy $25 of Blue Test"));
  const over = await ask(me, "copy $100 of Blue Test");
  assert.equal(over.proposalId, undefined);
  assert.match(over.reply, /Pick \$1 to \$25/);
  assert.equal((await ask(me, "Is the basket \"Blue Test\" worth copying?")).proposalId, undefined, "a question isn't an order");
});

test("a card is checked again on Confirm: Guard pausing the creator in between stops the copy", async () => {
  const me = user();
  const r = await ask(me, "copy $20 of Meme Test");
  assert.ok(r.proposalId, r.reply);
  haltLeader(creator, "drawdown");
  try {
    const out = await catConfirm(me, r.proposalId!);
    assert.equal(out.ok, false);
    assert.match(out.reply, /Not copied: This creator is paused by CopyGuard/);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM basket_copies WHERE follower = ?").get(me)!.n, 0);
  } finally {
    resumeLeader(creator);
  }
});

test("offline: a chat stays on its basket, and the worst case says a stop isn't a guarantee", async () => {
  const me = user();
  const first = await ask(me, "Is the basket \"Naked Test\" worth copying?");
  assert.match(first.reply, /worked out from prices/);
  assert.equal(first.verdict?.tone === undefined, false);
  const worst = await ask(me, "what's the worst case?", first.chatId);
  assert.match(worst.reply, /no stop-loss.*at risk/);
  const stop = await ask(me, "Is the basket \"Blue Test\" worth copying?");
  assert.match((await ask(me, "what could I lose?", stop.chatId)).reply, /trigger, not a guarantee/);
});

test("a broad fund isn't concentration: the read and the risk band agree", async () => {
  const v = (await b.basketView(core))!;
  const read = await b.basketRead(v);
  assert.equal(v.risk, "steady");
  assert.ok(!read.checks.some((c) => /moves like one token|no spread/.test(c.t)), JSON.stringify(read.checks));
  assert.ok(read.checks.some((c) => c.ok && /hundreds of companies/.test(c.t)));
  // One coin at 80% still is.
  const heavy = await make(creator, "Heavy Test", [[AERO, 80], [ETH, 20]]);
  assert.ok((await b.basketRead((await b.basketView(heavy))!)).checks.some((c) => !c.ok && /moves like one token/.test(c.t)));
  await b.retireBasket(creator, heavy);
});

test("confirming tells the page whether it was practice, so it never claims onchain", async () => {
  const me = user();
  const r = await ask(me, "copy $20 of Blue Test");
  const done = await catConfirm(me, r.proposalId!);
  assert.equal(done.sim, true);
  assert.equal(done.basket, true);
});

test("plain token orders still work next to all this", async () => {
  const r = await ask(user(), "buy $20 ETH with 5% stop");
  assert.ok(r.proposalId);
  assert.doesNotMatch(r.card!.title, /Basket/);
  assert.equal(r.card!.href, undefined);
});

test("real money stays off through Chief too", async () => {
  process.env.DRY_RUN = "false";
  try {
    const r = await ask(user(), "copy $20 of Blue Test");
    assert.equal(r.proposalId, undefined);
    assert.match(r.reply, /practice mode/);
  } finally {
    process.env.DRY_RUN = "true";
  }
});

// ---------- Chief with a model ----------

type Req = { messages: { role: string; content: string | null }[]; tools: { function: { name: string } }[] };
const requests: Req[] = [];
let script: ((r: Req) => unknown)[] = [];
const model = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const r = JSON.parse(body) as Req;
    requests.push(r);
    const message = script.shift()?.(r) ?? { content: "done" };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message }] }));
  });
});
await new Promise<void>((r) => model.listen(0, r));
after(() => model.close());
const call = (name: string, args: object) => () => ({ content: null, tool_calls: [{ id: "c1", type: "function", function: { name, arguments: JSON.stringify(args) } }] });
const say = (content: string) => () => ({ content });
const toolResult = (r: Req) => r.messages.filter((m) => m.role === "tool").at(-1)?.content ?? "";

async function withModel<T>(steps: typeof script, run: () => Promise<T>): Promise<T> {
  process.env.OPENAI_COMPAT_API_KEY = "test";
  process.env.OPENAI_COMPAT_URL = `http://127.0.0.1:${(model.address() as AddressInfo).port}`;
  requests.length = 0;
  script = steps;
  try { return await run(); } finally { delete process.env.OPENAI_COMPAT_API_KEY; delete process.env.OPENAI_COMPAT_URL; }
}

test("model: Chief is told about baskets, and given the tools to work with them", async () => {
  await withModel([say("Hello")], () => ask(user(), "what is this app?"));
  const names = requests[0].tools.map((t) => t.function.name);
  for (const t of ["find_baskets", "basket_info", "my_baskets", "propose_basket_copy"]) assert.ok(names.includes(t), t);
  const system = requests[0].messages[0].content!;
  assert.match(system, /Baskets are Tribe's main product/);
  assert.match(system, /Never rank or recommend on return/);
  assert.match(system, /triggers, not guarantees/);
  assert.match(system, /never personal advice/);
});

test("model: a basket question reaches the model, whose search brings back mix, risk and the simulated label", async () => {
  const me = user();
  let seen = "";
  const r = await withModel([call("find_baskets", { assetClass: "stock" }), (q) => { seen = toolResult(q); return { content: "US Core looks closest." }; }], () => ask(me, "which basket has the best stocks?"));
  assert.equal(r.reply, "US Core looks closest.");
  const facts = JSON.parse(seen);
  assert.equal(facts[0].name, "Core Test");
  assert.deepEqual(facts[0].mix[0], { assetClass: "US stocks", pct: 80 });
  assert.equal(facts[0].risk, "Steady");
  assert.ok("simulatedIndexReturnPct" in facts[0] && !("returnPct" in facts[0]));
  assert.ok(r.follow?.some((f) => f.href === `/b/${core}`));
});

test("model: basket_info shows Chief's read and pins the chat to that basket", async () => {
  const me = user();
  const r = await withModel([call("basket_info", { basket: "Naked Test" }), say("It has no stop.")], () => ask(me, "tell me about Naked Test"));
  assert.ok(r.verdict);
  await withModel([say("Still that one.")], () => ask(me, "and the risk?", r.chatId));
  assert.match(requests[0].messages[0].content!, /This chat is about the basket "Naked Test"/);
});

test("model: it can prepare a copy, the user confirms, and a refused amount comes back as the reason", async () => {
  const me = user({ max: 30 });
  const r = await withModel([call("propose_basket_copy", { basket: "Blue Test", usd: 20 }), say("Check the card.")], () => ask(me, "copy $20 of Blue Test"));
  assert.ok(r.proposalId);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM basket_copies WHERE follower = ?").get(me)!.n, 0);
  assert.ok((await catConfirm(me, r.proposalId!)).ok);
  let why = "";
  const r2 = await withModel([call("propose_basket_copy", { basket: "Meme Test", usd: 900 }), (q) => { why = toolResult(q); return { content: "Too much." }; }], () => ask(me, "copy $900 of Meme Test"));
  assert.match(why, /Pick \$1 to \$30/);
  assert.equal(r2.proposalId, undefined);
});

test("model: if it fails, baskets still get an answer", async () => {
  process.env.OPENAI_COMPAT_API_KEY = "test";
  process.env.OPENAI_COMPAT_URL = "http://127.0.0.1:1";
  try {
    assert.match((await ask(user(), "show me steady baskets")).reply, /steady/i);
  } finally {
    delete process.env.OPENAI_COMPAT_API_KEY; delete process.env.OPENAI_COMPAT_URL;
  }
});

void memes; void nostop;
