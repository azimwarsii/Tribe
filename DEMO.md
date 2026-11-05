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
| 0 | "Copy trading usually means blind trust. Tribe adds a safety net." | Phone: Feed. | Portfolio card, live feed, Guard badges. |
| 1 | "I follow @nightowl in ask-first mode, with a $25 cap and stop-loss required." | Phone: Me → My traders → Rules. | Copy rules per trader. |
| 1b | "Before I copy anyone new, I ask Cat." | Phone: Feed → scroll to **Cat's pick: @ember** (or tap **Ask Cat** on any card). Open **Thought for 2s**, tap **Their track record**, then **Worst case if I copy**. Tap **Copy with Flash** in the pinned bar. | Cat's read with ✓/! checks, including the **CRE CopyGuard verdict** and the **Chainlink vs DEX price**. The post stays pinned with a way back, and the copy flow opens with Cat's read on top. The daily quest "Ask Cat about a post" ticks. |
| 2 | "@nightowl opens a bracket on ETH." | Director: **1 · A trader you copy opens a bracket**. | Banner "Copy request · 60s left" on the Feed. |
| 3 | "Entry, stop and target copy together as one Flash order. Nothing signs until I approve." | Phone: tap the banner → Requests → **Approve & sign**. | Checks timeline (filled, Guard, filters, sign), then Positions with stop and target. |
| 4 | "ETH pumps." | Director: **2 · ETH pumps 4%**. | Positions PnL goes green; take-profits fill. |
| 5 | "Now a trader I copy blows up." | Director: **3 · CRE Guard pauses @traderx**. | Guard tab: red paused card, "Proof onchain", copy blocked. |
| 6 | "Chainlink CRE read their drawdown, an AI judged the grey zone, and the verdict landed in a contract. My copy was blocked before it filled." | Phone: Guard → open the incident, tap **Ask Cat why**. | Cat explains the pause with sources. |
| 7 | "I can talk to trade too." | Phone: Ask Cat → tap the TRADE prompt → open **Thought for 2s**, tap **Tighter stop, 3%** → **Confirm & sign**. | Streamed reply, checks, ladder card that updates, then "Landed onchain". |
| 7b | "Cat has a voice and a memory." | Phone: mic icon → say "buy fifty dollars of ETH with a five percent stop", then "confirm"; back out → Cat's memory → forget one item. | Orb states (listening, thinking, speaking, signed), and the memory screen. Use Chrome. |
| 8 | "And it is social." | Phone: Ranks → Squads, then Share PnL. | Squad leaderboard, PNG share card, Share on X (tag @DefinitiveFi). |
| 8b | "Anyone can run a bot. @kestrel's bot runs on Chainlink CRE: it reads the Chainlink price feed, checks Flash's DEX price against it, and only trades when they agree. Its trades post under kestrel's own name, tagged Bot." | Phone: Feed, @kestrel's card tagged **Bot**. Tap @kestrel: profile with photo, bio, **Follow**, the bot banner, **Manual vs Bot** record, then **Portfolio** and **Trades → Bot**. Then Me → **Your bot** and switch yours on. | Bot and Manual tags in the feed, the bot's one-line reason, a profile and portfolio, your own bot settings. |
| 8c | "Guard doesn't just log events: Tribe reads the CopyGuard contract right before every copy. And if CRE ever goes quiet, nothing auto-signs." | Phone: Guard → the **CopyGuard heartbeat** row, then **?** → step 4 "Enforce". | Heartbeat "Live · last CRE report 2m ago"; the fail-safe explained. (`src/guard-gate.test.ts` shows it against the real contract.) |
| 9 | "Guard clears them when risk falls." | Director: **4 · Guard clears @traderx**. | Guard history shows halt then clear. |

## Live segment (real onchain, about 45 seconds)
Do this off camera first, then record.
1. **Flash, a real order.** Record the seeded app with real prices and real orders: put `LIVE_WALLETS=you:0x…,kestrel:0x…` in `.env` (Base mainnet, each about $25 USDC and $1 of ETH; kestrel's bot trades $25, or set it lower on its Your bot page), then `npm run demo:reset:live && npm run demo:live`. Either run `npm run flash:check -- --live 5` on camera (prints the approval tx, the order id, the fill and its basescan link), or ask Cat in the app "buy $5 ETH with 5% stop and 12% take profit" and tap **filled onchain ↗** on the feed card. Show the bracket resting on Positions, then **move the stop** (a signed Flash update, no gas).
   For a **live copy**: the leader's own order must fill before followers copy it, so fund both sides. With the wallets above, post an agent signal (`npm run cre:preview -- --post` posts one when the market qualifies, or `cre workflow simulate agent-workflow`), and @you, who follows the agent on auto, copies it from your wallet.
2. **CRE, a real simulation.** `npm run guard:deploy` (Base Sepolia). Expose the app (`cloudflared tunnel --url http://localhost:8787`) and put the URL in `cre-workflow/guard-workflow/config.staging.json`. Then `npm run cre:broadcast`. Show the CLI log (Chainlink feed vs Flash price, each trader's verdict, the tx hash), the `LeaderHalted` event on sepolia.basescan.org, and the Guard page flipping to paused with **Proof onchain ↗**. Scroll to the **Guard log**: that run, trader by trader, with which verdicts the AI decided and the tx link.
3. **CRE agent.** `cd cre-workflow` then `cre workflow simulate agent-workflow --target staging-settings`: the log shows the feed read, the decision and the signal, and the trade appears in the feed as **Run by Chainlink CRE**.
4. Post the video on Discord and X, tag **@DefinitiveFi**.

## What is simulated in the scripted demo
Prices (offline), fills and balances (simulated USDC), and the Guard transaction hash on beat 5. The live segment replaces these with real ones.
