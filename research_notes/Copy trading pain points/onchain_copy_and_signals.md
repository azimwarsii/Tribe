# Onchain / DeFi Copy Trading and Signal-Following: How Followers Get Hurt

Scope: Hyperliquid vaults and copy trading, Solana/EVM wallet-copy tools (GMGN, Photon/BullX, Cielo, Nansen, Kolscan), perp-DEX copy, KOL calls and Telegram/Discord signal or "alpha" groups. Research date: 2026-10-28. Frequency labels (common / occasional / rare) are my judgement from the evidence below, not measured rates unless a number is given.

Source-quality note: many copy-trading "how-to" pages are written by bot vendors who sell the product, so they have a commercial interest. Where a claim rests only on a vendor page, it is marked "(vendor)". The strongest sources here are the WWW '26 arXiv paper (Luo et al.), the Helius MEV report, Bubblemaps' own investigations, Hyperliquid docs, and The Block / CoinDesk / The Defiant incident coverage.

---

## 1. Structural follower disadvantage: buying after the leader, MEV, latency, slippage, exit liquidity, bundled "smart money"

### Takeaway
On thin memecoin liquidity, copying is mechanically worse than leading. Every copied buy lands after the leader's buy has already moved the price on the bonding curve or AMM. Copiers set high slippage to make sure they fill, which makes them easy sandwich targets. They also become the exit liquidity for the wallet they copy. The best academic evidence (WWW '26) finds that wallet-copy strategies based on simple stats give **negative average copier returns** once real frictions are included. Frequency: **common, close to universal** in memecoin copy trading.

### Cited Findings
**Imitation penalty / buying higher (common)**
- Luo, Feng, Xu, Liu, "Resisting Manipulative Bots in Meme Coin Copy Trading" (arXiv 2601.08641, v3 Feb 5 2026, accepted to WWW '26). Dataset: 6,000 Solana/pump.fun meme coin projects. Key points: copy trading "has become the dominant entry strategy in meme coin markets"; copiers "strictly overpay on every replicated buy" because of bonding-curve price impact; under market frictions, statistic-driven wallet-selection models produce **negative average copier returns**. Even their best multi-agent system reaches only about **3% per meme coin investment** for copiers, while the smart-money wallets it identifies average **14%**. That gap of roughly 11 points is the follower disadvantage. — [arXiv 2601.08641](https://arxiv.org/html/2601.08641)
- The same paper says position bots mainly "redistribute profits within the participant pool, shifting gains from slower retail traders to early or better-positioned adversaries." — [arXiv 2601.08641](https://arxiv.org/html/2601.08641)
- Sniper bots buy within "the first one to five blocks (approximately 0.4 to 2 seconds on Solana)". The paper finds them "widespread but show minimal observable performance effect." — [arXiv 2601.08641](https://arxiv.org/html/2601.08641)
- Vendor and dev guides say a one-block delay in fast meme tokens can mean entering **10–50% higher**, and that slippage compounds when many people copy the same wallet. — [DEV Community: Copy trading on Solana](https://dev.to/tatelyman/copy-trading-on-solana-how-it-works-and-what-to-watch-out-for-b03); [RPC Fast copy-trading playbook (vendor)](https://rpcfast.com/blog/how-to-build-a-solana-copy-trading-bot)
- Cielo's own copy-trading docs warn that "Delays in execution can cause major slippage or missed entries" and that slippage, fees and timing "erode profits, especially with rapid trades or illiquid tokens." They give no numbers. — [Cielo docs: Risks and Considerations](https://docs.cielo.finance/guides/copy-trading/risks-and-considerations)
- Default slippage settings are loose. One open-source Solana copy skill defaults to **500 bps (5%)**. A TradeWiz guide tells users to raise buy slippage to **100%** if fills fail, "as slippage is common in copy trading." — [Clodds copy-trading-solana skill](https://tessl.io/registry/skills/github/alsk1992/CloddsBot/copy-trading-solana); [TradeWiz guide (vendor)](https://steemit.steemapps.com/solanatradingbots/@nodescribe/tradewiz-bot-on-solana-the-fastest-copy-trading-bot-full-guide-2025)

**MEV / sandwiching (common on Solana memecoins)**
- Helius (Jan 2025): most Solana sandwiching came from a private mempool run by one entity, **DeezNode**. From Dec 7 2024 to Jan 5 2025 it ran **1.55M sandwich transactions** for **65,880 SOL (~$13.43M)** profit, an average of **0.0425 SOL (~$8.67)** per attack. Helius also says "memecoin traders are especially susceptible to sandwich attacks, as they set high slippage tolerances when trading illiquid and highly volatile assets." — [Helius Solana MEV report](https://helius.dev/blog/solana-mev-report)
- Sandwich.me estimate presented at Solana Accelerate 2025: sandwich bots extracted **$370M–$500M over 16 months** on Solana. The upper figure includes memecoin revenue. — [Solana Compass: State of Solana MEV, Accelerate 2025](https://solanacompass.com/learn/accelerate-25/scale-or-die-at-accelerate-2025-the-state-of-solana-mev)
- Bitquery estimated **$29.7M** gross sandwich extraction over 11 months and found that **Pump.fun's launch curve and PumpSwap accounted for 96% of detected attacks**. That is exactly the venue where memecoin copy trading happens. An MEV Monitor dashboard counted **87,061 sandwiches and >$620k** extracted in one week. These methods differ, so the totals are not comparable. — [search summary of Bitquery / MEV Monitor; MEV Monitor](https://mirror.xyz/0x7c855e1bF411Ab5975235bC8C74E032615073044/mwh7Bkqp_nmsOkW6T7ee4tqXyXYgaRwLQd8zi38HbcY); [Cointelegraph: Solana MEV sandwich bot profits $30M](https://cointelegraph.com/news/solana-mev-sandwich-bot-profits-30-million-from-users)
- "Wide" sandwiches, where the legs land in different slots so atomic bundle protection does not stop them, reportedly grew from about **1% to 30%** of sandwich attacks. — [Lightspeed newsletter](https://lightspeed-4bed7b.beehiiv.com/p/groundswell-antisandwich-activity)
- Jito says nearly half of Solana sandwiches came from a single program. Marinade blacklisted **50+ validators** for sandwiching, and Jito banned 15 more. — [Helius](https://helius.dev/blog/solana-mev-report); [CryptoRank: Jito bans 15 validators](https://cryptorank.io/news/feed/4d1c4-jito-bans-15-additional-validators-after-data-emerges-of-widespread-sandwich-attacks)

**Bundled / insider wallets that look like smart money (common)**
- Bundle bots, meaning multiple controlled wallets buying in the creation block, "appear in roughly one quarter of projects" and are "weakly associated with lower returns and shorter dump durations." — [arXiv 2601.08641](https://arxiv.org/html/2601.08641)
- $LIBRA (launched Feb 14 2025): **82% of supply in one wallet cluster**. About **$87M in USDC/SOL drained in roughly an hour** (early Feb 15) through 5 recipient addresses. The token peaked near **$4B** and fell **85%**. Investor losses were **>$250M**. In Aug 2025 a judge unfroze $57M in USDC tied to the case. — [Bubblemaps: The $LIBRA Playbook](https://blog.bubblemaps.io/the-libra-playbook-how-one-cluster-drained-87-million-in-a-single-hour/)
- Hayden Davis, the self-described LIBRA "facilitator", admitted the team sniped the token at launch. — [The Block](https://www.theblock.co/post/341251/libra-memecoin-facilitator-hayden-davis-admits-team-sniped-token-at-launch)
- Bubblemaps linked one entity to both LIBRA and MELANIA. One LIBRA sniper (0xcEA) reportedly made ~$6M using side wallets funded cross-chain (aggregator figure). — [The Block: Bubblemaps links single entity](https://www.theblock.co/post/341238/bubblemaps-links-single-entity-to-libra-and-melania-memecoins); [Invezz](https://invezz.com/news/2025/02/17/libra-token-crash-linked-to-melania-insiders-with-87-million-withdrawn-early)
- $HAWK (Hawk Tuah, Dec 2024): Bubblemaps found **96% of supply in one cluster at launch**. Market cap fell from ~**$500M to ~$25M** within weeks. — [Bubblemaps: HAWK Anatomy of a Celebrity Rug](https://blog.bubblemaps.io/hawk-anatomy-of-a-celebrity-rug/)
- Cielo warns that copy targets may be bots, fake or scam wallets, and that copiers should avoid "wallets that are copying other wallets" and trace the real source. — [Cielo docs](https://docs.cielo.finance/guides/copy-trading/risks-and-considerations)

**Leader dumps on followers / edge doesn't transfer (common)**
- Guides note that if the target has insider access or early information, "their edge doesn't transfer to you", and that copiers are left holding heavy losses when wallets pump tokens and then dump them. — [DEV Community](https://dev.to/tatelyman/copy-trading-on-solana-how-it-works-and-what-to-watch-out-for-b03); [solanatools copy guide (vendor)](https://solanatools-io.pages.dev/blog/solana-copy-trading-guide)
- The WWW '26 paper says manipulative bots "front-run trades, hide positions, and fabricate sentiment" to "provoke predictable copy behavior." Tools like PumpKing are named as examples. — [arXiv 2601.08641](https://arxiv.org/html/2601.08641)

### Inferences
- The disadvantage is **structural, not a skill problem**. Copier fills come after the leader by definition. On a bonding curve, the copier's own buy (and every other copier's) raises the leader's exit price. So popular wallets attract copiers and then sell into them, even without malicious intent.
- High slippage settings protect against missed fills but hand the margin to MEV searchers. Copy-trade transactions are also predictable, since they trigger on a public leader transaction, which makes them easy to target.
- A "smart money" label based on early-block entries and realized PnL is biased toward insider and bundle wallets. Those wallets got in early because they are insiders, so copying them means buying the insiders' bags.

### Gaps
- I found no published dataset measuring **what share of copy trades lose money** or the aggregate dollar loss of copiers. The WWW '26 paper gives average returns, not a loss distribution.
- I found no documented case of a copy-trading bot itself front-running its users. That is plausible but unverified.
- Reddit first-person accounts were not surfaced by search.
- EVM-side copy MEV (Ethereum/Base copy bots) was not quantified.

---

## 2. KOL and signal-group abuse: paid promotions, pump-and-dumps, buy-before-call, fake win rates, unverifiable PnL

### Takeaway
Undisclosed paid shilling is close to the norm among crypto KOLs. A leaked price list showed fewer than 5% disclosing ads, at prices up to $60k per post. Single operators run networks of "independent" accounts. Academic work since 2018 shows Telegram/Discord pump groups are pervasive and that late participants take the losses. Win rates and PnL screenshots are easy to fake through cropped screenshots, realized-only PnL that hides open losses, wash-traded wallets, and deleting failed calls. Frequency: **common**.

### Cited Findings
- ZachXBT (2025): more than **100 crypto influencers** accepted promo deals without disclosing paid ads. In a leaked price sheet covering **160+ influencers**, **<5%** labeled the posts as ads, with rates from **$50 to $60,000 per post**. He linked undisclosed ads to pump-and-dump tokens. — [The Block](https://www.theblock.co/post/368956/zachxbt-says-over-100-crypto-influencers-accepted-promo-deals-without-disclosing-paid-ads); [Blocmates: 200+ influencers named](https://www.blocmates.com/news-posts/200-influencers-named-in-paid-crypto-promotion-leak-few-disclosed-ads)
- ZachXBT showed that **a single operator managed 16 X accounts** shilling meme coins (ANALOS, BALLZ, CATDOG and others), which fell sharply after promotion. To followers, it looked like independent consensus. — [BeInCrypto](https://beincrypto.com/zachxbt-exposes-16-x-meme-coin-accounts)
- Oct 2024: ZachXBT accused Ansem (then 507k+ X followers) of promoting memecoin pump-and-dumps, saying his posts could move small-cap tokens and lead followers into losses. Ansem cited his WIF call at a $100k market cap (later a $4.8B peak). The allegation is contested. — [The Defiant](https://thedefiant.io/news/hacks/zachxbt-accuses-influencer-ansem-promoting-solana-memecoin-pump-dumps-ac9dfb13); [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/crypto-influencer-ansem-accused-of-promoting-memecoin-pump-and-dumps-by-zachxbt)
- Aug 2025: ZachXBT listed **81 KOL accounts** promoting MEMENETIC presales. Dec 2025: he tied Soulja Boy to 73 crypto and 16 NFT projects flagged as scams. — [search summary; Cryptonews AU](https://cryptonews.com.au/news/zachxbt-raises-red-flags-over-new-soulja-boy-promoted-memecoin-132181/)
- No US enforcement action against memecoin KOL promotions was found. Coverage notes these promotions "have eluded major enforcement actions." — [The Block](https://www.theblock.co/post/368956/zachxbt-says-over-100-crypto-influencers-accepted-promo-deals-without-disclosing-paid-ads)
- Arkham added a KOL label for influencers with **>100k X followers** so users can spot dumping after promotion. Kolscan, the main Solana KOL wallet tracker, was reportedly **acquired by Pump.fun in mid-2025**, a neutrality conflict because it tracks tokens from its owner's launchpad. — [iTiger/Arkham KOL feature](https://www.itiger.com/news/2518404972); [Kalkine: Kolscan](https://kalkinemedia.com/education/guides/kolscan-how-solanas-smart-money-gets-ranked)
- A change.org petition, "Ban Kolscan.io", alleges KOLs "farm" followers who copy their tracked wallets. This is an advocacy claim, not evidence. Commenters say KOLs run multiple wallets (anecdotal). — [change.org](https://www.change.org/p/ban-kolscan-io)

**Academic pump-group evidence**
- Hamrick et al. (2018 data, older): over 6 months, **2,469 pumps on Telegram and 952 on Discord**, across ~2,000 coins and 220 exchanges. 10% of Telegram pumps raised price by **>18% within 5 minutes**. — [The Block: 500+ pump schemes studied](https://www.theblock.co/post/2209/researchers-study-over-500-cryptocurrency-pump-and-dump-schemes); [Hebrew University record](https://cris.huji.ac.il/en/publications/an-examination-of-the-cryptocurrency-pump-and-dump-ecosystem/)
- arXiv 2306.02148 (2023): participants without early information show "delayed selling behavior during the post-dump phase, resulting in significant losses compared to other participants." — [arXiv 2306.02148](https://arxiv.org/pdf/2306.02148v1)
- A 2025 arXiv paper, as reported by Bitget News, estimated crowd-pump volumes of **$8.07T** against $4.83T of regular trading, attributed to ~440 people. This is a secondary summary and the figure is extraordinary, so verify it before use. — [Bitget News](https://www.bitget.cloud/news/detail/12560604664491)

**Fake win rates / unverifiable PnL**
- Wash trading between self-controlled wallets makes on-chain scanners flag a wallet as a "profitable trader" to lure copytraders. — [Gemstone Labs: Fake Profitable Wallets](https://xxxdimacion.gitbook.io/gemstone-labs/ultimate-memecoin-guide/fake-profitable-wallets)
- Realized-only PnL hides open losses. One anecdote describes a wallet showing **+$247k realized at an 85% win rate** on GMGN while holding **−$489k unrealized** (unverified first-person account). — [teletype.in post](https://teletype.in/@mr.ponder/i4kUlsmz9z0); [MEXC news on realized PnL](https://www.mexc.com/news/980524)
- A Telegram channel openly advises cropping GMGN screenshots to show only ticker and "Total Profit" while promoting its paid VIP channel. — [t.me/fastgemlowcap](https://t.me/s/fastgemlowcap/117)
- Signal-group reviews report groups deleting failed calls to keep a polished win rate, "90% win rate" claims without on-chain proof, and VIP channels that vanish after payment. Claimed rates (e.g., "92%") differ sharply from tracked ones; one tracked gold-signal group showed **26%** over 6 months. These sources are low quality (review and affiliate sites). — [coinspot.io review](https://coinspot.io/en/reviews/xauusd-trading-signals/); [Plisio](https://plisio.net/crypto/best-crypto-signals)

### Inferences
- In the KOL "call" model, the caller buys first, posts, and followers buy into the caller's sell. This is the same structure as wallet copy trading, just with social latency instead of block latency.
- Multi-account operators and paid-shill networks produce **fake social consensus**, so "multiple KOLs called it" is weak evidence of anything.
- Tracker platforms owned by launchpads (Kolscan/Pump.fun) have conflicted incentives on what gets surfaced.

### Gaps
- I found no peer-reviewed study of 2024–2026 **Solana memecoin alpha/call groups** specifically, covering caller pre-buys, average follower return, or the time between call and caller sell.
- I found no regulator data (SEC/FCA/FTC) on Telegram signal-group losses in this pass.
- Discord-specific incidents were not found.

---

## 3. Hyperliquid vaults and leader risk: drawdowns, JELLY/HLP, liquidation, lockups, transparency as an attack surface

### Takeaway
Hyperliquid's vaults are the cleanest onchain "copy a leader" product, and its full position transparency is both the selling point and an attack surface. HLP, the protocol vault, was hit by at least four manipulation or liquidation events in 2025: ETH whale (Mar), JELLY (Mar), TST (Jul), POPCAT (Nov). Each time, Hyperliquid stepped in manually (delisting, forced settlement, paused flows). Depositors face lockups (1 day for user vaults, 4 days for HLP) and have no say over interventions. Visible leveraged whales like James Wynn were publicly liquidated while their liquidation prices were broadcast. Frequency: HLP manipulation events **occasional, about quarterly in 2025**. Whale-targeting **occasional**, with intent hard to prove.

### Cited Findings
**Vault mechanics (primary docs)**
- User vaults: **1-day lockup**. HLP: **4-day lockup**. Leader takes a **10% profit share**. "There may be some slippage as you withdraw and open positions are closed", meaning a depositor's withdrawal force-closes a proportional slice of positions. — [Hyperliquid docs: For vault depositors](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-depositors)
- Depositors' funds sit in protocol contracts and the leader cannot withdraw them directly, but a leader can still destroy vault value through trading. — [OneKey vault framework (vendor explainer)](https://onekey.so/blog/ecosystem/best-hyperliquid-vault-framework/)
- New HyperEVM-based vaults (CoreWriter, EIP-4626-style) are positioned as replacing "legacy" 2023 HyperCore vaults, so the mechanics are in flux. — [Hyperliquid docs: Vaults](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults)

**HLP incidents**
- **Mar 12 2025, ETH whale**: a whale withdrew margin from a ~$200M+ leveraged ETH long so that the liquidation was dumped on HLP. HLP lost ~**$4M**, HYPE fell 8.5%, and **>$130M** was withdrawn from HLP within a day. Hyperliquid said there was no exploit and the liquidation engine "could not handle the size." Margin rules were changed afterwards. — [The Block](https://www.theblock.co/post/345866/hype-drop-hlp-vault-loss-hyperliquid-whale-liquidation); [Arkham](https://info.arkm.com/research/hyperliquid-whale-passes-4m-loss-to-hlp-vault)
- **Mar 26 2025, JELLYJELLY**: a trader opened a large short on the illiquid memecoin, then pumped spot. HLP inherited the short through liquidation, with peak unrealized loss reported between **$10M and $13.5M** (sources differ). Validators **delisted JELLY and force-settled** positions at a favorable price, turning the result into a ~$700k gain. Bitget's CEO said it raised "serious doubts over its integrity." Hyperliquid said it would compensate affected JELLY traders and tighten risk protocols. — [CoinDesk](https://hotfix.coindesk.com/markets/2025/03/26/hyperliquid-delists-jellyjelly-after-vault-squeezed-in-usd13m-tussle); [The Block](https://www.theblock.co/post/348314/hyperliquid-delists-jellyjelly-memecoin-amid-whale-manipulation-fiasco); [Arkham](https://info.arkm.com/research/jellyjelly-exploit-on-hyperliquid); [The Defiant: compensate JELLY traders](https://thedefiant.io/news/defi/hyperliquid-to-compensate-jellyjelly-traders-and-strengthen-risk-protocols)
- **Jul 2025, TST**: cited as the second 2025 manipulation event. I did not retrieve details. — [Yahoo Finance](https://finance.yahoo.com/news/hyperliquid-hit-third-market-manipulation-113215395.html)
- **Nov 12 2025, POPCAT**: an attacker moved $3M USDC from OKX into **19 wallets**, opened **>$26M** in leveraged POPCAT longs, then let them liquidate. HLP lost **~$4.9–5M**. Hyperliquid **paused (Arbitrum bridge) deposits and withdrawals** for about an hour and manually closed the position. Links to BTX Capital are alleged, not proven. — [The Block](https://www.theblock.co/post/378606/hyperliquid-pauses-deposits-withdrawals-popcat-trading-scheme-speculation); [Decrypt](https://decrypt.co/348355/hyperliquid-paused-some-withdrawals-popcat-trader-scrutiny); [The Defiant](https://thedefiant.io/news/defi/large-popcat-trades-result-in-usd5-million-loss-for-hyperliquid-vault); [Cointelegraph](https://cointelegraph.com/news/hyperliquid-hlp-popcat-attack-3m-wipeout)
- **Oct 10 2025 flash crash**: Hyperliquid's first cross-margin **auto-deleveraging (ADL)** in over two years. HLP actually **gained ~$41.5M (~10%)**, but ADL force-closed profitable traders' positions. A Gauntlet / Tarun Chitra analysis estimated **$660M (simulated) to $2.1B (realized)** in PnL impact on winning traders, framed by Protos as ~$650M "excess losses" from an outdated ADL algorithm. Hyperliquid's founder disputes the aggregate harm. — [CoinGecko HLP analysis](https://www.coingecko.com/learn/hyperliquid-hlp-vault-analysis); [Protos](https://protos.com/outdated-algorithm-caused-650m-excess-losses-on-hyperliquid-report)

**Transparency as an attack surface / whale hunting**
- James Wynn: about **$99.3M** in BTC longs liquidated on May 30 2025 when BTC fell below $105k. A further 240 BTC (~$25M) was partially liquidated Jun 4, and another ~$16.14M after he had narrowly avoided liquidation by ~$40. He had published his positions and liquidation levels, and watchers broadcast them in real time. He was down ~$40M net in the month before Sept 2025. — [Arkham](https://info.arkm.com/research/james-wynn-liquidated-twice); [Bubblemaps intel case](https://intel.bubblemaps.io/cases/5/james-wynn-liquidations); [The Defiant: $47M in a week](https://thedefiant.io/hyperliquid-whale-james-wynn-loses-usd47-million-in-a-week)
- 10x Research: Hyperliquid's transparency enables a "people's hunt" (crowd-led whale hunt) to force liquidations. Bitcoin.com notes the mechanics of liquidation hunting are real, but intent toward Wynn specifically is unproven. — [Forklog / 10x Research](https://forklog.com/en/news/hyperliquid-opens-the-door-to-a-crowd-led-whale-hunt-says-10x-research); [Bitcoin.com (DA)](https://news.bitcoin.com/da/inde-i-crypto-whale-games-hvordan-likvidationsjagt-retter-sig-mod-gearede-tradere/)

### Inferences
- For a Tribe-style product: anyone copying a famous Hyperliquid whale inherits the whale's **publicly known liquidation price**, which can be targeted. A follower at higher leverage, or one entering later at a worse price, liquidates *before* the leader does.
- HLP depositors are effectively counterparty to every manipulation on illiquid listed assets. Their protection has depended on discretionary validator or team intervention, which is a governance risk as well as a safety net.
- A withdrawal from a user vault force-closes positions, so a run on a vault (after a drawdown or rumor) creates slippage that hits remaining depositors.

### Gaps
- I found no documented case of a **user-run (leader) vault being wiped out**, and no stats on leader-vault drawdown distributions. The Hyperliquid vault leaderboard or a Dune or Hypurrscan analysis would be needed.
- The leader minimum ownership requirement (commonly cited as 5%) was not confirmed in the docs page fetched.
- I did not find details on how many depositors left at a loss during the March 2025 withdrawals.

---

## 4. Track-record verification: what onchain data can and can't prove

### Takeaway
Onchain history proves that a wallet made trades. It does not prove that the wallet is the person's only wallet, that its profits weren't wash-traded or insider-sourced, or that the shown PnL includes unrealized losses. Cherry-picking a winning wallet from many is trivial. Frequency: manipulation of displayed track records is **common** in memecoin copy markets.

### Cited Findings
- Wash trading between self-owned wallets fabricates "profitable trader" status on scanners. — [Gemstone Labs](https://xxxdimacion.gitbook.io/gemstone-labs/ultimate-memecoin-guide/fake-profitable-wallets)
- Realized PnL excludes open positions, so big unrealized losses are hidden (example: 85% win rate realized vs −$489k unrealized, anecdotal). — [teletype.in](https://teletype.in/@mr.ponder/i4kUlsmz9z0); [MEXC](https://www.mexc.com/news/980524)
- Red flags from a GMGN copy guide: 90%+ win rates on tiny sizes (wash or test wallets); fewer than 50–100 trades; one token making up most of the PnL (luck); trading only one deployer's tokens (insider). — [Beehiiv: How to copy trade profitably on GMGN](https://cryptotrading-signals.beehiiv.com/p/how-to-copy-trade-profitably-on-gmgn)
- Insiders fund side wallets cross-chain (e.g., from Arbitrum/Avalanche in LIBRA) to break clustering, and use CCTP to obscure flows. — [Invezz on Bubblemaps LIBRA](https://invezz.com/news/2025/02/17/libra-token-crash-linked-to-melania-insiders-with-87-million-withdrawn-early)
- A single operator ran 16 X accounts, so off-chain identity is also easy to fake. — [BeInCrypto](https://beincrypto.com/zachxbt-exposes-16-x-meme-coin-accounts)
- Kolscan ties wallets to public X handles, but this relies on self-attestation. A KOL's tracked wallet need not be their only wallet. — [Solana Tracker KOL docs](https://docs.solanatracker.io/guides/kol-tracking); [change.org petition (anecdotal)](https://www.change.org/p/ban-kolscan-io)
- Suggested minimum screens (vendor): ≥50 trades in 30 days and ≥55% win rate. — [Clodds skill](https://tessl.io/registry/skills/github/alsk1992/CloddsBot/copy-trading-solana)

### Inferences
- **Can verify onchain:** trade timing, entry and exit prices, sizes, and realized PnL for a given address; whether the wallet bought in the creation block (bundle signal); funding sources (clustering).
- **Cannot verify reliably:** completeness (other wallets), the source of information (insider or not), whether gains come from self-trades, and survivorship (how many failed wallets the person discarded).
- Anything resembling "verified track record" therefore needs: unrealized-inclusive PnL, minimum trade counts, concentration checks, deployer-overlap checks, cluster and funding analysis, and ideally a forward-only (post-registration) record so a winner can't be picked after the fact.

### Gaps
- I found no rigorous estimate of what fraction of leaderboard "smart money" wallets on GMGN, Kolscan or Nansen are wash or insider wallets.
- Nansen "Smart Money" label methodology and its failure cases were not researched in this pass.

---

## 5. Risk management gaps: no stops, all-or-nothing sizing, no circuit breaker when a leader goes rogue

### Takeaway
Most copy tools mirror entries well but offer weak risk controls. Users are told to set slippage, per-wallet buy caps and market-cap filters, but stop-losses, drawdown limits and "unfollow if the leader goes rogue" circuit breakers are mostly absent or left to the user. Bot-custody hacks add a separate tail risk. Frequency: control gaps **common**; bot exploits **occasional**.

### Cited Findings
- Cielo's official risk page lists max-buy limits per wallet (per hour, day or week), a minimum market-cap filter, slippage tuning, "start with small amounts", and monitoring "your ROI compared to the copied wallet's." It does **not** address stop-loss, take-profit or MEV. It warns that "one misconfigured setting can cause repeated bad trades" and that bots "can over-commit to one wallet." — [Cielo docs](https://docs.cielo.finance/guides/copy-trading/risks-and-considerations)
- "If the target gets front-run or makes a losing trade, you lose too": the copier inherits every leader mistake with no independent judgment. — [DEV Community](https://dev.to/tatelyman/copy-trading-on-solana-how-it-works-and-what-to-watch-out-for-b03)
- Hyperliquid vaults: the depositor's only control is to withdraw, subject to the lockup. There are no depositor-side stops. — [Hyperliquid docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-depositors)
- Wynn-style visible-leverage blowups (~$99.3M liquidated in one event) show that a follower of a high-leverage leader carries an all-or-nothing outcome. — [Arkham](https://info.arkm.com/research/james-wynn-liquidated-twice)

**Bot custody / exploit risk (occasional)**
- Banana Gun (Sept 2024): users drained of ~**$1.9M–$3M** (500+ ETH, 11–36 victims depending on the source) via a message-oracle vulnerability. The team pledged treasury repayment. — [The Block](https://www.theblock.co/post/317282/banana-gun-telegram-bot); [Cointelegraph](https://cointelegraph.com/news/telegram-bot-banana-gun-users-drained-500-ether); [The Defiant](https://thedefiant.io/banana-gun-pledges-to-pay-back-victims-of-usd3-million-exploit); [Rekt](https://rekt.news/bananagun-rekt)
- Maestro and Unibot (Oct 2023, older): approval-related vulnerabilities, combined ~**$1.1M** (CertiK). Unibot lost >$600k. — [CertiK](https://www.certik.com/blog/maestro-and-unibot); [The Defiant](https://thedefiant.io/hacker-ransacks-usd600-000-from-popular-telegram-trading-bot-unibot)
- Bonkbot / Solareum (2024): >$500k in SOL exploited (vendor blog). — [Medium/Prodigy](https://medium.com/@ProdigyTradeBot/bonkbot-and-solareum-exploited-on-solana-for-more-than-500k-worth-of-sol-60574f1fdc2c)
- Phishing clones of GMGN sites and fake Telegram bots are a main source of user loss. — [Datawallet GMGN explainer](https://www.datawallet.com/crypto/gmgn-explained)

### Inferences
- Missing primitives that a product could own: per-leader drawdown circuit breakers (auto-unfollow at X% loss); auto-pause when a leader's behavior changes (new token type, size spike, deployer overlap); follower stop-loss and take-profit that run independently of the leader; size caps tied to pool liquidity rather than fixed amounts; and leverage caps below the leader's.
- Custodial Telegram bots (which hold keys) are a separate attack surface from the strategy itself.

### Gaps
- I did not compare which tools (GMGN, Photon, BullX, Trojan, Axiom) offer native follower-side SL/TP or auto-unfollow.
- No data on how often copy-traders set stops.

---

## 6. Mitigations that exist and how well they work

### Takeaway
Mitigations reduce but don't remove the disadvantage. Private or MEV-protected routing (Jito bundles, private RPCs) blocks classic same-block sandwiches but not "wide" cross-slot sandwiches (reportedly up to ~30% of attacks), and it can't fix latency or the imitation penalty. Validator blacklists cut known sandwichers. Tight slippage reduces MEV but increases failed fills. Exchange-side fixes on Hyperliquid (margin rule changes, delistings, manual intervention) have been reactive.

### Cited Findings
- MEV-protected or private routing "structurally prevents sandwich attacks because the attacker cannot place their front-run transaction before yours within the bundle." — [madeonsol MEV guide (vendor)](https://madeonsol.com/blog/mev-bots-on-solana-explained)
- But sandwichers also use Jito bundles atomically, and "wide" cross-slot sandwiches rose from ~1% to ~30% of attacks, getting around single-bundle protection. — [Lightspeed](https://lightspeed-4bed7b.beehiiv.com/p/groundswell-antisandwich-activity); [Ryder sandwich explainer](https://ryder.id/blogs/post/sandwich-attacks-how-mev-bots-tax-dex-traders)
- Jito disabled its public mempool in Mar 2024 amid MEV-bot growth (older), which pushed sandwiching to private mempools like DeezNode's. — [Forklog](https://forklog.com/en/solanas-jito-mempool-disabled-amid-mev-bot-surge/); [Helius](https://helius.dev/blog/solana-mev-report)
- Validator-level action: Marinade blacklisted 50+ sandwiching validators, and Jito banned 15 more. A 2025 piece credits stake-weighted changes with reducing sandwich activity (claims of "$500M slashed" come from a low-quality aggregator). — [Helius](https://helius.dev/blog/solana-mev-report); [CryptoRank](https://cryptorank.io/news/feed/4d1c4-jito-bans-15-additional-validators-after-data-emerges-of-widespread-sandwich-attacks); [digitalmoneybox (low quality)](https://digitalmoneybox.com/news/security/solana-slashes-500m-sandwich-attacks-as-75-of-sol-gets-staked-in-2025-security-overhaul)
- Tool-level: Cielo recommends max-buy caps, minimum market-cap filters and slippage tuning. Guides recommend minimum trade counts and win-rate screens. — [Cielo docs](https://docs.cielo.finance/guides/copy-trading/risks-and-considerations); [Clodds skill](https://tessl.io/registry/skills/github/alsk1992/CloddsBot/copy-trading-solana)
- The WWW '26 paper's multi-agent wallet-selection system was "the only approach that delivers a positive average copier return" (~3% per coin), against negative returns for statistic-based selection. This suggests **wallet selection and bot-detection** matter more than execution speed. — [arXiv 2601.08641](https://arxiv.org/html/2601.08641)
- Hyperliquid: after March 2025 it changed margin and leverage rules, delisted JELLY with validator votes, compensated JELLY traders, paused flows during POPCAT, and moved toward new HyperEVM vault standards. All of this was reactive and discretionary. — [The Defiant](https://thedefiant.io/news/defi/hyperliquid-to-compensate-jellyjelly-traders-and-strengthen-risk-protocols); [The Block](https://www.theblock.co/post/378606/hyperliquid-pauses-deposits-withdrawals-popcat-trading-scheme-speculation)
- Visibility tools (Bubblemaps clusters, Arkham KOL labels) help detect insider supply concentration *after the fact*. Bubblemaps flagged 96% (HAWK) and 82% (LIBRA) cluster concentration. — [Bubblemaps HAWK](https://blog.bubblemaps.io/hawk-anatomy-of-a-celebrity-rug/); [Bubblemaps LIBRA](https://blog.bubblemaps.io/the-libra-playbook-how-one-cluster-drained-87-million-in-a-single-hour/)

### Inferences
- **Delayed copying** (deliberately waiting) avoids racing snipers but guarantees worse entries on momentum tokens. It mainly makes sense for slower, more liquid assets (majors, perps) rather than memecoins.
- **Vault deposit limits** and leader-stake requirements align incentives somewhat but do nothing against external manipulation of illiquid listed markets (the HLP events).
- The highest-leverage mitigations for a product are probably pre-trade filters (bundle, cluster and deployer checks, liquidity-relative sizing), not faster execution. That is consistent with the WWW '26 finding.

### Gaps
- **Perp-DEX copy on GMX, dYdX and Vertex was not researched in this pass.** I found no incident data for copy features on those venues. Vertex's status (it reportedly wound down in 2025) is unverified here.
- No independent measurement of private-RPC or MEV-protect effectiveness for copy-trade flows specifically.
- No evidence collected on Nansen "smart money follow", Photon or BullX specific failure modes beyond the general Solana mechanics.
