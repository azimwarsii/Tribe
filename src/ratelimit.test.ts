import test from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./ratelimit.js";

const call = (mw: ReturnType<typeof rateLimit>, ip: string) => {
  let passed = false, status = 200;
  const res = { setHeader() {}, status(s: number) { status = s; return this; }, json() {} };
  mw({ ip } as never, res as never, () => { passed = true; });
  return passed ? 200 : status;
};

test("allows up to the limit per IP, then answers 429 until the window resets", async () => {
  const mw = rateLimit(3, 50);
  assert.deepEqual([1, 2, 3, 4].map(() => call(mw, "a")), [200, 200, 200, 429]);
  assert.equal(call(mw, "b"), 200, "another visitor has their own budget");
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(call(mw, "a"), 200);
});
