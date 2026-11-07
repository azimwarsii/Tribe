# Tribe: hand-off

Last updated 2026-11-07. The product is now copyable ETFs with NFT cards: see [README.md](README.md) for what it is and [PLAN.md](PLAN.md) for what's next. Everything from Round 9 down is build history. Some of it describes features since removed or renamed: Ask Cat and Ask Chief are parked, Signals is gone, and copying moved from single trades to ETFs.

## Start here
1. Run `npm run flash:check`. All order types should pass.
2. Run `npm test` and `npm run typecheck`, with `DRY_RUN=true`, a scratch `DB_PATH` and an empty `DOTENV_CONFIG_PATH`, because `.env` holds live keys.
3. Run `npm run privy:check`, then walk the browser enrollment flow on the Wallet page end to end. It hasn't been done yet.
4. Record with `DEMO.md`.

## Where it runs
- **Hosted:** Railway, with `DRY_RUN=false`, so it's real money with a $25 cap per copy. SQLite sits on a `/data` volume. Keep one replica. The free trial's volume gets deleted if the account isn't upgraded.
- **Guard:** the automated check isn't running anywhere, so on the live app nobody gets paused and auto-copies wait for approval.
- **Cards:** Base Sepolia. Local and hosted each have their own `BasketCards` contract because token ids are card ids. They share one minter wallet, so nonces can clash and the worker retries.

## What you can add

| What | Why | Where it goes |
| --- | --- | --- |
| **Two Base mainnet wallets, ~$25 USDC + ~$1 ETH each** (fresh) | A real order on screen in the demo (Flash is mainnet only). | Root `.env` → `LIVE_WALLETS=you:0x<key1>,kestrel:0x<key2>` |
| **A Base Sepolia wallet with test ETH** | Deploys contracts and pays for card minting. Fresh wallet only. | Root `.env` → `DEPLOYER_PRIVATE_KEY` |
| **Your own Flash integrator key** (optional, app.definitive.fi → More → Flash) | Makes Tribe the integrator of record so the fee is paid to you. | Root `.env` → `FLASH_API_KEY` |
| Telegram bot token (optional, @BotFather) | Approve copies in Telegram. The hosted app runs without it. | Root `.env` → `TELEGRAM_BOT_TOKEN`, `BOT_USERNAME` |

## Round 9: social feed and Signals

### Social feed
The feed is ranked by your network, and each card says why it's there, the way X and LinkedIn do (`socialGraph` in `data.ts`). From highest rank down:
- "You copy @x" or "You follow @x".
- "Followed by @a, @b and 2 others you follow" or "copied by 2 people you follow". Follows are named. Copies are a count only, so who copies whom stays private.
- "Trending · #1 this week" or "Trending · copied by 4 people".
- "Suggested for you".

Tabs work the same way as X's:
- **For you** is ranked by the network.
- **Following** shows only traders you copy or follow.
- **Trending** shows the top 3 this week, plus trades copied 2 or more times, most copied first.

### Signals
> Removed from the app in Nov 2026 (not needed for now). The notes below are history; the code is in git before this change. The bot signal endpoint and `bot_signals` are separate and still in use. Existing `signals` tables in old databases were left alone.

**Signals** (`/signals`) sits next to **Leaderboard** (`/ranks`) in both navs. Leaderboard is the explore page: a "Find a trader by name" search that covers everyone who has traded, a **New** tab for traders who started in the last 30 days (before they qualify for the ranked boards), and the Profit, Copied, Streaks, Safest and Squads boards.

What a signal is:
- A trader posts a call: a long ETH with entry, target and stop, a time frame (hours, 1–3 days or a week), and why.
- The entry must be within 10% of the market, with the target above it and the stop below it.

How calls are scored (`settleSignals`):
- **Hit:** the target trades first.
- **Stopped:** the stop trades first.
- **Expired:** neither happens within the time frame.
- The result is fixed once it's settled.

What each call shows:
- The caller's showcase: calls hit (for example "3/4 calls hit"), green-day streak, badges, followers, copiers and level.
- A stop–entry–now–target bar and the risk/reward.
- Follow, Copy with Flash and Ask Cat buttons.

The rest of the page:
- **Your signal desk:** hit rate, followers, copiers, earned, and Post a signal.
- **How callers earn:** post a call, hits win followers, and followers copy you with Flash so you earn a share of the fees.
- **Top callers**, ranked by hit rate.

In the demo, 8 calls from the seeded traders are added on first start (`seedDemoSignals`): some live and some already scored.

Tabs are **Live calls** and **Mine**. There's no Results tab; scored calls count toward the caller's record and show under Mine.

Sharing:
- Each call has the custom reaction badges (one per person, the same picker as trades) and a comment thread that opens under the call. Calls have Follow and Ask Cat, but no Copy button: copying happens from real trades in the feed.
- Every call has a share button that opens a sheet with X, Telegram, WhatsApp, LinkedIn, Farcaster, Reddit and Copy link. On phones, "More apps…" opens the phone's own share menu.
- The post text says how the call went (live, hit, stopped or expired).
- Each call links to its public page `/signal/:id`, which works signed out. It has link-preview tags (og/twitter, using the caller's card image), the scored call, the caller's record, the share buttons, and "Join and follow @x".

### Testing
`DECK_LOOP` (on in the demo) makes the swipe deck loop forever; trades you skipped come back round.

## Round 8: feed = live deck only; history lives in Portfolio
- **The scrolling feed is gone.** `/feed` is always the live deck. Links to a post (Ask Cat's "back to post", Telegram) open `/thread/:id`. The top-bar search goes to a matching trader's profile, or to the Leaderboard.
- **Desktop deck:** the swipe card is first and centred. Everything else is in a side panel (later trimmed to three cards):
  - portfolio and quick actions;
  - **Cat on this trader** (`traderBrief`, `/api/deck/brief`): follows the top card. Cat ranks what matters most in that trader's portfolio, riskiest first (Guard pause, Guard flag, biggest hit this month, a position with no stop, a losing run, a thin record, bot vs manual), then their last 3 closed trades (Manual/Bot) and win rate, closed, max drawdown, copiers. Built from fills, so every line is checkable;
  - **Active trades** (`activeTrades`, `/api/deck/active`): every live entry of yours, one per copy rather than merged per token, plus buy orders still waiting to fill. It shows as a carousel:
    - one trade at a time, with amount in, P&L, entry vs now, stop/target and who you copied;
    - it moves on every 6s and pauses on hover or focus;
    - one slim card: the ‹ › arrows and "1 of 5" sit next to the heading, with no progress bar; ←/→ keys and swipes also go back and forth;
    - it refreshes after a copy and every 15s without losing your place.

  Phones get the portfolio and active trades from the wallet button.
- **Past trades only in Portfolio:**
  - **Your Portfolio** has "What you've made": a bar per month of realised P&L, and an expandable row per month with each closed trade, tagged Manual/Bot and "copied from @trader" (`monthlyHistory`).
  - **A trader's profile → Portfolio:**
    - **Live now** is every position they hold and every resting order, each with **Copy with Flash** at your max size. The confirm states the worst case.
    - Then "What they've made", in % only for visitors.
    - The Trades tab is merged into this one.
- **Copying from a live book** works for any position the trader still holds, or order still resting, however old. It is refused with a clear reason if the price is already past the attached target or stop (`copyOne`).

## Round 7: the live single-card feed
- `/feed` ("Live trades") shows one card at a time on desktop and on phones, and it keeps itself current:
  - "% since their entry" and the copier count refresh every 4 seconds, with a brief highlight on change.
  - New trades slide in as they're placed, without a reload (`GET /api/deck/live`, `GET /api/deck/cards`).
  - Each card shows "Live trade · placed 2m ago".
  - Trades stay copyable for a day. A 5-minute window was tried and removed at your request.
- **Follow button** under the card ("+ Follow @name", "Following", or "You copy @name"): a free follow for the trader on the top card. Keyboard: F.
- **Phones:** the feed is just the swipe deck. Portfolio value, quick actions (Add funds, Positions, My traders, Past trades), quests and trader stories are behind the wallet button in the header ("Your Tribe" sheet).
- **Desktop:** a single centred card, with the Live/Past toggle and the usual right rail. The scrolling history is "Past" (`/feed?view=list`).

## Round 6: Flash conformance audit
Checked the whole integration against the Flash docs and OpenAPI spec. The full feature map is in `docs/FLASH.md`.

**Fixed**
- **429 retries:** used `retry-after`; now uses Flash's `RateLimit-Reset` with jitter. Each endpoint is also paced client-side at 5 requests per second, so a large copy fan-out queues instead of hitting 429s.
- **Partial fills:** were dropped. A TWAP that partly filled and then cancelled never reached the position. Fills now apply as they grow, and a cancelled order keeps what it filled.
- **Copied sells:** were sized as the leader's tokens × ratio, which could try to sell tokens the follower didn't have. A sell now copies as the same share of what each follower copied from that leader.
- **`expireTime`:** must be sent on the quote only. The submit body now strips it, along with the other quote-only fields (`submitEcho`).
- **`closeReason`:** was ignored. It is now stored per order and shown on Activity in plain words, so a copy never fails silently.

**Newly used**
- **Orders WebSocket** (`src/stream.ts`): one portfolio-wide subscription with heartbeats and backoff. Polling drops to a 2-minute safety sweep while it's healthy.
- **Batch cancel:**
  - When a leader cancels a resting order, every follower's matching copy is cancelled, one signature per follower.
  - Several protective orders on one position are cancelled in one signature.
- **Permit2 + minimal allowance** ("Tight approvals", on by default): no standing unlimited approval on any wallet.
- **Limit + `expireTime` as the chase limit:**
  - If the price has run more than your chase limit (default 1%) past the leader's entry when a copy executes, it becomes a 30-minute limit at the leader's price plus the limit.
  - This covers approvals, swipes and auto-copies.
  - Simulated limits now rest and expire like real ones.
- **`GET /orders` listing**, and the attached bracket's protected amount following later fills.

**Settings:** Copying now has "Chase limit" (Off / 0.5% / 1% / 2%) and "Tight approvals".

**Verified:**
- `npm run flash:check` passes 9 order shapes plus batch cancel, order listing and the stream against the live API.
- `npm test` passes 50/50.
- New tests cover request shapes, partial fills, leader-cancel mirroring, sell share sizing and the chase limit.

## Round 5: the Discover deck (swipe to copy) and the research report
- **Research:** `reports/Copy trading pain points.md`, built from 5 research tracks whose notes are in `research_notes/Copy trading pain points/`.
  - 13 pain points, ranked by how common and how severe each is.
  - For each: whether Tribe fixes it, plus the feature that would make the fix a selling point.
  - An 8-item build list and pitch lines.
  - Top recommendations: non-custodial wallets with limits enforced at signing time; a copy ledger with alerts; a leaderboard showing what copiers actually made; creator pay tied to copier outcomes.
- **Discover deck** (`/feed`, `src/views/deck.ts`): one trade at a time.
  - **The card:** trader, Manual/Bot tag, Guard status, % since their entry, the stop/target ladder, the bot's reason, and three tiles: what you'd copy, worst case in dollars, and how many people copied (a count only, never who). Below them is Cat's read with its top three checks.
  - **Right:** copy. A sheet shows the size choices, loss if the stop hits and gain at the target, then "Confirm & sign". It's one Flash order with the bracket attached, checked by CopyGuard first and bounded by your max per trade, daily cap and stop rule (`copyOne` in `src/copy.ts`, `POST /api/copy-trade`).
  - **Left:** skip for good (`POST /api/swipe`).
  - **Up, or the middle button:** Ask Cat about this trade.
  - **Copy requests** (ask-first) come first in the deck with their countdown: right approves, left skips. The deck never shows your own trades, trades you already copied (including auto-copies), trades by paused traders, or trades over a day old.
  - Trades your rules would refuse (no stop) go to the back and are labelled. Their confirm button is disabled with the reason.
  - **Controls:** drag with tilt and COPY/SKIP/ASK CAT stamps, round buttons, or the keyboard (← skip, ↑ Ask Cat, → copy).
  - No comments or reactions in the deck. The scrolling list stays at `/feed?view=list` (also opened by any search or filter), with a Swipe/List toggle on both. Links back to a post now open the list.
- **Copy counts without names:** list cards show "N copied" instead of copier avatars.
- Cat's risk/reward check now judges the rounded value it shows, so "1.5" is never flagged as thin.

## Round 4: reactions and a chat fix
- **LinkedIn-style reactions on trades** (`src/views/reactions.ts`): six custom animated badges: Fire, To the moon, Diamond hands, Bullish, Bearish, Smart call.
  - How it works: hover the reaction button (desktop) or long-press it (phone) and the bar pops up with a staggered entrance. Each badge has its own idle animation (flicker, lift, glint, bounce, sink, glow), and the hovered one grows with its label. A plain tap toggles Fire.
  - Rules: one reaction per person per trade, so picking another replaces yours.
  - Display: the card shows the top three badges stacked plus the total. It updates in place without a reload, and your new badge pops.
  - The thread page shows the bar plus a per-reaction breakdown. Old emoji reactions are migrated automatically. Keyboard: Arrow-Up opens the bar, Esc closes it. Animations are off under reduced-motion settings.
- **Ask Cat on desktop:** the chat history column now stays put while the conversation scrolls. The cause was `overflow-x: hidden` on the page container: it silently made the container a scroll box, which disabled every `position: sticky` inside it. It's now `overflow-x: clip`, which also fixes any other sticky element in the app.

- **Ask Cat as an app view on desktop:**
  - The chat page no longer scrolls as a page. The history list and the conversation are separate scroll panes, so scrolling one never moves the other. Phones keep normal page scrolling, with history in the drawer.
  - The left menu collapses to icons and the right summary rail is hidden while you're in Ask Cat. A menu button in the chat header expands or collapses it, remembered per browser (`slim` page option, `SIDE_JS`).
- **Custom badges instead of emoji in the app:**
  - Cat's tones Sharp, Chill and Degen are indigo target, cyan waves and hot-pink lightning badges. They animate on hover and appear in the tone picker, the Cat header, the memory page and Settings.
  - Degen replies no longer get a "🔥" tacked on.
  - The "Copy with Flash" chip in research chats is a green chip with a bolt icon; older saved chats render the same way.
  - Cat's verdict marks and the onboarding step checks are drawn icons, not ✓ characters.
  - Trader badges use the same medal icons as the Badges page, and the profile's Badges tab shows them as medals.
  - Emoji remain only in Telegram messages, which are plain text and can't show custom badges.

## Round 3: usernames, photos, profiles, and bots that belong to users

**There is no separate "Cat Agent" account any more.** Bots belong to people.
- **Your bot** (Me → Your bot, or `/bot`): switch it on, pick the size per trade ($10–$100) and the most bot trades a day (1–5).
  - When the bot strategy signals, every user whose bot is on gets the trade from their own wallet, under their own username, with the bot's one-line reason (`src/bots.ts`).
  - A user paused by CopyGuard has their bot stop too.
  - Their copiers copy bot trades like any other trade, by their own rules.
- **Manual / Bot tags** on every trade card.
  - **Manual** = placed by the person: in the app, by voice, in Telegram, or via Ask Cat with their confirmation.
  - **Bot** = placed by their bot, or proposed by their own AI agent over MCP and confirmed (Bearer-token confirms are tagged this way).
  - Bot cards show "@name's bot" with the reason. A bot badge sits on the user's story ring.
- **Unique usernames:** 3–20 letters, numbers or _, unique ignoring case (stored lowercase). A few app words are reserved (admin, tribe, cat, bot, guard…). Sign-up and the new **Edit profile** page (`/profile/edit`) check live and say why a name is refused.
- **Profile photos:** upload on Edit profile. The browser crops to a square and resizes to 256px JPEG before upload. Photos are served at `/avatar/:id` with a cache-busting URL and appear everywhere an avatar does (feed, story rail, profiles, leaderboards, requests, sidebar, Cat). Plus a 160-character **bio**.
- **Follow (free) vs Copy:** **Follow** on any profile adds them to your Following feed tab without copying. **Copy with Flash** still copies. Profiles show followers, copiers and following counts.
- **Profile / portfolio** (`/u/:username`), what I chose to show:
  - Header: photo, bio, level, how long they've traded, total return, counts, Follow and Ask Cat.
  - A bot banner if they run one, and Cat's read on their latest trade.
  - Tabs:
    - **Overview** (stats plus a **Manual vs Bot** record side by side)
    - **Portfolio** (holdings as % allocation, return since entry, stop/target; dollar amounts only for the owner; recently closed with Manual/Bot tags)
    - **Trades** (filter All / Manual / Bot)
    - **Guard**
    - **Badges**
- Demo seed:
  - @kestrel runs a bot: three bot round trips plus today's bot trade, next to their manual TWAPs.
  - Everyone has a bio, and a few free follows are seeded.
  - `LIVE_WALLETS` now binds `you` and `kestrel`.
- Tests: new profile test (usernames, photos, follows, portfolio, Manual vs Bot, agent tagging) and an updated bot-signal test (per-user, daily limit, off means off). 43/43.

## Round 2: your three winning points (done while you slept)

**AI bot across every feature (Ask Cat research)**
- Every feed card has an **Ask Cat** button. It opens a chat about that post, with **Cat's read**: ✓/! checks on the stop, the risk/reward, whether you'd be chasing, the track record, drawdown, Guard risk, the **latest CopyGuard verdict** and the **oracle vs DEX price**. Verdicts are "Looks solid", "Mixed", "Risky" or "Avoid for now"; a missing stop or a Guard flag caps it at Mixed.
- Follow-ups stay about the post: "Their track record" ("Bot vs manual record" on bot trades) and "Worst case if I copy", which sizes it with *your* copy rules.
- The post stays **pinned above the composer** with **Copy with Flash** and a link back to the post, which is highlighted on return. The header back button returns to the post too.
- Ask by name from anywhere: "is @nightowl worth copying?" works in the app, in **Telegram** (Cat's read as text, plus "Open the post" and "Copy with Flash" buttons) and over **MCP** (new `tribe_research` tool). A concrete order ("buy $20 ETH…") still becomes an order, and "why was X paused" keeps the Guard answer.
- **Cat's read** also sits on trader profiles and at the top of the copy flow.
- **Cat's pick** in the feed shows today's best-checked entry from someone you don't copy yet. It is only shown when the read is "Looks solid". The seed adds **@ember**, a careful trader you don't copy, so it appears in the demo.
- **Cat's calls** keep the AI accountable. Each verdict Cat gives in chat is stored with the price at that moment, and the Cat home shows its record per verdict ("Looks solid: 4 calls · 3 of 3 closed green"). Calls are scored by what the trader did next, not by price moves, which in a one-token market would score every call the same. Nothing is seeded, so it fills as you use it.
- The Cat home's RESEARCH prompt now asks about this week's top trader ("Is @traderx worth copying?").
- **Ask Cat** links also appear on each Guard trader row ("why was X paused?" or "is X worth copying?") and on positions copied from a trader. `/api/cat/ask` accepts `handle`, which the MCP tool uses.
- **Copy requests** (ask-first) show Cat's read on that exact trade above the checks, in the app and in the **Telegram** approval message. With a public https `PUBLIC_URL`, Telegram also gets an "Ask Cat more" button.
- Fixed along the way:
  - Telegram copy requests were sent to the app user id instead of the linked Telegram chat, so web users who linked Telegram never got them.
  - The request card said "Single order" for entries with an attached bracket; it now shows the take-profit and stop legs.
  - Telegram link buttons are only added with a public https URL. Telegram rejects localhost links and would drop the whole message.
- Everything is grounded in fills, Guard and your rules, with no LLM, so every number can be checked and it works offline.

**Guard security**
- **Copy-time onchain gate** (`guardGate` in `src/guard.ts`): right before fan-out, Tribe reads `CopyGuard.halted(leader)` from the contract. It is uncached, one call per trade. A halt onchain blocks the copy even if the event watcher missed it or the DB was edited, and it heals the local mirror.
- **Dead-man's switch:** if the chain can't be read, or the check is silent for `GUARD_MAX_SILENCE_MIN`, auto-copies become ask-first. Nothing signs on its own.
- The Guard page has a **CopyGuard heartbeat** row; the "how it works" sheet and README explain both.
- New `src/guard-gate.test.ts` covers this against the real contract on a Ganache JSON-RPC server: blocked when halted onchain only, held when silent, held when the RPC is down.
- The Guard hero and price check now survive restarts (they fall back to the stored Guard runs).

**Social and gamified**
- New daily quest **"Ask Cat about a post before you copy"** (+5 XP) and a seventh badge, **Did the Homework** (5 research chats). The game now rewards checking before copying.
- On phones, the copier avatars stay but the "copied by" text is hidden for screen space; screen readers still get it.

Tests: `npm test` 42/42, typecheck clean.

## What changed overnight

**Flash (the live trading path)**
- `src/flash.ts` rebuilt against the real API spec. Fixes: the integrator fee was never sent on the order (we'd have earned nothing); TWAP's `durationSeconds` must not be echoed on submit; approvals now broadcast through Flash's `/setup-transaction`.
- New: **attached brackets** (entry + take-profit + stop-loss as one Flash order, copied as one order, protection sized from the actual fill), gasless signed **cancel** and **update** (move a live stop; brackets are cancelled and re-placed), fills with **settlement tx hashes** and the **integrator fee earned**.
- **Validated without funds**: `npm run flash:check` quotes, signs and submits all 7 order types from an empty wallet; Flash accepts every body and signature and refuses only for the zero balance.
- Receipts everywhere: feed cards ("filled onchain ↗"), Activity ("Receipt ↗"), Guard events (CopyGuard tx). Creator earnings use the real fee from fills.

**Contracts**
- `CopyGuard.sol` and `SeasonBoard.sol` were hardened with ERC-165, replay protection and batch reads, and tested on an in-process EVM.

- **Guard log:** the Guard page lists each run with its price check and every trader's verdict, whether rules or the AI decided it, and the tx.

**Social**
- 9:16 TikTok/Reels share card (phone share sheet), Telegram share, public `/top` leaderboard whose X preview is a rendered board, "Share on X" on the Leaderboard.
- Demo seed now has realised history, so leaderboards and seasons show real returns.
- **Feed redesign (gamified social trading)**: a story rail with ringed avatars and each trader's week, a level/streak/quests strip with a one-tap Claim, and trade cards with level badges, streak chips, plain-verb headlines ("Took profit on ETH"), live % since entry, an entry/stop/target ladder, copier avatars, and a "Hot" ribbon on today's most-reacted trade. Feed "moments" (Guard pauses, badges earned, squad standings) are mixed into the stream.

**Running it**
- `npm run demo:reset:live && npm run demo:live`: the seeded app with real prices and real orders, for recording.
- README rewritten for judges (requirement → code → command), DEMO.md live segment, complete `.env.example`, Dockerfile.

**Tooling installed on your machine**: dev dependencies `solc` and `ganache` in the project.

## Verified vs not
- Verified at the time: `npm test` 42/42 (incl. contracts on an EVM, the copy-time CopyGuard gate over JSON-RPC, Ask Cat research, and agent bearer auth), typecheck clean, every route 200 on the seeded demo, director beats run, live Flash quote + submit validation for all 7 order types, MCP server driven end to end by an MCP client.
- Not yet: a funded Flash order filling onchain, cancel/update on a live order.

## Ideas, highest value first
1. **Record the live segment** (`DEMO.md`). The submission needs onchain proof on screen.
2. ~~Deploy publicly~~ **Done** on Railway.
3. ~~Privy embedded wallets~~ **Built**; the browser flow still needs an end-to-end run.
4. ~~Tribe MCP server~~ **Built** (`src/mcp.ts`, 8 tools incl. `tribe_research`): any MCP client can read the leaderboard, check a trader and Guard, see your positions, copy with limits, and propose → confirm a bracketed Flash trade. Agent token and ready-to-paste config on Settings → AI agent access. Tested end to end with the MCP client SDK against the running app. It also caught an Ask Cat gap ("12% target" wasn't understood, only "take profit"), now fixed.
5. **Cat on X**: reply bot that turns "@TribeCat buy $20 ETH with 5% stop" into a one-tap bracket link. Needs a paid X API tier.
6. A 10-second architecture slide in the video: Guard → copy blocked; ETF copy → Flash orders → NFT card.
