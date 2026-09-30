# Kibble: feature research for a perpetual-futures AI pet

Research date: 2026-09-30. Scope: pet/companion mechanics, social and agent trading products, responsible design for leveraged retail products, and perp mechanics that could become pet mechanics. Primary sources (papers, regulators, exchange docs, product pages) are preferred. Where a figure comes from a secondary source it is marked **(secondary)**.

This does not repeat the sibling project's ideas: any stock, a nest of several pets, letting go, scheduled feeding days, forgiving streaks, a free daily care action, growth by consistency, no confetti, litters, and a Telegram bot.

---

## 0. Context that shapes every recommendation

**How Kibble is judged.** Bitget AI Base Camp S2, Track 2 "Agentic Trading". The handbook's judging focus is *"Paper trading Sharpe, max drawdown, win rate; decision explainability; Agent architecture quality; risk control layer effectiveness"*, scored **50% quantitative + 50% judges**. Fan Favorite is a separate public vote. The Open Theme text for the same track lists what judges want to see measured: *"decision consistency, risk-violation rate, max drawdown, stress behavior, human-takeover rate, and incremental value over fixed-rule or Human + AI baselines."* (handbook copy in scratchpad `hb_en.md`, lines 226–252). Features that produce those numbers serve two criteria at once.

**Bitget is also productizing agent strategies.** GetAgent Playbook (launched 2026-06-17) turns a strategy into a pre-structured script: market conditions, signals, trigger rules, risk settings, stop-loss and take-profit logic, and stop conditions, all reviewable before it runs, inside an isolated sub-account. Under it, "Agent Harness" coordinates AI reasoning, execution, risk controls, position sizing and anomaly checks, and *"Every action remains logged and auditable."* The handbook adds that high-quality entries may be invited into Playbook's product review. Kibble's personalities map closely onto Playbook cards.
- https://www.bitget.com/blog/articles/bitget-getagent-playbook-ai-trading-workflows
- https://www.bitget.com/academy/how-bitget-getagent-playbook-manages-risk-and-protects-funds-2026-guide

**Bitget stock-perp facts Kibble has to live with** (all from Bitget pages):
- 24/7 trading on stock futures (NVDA, TSLA, AAPL, RDDT and others) since **2026-02-07**. Under 24/7 trading *"the mark price will be limited to index price ± 3%. The index price will be based on traditional market prices."* https://www.bitget.com/support/articles/12560603849504
- Outside US trading hours the mark price is **EMA-smoothed**. Funding is every 8h on most stock perps (some 4h), capped at **0.5%** per interval. Bitget's own guide warns that one-sided funding of 0.1–0.5% can *"erode 10–30% or more of your principal"* in a month. https://www.bitget.com/academy/how-to-trade-stock-perpetual-contracts-on-bitget-futures-2026-guide ; https://www.bitget.com/support/articles/12560603847519 ; https://www.bitget.com/en-CA/support/articles/12560603894212
- **Pre-IPO perps use a modeled index.** OPENAIUSDT launched 2026-05-28 (max **20x**, 8h funding). SPCXUSDT launched 2026-05-21 with max **5x**, was repriced on the prospectus share count on 2026-06-09, and *"will automatically convert to standard perpetual futures"* after the IPO. SpaceX listed on Nasdaq on **2026-06-12**. On BitMEX the equivalent conversion changed initial margin from 20% (5x) to 5% (20x), switched the mark method, and brought *"significant price volatility"* at conversion.
  - https://www.bitget.com/blog/articles/bitget-openai-ipo-perpetual-contract-openaiusdt
  - https://www.bitget.com/asia/blog/articles/bitget-spacex-ipo-perpetual-contract-spcxusdt
  - https://www.bitget.com/support/articles/12560603885389
  - https://www.bitget.com/support/articles/12560603887172
  - https://www.cnbc.com/2026/06/12/spacex-ipo-spcx-live-updates.html
  - https://www.bitmex.com/blog/spcxusdt-conversion
  - **Check this now:** "Degen 8x" is above SPCX's pre-IPO cap of 5x. Personality leverage caps must be clamped to each contract's live maximum leverage.
- **ADL:** Bitget ranks auto-deleveraging counterparties by leverage × unrealized ROI, shows a **5-light ADL indicator** on the trading page, and exposes `GET /api/v2/mix/position/adlRank`. https://www.bitgetapp.com/support/articles/12560603800805 ; https://www.bitget.com/api-doc/contract/position/Get-Position-Adl
- **Crowd data endpoints:** `/api/v2/mix/market/long-short` (account ratio), `/position-long-short` (top-trader position ratio), `/open-interest`, `/taker-buy-sell`. https://www.bitget.com/api-doc/classic/common/apidata/Long-Short ; https://github.com/tiagosiebler/bitget-api/blob/master/docs/endpointFunctionList.md
- **Orders:** TP/SL can trigger on last, mark or index price. Trailing stops are supported (`trailing_stop`, activation price, ratio 0.1–10% for futures). https://www.bitget.com/support/articles/12560603817159 ; https://www.bitget.com/api-doc/uta/strategy/Place-Strategy-Order
- **Official Bitget MCP / Agent Hub** has a `--paper-trading` (Demo) mode. https://github.com/Bitget-AI/agent-mcp ; https://www.bitget.com/activity-hub/agent-hub

**A competitor exists in the same hackathon.** "GapBrief" (built for Bitget AI Base Camp S2) turns five years of weekend gap history into a Monday-open stress brief for rToken holders. Kibble should make weekend risk an *acting* risk rule, not another brief. https://github.com/Pizzylee001/gapbrief (seen via a mirror)

---

## 1. Virtual pets and companions: what works, what backfires

### 1.1 What works

| Product | Mechanic | Evidence | Kibble translation |
|---|---|---|---|
| **Duolingo** | Streak Freeze; leagues; Friend Streak | Letting learners equip up to two Freezes *"increased the relative number of active learners on Duolingo every day by +0.38%"*. Learners who reach a 7-day streak are 3.6x more likely to finish their course. Streak animations raised D7 retention by +1.7% ([Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)). Leagues raised learning time 17% and tripled highly engaged learners ([ex-CPO Jorge Mazal, Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)). Friend Streak users are 22% more likely to finish the daily lesson; this is correlational ([Duolingo blog](https://blog.duolingo.com/product-lessons-friend-streak/)). | Streaks are already covered by the sibling project. The new lesson is that **shared (co-op) commitments** add engagement on top of solo streaks. Leagues should rank *care quality*, not returns (see §3). |
| **Pokémon GO Buddy Adventure** | Affection hearts from a menu of daily activities. A visible mood that goes from poor to "Excited" and doubles hearts. Levels (Good, Great, Ultra, Best) unlock the buddy *doing things for you*: it finds items, points out places, brings souvenirs, and at Best Buddy gets a CP boost. Swapping buddies no longer resets candy progress. | [pokemongo.com](https://pokemongo.com/post/buddyadventurelaunch) ; [Niantic help](https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2155-buddy-adventure/) | Bond levels should unlock **capabilities the pet uses for the owner**: better briefings, event warnings, a weekend dream report. They should not unlock more leverage. Switching the active pet should cost nothing. |
| **Aavegotchi** | Kinship: starts at 50, +1 max per 12h interaction, −1 after 24h of neglect. Nine named tiers from "Scorned" to "Inseparable". Kinship multiplies daily Alchemica channeling, and channeling *burns* 2 kinship. The pet's body is **yield-bearing collateral** (Aave aTokens, "Spirit Force"). Withdrawing all of it sends the gotchi back to the "Nether realm" and burns the NFT. | [Kinship wiki](https://wiki.aavegotchi.com/en/kinship) ; [Spirit Force](https://wiki.aavegotchi.com/en/spirit-force) ; [FAQ](https://hackmd.io/@aavegotchi/faq) | The closest precedent for "the pet *is* the margin". Named bond tiers beat raw numbers. Channeling that costs bond is a good pattern: a powerful action should spend bond. |
| **Finch** | Completing goals gives the bird energy for an adventure. The bird comes back *"with a story to share"*. There is no penalty system. | [finchcare.com](https://finchcare.com/about-finch) ; [Pratt design critique](https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/) | The diary should read like **the pet coming back from an adventure with a story** (a bedtime story), not a trade log. |
| **Tamagotchi (Connection, m!x, Uni)** | Marriage produces a next generation. From m!x onward, children inherit face, hair, body and accessory genes from parents and grandparents, and traits can skip generations. | [Generation](https://tamagotchi.fandom.com/wiki/Generation) ; [m!x](https://tamagotchi.fandom.com/wiki/Tamagotchi_m!x) | **Lineage.** A retired pet's learned lessons (reflection memory) pass to the next egg (§5, idea 17). |
| **Habitica** | Boss quests: party members damage the boss by doing their dailies, and *everyone* takes damage when anyone misses theirs. | [Party wiki](https://habitica.fandom.com/wiki/Party) ; [Quests](https://habitica.fandom.com/wiki/Quests) | Co-op accountability works, but see the backfire below. Use co-op for *risk discipline*: a "raid" whose success condition is that nobody breaks their pet's rules. |
| **Neopets** | Pets can never die. "Dying" and "Starving" are only status text. Neglect has soft consequences: a pet can't battle and gets more negative random events. | [Hunger wiki](https://neopets.fandom.com/wiki/Hunger) ; [Kotaku](https://kotaku.com/your-old-neopets-may-still-be-alive-and-very-hungry-1842243197) | Kibble's reversible "faint" is the right choice. Keep it reversible and never make loss permanent. |
| **Pudgy Penguins (Pudgy Party)** | A mainstream party game with the crypto layer optional ("designed for both Web2 and Web3 audiences"). It passed 500k downloads in two weeks. | [License Global](https://www.licenseglobal.com/web-3-0/pudgy-penguins-launches-pudgy-party-mobile-game-with-mythical-games) ; [Decrypt](https://decrypt.co/337273/pudgy-penguins-game-pudgy-party-launches-on-ios-and-android) | Fan Favorite voters are mostly non-traders. The spectator path should need no wallet and no exchange knowledge. |

### 1.2 What backfires

- **Permanent death and guilt.** Tamagotchi deaths caused real grief responses in children, including funeral rituals and memorial sites ([Wellcome Collection](https://wellcomecollection.org/stories/digital-pets) ; [narrative review, ScienceDirect 2025](https://www.sciencedirect.com/science/article/pii/S1875952125000382)). In money products, distress from alarming numbers is a documented harm: Robinhood showed a 20-year-old a −$730k balance without context before his suicide, and afterwards changed how buying power is displayed and added live support ([CNN](https://www.cnn.com/2021/07/01/business/robinhood-lawsuit-suicide-settlement)). *Rule: a faint is always reversible, always explained, and always shows the real (paper) loss next to the pet's state.*
- **Shared punishment.** Habitica players can be killed by *another member's* missed dailies, and players complained that *"missed dailies do massive amounts of damage"* ([GitHub issue #3161](https://github.com/HabitRPG/habitica/issues/3161)). Habitica added "Rest in the Inn" to pause damage ([wiki](https://habitica.fandom.com/wiki/Rest_in_the_Inn)). *Rule: co-op should reward, not punish.*
- **Chores get automated.** Aavegotchi's 12h petting became a task people delegate to third-party "petting" services such as Orium's ([docs](https://docs.orium.network/user-guides/aavegotchi-petting)). If a care action has no decision in it, people bot it or resent it. *Rule: every care action should carry a real choice. The "whisper" (idea 6) is a choice; a "pet" button is not.*
- **Financialized pets collapse.** Axie's SLP fell about 99% from its peak, and scholarship earnings collapsed with it (Axie cut emissions to "prevent collapse") ([CoinDesk](https://www.coindesk.com/tech/2022/02/08/axie-infinity-reduces-slp-emissions-to-prevent-collapse) ; [BusinessWorld](https://www.bworldonline.com/technology/2023/04/26/519228/stung-by-losses-filipino-players-ditch-axie-infinity-crypto-game/)). *Rule: no token and no paid eggs. Paper money only is a strength here.*
- **Loot-box eggs.** Loot-box spending is linked to problem-gambling severity (7,422 gamers, η² = 0.054) ([Zendle & Cairns 2018, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0206767)). Free hatching is fine. Paid rerolls for rare species are not.

---

## 2. Social trading and agent products: what makes agents legible and trustworthy

### 2.1 Agent-as-character precedents

- **nof1 Alpha Arena** is the closest public analog: LLMs trading perps with real money in public. Season 1 (Oct–Nov 2025) gave six models $10k each on Hyperliquid. A published "Model Chat" showed every decision. Each action had to include *"a short justification, confidence score in [0, 1], and an exit plan with pre-defined profit targets, stop losses, and invalidation conditions (pre-registering specific signals that void a plan). These fields, introduced during prompt engineering, were found to improve performance."* ([nof1 blog](https://nof1.ai/blog/TechPost1)). Season 1.5 (2025-11-20 to 2025-12-03) traded **US equity perps** and ran four modes: Baseline, **Monk Mode** (capital preservation), **Situational Awareness** (models see rivals' PnL) and **Max Leverage** ([nof1.ai](https://nof1.ai/) ; [KuCoin news (secondary)](https://www.kucoin.com/news/flash/alpha-arena-1-5-season-adds-kimi-2-model-live-trading-of-us-stock-tokens-on-hyperliquid)).
  - Critics showed that a random strategy at similar leverage and turnover matched the best model's PnL about 10% of the time ([Magnus Ross](https://magnusross.github.io/posts/nof1-analysis/)).
  - *Lessons for Kibble:* (1) pre-registered exit plans and invalidations are a known, cheap performance and explainability win; (2) public reasoning drives spectator interest; (3) a **baseline twin** is needed to show the LLM adds value.
- **LiveTradeBench** (50 days live, 21 LLMs): general benchmark scores (LMArena) show *"negligible or negative correlation"* with trading returns, and models show distinct, stable "portfolio styles". ([arXiv 2511.03628](https://arxiv.org/abs/2511.03628)). This supports making each personality a real, measurable style.
- **TradingAgents** (UCLA/MIT/Tauric): analyst agents, then a **bull vs bear researcher debate**, then a trader, then a **risk-management team** (aggressive, neutral and conservative voices) with final approval. It reports better cumulative return, Sharpe and max drawdown than baselines. ([arXiv 2412.20138](https://arxiv.org/abs/2412.20138)). This is a ready-made "inner council" for the pet.
- **FinMem**: "character design" with risk-seeking, risk-averse and **self-adaptive** profiles, plus layered memory. The self-adaptive profile, which switches to risk-averse after short-term cumulative losses, was the only configuration with positive returns and Sharpe above 2.0 in their test. ([arXiv 2311.13743](https://arxiv.org/abs/2311.13743)). This supports personality as a risk profile, and a mood that shifts risk *down* after losses.
- **ai16z / "Marc AIndreessen"** ran a "marketplace of trust": community trade tips were simulated and each tipper got a trust score (0–1) based on how the tips would have performed, which then weighted future tips ([The Block](https://www.theblock.co/post/323192/marc-andreesen-shoutouts-help-ai-powered-vc-fund-ai16z-to-nearly-100-million-market-cap) ; [ai16z roadmap](https://ai16z.ai/roadmap)). This is a template for fan participation that doesn't turn into herd trading.
- **Truth Terminal / Virtuals.** Persona-driven agents draw huge attention. Truth Terminal was a fine-tuned Llama persona whose memecoin association reached about $1B ([CoinDesk](https://www.coindesk.com/tech/2024/12/10/the-truth-terminal-ai-crypto-s-weird-future) ; [TechCrunch](https://techcrunch.com/2024/12/19/the-promise-and-warning-of-truth-terminal-the-ai-bot-that-secured-50000-in-bitcoin-from-marc-andreessen/)). Virtuals tokenizes agents on bonding curves ([Virtuals Genesis FAQ](https://whitepaper.virtuals.io/about-virtuals/tokenization-platform/genesis-launch/genesis-points-faq)). *Take the persona and voice. Leave the token.*

### 2.2 Social and copy-trading precedents: legibility features

- **Bitget copy trading** shows ROI, PnL, copiers' PnL, AUM, win rate, trade frequency, last-trade time and profit-share ratio (0–10%, high-water mark). It uses **time-weighted return (TWR)** so deposits don't inflate performance, and hides open positions from non-copiers behind a 1-hour delay. Bitget-assigned tags such as "[Secure]" require things like *"maintaining a drawdown under 1% over three weeks"*. Copiers get stop-loss and take-profit ratios and a maximum copy amount.
  - https://www.bitgetapp.com/support/articles/12560603847588
  - https://www.bitget.com/academy/key-spot-copy-trading-metrics
  - https://www.bitget.com/support/articles/12560603826748
- **eToro**: a 1–10 **risk score** from portfolio volatility. Popular Investors must keep a risk score **≤ 6** to be copied and are blocked from new copiers at 8 or above. https://help.etoro.com/en-us/s/article/risk-score-explained-US ; https://www.etoro.com/news-and-analysis/etoro-updates/important-update-regarding-popular-investor-program/
  - *This is the best-known precedent for **eligibility gates** on a public board.*
- **Hyperliquid vaults**: the leader must keep ≥ 5% of the vault (skin in the game) and takes a 10% profit share. https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-leaders-legacy
- **Polymarket**: the comments API includes each commenter's **position**, so you can see who has skin in the game. https://docs.polymarket.com/api-reference/comments/list-comments

### 2.3 What the research says about trust, explanations and track records

- **Showing others' success raises risk-taking.** In a controlled experiment, information about others' success significantly increased risk-taking, and the ability to copy increased it further, to *"excessive risk taking"* ([Apesteguia, Oechssler & Weidenholzer 2020, Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.2019.3508)).
- **Having an audience worsens the disposition effect.** On 354,817 eToro traders, signal providers held losers longer than others, attributed to fear of losing followers ([Pelster & Hofmann 2018, JBF](https://www.sciencedirect.com/science/article/abs/pii/S0378426618301468)). A public pet with fans has the same pressure. Stops must be pre-registered and enforced by the gate, not left to the LLM's in-the-moment judgment.
- **Tournaments make losers gamble.** Mid-year losing fund managers raised volatility more than winners ([Brown, Harlow & Starks 1996, JF](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.1996.tb05203.x)). 24h "best % move" duels invite this.
- **Explanations alone can mislead.** AI explanations raised acceptance of recommendations whether or not they were right, and did not reliably improve human+AI team performance ([Bansal et al., CHI 2021](https://dl.acm.org/doi/10.1145/3411764.3445717)). **Confidence scores** did help calibrate trust, while local explanations did not ([Zhang, Liao & Bellamy, FAT* 2020](https://arxiv.org/abs/2001.02114)). *So pair the diary with calibrated confidence and a scored track record.*
- **Algorithm aversion eases with a little control.** People use an imperfect algorithm far more often when they can **modify it even slightly** ([Dietvorst, Simmons & Massey 2018, Management Science](https://faculty.wharton.upenn.edu/wp-content/uploads/2016/08/Dietvorst-Simmons-Massey-2018.pdf)). This supports a bounded "whisper" or nudge.
- **Backtests are not track records.** Across 888 Quantopian strategies, backtest Sharpe barely predicted out-of-sample Sharpe (R² < 0.025), while volatility, max drawdown and hedging features did predict it, and more backtesting meant a bigger gap ([Wiecki et al. 2016](https://joi.pm-research.com/content/25/3/69)). The handbook's own Track 1 alert is *"OS < 0.5×IS"*. *So show live paper performance separately, with a "live since" date, and lead with drawdown and volatility.*

---

## 3. Responsible design for leveraged retail products

### 3.1 What regulators criticized, with numbers

- **FCA experiment (9,000+ people, 2024).** Push notifications and points plus prize draws raised trade counts by **11%** and **12%**, and the share of trades in the riskiest assets by **8%** and **6%**. A trader leaderboard did not raise trade count but raised shares traded by 6%. Low-literacy users traded more with flashing prices and leaderboards, and 18–34-year-olds took on more end-of-period risk with most of these features. ([Research note PDF](https://www.fca.org.uk/publication/research-notes/research-note-digital-engagement-practices-trading-apps-experiment.pdf) ; [press release](https://www.fca.org.uk/news/press-releases/fca-keeps-trading-apps-under-review-over-gaming-concerns))
- **FCA real-account data (OP66, 2025).** On high-DEP apps, 16% of investors averaged 10 or more trades a month, against 1.2% on low-DEP apps. ([OP66](https://www.fca.org.uk/publication/occasional-papers/op66-digital-engagement-practices-investment-outcomes.pdf)) The FCA's 2022 review flagged leaderboards of top-moving stocks and **default high leverage** ([FCA 2022](https://www.fca.org.uk/publications/research-articles/gaming-trading-how-trading-apps-could-be-engaging-consumers-worse)).
- **OSC 2022 (RCT, 2,430 people).** Points for trading led to **39% more trades**, and top-traded lists made people 14% more likely to trade ([OSC 2022](https://www.osc.ca/sites/default/files/2022-11/sn_20221117_11-796_gamification-report.pdf)).
- **OSC 2024.** A social feed and copy trading raised trading in "promoted" stocks by **12% and 18%**. A returns leaderboard *reduced* trades by 14% in their setup. The OSC recommends limiting points, top-traded lists, social feeds and copy trading ([OSC 2024](https://www.osc.ca/en/investors/gamification-revisited-new-experimental-findings-retail-investing)).
- **Randomized gamification study.** Hedonic gamification (confetti, badges) raised volume by 5.17%, mostly through self-selection of lower-literacy users. Price-trend notifications reinforced mistakes for people with wrong beliefs ([Chapkovski, Khapko & Zoican, Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.2022.02650)).
- **Robinhood.** Herding on the stocks Robinhood users bought most was followed by five-day abnormal returns of **−3% (−6% for extreme herding)** ([Barber, Huang, Odean & Schwarz 2022, JF](https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.13183)). Robinhood settled with Massachusetts in January 2024 for $7.5M and agreed to stop celebratory imagery tied to trading frequency, push notifications about specific lists, and game-of-chance features ([MA consent order](https://www.sec.state.ma.us/divisions/securities/download/RH-Consent-Order.pdf)).

### 3.2 Controls that demonstrably work, or that regulators require

- **Leverage caps work.** ESMA's 2018 CFD measures set leverage limits from 30:1 down to **5:1 for single equities** and 2:1 for crypto, plus a **margin close-out at 50%** of required margin, negative balance protection, a standard risk warning, and a ban on incentives ([ESMA press release](https://www.esma.europa.eu/sites/default/files/library/esma71-98-128_press_release_product_intervention.pdf)). Australia's equivalent order led to a **91% reduction** in retail net losses (from $372M to $33M a quarter), 88% fewer negative balances and 51% fewer loss-making accounts ([ASIC 22-082MR](https://www.asic.gov.au/about-asic/news-centre/find-a-media-release/2022-releases/22-082mr-asic-s-cfd-product-intervention-order-extended-for-five-years/)).
- **Perps are now explicitly in scope in the EU.** ESMA's statement of **24 February 2026** says derivatives *"marketed as perpetual futures"* are *"likely to fall within the scope"* of the CFD measures (leverage limits, risk warning, margin close-out, negative balance protection, incentive ban). It adds that a funding-rate mechanism or an insurance fund does not change that, and that pop-ups telling users to "get started now" conflict with a narrow target market. ([ESMA statement](https://www.esma.europa.eu/sites/default/files/2026-02/ESMA35-243228190-8024_-_Public_statement_on_derivatives_in_scope_of_the_CFD_product_intervention_measures.pdf)) *An opt-in "EU rules" mode is a cheap, very defensible feature.*
- **Cooling-off.** The FCA requires a **24-hour cooling-off** before a first-time retail investor sees a high-risk investment offer, plus personalised risk warnings and a ban on refer-a-friend or joining bonuses ([FCA PS22/10](https://www.fca.org.uk/publication/policy/ps22-10.pdf)).
- **Limits and feedback.** Voluntary limit-setting and personalised feedback reduce gambling losses and time. A plain pop-up after 1,000 spins made fewer than 1% stop, but an enhanced pop-up with normative feedback and a limit prompt more than doubled stopping ([Auer & Griffiths, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5897477/) ; [Frontiers 2015](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.01406/full)).
- **Honest session display.** The UK Gambling Commission's 2021 slots rules ban **"losses disguised as wins"** (celebrating a return at or below the stake), ban autoplay, and require a constant display of **net position and elapsed time** ([Bird & Bird summary](https://www.twobirds.com/en/news/articles/2021/uk/gambling-regulation-update-commission-announces-new-measures)).
- **Prior outcomes change risk appetite.** After gains people become risk-seeking (house-money effect), and after losses they are drawn to bets that could get them back to even (break-even effect) ([Thaler & Johnson 1990, Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.36.6.643)). *So: no automatic "feed more to revive" doubling after a faint, and no leverage bump when the pet is Ecstatic.*

---

## 4. Perp mechanics as pet mechanics

| Perp mechanic | Evidence / data source | Pet mechanic |
|---|---|---|
| **Funding (8h, cap 0.5%)** | Bitget stock-perp guide. Funding rate endpoints are in the official MCP. | Already "hunger". *Add* a **funding forecast** ("staying fed costs about $0.42 a day at current funding") and a "Queasy" mood when funding runs against the position for more than N intervals. The risk gate uses cumulative funding cost against the thesis. |
| **Mark price clamped to index ±3%, EMA off-hours** | Bitget 24/7 announcement and TradFi overview | "**Pajamas**" is a real state: overnight, the pet's weight (mark) moves slowly (EMA) and is clamped. The **Monday wake-up jolt** is when the clamp meets the reopening index. Explain this in the diary. |
| **Weekend price discovery** | The perp captures most of the Monday gap: **Allium** found Friday close misses Monday open by 113 bps median and the Sunday perp by about 80 bps ([report](https://www.allium.so/reports/when-wall-street-sleeps)). **Crypto.com Research** found NVDA perps called the Monday gap direction 78.9% of the time at Sunday 22:00 UTC (only 57.9% on Saturday), found that *shorting tech on weekend fear lost money* because of Monday mean-reversion, and proposes a "Sleep Well Leverage Limit" ([report](https://crypto.com/en/research/rwa-perps-find-predictive-edge-apr-2026)). **Binance Research**: 92% median gap capture over 7 weekends ([Finance Magnates](https://www.financemagnates.com/thought-leadership/the-convergence-trade-nobody-planned-on-chain-fridays-to-nyse-mondays/)). | "**Weekend Dreams**": the pet dreams the Monday open. It shows the perp-implied gap against its historical weekend-gap distribution and applies a sleep-well leverage cap. Saturday moves count as noise, and the pet may not *open* shorts on weekend fear. |
| **Liquidation, maintenance margin, ADL** | Bitget liquidation and ADL docs, `adlRank` API. **2025-10-10**: about $19B liquidated, ADL fired across venues, and Hyperliquid did $9.3B of liquidations ([CoinDesk research](https://www.coindesk.com/research/market-spotlight-the-19-billion-liquidation-that-shook-crypto) ; [CoinGecko](https://www.coingecko.com/learn/october-10-crypto-crash-explained)). | "**Danger sense**": distance to faint, in units of recent daily volatility ("3.1 stormy days from fainting"). Bitget's 5-light ADL indicator appears as the pet's tail lights. The gate trims when distance falls below the personality's minimum. |
| **Open interest, long/short ratio, top-trader ratio** | Bitget market-data endpoints | "**Herd ears**": the pet senses crowding. It is an input to the LLM and a *warning* ("everyone's long NVDA; I'm keeping my buffer wide"), never a hot list. |
| **Earnings / FOMC / CPI** | Handbook sub-themes: Event-Driven and Earnings-Driven. Bitget warns of earnings volatility. NVDA reported on 2026-08-26 and moved about +4% after hours ([CNBC](https://www.cnbc.com/2026/08/26/nvidia-nvda-earnings-report-q2-2027-live-updates.html)). | "**Molting season**": before a known event the pet sheds leverage down to an event-safe size, then writes a post-event story. |
| **Pre-IPO modeled index → IPO conversion** | Bitget SPCX/OPENAI specs; BitMEX conversion notes | "**Chrysalis**": the OPENAI pet lives on a synthetic index (a "dream price") until the IPO, when it metamorphoses. The gate de-risks into the conversion and re-reads the new max leverage. SPCX's June 2026 conversion is a replayable real example. |
| **TP/SL trigger on mark vs last; trailing stops** | Bitget TP/SL guide and strategy-order API | Promises (idea 1) are placed as *real* exchange-side TP/SL orders triggered on **mark** (to avoid wick-outs). A trailing "leash" follows the price up. |
| **Volatility regime** | Volatility-managed portfolios raise Sharpe ([Moreira & Muir 2017, JF](https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.12513)). Vol targeting improves Sharpe for equities and reduces left-tail events across assets ([Harvey et al. 2018, JPM](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf)). | "**Storm sense**": the pet hunkers down, with size scaled inversely to realized volatility. This directly targets the Sharpe and max-drawdown half of the score. |
| **Hedging** | Hedging features predicted out-of-sample performance in the Quantopian cohort (Wiecki). Bitget lists QQQUSDT. | "**Shadow buddy**" (optional): a nervous pet can call a small QQQ short to cut market beta. This is a Cross-Asset Execution sub-theme fit. |

---

## 5. Feature catalog (ranked for Kibble)

Build size: **S** ≈ under 1 day, **M** ≈ 1–3 days, **L** ≈ over 3 days, for the existing Next.js, Postgres and 15-minute worker stack. Criteria: **Q** = quantitative (Sharpe, max drawdown, win rate), **E** = explainability, **A** = agent architecture, **R** = risk-control effectiveness, **F** = Fan Favorite / engagement.

### A. Explainability and architecture (judge half)

1. **Pinky Promises (pre-registered exit plans) + promise-keeping score.** Every open or add must state a thesis, a confidence from 0 to 1, a take-profit, a stop and an **invalidation condition** in plain words plus a machine-checkable rule (for example "NVDA 4h close < 171"). The TP and stop are placed as exchange-side orders on mark price. The diary later grades each promise: kept, broken, or voided with a reason. The public stat is "promises kept 18/20".
   Evidence: Alpha Arena's fields *"were found to improve performance"*; audience-driven disposition effect (Pelster & Hofmann); Playbook's "stop conditions defined before activation". **M. E, R, Q.**
2. **Gut-check meter (confidence calibration).** Log every stated confidence and its outcome, and show a per-pet reliability chart and Brier score ("when Nova says 70%, it's right 64% of the time"). Low calibration shrinks the pet's allowed size.
   Evidence: confidence calibrates trust where explanations don't (Zhang et al. 2020); explanations alone cause over-reliance (Bansal et al. 2021). **S. E, A.**
3. **Inner Council (bull, bear and Guardian voices).** Run two short LLM passes (bull case, bear case), then the decision, then the deterministic gate as a third character ("Guardian"). Render the debate as the pet's thought bubbles, and have the diary say who won and why.
   Evidence: TradingAgents' bull/bear debate plus risk team improved Sharpe and max drawdown; FinMem character design. **M. A, E, F.**
4. **Guardian's ledger (counterfactual value of the risk gate).** Every vetoed or clipped LLM action becomes a *shadow trade* followed to its natural exit. Show "the Guardian blocked 14 actions: saved $312, cost $41", a risk-violation rate (should be 0 executed), and the list of rules that fired.
   Evidence: this is the handbook's Open-Theme metric list (risk-violation rate, stress behavior); Bitget Agent Harness "every action logged and auditable". *This turns "risk-control effectiveness" into a number.* **M. R, E, A.**
5. **Ghost twin (fixed-rule baseline) + flight recorder.** Each pet has a sim twin running a fixed rule with the same leverage, for example buy-and-hold with the same funding, or a 20/50 EMA rule. The card shows "LLM value added vs twin". Every tick is stored as a hash-chained record (inputs, LLM JSON, gate verdict, order id), and a time-scrubber shows what the pet knew at time t. A "live since" badge separates live paper results from any backtest.
   Evidence: handbook asks for *"incremental value over fixed-rule … baselines"*; Alpha Arena's random-baseline critique; Wiecki (backtest ≠ live). **M. A, E, Q.**
6. **Whisper (one bounded owner nudge a day).** The owner picks one of a few nudges ("be careful today", "skip the earnings", "take some profit"). The LLM must address it in the diary ("I heard you; I trimmed 25%" or "I didn't, because…"), and the gate still rules. Log a "human-takeover rate".
   Evidence: people accept imperfect algorithms when they can slightly modify them (Dietvorst 2018); the handbook metric "human-takeover rate". It also gives the daily care action a real decision (lesson from Aavegotchi auto-petting). **S. F, E.**

### B. Perp-native risk mechanics that also lift Sharpe and cut drawdown (quant half)

7. **Storm sense (volatility-targeted sizing).** Size equals target vol divided by realized vol, capped by the personality. Mood "Hunkered" with rain visuals. The diary says "NVDA's 5-day vol doubled, so I halved my size."
   Evidence: Moreira & Muir 2017; Harvey et al. 2018 (higher Sharpe, fewer left-tail events). **S. Q, R, E.**
8. **Molting season (event de-risking).** Using a calendar of earnings for the pet's ticker plus FOMC and CPI, the gate caps leverage before the event so that about 2× the ticker's typical event move can't cause a faint. A post-event story follows. This fits the handbook's Event-Driven and Earnings-Driven sub-themes.
   Evidence: Bitget earnings-volatility warnings; leverage caps cut losses 91% (ASIC); vol-targeting literature. **M. R, Q, E.**
9. **Weekend Dreams (Monday-gap sense + sleep-well leverage).** From Friday close to Monday open, the pet shows the perp-implied gap against a stored weekend-gap distribution (Bitget's MCP `equity_price_historical` or daily candles). It caps leverage so a 99th-percentile gap can't cause a faint, down-weights Saturday moves, and forbids *opening* tech shorts on weekend fear. This differs from GapBrief because Kibble acts on it.
   Evidence: Allium, Crypto.com Research and Binance Research (§4); Bitget off-hours EMA mark. **M. R, Q, E.**
10. **Danger sense (faint distance in σ + ADL tail lights).** Show liquidation distance as "stormy days until faint" and mirror Bitget's 5-light ADL rank. The gate trims below a minimum distance, and all stops trigger on mark.
    Evidence: Bitget liquidation, ADL and TP/SL docs; the 10/10/2025 cascade. **S. R, E.**
11. **Herd ears (crowding sense).** Open interest change, long/short account ratio and top-trader ratio are LLM inputs and a visible gauge. They act as a caution signal only.
    Evidence: Bitget endpoints; herding precedes −3% to −6% abnormal returns (Barber et al.); the handbook's "FOMO detection → reduce before overheating". **S. A, E, Q.**
12. **Chrysalis + contract-spec clamp.** The gate reads each contract's live max leverage (SPCX pre-IPO 5x, OPENAI 20x) and clamps every personality to it. OPENAI's pet has a "chrysalis" state and a de-risk rule into IPO conversion. SPCX's June 2026 conversion is replayed as a story.
    Evidence: Bitget pre-IPO specs; BitMEX conversion notes. **S. R, F.**

### C. Defensible design (risk-control credibility)

13. **Vet-approved diet (EU/ASIC mode) + cooling-off.** An opt-in mode clamps single stocks to **5:1**, closes out at **50%** of required margin, and shows the standard risk warning in the pet's voice. Raising risk (a more aggressive personality, higher leverage) takes a **24h cooling-off**, while lowering it is instant. After a faint the pet revives with a smaller position and a cooldown, never an automatic double-down.
    Evidence: ESMA 2018 and the ESMA **Feb 2026 perps statement**; ASIC −91% losses; FCA 24h cooling-off; Thaler & Johnson break-even effect. **S. R.**
14. **Honest bowl + bedtime-story digest.** The pet screen always shows today's *net* result after funding and fees, and time spent watching. It never celebrates a trade that is net negative after costs. Alerts are sent only for risk events (faint risk, funding spike, promise broken). Price moves never trigger alerts. One end-of-day "the pet comes home with a story".
    Evidence: UKGC net-position display and "losses disguised as wins" ban; FCA push notifications +11% trades and +8% risky trades; Finch's story return. **S. R, F.**

### D. Social / Fan Favorite

15. **Fair duels and a fair board.** Score duels on risk-adjusted return (return ÷ realized vol, or Sortino) or run them leverage-matched. Leverage is locked for the duration of a duel so a losing pet can't escalate. Board eligibility requires a pet risk score of 6 or below on a 1–10 scale (the eToro rule), and the board ranks by promise-keeping and risk-adjusted return.
    Evidence: Apesteguia et al. (visible success raises risk-taking); Brown, Harlow & Starks (losers gamble); eToro's ≤6 gate. **S. Q, R, F.**
16. **Fan snacks with trust scores.** Spectators (no account needed) can drop a headline or link into a pet's bowl. The pet reads it, sanitised against prompt injection, weights it by the tipper's **trust score** (how their past snacks would have performed), and can visibly *decline* it. When a snack influenced a decision the diary credits the tipper. Tips never execute directly and are shown with their accuracy record.
    Evidence: ai16z trust marketplace; OSC 2024 found social feeds and copy trading push people into promoted stocks (+12%, +18%), which is why tips are gated and weighted. **M. F, A.**
17. **Lineage (inherited instincts).** When a pet is retired or a season ends, its reflection memory (distilled lessons such as "twice fainted holding through earnings at 4x") passes to the next egg as "instincts" that appear in the new pet's prompt and on its card. A visible family tree.
    Evidence: Tamagotchi generations and genetics; FinMem layered memory. **M. A, F.**

### Suggested order for a deadline around Oct 5–6

Features that start paying off in the live paper log right away: 1 (Pinky Promises), 7 (Storm sense), 10 (Danger sense) and 12 (Chrysalis + spec clamp), then 4 (Guardian's ledger) and 5 (Ghost twin), which turn logged decisions into judge-ready numbers. Then 2 (Gut-check meter), 6 (Whisper), 13 (Vet mode), 14 (Honest bowl) and 15 (Fair duels), which are small. The larger ones are 3 (Inner Council), 8 (Molting season), 9 (Weekend Dreams), 11 (Herd ears), 16 (Fan snacks) and 17 (Lineage).

---

## 6. Ideas to avoid (and why)

| Avoid | Why |
|---|---|
| "Top movers" or "trending pets" hot lists | Top-traded lists: +14% likelihood of trading (OSC 2022). Robinhood herding preceded −3% to −6% returns (Barber et al.). Named in the Massachusetts consent order. |
| Points, XP, prizes or raffles for *trading activity* | +39% trades (OSC), +12% trades and +6% risky trades (FCA 2024). Incentives are banned under the ESMA CFD measures and FCA PS22/10. |
| Raw-%-return duels or leaderboards | Visible success raises risk-taking (Apesteguia et al.), and losers escalate risk (Brown, Harlow & Starks). Leaderboards raised trading among low-literacy users (FCA 2024). |
| Price-move push notifications | +11% trades and +8% risky trades (FCA 2024). ESMA warns against "get started now" pop-ups. |
| Permanent pet death or guilt copy | Tamagotchi grief evidence; Neopets and Finch avoid it deliberately; Robinhood/Kearns shows the harm of scary, context-free numbers. |
| "Feed more to revive" auto-doubling or martingale | Break-even effect (Thaler & Johnson). It escalates losses after a faint. |
| Leverage or bond boosts when the pet is Ecstatic | House-money effect. Moods should only ever *lower* risk. |
| Paid eggs, rarity rerolls, a pet token or NFT | Loot-box link to problem gambling (Zendle & Cairns). Axie's economy collapsed. Incentive bans apply. |
| Copying a pet's trades with real money | Copy trading raised trading in promoted stocks by +18% (OSC 2024). It would also move Kibble from paper demo into advice and distribution. |
| Celebrating trades that are net-negative after funding and fees | The UKGC "losses disguised as wins" ban. |
| Streak wagers or betting in-app currency on outcomes | Gambling-adjacent. The sibling's forgiving streaks already cover retention. |
| Unfiltered fan text going straight into the LLM prompt | Prompt injection. Snacks must be sanitised, weighted, and unable to trigger orders. |
| Letting any personality exceed a contract's live max leverage | SPCX pre-IPO was 5x, below Degen's 8x. Orders get rejected, or worse, the logic is wrong. |

---

## 7. Source list

**Pets and games**
- Duolingo streak: https://blog.duolingo.com/how-duolingo-streak-builds-habit/
- Duolingo growth (leagues, CURR): https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- Duolingo Friend Streak: https://blog.duolingo.com/product-lessons-friend-streak/
- Pokémon GO Buddy Adventure: https://pokemongo.com/post/buddyadventurelaunch
- Aavegotchi kinship: https://wiki.aavegotchi.com/en/kinship ; Spirit Force: https://wiki.aavegotchi.com/en/spirit-force ; FAQ: https://hackmd.io/@aavegotchi/faq
- Finch: https://finchcare.com/about-finch
- Habitica: https://habitica.fandom.com/wiki/Party ; https://github.com/HabitRPG/habitica/issues/3161
- Neopets: https://neopets.fandom.com/wiki/Hunger
- Tamagotchi: https://wellcomecollection.org/stories/digital-pets ; https://tamagotchi.fandom.com/wiki/Generation ; https://www.sciencedirect.com/science/article/pii/S1875952125000382
- Axie: https://www.coindesk.com/tech/2022/02/08/axie-infinity-reduces-slp-emissions-to-prevent-collapse
- Pudgy Party: https://www.licenseglobal.com/web-3-0/pudgy-penguins-launches-pudgy-party-mobile-game-with-mythical-games
- Loot boxes: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0206767

**Agents and social trading**
- nof1 Alpha Arena: https://nof1.ai/blog/TechPost1 ; https://nof1.ai/ ; critique: https://magnusross.github.io/posts/nof1-analysis/
- LiveTradeBench: https://arxiv.org/abs/2511.03628
- TradingAgents: https://arxiv.org/abs/2412.20138
- FinMem: https://arxiv.org/abs/2311.13743
- Bitget Playbook and Agent Harness: https://www.bitget.com/blog/articles/bitget-getagent-playbook-ai-trading-workflows ; https://www.bitget.com/academy/how-bitget-getagent-playbook-manages-risk-and-protects-funds-2026-guide
- Bitget Agent Hub and MCP: https://www.bitget.com/activity-hub/agent-hub ; https://github.com/Bitget-AI/agent-mcp
- Bitget copy trading: https://www.bitgetapp.com/support/articles/12560603847588 ; https://www.bitget.com/academy/key-spot-copy-trading-metrics ; https://www.bitget.com/support/articles/12560603826748
- eToro: https://help.etoro.com/en-us/s/article/risk-score-explained-US ; https://www.etoro.com/news-and-analysis/etoro-updates/important-update-regarding-popular-investor-program/
- Hyperliquid vaults: https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-leaders-legacy
- Polymarket comments API: https://docs.polymarket.com/api-reference/comments/list-comments
- ai16z: https://www.theblock.co/post/323192/marc-andreesen-shoutouts-help-ai-powered-vc-fund-ai16z-to-nearly-100-million-market-cap
- Truth Terminal: https://techcrunch.com/2024/12/19/the-promise-and-warning-of-truth-terminal-the-ai-bot-that-secured-50000-in-bitcoin-from-marc-andreessen/
- Virtuals: https://whitepaper.virtuals.io/about-virtuals/tokenization-platform/genesis-launch/genesis-points-faq

**Behavioral finance and human–AI trust**
- Apesteguia et al. 2020: https://pubsonline.informs.org/doi/10.1287/mnsc.2019.3508
- Pelster & Hofmann 2018: https://www.sciencedirect.com/science/article/abs/pii/S0378426618301468
- Brown, Harlow & Starks 1996: https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.1996.tb05203.x
- Barber et al. 2022: https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.13183
- Chapkovski et al.: https://pubsonline.informs.org/doi/10.1287/mnsc.2022.02650
- Dietvorst et al. 2018: https://faculty.wharton.upenn.edu/wp-content/uploads/2016/08/Dietvorst-Simmons-Massey-2018.pdf
- Zhang, Liao & Bellamy 2020: https://arxiv.org/abs/2001.02114
- Bansal et al. 2021: https://dl.acm.org/doi/10.1145/3411764.3445717
- Wiecki et al. 2016: https://joi.pm-research.com/content/25/3/69
- Thaler & Johnson 1990: https://pubsonline.informs.org/doi/10.1287/mnsc.36.6.643
- Moreira & Muir 2017: https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.12513
- Harvey et al. 2018: https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf

**Regulators and responsible gambling**
- FCA 2022: https://www.fca.org.uk/publications/research-articles/gaming-trading-how-trading-apps-could-be-engaging-consumers-worse
- FCA 2024 experiment: https://www.fca.org.uk/publication/research-notes/research-note-digital-engagement-practices-trading-apps-experiment.pdf
- FCA OP66: https://www.fca.org.uk/publication/occasional-papers/op66-digital-engagement-practices-investment-outcomes.pdf
- FCA PS22/10: https://www.fca.org.uk/publication/policy/ps22-10.pdf
- ESMA 2018: https://www.esma.europa.eu/sites/default/files/library/esma71-98-128_press_release_product_intervention.pdf
- ESMA Feb 2026 perps statement: https://www.esma.europa.eu/sites/default/files/2026-02/ESMA35-243228190-8024_-_Public_statement_on_derivatives_in_scope_of_the_CFD_product_intervention_measures.pdf
- ASIC: https://www.asic.gov.au/about-asic/news-centre/find-a-media-release/2022-releases/22-082mr-asic-s-cfd-product-intervention-order-extended-for-five-years/
- OSC 2022: https://www.osc.ca/sites/default/files/2022-11/sn_20221117_11-796_gamification-report.pdf
- OSC 2024: https://www.osc.ca/en/investors/gamification-revisited-new-experimental-findings-retail-investing
- Massachusetts / Robinhood: https://www.sec.state.ma.us/divisions/securities/download/RH-Consent-Order.pdf
- Robinhood / Kearns: https://www.cnn.com/2021/07/01/business/robinhood-lawsuit-suicide-settlement
- UKGC slots rules: https://www.twobirds.com/en/news/articles/2021/uk/gambling-regulation-update-commission-announces-new-measures
- Auer & Griffiths: https://pmc.ncbi.nlm.nih.gov/articles/PMC5897477/

**Perp mechanics and Bitget specs**
- Bitget stock perps: https://www.bitget.com/support/articles/12560603847519
- 24/7 trading and ±3% clamp: https://www.bitget.com/support/articles/12560603849504
- TradFi perps overview (EMA mark, 4h/8h funding): https://www.bitget.com/en-CA/support/articles/12560603894212
- Funding cap 0.5% and 8h: https://www.bitget.com/academy/how-to-trade-stock-perpetual-contracts-on-bitget-futures-2026-guide
- OPENAIUSDT: https://www.bitget.com/blog/articles/bitget-openai-ipo-perpetual-contract-openaiusdt
- SPCXUSDT: https://www.bitget.com/asia/blog/articles/bitget-spacex-ipo-perpetual-contract-spcxusdt ; https://www.bitget.com/support/articles/12560603885389 ; https://www.bitget.com/support/articles/12560603887172
- BitMEX conversion: https://www.bitmex.com/blog/spcxusdt-conversion
- SpaceX IPO: https://www.cnbc.com/2026/06/12/spacex-ipo-spcx-live-updates.html
- ADL: https://www.bitgetapp.com/support/articles/12560603800805 ; https://www.bitget.com/api-doc/contract/position/Get-Position-Adl
- Long/short and open-interest APIs: https://www.bitget.com/api-doc/classic/common/apidata/Long-Short ; https://www.bitget.com/api-doc/contract/market/Get-Open-Interest
- TP/SL and trailing stops: https://www.bitget.com/support/articles/12560603817159 ; https://www.bitget.com/api-doc/uta/strategy/Place-Strategy-Order
- Demo trading API: https://www.bitget.com/api-doc/classic/demotrading/restapi
- 10/10/2025 cascade: https://www.coindesk.com/research/market-spotlight-the-19-billion-liquidation-that-shook-crypto
- Weekend discovery: https://www.allium.so/reports/when-wall-street-sleeps ; https://crypto.com/en/research/rwa-perps-find-predictive-edge-apr-2026 ; https://www.financemagnates.com/thought-leadership/the-convergence-trade-nobody-planned-on-chain-fridays-to-nyse-mondays/
- trade.xyz off-hours oracle (secondary guide): https://hyperliquidguide.com/guides/trading/hyperliquid-xyz-explained
- Competitor GapBrief: https://github.com/Pizzylee001/gapbrief
