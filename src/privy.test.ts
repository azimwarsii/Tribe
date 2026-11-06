import test from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, erc20Abi } from "viem";
import { GAS_TOP_UP_WEI, parseUsdc, usdcTransferData } from "../web/fund.js";
import { FLASH_CONTRACT, PERMIT2, tribeSignerActive, walletPolicy } from "./privy.js";

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

test("approvals carry no ETH and stay on Base, so approve() calldata can't smuggle a transfer", () => {
  for (const method of ["eth_signTransaction", "eth_sendTransaction"]) {
    const tx = conds(method).filter((x) => x.field_source === "ethereum_transaction");
    assert.deepEqual(tx.map((x) => [x.field, x.operator, x.value]), [["chain_id", "eq", "8453"], ["value", "eq", "0"]]);
  }
});
test("Tribe only counts as enrolled when it is limited by the wallet's own policy", () => {
  assert.equal(tribeSignerActive({ additional_signers: [{ signer_id: "q", override_policy_ids: ["p"] }] }, "q", "p"), true);
  assert.equal(tribeSignerActive({ additional_signers: [{ signer_id: "q" }] }, "q", "p"), false, "a signer with no policy is unlimited");
  assert.equal(tribeSignerActive({ additional_signers: [{ signer_id: "q", override_policy_ids: ["other"] }] }, "q", "p"), false);
  assert.equal(tribeSignerActive({ additional_signers: [{ signer_id: "someone", override_policy_ids: ["p"] }] }, "q", "p"), false);
  assert.equal(tribeSignerActive({}, "q", "p"), false);
});

test("funding: typed amounts become exact USDC units, and anything unclear sends nothing", () => {
  assert.equal(parseUsdc("25"), 25_000_000n);
  assert.equal(parseUsdc(" 0.5 "), 500_000n);
  assert.equal(parseUsdc("1.000001"), 1_000_001n);
  for (const bad of ["", "0", "0.00", "-1", "1.2345678", "1e3", "abc", "1,000"]) assert.equal(parseUsdc(bad), undefined, bad);
  assert.equal(BigInt(GAS_TOP_UP_WEI), 500_000_000_000_000n, "the ETH top-up is 0.0005 ETH");
});
test("funding: the transfer pays the given wallet the exact amount", () => {
  const data = usdcTransferData(ADDR, 25_000_000n);
  assert.deepEqual(decodeFunctionData({ abi: erc20Abi, data: data as `0x${string}` }), { functionName: "transfer", args: [ADDR, 25_000_000n] });
  assert.throws(() => usdcTransferData("not-an-address", 1n));
});
