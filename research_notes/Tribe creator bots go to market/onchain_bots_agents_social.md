# Onchain Bots, Agents, Vaults and Social Trading: how they package manual trading, strategies and creator monetization (as of 2026-11-01)

Scope note: about 20 search and fetch calls. Many figures come from secondary crypto press, trackers and affiliate review sites, and these are flagged. Every figure carries a date. Anything older than about 6 months (before May 2026) is marked [OLDER]. Not covered, or found nothing reliable: Kwenta/Polynomial, Vertex, Symmetry, GMX vaults, BONKbot, Maestro specifics, Griffain, Wayfinder, HeyAnon, Cod3x, Moby, Clanker. These are listed under Gaps.

## 1. Vaults and copy-vault products (Hyperliquid, Drift, dHEDGE/Chamber, others)

### Takeaway
Hyperliquid user vaults set the template: a 10% leader profit share, the leader must keep at least 5% of the vault, and the leader seeds 100 USDC. Drift and dHEDGE let managers set their own fees, with high-water marks. Vaults stay a long tail with weak retention. Even the protocol vault HLP lost about 55% of its TVL from September 2025 to June 2026. The bigger monetization story on Hyperliquid has moved to "builder codes", meaning per-trade fees for the front-ends that route order flow. That model is closer to Tribe's "creators earn a share of Flash fees" design.

### Cited Findings
- **Hyperliquid vault leader terms** (official docs, labeled "legacy" when fetched 2026-11-01). Leaders earn 10% of profits. They must hold at least 5% of the vault at all times and cannot withdraw below 5%. They make a minimum 100 USDC deposit at creation. When a follower withdraws and margin is short, margin-using orders are cancelled first. If that is not enough, 20% of positions are auto-closed, repeating until the withdrawal clears. Leaders can opt for proportional closing instead. The page also mentions a "10k USDC gas fee" for creation, distributed like trading fees. This conflicts with the commonly cited 100 USDC creation cost, so the user should check it against the current docs. — [Hyperliquid docs: For vault leaders](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-leaders)
- **Hyperliquid vault count.** One analytics site says more than 2,000 vaults operate on Hyperliquid (date unclear, 2026). Individual user vaults are often tiny. For example, the "Liquidator" vault held about 16.4K USDC current TVL against a 1.22M USDC peak. — [Buildix vault guide 2026](https://www.buildix.trade/blog/hyperliquid-vaults-analytics-hlp-top-traders-guide-2026); [tradingstrategy.ai Liquidator vault](https://tradingstrategy.ai/trading-view/vaults/liquidator)
- **HLP (protocol vault) TVL** peaked at about $603.9M in September 2025 and fell to about $268.6M by June 2026, more than 55% down. Another tracker showed about $311.5M on 2026-06-12. HLP was hit by backstop-liquidation attacks in March 2025, November 2025 and April 2026. — [CoinGecko HLP analysis](https://www.coingecko.com/learn/hyperliquid-hlp-vault-analysis); [tradingstrategy.ai HLP](https://tradingstrategy.ai/trading-view/vaults/hyperliquidity-provider-hlp)
- **Hyperliquid builder codes**, where front-ends add a per-trade fee:
  - Phantom: $20.63M cumulative builder revenue, 31.8% of the top-10 total, at a 0.05% fee with 137,496 users (CoinGecko snapshot, 2026-05-25).
  - Based: $15.06M at 0.025%.
  - MetaMask: $6.51M at 0.1%, the highest rate in the top 10.
  - Phantom and Based together hold 54.8% of top-10 builder revenue.
  - [CoinGecko top Hyperliquid builders](https://www.coingecko.com/research/publications/top-hyperliquid-builders); [Crypto Briefing](https://cryptobriefing.com/phantom-20m-builder-code-revenue-hyperliquid/)
  - Aggregate builder revenue figures conflict: "$100M annual from HIP-3 + builder codes" (March 2026, [KuCoin flash](https://www.kucoin.com/news/flash/hyperliquid-generates-100m-in-annual-revenue-from-third-party-integrations)) versus "$90M builder code revenue" (July 2026, [Odaily](https://www.odaily.news/vi/newsflash/504538)).
- **Drift vaults** (official docs, undated). Creation is permissionless. Management and performance fees are set at initialization and can afterwards only be lowered. Performance fees are charged per depositor using high-water marks. "Trusted" vaults, which allow manager borrowing and margin, need an admin to upgrade the vault class. — [Drift docs: Vault Managers](https://docs.drift.trade/developers/vault-managers)
- **dHEDGE, now Chamber** (official docs, undated). The manager is paid a performance fee only when the vault token price exceeds its previous high-water mark. The mark is vault-level, not per depositor. Fees are paid by minting vault tokens to the manager, and the DAO takes 10% of all manager fees. dHEDGE added Hyperliquid vault support: managers trade on Hyperliquid while dHEDGE handles pooling, accounting and fees. Chamber TVL on DefiLlama was about $20.39M (snapshot undated). — [dHEDGE performance fees](https://docs.dhedge.org/dhedge-protocol/vault-fees/performance-fees); [dHEDGE DAO fees](https://docs.dhedge.org/dhedge-protocol/dao-protocol-fees); [dHEDGE Hyperliquid early access](https://blog.dhedge.org/dhedge-opens-hyperliquid-early-access-for-managers); [DefiLlama Chamber](https://defillama.com/protocol/chamber-vaults)

### Inferences
- The industry-standard creator-economics menu is: profit share (about 10%) with a high-water mark, a skin-in-the-game requirement (5% leader stake), and fees that can only go down. Tribe's fee-share model (creators get a cut of Flash execution fees) pays on volume, not performance. This avoids high-water-mark accounting, but it rewards creators for churning trades. A CRE risk pause plus a cap on creator trade frequency could offset that bias.
- Builder-code revenue concentrates in distribution (wallets and apps) rather than in individual traders. The money accrues to whoever owns the user relationship.

### Gaps
- No reliable 2026 data found on Kwenta/Polynomial copy products, GMX vaults, Vertex (the writer's recollection, unverified this session, is that it was wound down in 2025 after the Ink/Kraken deal), or Symmetry.
- No ranked TVL list of top Hyperliquid user vaults, and no follower-retention data.
- The "10k USDC gas fee" line on the Hyperliquid page needs a direct check.

## 2. Telegram and terminal trading bots (Banana Gun, Trojan, Maestro, BONKbot, Photon, GMGN, Axiom)

### Takeaway
The fee standard is about 1% per trade on Solana and non-ETH chains, and about 0.5% on ETH for Banana Gun. Referral discounts of about 10% and referrer shares of about 25 to 35%, sometimes multi-level, are the main growth loop. Copy trading is a standard feature, especially on GMGN. Revenue is large but volatile and tracks memecoin cycles: Photon fell from $122.8M (Q1 2025) to $32.3M (Q2 2025). The Telegram bots have lost share to web and mobile terminals (Axiom, GMGN) and then to consumer apps (Fomo).

### Cited Findings
- **Banana Gun fees:** 0.5% on Ethereum manual buys, 1% on other chains and on snipes, 0% on EVM stablecoin swaps. It distributes 40% of platform fees to $BANANA holders. Weekly fees were reported at more than $92K at a late-2025 peak and more than $17K in March 2026. These figures come from affiliate review sites, so treat them as soft. — [BreakingAC comparison, 2026-04-30](https://breakingac.com/news/2026/apr/30/multi-chain-telegram-trading-bots-head-to-head-trojan-vs-banana-gun-vs-maestro/); [Datawallet best TG bots](https://www.datawallet.com/crypto/best-crypto-telegram-bots)
- **Trojan fees:** about 1% per trade on Solana, 0.9% with a referral link. It has a multi-level referral program (5 levels per one comparison). The referrer share is cited at 25 to 35%, but this was not confirmed from official docs. 50% of revenue went to Unibot holders (Trojan grew out of Unibot). — [madeonsol Trojan](https://madeonsol.com/tools/trojan); [coincodecap referral list](https://coincodecap.com/all-telegram-trading-bot-referral-programs-listed); [Datawallet](https://www.datawallet.com/crypto/best-crypto-telegram-bots)
- **Maestro** uses a monthly subscription plus per-trade fees. No exact rate was confirmed. — [BreakingAC](https://breakingac.com/news/2026/apr/30/multi-chain-telegram-trading-bots-head-to-head-trojan-vs-banana-gun-vs-maestro/)
- **GMGN:** flat 1% per trade, more than $292M lifetime fees since 2023 (DefiLlama via Datawallet). Q1 2026 revenue was $25.31M, versus $5.64M in Q4 2025, which may partly be a data artifact because DefiLlama BSC data is missing before October 2025. Copy trading is a core GMGN feature. — [Datawallet GMGN explained](https://www.datawallet.com/crypto/gmgn-explained); [Crypto Briefing GMGN vs Axiom](https://cryptobriefing.com/gmgn-overtakes-axiom-24-hour-revenue/)
- **Axiom:** about 0.95% default fee. Q1 2026 revenue was about $29.03M, down from a 2025 peak, with $60.66M in Q4 2025. Cumulative revenue was about $453M (cryptobriefing, 2026). — [Crypto Briefing](https://cryptobriefing.com/gmgn-overtakes-axiom-24-hour-revenue/)
- **Photon:** 1% per trade on Solana. Quarterly revenue fell from $122.8M (Q1 2025) to $32.31M (Q2 2025) [OLDER]. — [madeonsol GMGN vs Photon](https://madeonsol.com/blog/gmgn-vs-photon)
- **Category total:** one source claims more than $2B in cumulative bot fees in 2025, with the top 5 bots taking about 60%. It is an unverified secondary source. — [openliquid landscape 2026](https://openliquid.pages.dev/blog/telegram-trading-bots-landscape-2026). Live per-protocol data is on [DefiLlama Telegram Bot category](https://defillama.com/protocols/Telegram%20Bot).

### Inferences
- About 1% per trade is what retail tolerates for speed and convenience in memecoin contexts. Majors-oriented products charge far less: Phantom perps 0.05%, Fomo majors 0.05%.
- Referral revenue share (25 to 35%) is a proven acquisition engine. Tribe's creator fee share works the same way, with followers playing the role of "referrals". The bot precedent suggests creators will push the product hard if the split is legible and paid in real time.
- Revenue is extremely cyclical, so a creator studio must keep creators even when volume drops by 70 to 90%.

### Gaps
- No official BONKbot or Maestro fee and revenue data was retrieved. The official Trojan referral percentage was not confirmed. No copy-trade-specific revenue breakdown exists for any bot.

## 3. AI agent trading products (Bankr, Virtuals, Giza, Almanak, others)

### Takeaway
The working UX is "talk to a bot", typically on X, Farcaster or Telegram, backed by a custodial or embedded wallet auto-provisioned per social handle. Bankr is the Base exemplar. That convenience has proven to be the main attack surface: Bankr lost about $150K+ from 14 wallets in May 2026 through suspected prompt injection via Grok or a custody-layer failure, and there were similar Grok/AIXBT incidents. Agent economies such as Virtuals report big "aGDP" numbers ($479M) but small real protocol revenue (about $452K ACP revenue since inception, June 2026). Yield agents (Giza ARMA, Almanak) consolidated or shrank.

### Cited Findings
- **Bankr breach (2026-05-19).** Bankr disabled swaps, transfers and deployments after an attacker accessed 14 Bankr wallets. Some users reported up to $150K drained per wallet, and the attacker addresses held about $440K. SlowMist's Yu Xian attributed it to prompt-injection-style social engineering involving Grok tagging Bankrbot. Halborn noted that a key-management or session-token failure at the third-party custody provider would also fit. Bankr promised full reimbursement. Its custody model: it "provisions wallets through a third-party custody service" and auto-creates a wallet for each X handle that interacts with the bot. — [Cointelegraph, 2026-05-20](https://cointelegraph.com/news/bankr-disables-transactions-after-14-wallets-hacked); [Yellow](https://yellow.com/news/bankr-halts-14-wallets-150k-ai-attack)
- **Related incidents:**
  - Grok wallet: about $175K in DRB drained via a Morse-code prompt injection (May 2026). — [threatcluster](https://threatcluster.io/cluster/ai-exploit-drains-175k-from-grok-wallet-via-morse-code-injec-2284c4f3)
  - AIXBT: fraudulent dashboard prompts led to a 55.5 ETH transfer (2025-03-18) [OLDER]. — [AI Incident Database](https://incidentdatabase.ai/es/entities/0xhungusman/)
  - LOBSTAR agent: lost about $440K by "misunderstanding" and sending funds away. This was an agent error, not a hack. — [KuCoin flash](https://www.kucoin.com/news/flash/ai-agent-lobstar-wilde-loses-440-000-in-solana-transfer-error)
  - A claimed $40M+ in memory-poisoning losses across Solana agents (January 2026) has a weak source. — [BlockEden](https://blockeden.xyz/blog/2026/04/12/ai-trading-agent-45m-exploit-defi-security-breach/)
- **Bankr economics** (third-party, unverified, conflicting):
  - About 0.8% transaction fee per one tracker.
  - Token launches carry a 1.2% swap fee split creator 57% / Bankr 36.1% / ecosystem 1.9% / Doppler 5%.
  - About $580K annualized revenue (February 2026) [OLDER].
  - A Privy case study cites 30K wallets and 100K transactions (undated).
  - Gas is sponsored on Base and other chains. A Bankr Club subscription or LLM credits are needed for "Max Mode".
  - [crypto-ai-tracker Bankr](https://crypto-ai-tracker.vercel.app/projects/bankr); [KuCoin Bankr deep dive](https://www.kucoin.com/news/articles/a-deep-dive-into-the-ai-agent-bankr-and-its-ecosystem-token-bankrcoin-bnkr); [HivemindOS Bankr reference](https://liamvisionary.github.io/hivemindos/bankr/bankr-platform-reference.html)
- **Virtuals:**
  - 18,000+ deployed agents and about $479M "aGDP" (around March 2026) [OLDER].
  - Revenue Network launched 2026-02-12, distributing up to $1M/month to agents selling services via ACP.
  - Fundstrat (2026-06-24): only about $452K in ACP protocol revenue since inception, with volumes moderating.
  - BlockEden cites $39.5M cumulative protocol revenue including token-launch and trading fees.
  - Virtuals' own GAME account acknowledged confusion between aGDP and revenue.
  - [Fundstrat Q2 update PDF](https://fundstrat.com/wp-content/uploads/2026/06/20260624-Digital-Asset-Strategy-Virtuals-Protocol-–-Growing-Agentic-GDP-Q2-Update.pdf); [BlockEden aGDP](https://blockeden.xyz/blog/2026/04/21/agdp-agent-gdp-virtuals-protocol-ai-blockchain-valuation-primitive-tvl-displacement/)
- **Giza** sunset its legacy ARMA (yield-optimizing agent on Base) and Pulse agents, returned funds to users' external accounts, and consolidated them into one "Giza Agent". The migration deadline was 2026-03-26 [OLDER]. — [KuCoin flash](https://www.kucoin.com/news/flash/giza-tech-returns-arma-and-pulse-funds-to-users-as-legacy-agents-sunset); [ValueTheMarkets](https://www.valuethemarkets.com/cryptocurrency/news/giza-tech-transitions-to-a-new-consolidated-autonomous-agent)
- **Almanak** TVL reports conflict wildly: the alUSD vault at about $105M and "TVL past $120M" around token listing (both undated), versus DefiLlama snapshots of $9.76M and about $520K. This suggests a sharp post-listing outflow, but it is unconfirmed. — [Oak Research](https://oakresearch.io/en/reports/protocols/early-birds-almanak-defai-platform-automating-yield); [DefiLlama Almanak](https://defillama.com/protocol/almanak)

### Inferences
- For Tribe, the lesson is that natural-language bot creation and an auto-provisioned custodial wallet are a strong pairing for growth but a liability for security. Bounded permissions are the differentiator to market: session keys or spending policies, allowlisted contracts, per-trade and per-day caps. Tribe's CRE risk pauses play the same role. A creator's bot should never be able to `transfer()` arbitrary funds. It should only be able to call Flash trade routes within policy.
- The gap between "aGDP" and real revenue means Tribe should report realized creator payouts, not notional volume, to keep credibility.

### Gaps
- No reliable 2026 data was retrieved for Griffain, Wayfinder, HeyAnon, Cod3x or Almanak's current state. Bankr's post-mortem, if published, was not found. The custody provider (Privy, or another) behind Bankr was not confirmed.

## 4. Onchain social trading apps (Fomo, Base App/Zora, Vector.fun, friend.tech)

### Takeaway
Fomo is the clear 2026 winner. It is a feed, leaderboard and copy app with Apple Pay, gasless swaps and one balance across chains. It reached 625K+ users and $4B+ volume (June 2026), raised a $75M Series B at a $550M valuation, and posted a record $2.64M in weekly revenue (week to 2026-08-08), at times beating Hyperliquid's daily revenue. It monetizes mainly through trade fees (about 0.5% spot) plus a 25% referral share, not through creator profit shares. Base App pivoted from creator coins and social to "trading-first, with social layers (copy-trading, feed-trading, leaderboards) on top" in January 2026, and ended Creator Rewards in February 2026. Vector.fun was acquired by Coinbase (closed 2025-12-05) and its apps were retired. Friend.tech (2023 to 2024) remains the cautionary tale of speculative social tokens without product depth.

### Cited Findings
- **Fomo funding and users:**
  - $75M Series B led by Index Ventures, with USV and Benchmark, at a $550M valuation (announced 2026-06-22). Earlier: a $17M Series A led by Benchmark (November 2025) [OLDER].
  - 625K+ users and $4B+ cumulative volume (June 2026). Some reports give 470K to 625K users and $2.5B to $4B.
  - Reached the top 5 US iPhone finance apps.
  - [Cointelegraph](https://cointelegraph.com/news/fomo-raise-series-b-trading-app-550m-valuation); [Tangem news](https://tangem.com/en/news/investments/28926-fomo-raises-75m-series-b-surpasses-625k-users/); [TechCrunch 2025-11-06](https://techcrunch.com/2025/11/06/why-benchmark-made-a-rare-crypto-bet-on-trading-app-fomo-with-17m-series-a); [Crypto Briefing app ranking](https://cryptobriefing.com/fomo-app-surpasses-cash-app-iphone-rankings/)
- **Fomo revenue:**
  - Weekly revenue ATH of $2.64M for the week ending 2026-08-08.
  - Daily revenue of $150K to $400K, peaking near $399K and at times above Hyperliquid's.
  - Revenue comes mainly from Solana swap fees.
  - Perps were added in June 2026 via Hyperliquid and Trade.xyz, earning only about $39K in builder fees of that $2.64M week.
  - [Crypto Briefing, 2026-08-09](https://cryptobriefing.com/fomo-overtakes-hyperliquid-24-hour-revenue/); [Solana Compass](https://solanacompass.com/news/fomo-tops-hyperliquid-in-24-hour-protocol-revenue-as-solana-copy-trading-app-extends-its-run)
- **Fomo product and monetization:**
  - Features: feeds, leaderboards, copy trading, real-time view of others' trades, one balance across 4 chains, gasless swaps, Apple Pay deposits.
  - Fees: about 0.5% spot, 0.05% on select majors.
  - Referral: 25% of invitees' fees (on Solana, from the second trade).
  - No creator profit share for the traders being copied was found.
  - Sources conflict on whether copying is automated or manual "see and tap".
  - Delphi Digital: the app makes trading feel "more like scrolling a feed than sitting at a terminal".
  - [Datawallet Fomo explained](https://www.datawallet.com/crypto/fomo-app-explained); [crypto.news](https://crypto.news/fomo-secures-75m-after-turning-crypto-trading-into-a-feed/)
- **Base App:**
  - Coinbase Wallet was rebranded to Base App in July 2025 with Zora content and creator coins [OLDER].
  - Dune data: 1.6M+ creator coins, about 3M traders, $470M+ volume (crypto.news, 2025) [OLDER].
  - 0x case study (January 2026): $765M volume, 6M transactions, 581K wallets [OLDER].
  - January 2026: Jesse Pollak made trading the primary feature, with copy-trading, feed-trading and leaderboards layered on top.
  - February 2026: ended Creator Rewards and deprioritized the Farcaster feed, while keeping creator coins.
  - [BeInCrypto pivot](https://beincrypto.com/base-app-trading-strategy-pivot); [KuCoin flash](https://www.kucoin.com/news/flash/base-app-shifts-to-trading-first-strategy-maintains-mini-apps-and-creator-coins); [CoinMarketCap community](https://coinmarketcap.com/community/post/373684325); [0x case study](https://0x.org/case-studies/coinbase/base-app/); [crypto.news](https://crypto.news/zoras-creator-coins-push-base-past-solana-in-daily-token-launches-but-will-it-last/)
- **Vector.fun** was a Tensor-built Solana memecoin and social trading app ("follow other traders"). Coinbase acquired it (deal closed 2025-12-05) [OLDER], hired its 13 employees, retired the apps, and is integrating the DEX connectivity into the Coinbase app. — [The Block](https://www.theblock.co/post/379964/coinbase-vector-fun-tensor-solana-everything-exchange-vision); [MarketScreener](https://in.marketscreener.com/news/coinbase-global-inc-completed-the-acquisition-of-vector-fun-ce7d50dad18bf020)
- **friend.tech** [OLDER, 2023-2024]:
  - Charged 5% creator plus 5% platform on every key trade.
  - Daily fees fell about 90% from a $1.68M peak (2023-08-21) within weeks, and new users dropped from 20,360 to 4,484.
  - Creators collected about $44M in total.
  - The team later sent contract control to a burn address, ending fee collection.
  - Fake celebrity accounts and bots were rampant.
  - [Forkast](https://forkast.news/friend-tech-daily-fees-buyers-drop-over-90/amp/); [Finance Magnates](https://financemagnates.com/cryptocurrency/from-crypto-darling-to-debacle-in-two-weeks-friendtechs-revenue-drops-by-70); [Fortune](https://fortune.com/crypto/2023/08/28/crypto-social-app-friend-tech-falls-flat); [CoinMarketCap](https://coinmarketcap.com/academy/article/social-platform-friendtech-shuts-down-creators-walk-away-with-dollar44m); [DL News](https://www.dlnews.com/articles/defi/friend-tech-shuts-down-after-revenue-and-users-plummet/)

### Inferences
- The winning formula in 2026 is a trading app with social discovery: fiat on-ramp, gasless, feed and leaderboard. A social app with tradable people (friend.tech, creator coins) is not the formula. Coinbase's own Base App pivot confirms this, and it is the strongest available signal for a Base product like Tribe.
- Fomo shows that large revenue is possible without paying copied traders. Tribe's creator fee share is a differentiator that could recruit Fomo or Bankr power users as creators. It also needs anti-gaming: wash-trading by creators to farm fee share, and fake identities (the friend.tech lesson).

### Gaps
- Moby (Solana whale-follow app), Farcaster/Clanker creator-fee data and Fomo retention cohorts were not found. Whether Fomo auto-copy exists, and whether any creator payout exists there, is unresolved.

## 5. What gained traction vs. flopped, and why

### Takeaway
Traction comes from products that cut execution friction and own distribution: TG bots and terminals at about 1%, Fomo's feed with Apple Pay, wallets taking builder fees. Products that monetize the creator or token rather than the trade tend to flop or fade: friend.tech, creator-coin rewards, aGDP-style agent tokens, yield agents. Custodial AI agents gained buzz but showed fragile security.

### Cited Findings
- **Traction:**
  - Fomo: $2.64M weekly revenue and a $550M valuation (2026). — [Crypto Briefing](https://cryptobriefing.com/fomo-overtakes-hyperliquid-24-hour-revenue/)
  - Phantom: $20.6M in builder fees at only 0.05% (May 2026). — [CoinGecko](https://www.coingecko.com/research/publications/top-hyperliquid-builders)
  - GMGN and Axiom: tens of millions in revenue per quarter (Q1 2026). — [Crypto Briefing](https://cryptobriefing.com/gmgn-overtakes-axiom-24-hour-revenue/)
- **Faded or flopped:**
  - friend.tech: down about 90% within weeks and later shut down. — [Forkast](https://forkast.news/friend-tech-daily-fees-buyers-drop-over-90/amp/)
  - Base App Creator Rewards: ended February 2026. — [KuCoin](https://www.kucoin.com/news/flash/base-app-shifts-to-trading-first-strategy-maintains-mini-apps-and-creator-coins)
  - Vector.fun: apps retired after acquisition. — [The Block](https://www.theblock.co/post/379964/coinbase-vector-fun-tensor-solana-everything-exchange-vision)
  - Giza ARMA: sunset. — [KuCoin](https://www.kucoin.com/news/flash/giza-tech-returns-arma-and-pulse-funds-to-users-as-legacy-agents-sunset)
  - Virtuals ACP: real revenue of about $452K against $479M aGDP. — [Fundstrat](https://fundstrat.com/wp-content/uploads/2026/06/20260624-Digital-Asset-Strategy-Virtuals-Protocol-–-Growing-Agentic-GDP-Q2-Update.pdf)
  - HLP: TVL down more than 55%. — [CoinGecko](https://www.coingecko.com/learn/hyperliquid-hlp-vault-analysis)
- **Security failures:** Bankr, 14 wallets (May 2026). — [Cointelegraph](https://cointelegraph.com/news/bankr-disables-transactions-after-14-wallets-hacked)

### Inferences
- Implications for a Tribe Creator Studio:
  1. Monetize trades, not creators: fee share on Flash volume, which fits the evidence.
  2. Make "follow and copy" a feed-native, one-tap action with fiat and gasless onboarding.
  3. Sell safety as a feature: CRE pauses, scoped session-key policies, no arbitrary transfers, a lesson from Bankr.
  4. Require creator skin in the game and add anti-wash rules, borrowing from Hyperliquid's 5% stake and friend.tech's bot problems.
  5. Show realized creator earnings rather than notional volume.
  6. Plan for 70 to 90% volume drawdowns in bear phases.

### Gaps
- No primary-source per-creator earnings distributions found for any platform, for example the median vault leader's or referrer's payout. No public follower-retention data for copy products.
