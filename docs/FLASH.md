# How Tribe uses Definitive Flash

Flash has no copy-trading endpoint. It provides building blocks: quote, sign, order, watch, cancel and update. Tribe
builds copy trading from them. When a trader places a Flash order, Tribe makes a separate Flash order for each
follower: it quotes it, the follower's wallet signs it, and Tribe submits it from the follower's own address. Money
stays in each wallet until execution, and every execution is atomic: it fills within price protection or reverts.

`npm run flash:check` checks all of this against the live API with an empty wallet. It quotes, signs and submits all
9 order shapes, then exercises batch cancel, order listing and the orders stream. Flash accepts each request and
refuses it only for the empty balance. `npm run flash:check -- --live 5` places a real $5 bracketed buy.

## Every Flash feature, and what Tribe does with it

**Order types**

| Flash feature | How Tribe uses it | Where |
|---|---|---|
| `market` order | Every plain buy and sell, for leaders and followers. Ask Cat ("buy $50 ETH") and swipe-to-copy produce these. | `src/flash.ts` `quoteBody`, `placeOrder` |
| `maxSlippage` | Each user's slippage setting (0.3% / 0.5% / 1%) is sent on market orders. | Settings → Copying |
| `limit` order (`limitNotionalPrice`) | "limit ETH 50 1800" from chat, and the chase-limit copy (below) | `src/parse.ts`, `src/copy.ts` `chaseGuard` |
| `expireTime` (good-til-time) | Chase-limit copies are good for 30 minutes, so a copy never rests forever at a stale price. It is sent on the quote only and never echoed on submit, which Flash requires. | `quoteBody` / `submitEcho` |
| `stop` (breakout buy) | "stopbuy ETH 50 2600" | `src/parse.ts` |
| `stop-loss`, `take-profit` | Standalone protective sells. A protective sell waits in Tribe until the entry has filled and the tokens are held. | `src/tracker.ts` |
| `bracket` (two opposite triggers) | Standalone take-profit plus stop-loss on a held position. It is copied only to followers who hold the token. | `src/tracker.ts` |
| `twap` (`durationSeconds`, `twapBucketCount`) | "twap ETH 120 1800 6". Each slice is applied to the position as it fills. | `src/tracker.ts` `applyOrderInfo` |
| **Attached bracket** (entry + take-profit + stop, two signatures, one submit) | Tribe's default entry. The leader's stop and target are copied as one Flash order, and each follower's protection is sized from their own fill. | `placeOrder`, `bracketFor` |

**Attached bracket lifecycle**

| Flash feature | How Tribe uses it | Where |
|---|---|---|
| `pending_activation` → `active`, `bracketOrderId`, `signedMaxFromAmount` | Tribe tracks the bracket from its first fill as the position's protective order. Later fills raise the amount it protects, up to the signed maximum. | `applyOrderInfo` |
| `never_activated` | The entry ended unfilled, so no bracket is tracked. | `applyOrderInfo` |

**Signing and authorization**

| Flash feature | How Tribe uses it | Where |
|---|---|---|
| EIP-712 order signature | Every order is signed by the trader's own key. Tribe never has Flash act without a signature. | `placeOrder` |
| `approveTx`, `wrap`, `setupTxs` + `POST /setup-transaction` | One-time approvals are signed and broadcast by Flash, so no RPC is needed. Tribe re-quotes afterwards to get fresh signing material. | `runSetup` |
| **Permit2 + minimal allowance** (`evmUsePermit2`, `forceMinimalAllowance`) | **On by default** ("Tight approvals"). Flash spends only what each order needs, and there is no standing unlimited approval on the wallet. This answers the main lesson of the 3Commas and Telegram-bot incidents. | Settings → Copying, `AuthOpts` |
| `erc8021AttributionCode` | Attributes orders to Tribe's Base builder code (`BASE_BUILDER_CODE`). | `placeOrder` |

**Watching orders**

| Flash feature | How Tribe uses it | Where |
|---|---|---|
| **Orders WebSocket** (`wss://…/v1/ws`, `orders` + `heartbeats` channels) | One portfolio-wide subscription covers every Tribe wallet. Fills, TWAP slices, bracket activation and closes arrive within a second. Heartbeats detect a dead connection, which reconnects with backoff. | `src/stream.ts` |
| `GET /orders/{id}` (order + fills) | Each fill's settlement tx (the receipt on every card) and the integrator fee earned. With the stream healthy, polling becomes a 2-minute safety sweep. | `refreshOrder` |
| `GET /orders` (paged, status filter) | Lists a funder's open orders; used by `flash:check` and available for reconciliation. | `listOrders` |
| Statuses (`PENDING` … `TERMINATED`) and `filled.*` | Fills are applied as they grow. An order cancelled after a partial fill keeps the part that filled. | `applyOrderInfo` |
| **`closeReason`** | Stored per order and shown to the follower in plain words on Activity, for example "Gas and fees would have been over 30% of the trade, so Flash didn't run it". A copy never fails silently. | `CLOSE_REASONS`, Activity |

**Cancelling and updating**

| Flash feature | How Tribe uses it | Where |
|---|---|---|
| `POST /orders/{id}/cancel` (signed message) | Closing a position cancels its stop or target first. | `cancelOrder` |
| **Batch cancel** (`POST /orders/cancel`, up to 25 with one signature) | Tribe uses it in two places. When a leader cancels a resting order, every follower's matching copy is cancelled with one signature per follower. Several protective orders on one position are also cancelled in one signature. | `cancelOrders`, `cancelFollowerCopies` |
| `PATCH /orders/{id}` (signed trigger update) | Moving a live stop from Positions. It is gasless and takes about a second. Brackets are cancelled and re-placed instead, as Flash requires. | `updateTrigger` |

**Market data, limits and fees**

| Flash feature | How Tribe uses it | Where |
|---|---|---|
| `GET /search` (price, `riskFlagged`, liquidity) | Live prices, and CopyGuard's flagged-token check | `src/prices.ts`, `src/guard.ts` |
| `GET /balances/{address}` | Wallet balances on Funds | `balances` |
| Rate limits (5 requests per second per endpoint, `RateLimit-Reset`) | Each endpoint's bucket is paced on the client, so a 300-follower fan-out queues instead of hitting 429s. On a 429, Tribe waits `RateLimit-Reset` and retries with jitter. | `pace`, `call` |
| `flashIntegratorFeeBps` (a string, the same value on quote and order) | Tribe's integrator fee (`FLASH_FEE_BPS`, default 50). The fee per fill (`integratorFeeNotional`) is summed per trader to pay creators their share exactly. | `quoteBody`, creator earnings |

## Copy trading on Flash, step by step

1. **Detect.** The leader's order goes through Tribe, which records it and fans it out immediately. The orders stream keeps every order's state current afterwards.
2. **Decide per follower.** The follower's rules decide whether the copy happens: CopyGuard, which is read from the contract, the ratio, max per trade, daily cap, budget, and stop-only.
3. **Size.**
   - A buy copies as the leader's spend in USDC times the follower's ratio, capped at their max per trade.
   - A sell copies as the same share of what the follower copied from that leader. If the leader sells 40% of their position, the follower sells 40% of theirs. A follower never sells tokens they don't hold.
4. **Quote, sign and submit** from the follower's own address. Tight approvals are on by default. If the price has already run more than the follower's chase limit (1% by default) past the leader's entry, the copy becomes a 30-minute limit order instead of a market buy.
5. **Track** the order through the stream, and record a receipt or a reason.
6. **Exit.** A copied bracket closes each follower's position on its own when their stop or target fires. A leader's manual sell copies as a share of each position, as in step 3. A leader's cancel cancels the followers' resting copies.

**Ask-first copies.** The follower signs when they approve, and Tribe quotes again at that moment, so a 2- or 5-minute approval timer never meets the market quote's roughly 5-minute deadline.

**Auto copies.** These need something that can sign at the moment of the trade, because Flash allows no delegation without a signature. That is a Privy embedded wallet with Tribe as a signer limited by a per-wallet policy (`src/privy.ts`), which the user turns on from the Wallet page, or a server-held key for demo users. An outside wallet such as MetaMask can't delegate, so those users approve each trade.

## Trades on Flash
Flash has no multi-token order, so a trade copy is one order per token, each with its own attached bracket, sent one after another (`copyBasket` in `src/baskets.ts`). A failed order is recorded on its leg and the others continue, which is why a copy can be partly filled. A rebalance sells first, then buys with what the sells raised. Real-money copies are on and capped at `BASKET_LIVE_MAX_USD`; rebalancing runs in practice mode only. A copy holds nothing until its orders fill, so it isn't treated as sold out while a market order is open, and closing one cancels its brackets on Flash before selling. Flash quotes market orders from $1, but fills at that size and how many signatures a trade really needs are still to be confirmed live. The 5 requests per second limit means 300 copiers of a 5-token trade take about 5 minutes of quotes.

## Not used, and why

| Flash feature | Why not |
|---|---|
| Trigger `crossPrice`, and `limitCrossPrice` without a bracket | Tribe prices everything in USD (`notionalPrice`), which is clearer for people. A limit with an attached bracket is the exception: Flash only accepts `limitCrossPrice` there, and against USDC it's the same number. |
| TWAP `startTime` | Scheduled TWAPs aren't a Tribe feature yet. They would be easy to add to the "twap" command. |
| `maxPriceImpact` | Flash's default for triggered orders is kept on purpose. A stop that refuses to fill because of price impact is worse than one that fills. |
| Cross-chain market orders (`recipientAddress`, `bridgeQuoteId`) | Tribe is Base-only. |
| Solana (`svm.*`, delegate authorization) | Tribe is Base-only today. |
