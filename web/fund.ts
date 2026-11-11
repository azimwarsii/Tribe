/** The transactions behind "Add USDC": what a user's outside wallet is asked to send to their Tribe wallet on Base. */
export const BASE_CHAIN_ID = 8453;
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const GAS_TOP_UP_ETH = "0.0002"; // network fees for hundreds of approvals on Base
export const GAS_TOP_UP_WEI = "0xb5e620f48000"; // the same amount in wei

/** A typed dollar amount in USDC's 6 decimals, or undefined if it isn't a positive amount. */
export function parseUsdc(text: string): bigint | undefined {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!m) return undefined;
  const units = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
  return units > 0n ? units : undefined;
}

/** A typed ETH amount in wei, to 6 decimal places (0.000001 ETH), or undefined if it isn't a positive amount. */
export function parseEth(text: string): bigint | undefined {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!m) return undefined;
  const wei = BigInt(m[1]) * 10n ** 18n + BigInt((m[2] ?? "").padEnd(6, "0")) * 10n ** 12n;
  return wei > 0n ? wei : undefined;
}

/** Calldata for USDC's transfer(to, amount). */
export function usdcTransferData(to: string, amount: bigint): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("That isn't a wallet address.");
  return `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${amount.toString(16).padStart(64, "0")}`;
}

export interface WalletBalance { eth: number; usdc: number }

/** What reached the wallet between two balance reads, in words, or undefined if nothing has yet. */
export function arrived(before: WalletBalance, now: WalletBalance): string | undefined {
  if (now.usdc - before.usdc >= 0.000001) return `${(now.usdc - before.usdc).toFixed(2)} USDC`;
  if (now.eth - before.eth >= 1e-9) return `${(now.eth - before.eth).toFixed(6)} ETH`;
  return undefined;
}
