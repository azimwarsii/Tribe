# Demo video script (about 2 minutes)

Both bounties want onchain execution on screen. The simulated demo below covers the story; the **Live segment** at the end is what shows real Flash orders and a real CopyGuard transaction. Record both and cut them together.

## Setup (once)
```
npm install
npm run demo:reset        # wipes demo.db and seeds traders, squads, comments
npm run demo              # http://localhost:8787
npm run demo:cre          # in a second terminal: one CopyGuard run (preview logic, real Chainlink + Flash prices) so Guard and Cat's read have a verdict to cite
```
Open two browser windows side by side:
- **Phone window** (375 px wide, use the browser device toolbar): http://localhost:8787/demo signs you in as `@you`.
- **Director window**: http://localhost:8787/director. It has one button per story beat.

Reset between takes with `npm run demo:reset` (stop and restart `npm run demo`).

## Beats
| # | Say | Do | What the viewer sees |
| --- | --- | --- | --- |
| 0 | "Copy trading usually means blind trust in one trade. Tribe lets you copy a whole basket, with a safety net." | Phone: Feed. | A basket card: make-up bar, return since launch, Chief's read. |
| 1 | "Anyone can build one." | Phone: Baskets → **+**. Add tokens, set weights, pick a stop, publish. | Weights must reach 100% before **Publish basket** unlocks. |
| 2 | "@nightowl publishes a basket." | Director: **1 · A creator publishes a basket**. | It slides into the feed. |
| 3 | "One tap copies it. Each token is its own Flash order with its own stop, in my own wallet." | Director: **2 · You copy it**, or swipe right in the Feed and **Confirm & sign**. | Baskets → You copy, with each token's value and weight. |
| 4 | "When the creator changes the weights, nothing happens to my money until I say so." | Director: **3 · The creator changes the weights**. Phone: Baskets. | A rebalance request with the exact sells and buys. Tap **Approve**. |
| 5 | "If a token won't fill, I'm not stuck." | Director: **4 · One token won't fill**. Phone: Baskets → the copy marked partly filled → **Try again**. | The missing token fills. **Close this copy** sells everything instead. |
| 6 | "Baskets move by what's in them." | Director: **5 · The market pumps**. | Volatile baskets move more than steady ones. |
| 7 | "Now a creator blows up." | Director: **6 · CRE Guard pauses @traderx**. | Guard tab: red paused card, "Proof onchain". Their basket **All Gas** can't be copied. |
| 8 | "Chainlink CRE read their drawdown, an AI judged the grey zone, and the verdict landed in a contract." | Phone: Guard → open the incident, tap **Ask Chief why**. | Chief explains the pause with sources. |
| 9 | "I can ask before I copy." | Phone: on a basket card, swipe up. | Chief's read on that basket: the make-up, the stop, the spread and the creator's Guard status. |
| 10 | "And it is social." | Phone: Ranks → Baskets, then a basket's share button. | Basket leaderboard and share image. |
| 11 | "Guard clears them when risk falls." | Director: **7 · Guard clears @traderx**. | Guard history shows halt then clear. |

## Live segment (real onchain, about 45 seconds)
Baskets are practice-only for now, so this segment shows single Flash orders from Ask Chief or `flash:check`, not a live basket.

Do this off camera first, then record.
1. **Flash, a real order.** Record the seeded app with real prices and real orders: put `LIVE_WALLETS=you:0x…,kestrel:0x…` in `.env` (Base mainnet, each about $25 USDC and $1 of ETH; kestrel's bot trades $25, or set it lower on its Your bot page), then `npm run demo:reset:live && npm run demo:live`. Either run `npm run flash:check -- --live 5` on camera (prints the approval tx, the order id, the fill and its basescan link), or ask Cat in the app "buy $5 ETH with 5% stop and 12% take profit" and tap **filled onchain ↗** on the feed card. Show the bracket resting on Positions, then **move the stop** (a signed Flash update, no gas).
   For a **live copy**: the leader's own order must fill before followers copy it, so fund both sides. With the wallets above, post an agent signal (`npm run cre:preview -- --post` posts one when the market qualifies, or `cre workflow simulate agent-workflow`), and @you, who follows the agent on auto, copies it from your wallet.
2. **CRE, a real simulation.** `npm run guard:deploy` (Base Sepolia). Expose the app (`cloudflared tunnel --url http://localhost:8787`) and put the URL in `cre-workflow/guard-workflow/config.staging.json`. Then `npm run cre:broadcast`. Show the CLI log (Chainlink feed vs Flash price, each trader's verdict, the tx hash), the `LeaderHalted` event on sepolia.basescan.org, and the Guard page flipping to paused with **Proof onchain ↗**. Scroll to the **Guard log**: that run, trader by trader, with which verdicts the AI decided and the tx link.
3. **CRE agent.** `cd cre-workflow` then `cre workflow simulate agent-workflow --target staging-settings`: the log shows the feed read, the decision and the signal, and the trade appears in the feed as **Run by Chainlink CRE**.
4. Post the video on Discord and X, tag **@DefinitiveFi**.

## What is simulated in the scripted demo
Prices (offline), fills and balances (simulated USDC), and the Guard transaction hash on beat 5. The live segment replaces these with real ones.
