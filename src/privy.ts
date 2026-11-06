/**
 * Privy embedded wallets. Each user owns their wallet; Tribe's server is added as a signer limited by a policy that
 * only allows what Tribe needs to trade on Flash for that user:
 *   - Flash orders (EIP-712 FlashOrder on the Flash contract) whose swapper and recipient are the user's own wallet,
 *   - Permit2 permits whose spender is the Flash contract,
 *   - ERC-20 approve() calls on Base, carrying no ETH, whose spender is the Flash contract or Permit2,
 *   - Flash's plain-text cancel and stop-update messages.
 * Anything else (a transfer out, an order paying someone else, any other contract) is refused by Privy, so even a
 * compromised Tribe server cannot move a user's funds away. The private key never leaves Privy.
 */
import { PrivyClient, type AuthorizationContext } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";

export const FLASH_CONTRACT = "0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78";
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const BASE_CHAIN_ID = "8453";

let client: PrivyClient | undefined;
export const privyEnabled = () => !!(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
export function privy(): PrivyClient {
  if (!privyEnabled()) throw new Error("Privy is not configured: set PRIVY_APP_ID and PRIVY_APP_SECRET.");
  client ??= new PrivyClient({ appId: process.env.PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });
  return client;
}

/** Tribe's own signature on wallet requests (its authorization key, registered by npm run privy:setup). */
export const tribeAuth = (): AuthorizationContext => {
  if (!process.env.PRIVY_AUTH_KEY) throw new Error("Privy signer is not set up: run npm run privy:setup.");
  return { authorization_private_keys: [process.env.PRIVY_AUTH_KEY] };
};

/** Privy compares strings exactly; Flash sends checksummed addresses, decoders may lowercase. Accept both. */
const spellings = (...addrs: string[]) => [...new Set(addrs.flatMap((a) => [a, a.toLowerCase()]))];

const FLASH_ORDER_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
  ],
  FlashOrder: [
    { name: "swapper", type: "address" }, { name: "vault", type: "address" }, { name: "recipient", type: "address" }, { name: "fromToken", type: "address" },
    { name: "toToken", type: "address" }, { name: "fromAmount", type: "uint256" }, { name: "salt", type: "uint256" }, { name: "deadline", type: "uint256" },
  ],
};
const PERMIT_TYPES = {
  EIP712Domain: [{ name: "name", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
  PermitDetails: [{ name: "token", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }, { name: "nonce", type: "uint48" }],
  PermitSingle: [{ name: "details", type: "PermitDetails" }, { name: "spender", type: "address" }, { name: "sigDeadline", type: "uint256" }],
};
const APPROVE_ABI = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }];

/** The policy for one user's wallet: Flash trading for that wallet and nothing else. */
export function walletPolicy(address: string) {
  const domain = (contract: string) => [
    { field_source: "ethereum_typed_data_domain", field: "chainId", operator: "eq", value: BASE_CHAIN_ID },
    { field_source: "ethereum_typed_data_domain", field: "verifyingContract", operator: "in", value: spellings(contract) },
  ];
  const order = (field: string) => ({ field_source: "ethereum_typed_data_message", typed_data: { primary_type: "FlashOrder", types: FLASH_ORDER_TYPES }, field, operator: "in", value: spellings(address) });
  const approve = [
    // Without these, approve() calldata sent to any address could carry the wallet's ETH with it.
    { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: BASE_CHAIN_ID },
    { field_source: "ethereum_transaction", field: "value", operator: "eq", value: "0" },
    { field_source: "ethereum_calldata", abi: APPROVE_ABI, field: "function_name", operator: "eq", value: "approve" },
    { field_source: "ethereum_calldata", abi: APPROVE_ABI, field: "approve.spender", operator: "in", value: spellings(FLASH_CONTRACT, PERMIT2) },
  ];
  return {
    version: "1.0" as const,
    name: `Tribe trading for ${address.toLowerCase()}`,
    chain_type: "ethereum" as const,
    rules: [
      { name: "Flash orders paying this wallet", method: "eth_signTypedData_v4", action: "ALLOW", conditions: [...domain(FLASH_CONTRACT), order("swapper"), order("recipient")] },
      {
        name: "Permit2 permits for Flash", method: "eth_signTypedData_v4", action: "ALLOW",
        conditions: [...domain(PERMIT2), { field_source: "ethereum_typed_data_message", typed_data: { primary_type: "PermitSingle", types: PERMIT_TYPES }, field: "spender", operator: "in", value: spellings(FLASH_CONTRACT) }],
      },
      { name: "Approvals for Flash or Permit2 (signed)", method: "eth_signTransaction", action: "ALLOW", conditions: approve },
      { name: "Approvals for Flash or Permit2 (sent)", method: "eth_sendTransaction", action: "ALLOW", conditions: approve },
      { name: "Flash cancels", method: "personal_sign", action: "ALLOW", conditions: [{ field_source: "message", field: "content", operator: "starts_with", value: "Definitive Flash v1 — Cancel Order" }] },
      { name: "Flash stop updates", method: "personal_sign", action: "ALLOW", conditions: [{ field_source: "message", field: "content", operator: "starts_with", value: "Definitive Flash — Update Order" }] },
    ],
  };
}

/** Create the policy for a wallet. Owned by the user when given, so Tribe can't loosen it later. */
export async function createWalletPolicy(address: string, ownerUserId?: string): Promise<string> {
  const body = { ...walletPolicy(address), ...(ownerUserId ? { owner: { user_id: ownerUserId } } : {}) };
  const p = await privy().policies().create(body as never);
  return p.id;
}

/** Is Tribe a signer on this wallet, limited by exactly this policy? An unlimited signer doesn't count. */
export const tribeSignerActive = (wallet: { additional_signers?: { signer_id: string; override_policy_ids?: string[] }[] }, quorumId: string, policyId: string) =>
  (wallet.additional_signers ?? []).some((s) => s.signer_id === quorumId && s.override_policy_ids?.length === 1 && s.override_policy_ids[0] === policyId);

/** A viem account that signs through Privy as Tribe's signer on the user's wallet (subject to the wallet's policy). */
export const privyAccount = (walletId: string, address: `0x${string}`) => createViemAccount(privy(), { walletId, address, authorizationContext: tribeAuth() });

/** The Privy user behind a browser access token, or throws. */
export async function verifyPrivyToken(accessToken: string): Promise<string> {
  return (await privy().utils().auth().verifyAccessToken(accessToken)).user_id;
}
