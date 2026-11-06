import { backdateBasket, copyBasket, createBasket } from "./baskets.js";
import { DEMO_TOKENS } from "./demo-tokens.js";
import "dotenv/config";
import { addRule, addComment, addLedger, createSquad, db, getMeta, getUser, haltLeader, joinSquad, setFollow, setHandle, setMeta, setReaction } from "./db.js";
import { mirror } from "./copy.js";
import { runBots } from "./bots.js";
import type { TradeSource } from "./db.js";
import { enableDemoPrices, getPrice, nudgeDemoPrice, resetDemoPrices, setDemoPrice } from "./prices.js";
import { searchAsset } from "./flash.js";
import { parseTrade, TOKENS } from "./parse.js";
import { heldTokens, pollOrders } from "./tracker.js";

/** Demo data: traders with personas, followers with different rules, brackets, one CopyGuard halt. Run with DEMO=true. */
enableDemoPrices();
// Recording with real prices (DEMO_PRICES=false): start the seeded history from today's Flash price so seeded stops sit where they should.
if (process.env.DEMO_PRICES === "false") {
  const live = Number((await searchAsset(TOKENS.ETH).catch(() => undefined))?.price);
  if (live) setDemoPrice(live);
}
process.env.DRY_RUN = "true";

const people: [number, string, string][] = [[101, "nightowl", "Sniper"], [102, "kestrel", "Hodler"], [103, "mav", "Degen"], [104, "you", "Sniper"], [105, "traderx", "Degen"], [106, "ember", "Hodler"]];
for (const [id, h, persona] of people) {
  getUser(id);
  setHandle(id, h, true);
  db.prepare("UPDATE users SET persona = ? WHERE id = ?").run(persona, id);
  setMeta(id, { simBalance: 1000, permUntil: Date.now() + 30 * 86400e3 });
  addLedger(id, "deposit", 1000, "Demo credit (simulated USDC)");
}
const [nightowl, kestrel, mav, you, traderx, ember] = people.map((p) => p[0]);

// "you" (the demo viewer) copies three traders with different rules.
setFollow(you, nightowl, { mode: "ask", ratio: 0.5, maxUsdPerTrade: 25, requireStop: true, budgetUsd: 250 });
setFollow(you, kestrel, { mode: "auto", ratio: 1, maxUsdPerTrade: 20 });
setFollow(you, traderx, { mode: "auto", ratio: 0.5, maxUsdPerTrade: 15 });
setFollow(mav, nightowl, { mode: "auto" });
setFollow(kestrel, nightowl, { mode: "auto" });
setFollow(mav, ember, { mode: "auto" }); // ember: a careful trader the demo viewer does not copy yet (Chief's pick in the feed)

// @kestrel runs their own bot: the CRE agent strategy trades from their wallet, under their name, tagged Bot.
setMeta(kestrel, { bot: { on: true, usd: 25, perDay: 3 } });
const bios: [number, string][] = [
  [nightowl, "Brackets on everything. Range lows, last highs, no chasing."],
  [kestrel, "Slow money. TWAPs by hand, plus a bot that buys clean pullbacks."],
  [mav, "Small size, quick exits."],
  [traderx, "Momentum. High conviction, sometimes too high."],
  [ember, "Range trader. Stop under the low, target at the last high."],
  [you, "Learning by copying the careful ones."],
];
for (const [id, bio] of bios) db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(bio, id);
// Free follows (no copying): people keep an eye on each other.
for (const [a, b] of [[you, ember], [you, mav], [nightowl, ember], [ember, nightowl], [traderx, kestrel]]) db.prepare("INSERT OR IGNORE INTO watches (follower, leader, created_at) VALUES (?, ?, ?)").run(a, b, Date.now() - 86400e3);

// Closed trades over the past weeks, so leaderboards, seasons and share cards show realised results.
// Each round trip goes through the normal path (mirror -> simulated Flash fills at the moving demo price), then is backdated.
const lastId = (table: "trades" | "orders") => (db.prepare(`SELECT COALESCE(MAX(id), 0) AS id FROM ${table}`).get() as { id: number }).id;
const roundTrip = async (who: number, usd: string, movePct: number, daysAgo: number, source: TradeSource = "user") => {
  const [t0, o0] = [lastId("trades"), lastId("orders")];
  await mirror(who, { ...parseTrade(["buy", "ETH", usd]), hasStop: true }, source);
  nudgeDemoPrice(movePct);
  await mirror(who, parseTrade(["sell", "ETH", String(heldTokens(who, TOKENS.ETH))]), source);
  nudgeDemoPrice((1 / (1 + movePct / 100) - 1) * 100); // back to where it was
  const at = Date.now() - daysAgo * 86400e3;
  db.prepare("UPDATE trades SET at = ? WHERE id > ?").run(at, t0);
  db.prepare("UPDATE copies SET at = ? WHERE trade_id > ?").run(at, t0);
  db.prepare("UPDATE orders SET placed_at = ?, filled_at = ? WHERE id > ?").run(at, at, o0);
  db.prepare("UPDATE pending_copies SET status = 'expired' WHERE trade_id > ?").run(t0); // history, not live requests
};
const daysIntoMonth = new Date().getUTCDate();
// Last season (previous calendar month)
await roundTrip(nightowl, "200", 15, daysIntoMonth + 9);
await roundTrip(kestrel, "150", 9, daysIntoMonth + 12);
await roundTrip(traderx, "120", 6, daysIntoMonth + 6);
await roundTrip(mav, "80", -3, daysIntoMonth + 4);
await roundTrip(you, "50", 3, daysIntoMonth + 3);
// This week
await roundTrip(nightowl, "150", 8.2, 3);
await roundTrip(kestrel, "100", 4.5, 4);
await roundTrip(traderx, "150", 12, 5);
await roundTrip(mav, "60", -2.1, 2);
await roundTrip(ember, "80", 5.1, 6);
await roundTrip(ember, "90", 3.2, 3);
await roundTrip(ember, "70", 2.4, 1);
await roundTrip(kestrel, "25", 3.4, 2, "bot"); // kestrel's bot
await roundTrip(kestrel, "25", -1.1, 5, "bot");
await roundTrip(kestrel, "25", 2.2, 6, "bot");

// Trades. nightowl ships entries with stops (hasStop), traderx does not.
// A long with take-profit and stop attached: one Flash order, copied as one order.
const p0 = await getPrice(TOKENS.ETH);
const at = (k: number) => (p0 * k).toFixed(2);
await mirror(nightowl, parseTrade(["long", "ETH", "250", at(1.12), at(0.92)]));
await mirror(kestrel, parseTrade(["twap", "ETH", "120", "1800", "6"]));
await mirror(kestrel, parseTrade(["buy", "ETH", "60"]));
await mirror(mav, parseTrade(["buy", "ETH", "40"]));
await mirror(nightowl, { ...parseTrade(["buy", "ETH", "100"]), hasStop: true });
// What the agent workflow posts to /cre/signal: every bot that is on (kestrel's) places it under its owner's name.
await runBots(["long", "ETH", "25", at(1.06), at(0.97)], "Buying a 2.4% pullback: the Chainlink feed and the DEX price agree, so the dip looks real, not a bad print.");
await mirror(ember, parseTrade(["long", "ETH", "60", at(1.08), at(0.96)]), "user", "Range low held three times. Stop under it, target at the last high.");
await mirror(traderx, parseTrade(["buy", "ETH", "80"]));
await mirror(traderx, parseTrade(["buy", "ETH", "40"]));
await mirror(mav, parseTrade(["sell", "ETH", "0.005"]));
await pollOrders();

// A believable history for curves and drawdown (seeded rows, clearly demo data).
const now = Date.now();
// Each curve ends near the trader's real current PnL so drawdown reflects the story, not a seeding artefact.
const curve = (id: number, end: number, drift: number, wobble: number, crash = 0) => {
  for (let i = 40; i >= 0; i--) {
    const dip = crash && i < 8 && i > 0 ? crash * Math.min(i, 8 - i) / 4 : 0;
    db.prepare("INSERT INTO snapshots (trader, at, pnl_pct) VALUES (?, ?, ?)").run(id, now - i * 3 * 3600e3, end - i * drift + Math.sin(i / 3) * wobble - dip);
  }
};
curve(nightowl, 1.2, 0.09, 0.5);
curve(kestrel, 0.8, 0.06, 0.4);
curve(mav, 0.3, 0.03, 0.9);
curve(traderx, 0.5, 0.05, 0.8, 11);
curve(you, 0.2, 0.02, 0.3);
curve(ember, 0.9, 0.05, 0.2);

// Social proof
const t1 = (db.prepare("SELECT MIN(id) AS id FROM trades WHERE leader = ?").get(nightowl) as { id: number }).id;
for (const [u, k] of [[kestrel, "diamond"], [mav, "fire"], [you, "bulb"], [traderx, "rocket"]] as const) setReaction(t1, u, k);
addComment(t1, kestrel, "Clean bracket. Stop right under the range low.");
addComment(t1, mav, "Got filled at nearly the same price, nice.");
addComment(t1, nightowl, "Last two highs stalled around +12%. Not chasing.");
// Reactions on today's trades, so the feed has a "Hot today" pick and live counts.
const latest = (who: number) => (db.prepare("SELECT MAX(id) AS id FROM trades WHERE leader = ? AND json_extract(trade,'$.side') = 'buy'").get(who) as { id: number }).id;
// One reaction per person, LinkedIn style (src/views/reactions.ts).
const fans: [number, [number, string][]][] = [
  [nightowl, [[kestrel, "fire"], [mav, "rocket"], [you, "fire"], [traderx, "bull"], [ember, "bulb"]]],
  [kestrel, [[mav, "bulb"], [you, "diamond"], [nightowl, "fire"]]],
  [ember, [[nightowl, "bull"]]],
  [traderx, [[mav, "bear"]]],
];
for (const [who, list] of fans) { const t = latest(who); if (t) for (const [u, k] of list) setReaction(t, u, k); }
addComment(latest(kestrel), nightowl, "Your bot's thesis line is a nice touch. Copied at half size.");

// Baskets: what people copy. Each has a past, and a few copiers. Skipped when recording with real prices, since their
// starting prices come from the demo price list.
if (process.env.DEMO_PRICES !== "false") {
  const T = Object.fromEntries(DEMO_TOKENS.map((t) => [t.symbol, t.address]));
  resetDemoPrices(); // the server starts from these, so a basket's seeded return is what it shows
  // The seeded history above counts as today's spending, so give everyone room to copy during a demo.
  for (const [id] of people) setMeta(id, { defaults: { ...getMeta(id).defaults, cap: 1000 } });
  const seedBaskets: [number, string, string, number, number, [string, number][], number, number, number[]][] = [
    [nightowl, "Base Blue Chips", "The names that survive every cycle, weighted by liquidity.", 10, 40, [["ETH", 50], ["cbBTC", 30], ["AERO", 20]], 21, 12.4, [kestrel, mav]],
    [ember, "Agent Economy", "Betting on the tokens AI agents actually use.", 15, 80, [["VIRTUAL", 40], ["ZORA", 30], ["AERO", 30]], 14, 31.2, [nightowl, kestrel, mav]],
    [kestrel, "Steady Stack", "Two assets, tight stops, low drama.", 8, 25, [["ETH", 60], ["cbBTC", 40]], 30, 6.2, [ember]],
    [mav, "Base Memes", "Small size, big swings. Stops on everything.", 20, 100, [["BRETT", 40], ["DEGEN", 30], ["TOSHI", 30]], 9, -8.5, []],
    [traderx, "All Gas", "High conviction, no stops.", 0, 0, [["ZORA", 70], ["DEGEN", 30]], 6, -14.1, []],
    [kestrel, "US Core", "Mostly the S&P 500, with a little ETH for growth.", 8, 25, [["deSPXA", 80], ["ETH", 20]], 45, 7.1, [ember]],
    [nightowl, "Stocks and Coins", "Half US stocks, half the biggest coins.", 10, 40, [["deSPXA", 50], ["ETH", 30], ["cbBTC", 20]], 28, 9.3, []],
    [ember, "Big Tech", "The largest names on Base, weighted by conviction.", 10, 30, [["NVDAc", 30], ["AAPLc", 20], ["MSFTc", 20], ["GOOGLc", 15], ["AMZNc", 15]], 21, 11.4, []],
    [mav, "Bitcoin Proxies", "Strategy and cbBTC: one idea, two wrappers.", 15, 60, [["MSTRc", 60], ["cbBTC", 40]], 12, 18.6, []],
  ];
  for (const [owner, name, thesis, stopPct, tpPct, weights, days, ret, copiers] of seedBaskets) {
    const id = await createBasket(owner, { name, thesis, stopPct, tpPct, weights: weights.map(([s, weight]) => ({ token: T[s], weight })) });
    for (const c of copiers) await copyBasket(c, id, 20).catch((e) => console.log(`seed: ${name} not copied: ${(e as Error).message}`));
    backdateBasket(id, days, ret);
  }
}

// Squads
const night = createSquad(nightowl, "Night Shift")!;
for (const u of [kestrel, you]) joinSquad(u, night);
const blue = createSquad(mav, "Blue Chips")!;
joinSquad(traderx, blue);

addRule(you, "Never copy memecoins without a stop", "Telegram");
addRule(you, "Ask me before anything over $50", "app");
addRule(you, "Explain Guard pauses in plain words", "app");

// The feed opens on baskets: requests left over from the seeded history would sit on top of it.
db.prepare("UPDATE pending_copies SET status = 'skipped' WHERE status = 'open'").run();

if (process.argv.includes("--halt")) haltLeader(traderx, "drawdown 22pp in 24h, 2 trades without a stop", "0xdemo_copyguard_tx");
console.log("seeded. Sign in as the demo viewer at /demo (DEMO=true).");
