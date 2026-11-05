/**
 * Production config check. With TRIBE_ENV=production the app refuses to start on a config that would be unsafe
 * with real users: demo mode, test wallet keys, weak or missing secrets, a local URL, or no onchain Guard.
 */
type Env = Record<string, string | undefined>;

const WEAK_SECRETS = new Set(["", "change-me", "demo", "dev-secret", "secret", "test"]);
const weak = (v: string | undefined) => WEAK_SECRETS.has(v ?? "") || (v ?? "").length < 32;

export const isProduction = (env: Env = process.env) => env.TRIBE_ENV === "production";

/** Everything wrong with a production config, as plain sentences. Empty = safe to start. */
export function productionProblems(env: Env): string[] {
  const out: string[] = [];
  if (env.DEMO === "true") out.push("DEMO=true: the /demo sign-in, director and test funds would be open to anyone");
  if (env.DECK_LOOP === "true") out.push("DECK_LOOP=true is a testing option");
  if (env.ALLOW_PLAIN_SIGNUP === "1") out.push("ALLOW_PLAIN_SIGNUP=1 is a testing option: accounts would be created without a wallet");
  for (const k of ["LIVE_WALLET_PRIVATE_KEY", "LIVE_WALLETS", "DEPLOYER_PRIVATE_KEY"]) {
    if (env[k]) out.push(`${k} is set: test and deployer keys must never be on the production server`);
  }
  if (weak(env.SESSION_SECRET)) out.push("SESSION_SECRET must be a random value of at least 32 characters (openssl rand -hex 32)");
  if (weak(env.CRE_SHARED_SECRET)) out.push("CRE_SHARED_SECRET must be a random value of at least 32 characters (openssl rand -hex 32)");
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.CRE_SHARED_SECRET) out.push("SESSION_SECRET and CRE_SHARED_SECRET must differ");
  if (!(env.PUBLIC_URL ?? "").startsWith("https://")) out.push("PUBLIC_URL must be the public https:// address");
  if (!env.FLASH_API_KEY) out.push("FLASH_API_KEY is empty: orders would use Flash's shared public key and pay the fee to someone else");
  if (!env.GUARD_ADDRESS) out.push("GUARD_ADDRESS is empty: copies would not be checked against CopyGuard onchain");
  if (env.GUARD_MAX_SILENCE_MIN === "0") out.push("GUARD_MAX_SILENCE_MIN=0 turns off the dead-man's switch");
  if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET || !env.PRIVY_AUTH_KEY || !env.PRIVY_KEY_QUORUM_ID) {
    out.push("Privy isn't fully set up (PRIVY_APP_ID, PRIVY_APP_SECRET, then npm run privy:setup): users would trade from server-held keys");
  }
  return out;
}

/** Exit before listening if a production config is unsafe. */
export function assertSafeConfig(env: Env = process.env) {
  if (!isProduction(env)) return;
  const problems = productionProblems(env);
  if (!problems.length) return;
  console.error(`Refusing to start in production:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
