# Tribe plan

Last updated 2026-11-07. This replaces the original hackathon plan, which is still in git history.

## What Tribe is
Tribe is a social trading app where anyone can build their own version of a crypto ETF and anyone else can copy it in one tap. Every ETF earns NFT cards that level up with performance.

"ETF" is shorthand for a ready-made mix of assets. These aren't regulated ETFs: there's no fund, no shares and no fund manager. Each one is a public recipe of tokens and weights, and a copier buys the tokens and holds them in their own wallet. In the code the same thing is called a basket or a trade (`src/baskets.ts`, `contracts/BasketCards.sol`).

## Where things stand

### Built
- **ETFs:** 1 to 10 tokens with target weights, a stop and a target. Creators publish by buying. Each ETF shows its asset mix, a risk band and rule-based safety checks. Its record is an index that starts at 100.
- **Copying:** one tap, one Flash order per token at its weight, within the user's own limits. Partial fills can be retried or closed.
- **Versions:** new weights make a new version, and every copier approves the exact buys and sells.
- **Cards:** Original and numbered Copy cards, minted as transferable ERC-721s on Base Sepolia with Tribe paying the gas. Tiers go Base, Glitter, Holo and never drop.
- **Safety:** Tribe reads trader verdicts from `contracts/CopyGuard.sol` right before each copy. The automated check that writes those verdicts isn't running yet, so nobody gets paused on the live app and auto-copies wait for approval.
- **Social:** profiles, feed, leaderboards, squads, streaks, quests and share cards.
- **Delivery:** mobile-first PWA, hosted on Railway.

### Deliberately limited
- Real-money copies are capped at $25 per copy (`BASKET_LIVE_MAX_USD`).
- Rebalancing runs in practice mode only.
- Card thresholds are low for the demo: Glitter is +10%, Holo is +25%, and Original cards also need 2 and 3 copiers. The design file asks for far more copiers.
- Ask Chief is parked. The files remain, but nothing calls them.

### Still to do
- [ ] Run the Privy browser enrollment flow end to end.
- [ ] Get an automated risk check running so CopyGuard receives verdicts.
- [ ] Get a legal review before any wider launch, including the use of the word "ETF".
- [ ] Turn on live rebalancing.
- [ ] Give cards a dedicated minter wallet. Local and hosted share one today, so nonces can clash, and mainnet needs its own key anyway.
- [ ] Upgrade Railway before the trial ends, or the volume holding the database is deleted.

## Future approach: collectible cards
Today a card has one thing that varies: its tier. The goal is to make cards worth collecting and showing off for their own sake, the way people collect trading cards and game skins. No two cards should look quite alike, some should be rare, and people should want to trade them.

We're borrowing mechanics only. Pokémon cards show how sets, holo finishes and first editions drive collecting. CS2 skins show how wear, pattern seeds and trade-ups make every item unique. All names, art and styles stay Tribe's own.

### What makes a card
Each card combines six layers. Tier is the only one that exists today.

| Layer | How it's set | Changes later? | Inspired by |
| --- | --- | --- | --- |
| **Tier** | Earned through performance: Base, Glitter, Holo, then the unbuilt Full Art | Moves up only | Holo finishes |
| **Rarity** | Rolled at mint | No | Card rarity symbols |
| **Style** | The ETF's make-up: frame art for Major, Stocks, Altcoin and Meme, colored by risk band | No | Card types |
| **Pattern** | A random seed at mint that shifts the art, with a few rare seeds | No | CS2 pattern seeds |
| **Condition** | How the position was managed, fixed when the copy closes | Once | CS2 wear |
| **Set and edition** | The season it was minted in, its number, and a First Edition stamp for the earliest copiers | No | First editions, seasonal sets |

Tier rewards results and rarity rewards luck, so a Legendary Base and a Common Holo are both worth having. The most valuable cards combine several layers, such as a Legendary Holo with a rare pattern and a First Edition stamp.

### Rarity odds
Starting points, to be tuned:

| Rarity | Odds |
| --- | --- |
| Common | 60% |
| Uncommon | 25% |
| Rare | 10% |
| Epic | 4% |
| Legendary | 1% |

### Collecting and trading
- **Card book:** a page per season showing what you own and what's missing, with rewards for finishing a set.
- **Profile showcase:** pin your best cards to your public profile.
- **Trade-ups:** burn several cards of one rarity for one card of the next rarity up.
- **Marketplace:** list and buy cards in the app, with a royalty to Tribe and the ETF's creator. Cards already work on outside marketplaces because they're standard ERC-721s.
- **Reveal moment:** a flip animation when a card unlocks, with a bigger effect for rare pulls.

### Design rules
- **Reward good habits, not volume.** Odds must not rise with trade size or trade count, or the cards would push people to overtrade. Condition should reward using stops and staying within limits.
- **No paid packs for now.** Cards are earned by creating or copying, never bought as random packs. Paid randomness can count as gambling, so it needs the legal review first.
- **Provably fair rolls.** Rarity and pattern need randomness that users can verify and Tribe can't steer, such as commit-reveal or an onchain randomness service.
- **Never imply returns.** Cards are collectibles. Nothing should suggest a card pays out or tracks a share of an ETF.

### Build order
1. **Card art system:** design the frames, finishes and patterns as layers the SVG renderer can combine. Finish the Full Art tier from the design file.
2. **New contract:** add rarity, seed, set and condition. `BasketCards.sol` stores only a tier. Existing testnet cards stay as a Genesis set.
3. **Fair rolls:** add randomness at mint and show the proof on each card's page.
4. **Season one:** launch the first set, with the card book, First Edition stamps and the reveal animation.
5. **Condition:** calculate it when a copy closes and write it onchain.
6. **Trade-ups and marketplace:** build these once enough cards are in circulation.
7. **Mainnet:** move after the legal review, with the dedicated minter wallet in place.

### Open questions
- Which chain should cards live on for mainnet?
- Should a card's tier keep following its ETF after the card is sold?
- How many cards belong in a season, and how long does a season last?
- What should Condition be measured on: stop use, worst drawdown, or both?
