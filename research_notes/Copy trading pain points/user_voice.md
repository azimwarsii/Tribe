# Voice of the Customer: Complaints and Unmet Wishes in Copy Trading, Social Trading and Trading Bots

Research date: 2026-10-28. Reviews were sampled from 2023 to 2026, with a few older ZuluTrade reviews labelled as such.

**Sampling method (read this first)**
- **Sources I could reach:** Trustpilot (first page, or first page sorted by recency) for ZuluTrade (pages 1 and 2), 3Commas, Cryptohopper, Pionex, eToro (recent page plus the 1-star filter), Bybit and Bitget. I also read the TradingView broker-review page for Bitget.
- **Sample size:** about 185 Trustpilot reviews, or about 165 unique once the eToro overlap is removed. About 143 of them contain at least one complaint. Add 23 TradingView reviews.
- **How reviews were coded:** a summarising fetch tool tagged each review into complaint categories. One review can carry several tags, so tags count mentions, not reviews. I then merged categories across products by hand. The counts are approximate. Use them to rank categories, not as exact figures.
- **Sources I could not reach:** Reddit (old.reddit, www.reddit.com, the JSON API and a reader proxy all returned 403 or were blocked). App Store and Google Play review pages did not render (404 or JavaScript-only). X, YouTube and Quora were not sampled. Web search did not surface Reddit threads either. **No Reddit, app-store or social-media tallies are included.** This is the largest gap in this file. See the Gaps sections.
- **Known biases:**
  - Trustpilot over-represents angry users and money-access problems.
  - Exchange pages (Bybit, Bitget, eToro) are dominated by account-freeze complaints, not copy-trading complaints.
  - The eToro 1-star sample is filtered to negatives on purpose.
  - Single-page samples overweight the most recent events. For 3Commas, that is the forced V2 migration in Aug–Oct 2026.

---

## Q1. Top complaint categories, how often they appear and how severe they are (across products)

### Takeaway
The most common complaints are about money access and support, not copy-trading mechanics. The two biggest categories are unresponsive or scripted support (about 64 tags) and frozen withdrawals or locked accounts (about 40). Scam accusations (about 33) and app bugs or reliability problems (about 37) come next. Complaints specific to copying cluster on the dedicated platform (ZuluTrade): copied trades missing or mismatched, misleading leader stats, leader blow-ups and being unable to close or stop copying. On the bot platforms (3Commas, Cryptohopper), billing, refunds and forced platform changes dominate.

### Cited Findings

**Sample frames and headline ratings**
- **ZuluTrade:** TrustScore 1.3 ("Bad") from 94 reviews; 63% are 1-star. Page 1 had 20 reviews (Sep 2024–Sep 2026). Page 2 had 23 (mostly 2023–2024, a few from 2019–2022). — [Trustpilot ZuluTrade p1](https://www.trustpilot.com/review/zulutrade.com); [p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **3Commas:** TrustScore 3.4 from 1,764 reviews. The 21 reviews on page 1 (mostly Aug–Oct 2026) are dominated by the forced V1-to-V2 migration. — [Trustpilot 3Commas](https://www.trustpilot.com/review/3commas.io)
- **Cryptohopper:** TrustScore 3.6 from 364 reviews; 59% 5-star, 25% 1-star. Of 22 reviews (2023–2026), 15 contain a complaint. — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Pionex:** TrustScore 2.5 ("Poor") from 636 reviews; 40% 1-star. Of 23 reviews (2024–2026), 17 contain a complaint. — [Trustpilot Pionex](https://www.trustpilot.com/review/pionex.com)
- **eToro:** TrustScore 4.0 from 32,285 reviews; 20% 1-star. On the most-recent page (Oct 2026), 13 of 21 reviews are 5-star, and several of those praise loyalty-club events ("Diamond dinner", football tickets) rather than the product. The 1-star filter gave 20 negative reviews (Oct 2026). — [Trustpilot eToro recent](https://www.trustpilot.com/review/etoro.com?sort=recency); [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
- **Bybit:** TrustScore 2.4 from 7,735 reviews. Of 22 reviews (Jun–Oct 2026), 17 are primarily about frozen funds or restricted accounts, and none mention copy trading. — [Trustpilot Bybit](https://www.trustpilot.com/review/www.bybit.com)
- **Bitget:** TrustScore 1.7 from 1,694 reviews; 75% 1-star. Of 21 reviews (Apr–Oct 2026), 7 are primarily about locked funds, and none mention copy trading or bots. — [Trustpilot Bitget](https://www.trustpilot.com/review/bitget.com)
- **Bitget on TradingView:** 19 of 23 visible reviews are dated the same day (Jun 28) and are generic positive one-liners ("The platform feels modern without being confusing."). That pattern is consistent with solicited or astroturfed reviews. — [TradingView Bitget reviews](https://in.tradingview.com/broker/Bitget/reviews)

**Aggregated complaint map** (mentions across about 143 complaining Trustpilot reviews; multi-label)

| Rank | Category | Approx. mentions | Where it concentrates | Severity |
|---|---|---|---|---|
| 1 | Customer support: unresponsive, AI or scripted replies, tickets closed unresolved | ~64 | ZuluTrade 16, eToro 15, Pionex 11, Bybit 8, Cryptohopper 7, 3Commas 4, Bitget ~3 | Annoyance, but it amplifies every money problem |
| 2 | Withdrawal frozen, account restricted or locked, compliance limbo | ~40 | Bybit 17, eToro 9, Bitget 7, Pionex 5, ZuluTrade 2 | Money at risk (up to ~$30K in one Bybit review) |
| 3 | App bugs, outages, platform reliability, disconnects | ~37 | ZuluTrade 14, Cryptohopper ~8, 3Commas 5, eToro 5, Pionex 3, Bitget 2 | Mixed; often causes losses |
| 4 | Scam or fraud accusation against the platform | ~33 | ZuluTrade 7, Pionex 6, 3Commas 5, eToro 5, Cryptohopper 4, Bybit 4, Bitget 2 | Trust |
| 5 | Subscription, billing or refund disputes (bots) | ~19 | 3Commas 12, Cryptohopper 5, ZuluTrade 2 | Money (fees) |
| 6 | Forced platform or app changes that delete bots, data or features, or break stop-loss editing | ~15 | 3Commas 11; eToro 2; Bitget 1; ZuluTrade 1 | Money (forced closures at a loss) plus annoyance |
| 7 | Losses from copying a leader, leader blow-ups, bot or strategy losses | ~15 | ZuluTrade 7, Cryptohopper 3, 3Commas 2, Pionex 2, eToro 1 | Money lost |
| 8 | Hidden or unclear fees (conversion, per-ticket commissions, recovery fees, VAT buried at checkout) | ~14 | eToro 5, ZuluTrade 3, Pionex 3, 3Commas 1, Bybit 1, Bitget 1 | Money |
| 9 | Copied trades missing, not matching the leader, wrong copy ratio, copy disconnected | ~13 | ZuluTrade 12, eToro 1 | Money lost; execution |
| 10 | Misleading leader stats, leaderboards or marketplace strategies | ~12 | ZuluTrade 9, Cryptohopper 2, eToro 1 | Trust; leads to money lost |
| 11 | KYC, verification or onboarding friction | ~8 | eToro 3, Pionex 2, ZuluTrade 2, Bitget 1 | Annoyance that becomes a funds lock |
| 12 | Cannot close, adjust or stop copying positions; cannot set or edit SL/TP | ~7 | ZuluTrade 5, eToro 2 | Money lost |
| 13 | Notifications and alerts: missing, late, or spam | ~6 | ZuluTrade 2; Cryptohopper, Pionex, eToro and Bitget 1 each | Annoyance that becomes losses |
| 14 | Unfair execution or unexpected liquidation | ~4 | Bitget 2, Pionex 2 | Money lost |
| 15 | Deposits not credited | ~4 | Bybit 2, Pionex 2 | Money at risk |

**Representative quotes**
- **ZuluTrade (Sep 25, 2026):** "8 months later, it remains unresolved." Positions could not be closed and the data was stale. — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Bybit (Jun 4, 2026):** about $30K frozen with "no way to withdraw my own funds." — [Trustpilot Bybit](https://www.trustpilot.com/review/www.bybit.com)
- **eToro (Oct 25, 2026):** "Withdrew money & havent received it." The reviewer reached only bots, and the ticket was closed without resolution. — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
- **3Commas, forced V2 migration (Sep 19, 2026):** "None of my 100+ bots were preserved." DCA bots were shut down at a loss. — [Trustpilot 3Commas](https://www.trustpilot.com/review/3commas.io)
- **3Commas (Aug 23, 2026):** "They unilaterally decided to upgrade to V2 while your existing bots and trades can not transfer." — [Trustpilot 3Commas](https://www.trustpilot.com/review/3commas.io)
- **3Commas (May 26, 2026, 3-star):** the company buries "the real cost in tiny font at the bottom of the payment page." — [Trustpilot 3Commas](https://www.trustpilot.com/review/3commas.io)
- **Cryptohopper (Aug 3, 2025):** "their bot didn't perform a single trade based on TradingView webhook alerts" over 7 months. — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Pionex (May 15, 2026):** "They are holding my $18.90 USDC hostage." Pionex asked for a $20 recovery fee, so this is a small-balance problem. — [Trustpilot Pionex](https://www.trustpilot.com/review/pionex.com)
- **eToro (Oct 15, 2026):** after the reviewer stopped copying, they were "charged a flat $1.00 - $2.00 commission on EVERY SINGLE micro-ticket." The micro-positions were left over from a Popular Investor copy. This is a small-balance and fee problem specific to copying. — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)

**Large historical security incidents (bots; outside the review tallies, but central to trust)**
- **3Commas API-key leak, Oct–Dec 2022:** 3Commas first denied it was the source, then admitted it. Estimates of losses range from $6M to $14.8M (44 victims) to more than $22M. A journalist interviewed nearly 60 users who reported unauthorized trades. — [BleepingComputer](https://www.bleepingcomputer.com/news/security/crypto-platform-3commas-admits-hackers-stole-api-keys); [Decrypt](https://decrypt.co/118094/after-repeated-denials-3commas-admits-it-was-source-for-earlier-hacks?amp=1); [Cointelegraph](https://cointelegraph.com/news/3commas-ceo-confirms-api-key-leak-following-warning-from-cz)
- **Banana Gun (Telegram bot), Sep 2024:** user wallets were drained. Reports range from about 563 ETH (about $1.4M) to $2M. The team said it would compensate 11 users with about $3M. Sources conflict on the figures. — [The Block](https://www.theblock.co/post/317282/banana-gun-telegram-bot); [Cointelegraph](https://cointelegraph.com/news/telegram-bot-banana-gun-users-drained-500-ether)
- **Maestro (Telegram bot), Oct 2023:** a smart-contract exploit took more than $500K, and users were reimbursed. — [Revoke.cash](https://revoke.cash/exploits/maestro)
- **BonkBot:** a reviewer reports that a wallet-drain incident was traced to Solareum, a separate bot into which users had also imported their private keys. The reviewer adds that "every Telegram trading bot asks you to trust it with a wallet's private key." This comes from a single third-party review and is not independently verified. — [MadeOnSol BonkBot review](https://madeonsol.com/blog/bonkbot-review)

### Inferences
- **Severity ranking:** the categories with the most money at stake are frozen funds, leader blow-ups, missed or unmatched copies, inability to close positions, and API-key or wallet compromise. The most frequent category, support, is not a direct loss, but almost every money complaint also says "no one helped". Support failure turns a recoverable incident into a trust breakdown.
- **Product mix:** on general exchanges (Bybit, Bitget), copy trading barely appears in Trustpilot reviews. 0 of 43 sampled reviews mention it. Copy-trading pain on exchanges likely lives in Reddit, Telegram and X rather than Trustpilot. That is unconfirmed because Reddit was inaccessible.
- **Platform changes:** forced platform changes (3Commas V2, eToro's app redesign) form a distinct and under-appreciated category. Users experience the loss of their configured automation as a loss of money and control.

### Gaps
- No Reddit, App Store, Google Play, X or YouTube tallies. Every attempt to fetch Reddit returned 403, and app-store pages did not render. Frequencies for Binance and OKX copy trading and for Telegram bots could not be grounded in review counts.
- I did not sample a Trustpilot page specifically for Binance or OKX.
- The counts rest on single-page samples coded by a summarisation tool. They should be treated as ±30% ranking signals.

---

## Q2. Emotional and behavioural experiences (FOMO, panic unfollowing, misleading leaderboards, trust breakdown, confusion)

### Takeaway
In reviews, the emotional arc is consistent: early wins, then sudden loss when a leader blows up, then a feeling of being deceived, often generalised to "the boards are fake" or "it's a scam". Academic and survey evidence supports the behavioural side: followers pick on recent returns, take more risk and overreact. I found no direct review-level evidence of "panic unfollowing at the bottom". That probably lives in Reddit threads I could not reach.

### Cited Findings
- **Leaders blow up eventually:** "The leaders may look profitable but eventually they all have lossess that are not managed at all" (ZuluTrade, Jun 8, 2023). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **The boards feel fake:** "there are no traders,the boards are fake" (ZuluTrade, Nov 20, 2025). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Sudden wipe-out:** "A week later the entire portfolio was wiped." A $2,000 portfolio; the reviewer calls it a "rug pull" (ZuluTrade, Mar 5, 2026). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Demo-account leaders:** reviewers describe leaders trading demo accounts, blow-ups, and copied trades they could not see on the dashboard: "couldn't see a trade you were in" (ZuluTrade, Mar 22, 2025). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **"Guru" disappointment on eToro:** "after like 12 month copying is -20%" (Oct 23, 2026). The reviewer questions the guru's track record. — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
- **Leader exploiting trust:** a trader "asks for more without providing the service" (ZuluTrade, Mar 15, 2025, $800+ lost). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Buying a strategy that lost money:** a Cryptohopper user bought a marketplace strategy that lost money over six months: "The whole platform is a scam.." (Jun 16, 2025). — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Loss right after setup:** "Set up with premium settings and subscriptions only to lose $800 in a few hours" (Cryptohopper, Apr 30, 2026). — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Bots feel rigged:** "Bots are being manipulated until your money is wiped out" (Pionex, Aug 16, 2026). — [Trustpilot Pionex](https://www.trustpilot.com/review/pionex.com)
- **Research, risk-taking:** a 2023 *Scientific Reports* study on eToro found followers "are prone to take more risk, and they tend to overreact when the signal providers take positions." This is cited via a search summary; I could not open the full text because of a paywall redirect. — [Nature Sci Rep 2023](https://www.nature.com/articles/s41598-023-49648-3)
- **Research, selecting on returns:** a Traders Union survey of 1,420 retail traders found that 36% prioritise past returns over other metrics when choosing whom to copy. This is self-reported survey data from a broker-affiliated publisher. — [Traders Union](https://tradersunion.com/interesting-articles/copy-trading-smart-investing-or-hidden-risk-tu-research/)
- **Research, losses on copied trades:** Pelster and Hofmann (2018) found that copied trades tend to lose more when returns are negative, and that copied traders show a stronger disposition effect. — [Wikipedia: Copy trading](https://en.wikipedia.org/wiki/Copy_trading)
- **How leaderboards mislead:** practitioner commentary says leaders hide open losing positions during drawdowns and use martingale sizing, which "have attractive, beautifully growing profitability charts, but such traders eventually always lose money." — [Habr](https://habr.com/en/articles/808639)
- **First-person arc:** a trader's post titled "Copy Trading Made Me 60% Profit Then Destroyed Everything" argues that followers cannot choose their risk per trade, stop-loss or position size. — [TradingView post](https://es.tradingview.com/chart/BTCUSDT/VH2GG0Zd-Copy-Trading-Made-Me-60-Profit-Then-Destroyed-Everything)

### Inferences
- **What hurts most:** the most emotionally loaded moment is a single blow-up event after a run of good-looking stats. Reviewers then re-interpret all past stats as fake. So once a leader blows up, trust in the leaderboard collapses for the whole platform, not just for that leader.
- **Confusion about what is being copied:** this shows up as "trades I couldn't see", wrong copy ratios and leftover micro-positions after unfollowing. Users do not have a clear mental model of what their account holds because of the copy.

### Gaps
- No direct evidence on FOMO-driven copying or panic unfollowing at the bottom, because Reddit, X and YouTube comments were inaccessible.
- The Nature study's sample size and period could not be verified because of the paywall redirect.

---

## Q3. Practical frustrations (execution, control, fees, notifications, choosing a leader, small balances, support and withdrawals)

### Takeaway
On the dedicated copy platform, the most common practical failure is that copying silently breaks. Leaders' trades are missed or copied at the wrong ratio, the copy disconnects without an alert, and users cannot stop copying or close the leftover positions. On exchanges, the platforms' own help pages acknowledge structural mismatches: slippage caps, smaller fills and market-order entries. Small balances get eaten by per-ticket commissions and fixed recovery fees.

### Cited Findings
- **Half of trades not copied:** "50 % of my real live account are not been copied" (ZuluTrade, Dec 24, 2025). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Leader and copier results diverge:** "big difference between traders account and copiers" (ZuluTrade, Apr 8, 2026). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Positions left open:** "Positions remain open indefinitely on followers' accounts." The reviewer also says stop losses were ignored (ZuluTrade, Feb 17, 2026). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Cannot stop copying during a glitch:** "the app won't let me stop copying." About $688 was lost (ZuluTrade, Nov 5, 2025). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Silent disconnect:** "Copy trading disconnect and you know nothing." Missed trades had to be closed manually (ZuluTrade, Oct 20, 2023). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Wrong ratio and broken close button:** trades were copied at 10:1 instead of 1:1, and "the platform's 'close trade' button isn't working" (ZuluTrade, Dec 2022, updated Aug 2023). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Outage loss:** "couldn't restore the connection for a week and I lost 700 euros" (ZuluTrade, Jun 2023). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Trades opened without consent:** "My account started opening trades without my permission" (ZuluTrade, Feb 11, 2025). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Stats miscalculated:** a reviewer says the platform cannot "correctly calculate the simplest evaluation criteria" (drawdown and profit curve; ZuluTrade, Apr 18, 2024). A provider reports "my account 80% profits and in my dashboard 0.15%" (Jun 2, 2026). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Structural mismatch acknowledged by Binance:** copy orders have a slippage cap of 0.3% for BTC/USDT and ETH/USDT and 0.5% for other pairs. Binance's help page warns that slippage "can affect the copy trader's order price, potentially resulting in a final order size lower than the lead trader's." Spot lead traders take a 10% profit share plus 10% of copiers' trading fees. — [Binance FAQ](https://www.binance.com/ro/support/faq/b9e5e3b2141149be826685d2c88536fa)
- **Liquidation divergence on MEXC:** MEXC offers a "Do Not Follow" setting. If it is on and the lead trader is liquidated, the follower's position stays open and must be managed manually. This is another way leader and follower positions diverge. — [MEXC learn](https://www.mexc.com/learn/article/17827791509171)
- **Stop-loss control on eToro:** "Can't set stoploss or rake profits" (Oct 22, 2026), and "I CANT EDIT A STOP LOSS!!!" after an app update, with a large loss (Oct 13, 2026). — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
- **Unwanted currency conversion on eToro:** "eToro automatically converted my funds from USD into GBP without me intentionally requesting this." That cost $230 in fees (Oct 16, 2026). — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
- **Small-balance and fee traps:**
  - Pionex charged a 20 USDT "recovery fee" to return mis-sent deposits of $18.90 and similar sums (May–Jun 2026). — [Trustpilot Pionex](https://www.trustpilot.com/review/pionex.com)
  - eToro charged per-ticket commissions on leftover copy micro-positions (Oct 2026). — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
  - A ZuluTrade user says "you pay about 60% fees and does not notice it" (2019, updated). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Bot alerts not firing:** Cryptohopper's TradingView webhooks never fired a trade in 7 months (Aug 2025). — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Freezes without notice:** "withdrawals frozen without warning, then a 'gift' to push KYC" (Pionex, Aug 29, 2026). — [Trustpilot Pionex](https://www.trustpilot.com/review/pionex.com)
- **Execution during volatility:**
  - "App froze during a futures close... Forced liquidation resulted in $1033 loss" (Pionex, Jul 2026). — [Trustpilot Pionex](https://www.trustpilot.com/review/pionex.com)
  - "My account became inaccessible and funds vanished just as the market began to implode" (Bitget, Oct 7, 2026). — [Trustpilot Bitget](https://www.trustpilot.com/review/bitget.com)
  - "I have lost so much money from missed trades and error messages" (Bitget, Jul 2026). — [TradingView Bitget](https://in.tradingview.com/broker/Bitget/reviews)
- **Support quality:**
  - "The ai chatbot in the app was useless" (eToro, Oct 18, 2026). — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
  - "Support is incompetent, they don't understand how their own platform works" (Cryptohopper, Sep 15, 2026). — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
  - "they reply evry 4 hours 1 time" (Pionex, Oct 2, 2026). — [Trustpilot Pionex](https://www.trustpilot.com/review/pionex.com)
- **Choosing whom to copy (bots):** a Cryptohopper user says the marketplace has "a few pitfalls to avoid" and that marketplace items are hard to pick (Aug 26, 2025). — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Choosing whom to copy (follower practice):** a satisfied ZuluTrade user says "the most important thing was not the percentage of profitability, but how risky" the leader was (May 22, 2023). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Telegram bots:** reviewers report occasional failed transactions from congestion or slippage on Trojan. BonkBot's own docs say anti-MEV protection prevents sandwiching but "your transaction might process slower." That is a speed-versus-safety setting that users must understand. — [Medium Trojan review](https://medium.com/@CubeBaseBlog/trojan-solana-trading-bot-review-and-best-alternatives-2d5f9a085eb7); [MadeOnSol BonkBot review](https://madeonsol.com/blog/bonkbot-review)

### Inferences
- **The core failure is silent breakage:** the copy relationship breaks (disconnect, missed trade, wrong ratio, leftover position) and the user is not told. That points to notification and reconciliation failure, not trade selection, as the most fixable UX gap: "your account vs. leader, trade by trade".
- **Divergence is built in:** exchange-side divergence (slippage caps, smaller fills, liquidation-follow settings) is structural and documented, but it is buried in help pages. Users are likely surprised by it. Reviews show surprise, and the help pages show that the cause is documented.
- **Small balances:** fixed fees (per-ticket commissions, recovery fees) hit small accounts disproportionately. That matters for products that market low minimums, such as Binance's $10 minimum.

### Gaps
- No quantified data on late or missing push notifications in app-store reviews, which were inaccessible.
- No Binance, OKX or Bybit copy-trading-specific user complaints were found in the sampled sources.
- "Too many metrics" did not appear explicitly in the sample. "Misleading metrics" did.

---

## Q4. Unmet wishes and explicit feature requests

### Takeaway
Explicit feature requests are rare in Trustpilot reviews, which are mostly grievances. The wishes that do appear, stated or clearly implied, are:
- human or live support, including phone support
- a guaranteed migration or rollover of configured bots
- working stop-loss and take-profit controls
- alerts when copying breaks
- accurate, auditable leader stats with no demo accounts
- transparent all-in pricing
- lower minimum deposits
- a demo or paper mode
- more exchange integrations

### Cited Findings
- **Lower minimums:** "the initial deposit from the brokers' and traders' side could be lower" (ZuluTrade, Mar 20, 2023, 4-star). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Live, knowledgeable support:** "Needs trained live agents who knows how to troubleshoot problems" (Cryptohopper, May 4, 2025). Another 4-star user wants phone support (Jun 25, 2025). — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Keep my bots and history across upgrades (implied):** "all trade, all settings and all history will be deleted" with no rollover option (3Commas, Aug 13, 2026). Another reviewer says "they deleted (for no good reason at all) all the historical data" (Sep 3, 2026). — [Trustpilot 3Commas](https://www.trustpilot.com/review/3commas.io)
- **More exchanges:** a 5-star 3Commas user asks for MEXC support (Jan 8, 2026). A V2 fan praises Hyperliquid support (Sep 25, 2026). — [Trustpilot 3Commas](https://www.trustpilot.com/review/3commas.io)
- **Demo mode:** "Since the update, the demo option is no longer available" (eToro, Oct 21, 2026). — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
- **Working SL/TP and editable stop-losses (implied):** eToro, Oct 2026. — [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1)
- **Verified leaders and no demo leaders (implied):** "stop verifying scammers on the platform" (ZuluTrade, Feb 12, 2025). Complaints about demo-account leaders (Mar 2025). — [Trustpilot ZuluTrade](https://www.trustpilot.com/review/zulutrade.com)
- **Disconnect alerts (implied):** "Copy trading disconnect and you know nothing" (ZuluTrade, Oct 2023). — [Trustpilot ZuluTrade p2](https://www.trustpilot.com/review/zulutrade.com?page=2)
- **Strategy visibility for bots (implied):** "no strategy shown on chart"; the paper bot stops trading (Cryptohopper, Feb 22, 2026). — [Trustpilot Cryptohopper](https://www.trustpilot.com/review/cryptohopper.com)
- **Risk controls platforms already sell:** platforms already advertise slippage caps on copy orders, a maximum copy amount per trader (Binance), and leverage and risk controls (Bitget). This shows that users' demand for control is partly being met, but with fidelity caveats. — [Binance FAQ](https://www.binance.com/ro/support/faq/b9e5e3b2141149be826685d2c88536fa); [Coin Bureau Bitget copy trading review](https://www.coinbureau.com/review/bitget-copy-trading-review)
  - A search snippet attributed to a Bitget help article says that when the account-level copy stop-loss triggers, "all positions will be closed at market price, and the actual equity at termination may differ slightly from the preset value." I did not open that page or get its URL, so verify before relying on it.
- **No control over risk:** the core grievance in the "60% Profit Then Destroyed Everything" post is that followers cannot choose their risk per trade, stop-loss or position size. That is an implicit wish for per-trade control or approve-before-copy. — [TradingView post](https://es.tradingview.com/chart/BTCUSDT/VH2GG0Zd-Copy-Trading-Made-Me-60-Profit-Then-Destroyed-Everything)

### Inferences
- **Control and visibility:** the implied wish list centres on two things. Control means SL/TP that works, the ability to stop copying instantly, and per-trade approval. Visibility means reconciliation against the leader, alerts on disconnects or leader behaviour changes, and audited stats.
- **What was not asked for:** requests for "explanations of trades" or "max drawdown filters" did not appear explicitly in this sample.

### Gaps
- None of the sampled reviews explicitly ask for approve-before-copy, copying only some trades, max-drawdown filters, or trade explanations. Those requests are most likely in Reddit or app-store reviews, which could not be accessed. Do not claim these are frequent user requests on the basis of this file.

---

## Q5. Trust vs execution vs UX: how the complaints split

### Takeaway
Across about 143 complaining reviews, the largest share of tagged mentions is about trust and money access. Execution problems are concentrated on the copy-specific platform (ZuluTrade) and on exchanges during volatility. UX problems are mostly reliability and forced redesigns, not cosmetic issues.

### Cited Findings (bucketed from the Q1 tally)

**Trust and money access: about 115–120 mentions**
- Frozen funds and locked accounts (~40)
- Scam accusations (~33)
- Misleading stats or leaderboards (~12)
- Hidden fees (~14)
- Billing and refund disputes (~19)
- Security incidents: the 3Commas API leak, and the Banana Gun and Maestro drains (outside the tally)
- Sources: [Bybit](https://www.trustpilot.com/review/www.bybit.com), [Bitget](https://www.trustpilot.com/review/bitget.com), [eToro 1-star](https://www.trustpilot.com/review/etoro.com?stars=1), [3Commas](https://www.trustpilot.com/review/3commas.io), [BleepingComputer](https://www.bleepingcomputer.com/news/security/crypto-platform-3commas-admits-hackers-stole-api-keys)

**Execution: about 40 mentions**
- Missed or mismatched copies (~13)
- Leader or bot losses (~15)
- Cannot close or adjust (~7)
- Unfair execution or liquidation (~4)
- Slippage caps and smaller fills on exchanges (documented by Binance)
- Sources: [ZuluTrade](https://www.trustpilot.com/review/zulutrade.com), [Binance FAQ](https://www.binance.com/ro/support/faq/b9e5e3b2141149be826685d2c88536fa)

**UX and service: about 120 mentions, with support alone at about 64**
- Support (~64)
- Bugs and reliability (~37)
- Forced platform changes (~15)
- KYC friction (~8)
- Notifications (~6)
- Sources: same Trustpilot pages as above

**Review integrity itself is a trust issue**
- The cluster of same-day generic positive reviews on TradingView (Bitget).
- eToro's 5-star stream heavily features loyalty-event praise.
- Sources: [TradingView Bitget](https://in.tradingview.com/broker/Bitget/reviews); [eToro recent](https://www.trustpilot.com/review/etoro.com?sort=recency)

### Inferences
- **Trust and execution are linked:** execution failures, when they go unexplained and support does not respond, get relabelled by users as trust failures ("scam"). A product that explains each divergence between leader and follower could convert some "scam" reviews back into "execution" issues.
- **Aggregate ratings are unreliable:** headline ratings are a weak trust signal for users, because of solicited reviews and loyalty-event reviews. This may itself be part of why users feel misled.

### Gaps
- The bucket totals depend on single-page samples, multi-label coding and the exchange-heavy mix. A Reddit or app-store sample would probably shift weight toward execution and UX, and away from frozen funds. That is unverified.
