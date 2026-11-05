import { db, haltLeader, resumeLeader, userByHandle } from "./db.js";
import { mirror } from "./copy.js";
import { parseTrade, TOKENS } from "./parse.js";
import { getPrice, nudgeDemoPrice } from "./prices.js";
import { pollOrders } from "./tracker.js";

export interface Beat { id: string; title: string; say: string; run: () => Promise<string> }

const who = (h: string) => {
  const u = userByHandle(h);
  if (!u) throw new Error(`Seed the demo first (missing @${h}).`);
  return u.id;
};

/** Story beats for the demo video. Each one triggers the same code paths real events use. */
export const BEATS: Beat[] = [
  {
    id: "trade",
    title: "1 · A trader you copy opens a bracket",
    say: "@nightowl goes long ETH with a stop and target. @you copies in ask-first mode: a request appears with a countdown.",
    run: async () => {
      const id = who("nightowl");
      const p = await getPrice(TOKENS.ETH);
      const r = await mirror(id, parseTrade(["long", "ETH", "200", (p * 1.12).toFixed(2), (p * 0.95).toFixed(2)]));
      return `Bracket placed. ${r.pending.length} copy request(s) waiting, ${r.executed.length} auto-copied.`;
    },
  },
  {
    id: "pump",
    title: "2 · ETH pumps 4%",
    say: "Price moves. Open positions gain, and any take-profit that is hit fills on its own.",
    run: async () => {
      nudgeDemoPrice(4);
      await pollOrders();
      return "ETH +4%. PnL updated and triggers checked.";
    },
  },
  {
    id: "guard",
    title: "3 · CRE Guard pauses @traderx",
    say: "The CRE workflow reads drawdown, bursts and token flags, the AI confirms, and a report lands in CopyGuard. Copying stops.",
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
    title: "4 · Guard clears @traderx",
    say: "Risk falls back under the line. The next CRE check clears the pause and copying resumes.",
    run: async () => {
      resumeLeader(who("traderx"));
      return "@traderx cleared.";
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
