import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { db } from "./db.js";
import type { Tier } from "./card-tiers.js";

/**
 * Basket Cards onchain: Tribe mints each card to its holder on Base Sepolia and pays the gas, then records tier upgrades.
 * Cards are ordinary transferable ERC-721s (contracts/BasketCards.sol), so a card may have left the wallet it was minted
 * to: everything here goes by token id, and Tribe's own record of who earned a card doesn't follow a transfer.
 *
 * Off without BASKET_CARDS_ADDRESS and DEPLOYER_PRIVATE_KEY, and in demo mode: token ids are card ids, so a second
 * database on the same contract would collide with the first.
 */
const ABI = parseAbi([
  "function exists(uint256 tokenId) view returns (bool)",
  "function tierOf(uint256 tokenId) view returns (uint8)",
  "function mint(address to, uint256 tokenId, uint8 tier)",
  "function setTier(uint256 tokenId, uint8 tier)",
]);
const TIER_NUMBER: Record<Tier, number> = { base: 0, glitter: 1, holo: 2 };

export interface CardChain {
  read(id: number): Promise<{ exists: boolean; tier: number }>;
  mint(to: `0x${string}`, id: number, tier: number): Promise<string>;
  setTier(id: number, tier: number): Promise<string>;
}

export const cardChainOn = () => !!(process.env.BASKET_CARDS_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY) && process.env.DEMO !== "true";
/** A minted card's page on the block explorer. */
export const cardExplorerUrl = (id: number) => `https://sepolia.basescan.org/nft/${process.env.BASKET_CARDS_ADDRESS}/${id}`;

function liveChain(): CardChain {
  const address = process.env.BASKET_CARDS_ADDRESS as `0x${string}`;
  const pk = process.env.DEPLOYER_PRIVATE_KEY!;
  const transport = http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org");
  const pub = createPublicClient({ chain: baseSepolia, transport });
  const wallet = createWalletClient({ account: privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`), chain: baseSepolia, transport });
  const sent = async (hash: `0x${string}`) => {
    const r = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (r.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
    return hash;
  };
  return {
    read: async (id) => {
      const exists = await pub.readContract({ address, abi: ABI, functionName: "exists", args: [BigInt(id)] });
      return { exists, tier: exists ? await pub.readContract({ address, abi: ABI, functionName: "tierOf", args: [BigInt(id)] }) : 0 };
    },
    mint: async (to, id, tier) => sent(await wallet.writeContract({ address, abi: ABI, functionName: "mint", args: [to, BigInt(id), tier] })),
    setTier: async (id, tier) => sent(await wallet.writeContract({ address, abi: ABI, functionName: "setTier", args: [BigInt(id), tier] })),
  };
}

let running = false;

/**
 * Mint new cards and record upgrades. It reads the chain before each write, so a crash between a transaction and
 * saving it is repaired on the next pass rather than sent twice. One card failing doesn't stop the others.
 */
export async function syncCards(chain?: CardChain) {
  if (!chain && !cardChainOn()) return;
  if (running) return; // one sender at a time, or transactions would fight over the nonce
  running = true;
  try {
    const c = chain ?? liveChain();
    const rows = db.prepare(`SELECT k.id, k.tier, k.chain_tx, u.address FROM basket_cards k JOIN users u ON u.id = k.owner
      WHERE (k.chain_tx IS NULL OR k.chain_tier IS NOT k.tier) AND u.handle NOT LIKE 'deleted\\_%' ESCAPE '\\' ORDER BY k.id LIMIT 25`).all() as { id: number; tier: Tier; chain_tx: string | null; address: `0x${string}` }[];
    for (const row of rows) {
      try {
        const want = TIER_NUMBER[row.tier];
        const now = await c.read(row.id);
        let tx = row.chain_tx;
        if (!now.exists) tx = await c.mint(row.address, row.id, want);
        else if (now.tier < want) await c.setTier(row.id, want);
        // "unknown": the card is onchain, but a crash lost which transaction minted it.
        db.prepare("UPDATE basket_cards SET chain_tx = ?, chain_to = COALESCE(chain_to, ?), chain_tier = ? WHERE id = ?").run(tx ?? "unknown", row.address, row.tier, row.id);
        console.log(`${new Date().toISOString()} card ${row.id} onchain at tier ${row.tier}`);
      } catch (e) {
        console.error(`card ${row.id} sync failed:`, (e as Error).message.slice(0, 200));
      }
    }
  } finally {
    running = false;
  }
}
