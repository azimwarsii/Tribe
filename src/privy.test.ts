import test from "node:test";
import assert from "node:assert/strict";
import { FLASH_CONTRACT, PERMIT2, walletPolicy } from "./privy.js";

const ADDR = "0x8aAB6863d537e47D75f2fF7Ddbbb7C5b076c4Eb8";
const p = walletPolicy(ADDR);
type Cond = { field_source: string; field: string; operator: string; value: string | string[] };
const conds = (method: string) => p.rules.filter((r) => r.method === method).flatMap((r) => r.conditions as Cond[]);

test("Flash orders must name this wallet as both swapper and recipient, in either spelling", () => {
  for (const field of ["swapper", "recipient"]) {
    const c = conds("eth_signTypedData_v4").find((x) => x.field === field)!;
    assert.deepEqual(c.value, [ADDR, ADDR.toLowerCase()]);
  }
  assert.ok(conds("eth_signTypedData_v4").some((x) => x.field === "verifyingContract" && (x.value as string[]).includes(FLASH_CONTRACT)));
});
test("approvals only to Flash or Permit2, and nothing else is allowed", () => {
  const spender = conds("eth_signTransaction").find((x) => x.field === "approve.spender")!;
  assert.deepEqual(new Set(spender.value as string[]), new Set([FLASH_CONTRACT, FLASH_CONTRACT.toLowerCase(), PERMIT2, PERMIT2.toLowerCase()]));
  assert.ok(p.rules.every((r) => r.action === "ALLOW"), "no rule may be broader than an allow-list entry");
  assert.deepEqual(new Set(p.rules.map((r) => r.method)), new Set(["eth_signTypedData_v4", "eth_signTransaction", "eth_sendTransaction", "personal_sign"]));
  assert.deepEqual(conds("personal_sign").map((x) => x.value), ["Definitive Flash v1 — Cancel Order", "Definitive Flash — Update Order"]);
});
