/**
 * Basket Card tiers: every threshold lives here.
 *
 * An Original card goes by its basket's return and copiers, and needs both. A Copy card goes by that copier's own return.
 * A card keeps the highest tier it has reached, so these only ever decide upgrades.
 */

export type CardKind = "original" | "copy";
export type Tier = "base" | "glitter" | "holo";
export const TIERS: readonly Tier[] = ["base", "glitter", "holo"];

export interface Threshold { returnPct: number; copiers: number }

export const CARD_TIERS: Record<CardKind, Record<Exclude<Tier, "base">, Threshold>> = {
  original: { glitter: { returnPct: 10, copiers: 2 }, holo: { returnPct: 25, copiers: 3 } },
  copy: { glitter: { returnPct: 10, copiers: 0 }, holo: { returnPct: 25, copiers: 0 } }, // copiers don't count on a copy
};

export interface CardStats { returnPct: number; copiers: number }
export interface CardProgress { next: Tier | null; pct: number; detail: string; count: string }

const meets = (s: CardStats, t: Threshold) => s.returnPct >= t.returnPct && s.copiers >= t.copiers;
const share = (have: number, need: number) => (need > 0 ? Math.min(1, Math.max(0, have / need)) : 1);

/** The tier these numbers earn today. */
export function tierOf(kind: CardKind, s: CardStats): Tier {
  const t = CARD_TIERS[kind];
  return meets(s, t.holo) ? "holo" : meets(s, t.glitter) ? "glitter" : "base";
}

export const higherTier = (a: Tier, b: Tier): Tier => (TIERS.indexOf(a) >= TIERS.indexOf(b) ? a : b);

/** The look a basket gets in the feed: its return since launch alone, as it stands now. It can drop back, unlike a card's tier. */
export function finishOf(returnPct: number): Tier {
  const t = CARD_TIERS.original;
  return returnPct >= t.holo.returnPct ? "holo" : returnPct >= t.glitter.returnPct ? "glitter" : "base";
}

const title = (t: Tier) => t[0].toUpperCase() + t.slice(1);

/** How far a card is towards the tier above the one it holds. With two conditions, the one further behind sets the bar and the count. */
export function progressOf(kind: CardKind, held: Tier, s: CardStats): CardProgress {
  const next = TIERS[TIERS.indexOf(held) + 1] as Exclude<Tier, "base"> | undefined;
  if (!next) return { next: null, pct: 100, detail: "Top tier reached", count: "" };
  const need = CARD_TIERS[kind][next];
  const byReturn = share(s.returnPct, need.returnPct), byCopiers = share(s.copiers, need.copiers);
  const wants = need.copiers > 0 ? `${need.copiers} copiers + ${need.returnPct}%` : `+${need.returnPct}%`;
  return {
    next,
    pct: Math.floor(Math.min(byReturn, byCopiers) * 100),
    detail: `Next: ${title(next)} · ${wants}`,
    count: need.copiers > 0 && byCopiers < byReturn ? `${s.copiers}/${need.copiers}` : `${(Math.abs(s.returnPct) < 0.05 ? 0 : s.returnPct).toFixed(1).replace("-", "−")}/${need.returnPct}%`,
  };
}
