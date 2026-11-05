# Pain Points and Incidents with Automated Trading Bots (API-key platforms and Telegram/onchain bots)

Scope: API-key bot platforms (3Commas, Pionex, Cryptohopper, Bitsgap, Coinrule, HaasOnline, Kryll, TradeSanta) and Telegram/onchain bots (Banana Gun, Maestro, Trojan, BonkBot, Unibot, Photon, BullX, GMGN, Axiom). Evidence window is mostly 2022–2026. Research date: 2026-10-28.

Frequency labels: **common** = recurring across many users/platforms; **occasional** = several documented incidents a year; **rare** = one-off or few documented cases.

---

## 1. Security incidents (platform exploits, key leaks, wallet drains, phishing clones, malicious bots)

### Takeaway
The biggest losses fall into two groups. API-key platforms leak keys that are then used for contra-trading (3Commas, 2022: about $27M verified across 86 users). Telegram bots hold users' private keys or rely on router approvals, so one bug drains many wallets (Maestro about $500K, Unibot about $640K, Banana Gun about $3M, DEXX about $21M). Bots that paid victims back from treasury or revenue (Maestro, Unibot, Banana Gun, GMGN) kept their users. 3Commas fought the claims for months and paid no compensation that I could find.

### Cited Findings

**3Commas API key leak (Oct–Dec 2022). Root cause disputed, scale large, occasional class of event**
- In October 2022, 3Commas and FTX looked into unauthorized trades in DMG pairs on FTX. Hackers had made new 3Commas accounts to run them. 3Commas said the keys were taken "outside the platform", probably by phishing. — [The Block](https://www.theblock.co/post/179237/ftx-api-keys-3commas-exploited)
- Journalist Colin Wu reported at least four users affected in the October FTX wave. One user claimed about $1.5M in losses. — [Wublock Substack (Colin Wu)](https://wublock.substack.com/p/review-of-the-whole-process3commas); [Web3IsGoingGreat](https://web3isgoinggreat.com/single/several-users-report-losing-more-than-a-million-dollars-each-in-3commasftx-theft)
- In December 2022, CZ (Binance) said he was "reasonably sure" 3Commas keys were leaking. 3Commas then confirmed to The Block that the leaked files were real. CEO Yuriy Sorokin said no proof of an inside job had been found. — [The Block](https://www.theblock.co/post/198295/binance-warns-about-3commas-api-leak-says-users-should-disable-keys); [Cointelegraph](https://cointelegraph.com/news/3commas-ceo-confirms-api-key-leak-following-warning-from-cz)
- An anonymous party said it held about 100,000 API keys (Binance, KuCoin and others) and published about 10,000. 3Commas confirmed the files contained valid keys on 28 Dec 2022 and asked exchanges to revoke connected keys. — [ForkLog / HAPI analysis](https://forklog.com/en/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident/); [BleepingComputer](https://www.bleepingcomputer.com/news/security/crypto-platform-3commas-admits-hackers-stole-api-keys)
- HAPI's figures as of 10 Jan 2023: 86 affected users from 32 countries and **$27,285,845 in verified losses**. The smallest loss was about $500 and the largest $5.9M. Six users lost more than $1M each, together about $18.3M (67%). By exchange: Binance 47 users (about $23.5M), KuCoin 28 (about $2.1M), Coinbase Pro 10 (about $1.5M), Bittrex 1. October had 4 cases (about $470K) and November 24 victims (about $14.9M). — [ForkLog / HAPI](https://forklog.com/en/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident/)
- Other loss estimates range from "at least $6M" to more than $20M tallied by a victim group. The figures conflict and depend on who is counting. — [BleepingComputer](https://www.bleepingcomputer.com/news/security/crypto-platform-3commas-admits-hackers-stole-api-keys); [Hackread](https://www.hackread.com/3commas-api-database-leak-anonymous-hacker/)
- How the response went: 3Commas called the October and December reports "false rumors" based on falsified evidence. HAPI says the company denied the accusations for months and hinted at user negligence. Anonymous former developers told HAPI an insider might have leaked the keys. More than 50 users organised on Telegram and said their keys had leaked rather than been phished. — [ForkLog / HAPI](https://forklog.com/en/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident/); [BleepingComputer](https://www.bleepingcomputer.com/news/security/crypto-platform-3commas-admits-hackers-stole-api-keys)
- Compensation: the 3Commas CEO argued that paying victims would mean "we will just be paying for users to lose their API keys". **FTX** separately paid a one-time $6M to its own affected users. — [BleepingComputer](https://www.bleepingcomputer.com/news/security/crypto-platform-3commas-admits-hackers-stole-api-keys); [Bitcoinist](https://bitcoinist.com/ftx-to-provide-6m-to-phishing-victims/amp/)
- The FBI reportedly joined the investigation on 29 Dec 2022, and a US class action was being organised. — [ForkLog](https://forklog.com/en/fbi-probes-3commas-api-key-leak-reports-say/); [Bitdefender](https://www.bitdefender.com/en-us/blog/hotforsecurity/the-fbi-is-reportedly-probing-3commas-after-api-keys-leaked-on-twitter)
- Exchange-side failures: Binance knew of the incident by November 2022 but declined HAPI's request to cooperate. Binance, KuCoin and Coinbase reportedly did not tell clients quickly that keys had been deactivated. The leaked Binance keys were more than 3 years old, although HAPI notes most exchanges expire trading keys after 3–6 months by default. All exchanges eventually disabled 3Commas keys. — [ForkLog / HAPI](https://forklog.com/en/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident/)

**Maestro router exploit (24–25 Oct 2023). Smart-contract bug, refunded**
- Attackers exploited the Maestro Router 2 contract, which lacked input validation, and took about 280 ETH (about $500K). Maestro refunded **610 ETH (about $1M)** from its own revenue. The ~$1M is the refund, not the loss. — [Finance Magnates](https://www.financemagnates.com/cryptocurrency/maestro-trading-bot-refunds-610-eth-to-users-following-router-exploit/); [BeInCrypto](https://beincrypto.com/maestro-refunds-after-attack); [Revoke.cash](https://revoke.cash/exploits/maestro)

**Unibot router exploit (31 Oct 2023). Token-approval bug, compensation pledged**
- A token-approval bug in Unibot's new router drained users who had approved the contract. The attacker swapped the loot for about 355.75 ETH (about $640K; some sources say about $630K) and laundered it through Tornado Cash. Unibot paused the router and promised compensation. — [Rekt](https://alpha.rekt.news/unibot-rekt); [CertiK](https://www.certik.com/blog/maestro-and-unibot)
- CertiK puts the combined Maestro and Unibot loss at about $1.1M. — [CertiK](https://www.certik.com/blog/maestro-and-unibot)

**Banana Gun exploit (19 Sep 2024). Telegram message-oracle flaw, refunded**
- Attackers manually moved about **$3M** in ETH out of the wallets of **11 users**, most of them experienced traders. Banana Gun blamed a flaw in the "Telegram message oracle" it used. It refunded users in full from its treasury without selling tokens, and BANANA rose about 7%. It took its EVM and Solana bots offline during the investigation, then added **2FA and a transfer delay**. — [The Block](https://www.theblock.co/post/318074/banana-gun-exploit-refund); [The Defiant](https://thedefiant.io/news/defi/banana-gun-pledges-to-pay-back-victims-of-usd3-million-exploit); [Rekt](https://alpha.rekt.news/bananagun-rekt); [CoinGape](https://coingape.com/banana-price-jumps-7-as-banana-gun-issues-full-refund-to-hack-victims)
- A vendor comparison quotes $1.9M for Banana Gun. This conflicts with the $3M in primary coverage and could not be verified. — [DEXTools comparison](https://www.dextools.io/tutorials/maestro-vs-trojan-vs-banana-gun)

**Solareum / BonkBot (March 2024). Exported keys drained, app shut down**
- About **$523K in SOL** was drained from **300+** Solana users. It was first blamed on BonkBot. BonkBot denied any lapse and said victims had exported their private keys into other apps. Solareum, a Telegram trading app, said the one thing all victims had in common was importing their keys into Solareum, and it **shut down**. — [Decrypt](https://decrypt.co/224127/solana-wallets-drained-523k-bonkbot-denies-link); [Decrypt (shutdown)](https://decrypt.co/224371/solana-telegram-trading-bot-shut-down-users-drained-523k); [CoinMarketCap Academy](https://coinmarketcap.com/academy/article/solareum-telegram-trading-app-shuts-down-following-dollar523k-exploit-bonkbot-users-affected)

**DEXX (16 Nov 2024). Custodial private-key leak, the largest bot-style drain**
- The memecoin trading terminal DEXX lost about **$21M** (some estimates up to $30M; one report says 900 users affected). CertiK blamed "improper management of private keys" that exposed official private keys. SlowMist linked more than 8,600 wallets to the hack. Recovery has been minimal: DEXX offered the hacker a bounty and went to law enforcement. — [Brave New Coin / SlowMist](https://bravenewcoin.com/insights/dexx-hack-investigation-unveils-over-8600-solana-wallet-links-slowmist-report); [BitDegree](https://www.bitdegree.org/crypto/news/dexx-hack-breakdown-over-8000-wallets-linked-to-30-million-solana-theft); [CryptoRank](https://cryptorank.io/news/feed/85aa7-meme-coin-trading-platform-dexx-suffers-16-79-million-security-breach) (CryptoRank headline cites $16.79M, so figures conflict)

**GMGN phishing (Oct 2025). Refunded**
- GMGN co-founder Haze said a counterfeit third-party token page tricked users into approving unauthorized transactions. One report says 107 users were affected and **100% reimbursed** to their GMGN accounts the same day. — [Phemex News](https://phemex.com/news/article/gmgn-to-fully-compensate-users-after-phishing-attack-30566); [MEXC News](https://www.mexc.com/news/144644)

**Axiom insider wallet-tracking allegation (26 Feb 2026). Privacy/insider risk at custodial terminals**
- ZachXBT alleged that Axiom staff, centred on a senior BD employee, misused internal support tools to look up users by referral code, wallet address or user ID for insider trading. Axiom said it was "shocked and disappointed" and removed access to the tools. These remain allegations. — [The Block](https://www.theblock.co/post/391423/zachxbt-investigation-into-alleged-employee-insider-trading); [Decrypt](https://decrypt.co/359223/y-combinator-backed-axiom-employees-accused-insider-trading-zachxbt); [Bitcoin.com](https://news.bitcoin.com/zachxbt-alleges-axiom-employees-misused-internal-tools-to-track-user-wallets)

**Custodial private-key risk (common, structural)**
- A DEXTools article says Maestro, Trojan and Banana Gun are all custodial: the bot generates and stores the private key on its servers. — [DEXTools](https://www.dextools.io/tutorials/maestro-vs-trojan-vs-banana-gun)
- In 2023, security firms (Beosin, Halborn) said it was unclear how Telegram bots store keys, that many bots are not open-source or audited, and that there is "no insight into storage methods for private keys". — [Cointelegraph](https://cointelegraph.com/news/should-telegram-trading-bots-be-trusted); [The Block](https://www.theblock.co/post/241386/telegram-crypto-trading-bots-spark-fears-over-security-vulnerabilities)
- A hacked Telegram account can expose the entire bot-linked wallet even when the bot itself is secure. — [OneKey blog](https://onekey.so/blog/es/learn/bot-wallets-drained-who-stole-your-binance-life/)

**Phishing clones and fake bots (common)**
- A fake Photon site at a lookalike domain copied the real design and ran a wallet drainer once a wallet was connected. The real domain is photon.tinyastro.io. The report is undated. — [PCRisk](https://www.pcrisk.com/removal-guides/34489-fake-photon-website-scam)
- A fake "BullX – Login" page on Cloudflare Pages harvesting seed phrases, and a gmgn-wallet.com drainer, were flagged in March 2026. — [PhishDestroy](https://phishdestroy.io/domain/bullix666555444.pages.dev); [PhishDestroy](https://phishdestroy.io/domain/gmgn-wallet.com)
- Scam Sniffer reported a 2000% rise in malicious Telegram groups. These use fake "verification bots" inside fake trading, alpha and airdrop groups to spread malware that steals private keys. — [Cointelegraph](https://cointelegraph.com/news/malicious-telegram-group-scams-have-increased-2000-since-november-scam-sniffer)
- Fake "Safeguard" verification bots send users to pages that get them to sign malicious approvals. Drainer kits involved include Inferno and Angel/Pink. — [Security Alliance](https://radar.securityalliance.org/psa-fake-telegram-support-channels-drainers/); [timsh.org investigation](https://timsh.org/scam-telegram-investigation/)

**Malicious bots and scripts on GitHub and YouTube (occasional, high per-victim loss)**
- Kaspersky's "GitVenom" campaign used hundreds of fake GitHub repos, often posing as Telegram bitcoin-wallet bots or trading tools, to deliver info-stealers and clipboard hijackers. One victim lost about 5 BTC (about $442–485K) in Nov 2024. Reported Feb 2025. — [CoinDesk](https://hotfix.coindesk.com/tech/2025/02/26/hackers-are-using-fake-github-code-to-steal-your-bitcoin-kaspersky); [ForkLog](https://forklog.com/en/news/fake-software-on-github-nets-hackers-485000-in-bitcoin-from-a-single-attack)
- Fake "MEV arbitrage bot" smart contracts promoted in AI-generated YouTube tutorials (users deploy the contract in Remix, fund it, and call Start(), which drains it) stole more than $1M, per SentinelLABS. SlowMist documented the same scam rebranded as a "ChatGPT Arbitrage MEV Bot". — [Web3IsGoingGreat](https://web3isgoinggreat.com/single/mev-bot-scam); [Cointelegraph / SlowMist](https://cointelegraph.com/news/old-mev-bot-scam-drops-chatgpt-into-new-name-ai-hype-slowmist); [SlowMist Medium](https://slowmist.medium.com/a-new-twist-on-old-scams-the-arbitrage-mev-bot-deception-8a9118b4645a)

### Inferences
- When a Telegram bot is exploited, fast compensation from treasury or fee revenue has become the expected norm (Maestro, Unibot, Banana Gun, GMGN). That is possible because these bots make large fee revenue. 3Commas's refusal stands out as the counter-example, and it badly damaged trust and invited legal action.
- Root causes split three ways. Custodial key handling (DEXX, Banana Gun oracle, Axiom insider access). Smart-contract approval and router bugs (Maestro, Unibot). Social engineering (clones, fake verification bots, GitHub and YouTube malware). Users find it very hard to tell these apart at the moment they lose money, which is why blame gets disputed (BonkBot vs Solareum, 3Commas vs phishing).
- Per-incident sizes for Telegram bots ($0.5M–$3M) are small compared with the 3Commas API leak ($27M) and DEXX ($21M). Incidents are frequent, though: roughly one notable bot exploit or drain every few months from 2023 to 2025.

### Gaps
- I could not confirm whether the 3Commas class action was filed or settled, or whether 3Commas ever paid victims.
- I could not confirm that Unibot's pledged compensation was fully paid out, or verify independently that the Banana Gun refunds were completed.
- No public incident post-mortems were found for Trojan, Photon, BullX or Axiom platform-level hacks. Only clone/phishing sites and the Axiom insider allegation turned up.
- No incident data was found for HaasOnline, Kryll, Coinrule, TradeSanta or Bitsgap in 2022–2026.

---

## 2. API-key risks (withdrawal permissions, IP whitelisting, keys stolen from providers, pump trades on illiquid pairs)

### Takeaway
Leaked trade-only keys can still empty an account without withdrawal rights. Attackers use the victim's key to buy illiquid tokens from the attacker's own sell orders at inflated prices (contra-trading). Defences such as key expiry, IP whitelisting and exchange monitoring were weak in 2022.

### Cited Findings
- How the 3Commas thefts worked: attackers placed high-priced sell orders on illiquid assets from outside accounts, then used victims' keys to buy them with liquid assets (contra and wash trading). In one example a victim's 50 BTC of liquid assets fell to 7 BTC, with 43 BTC going to the attacker. API keys let them bypass 2FA and other exchange security. — [ForkLog / HAPI](https://forklog.com/en/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident/)
- The FTX DMG-pair trades in Oct 2022 were the same pattern: unauthorized trades in a thin pair, executed through new 3Commas accounts. — [The Block](https://www.theblock.co/post/179237/ftx-api-keys-3commas-exploited)
- The leaked Binance keys were more than 3 years old, which shows long-lived keys without expiry. — [ForkLog / HAPI](https://forklog.com/en/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident/)
- Binance publicly told users to disable keys linked to 3Commas and threatened to cut off 3Commas' access. — [The Block](https://www.theblock.co/post/198295/binance-warns-about-3commas-api-leak-says-users-should-disable-keys); [AMBCrypto](https://ambcrypto.com/binance-threatens-to-cut-off-3commas-access-to-its-platform-heres-why/amp/)

### Inferences
- "No withdrawal permission" is necessary but not enough. Trade permission on an exchange with illiquid pairs is effectively a withdrawal channel. Mitigations that work are IP whitelisting tied to the provider's servers, pair and asset allowlists, short key lifetimes, and exchange-side anomaly detection on contra-trades in thin markets.
- API-key platforms concentrate risk: one provider database holds keys to thousands of exchange accounts, so a single breach is systemic (about 100K keys in the 3Commas case).

### Gaps
- I found no hard data on how many users enable IP whitelisting, or on whether 3Commas made it mandatory afterwards. My training knowledge suggests 3Commas moved to exchange OAuth/fast-connect and IP-restricted keys, but I did not verify this in this session.

---

## 3. Bot scams, Ponzi schemes and fake bots

### Takeaway
The largest bot-branded losses come from outright fraud, not hacks. Mirror Trading International (MTI) took about 29,421 BTC (more than $1.7B) with a trading bot that did not exist. Regulators now treat "AI bot" claims of guaranteed returns as a fraud red flag.

### Cited Findings
- On 30 Jun 2022 the CFTC charged MTI and CEO Cornelius Johannes Steynberg. The bitcoin "trading pool", marketed with a bot, took **29,421 BTC (>$1.7B)**, including from at least 23,000 Americans. The CFTC said no trading bot existed and that account balances were invented on a fictitious broker. — [CoinDesk](https://hotfix.coindesk.com/policy/2022/06/30/cftc-charges-south-african-bitcoin-club-mti-in-17b-fraud); [BNN Bloomberg](https://www.bnnbloomberg.ca/cftc-sues-over-alleged-1-7-billion-fraud-involving-bitcoin-1.1786675)
- Judgments reported later conflict: a $1.7B restitution order (Sept 2023), a $3.4B default judgment against Steynberg, and a $1.4B consent judgment against MTI. — [Cointelegraph](https://cointelegraph.com/news/cftc-fines-mti-1-7b-for-bitcoin-related-forex-fraud); [BehindMLM](https://behindmlm.com/mlm/regulation/johann-steynberg-sued-by-cftc-over-mti-fraud-1-7b-ponzi)
- The CFTC advisory "AI Won't Turn Trading Bots into Money Machines" (25 Jan 2024) warns that promises of guaranteed or unreasonably high returns from AI bots are red flags. It notes AI cannot predict sudden market moves and uses MTI's "≥10% monthly returns" pitch as its example. — [CFTC](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html)
- The fake MEV-bot contracts promoted on YouTube (>$1M) and their "ChatGPT" rebranding are covered in section 1. — [SlowMist](https://slowmist.medium.com/a-new-twist-on-old-scams-the-arbitrage-mev-bot-deception-8a9118b4645a)

### Inferences
- The scam pattern is consistent: promised fixed monthly returns, MLM referral structures, custody of user funds by the "bot" operator, and dashboards with no verifiable trades. Anything that offers bot returns without the user keeping custody and an onchain or exchange-verifiable trade record fits the fraud template.

### Gaps
- I found no solid data on fake bot marketplaces, or on signal-bot subscriptions that consistently underperform. Evidence on signal subscriptions is mostly anecdotal or from affiliate reviews (see section 5).

---

## 4. Reliability (downtime, missed trades, bugs, exchange outages, grid/DCA bag holding, backtest overfitting)

### Takeaway
Reliability complaints are common but poorly documented in primary sources. They cluster around exchange or platform failures during volatility and the structural failure of grid/DCA bots in trending markets, which leaves users holding losing bags. The 10 Oct 2025 crash ($19B liquidated) showed that bots depend on exchange infrastructure that can behave abnormally exactly when it matters.

### Cited Findings
- 10 Oct 2025: about $19B in liquidations across crypto. Binance said its matching engines and API kept running but admitted "some platform modules briefly experienced technical glitches" and depegs of USDe, BNSOL and wBETH (21:36–22:16 UTC). It paid about $283M in compensation and launched a $300M goodwill programme. Traders reported exit orders being rejected for more than 100 minutes, which is unverified. — [Decrypt](https://decrypt.co/344026/binance-reimburses-283m-after-market-crash-and-asset-depegging-issues); [Yahoo Finance](https://finance.yahoo.com/news/binance-pins-cryptos-worst-ever-085054129.html); [CryptoRank](https://cryptorank.io/news/feed/992cc-binance-system-failure-reduceonly-order-outage)
- Grid and DCA bag holding: if price falls below the grid range, the user is left holding a losing position with no sell orders. A DCA bot that runs out of capital mid-dip leaves the user stuck at a bad average price. These are affiliate-style sources describing well-known mechanics. — [AI Trading Ranked (Pionex grid tutorial)](https://ai-trading-ranked.pages.dev/posts/pionex-grid-bot-tutorial); [Gainium](https://gainium.io/best/grid)
- Pionex complaints, from a low-confidence review aggregator: slow support during volatility, crashes without alerts, and accounts frozen under "risk control" with profits confiscated. — [TradingTools.review](https://tradingtools-directory.pages.dev/tools/pionex/)
- One Trustpilot review says a 3Commas grid-bot crash error cost about $1.5K. This is a single anecdote. — [Trustpilot 3Commas](https://ca.trustpilot.com/review/3commas.io?page=6)
- Cryptohopper reviews note gaps between backtests and live results caused by slippage and volatility, and strategies that work in bull markets but "struggle in downtrends". — [Bitget Academy](https://www.bitget.cloud/academy/cryptohopper-review); [Gainium](https://gainium.io/review/cryptohopper)
- Telegram-bot architecture: stateful backends behind stateless Telegram interfaces can produce duplicated transactions and missed execution. This is a vendor source. — [Turnkey](https://www.turnkey.com/blog/designing-telegram-trading-bots-patterns-primitives-and-security)
- Banana Gun took its EVM and Solana bots fully offline during its Sept 2024 incident, so users could not trade. — [The Block](https://www.theblock.co/post/318074/banana-gun-exploit-refund)

### Inferences
- Bag holding in grid/DCA bots is the most common source of "bot losses" for retail users of API-key platforms. It happens because the strategies are tuned for ranging markets and users cannot see their regime risk.
- Bots inherit exchange tail risk (rejected orders, depegged collateral, display errors), so "automation" can fail exactly when manual traders also cannot act.

### Gaps
- I found no status-page or uptime statistics for 3Commas, Pionex, Cryptohopper, Bitsgap or the Telegram bots, and no quantified dataset of missed or wrong trades.
- I found no Reddit threads with primary detail in this session. The Reddit evidence (r/3commas, r/algotrading) is unverified here.

---

## 5. Strategy opacity (what the bot does, marketplace performance, survivorship bias)

### Takeaway
Marketplace and signal performance is mostly self-reported or platform-curated and depends on market regime. Independent verification is weak, and I found no rigorous study of survivorship bias in bot marketplaces.

### Cited Findings
- Cryptohopper says it screens marketplace providers and shows historical performance and ratings, but notes past results do not guarantee future ones. An affiliate review claims full verifiable histories, so sources conflict on how verifiable performance really is. — [Gainium review](https://gainium.io/review/cryptohopper); [Bitget Academy](https://www.bitget.cloud/academy/cryptohopper-review)
- Marketplace strategy results "vary significantly" with market conditions and the strategy chosen. — [Bitget Academy](https://www.bitget.cloud/academy/cryptohopper-review)
- Cryptohopper's Trustpilot score is about 3.5–3.7/5 across roughly 200–360 reviews, with complaints about technical issues and unexpected charges. Timing is unclear. — [Techpoint Africa](https://techpoint.africa/guide/cryptohopper-review/); [SpotSaaS](https://www.spotsaas.com/product/cryptohopper/reviews?page=26)
- Telegram bots are often closed-source and unaudited, so users cannot inspect the execution logic or how keys are handled. — [Cointelegraph](https://cointelegraph.com/news/should-telegram-trading-bots-be-trusted)

### Inferences
- Marketplace leaderboards favour strategies that did well in the recent regime. Delisted or abandoned strategies probably drop out of view, which is classic survivorship bias. This is inferred, not measured.

### Gaps
- I found no academic or industry study quantifying survivorship bias or live-vs-backtest decay in crypto bot marketplaces (Cryptohopper, 3Commas, Kryll, Bitsgap, Pionex).

---

## 6. Fees and costs (subscriptions, per-trade fees, priority fees, MEV)

### Takeaway
Telegram bots usually charge about 0.5–1% per trade on top of gas, priority fees and Jito tips. Users still lose large amounts to sandwich MEV, mostly through web terminals like Axiom, Bloom and Photon. API-key platforms charge stacked subscriptions plus marketplace and signal fees.

### Cited Findings
- Per-trade fees: Trojan and Maestro charge about 1% flat (Trojan 0.9% with referral). Banana Gun charges about 0.5% on ETH buys. These come from vendor and affiliate comparisons and conflict slightly. — [DEXTools](https://www.dextools.io/tutorials/maestro-vs-trojan-vs-banana-gun); [Datawallet](https://www.datawallet.com/crypto/best-crypto-telegram-bots)
- Anti-MEV routing: Banana Gun routes Solana trades through Jito, and Ethereum bots use private mempools, but protection is not complete. — [DEXTools](https://www.dextools.io/tutorials/maestro-vs-trojan-vs-banana-gun)
- Ghost (sandwiched.me), Oct 2025: wide multi-slot sandwiches on Solana took about **529,000 SOL** over a year, peaking at about 87K SOL in Jan 2025. About **70% of extracted SOL came from Axiom users**, followed by Bloom and Photon. — [Ghost thread (Threadreader)](https://threadreaderapp.com/thread/1978555200802885699)
- Sandwiched.me estimated **$370–500M** extracted from Solana users over 16 months. — [DEV Community summary](https://dev.to/ohmygod/solana-mev-defense-in-2026-how-sandwich-bots-extracted-500m-and-the-6-protocol-level-defenses-16d9); [Lightspeed](https://lightspeed-4bed7b.beehiiv.com/p/solana-s-open-secret)
- In June 2024, Solana validators running sandwich attacks were removed from Jito and Solana Foundation stake programmes. — [FXStreet](https://www.fxstreet.com/amp/cryptocurrencies/news/solana-kicks-out-validators-extracting-value-from-users-through-sandwich-attacks-202406101647)
- Bitquery (about Oct 2025 to Oct 2026): about $29.7M extracted gross across 6.85M attacks by 2,545 bot wallets. Its methodology differs from Ghost's. — [MEXC News summary](https://www.mexc.com/news/335217)
- Cryptohopper reviewers say costs add up fast once users stack signals, marketplace strategies and higher tiers. — [Bitget Academy](https://www.bitget.cloud/academy/cryptohopper-review)
- Scale of Telegram/onchain bot usage: about $60M daily volume and about 50K active users (Dune, mid-2025), and $80B+ lifetime volume with 6M+ users. These are vendor-cited figures. — [Turnkey](https://www.turnkey.com/blog/designing-telegram-trading-bots-patterns-primitives-and-security)

### Inferences
- For a memecoin trader, the true cost per trade is the bot fee (0.5–1%) plus priority fee and tip plus slippage and sandwich loss. That can easily exceed 2–3% per round trip, which wipes out the edge of most copy and sniping strategies. This is inferred from the fee and MEV data above, not measured directly.

### Gaps
- I found no independent revenue figures for the Telegram bots, and no per-user analysis of total cost of execution.

---

## 7. Mitigations adopted (non-custodial designs, MPC/TEE wallets, session keys, permission scoping) and user reactions

### Takeaway
After incidents, bots added 2FA, transfer delays and paused routers, and paid refunds. Infrastructure vendors now push TEE/policy-engine wallets and scoped session permissions as the non-custodial alternative. User reaction tracks compensation: refunds kept users (BANANA rose 7%), while denial led to FBI probes and class-action organising (3Commas) or shutdown (Solareum).

### Cited Findings
- Banana Gun added 2FA and a transfer delay after Sept 2024 and refunded in full from treasury. The token rose about 7%. — [CoinGape](https://coingape.com/banana-price-jumps-7-as-banana-gun-issues-full-refund-to-hack-victims); [Coinscan](https://coinscan.com/blog/banana-gun-recovers-from-usd3m-exploit-with-full-refunds-and-new-security)
- Unibot paused its new router. Maestro patched Router 2 and refunded 610 ETH. Revoking approvals was the user-side fix. — [Rekt](https://alpha.rekt.news/unibot-rekt); [Revoke.cash](https://revoke.cash/exploits/maestro)
- Axiom removed staff access to internal support tools after the insider allegation. — [The Block](https://www.theblock.co/post/391423/zachxbt-investigation-into-alleged-employee-insider-trading)
- Exchanges revoked all 3Commas-linked keys after Dec 2022. — [ForkLog / HAPI](https://forklog.com/en/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident/)
- Turnkey (vendor) describes the main patterns. Custodial or semi-custodial setups favour speed over security. TEE-based keys are never exposed to the bot, backend or operators. Session-based permissions give bots scoped authority. Policy engines enforce allowlists, spending limits and calldata limits at signing time rather than in bot logic, which a compromised bot could bypass. Named non-custodial Telegram terminals using this approach are Bullpen and RampMeDaddy. — [Turnkey](https://www.turnkey.com/blog/designing-telegram-trading-bots-patterns-primitives-and-security)
- User-side advice from security write-ups: keep small balances in bot wallets, separate hot and cold wallets, and treat any "connect wallet to verify" Telegram step as a red flag. — [OneKey](https://onekey.so/blog/es/learn/bot-wallets-drained-who-stole-your-binance-life/); [Security Alliance](https://radar.securityalliance.org/psa-fake-telegram-support-channels-drainers/)
- BonkBot's defence in 2024 was that victims had exported keys to third-party apps. Key export is a convenience feature that widens the attack surface. — [Decrypt](https://decrypt.co/224127/solana-wallets-drained-523k-bonkbot-denies-link)

### Inferences
- The industry is moving from "bot holds your key" towards "bot holds a scoped, revocable permission". Examples are TEE wallets with policy engines, session keys, and exchange OAuth in place of raw API secrets. This directly addresses the root causes of DEXX, Banana Gun and the 3Commas leak. Adoption is still a minority among the top Telegram bots, which remain custodial according to DEXTools.
- For any new automated or copy-trading product, the features most often requested after incidents are: non-custodial or scoped authority, enforced spend limits and allowlists, transfer delays and 2FA on withdrawals, verifiable onchain performance, and a credible compensation policy or treasury.

### Gaps
- I found no data on user churn after incidents, apart from token-price reactions and Solareum's shutdown.
- I could not verify whether Photon, BullX, GMGN, Axiom or Trojan use MPC or TEE wallet providers (for example Turnkey or Privy) in production. Vendor marketing claims exist, but I found no primary confirmation.
