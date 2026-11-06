/**
 * Tests Tribe's wallet policy against Privy itself, because only Privy can say how its rules read a real request.
 * Creates one empty throwaway wallet under the policy and asks Privy to sign requests that must pass and must fail.
 * It only signs: nothing is broadcast, and the wallet never holds funds.
 *
 *   npm run privy:check
 */
import "dotenv/config";
import { encodeFunctionData, erc20Abi } from "viem";
import { FLASH_CONTRACT, PERMIT2, createWalletPolicy, privy, privyAccount } from "./privy.js";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OTHER = "0x000000000000000000000000000000000000dEaD";
const approve = (spender: `0x${string}`) => encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, 1n] });
const tx = { chainId: 8453, nonce: 0, gas: 60_000n, maxFeePerGas: 1_000_000n, maxPriorityFeePerGas: 1n, type: "eip1559" as const };

// Unowned, so this script can sign without a user. A real wallet's policy is owned by its user and set as a signer override.
const quorum = process.env.PRIVY_KEY_QUORUM_ID;
if (!quorum) throw new Error("Run npm run privy:setup first.");
const wallet = await privy().wallets().create({ chain_type: "ethereum", owner_id: quorum, display_name: "Tribe policy check (throwaway)" } as never);
const address = wallet.address as `0x${string}`;
const policyId = await createWalletPolicy(address);
await privy().wallets().update(wallet.id, { policy_ids: [policyId], authorization_context: { authorization_private_keys: [process.env.PRIVY_AUTH_KEY!] } } as never);
const account = privyAccount(wallet.id, address);

// The same shape Flash's quotes send: EIP712Domain listed in types and chainId as a string. Privy matches types exactly.
const order = (recipient: string) => ({
  domain: { name: "DefinitiveFlashAllowance", version: "1", chainId: "8453", verifyingContract: FLASH_CONTRACT },
  types: {
    EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
    FlashOrder: [
      { name: "swapper", type: "address" }, { name: "vault", type: "address" }, { name: "recipient", type: "address" }, { name: "fromToken", type: "address" },
      { name: "toToken", type: "address" }, { name: "fromAmount", type: "uint256" }, { name: "salt", type: "uint256" }, { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "FlashOrder" as const,
  message: { swapper: address, vault: FLASH_CONTRACT, recipient, fromToken: USDC, toToken: USDC, fromAmount: 1n, salt: 1n, deadline: 2_000_000_000n },
});

const cases: [string, boolean, () => Promise<unknown>][] = [
  ["approve Flash, no ETH", true, () => account.signTransaction({ ...tx, to: USDC, data: approve(FLASH_CONTRACT) })],
  ["approve Permit2, no ETH", true, () => account.signTransaction({ ...tx, to: USDC, data: approve(PERMIT2) })],
  ["Flash order paying this wallet", true, () => account.signTypedData(order(address) as never)],
  ["Flash stop update", true, () => account.signMessage({ message: "Definitive Flash — Update Order\nOrder: x" })],
  ["Flash cancel", true, () => account.signMessage({ message: "Definitive Flash v1 — Cancel Order\nOrder: x" })],
  ["approve call carrying ETH", false, () => account.signTransaction({ ...tx, to: OTHER, data: approve(FLASH_CONTRACT), value: 1n })],
  ["approve on another chain", false, () => account.signTransaction({ ...tx, chainId: 1, to: USDC, data: approve(FLASH_CONTRACT) })],
  ["approve for another spender", false, () => account.signTransaction({ ...tx, to: USDC, data: approve(OTHER) })],
  ["plain ETH transfer", false, () => account.signTransaction({ ...tx, to: OTHER, value: 1n })],
  ["Flash order paying someone else", false, () => account.signTypedData(order(OTHER) as never)],
  ["any other message", false, () => account.signMessage({ message: "hello" })],
];

let failed = 0;
for (const [name, allowed, run] of cases) {
  const error = await run().then(() => undefined, (e: Error) => e.message);
  const ok = allowed === !error;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${allowed ? "allow" : "refuse"}  ${name}${!ok && error ? `: ${error.slice(0, 160)}` : ""}`);
}
console.log(`Throwaway wallet ${wallet.id} (${address}) stays in the Privy dashboard, empty. Policy ${policyId} is left on it.`);
process.exit(failed ? 1 : 0);
