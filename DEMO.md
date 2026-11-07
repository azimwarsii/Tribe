# Demo video script (about 2 minutes)

The submission needs onchain execution on screen. The simulated demo below covers the story, and the **Live segment** at the end shows a real Flash order and a real NFT card. Record both and cut them together.

The script says "ETF", but the app's buttons and the Director still say "trade". Button names below are written as they appear on screen.

## Setup (once)
```
npm install
npm run demo:reset        # wipes demo.db and seeds traders, squads, comments
npm run demo              # http://localhost:8787
```
Open two browser windows side by side:
- **Phone window** (375 px wide, use the browser device toolbar): http://localhost:8787/demo signs you in as `@you`.
- **Director window**: http://localhost:8787/director. It has one button per story beat.

Reset between takes with `npm run demo:reset` (stop and restart `npm run demo`).

## Beats
| # | Say | Do | What the viewer sees |
| --- | --- | --- | --- |
| 0 | "Copy trading usually means blind trust in one trade. Tribe lets you copy a whole ETF, with a safety net. They aren't regulated funds, just public recipes of tokens that you buy yourself." | Phone: Feed. | An ETF card: its mix by asset class, risk band, make-up bar, return since launch, the safety read. |
| 1 | "Anyone can build one." | Phone: Portfolio → **Creating** → **New trade**. Add tokens, set weights, pick a stop, publish. | Weights must reach 100% before **Publish trade** unlocks. |
| 2 | "@nightowl publishes an ETF." | Director: **1 · A creator publishes a trade**. | It slides into the feed. |
| 3 | "One tap copies it. Each token is its own Flash order with its own stop, in my own wallet." | Director: **2 · You copy it**, or swipe right in the Feed and **Confirm & sign**. | Portfolio → Trades, with each token's value and weight. |
| 4 | "And copying earns me an NFT card. It levels up from Base to Glitter to Holo as my return grows." | Phone: open the Copy card you just earned. | The numbered card and its progress to the next tier. |
| 5 | "When the creator changes the weights, nothing happens to my money until I say so." | Director: **3 · The creator changes the weights**. Phone: Portfolio → the ETF marked rebalance waiting. | A rebalance request with the exact sells and buys. Tap **Approve**. |
| 6 | "If a token won't fill, I'm not stuck." | Director: **4 · One token won't fill**. Phone: Portfolio → the copy marked partly filled → **Try again**. | The missing token fills. **Close this copy** sells everything instead. |
| 7 | "ETFs move by what's in them, and the cards move with them." | Director: **5 · The market pumps**. | Volatile ETFs move more than steady ones, and strong ones wear the Glitter or Holo finish. |
| 8 | "Now a creator blows up." | Director: button **6** (Guard pauses @traderx). | Guard tab: red paused card, "Proof onchain". Their ETF **All Gas** can't be copied. |
| 9 | "Guard is built to read a trader's drawdown and put the verdict in a contract. This pause is simulated for the demo." | Phone: Guard → open the incident. | The reason and the proof onchain. |
| 10 | "I can check before I copy." | Phone: the safety read on any card in the feed. | The safety read: the make-up, the stop, the spread and the creator's Guard status. |
| 11 | "And it is social." | Phone: Feed → **Top**, then an ETF's share button. | Leaderboard and share image. |
| 12 | "Guard clears them when risk falls." | Director: **7 · Guard clears @traderx**. | Guard history shows halt then clear. |

## Live segment (real onchain, about 45 seconds)
Real-money ETF copies are in testing, so this segment shows a single Flash order from `flash:check` or the trade form at `/trade/new`, not a live ETF copy.

Do this off camera first, then record.
1. **Flash, a real order.** Record the seeded app with real prices and real orders: put `LIVE_WALLETS=you:0x…,kestrel:0x…` in `.env` (Base mainnet, each about $25 USDC and $1 of ETH; kestrel's bot trades $25, or set it lower on its Your bot page), then `npm run demo:reset:live && npm run demo:live`. Either run `npm run flash:check -- --live 5` on camera (prints the approval tx, the order id, the fill and its basescan link), or place one at `/trade/new` and tap **filled onchain ↗**. Show the bracket resting on Positions, then **move the stop** (a signed Flash update, no gas).
2. **A real NFT card.** Cards aren't minted in demo mode, so use the hosted app. Open a card and follow its link to sepolia.basescan.org to show the minted token.
3. Post the video on Discord and X, tag **@DefinitiveFi**.

## What is simulated in the scripted demo
Prices (offline), fills and balances (simulated USDC), and the whole Guard pause on beats 8 to 12, including its transaction hash. The live segment replaces the prices and fills with real ones. Guard stays simulated, because the automated check isn't running.
