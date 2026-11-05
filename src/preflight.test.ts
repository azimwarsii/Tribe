import test from "node:test";
import assert from "node:assert/strict";
import { isProduction, productionProblems } from "./preflight.js";

const good = {
  TRIBE_ENV: "production",
  SESSION_SECRET: "a".repeat(64),
  CRE_SHARED_SECRET: "b".repeat(64),
  PUBLIC_URL: "https://tribe.example",
  FLASH_API_KEY: "dpka_own",
  GUARD_ADDRESS: "0xa717ecfa520622f0c50649c45164cba0bf1fa7cb",
  PRIVY_APP_ID: "app",
  PRIVY_APP_SECRET: "secret",
  PRIVY_AUTH_KEY: "key",
  PRIVY_KEY_QUORUM_ID: "quorum",
};

test("a complete production config passes", () => {
  assert.deepEqual(productionProblems(good), []);
});
test("only TRIBE_ENV=production is checked", () => {
  assert.equal(isProduction({}), false);
  assert.equal(isProduction({ TRIBE_ENV: "production" }), true);
});
test("demo mode and test keys are refused", () => {
  const p = productionProblems({ ...good, DEMO: "true", LIVE_WALLET_PRIVATE_KEY: "0x1", DEPLOYER_PRIVATE_KEY: "0x2" });
  assert.equal(p.length, 3);
  assert.ok(p[0].startsWith("DEMO=true"));
});
test("weak, default or shared secrets are refused", () => {
  assert.equal(productionProblems({ ...good, SESSION_SECRET: undefined }).length, 1);
  assert.equal(productionProblems({ ...good, CRE_SHARED_SECRET: "change-me" }).length, 1);
  assert.equal(productionProblems({ ...good, SESSION_SECRET: "short" }).length, 1);
  assert.equal(productionProblems({ ...good, CRE_SHARED_SECRET: good.SESSION_SECRET }).length, 1);
});
test("local URL, public Flash key, missing Guard and a disabled dead-man's switch are refused", () => {
  const p = productionProblems({ ...good, PUBLIC_URL: "http://localhost:8787", FLASH_API_KEY: "", GUARD_ADDRESS: "", GUARD_MAX_SILENCE_MIN: "0" });
  assert.equal(p.length, 4);
});
test("production needs Privy, so no user trades from a server-held key", () => {
  assert.equal(productionProblems({ ...good, PRIVY_KEY_QUORUM_ID: undefined }).length, 1);
});
