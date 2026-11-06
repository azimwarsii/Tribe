import { basketById, basketView, copyById, copyValue, navOf, navSince, versionOf } from "./baskets.js";
import { cardExplorerUrl } from "./card-chain.js";
import { higherTier, progressOf, tierOf, type CardKind, type CardProgress, type Tier } from "./card-tiers.js";
import { db } from "./db.js";
import { isDry } from "./tracker.js";

/**
 * Basket Cards: a collectible for making or copying a basket, marked as practice when its fills were simulated. Each is
 * an app record first, then minted as a transferable ERC-721 on Base Sepolia (see card-chain.ts).
 *
 * Rows are written by `mintOriginalCard` and `mintCopyCard` in db.ts. The Original is edition 0; copies count up from 1, one
 * card per copy, so someone who closes and copies again holds two. The numbers on a card are worked out when it's read;
 * only the tier is stored, and it only moves up.
 */

export interface CardRow { id: number; basket: number; owner: number; kind: CardKind; copy_id: number | null; edition: number; tier: Tier; tier_at: number | null; at: number; chain_tx: string | null }
export interface CardView {
  id: number; kind: CardKind; edition: number; editionLabel: string; tier: Tier; basket: number; name: string; handle: string;
  weights: { symbol: string; weight: number }[]; returnPct: number; copiers: number; days: number; chart: number[]; progress: CardProgress;
  practice: boolean; // simulated fills, not real orders
  onchain?: string; // the minted NFT's explorer page
}

const DAY = 86400e3;

export const cardById = (id: number) => db.prepare("SELECT * FROM basket_cards WHERE id = ?").get(id) as unknown as CardRow | undefined;
/** Everything someone holds, newest first. */
export const cardsOf = (owner: number) => db.prepare("SELECT k.* FROM basket_cards k LEFT JOIN basket_copies c ON c.id = k.copy_id WHERE k.owner = ? AND (c.status IS NULL OR c.status != 'failed') ORDER BY k.id DESC").all(owner) as unknown as CardRow[];
/** Their card for one basket: the latest, if they copied it more than once. */
export const cardFor = (owner: number, basket: number) => db.prepare("SELECT * FROM basket_cards WHERE owner = ? AND basket = ? ORDER BY id DESC LIMIT 1").get(owner, basket) as unknown as CardRow | undefined;

/** What the page needs to show a card being unlocked, right after the trade that earned it. */
export const unlockOf = (row: CardRow | undefined, basket: number) =>
  row ? { card: row.id, label: row.kind === "original" ? "Original" : `Copy #${row.edition}`, href: `/b/${basket}#yours` } : undefined;
/** The card a copy earned. */
export const cardOfCopy = (copyId: number) => db.prepare("SELECT * FROM basket_cards WHERE copy_id = ?").get(copyId) as unknown as CardRow | undefined;

/** A card as it stands now. Reading it also applies any upgrade it has earned. */
export async function cardView(row: CardRow): Promise<CardView | undefined> {
  const b = await basketView(row.basket);
  if (!b) return undefined;
  const shared = { id: row.id, kind: row.kind, edition: row.edition, basket: row.basket, name: b.name, handle: b.handle, copiers: b.copiers };
  let view: Omit<CardView, "tier" | "progress" | "practice">;
  let upgrades = true;
  if (row.kind === "original") {
    view = { ...shared, editionLabel: "Original", weights: b.weights, returnPct: b.returnPct, days: Math.floor((Date.now() - b.at) / DAY), chart: [...navSince(row.basket, b.at), b.nav] };
    upgrades = b.status === "live"; // nobody can copy a retired trade, so its Original stays where it got to
  } else {
    const c = copyById(row.copy_id!);
    if (!c) return undefined;
    const value = await copyValue(c.id);
    const end = c.closed_at ?? Date.now();
    const chart = navSince(row.basket, c.at, end);
    // A closed copy's return is final: value counts only what it sold for, so it can still earn its last upgrade.
    view = { ...shared, editionLabel: `Copy #${row.edition}`, weights: versionOf(row.basket, c.version).weights, returnPct: value.pnlPct, days: Math.floor((end - c.at) / DAY), chart: c.closed_at ? chart : [...chart, b.nav] };
  }
  let tier = row.tier;
  if (upgrades) {
    const earned = higherTier(row.tier, tierOf(row.kind, view));
    if (earned !== row.tier) {
      db.prepare("UPDATE basket_cards SET tier = ?, tier_at = ? WHERE id = ?").run(earned, Date.now(), row.id);
      tier = earned;
    }
  }
  // Real only with a real order behind it, whatever mode the app runs in now. An Original counts its basket's copies.
  const copies = row.copy_id !== null ? "l.copy_id = ?" : "l.copy_id IN (SELECT id FROM basket_copies WHERE basket = ?)";
  const practice = isDry() || !db.prepare(`SELECT 1 FROM orders o JOIN basket_legs l ON o.trade_id = -l.id WHERE ${copies} AND o.sim = 0 LIMIT 1`).get(row.copy_id ?? row.basket);
  return { ...view, tier, practice, progress: progressOf(row.kind, tier, view), ...(row.chain_tx ? { onchain: cardExplorerUrl(row.id) } : {}) };
}

/** Check every card that can still move up. Runs after each index snapshot. */
export async function refreshCards() {
  for (const row of db.prepare("SELECT * FROM basket_cards WHERE tier != 'holo'").all() as unknown as CardRow[]) await cardView(row);
}

/** The card's public metadata, in the shape ERC-721 marketplaces read. No handle or dollar amount: a card link is open to anyone. */
export function cardMetadata(v: CardView, origin: string) {
  return {
    name: `${v.name} · ${v.editionLabel}`,
    description: `A Tribe Trading Card for ${v.name}. ${v.practice ? "Practice mode: returns come from simulated fills." : "Real orders on Base."} ${v.onchain ? "Minted on Base Sepolia." : "Not minted onchain yet."}`,
    image: `${origin}/card/${v.id}.svg`,
    external_url: `${origin}/b/${v.basket}`,
    attributes: [
      { trait_type: "Tier", value: v.tier.toUpperCase() },
      { trait_type: "Kind", value: v.kind === "original" ? "Original" : "Copy" },
      { trait_type: "Edition", value: v.edition, display_type: "number" },
      { trait_type: "Return", value: Number(v.returnPct.toFixed(2)), display_type: "number" },
      { trait_type: "Copiers", value: v.copiers, display_type: "number" },
      { trait_type: "Days", value: v.days, display_type: "number" },
      { trait_type: "Mode", value: v.practice ? "Practice" : "Live" },
    ],
  };
}
