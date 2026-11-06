/** The transactions behind "Add USDC": what a user's outside wallet is asked to send to their Tribe wallet on Base. */
export const BASE_CHAIN_ID = 8453;
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const GAS_TOP_UP_ETH = "0.0005"; // about $1 of network fees for approvals
export const GAS_TOP_UP_WEI = "0x1c6bf52634000"; // the same amount in wei

/** A typed dollar amount in USDC's 6 decimals, or undefined if it isn't a positive amount. */
export function parseUsdc(text: string): bigint | undefined {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!m) return undefined;
  const units = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
  return units > 0n ? units : undefined;
}

/** Calldata for USDC's transfer(to, amount). */
export function usdcTransferData(to: string, amount: bigint): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("That isn't a wallet address.");
  return `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${amount.toString(16).padStart(64, "0")}`;
}
