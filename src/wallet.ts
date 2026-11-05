import { createPublicClient, erc20Abi, http } from "viem";
import type { LocalAccount } from "viem/accounts";
import { base } from "viem/chains";
import { getUser } from "./db.js";
import type { Signer } from "./flash.js";
import { privyAccount } from "./privy.js";

/** A wallet the user signs with in their browser (MetaMask). Tribe can't sign for it, so every trade is approved there. */
export const isExternal = (user: number) => getUser(user).wallet_kind === "external";

/**
 * Who signs Flash orders, cancels and stop moves on the server for a user: their Privy wallet (Tribe as a policy-
 * limited signer) or, for demo users, the generated demo key. MetaMask users sign in the browser instead.
 */
export function signerOf(user: number): Signer {
  const u = getUser(user);
  if (u.wallet_kind === "external") throw new Error("Approve this in MetaMask: Tribe can't sign for your wallet.");
  if (u.privy_wallet_id) return privyAccount(u.privy_wallet_id, u.address) as unknown as LocalAccount;
  if (u.pk) return u.pk;
  throw new Error("No wallet is connected to this account. Connect one in Me, then Wallet.");
}

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
export interface Balances { eth: number; usdc: number; weth: number }

/** The wallet's ETH (for gas), USDC (to trade) and WETH (bought ETH) on Base, read from the chain. */
export async function balancesOf(address: `0x${string}`): Promise<Balances> {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC) });
  const [eth, usdc, weth] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
  ]);
  return { eth: Number(eth) / 1e18, usdc: Number(usdc) / 1e6, weth: Number(weth) / 1e18 };
}
