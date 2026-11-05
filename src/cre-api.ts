import express, { Router } from "express";
import { addCreRun, db, haltLeader, haltOf, resumeLeader, saveSeasonBoard, type CreVerdict, type SeasonBoardRow } from "./db.js";
import { type PendingNotice } from "./copy.js";
import { runBots } from "./bots.js";
import { parseTrade } from "./parse.js";
import { markCheck, setOracleCheck, snapshot } from "./guard.js";

/**
 * Endpoints the Chainlink CRE workflows call (cre-workflow/*), authenticated with the shared secret in `x-cre-secret`.
 * Notifiers come from the Telegram bot when it runs.
 */
export interface CreNotifiers {
  pending?: (list: PendingNotice[], leader: number) => Promise<void> | void;
  halt?: (leader: number, halted: boolean, reason?: string) => Promise<void> | void;
}

type GuardVerdict = CreVerdict;

export function creRouter(notify: CreNotifiers = {}): Router {
  const r = Router();
  const authed = (req: express.Request) => !!process.env.CRE_SHARED_SECRET && req.headers["x-cre-secret"] === process.env.CRE_SHARED_SECRET;

  // CopyGuard reads every trader's risk inputs.
  r.get("/guard/snapshot", async (req, res) => {
    if (!authed(req)) return res.sendStatus(401);
    markCheck();
    res.json(await snapshot());
  });

  // Bot signal: placed for every user whose bot is on, from their own wallet and under their own name (tagged Bot),
  // sized by their bot settings, then copied to their copiers by their copiers' rules.
  r.post("/cre/signal", express.json(), async (req, res) => {
    if (!authed(req)) return res.sendStatus(401);
    try {
      const b = req.body as { args: string[]; thesis?: string };
      parseTrade(b.args); // reject a malformed signal before anyone's bot acts on it
      const runs = await runBots(b.args, typeof b.thesis === "string" ? b.thesis : undefined);
      for (const run of runs) if (run.result) await notify.pending?.(run.result.pending, run.user);
      res.json({
        bots: runs.length,
        placed: runs.filter((x) => x.result).map((x) => ({ handle: x.handle, tradeId: x.result!.tradeId, own: x.result!.own, copied: x.result!.executed.length, asked: x.result!.pending.length })),
        skipped: runs.filter((x) => x.skipped).map((x) => ({ handle: x.handle, why: x.skipped })),
      });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Verdicts posted by CopyGuard right after it writes them onchain (also the path a dry-run simulation uses).
  // The contract's events are the source of truth; this is idempotent with the event watcher.
  r.post("/cre/guard", express.json(), async (req, res) => {
    if (!authed(req)) return res.sendStatus(401);
    const b = req.body as { verdicts?: GuardVerdict[]; oracle?: number; dex?: number; deviationPct?: number } & Partial<GuardVerdict>;
    markCheck();
    if (typeof b.oracle === "number" && typeof b.dex === "number") setOracleCheck({ oracle: b.oracle, dex: b.dex, deviationPct: b.deviationPct ?? 0 });
    const list: GuardVerdict[] = b.verdicts ?? (b.leader !== undefined ? [b as GuardVerdict] : []);
    if (b.verdicts) addCreRun({ oracle: b.oracle ?? null, dex: b.dex ?? null, deviation: b.deviationPct ?? null, verdicts: b.verdicts });
    for (const v of list) {
      const was = !!haltOf(v.leader);
      if (v.severity === "halt") haltLeader(v.leader, v.reason, v.tx ?? undefined);
      else if (v.severity === "ok") resumeLeader(v.leader, v.tx ?? undefined);
      if (was !== (v.severity === "halt") && v.severity !== "warn") await notify.halt?.(v.leader, v.severity === "halt", v.reason);
    }
    res.json({ ok: true, received: list.length });
  });

  // Season board: who to rank (public data only: id, handle, wallet), and where it posts the attested ranking.
  r.get("/cre/traders", (req, res) => {
    if (!authed(req)) return res.sendStatus(401);
    const rows = db.prepare("SELECT u.id AS leader, u.handle, u.address, COUNT(t.id) AS n FROM users u JOIN trades t ON t.leader = u.id GROUP BY u.id ORDER BY n DESC, u.id").all() as unknown as { leader: number; handle: string; address: string }[];
    res.json(rows.map(({ leader, handle, address }) => ({ leader, handle, address })));
  });
  r.post("/cre/board", express.json({ limit: "200kb" }), (req, res) => {
    if (!authed(req)) return res.sendStatus(401);
    const b = req.body as { season: number; hash: string; tx?: string; computedAt: number; ranking: SeasonBoardRow["ranking"] };
    if (!Number.isInteger(b.season) || typeof b.hash !== "string" || !Array.isArray(b.ranking)) return res.status(400).json({ error: "bad board" });
    saveSeasonBoard({ season: b.season, hash: b.hash, tx: b.tx ?? null, computedAt: Number(b.computedAt) * 1000, ranking: b.ranking });
    res.json({ ok: true, ranked: b.ranking.length });
  });
  return r;
}
