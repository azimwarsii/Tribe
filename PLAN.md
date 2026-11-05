# Tribe (formerly CopyCat Arena): app with built-in Grok-style bot, gamified
Name: Tribe. Rename the `copycat/` folder, the package name, bot copy text, and README to Tribe when implementation starts.
Revision: the product is an app (not just a Telegram bot). Screens: Onboarding, Feed, Ask Cat (AI bot chat, also on Telegram and X), Trade, Leaderboard (Profit, Most Copied, Streaks, Safest, Squads), Trader profile (public share link), Copy settings, Approvals inbox, Share card, Quests/XP/badges, Squads, Guard center. Hackathon cut: Feed, Ask Cat, Profile+share, Copy settings, Leaderboard, Guard center; quests and squads are light extras. CRE is central: the CopyGuard workflow halts copying onchain (see below). Wow factor: copy trading with an onchain AI circuit breaker, ask-first copying with protective-order mirroring, talk-to-trade bot, viral share links, verified onchain PnL.

# Original v2 plan: social copy-trading bot with feed, share pages, leaderboard and CRE "Sentinel" guard

## Context
Hackathon entry for two tracks: Flash advanced orders in a social app ($2.5k) and Chainlink CRE. The v1 scaffold (`copycat/`) has a Telegram bot, a Flash quote/sign/order client, a copy engine, and a thin CRE cron workflow. It is unrun (no Node or Bun on the machine). v2 turns it into a product: a bot plus a public web feed, shareable profit cards that link to a leader's portfolio, copy-with-controls, a leaderboard, and a CRE+AI risk guard in the style of SentinelCRE (github.com/Nailer/Sentinel: CRE cron -> AI judgment -> onchain report via Forwarder -> contract enforces a pause).

Assumed stack: TypeScript, Node, SQLite, Next.js. Deployed to a free host for the demo. Say if you want something different.

## Architecture
1. **Bot** (grammy, extends `src/index.ts`): trade, follow, approve, settings, share.
2. **API + DB** (Express + SQLite via better-sqlite3), replacing in-memory `src/store.ts`. Tables: `users`, `wallets`, `trades`, `positions`, `follows` (with rules), `pending_copies`, `guard_events`.
3. **Web app** (Next.js, `web/`): `/feed`, `/leaderboard`, `/u/[handle]` (portfolio and a Copy button), `/s/[tradeId]` (share card with OG image).
4. **Flash layer** (`src/flash.ts`, kept): quote, EIP-712 sign, order. Add order-status polling via `GET /v1/orders` so trades and PnL come from real fills (no fake profit). Fee via `flashIntegratorFeeBps`.
5. **CRE guard** (`cre-workflow/guard-workflow/`) plus `contracts/CopyGuard.sol`.

## Features
**Feed:** a stream of fills from all leaders (token, side, order type, entry, current PnL%) from `trades` filled via Flash order status. Leaders can set a profile to private or public.

**Copy controls** (a `follows` row per follower and leader):
- `mode`: `auto` or `ask`. In `ask`, a Telegram message shows the trade with Approve / Skip inline buttons. No order is signed until Approve, and unanswered requests expire (stored in `pending_copies`).
- Filters: allowed tokens, allowed order types (for example only stop-loss, take-profit and bracket), max size per trade, daily USD cap, and copy ratio.
- Copying a leader's stop-loss, take-profit or bracket along with the entry is a toggle.

**Sharing:** `/share` on a closed or open trade produces a link `/s/<id>`. The page has an OG image card (token, PnL%, leader handle), a "Copy this trader" button that deep-links to `t.me/<bot>?start=follow_<handle>`, and links to the leader's portfolio. Pre-filled X post text tags @DefinitiveFi.

**Leaderboard:** ranks by realised PnL% (window: 7d, 30d, all), copy count, and follower AUM. It needs a minimum trade count to appear. PnL is computed from filled Flash orders only.

**Wallets:** keep generated wallets only for the demo. Plan for Privy embedded wallets so users sign client-side and the bot never holds keys. Needs a decision before launch (see questions).

## CRE + AI: "CopyGuard" (Sentinel pattern applied to copy trading)
Workflow (cron, every few minutes):
1. **Read** (offchain, HTTP with consensus): recent leader trades and stats from our `/guard/snapshot` API, plus token market data (price, liquidity, volume) from a public API.
2. **Read** (onchain, EVMClient): Chainlink price feed for the traded asset, compared with the market-data price to catch depegs or manipulated prices.
3. **AI judgment** (HTTP call to an LLM): input is leader drawdown, trade burst rate, position concentration, token anomalies. Output is strict JSON `{ leader, severity: ok|warn|halt, reason }`.
4. **Write** (EVMClient write report via CRE Forwarder) to `CopyGuard.sol`.

`CopyGuard.sol`: `onReport()` is restricted to the Forwarder and records `halted[leader]` with a reason hash. The bot subscribes to the event (or polls) and immediately stops mirroring that leader's new trades, notifies followers, and posts the reason on the leader's page ("Paused by CopyGuard: 22% drawdown in 1h"). Followers' existing protective orders are untouched. Leaders can be resumed by an owner or a cooldown.

This gives a real onchain write, an external API, an LLM and a blockchain in the workflow. The guard is also meaningfully used: it gates every copy in `src/copy.ts`.

## Build order
1. DB layer replacing `store.ts`. Port `copy.ts` to rules-based copying and the ask-first flow. Unit-test the rules.
2. Order status and fills, PnL calculation.
3. API plus feed, portfolio and leaderboard pages.
4. Share page and OG card, deep-link follow.
5. `CopyGuard.sol` (Foundry), then CRE guard workflow, simulated with the CRE CLI. Then bot integration (halt check).
6. Demo script: leader places a bracket trade, followers copy (one with ask-first), share link opened, guard trips on a seeded drawdown, copying halts. Record the video, with an onchain Flash order and CopyGuard tx hash shown.

## Critical files
- Existing: `copycat/src/flash.ts`, `src/copy.ts`, `src/parse.ts`, `src/index.ts`, `src/store.ts` (to replace), `cre-workflow/signal-workflow/main.ts` (to rework into guard).
- New: `src/db.ts`, `src/rules.ts`, `src/pnl.ts`, `src/api.ts`, `web/*`, `contracts/CopyGuard.sol`, `cre-workflow/guard-workflow/*`.

## Verification
- Install Node 22, Bun and the CRE CLI (none present now). `npm run typecheck`.
- Dry run with `DRY_RUN=true`: a follower in `ask` mode gets buttons and nothing is signed before Approve; filters block disallowed tokens and order types.
- Real small orders on Base using the Flash dev key: confirm the order id and onchain fill, and that the feed and PnL match.
- `cre workflow simulate guard-workflow --target staging-settings` shows the AI verdict and the report write. Check the `CopyGuard` event onchain, then that the bot halts copying.
- Open the share link in a fresh browser: the card renders and the Copy button opens the bot.

## Open risks
- Unverified Flash details: bracket signing, approvals and the token list. The CRE SDK write and secrets APIs were not in the docs I could read.
- Copy-trading real users' funds may have regulatory implications. Keep the demo to your own wallets.
