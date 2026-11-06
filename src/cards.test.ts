process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";

import test from "node:test";
import assert from "node:assert/strict";

const prices = await import("./prices.js");
prices.enableDemoPrices(); // token lookups answer from the demo list, with no network
const { backfillCards, createWebUser, db, getMeta, setMeta } = await import("./db.js");
const b = await import("./baskets.js");
const { DEMO_TOKENS } = await import("./demo-tokens.js");
const { pollOrders } = await import("./tracker.js");
const { CARD_TIERS, finishOf, higherTier, progressOf, tierOf } = await import("./card-tiers.js");
const { cardById, cardFor, cardMetadata, cardsOf, cardView, refreshCards } = await import("./cards.js");
const { CARD_H, CARD_W, cardSvg } = await import("./views/card.js");
const { svgToPng } = await import("./views/trader.js");

const addr = (s: string) => DEMO_TOKENS.find((t) => t.symbol === s)!.address;
const ETH = addr("ETH"), BTC = addr("cbBTC");

const px: Record<string, number> = {};
const reset = () => Object.assign(px, { [ETH]: 2500, [BTC]: 68000 });
reset();
prices.setPriceProvider(async (t) => {
  const p = px[t.toLowerCase()];
  if (!p) throw new Error(`no price for ${t}`);
  return p;
});

let n = 0;
function user() {
  const u = createWebUser(`carduser${++n}`)!;
  const m = getMeta(u.id);
  setMeta(u.id, { simBalance: 1000, defaults: { ...m.defaults, max: 500, cap: 5000, stop: false } });
  return u.id;
}
const make = (owner: number, name = "Card Test") => b.createBasket(owner, { name, stopPct: 0, tpPct: 0, weights: [{ token: ETH, weight: 100 }] });
const view = async (id: number) => (await cardView(cardById(id)!))!;
const copyCard = (who: number, basket: number) => cardFor(who, basket)!;
const fill = async () => { await pollOrders(); };

const sample = {
  id: 1, kind: "original" as const, edition: 0, editionLabel: "Original", tier: "holo" as const, basket: 1, name: "Sample", handle: "maker", returnPct: 31.2, copiers: 3, days: 14,
  weights: [{ symbol: "ETH", weight: 60 }, { symbol: "AERO", weight: 40 }], chart: [100, 104, 102, 131], progress: { next: null, pct: 100, detail: "Top tier reached", count: "" }, practice: true,
};

test("tiers: the config decides, and an Original needs both return and copiers", () => {
  const { glitter, holo } = CARD_TIERS.original;
  assert.equal(tierOf("original", { returnPct: glitter.returnPct, copiers: glitter.copiers }), "glitter");
  assert.equal(tierOf("original", { returnPct: glitter.returnPct - 0.01, copiers: 99 }), "base");
  assert.equal(tierOf("original", { returnPct: 500, copiers: glitter.copiers - 1 }), "base");
  assert.equal(tierOf("original", { returnPct: holo.returnPct, copiers: holo.copiers - 1 }), "glitter");
  assert.equal(tierOf("original", { returnPct: holo.returnPct, copiers: holo.copiers }), "holo");
  assert.equal(tierOf("copy", { returnPct: CARD_TIERS.copy.glitter.returnPct, copiers: 0 }), "glitter");
  assert.equal(tierOf("copy", { returnPct: CARD_TIERS.copy.holo.returnPct, copiers: 0 }), "holo");
  assert.equal(higherTier("holo", "base"), "holo");
  assert.equal(higherTier("base", "glitter"), "glitter");
});

test("progress: towards the tier above the one held, set by whichever condition is further behind", () => {
  const { holo } = CARD_TIERS.original;
  const p = progressOf("original", "glitter", { returnPct: holo.returnPct, copiers: 0 });
  assert.deepEqual([p.next, p.pct], ["holo", 0]);
  assert.equal(p.detail, `Next: Holo · ${holo.copiers} copiers + ${holo.returnPct}%`);
  assert.equal(p.count, `0/${holo.copiers}`); // the count follows the condition that's behind
  assert.equal(progressOf("original", "base", { returnPct: 5, copiers: 2 }).count, "5.0/10%");
  assert.equal(progressOf("copy", "base", { returnPct: -30, copiers: 0 }).pct, 0);
  assert.equal(progressOf("copy", "base", { returnPct: 5, copiers: 0 }).pct, 50);
  assert.equal(progressOf("copy", "base", { returnPct: 5, copiers: 0 }).detail, "Next: Glitter · +10%");
  assert.deepEqual(progressOf("copy", "holo", { returnPct: -40, copiers: 0 }), { next: null, pct: 100, detail: "Top tier reached", count: "" });
});

test("the feed's finish goes by return since launch alone, both ways", () => {
  const { glitter, holo } = CARD_TIERS.original;
  assert.equal(finishOf(glitter.returnPct - 0.01), "base");
  assert.equal(finishOf(glitter.returnPct), "glitter");
  assert.equal(finishOf(holo.returnPct - 0.01), "glitter");
  assert.equal(finishOf(holo.returnPct), "holo");
  assert.equal(finishOf(-50), "base");
});

test("creating gives an Original, each copy the next edition, and a copy that never filled gets nothing", async () => {
  reset();
  const owner = user(), a = user(), c = user(), d = user();
  const id = await make(owner);
  const original = cardFor(owner, id)!;
  assert.deepEqual([original.kind, original.edition, original.tier], ["original", 0, "base"]);

  await b.copyBasket(a, id, 50);
  assert.equal((await view(copyCard(a, id).id)).editionLabel, "Copy #1");

  px[ETH] = 0; // every order fails
  assert.equal((await b.copyBasket(d, id, 50)).status, "failed");
  assert.equal(cardFor(d, id), undefined);
  reset();

  await b.copyBasket(c, id, 50);
  assert.equal(copyCard(c, id).edition, 2); // the failed copy didn't use a number
});

test("closing and copying again gives a second card with a new edition", async () => {
  reset();
  const owner = user(), a = user();
  const id = await make(owner);
  const first = await b.copyBasket(a, id, 50);
  await fill();
  await b.closeCopy(a, first.copy);
  await fill();
  await b.copyBasket(a, id, 50);
  assert.deepEqual(cardsOf(a).map((c) => c.edition), [2, 1]);
});

test("an Original upgrades on return and copiers, and keeps its tier when the basket falls", async () => {
  reset();
  const owner = user();
  const id = await make(owner);
  const card = cardFor(owner, id)!.id;
  px[ETH] = 2500 * 1.3;
  await refreshCards();
  assert.equal(cardById(card)!.tier, "base"); // the return is there, the copiers aren't

  reset();
  for (let i = 0; i < 3; i++) await b.copyBasket(user(), id, 50);
  await fill();
  px[ETH] = 2500 * 1.12;
  await refreshCards();
  assert.equal(cardById(card)!.tier, "glitter");
  px[ETH] = 2500 * 1.3;
  await refreshCards();
  const up = cardById(card)!;
  assert.equal(up.tier, "holo");
  assert.ok(up.tier_at);

  px[ETH] = 2000;
  const fallen = await view(card);
  assert.equal(fallen.tier, "holo");
  assert.ok(fallen.returnPct < 0); // the tier stays, the number stays honest
});

test("a Copy goes by that copier's own return, not the basket's", async () => {
  reset();
  const owner = user(), early = user(), late = user();
  const id = await make(owner);
  await b.copyBasket(early, id, 50);
  await fill();
  px[ETH] = 2500 * 1.2;
  await b.copyBasket(late, id, 50);
  await fill();
  await refreshCards();
  const [e, l] = [await view(copyCard(early, id).id), await view(copyCard(late, id).id)];
  assert.equal(e.tier, "glitter");
  assert.ok(Math.abs(e.returnPct - 20) < 1);
  assert.equal(l.tier, "base"); // same basket, bought 20% higher
  assert.ok(Math.abs(l.returnPct) < 1);
});

test("a closed copy's return is final, and a retired basket's Original stops upgrading", async () => {
  reset();
  const owner = user(), a = user();
  const id = await make(owner);
  const out = await b.copyBasket(a, id, 50);
  await fill();
  px[ETH] = 2500 * 1.15;
  await b.closeCopy(a, out.copy);
  await fill();
  const card = copyCard(a, id).id;
  const closed = await view(card);
  px[ETH] = 2500 * 3;
  const later = await view(card);
  assert.equal(later.returnPct, closed.returnPct);
  assert.equal(later.tier, "glitter");

  const other = await make(owner, "Retired One");
  for (let i = 0; i < 3; i++) await b.copyBasket(user(), other, 50);
  await fill();
  b.retireBasket(owner, other);
  px[ETH] = 2500 * 3 * 1.5;
  await refreshCards();
  assert.equal(cardFor(owner, other)!.tier, "base");
});

test("backfill numbers older copies in order, and running it twice changes nothing", async () => {
  reset();
  const owner = user(), a = user(), c = user();
  const id = await make(owner);
  await b.copyBasket(a, id, 50);
  await b.copyBasket(c, id, 50);
  db.prepare("DELETE FROM basket_cards WHERE basket = ?").run(id);
  backfillCards();
  backfillCards();
  const rows = db.prepare("SELECT kind, edition, owner FROM basket_cards WHERE basket = ? ORDER BY edition").all(id) as { kind: string; edition: number; owner: number }[];
  assert.deepEqual(rows.map((r) => [r.kind, r.edition, r.owner]), [["original", 0, owner], ["copy", 1, a], ["copy", 2, c]]);
});

test("backfill leaves a creator's publish stake alone: it isn't a copy", async () => {
  reset();
  const owner = user();
  const out = await b.publishBasket(owner, { name: "Staked", stopPct: 0, weights: [{ token: ETH, weight: 100 }], usd: 20 });
  await fill();
  backfillCards();
  const rows = db.prepare("SELECT kind, edition FROM basket_cards WHERE basket = ? ORDER BY edition").all(out.id) as { kind: string; edition: number }[];
  assert.deepEqual(rows.map((r) => [r.kind, r.edition]), [["original", 0]]);
});

test("the chart reaches back past the last 200 ticks", async () => {
  reset();
  const id = await make(user());
  db.prepare("DELETE FROM basket_nav WHERE basket = ?").run(id);
  const start = Date.now() - 1000 * 60_000;
  for (let i = 0; i < 1000; i++) db.prepare("INSERT INTO basket_nav (basket, at, nav) VALUES (?, ?, ?)").run(id, start + i * 60_000, 100 + i);
  const series = b.navSince(id, start);
  assert.equal(series[0], 100);
  assert.equal(series.at(-1), 1099);
  assert.ok(series.length <= 120);
});

test("the SVG: 360x504, three finishes, the same every time, and it renders", () => {
  const plain = cardSvg({ ...sample, tier: "base" }), glitter = cardSvg({ ...sample, tier: "glitter" }), holo = cardSvg(sample);
  assert.match(plain, new RegExp(`width="${CARD_W}" height="${CARD_H}" viewBox="0 0 360 504"`));
  assert.equal(CARD_W, 360);
  assert.equal(CARD_H, 504);
  for (const label of ["BASE", "GLITTER", "HOLO"]) assert.ok([plain, glitter, holo].some((s) => s.includes(`>${label}</text>`)));
  for (const s of [plain, holo]) assert.doesNotMatch(s, /class="tw/);
  assert.equal((glitter.match(/class="tw/g) ?? []).length, 20); // sparkles only on glitter
  assert.match(glitter, /#efe4c2/); // silver and champagne foil
  assert.match(holo, /#ff5f9e/); // rainbow foil
  assert.match(holo, /class="sweep"/);
  assert.match(plain, /@font-face/); // the design's fonts travel in the file
  assert.doesNotMatch(plain, /@keyframes/); // base stays still
  assert.equal(cardSvg({ ...sample, tier: "glitter" }), glitter);
  for (const s of [plain, glitter, holo]) for (const text of ["ORIGINAL · #0001", "Sample", "by @maker", "ETH", "+31.2%", "RETURN", "COPIERS", "LIVE", "14d", "Top tier reached", "simulated fills"]) assert.ok(s.includes(text), text);
  assert.ok(svgToPng(holo).length > 1000);
});

test("the SVG holds up: hostile text, the longest name, ten tokens and a one-point chart", () => {
  const svg = cardSvg({ ...sample, name: `</text><script>alert("x")</script>`, weights: [{ symbol: `<img onerror=1>`, weight: 100 }] });
  assert.doesNotMatch(svg, /<script|<img/);
  assert.ok(svgToPng(svg).length > 1000);

  const worst = cardSvg({ ...sample, name: "W".repeat(40), weights: Array.from({ length: 10 }, (_, i) => ({ symbol: `TOKENLONGNAME${i}`, weight: 10 })), chart: [100] });
  assert.match(worst, /\+7 more/);
  const size = Number(/y="249"[^>]*font-size="([\d.]+)"/.exec(worst)![1]);
  assert.ok(size * 40 <= 306 + 0.5); // at a full em per character it still fits
  const ys = [.../<path d="([^"]+)" fill="none"/.exec(worst)![1].matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => m[1]);
  assert.equal(new Set(ys).size, 1); // a one-point chart is flat, not a spike
  assert.ok(svgToPng(worst).length > 1000);
});

test("a live card says so, and a practice card says that", () => {
  assert.match(cardSvg(sample), /Practice · simulated fills/);
  assert.match(cardSvg({ ...sample, practice: false }), /Real orders on Base/);
  assert.deepEqual(cardMetadata({ ...sample, practice: false }, "https://t").attributes.find((a) => a.trait_type === "Mode"), { trait_type: "Mode", value: "Live" });
});

test("the metadata has no handle or dollars", () => {
  const m = cardMetadata(sample, "https://tribe.example");
  assert.equal(m.image, "https://tribe.example/card/1.svg");
  assert.deepEqual(m.attributes.find((a) => a.trait_type === "Tier"), { trait_type: "Tier", value: "HOLO" });
  assert.deepEqual(m.attributes.find((a) => a.trait_type === "Mode"), { trait_type: "Mode", value: "Practice" });
  assert.doesNotMatch(JSON.stringify(m), /\$|@/);
});

test("with real money switched on, a card is only Live once a real order backs it", async () => {
  const owner = user();
  await make(owner, "Label Test");
  const row = cardsOf(owner)[0];
  process.env.DRY_RUN = "false";
  try {
    assert.equal((await cardView(row))!.practice, true, "no orders at all: it can't claim real orders");
  } finally {
    process.env.DRY_RUN = "true";
  }
});
