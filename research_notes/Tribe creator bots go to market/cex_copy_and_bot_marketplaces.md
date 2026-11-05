# CEX copy trading and bot marketplaces: creator packaging and economics (eToro, Bitget, Binance, Bybit, OKX, 3Commas, Cryptohopper, Pionex)

Research date: 2026-11-01. Many official help-center pages are older than 2026. Each one's date is noted where it could be found. Several official pages (Bybit help center, Cryptohopper docs) timed out or returned 403, so some figures come from search snippets of official pages and not full reads. These are flagged.

## Q1. How does a user become a lead trader / bot creator, and how do they publish manual trades vs bots?

### Takeaway
On CEXs, becoming a creator is self-serve with low barriers. You need a small balance (about 100–500 USDT), sometimes full KYC, and you must not be copying anyone else. Higher tiers and better economics are then gated by AUM, copier PnL and drawdown metrics. Bot copy is a separate product: the creator launches a bot (grid, futures grid, and so on) with a profit-share setting, and copiers clone that bot's parameters. eToro is the outlier, with a curated, tiered "Popular Investor" programme that has conduct and risk-score rules.

### Cited Findings
**Bitget (manual trades: "Elite Trader")**
- Eligibility: you must not be following any elite trader, and you may hold only one elite trader account. Article dated 2023-02-16; Bitget itself marks it time-sensitive. — [Bitget support 12560603777069](https://www.bitget.com/support/articles/12560603777069)
- To appear on the leaderboard you need ≥100 USDT in the futures (or spot) account, at least one closed elite trade in a supported pair, and at least one copy pair enabled. Futures copy requires hedge mode, with max leverage 50x. Traders must follow the "Code of Conduct for Bitget Traders". — [Bitget support 12560603777069](https://www.bitget.com/support/articles/12560603777069)
- An older (2023) "TraderPro" programme used dedicated accounts funded with 10,000 USDT and a 10% profit share. — [Bitget TraderPro guide](https://www.bitget.cloud/academy/guide-to-master-bitget-copy-trade-traderpro-program)

**Bitget (bot copy: "Elite Bot Trader")**
- Anyone can apply from the Bot homepage ("Be an Elite Trader"). There is also a one-click upgrade popup when a user creates their first bot. The creator sets the pair, investment, profit share ratio and grid/futures settings, and the bot becomes copyable once created. Published 2025-09-26. — [Bitget support 12560603838661](https://www.bitget.com/support/articles/12560603838661)
- Bots using AI-recommended parameters, and bot types that don't support copy, are excluded from the elite bot list. Private bot copy is not supported, so all copy bots are public. Elite bot traders can copy other bots but not their own. Revoking Elite status requires a support ticket. — [Bitget support 12560603838661](https://www.bitget.com/support/articles/12560603838661)
- Bitget's dashboard shows creators their copiers' profit, AUM and profit-sharing detail in an "Elite Trader Center". — [Bitget support 12560603838661](https://www.bitget.com/support/articles/12560603838661)

**Binance**
- A lead trader manages one lead account (portfolio) and can copy up to ten other lead portfolios. Lead traders customise parameters such as the profit-share %. — [The Block, futures copy trading launch](https://www.theblock.co/post/255396/binance-introduces-copy-trading-feature-for-futures-markets); [Binance Spot Copy Trading guide](https://www.binance.com/en/support/faq/abc27f5949cf46d9801d31b5e33d0b38)
- Spot copy trading launched in April 2024, after futures copy in 2023. — [The Block 2024-04-23](https://www.theblock.co/post/290345/binance-spot-copy-trading)
- The "Lead Trader Growth Plan" was upgraded on 2025-03-27. Advanced benefits are gated on min margin balance, min 30-day copy-trader PnL, max 7-day MDD *or* posting on X/social media, and min AUM. Applications are reviewed at Binance's discretion. The exact thresholds could not be read; the snippet was garbled and showed only a "500" value. — [Binance Lead Trader Growth Plan FAQ](https://www.binance.com/en/support/faq/3160c961b2734d1cbb5342d1e86c6cdb); [Binance announcement](https://www.binance.com/en-AE/support/announcement/detail/2431be3394b348dfa90d4e3658335ac5)
- Older (2023–24) Elite tiers started at ≥400,000 USDT copier AUM. Binance has a separate "Spot Copy Trading Elite Trader Program". — [Binance futures Elite Trader Program announcement](https://www.binance.com/cs/support/announcement/binance-futures-copy-trading-launches-elite-trader-program-for-lead-traders-6ce225379e184752a973279848bea3c0); [Binance Spot Elite Trader Program guide](https://www.binance.com/en/support/faq/2fc0125418c94bfcbefc8f9b4fe5aa72)

**Bybit**
- Bybit offers "Copy Trading Classic" (Master Traders), "Copy Trading Pro" (Pro Masters, by application) and "SyncMaster". — [Bybit: Introduction to Copy Trading Pro](https://bybit.nl/en/help-center/article/Introduction-to-Copy-Trading-Pro); [How to apply to become a Pro Master](https://bybit.nl/en/help-center/article/How-to-Apply-to-Become-a-Pro-Master-Copy-Trading-Pro); [SyncMaster features](https://bybit.nl/en/help-center/article/SyncMaster-Features-Copy-Trading)
- Third-party (undated, possibly outdated) onboarding requirements are ≥100 USDT in the master copy account, plus new-trader missions: complete 3 derivatives trades and make 50 USDT. — [TradersUnion Bybit review](https://tradersunion.com/brokers/crypto/view/bybit/how-does-bybit-copy-trading-work/)

**OKX**
- Spot lead trading requires full identity verification (KYC). A third-party guide says ≥500 USDT in the trading account is required. — [OKX spot lead trading guidelines](https://okx-api.aperture.finance/help/what-guidelines-are-there-for-spot-lead-traders) (OKX help mirror); [TradersUnion OKX](https://tradersunion.com/brokers/crypto/view/okex/copy-trading/)
- A first-time lead trader with no 30-day record starts at level 1. — [OKX lead traders FAQ](https://www.okx.com/en-eu/help/lead-traders-faq)
- OKX has bot copy trading, but the only finding is an FAQ note telling users to contact support to cancel bot copy. No bot-creator rules were found. — [OKX lead traders FAQ mirror](https://okx-api.aperture.finance/help/lead-traders-faq)

**eToro (Popular Investor, "PI")**
- Entry: ≥$2,000 unrealised equity, full name and clear profile photo, and ≥2 months of trading history on eToro. — [eToro Popular Investor page](https://www.etoro.com/copytrader/popular-investor/)
- Ongoing standards: max daily risk score 7; weekly drawdown no worse than -25%; no single position >50% of portfolio; ≥30% profitable months; ≥3 instruments traded in 12 months; no customer block. — [eToro PI page](https://www.etoro.com/copytrader/popular-investor/)
- Tiers are Cadet → Champion → Elite → Elite Pro, with automatic upgrade when criteria are met. Minimums:

| Tier | Min avg AUC | Min avg equity | Min avg copiers | Min time at level |
|---|---|---|---|---|
| Cadet | $50K | $2K | 5 | 2 months |
| Champion | $400K | $10K | 10 | 4 months |
| Elite | $10M | $50K | 10 | 2 months |
| Elite Pro | unclear | $100K | unclear | unclear |

  The page table was partially garbled for Elite Pro. — [eToro PI page](https://www.etoro.com/copytrader/popular-investor/)
- Payment conditions: ≥5 verified copiers, a complete bio, no copy block, at least one 100-word news-feed post per month, and risk score below 7. — [eToro PI page](https://www.etoro.com/copytrader/popular-investor/)
- Manual-only: eToro PIs copy a person's whole portfolio. There is no user-built bot marketplace on eToro. eToro's "Smart Portfolios" are curated by eToro and were not covered here.

**Cryptohopper (marketplace)**
- Sellers list four product types: strategies, templates, copy bots and signals ("signalers"). Copy Bot sellers cannot change the exchange or quote currency once it is set. — [Cryptohopper docs: copy bot seller settings](https://docs.cryptohopper.com/docs/sellers/what-are-the-different-settings-for-adding-a-copy-bot-as-a-marketplace-seller) (403 on fetch; snippet only); [Cryptohopper docs: add strategy or template](https://docs.cryptohopper.com/es/docs/sellers/add-strategy-or-template); [How to sell on Cryptohopper](https://cryptohopper.com/ko/blog/how-to-sell-on-cryptohopper-7232)

**3Commas**
- 3Commas' main products are DCA, Grid and Signal bots. Signal Bots run TradingView webhook signals. A December 2023 year-in-review listed "sell your Signal Bot in the 3Commas Marketplace" as a roadmap item. It was not confirmed as launched. — [3Commas 2023 year in review](https://3commas.io/ru/blog/3commas-2023-year-in-review-unleashing-advanced-features)

**Pionex**
- Pionex has "CopyBot" with a "Discover" feed of creators' bots. Creators set the profit-share ratio. — [Pionex notice, 2025-05-20](https://intercom.help/pionex/en/articles/14613057-notice-regarding-the-adjustment-of-copy-trade-s-profit-sharing-fees)

### Inferences
- The industry pattern is a near-zero barrier to *publish* and a high barrier to *earn more*, through tiers tied to AUM, copier PnL and drawdown. Tribe can copy this: anyone can publish a trade feed or bot, while the profit-share ceiling and discovery ranking unlock with verified onchain track record.
- Bitget's bot-copy UX (a one-click "make this bot copyable" popup at bot creation, with preset share options) is the clearest template for a Creator Studio "publish bot" flow.
- eToro's conduct rules (risk-score cap, drawdown cap, concentration cap, mandatory monthly posts) can work as rules enforced onchain or by a guard (for example a CopyGuard-type check) rather than by an editorial team.

### Gaps
- Exact current Binance Growth Plan thresholds (the official table was garbled).
- Bybit's official current master-trader application criteria (the help-center fetch timed out).
- OKX tier table (AUM per level) for futures; bot-creator eligibility.
- Pionex creator eligibility and which bot types (spot grid, futures grid, DCA) can be shared.
- Whether the 3Commas marketplace now lets third parties sell bots or signals: no confirmation found.

## Q2. Creator economics: profit share %, high-water mark, settlement, eToro AUC pay, marketplace splits

### Takeaway
On CEXs, profit-share for manual lead traders clusters at **10% by default, rising to 13–30% with tier**. Fees are charged only on realised profit and netted against losses, typically settled **weekly (Binance, OKX)** or **daily (Bitget)**. Bot creators on Bitget choose fixed presets (**0/10/20/30%**), settled when the bot terminates. Pionex keeps **50%** of the creator's profit-share. Marketplaces (Cryptohopper) take **30%** of sales, or **15%** for exclusive sellers. eToro pays an AUM-style **1.5%/yr of average AUC**, paid monthly, rather than a profit share.

### Cited Findings
**Bitget**
- Max profit share by tier for manual elite traders: Bronze 10%, Silver 10%, Gold 12%, Platinum 14%, Extraordinary 15%, Legend 20%. This applies in non-private mode; spot elite traders were capped at 10%. The BGB lock-up is no longer required. Dated 2023-02-16. — [Bitget support 12560603777069](https://www.bitget.com/support/articles/12560603777069)
- Profit share is paid only on profitable orders, with no share on losing orders. It is distributed **daily at 00:00 GMT+8**. For open positions, profit is distributed the day after close. Major code-of-conduct violations downgrade the trader's tier and ratio. — [Bitget support 12560603777069](https://www.bitget.com/support/articles/12560603777069)
- Bot copy uses fixed presets of **0%, 10%, 20% or 30%**, with no custom values. Profit share is settled **after the bot terminates**, if the bot made a profit. "Losses are not shared." Copier profit = realised profit − profit share. Published 2025-09-26. — [Bitget support 12560603838661](https://www.bitget.com/support/articles/12560603838661)
- A third-party review says lead traders also earn part of trading fees, about 10% of profits plus fee rebates. — [Skrumble Bitget review](https://www.skrumble.com/crypto-exchanges/bitget-review/)

**Binance**
- At launch (2023), lead traders received **10% profit share plus a 10% trading-commission rebate** from copiers. — [The Block 2023](https://www.theblock.co/post/255396/binance-introduces-copy-trading-feature-for-futures-markets)
- The settlement cycle is **weekly**, from 00:00 UTC Monday to 23:59:59 UTC Sunday. Profits are settled only when the copy portfolio has no open orders and are paid out by end of Monday. Profit share is also released when a copier stops copying or the lead closes the portfolio. — [Binance Spot Copy Trading guide](https://www.binance.com/en/support/faq/abc27f5949cf46d9801d31b5e33d0b38)
- No official Binance high-water-mark formula was found. An industry example is Matrixport: share = max(cumulative profit − HWM, 0) × ratio, settled weekly. — [Matrixport profit-sharing rules](https://matrixport.helpjuice.com/en_US/matrixport私域带单分润规则); [BitMEX explainer on HWM](https://www.bitmex.com/blog/crypto-copy-trading-fees)

**Bybit**
- The profit-share ratio varies by Master Trader level; at 10%, followers give 10% of their copy profit. — [Bybit: Copy Trading Profit Sharing Explained](https://bybit.nl/en/help-center/article/Copy-Trading-Profit-Sharing-Explained) (snippet; fetch timed out)
- Copy Trading Pro: Pro Masters can set up to **30%**. — [Bybit Copy Trading Pro profit sharing](https://bybit.nl/en-NL/help-center/article/Copy-Trading-Pro-Profit-Sharing-Explained)
- At the 2022 launch, masters received 10% of followers' profit. — [Bybit launch press release](https://www.newsfilecorp.com/redirect/p4r1ksNXA1)
- An unofficial claim that masters "typically earn 10–15%" is from a non-official guide (April 2026). — [ai-trading-ranked](https://ai-trading-ranked.pages.dev/posts/bybit-copy-trading-guide)

**OKX**
- Copy traders share "up to 30%" of profit based on lead trader level; the help page's example is an L2 trader at 10%. Lead traders can change the ratio at most 3 times a month. Settlement is **weekly**, Monday 00:00 to Sunday 23:59:59 (UTC+8), and calculated each Monday. Futures settle only when there are no linked open positions; spot settles when all crypto bought that week is sold, otherwise it rolls over. Profits and losses are netted within a cycle, and excess withholding is returned to the copier. Weekly profit share took effect 2023-09-10. The page was published 2023-09-04 and **last updated 2026-08-19** (current). — [OKX: Trader profit sharing rules](https://www.okx.com/help/lead-traders-trader-profit-sharing-rules)
- Spot: maximum ratio 13%. Levels are based on 90-day average AUM of spot lead trades. A third-party summary says the range is 8% (AUM ≤100K USDT) to 13% (AUM >1M USDT). — [OKX spot copy guidelines](https://www.okx.com/help/copy-traders-spot-copy-trading-guidelines); [OKX help mirror](https://okx-api.aperture.finance/help/copy-traders-spot-copy-trading-guidelines)

**eToro Popular Investor**
- Monthly payment = rate × average AUC ÷ 12. Cadet: 1.5% of AUC, with a **min $250 and max $500/month**. Champion and Elite: 1.5% annual, Elite fixed at 1.5% on AUC up to $10M. Elite Pro: 1.5% up to $20M and 0.5% above, or 1.5% up to $30M and 0.5% above with 5 years on the platform. AUC above $100M is paid at 0.25%. Payments are made monthly by the 10th into the eToro account and can be withheld for breaches. — [eToro PI page](https://www.etoro.com/copytrader/popular-investor/)
- Extra benefits include Club tier upgrades (Platinum, Platinum+, Diamond), a $1,000 course subsidy, zero stock commission, marketing features and an annual summit. — [eToro PI page](https://www.etoro.com/copytrader/popular-investor/)
- eToro marketing elsewhere says "up to 2%" of AUM. This is older and conflicts with the current page; the current page is the authority. — [eToro: PI programme gives traders extra income](https://etoro.com/news-and-analysis/etoro-updates/etoros-popular-investor-program-gives-successful-traders-extra-income)
- The payment is a fee on assets copied, paid by eToro, rather than a share of copier profit. Copiers pay no per-leader profit share.

**Pionex**
- From **16:00 UTC, 2025-05-20**, Pionex keeps **50%** of the creator-set profit-share fee for copies made through CopyBot "Discover", and the creator gets the other 50%. Copiers' fee ratio is unchanged. The split is charged when the copier closes a profitable order. The creator-settable range was not stated. — [Pionex notice](https://intercom.help/pionex/en/articles/14613057-notice-regarding-the-adjustment-of-copy-trade-s-profit-sharing-fees)

**Cryptohopper**
- Cryptohopper takes **30%** commission on every marketplace sale. **Exclusive sellers** (who sell only on Cryptohopper, by arrangement) pay **15%**, described as a 50% reduction. The exclusivity programme also covers signalers. — [Cryptohopper docs: seller settings](https://docs.cryptohopper.com/nl/docs/sellers/what-are-the-different-settings-for-adding-a-strategy-or-template-as-a-marketplace-seller); [Exclusivity program](https://docs.cryptohopper.com/ru/docs/sellers/exclusivity-program)
- Since May 2024, sellers and affiliates pay a payout fee on withdrawal requests; the amount was not found. — [Cryptohopper payout update](https://cryptohopper.com/es/blog/affiliate-and-marketplace-seller-crypto-payout-update-cryptohopper-10511); [Marketplace payments update](https://cryptohopper.com/nl/blog/cryptohopper-marketplace-payments-update-10843)
- The model is fixed-price subscription or one-off sales (sellers set prices), not a profit share.

**3Commas**
- No current seller or revenue-share terms were found. The revenue found is subscription plus a referral programme paying 25% of first-level referred subscriptions (critical review source). — [DigitalMoneyBox critique](https://digitalmoneybox.com/news/blockchain/understanding-3commas-a-critical-look-at-its-features-risks-and-promotional-model); [3Commas 2023 review](https://3commas.io/ru/blog/3commas-2023-year-in-review-unleashing-advanced-features)

### Inferences
- There are three monetisation archetypes for Tribe to choose from or combine: (a) **performance fee** on copier realised profit (CEXs: 10% default, 30% cap); (b) **AUM fee paid by the platform** (eToro 1.5%/yr, which keeps copiers fee-free and aligns with the platform's own revenue); (c) **subscription or marketplace sale** with a platform cut (Cryptohopper 30/15%).
- Platform take on creator performance fees varies: Pionex takes 50%, while Bitget, Binance, OKX and Bybit appear to pass the full ratio to the leader (not verified) and earn on trading fees instead. Binance also added a commission rebate to leaders.
- Netting losses within a cycle plus settling only when no positions are linked (OKX, Binance) is a cheap stand-in for a high-water mark. A true per-copier HWM is the stronger, fairer design and is easy to enforce onchain in a vault or position contract.
- Bot profit-share settled "at bot termination" (Bitget) is simpler than periodic settlement, but it delays creator income and encourages leaving bots running.

### Gaps
- Current (2026) Bitget tier criteria and whether the 2023 ratios still apply; whether Bitget futures moved to a 30% cap.
- Bybit Classic level table (levels → %).
- Whether CEXs take any cut of the leader profit share.
- Cryptohopper typical price ranges for strategies, signals and copy bots, and the payout-fee amount.
- Pionex creator-set range.

## Q3. Follower-side controls; bot copy vs trade copy

### Takeaway
Futures trade-copy offers the richest risk controls: fixed-ratio or fixed-margin sizing, max position per contract, a daily cap, per-order stop-loss, slippage limits and a leverage override. Bot copy is coarse: the copier sets an investment amount for a cloned bot and can stop at any time, and the copy ends when the creator ends the bot.

### Cited Findings
- **Bybit modes**: "Smart Copy" uses a fixed ratio based on master order cost and the follower's balance. "Advanced Copy" uses a fixed margin per order, for example 100 USDT. — [Bybit: Copy Mode and Parameter Settings](https://bybit.nl/en/help-center/article/Copy-Trading-Copy-Mode-and-Parameters-Settings)
- **Bybit limits**: max position margin per contract (stops copying that contract once reached) and a max daily position limit (stops new opens for the day). — [Bybit: Copy Mode and Parameter Settings](https://bybit.nl/en/help-center/article/Copy-Trading-Copy-Mode-and-Parameters-Settings)
- **Bybit per-order stop-loss ratio**: a 50% setting on 100 USDT margin caps the loss at 50 USDT. If the master closes first, the SL is cancelled. — [Bybit: Copy Mode and Parameter Settings](https://bybit.nl/en/help-center/article/Copy-Trading-Copy-Mode-and-Parameters-Settings)
- **Bybit max slippage**: the copy order is skipped if price moves beyond the limit. The default is 0.5–1.5% by pair. A lower slippage limit protects the entry price but increases failed copies. — [Bybit: Copy Mode and Parameter Settings](https://www.bybit.com/fr-FR/help-center/article/Copy-Trading-Copy-Mode-and-Parameters-Settings)
- **Bybit leverage**: fixed leverage (for example 5x) or follow the master. — [Bybit: Copy Mode and Parameter Settings](https://bybit.nl/en/help-center/article/Copy-Trading-Copy-Mode-and-Parameters-Settings)
- **Bybit "Forced Sync"**: when a master enables it, followers can change only the investment amount and Copy Stop Loss; all other parameters are locked to the master. — [Bybit: Copy Mode and Parameter Settings](https://bybit.nl/en/help-center/article/Copy-Trading-Copy-Mode-and-Parameters-Settings)
- **Bitget bot copy**: copiers can stop at any time. If the creator ends the bot, the copy ends. Copiers receive realised profit minus the share. — [Bitget support 12560603838661](https://www.bitget.com/support/articles/12560603838661)
- **eToro** enforces leader-side risk caps (risk score ≤7, weekly DD ≥ -25%, single position ≤50%), which act as indirect follower protection. — [eToro PI page](https://www.etoro.com/copytrader/popular-investor/)
- Binance reportedly has a $10 minimum copy amount (unofficial, promotional source; treat with caution). — [smalldrift guide](https://smalldrift.pages.dev/articles/binance-copy-trading-2026-guide-fees-risks-profit/)

### Inferences
- A Tribe follower control set should at minimum include: sizing mode (proportional vs fixed per order), max per order, max total exposure per leader, a daily cap, copy-level stop-loss / max-drawdown auto-stop, max slippage (skip if exceeded), and a leverage override. These map naturally onto onchain guard checks.
- Bybit's Forced Sync shows a creator-side choice: give followers full control or lock them to a faithful replica. Tribe could expose this as a creator setting with a disclosure.
- Bot copy should be presented as "clone a running strategy" (parameters plus an independent lifecycle). This differs from trade mirroring, and the UI should say so.

### Gaps
- Official Bitget, OKX and Binance follower parameter lists (not fetched within budget).
- Whether any CEX offers a portfolio-level max-drawdown auto-stop, rather than per order; not confirmed.

## Q4. Scale and adoption data points

### Takeaway
Reliable official copy-trading-specific scale numbers are scarce. Most figures come from secondary or affiliate sources or are platform-wide.

### Cited Findings
- Bitget: ">190,000 professional traders" (2025 secondary review, unverified). — [Skrumble Bitget review](https://www.skrumble.com/crypto-exchanges/bitget-review/)
- Bitget: >100,000 users realised profit from futures copy trading in H1 (year not stated, likely 2025); Gen Z = 44% of copy traders (Bitget report). — [Bitget report](https://www.bitget.cloud/asia/blog/articles/bitget-report-44-percent-of-copy-traders-are-gen-z); [Finance Magnates](https://www.financemagnates.com/cryptocurrency/gen-z-dominates-crypto-copy-trading-space-85-make-profit/)
- Bybit: 76M+ users platform-wide (not copy-specific). — [Bybit copy trading announcement page](https://bybit.nl/en-NL/announcement-info/copy-trade)
- eToro: "over 40 million" registered users platform-wide; no PI count published on the PI page. — [eToro PI page](https://www.etoro.com/copytrader/popular-investor/)

### Inferences
- The lack of published copier PnL aggregates is itself a differentiator opportunity. An onchain Tribe can publish verifiable copier-outcome stats (leader PnL vs copier PnL).

### Gaps
- Official counts of lead traders, copiers or copied AUM for Binance, OKX, Bybit, Pionex, Cryptohopper and 3Commas were not found in this pass.

## Q5. Criticism and complaints

### Takeaway
The recurring critiques are: inflated or fake short-term track records; execution lag that lets leaders exit before followers; incentives tied to followers or volume rather than copier outcomes; and survivorship bias in leaderboards. Most sources are blogs or exchange explainers, not regulators.

### Cited Findings
- Fraudulent lead traders artificially inflate short-term returns to attract followers. — [Arkham research, 2026-08-10](https://info.arkm.com/research/crypto-copy-trading-what-is-it-and-how-to-do-it)
- Followers are filled after the leader, so the leader can close first at better prices, profiting while followers lose. — [cryptoradarnews (blog, low authority)](https://cryptoradarnews.blogspot.com/2025/06/the-hidden-risks-of-binance-copy.html)
- Platforms pay leaders on followers or volume rather than profitability, and the system "rewards the risk". — [BrokerListings: copy-trading blow-ups](https://brokerlistings.com/research-hub/copy-trading-blow-ups)
- An oft-cited study says 97% of lead traders were personally profitable but only 43.6% made profits for followers. The study author could not be verified. — [KuCoin learn article, 2026-08-21](https://www.kucoin.com/learn/trading/20260821article)
- Onchain "FOMO" copy trading research found ~94% of wallets with losses (onchain, adjacent). — [Yellow.com](https://yellow.com/news/fomo-copy-trading-94-percent-wallet-losses)
- An unofficial guide headline claims "80% of copiers lose" on Binance (promotional source, unverified). — [smalldrift](https://smalldrift.pages.dev/articles/binance-copy-trading-2026-guide-fees-risks-profit/)
- Lead traders have no fiduciary duty, and followers have little recourse. — [The Edge of Reason (Substack)](https://theedgeofreason.substack.com/p/the-hidden-risks-of-copy-trading)
- Platform-side mitigations exist: Bitget downgrades tier and share for code-of-conduct breaches; eToro withholds payments for guideline breaches and enforces risk caps; Bitget excludes AI-parameter bots from its elite bot list. — [Bitget 12560603777069](https://www.bitget.com/support/articles/12560603777069); [eToro PI page](https://www.etoro.com/copytrader/popular-investor/); [Bitget 12560603838661](https://www.bitget.com/support/articles/12560603838661)

### Inferences
- Design responses for Tribe: rank and pay on *copier-realised* PnL rather than leader PnL or AUM; use a per-copier HWM; require minimum track-record age before profit-share unlocks; show copier-vs-leader slippage; block leader front-running by executing copies atomically or in the same block where possible; show delisted and blown-up leaders to counter survivorship bias.

### Gaps
- No regulator actions specific to these CEX copy programmes were found in this pass. No peer-reviewed data on survivorship in CEX leaderboards was found.
