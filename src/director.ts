import { basketById, copyBasket, createBasket, tokensText, updateWeights } from "./baskets.js";
import { db, haltLeader, resumeLeader, userByHandle } from "./db.js";
import { DEMO_TOKENS } from "./demo-tokens.js";
import { mirror } from "./copy.js";
import { parseTrade, TOKENS } from "./parse.js";
import { breakToken, getPrice, nudgeDemoPrice } from "./prices.js";
import { pollOrders } from "./tracker.js";

export interface Beat { id: string; title: string; say: string; run: () => Promise<string> }

const who = (h: string) => {
  const u = userByHandle(h);
  if (!u) throw new Error(`Seed the demo first (missing @${h}).`);
  return u.id;
};

const sym = (s: string) => DEMO_TOKENS.find((t) => t.symbol === s)!.address;
let launched = 0;
/** The newest basket @nightowl published. */
const latest = () => {
  const b = db.prepare("SELECT id FROM baskets WHERE owner = ? ORDER BY id DESC LIMIT 1").get(who("nightowl")) as { id: number } | undefined;
  if (!b) throw new Error("Run beat 1 first: @nightowl has no trade yet.");
  return b.id;
};

/** Story beats for the demo video. Each one triggers the same code paths real events use. */
export const BEATS: Beat[] = [
  {
    id: "basket-launch",
    title: "1 · A creator publishes a trade",
    say: "@nightowl picks tokens and weights and publishes. It slides into the feed for anyone to copy.",
    run: async () => {
      const id = await createBasket(who("nightowl"), { name: `Night Index ${++launched}`, thesis: "Half ETH, the rest spread across Base.", stopPct: 10, tpPct: 40, weights: [{ token: sym("ETH"), weight: 50 }, { token: sym("cbBTC"), weight: 25 }, { token: sym("AERO"), weight: 25 }] });
      return `${basketById(id)!.name} published.`;
    },
  },
  {
    id: "basket-copy",
    title: "2 · You copy it",
    say: "One tap: $20 becomes one Flash order per token, each with its stop, in your own wallet.",
    run: async () => {
      const out = await copyBasket(who("you"), latest(), 20);
      return `Copied $${out.usd} across ${tokensText(out.placed)}.`;
    },
  },
  {
    id: "basket-rebalance",
    title: "3 · The creator changes the weights",
    say: "@nightowl moves weight from ETH to AERO. Nothing moves in your wallet: you get a rebalance request to approve.",
    run: async () => {
      const out = await updateWeights(who("nightowl"), latest(), [{ token: sym("ETH"), weight: 30 }, { token: sym("cbBTC"), weight: 25 }, { token: sym("AERO"), weight: 45 }], "Moving weight from ETH into AERO.");
      return `Version ${out.version} published. ${out.asked} copier(s) asked to rebalance.`;
    },
  },
  {
    id: "basket-partial",
    title: "4 · One token won't fill",
    say: "A token fails mid-copy. The rest still go through, and you can try again or unwind.",
    run: async () => {
      const id = await createBasket(who("nightowl"), { name: `Night Index ${++launched}`, stopPct: 10, weights: [{ token: sym("ETH"), weight: 50 }, { token: sym("VIRTUAL"), weight: 50 }] });
      breakToken(sym("VIRTUAL"), true);
      try {
        const out = await copyBasket(who("you"), id, 20);
        return `${out.placed} of ${out.placed + out.failed} tokens filled. Open the trade to try again.`;
      } finally {
        breakToken(sym("VIRTUAL"), false);
      }
    },
  },
  {
    id: "pump",
    title: "5 · The market pumps",
    say: "ETH +4%, and every other token moves by how volatile it is. Trade values change by what's in them, and any take-profit hit fills on its own.",
    run: async () => {
      nudgeDemoPrice(4);
      await pollOrders();
      return "ETH +4%. PnL updated and triggers checked.";
    },
  },
  {
    id: "guard",
    title: "6 · Guard pauses @traderx",
    say: "Guard reads drawdown, bursts and token flags, the AI confirms, and a report lands in CopyGuard. Their trades can't be copied.",
    run: async () => {
      const id = who("traderx");
      db.prepare("INSERT INTO snapshots (trader, at, pnl_pct) VALUES (?, ?, ?)").run(id, Date.now(), -22);
      haltLeader(id, "drawdown 22pp in 1h, 2 trades without a stop", "0xdemo000000000000000000000000000000000000000000000000000000c0ffee");
      const r = await mirror(id, parseTrade(["buy", "ETH", "60"]));
      return `@traderx paused onchain. Their next trade: ${r.skipped.length} copy skipped by Guard.`;
    },
  },
  {
    id: "resume",
    title: "7 · Guard clears @traderx",
    say: "Risk falls back under the line. The next check clears the pause and copying resumes.",
    run: async () => {
      resumeLeader(who("traderx"));
      return "@traderx cleared.";
    },
  },
  {
    id: "trade",
    title: "Extra · A trader you follow by rule opens a bracket",
    say: "@nightowl goes long ETH with a stop and target. @you copies in ask-first mode: a request appears with a countdown.",
    run: async () => {
      const id = who("nightowl");
      const p = await getPrice(TOKENS.ETH);
      const r = await mirror(id, parseTrade(["long", "ETH", "200", (p * 1.12).toFixed(2), (p * 0.95).toFixed(2)]));
      return `Bracket placed. ${r.pending.length} copy request(s) waiting, ${r.executed.length} auto-copied.`;
    },
  },
  {
    id: "dump",
    title: "Extra · ETH drops 5%",
    say: "Use this to show stop-losses firing and the red PnL state.",
    run: async () => {
      nudgeDemoPrice(-5);
      await pollOrders();
      return "ETH -5%. Stops checked.";
    },
  },
];

export async function runBeat(id: string): Promise<string> {
  const b = BEATS.find((x) => x.id === id);
  if (!b) throw new Error("Unknown beat");
  return b.run();
}
