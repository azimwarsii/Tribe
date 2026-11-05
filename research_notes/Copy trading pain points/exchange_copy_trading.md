# Pain Points of Centralized-Exchange and Broker Copy Trading (Bybit, Binance, Bitget, OKX, BingX, MEXC, eToro, ZuluTrade, NAGA, MT4/MT5 Signals)

Research notes, compiled 2026-10-28. Scope limits: Reddit could not be searched (the search tool blocks reddit.com), and X/Twitter was not reachable. User complaint evidence therefore comes mostly from the MQL5 forum, cTrader community forum, Trustpilot/Capterra and review sites. Platform help-center pages are the strongest evidence for mechanics. Frequency labels (common / occasional / rare) are my estimates from what turned up, not measured counts.

## 1. Execution gaps between leader and follower (slippage, fills, latency, min sizes, sizing mismatch, orphaned positions)

### Takeaway
Every platform says outright that follower fills will not match the leader's. Follower orders are separate market orders placed after the leader's, so they absorb slippage and latency. They are also skipped or resized when balance, minimum order size, slippage thresholds or caps get in the way. This is the most frequently documented failure mode. It hits small accounts and strategies with small take-profits hardest. Positions that stay open after the leader exits (orphaned positions) are reported on forums but are less common.

### Cited Findings
**Platform admissions (Bybit)**
- Bybit: "Entry and exit of trades in a follower's copy trading account are filled using market orders, which are subject to slippage", so final prices can differ from the Master Trader's depending on volume and conditions — [Bybit Help Center: Understanding Discrepancies](https://www.bybit.com/en/help-center/article/Understanding-Discrepancies-in-Copy-Trading-Positions-between-Master-Trader-s-and-Follower-s)
- Bybit lists the reasons a copy trade gets missed. It does not mention TP/SL or close behaviour.
  - Insufficient balance for the minimum order size.
  - Order cost greater than the balance allocated to that Master.
  - Slippage beyond threshold. The default maximum is 0.1% per order, adjustable to 5%, though an example on the same page says 0.5%, an internal inconsistency.
  - A max position margin cap, by default 300,000 USDT per contract type. A follower who sets a lower cap such as 20 USDT has later copies fail.
  - "Copy Guard", which skips the trade if the follower's price would be worse than the Master's.
  - More than 400 entry orders, which pauses copying.
  - Initial Margin Rate at or above 100%.
  - Source: [Bybit Help Center](https://www.bybit.com/en/help-center/article/Understanding-Discrepancies-in-Copy-Trading-Positions-between-Master-Trader-s-and-Follower-s)
- Bybit Smart Copy Mode handles minimum order size by upsizing. If the margin calculated from the Master's ratio is below the minimum (example: 0.001 BTC for BTCUSDT), the system places the minimum order anyway. The follower then commits a larger share of their balance than the Master did, which is a structural problem for small balances — [Bybit Help Center](https://www.bybit.com/en/help-center/article/Understanding-Discrepancies-in-Copy-Trading-Positions-between-Master-Trader-s-and-Follower-s)
- Bybit: a Master can inject fresh funds when nearly all of their funds are in use as margin. Followers cannot replicate this, "which can cause position discrepancies or higher risk" — [Bybit Help Center](https://www.bybit.com/en/help-center/article/Understanding-Discrepancies-in-Copy-Trading-Positions-between-Master-Trader-s-and-Follower-s)
- Bybit's introduction page warns that follower returns can differ because of "slippage, different entry points or more" — [Bybit: Introduction to Copy Trading](https://bybit.nl/en/help-center/article/Introduction-to-Copy-Trading-on-Bybit)
- A third-party guide notes that Bybit's slippage protection covers the entry price only, not the exit — [Trader's Second Brain](https://traderssecondbrain.com/guides/crypto-copy-trading-exchanges). Secondary source; not confirmed on Bybit's own pages.
- A third-party guide says following a Bybit Classic master does not retroactively copy positions already open — [Trader's Second Brain](https://traderssecondbrain.com/guides/crypto-copy-trading-exchanges)
- BitMEX has a support article titled "Why Is My PnL Different from the Copy Leader". This is another venue that treats the PnL gap as a standard support question — [BitMEX Support](https://support.bitmex.com/hc/en-gb/articles/29353170744477-Why-Is-My-PnL-Different-from-the-Copy-Leader)

**Platform admissions (Bitget)**
- Bitget's copy-trading limits each cause a partial copy or no copy at all:
  - A per-trade copied margin cap per futures pair; margin above it "is not copied".
  - Per-order quantity capped by order-book depth ("Execute only the allowed quantity").
  - Hedged positions can end up one-sided when one side is capped.
  - A follower total copy-margin cap, platform maximum 100,000 USDT (Classic).
  - A total open copy position value cap, platform maximum 1,000,000 USDT (new mode).
  - Copied trades are rejected if they would push the follower past a position tier ceiling.
  - New copies may be rejected when the elite trader nears their own platform cap.
  - Elite-trader orders beyond 3 within one second "will not generate copied trades".
  - If leverage sync fails, copying pauses.
  - Source: [Bitget Support: copy trading risk controls](https://www.bitget.com/support/articles/12560603883269)

**MT4/MT5 signal copiers (MQL5) and cTrader Copy**
- MQL5 forum, 2023-05-23: "I have tested some signals but the performance i get are a lot worse then the results on mql. How can this be?" The moderator points to differences in broker trading conditions and the signal's Slippage tab. Another user warns that for signals with small take-profits, "slippage could negate almost all profit in your account" — [MQL5 forum #447735](https://www.mql5.com/en/forum/447735)
- MQL5 users report that slippage differs by broker server, even between servers of the same broker. A long-time copier argues that delays of a few seconds hurt results more than price slippage — [MQL5 forum #455069](https://www.mql5.com/en/forum/455069)
- MQL5 explains the gap as quote differences between servers plus execution delay — [MQL5 forum #319789](https://mql5.com/en/forum/319789)
- A low "deviation" setting on MQL5 (0.5 or 1) causes trades to be skipped entirely when the price gap is larger — [MQL5 forum #191944](https://www.mql5.com/en/forum/191944)
- Recurring MQL5 thread titles show a long-running, common complaint:
  - "subscribed signal but result - pips not match" — [MQL5 #76556](https://mql5.com/en/forum/76556)
  - "Not making same % as signal trader on trades" — [MQL5 #430339](https://mql5.com/en/forum/430339)
  - "The growth of the providers of the signal is different from the growth of the subscriber" — [MQL5 #191944](https://www.mql5.com/en/forum/191944)
  - "Slippage during copy trading" — [MQL5 #168365](https://www.mql5.com/en/forum/168365)
  - "why ... a system subscriber is advised to use the same broker as the system Author?" — [MQL5 #99213](https://www.mql5.com/en/forum/99213)
- Orphaned positions on cTrader Copy:
  - Thread titled "Trade closed in Strategy Provider account but not in 2 Copying accounts" — [cTrader forum #23666](https://community.ctrader.com/forum/ctrader-copy/23666)
  - A provider wrote: "this trade was closed on my side, but some of my followers reported that the trade was still open on their side" — surfaced via [cTrader Copy forum](https://community.ctrader.com/forum/ctrader-copy/24467)
  - A related thread title: "Trade in the copy account closed with loss even though the trade in the provider account closed in profit" — [cTrader forum #41431](https://communityuat.ctrader.com/forum/ctrader-copy/41431)
  - A cTrader reply to a complaint about entry and exit prices says that different prices and slippage can occur — [cTrader forum #36128](https://community.ctrader.com/forum/ctrader-copy/36128)
- Partial closes are mirrored by percentage of position (e.g. CoinEx/KuCoin-style help text: "the system calculates the percentage of the closed position to the total position, and applies it to the copy trader's position"). If the follower's position was opened at a different size or ratio, the close does not map cleanly. Another venue cancels copies when the price gap exceeds 0.5% — surfaced via [CoinEx help](https://www.coinex.com/help/sections/articles/35087914920985) and [Matrixport help](https://matrixport.helpjuice.com/en_US/what-are-the-reasons-for-my-futures-copy-trade-order-fail)
- NAGA has a help article "Can I close a lead trader's copied position", which shows that followers manually intervening in copied positions is a supported workflow and a source of divergence — [NAGA Support](https://support.naga.com/en/articles/8120310-can-i-close-a-lead-trader-s-copied-position)

**Quantified gap (low confidence)**
- A blog "audit" of 12,480 mirrored trades from 27 providers says providers earned about 38.6% while followers realised about 9.4%, and attributes the gap to execution costs. The method is only briefly described and the work is not peer-reviewed — [influencerq research page](https://influencerq-web.pages.dev/research/how-slippage-and-fees-destroy-copy-trading-returns)

### Inferences
- Frequency:
  - **Common**: general slippage and PnL differences. Every platform has a dedicated help article explaining it, and MQL5 has dozens of threads over about 10 years.
  - **Common**: skipped trades from min-size, balance or slippage-threshold limits.
  - **Occasional**: forced over-sizing for small balances (Bybit min-order upsizing).
  - **Occasional**: orphaned or mismatched closes. These appear mainly on cTrader and MQL5 forums.
- The slippage guards themselves create a second failure mode. A tight threshold protects the entry but skips the trade, so the follower misses the winners while still getting partially filled ladders. If only entries are protected, exits stay exposed.
- The "leader adds fresh margin" asymmetry on Bybit means a leader can average down or survive a drawdown that liquidates followers, who have no equivalent top-up.
- Bitget's limit of 3 orders per second and its depth-based quantity caps mean high-frequency or large leaders are structurally uncopyable at full size.

### Gaps
- No Reddit or X complaint threads could be retrieved (tool restriction), so I have no direct verbatim quotes from r/Bybit, r/binance or r/Bitget.
- I found no platform-published statistics on what share of copy orders are skipped or fill worse than the leader.
- OKX, BingX and MEXC help-center mechanics were not fetched.
- I could not confirm whether Bybit's slippage guard covers exits; only a secondary source says it does not.

## 2. Leader/leaderboard gaming (survivorship, martingale/grid, leverage, multi-account, inflated ROI, front-running, quitting)

### Takeaway
The best-documented gaming vector is ROI manipulation through capital movements. Bitget publicly admitted in June 2026 that elite traders were inflating ROI by depositing large sums after opening small positions, and changed its formula. Binance's lead-trader rules also mention "fund transfer frequency" as malicious behaviour. Short ranking windows and ROI measured on margin flatter high-leverage leaders. Martingale-style strategies and small accounts on high leverage are widely flagged but poorly documented with specific incidents.

### Cited Findings
**Bitget ROI manipulation**
- Bitget's announcement (2026-06-12) says "a small number of elite traders were able to artificially inflate their ROI rankings" by opening a small position, moving in a large sum, trading, and withdrawing quickly after a profit. The old formula used only "initial assets" as the denominator, a loophole.
- The new formula, applied to futures, CFD and spot: "Hourly ROI = net trading PnL for the hour ÷ maximum available capital for the hour." Bitget says it "fully accounts for all fund movements within the hour".
- Traders with abnormal transfer activity may see a notable ROI decrease. Historical figures for other traders are unchanged. The article names no bans or penalties.
- Source: [Bitget announcement](https://www.bitget.com/news/detail/12560605456280)

**Binance anti-gaming rules**
- Binance's Lead Trader Growth Plan says "If any malicious behaviour is detected, all benefits will be revoked." Detection looks at historical closed portfolios, fund transfer frequency and carrying orders.
- Binance also says benefits "may not apply to a portfolio if any risk control is triggered", and that badges can be demoted at its discretion.
- This implies Binance is aware of portfolio cycling (closing bad portfolios and keeping the lucky one), fund-transfer ROI games, and order carrying. Penalties are loss of benefits, not compensation to copiers.
- Source: [Binance FAQ: Lead Trader Growth Plan](https://www.binance.com/en/support/faq/3160c961b2734d1cbb5342d1e86c6cdb)

**ROI on margin, leverage and short windows**
- Exchange leaderboards are self-reported by the exchange, usually as ROI on margin rather than on notional, "which flatters leveraged leaders enormously".
- A triple-digit 90-day ROI may reflect 25x leverage on a small margin pool, which the copier inherits.
- The top of a 30-day ranking "is dominated by short-window noise".
- Sources: [Finestel blog](https://finestel.com/blog/is-copy-trading-safe/); [uwuu.ai](https://uwuu.ai/blog/best-copy-trading-platforms-crypto); [Copiday blog](https://copiday.com/blog/copy-trading-fomo-discipline). These are vendor blogs; treat as informed opinion.
- Commentary argues that small accounts using high leverage to reach leaderboard returns are "unrealistic in sustainability" — [Cointribune](https://www.cointribune.com/en/copy-trading-how-does-it-work-in-2026)

**Martingale and strategy drift**
- Martingale strategies "increase position size after losses", which compounds risk, and reviews list "martingale spirals where losses accelerate faster than margin can support" as a Bitget copy-trading risk — [Coin Bureau Bitget copy trading review (Feb 2026)](https://www.coinbureau.com/review/bitget-copy-trading-review)
- A "conservative swing trader you selected could start day-trading meme coins on 20x leverage". Past behaviour does not bind future behaviour — via [spark.money glossary](https://www.spark.money/glossary/copy-trading) (secondary)

**High win rates and quitting leaders**
- A Substack post, "Four Traders With Over 96% Win Rates", examines very high win-rate leaders. These are typically associated with averaging-down or martingale profiles that hide tail risk — [Digital Currency Traders Substack](https://digitalcurrencytraders.substack.com/p/four-traders-with-over-96-win-rates). I only saw the title; I did not verify its content.
- Bitget removes an elite trader's profile from the leaderboard if their spot asset balance falls below 100 USDT, but "existing followers will not be affected and can continue copying their trades". Followers can therefore stay attached to a leader who has effectively left the leaderboard — [Coin Bureau Bitget review](https://www.coinbureau.com/review/bitget-copy-trading-review)

**NAGA: German consumer lawsuit over profit and hit-rate marketing**
- Verbraucherzentrale Baden-Württemberg filed an injunction against NAGA Markets Europe on 2024-09-25. It alleged that NAGA's copy-trading marketing hides "das erhebliche Risiko" (the considerable risk) and focuses on "die angeblichen Profite und hohen Trefferquoten" (the alleged profits and high hit rates) of copied traders.
- LG Karlsruhe dismissed the case as inadmissible on 2025-11-06 (Az. 14 O 63/24 KfH). An appeal is pending at OLG Karlsruhe (Az. 6 U 124/25), with page status as of 2026-06-10.
- Source: [Verbraucherzentrale](https://www.verbraucherzentrale.de/verbandsklagen/klage-gegen-naga-markets-europe-ltd-99812)

### Inferences
- Frequency:
  - **Common**: inflated or misleading ROI, structural (margin-based ROI, short windows, leverage).
  - **Occasional, confirmed by platforms**: deliberate ROI manipulation through deposits and withdrawals (Bitget 2026), and portfolio cycling and transfer games (implied by Binance's rules).
  - **Common in commentary but thin in incident reporting**: martingale or grid blowups.
  - **Rare or undocumented in my results**: leaders trading against followers or front-running them.
- Front-running mechanics follow from the execution model. The leader's market order fills first and the follower's lands after, so a leader with a large follower base is in effect followed by their own flow. That benefits the leader's entry and harms follower fills on illiquid pairs. This is inference; I found no documented case.
- Platform fixes are reactive and penalise leaders by revoking benefits. None that I found compensate copiers.

### Gaps
- No specific documented lead-trader blowup with named trader, AUM and copier losses on Bybit, Binance or Bitget was found in these searches. Crypto media (CoinDesk, The Block, Cointelegraph) coverage of such incidents did not surface.
- No evidence was found of multi-account "promote the lucky one" schemes beyond Binance's "historical closed portfolios" check.
- No documented front-running or counter-trading by leaders was found.

## 3. Risk controls (follower stop-loss, liquidation cascades, per-trader limits, copy-stop/drawdown)

### Takeaway
Exchanges give followers caps on margin and position value, leverage overrides and isolated margin. Copier-side protection mostly takes the form of what the platform refuses to copy, not active downside management. Leveraged futures copy trading passes the leader's liquidation risk straight to the follower. Follower-specific copy-stop or drawdown features (e.g. Bitget "Equity Guardian") exist, but I found no documentation of how they work in practice.

### Cited Findings
- On Binance futures copy trading, a leader's leveraged loss is replicated; one guide's example is a 10x position dropping 10%, which liquidates the copier. Followers can override leverage and set their own risk controls — via [smalldrift guide](https://smalldrift.pages.dev/articles/binance-copy-trading-2026-guide-fees-risks-profit/) (affiliate, low confidence) and [Binance blog](https://www.binance.com/blog/futures/copy-trading-essential-criteria-for-selecting-lead-traders-5061215295703009149)
- Binance: under isolated margin, "if one position is liquidated, other positions will not be affected" — [Binance blog](https://www.binance.com/blog/futures/copy-trading-essential-criteria-for-selecting-lead-traders-5061215295703009149)
- Bitget says its copy risk controls guard against oversized single trades, excessive margin use, high slippage, one-sided liquidation risk and overexposure to one elite trader. Each elite trader has a maximum total position value per pair — [Coin Bureau Bitget review](https://www.coinbureau.com/review/bitget-copy-trading-review); [Bitget Support](https://www.bitget.com/support/articles/12560603883269)
- Bitget follower settings include a maximum margin ratio per copied trade (fixed-ratio mode), a total copy margin cap and a total open position value cap — [Bitget Support](https://www.bitget.com/support/articles/12560603883269)
- Bitget futures copy trading has an optional "Equity Guardian" setting; its behaviour was not described in the sources found — [Coin Bureau Bitget review](https://www.coinbureau.com/review/bitget-copy-trading-review)
- Bybit followers can set their own max position margin per Master (default 300,000 USDT) and a slippage threshold (0.1–5%) — [Bybit Help Center](https://www.bybit.com/en/help-center/article/Understanding-Discrepancies-in-Copy-Trading-Positions-between-Master-Trader-s-and-Follower-s)
- One-sided liquidation risk: Bitget notes that hedged positions may become one-sided when the quantity cap applies to one leg — [Bitget Support](https://www.bitget.com/support/articles/12560603883269)
- Binance badge criteria include a 7-day max drawdown (MDD) of 50% for Cadet and 35% for Champion, Master and Legend. These allow very large drawdowns while keeping status — [Binance FAQ](https://www.binance.com/en/support/faq/3160c961b2734d1cbb5342d1e86c6cdb)
- NAGA reviews describe users whose mirrored "top" traders "suddenly suffered catastrophic losses" — via [brokerchecker review page](https://brokerchecker.pages.dev/reviews/naga-review/) (low-quality aggregator)

### Inferences
- Frequency:
  - **Common**: users discovering that copy trading on futures equals inheriting the leader's leverage and liquidation path.
  - **Occasional**: hedge legs going one-sided and caps silently truncating positions.
- Tolerating a 35–50% 7-day max drawdown for top Binance badges implies the platform does not screen out high-variance leaders. It rewards AUM and copier PnL over short windows.
- Most "protections" are refusal-to-copy rules. They can leave a follower with a partial, unhedged or mis-sized version of the leader's book, which may be riskier than either a full copy or no copy.

### Gaps
- I found no documentation of whether follower-side stop-loss or copy-stop triggers execute reliably during fast markets (no user reports retrieved).
- The mechanics of Bitget's Equity Guardian and of OKX, BingX and MEXC copy-stop settings were not documented.
- No liquidation cascade data (how many followers were liquidated when a leader was) was found.

## 4. Fees (profit share, high-water marks, spreads, funding, fees when losing)

### Takeaway
Crypto exchanges charge leader profit share of 0–30%; Binance's default is 10%, rising to 30% at top tiers. Leaders also earn commission on copiers' trading fees, so leaders get paid on volume even when copiers lose. Broker platforms (eToro) build costs into spreads and overnight fees rather than charging an explicit copy fee. I could not verify high-water-mark mechanics from primary sources.

### Cited Findings
- Binance: the standard lead trader benefit is "a 10% profit share from their copy traders; and a 10% commission from their copy traders' trading fee" (capped) — [Binance FAQ](https://www.binance.com/en/support/faq/3160c961b2734d1cbb5342d1e86c6cdb)
- Binance profit share ranges by badge are adjustable by the lead trader — [Binance FAQ](https://www.binance.com/en/support/faq/3160c961b2734d1cbb5342d1e86c6cdb):

  | Badge | Profit share range |
  |---|---|
  | Regular | 0–10% |
  | Cadet | 0–15% |
  | Champion | 0–20% |
  | Master | 0–30% |
  | Legend | 0–30% |

- Binance spot copy trading pays lead traders profit share and rebates weekly — [The Block (2024-04-23)](https://www.theblock.co/post/290345/binance-spot-copy-trading)
- High-water mark on Binance (profit share charged only on gains above the previous peak) is asserted only by an affiliate guide; I did not confirm it in Binance T&Cs — [smalldrift guide](https://smalldrift.pages.dev/articles/binance-copy-trading-2026-guide-fees-risks-profit/)
- eToro: reviews say copying has no separate fee and costs are embedded in spreads and overnight fees; this is not an official fee schedule — via [eToro review aggregators](https://whichbrokr-site.pages.dev/brokers/etoro-review) (low quality)
- MQL5: for small-TP signals, "slippage could negate almost all profit" — [MQL5 forum #447735](https://www.mql5.com/en/forum/447735)
- Trustpilot reviewers call Bybit "the worst spot trading exchange with outrageous fees" (general, not copy-specific) — [Trustpilot Bybit](https://uk.trustpilot.com/review/www.bybit.global)

### Inferences
- The 10% fee-commission stream on Binance pays leaders for copier turnover regardless of copier PnL. That creates an incentive for leaders to overtrade, and it is the clearest example of "fees when losing".
- Profit share is computed per follower on that follower's realised PnL, but the follower's PnL is already reduced by slippage and skipped trades (section 1). Fee plus execution drag together explain the widely cited leader-vs-follower return gap.
- Frequency: fee complaints in general are **common**. Specific complaints about profit-share mechanics did not surface (**rare** in my results, likely a coverage gap because Reddit was unavailable).

### Gaps
- High-water mark and settlement rules for Binance futures, Bybit, Bitget, OKX, BingX and MEXC were not verified from primary T&Cs.
- I found no data on how funding fees affect copied perpetual positions.
- eToro's current fee schedule for copied CFD positions and spreads was not retrieved.
- ZuluTrade and NAGA fee structures were not retrieved.

## 5. Transparency (what followers can see; verifiability of track records)

### Takeaway
Exchange leaderboards are computed and displayed by the platform and cannot be independently audited. They have demonstrably been gameable: Bitget's ROI denominator loophole stood until 2026. Followers see headline ROI, PnL, win rate and drawdown, but not the leader's off-platform positions, other accounts or capital movements. MQL5 is the outlier, publishing a per-server slippage tab.

### Cited Findings
- Exchange leaderboards are "self-reported by the exchange", whereas on-chain copy trading has wallet history "anyone can audit" — [Finestel](https://finestel.com/blog/is-copy-trading-safe/) (vendor blog)
- Bitget's ROI formula relied on "initial assets" until the 2026 change. Displayed ROI for some traders was therefore inflated, and only "trades after the update" use the new calculation. The display itself did not change — [Bitget announcement](https://www.bitget.com/news/detail/12560605456280)
- MQL5 signals display a Slippage tab showing the provider-vs-subscriber fill gap by broker server — [MQL5 forum #455069](https://www.mql5.com/en/forum/455069); [MQL5 forum #447735](https://www.mql5.com/en/forum/447735)
- Bybit's documentation acknowledges that Masters can inject funds that followers cannot replicate. Leader-side capital changes affect the displayed history in ways followers cannot copy — [Bybit Help Center](https://www.bybit.com/en/help-center/article/Understanding-Discrepancies-in-Copy-Trading-Positions-between-Master-Trader-s-and-Follower-s)
- eToro publishes a promotional blog post, "If you invested $10K in these Popular Investors, here's how much you'd have today". It is survivorship-biased by construction, featuring winners only — [eToro blog](https://www.etoro.com/blog/from-etoro/if-you-invested-10k-in-these-popular-investors-heres-how-much-youd-have-today/)
- The German NAGA suit centres on marketing that emphasises copied traders' profits and hit rates while concealing risk and unrealised losses — [Verbraucherzentrale](https://www.verbraucherzentrale.de/verbandsklagen/klage-gegen-naga-markets-europe-ltd-99812)

### Inferences
- The core transparency gap is that leader metrics are leader-account metrics, not achieved-by-followers metrics. Binance's badge requirements do use "7-day copiers' PnL", which is a step toward follower-outcome metrics, but it is a short window.
- Followers generally cannot see unrealized-loss composition (e.g. a stack of underwater averaged-down positions), capital injections, or deleted or closed portfolios. Binance checks "historical closed portfolios" internally but does not, as far as I found, show them to followers.

### Gaps
- I did not confirm which platforms show unrealized PnL or open-position drawdown on leader profiles, or whether closed portfolios are visible to followers.
- I found no third-party audit of any exchange's leaderboard accuracy.

## 6. Documented incidents and statistics

### Takeaway
Hard, primary statistics on copy-trader outcomes are scarce. The often-quoted "only 43.6% of lead traders made money for followers" figure has no traceable source. eToro and other EU/UK brokers publish mandatory retail CFD loss percentages, but these cover all CFD accounts, not CopyTrader users specifically. Regulatory and legal actions exist (NFA vs ZuluTrade; German consumer suit vs NAGA), but I found no documented, named crypto lead-trader blowup.

### Cited Findings
**Outcome statistics**
- A widely repeated "90-day study of over 100,000 copy trading outcomes across Binance, Bybit, and MEXC" claims 97% of lead traders were personally profitable but only 43.6% generated profits for followers. I found no named author, publication or methodology — via [spark.money glossary](https://www.spark.money/glossary/copy-trading). Treat as unverified.
- An affiliate guide headline, "Binance Copy Trading... But 80% of Copiers Lose", is unsourced and affiliate — [smalldrift](https://smalldrift.pages.dev/articles/binance-copy-trading-2026-guide-fees-risks-profit/). Low confidence.
- Traders Union's own survey: 41% of respondents stopped copy trading because of losses, excessive drawdowns or disappointing performance. It is self-run by a broker-affiliated publisher — [Traders Union](https://tradersunion.com/interesting-articles/copy-trading-smart-investing-or-hidden-risk-tu-research/)
- A 2025 retail trading report found accounts that used copy trading had the highest profitability percentage among groups. This is general, not platform-specific, and conflicts with the negative findings above — via [briefglance](https://briefglance.com/articles/retail-traders-win-64-of-trades-but-still-lose-money-report-finds) (secondary)

**Retail CFD loss disclosures**
- BrokerRank compiles mandatory EU/UK retail CFD loss disclosures (2026 update). The snippet shows a range of "51.00% (eToro) to 82.00% (Plus500)" across its sample, but I did not open the page to confirm eToro's exact current figure. Review sites cite eToro figures of 61%, 67% and 74% at various times — [BrokerRank](https://brokerrank.net/research/retail-loss-rates); [GoodMoneyGuide](https://goodmoneyguide.com/trading/risk-warning-loss-percentages/). Conflicting figures; the number changes quarterly.
- Finance Magnates reports on eToro's dominance in Australia's CFD market, "where trader loyalty rarely survives a year". This points to high churn — [Finance Magnates](https://www.financemagnates.com/forex/etoro-dominates-australias-cfd-market-where-trader-loyalty-rarely-survives-a-year/)

**Academic work**
- A University of Vienna master's thesis, "Can Copy Trading Beat the Market?", finds a slightly negative performance effect from copying. I saw the abstract only — [Univie thesis](https://utheses-gateway.univie.ac.at/api/document/get/file/73534)
- An ICIS 2019 paper (dated) studies follower learning on forex social trading, not returns — [AIS eLibrary](https://aisel.aisnet.org/icis2019/blockchain_fintech/blockchain_fintech/13)
- Apesteguia, Oechssler and Weidenholzer, Management Science (2020), is cited by blogs as finding that copying increases risk-taking and reduces welfare. I did not verify this from the primary source.

**Regulatory and legal**
- ZuluTrade: the US NFA brought complaints alleging failure to maintain minimum net capital, plus AML and supervision failures, naming CEO Leon Yohai. MetaQuotes separately urged brokers to stop working with ZuluTrade, Tradency, Tradeo and Myfxbook. Dates were not confirmed; these are likely older than 2022 — [Finance Magnates](https://www.financemagnates.com/forex/regulation/us-watchdog-issues-new-complaint-zulutrade/); [LeapRate](https://leaprate.com/?p=363033); [Finance Magnates on MetaQuotes](https://www.financemagnates.com/forex/brokers/metaquotes-warns-brokers-about-working-with-tradency-tradeo-myfxbook-zulutrade/)
- NAGA: German consumer injunction suit (2024-09-25), dismissed as inadmissible on 2025-11-06, with appeal pending — [Verbraucherzentrale](https://www.verbraucherzentrale.de/verbandsklagen/klage-gegen-naga-markets-europe-ltd-99812)
- WikiFX logs 11 NAGA user complaints over a recent three-month period, plus a complaint about more than $80,000 of profits allegedly withheld in Kuwait (unverified complaint aggregator) — [WikiFX](https://www.wikifx.com/en/newsdetail/202601205994747262.html)

**User reviews**
- Bitget's Trustpilot TrustScore is 2.5/5. Loss complaints mostly blame app crashes (one reviewer lost about 4,200 USDT), frozen funds and support rather than copy trading itself. Some reviews praise copy trading as a way to learn — [Trustpilot Bitget](https://www.trustpilot.com/review/bitget.com?page=8); [Capterra Bitget](https://www.capterra.com/p/10016059/Bitget/reviews/)

**Platform scale**
- Bitget scale figures conflict: 190,000+ elite traders and 800,000+ followers versus 110,000+ traders and 540,000 followers — [Coin Bureau](https://www.coinbureau.com/review/bitget-copy-trading-review); [Bitget Academy](https://www.bitget.com/de/academy/12)

### Inferences
- The leader-profitable-but-follower-unprofitable pattern appears consistently across low-quality sources and fits the mechanics in sections 1 and 4. Still, there is no rigorous published figure, and this should be stated as such in any report.
- Platform outages during volatility (Bitget Trustpilot) compound copy-trading risk, because followers cannot manually intervene when automated copy logic misfires.

### Gaps
- No primary CopyTrader-specific loss rate from eToro was found.
- No named Bybit, Binance or Bitget lead-trader blowup with figures was found; crypto media searches returned none.
- I did not verify the Management Science (2020) paper's findings.
- I found no OKX, BingX or MEXC incident data.

## 7. Mitigations platforms have shipped and whether they work

### Takeaway
Mitigations fall into five groups: entry slippage guards (Bybit Copy Guard, MQL5 deviation); refusal-to-copy caps (Bitget); follower-set margin and position caps; leader tiering and eligibility (Binance badges, eToro Popular Investor risk score); and after-the-fact formula fixes (Bitget ROI 2026). Each trades one failure mode for another, such as skipped trades or partial books. None compensates followers. Leader-side rules mainly gate benefits rather than protect copiers.

### Cited Findings
**Execution guards**
- Bybit Copy Guard skips the copy if the follower's price would be worse than the Master's. The slippage threshold defaults to 0.1% and goes up to 5%. The side effect is missed copies and position discrepancies — [Bybit Help Center](https://www.bybit.com/en/help-center/article/Understanding-Discrepancies-in-Copy-Trading-Positions-between-Master-Trader-s-and-Follower-s)

**Bitget**
- Bitget runs 12 or more layered limits: per-trade margin and value caps, depth-based quantity caps, tier and OI limits, an elite-trader position cap, a 3-orders-per-second limit and a leverage-sync pause — [Bitget Support](https://www.bitget.com/support/articles/12560603883269)
- Bitget also shipped Elite Trader Private Mode (Nov 2023) and Smart Copy Mode (Jan 2024) — [AAP/Cision: Private Mode](https://www.aap.com.au/aapreleases/cision20231115ae69518); [AAP/Cision: Smart Copy](https://www.aap.com.au/aapreleases/cision20240124ae19693)
- Bitget's 2026 ROI formula fix uses maximum available hourly capital as the denominator. It is reactive and not retroactive, and the article names no sanctions — [Bitget announcement](https://www.bitget.com/news/detail/12560605456280)

**Binance**
- Binance's tiered badge system is based on margin balance, 7-day copiers' PnL, copier count, run time, 30-day average AUM, trading days and 7-day MDD (50% or 35%) — [Binance FAQ](https://www.binance.com/en/support/faq/3160c961b2734d1cbb5342d1e86c6cdb):

  | Badge | Margin balance (USDT) | 7-day copiers' PnL (USDT) | Copiers | 30-day avg AUM (USDT) |
  |---|---|---|---|---|
  | Regular | ≥ 500 | – | – | – |
  | Cadet | ≥ 1,000 | ≥ 50 | ≥ 200 | ≥ 10,000 |
  | Champion | ≥ 5,000 | ≥ 1,000 | ≥ 400 | ≥ 100,000 |
  | Master | ≥ 10,000 | ≥ 2,000 | ≥ 600 | ≥ 500,000 |
  | Legend | ≥ 20,000 | ≥ 10,000 | ≥ 800 | ≥ 3,000,000 |

- Binance badges change one step at a time, with a 7-day hold. All benefits are revoked for "malicious behaviour" (closed-portfolio history, fund transfer frequency, carrying orders). Applications are reviewed against internal criteria — [Binance FAQ](https://www.binance.com/en/support/faq/3160c961b2734d1cbb5342d1e86c6cdb); [Binance announcement](https://www.binance.com/en-AE/support/announcement/detail/2431be3394b348dfa90d4e3658335ac5)

**eToro Popular Investor rules**
- eToro requires Popular Investors to maintain a risk score of 6 or less to be copied, while Social Traders may go up to 7 (eToro's own update). Other eToro pages cite breach at a daily score of 8 or more, and Traders Union lists a maximum of 7, so the current threshold is unresolved.
- Other requirements: a $1,000 minimum deposit and tier-based copier and AUM thresholds. Payment is revoked for violations.
- Sources: [eToro blog: PI program update](https://www.etoro.com/blog/from-etoro/important-update-regarding-popular-investor-program); [eToro Popular Investor](https://etoro.com/popular-investor); [Traders Union](https://tradersunion.com/brokers/fond/view/etoro/etoro-popular-investor/); [FF News](https://ffnews.com/newsarticle/etoro-introduces-new-copy-trading-requirements-amid-increasing-popularity)

**MQL5**
- MQL5 publishes a per-server slippage tab, and its moderators recommend copying with the provider's broker and server — [MQL5 forum #447735](https://www.mql5.com/en/forum/447735); [MQL5 #99213](https://www.mql5.com/en/forum/99213)

### Inferences
- **Do they work?**
  - Slippage guards work for entry price but cause missed trades and exit exposure.
  - Caps limit tail risk but produce partial or one-sided books.
  - Tier systems based on AUM and copier counts reward popularity and short-window PnL, and still tolerate 35–50% weekly drawdowns.
  - Risk-score gating (eToro) is the most follower-protective leader rule found, but its threshold is inconsistently documented.
  - Anti-manipulation fixes arrive after exploitation (Bitget's loophole was fixed in 2026) and only revoke leader benefits.
- No platform found offers follower compensation, mandatory leader skin-in-the-game proportional to copied AUM, or an auditable, follower-outcome-based track record. These are clear gaps that an on-chain or verifiable alternative could target.

### Gaps
- Mitigations at OKX, BingX and MEXC (e.g. lead-trader deposit requirements, copy-stop features) were not researched within the tool budget.
- I found no evaluation data (before and after) on whether any mitigation improved follower outcomes.
- ZuluTrade's "ZuluGuard" and NAGA's copy protections were not retrieved.
