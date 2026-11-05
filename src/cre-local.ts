import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Chainlink CRE, run from this machine until the workflows are deployed (CRE_LOCAL=true). Each workflow runs on its
 * own schedule through `cre workflow simulate --broadcast`: the same code a deployed workflow runs, reading the real
 * Chainlink feeds and Flash, and writing its reports onchain (CopyGuard pauses, the season board) on Base Sepolia.
 * Only while this server is up; once deployed, Chainlink's network runs them and this stays off.
 */

const CRE = () => process.env.CRE_BIN ?? join(homedir(), ".local/bin/cre");
const DIR = join(process.cwd(), "cre-workflow");

const JOBS: { name: string; everyMin: number; firstAfterSec: number }[] = [
  { name: "guard-workflow", everyMin: 5, firstAfterSec: 20 },
  { name: "agent-workflow", everyMin: 15, firstAfterSec: 90 },
  { name: "board-workflow", everyMin: 360, firstAfterSec: 150 },
];

const running = new Set<string>();
export const lastCreRun = new Map<string, { at: number; ok: boolean; result: string }>();

function runOnce(name: string) {
  if (running.has(name)) return;
  running.add(name);
  const args = ["workflow", "simulate", name, "--target", "staging-settings", "--non-interactive", "--trigger-index", "0", "--broadcast"];
  // A bare environment: the CRE CLI reads its own settings and keys from cre-workflow/.env, not the app's.
  const p = spawn(CRE(), args, { cwd: DIR, env: { PATH: process.env.PATH ?? "", HOME: homedir() } });
  let out = "";
  p.stdout.on("data", (d) => (out = (out + d).slice(-8000)));
  p.stderr.on("data", (d) => (out = (out + d).slice(-8000)));
  const timer = setTimeout(() => p.kill("SIGTERM"), 5 * 60_000);
  const done = (code: number | null) => {
    clearTimeout(timer);
    running.delete(name);
    const result = /Workflow Simulation Result:\s*\n?\s*"?([^\n"]*)/.exec(out)?.[1]?.trim() ?? out.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
    const ok = code === 0 && !/error|failed/i.test(result);
    lastCreRun.set(name, { at: Date.now(), ok, result });
    console.log(`CRE ${name}: ${ok ? "ok" : `failed (exit ${code})`} - ${result.slice(0, 200)}`);
  };
  p.on("close", done);
  p.on("error", (e) => { out += String(e); done(null); });
}

export function startLocalCre() {
  if (process.env.CRE_LOCAL !== "true") return;
  for (const j of JOBS) {
    setTimeout(() => {
      runOnce(j.name);
      setInterval(() => runOnce(j.name), j.everyMin * 60_000);
    }, j.firstAfterSec * 1000);
  }
  console.log(`CRE running locally: ${JOBS.map((j) => `${j.name.replace("-workflow", "")} every ${j.everyMin < 60 ? `${j.everyMin} min` : `${j.everyMin / 60} h`}`).join(", ")}`);
}
