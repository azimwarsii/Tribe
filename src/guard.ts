import { createPublicClient, http, parseAbiItem } from "viem";
import { base, baseSepolia } from "viem/chains";
import { db, haltLeader, haltOf, resumeLeader } from "./db.js";
import { searchAsset } from "./flash.js";
import { drawdown, positionsOf, totalPnl } from "./stats.js";
import { riskScore, type RiskInputs } from "./risk.js";

export interface GuardSnapshot {
  leader: number; handle: string; pnlPct: number; drawdown24h: number; tradesLastHour: number;
  topPositionPct: number; riskFlaggedToken: boolean; risk: number;
}

const flagCache = new Map<string, { at: number; v: boolean }>();
async function flagged(token: string): Promise<boolean> {
  const hit = flagCache.get(token);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.v;
  const v = !!(await searchAsset(token).catch(() => undefined))?.riskFlagged;
  flagCache.set(token, { at: Date.now(), v });
  return v;
}

/** Risk inputs for one trader. The flagged-token lookup is skipped in demo/dry runs without a Flash key. */
export async function riskInputs(leader: number): Promise<RiskInputs & { pnlPct: number }> {
  const pos = positionsOf(leader).filter((p) => p.qty > 1e-12);
  const total = pos.reduce((s, p) => s + p.cost, 0);
  const recent = (db.prepare("SELECT COUNT(*) AS n FROM trades WHERE leader = ? AND at >= ?").get(leader, Date.now() - 3600_000) as { n: number }).n;
  let flag = false;
  // Flash flags risky tokens; skipped in the offline demo and the in-memory test database (no network there).
  if (process.env.DEMO !== "true" && process.env.DB_PATH !== ":memory:") for (const p of pos) flag ||= await flagged(p.token);
  return {
    drawdown24h: Number(drawdown(leader).toFixed(2)),
    tradesLastHour: recent,
    topPositionPct: total > 0 ? Math.round((Math.max(...pos.map((p) => p.cost)) / total) * 100) : 0,
    riskFlaggedToken: flag,
    pnlPct: Number((await totalPnl(leader).catch(() => ({ pct: 0 }))).pct.toFixed(2)),
  };
}
export const riskOf = async (leader: number) => riskScore(await riskInputs(leader));

/** Per-trader risk inputs consumed by the CRE CopyGuard workflow (GET /guard/snapshot). */
/** When the CRE workflow last pulled a snapshot (null until the first check). */
export let lastCheckAt: number | null = null;
export const markCheck = () => (lastCheckAt = Date.now());

/** The latest price check the CRE workflow reported: Chainlink ETH/USD Data Feed vs the DEX price Flash quotes. */
export let lastOracleCheck: { oracle: number; dex: number; deviationPct: number; at: number } | null = null;
export const setOracleCheck = (c: { oracle: number; dex: number; deviationPct: number }) => (lastOracleCheck = { ...c, at: Date.now() });

export async function snapshot(): Promise<GuardSnapshot[]> {
  const leaders = db.prepare("SELECT DISTINCT t.leader AS id, u.handle AS handle FROM trades t JOIN users u ON u.id = t.leader").all() as unknown as { id: number; handle: string }[];
  const out: GuardSnapshot[] = [];
  for (const l of leaders) {
    const i = await riskInputs(l.id);
    out.push({ leader: l.id, handle: l.handle, pnlPct: i.pnlPct, drawdown24h: i.drawdown24h, tradesLastHour: i.tradesLastHour, topPositionPct: i.topPositionPct, riskFlaggedToken: i.riskFlaggedToken, risk: riskScore(i) });
  }
  return out;
}

const HALTED_VIEW = parseAbiItem("function halted(uint256 leader) view returns (bool)");
const guardChainClient = () => createPublicClient({ chain: process.env.GUARD_CHAIN === "base" ? base : baseSepolia, transport: http(process.env.GUARD_RPC) });

export interface GuardGate { halted: boolean; stale: boolean; reason?: string }

/**
 * Checked on every copy, before anyone's order is placed. The onchain CopyGuard (written only by the CRE workflow
 * through the Chainlink Forwarder) wins over the local mirror, so a lagging watcher or an edited database cannot let a
 * halted trader through. If the chain can't be read, or CRE has gone quiet for GUARD_MAX_SILENCE_MIN, the gate is
 * "stale": nothing is blocked, but auto-copies wait for the follower's approval instead of signing on their own.
 */
export async function guardGate(leader: number): Promise<GuardGate> {
  let halted = !!haltOf(leader);
  const reasons: string[] = [];
  const address = process.env.GUARD_ADDRESS as `0x${string}` | undefined;
  if (address && !halted) {
    try {
      // One eth_call per leader trade (not per follower), uncached: a halt takes effect on the very next copy.
      const onchain = await guardChainClient().readContract({ address, abi: [HALTED_VIEW], functionName: "halted", args: [BigInt(leader)] });
      if (onchain) {
        halted = true;
        haltLeader(leader, "halted onchain by CopyGuard (seen at copy time)"); // heal the local mirror
      }
    } catch {
      reasons.push("couldn't read CopyGuard onchain");
    }
  }
  const silence = Number(process.env.GUARD_MAX_SILENCE_MIN ?? (address ? 30 : 0));
  if (silence > 0) {
    const last = (db.prepare("SELECT MAX(at) AS at FROM cre_runs").get() as { at: number | null }).at;
    if (!last || Date.now() - last > silence * 60_000) reasons.push(last ? `CopyGuard hasn't reported for ${Math.round((Date.now() - last) / 60_000)} min` : "CopyGuard hasn't reported yet");
  }
  return { halted, stale: reasons.length > 0, reason: reasons.join("; ") || undefined };
}

/** When CRE last checked: this process saw a snapshot pull, or the last stored report (survives restarts). */
export const lastGuardCheck = () => Math.max(lastCheckAt ?? 0, guardHeartbeat().last ?? 0) || null;

/** Is CopyGuard alive? For the Guard page: last report and whether auto-copy is currently held. */
export function guardHeartbeat() {
  const last = (db.prepare("SELECT MAX(at) AS at FROM cre_runs").get() as { at: number | null }).at;
  const silence = Number(process.env.GUARD_MAX_SILENCE_MIN ?? (process.env.GUARD_ADDRESS ? 30 : 0));
  return { last, silence, held: silence > 0 && (!last || Date.now() - last > silence * 60_000), onchain: !!process.env.GUARD_ADDRESS };
}

const HALTED = parseAbiItem("event LeaderHalted(uint256 indexed leader, uint16 risk, uint64 checkedAt, string reason)");
const RESUMED = parseAbiItem("event LeaderResumed(uint256 indexed leader, uint16 risk, uint64 checkedAt)");

/**
 * Watch the CopyGuard contract (written by the CRE workflow through the Chainlink Forwarder)
 * and mirror its events into the local halt table, which gates every copy.
 */
export function watchCopyGuard(onChange: (leader: number, halted: boolean, reason?: string) => void) {
  const address = process.env.GUARD_ADDRESS as `0x${string}` | undefined;
  if (!address) return;
  const client = createPublicClient({ chain: process.env.GUARD_CHAIN === "base" ? base : baseSepolia, transport: http(process.env.GUARD_RPC) });
  let from: bigint | undefined;
  setInterval(async () => {
    try {
      const head = await client.getBlockNumber();
      from ??= head - 500n;
      // Public RPCs (sepolia.base.org) cap eth_getLogs at a 200-block range, so read in chunks.
      for (let start: bigint = from; start <= head; start = from) {
        const to: bigint = start + 199n < head ? start + 199n : head;
        const logs = await client.getLogs({ address, events: [HALTED, RESUMED], fromBlock: start, toBlock: to });
        for (const l of logs) {
          const leader = Number(l.args.leader);
          if (l.eventName === "LeaderHalted") {
            haltLeader(leader, (l.args as { reason?: string }).reason ?? "halted", l.transactionHash ?? undefined);
            onChange(leader, true, (l.args as { reason?: string }).reason);
          } else {
            resumeLeader(leader, l.transactionHash ?? undefined);
            onChange(leader, false);
          }
        }
        from = to + 1n;
      }
    } catch (e) {
      console.error("guard watcher:", (e as Error).message);
    }
  }, 15_000);
}
