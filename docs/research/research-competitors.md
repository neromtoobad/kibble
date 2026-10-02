# Bitget AI Base Camp S2: competitor research for Kibble

Researched 2026-09-30 (UTC). Everything was read-only: public GitHub READMEs and logs through `gh api`, the S2 handbook, @Bitget_AI posts through X mirrors, and competitors' live demos. I did not change any repository.

---

## 0. Urgent flags (read first)

1. **Kibble's live URL is down.** At three checks between about 07:30 and 07:50 UTC on 2026-09-30, `https://kibble.up.railway.app/`, `/api/log` and `/api/metrics` all returned Railway's `404 {"message":"Application not found"}`. At the same time a second Railway-hosted competitor, Diagnos (`diagnos-production-1844.up.railway.app`), returned the same error. The Railway status page said "Operational". So this may be a Railway edge or routing problem rather than something in Kibble, but either way judges cannot open the demo or the paper log right now. Under the handbook, "accessible submission materials" missing = **invalid entry**. Verify the Railway domain or service. A static fallback would help too: a committed snapshot of `/api/log?format=csv` and `/api/metrics` in the repo, or a GitHub Pages mirror.
2. **The deadline is ambiguous.** The handbook still says 9/27 (UTC+8). @Bitget_AI posted "submission extend to Sep 27th" on about Sep 22, and later: *"Good news for builders still shipping — Hackathon S2 submission deadline is now Oct 8."* That post is dated about Sep 24 on the nitter mirror (https://nitter.jaydenha.uk/Bitget_AI). The user's information says Oct 6. The safe plan is still to submit by Oct 5 16:00 UTC. Judging window in the handbook: 9/22–10/7. Results: 10/8.
3. **Public voting has not been published yet.** The handbook still shows "[TBD: Public voting post]". Voting works by commenting the project ID under Bitget's official voting post. Project IDs are released only after the deadline, so the voting window will probably move with the extension.

---

## 1. What the S2 handbook actually says (judging, voting, awards)

Source: https://bitget-ai.gitbook.io/bitgetai_hackathons2. The full markdown is at `/base-camp-hackathon-s2-en.md`.

**Track 2 (Agentic Trading)**
- **Positioning.** "The LLM is the primary trading decision-maker, not just an assistant. The Agent must sense the environment, make independent judgments, and autonomously place orders with risk controls."
- **Judging focus.** Paper-trading Sharpe, max drawdown and win rate; decision explainability; agent architecture quality; risk-control layer effectiveness.
- **Scoring.** **50% quantitative + 50% judges.**
- **Required materials.** A runnable demo; an event → decision → execution flow (simulated or paper is acceptable); a paper-trading log run during the competition (≥2 weeks recommended; starting 9/3 meets the minimum); a compliant X post.
- **Sub-themes.** One winner each, 500 USDT: Event-Driven Agent, Market Sentiment Agent, Earnings-Driven Trading Agent, Cross-Asset Execution Agent, Factor Discovery Agent. **Open Theme** has 2 winners per track. Its suggested direction is *"Agent evaluation / benchmarks covering decision consistency, risk-violation rate, max drawdown, stress behavior, human-takeover rate, and incremental value over fixed-rule or Human + AI baselines."*
- **Recommended toolchain (Track 2).**
  - Paper: GetAgent Skill → Playbook → GetAgent Studio Paper Trading.
  - Execution: Agent Hub + Agentic Account OAuth (`--paper-trading` routes to Demo).
  - Perception: `bitget-signal` (crypto macro, sentiment, news, technicals; no key needed) plus `bitget-mcp-server` (US stocks and ETFs, fundamentals, earnings calendar, analyst targets, 13F, news; `https://agent.bitget.com/mcp`).
  - Optional: Chainbase AgentKey.

**Project description.** One form field with six parts. The handbook says *"judges weigh the first three most"*: (1) thesis (highest weight), (2) a concrete target user ("all traders" is not accepted), (3) validation data: test period, returns, Sharpe/Sortino, max DD, win rate, turnover, fees and slippage, each figure labelled observed, estimated or targeted, plus how you will prove usage or distribution. There is also a separate required field, "Role of the LLM in your project", covering models and where Qwen is used. Incomplete validation or productization answers do not invalidate an entry but "will noticeably lower your score".

**Prizes (50,000 USDT)**
- 1 Grand Prize (3,000)
- 15 Theme prizes (500), 1 per named sub-theme
- 6 Open Theme prizes (500), 2 per track
- 10 University prizes (500)
- 3 **Best Spread** (300, 1 per track)
- 3 **Fan Favorite** (300, 1 per track)
- Audience Lucky Draw and Prediction pools

**Stacking**
- On the judge side, only the highest tier counts: Grand > Theme/Open > Best Spread.
- Fan Favorite stacks with everything.
- University is exclusive with main prizes.

**Best Spread Award**
- Judges review **your own or your team's X reach data** for progress posts made while building.
- **KOL/KOC ghost-posting is not counted.**
- Mutually exclusive with Grand, Theme and Open prizes.
- The submission must include an X post that quotes https://x.com/Bitget_AI/status/2100519318824055159 with `#BitgetHackathon` and `@Bitget_AI`. A bare retweet counts as an incomplete submission.

**Fan Favorite**
- Goes to the highest-voted project per track.
- Anyone votes by commenting the project ID on Bitget's official voting post, with 1 vote per account.
- Participants may rally votes.
- Voters whose pick wins Fan Favorite enter a 1,000 USDT lucky draw of 50 × 20. The earliest 50 voters for the eventual Grand Prize winner split another 1,000 USDT. That gives voters a reason to vote early and to back likely winners.

**Beyond cash**
- Demo Day after 10/8, via an opt-in checkbox in the form. Priority goes to winners and high scorers, and it connects to internships, beta access and investors.
- Official Spotlight.
- **Playbook productization**: high-quality entries may be invited into Bitget Playbook's listing review, with possible revenue share.
- Qwen credits and a K3 token subsidy (a form checkbox).

**Other rules.** A team may enter at most 2 themes, each as a separate project with its own form. Reusing S1 work requires "substantive new additions".

---

## 2. Season 1: what won and what Bitget said it valued

S1 ("Genesis Season 1") ran May 27 – Jun 30, 2026. It had three tracks (Trading Agent, Trading Infra, Open/US-stock) and 700+ submissions. Prizes: 1st 6,600; 2nd 1,500 ×3; 3rd 800 ×3; Community Impact 500 ×3; +50 USDT participation. Handbook: https://bitget-ai.gitbook.io/hackathon. S1 judges included Gracy Chen (Bitget), Foresight Ventures, and Chainbase, EVEDEX, Cysic and codatta.

**The only S1 winner I could verify is Catalyst (2nd place),** `dolepee/catalyst`, https://trycatalyst.vercel.app. The winner posted: *"2nd place at @Bitget_AI Hackathon S1 for Catalyst… A Bitget trading agent that acts only when its risk governor approves, every decision logged to a verifiable receipt ledger."* (@0xqdee, 2026-07-20, via https://twiscan.com/en/x/Bitget_AI). What its README emphasises:
- "Qwen proposes, deterministic governor approves/refuses, every decision becomes a public receipt." **NO TRADE is the default.**
- **"Discipline alpha"**: approved simulated PnL minus the counterfactual PnL of the theses the governor refused. It reported +4.15%, alongside 176 autonomous cycles, 20 approved trades, a 60% approved win rate, 85 vetoes and 70 stand-downs.
- A checksum-backed JSON receipt per cycle, a **browser verifier** that flips PASS/FAIL if a receipt is edited, a forward ledger, an "Evaluator pack", and a "Review in 90 seconds" section.
- A GitHub Actions cron every 4 hours that commits receipts, with "GitHub as notary".
- **GetAgent Playbook proof** (run id, Sharpe 2.635 in a sandbox backtest) and a "load-bearing sponsor stack" table (Bitget data, Qwen, Agent Hub skills, GetAgent).
- Explicit "what is real / not claimed" boundaries.

**Themes Bitget itself pulled from the 700+ S1 submissions.** An @Bitget_AI roundtable on 2026-07-14 named three:
1. 24/7 tokenized stocks: "when humans sleep, agents stay on watch".
2. **"Trading Harness — the safety layer before real capital"**.
3. **LLMs as "not fortune-tellers, but analysts that read every filing"**.

Bitget's Jun 30 posts also describe its own Trade Harness as "Every step is logged. Every trade is reviewed. Every anomaly is blocked." Put together, the house view rewards a strict harness, logged and reviewable decisions, and an LLM that reads filings. Kibble already fits the "reads every filing" angle through SEC EDGAR 8-K item 2.02.

I could not find a public list of the other S1 winners. Bitget notified winners by email, and bitget.com is not reachable from this environment.

---

## 3. The S2 field: entries found (about 45 relevant repositories)

The main sources were GitHub repo, topic and code search (`bitget hackathon`, `rtoken`, `Bitget AI Base Camp`, `BitgetHackathon`, `paptrading`, sub-theme names, `hackathon.bitgetops.com`) and web search. "Live" gives the HTTP status of each demo URL at the time of checking (2026-09-30).

### Track 2: Agentic Trading

| Repo | Sub-theme | One-liner | Live demo |
|---|---|---|---|
| [norbert351/vigil](https://github.com/norbert351/vigil) | Cross-Asset | LLM-run rToken + crypto book overnight; signed manifests; two-model audit; night-mode breaker | vigil-mg0m.onrender.com → **503 "Service Suspended"** |
| [0xSheriff/afterhours-sentinel](https://github.com/0xSheriff/afterhours-sentinel) | Event-Driven | News → beta/z-score divergence → LLM classify → dual-mode risk → **real Bitget Demo orders**; 17 stock contracts | afterhours-sentinel.vercel.app (200) |
| [Pratiikpy/t2-sentiment-agent](https://github.com/Pratiikpy/t2-sentiment-agent) | Market Sentiment | Qwen target book, 11-guard reduce-only kernel, `bgc --paper-trading`, hash-chained ledger, pre-registered genesis + OpenTimestamps | t2-sentiment-agent-live.vercel.app (200) |
| [angelraph/gloaming](https://github.com/angelraph/gloaming) | (T2 + T3) | Fair value vs last close + proxies; Qwen per symbol for 9 symbols; GH Actions every 15 min since Sep 11; ledger committed to git | gloamingdesk.vercel.app (200, showed "waiting for first record") |
| [Ritapossible/Ballast](https://github.com/Ritapossible/Ballast) | Event-Driven | Overnight hedge "insurance" using matched perps; measured R² 0.98; "cannot trade direction" | ballast-v1.vercel.app (200) |
| [chyokore/noctive](https://github.com/chyokore/noctive) | Event-Driven | Signal vs noise overnight; 8-gate risk; SHA-256 receipts; opening-gap Replay Lab (seeded demo data) | noctive-phi.vercel.app (200) |
| [Frankydice/bitget-aegis24](https://github.com/Frankydice/bitget-aegis24) | Event-Driven | Multi-agent swarm (macro/earnings/arb) + 5-gate "seatbelt"; Playbook exporter; headline metrics look backtest-like and unverifiable | backend-frank-dice.vercel.app (200) |
| [danielamodu/Triad](https://github.com/danielamodu/Triad) | Cross-Asset | rAAPL vs BTC spread; AI + rules "drift breaker"; 136 tests; EC2 + Vercel | triadxbt.vercel.app (200) |
| [jubayir-hub-69/Chronos-Nexus](https://github.com/jubayir-hub-69/Chronos-Nexus) | Event-Driven | ORACLE / SENTINEL / CHAIRMAN (Qwen); Demo USDT-M orders; **Arbitrum Sepolia hash attestation**; Telegram command desk | none |
| [CryptoCT01/Crossfire](https://github.com/CryptoCT01/Crossfire) | Cross-Asset | 12 US stock perps + 12 crypto perps "Dual Book"; Risk Cage; "Decision Cinema"; `/api/explain/:tickId` | local only |
| [wisdomkings001/diagnos](https://github.com/wisdomkings001/diagnos) | Event-Driven | Conviction from signal agreement across 9 stock perps; Qwen → Groq fallback; "Ask Diagnos" chat | Railway **404** |
| [scanner72/bitget-bot](https://github.com/scanner72/bitget-bot) | Agentic (general) | RSI divergence → rules/LLM → gate → **UTA Demo** orders; SHA-256 decision JSONL; "research graveyard" | local/Docker |
| [acevod/custos](https://github.com/acevod/custos) | Open Theme | Monitors the rToken *wrapper's* liquidity health (spread, depth, regime); LLM only in a grey zone; GH Actions cron | acevod.github.io/custos (200) |
| [khalydmaina/tare](https://github.com/khalydmaina/tare) | Open Theme | Calibrated "Inspector" + shadow book + **prompt-injection attack suite A1–A5** (crypto) | tare-rust.vercel.app (200) |
| [thereal-awetoby/priva](https://github.com/thereal-awetoby/priva) | Open Theme | Scheduled agent on AAPL/TSLA spot + perps, Bitget paper; intent hashes; per-user Strategy Lab (English → JSON) | priva-rho.vercel.app (200) |
| [RonyZ1320/sentinelx](https://github.com/RonyZ1320/sentinelx) | Event-Driven | Scout → Thesis → Adversary → Risk; trade autopsy → strategy memory (simulated world only) | none |
| [Ay0bhamii/rtoken-agent](https://github.com/Ay0bhamii/rtoken-agent) | Event-Driven | "NightShift Agent": sample events → LLM → hard gate → paper; stdlib dashboard | none |
| [GODGRACE07/veto](https://github.com/GODGRACE07/veto) | Earnings-Driven | Multi-pass LLM consensus + deterministic signal; embargoed memory; dashboard and execution "to be added" | none |
| [JimmyOgb/aegis-rtoken](https://github.com/JimmyOgb/aegis-rtoken) | Event-Driven | Qwen + 8 fail-closed gates, `bgc --paper-trading`, 7 rToken spot markets, Next.js dashboard | none |
| [rishu4436/nightshift](https://github.com/rishu4436/nightshift) | Cross-Asset | Weekend rToken margin frozen at Friday close while crypto moves → Monday p50/p90/p99 stress → HOLD/CUT_LIVE | local |
| [Faizamurtala/hollis](https://github.com/Faizamurtala/hollis) | Agentic | Quant z-score + 3-agent panel (blind to z) + risk budget; mostly a scaffold | none |
| [Alike001/factor-discovery-agent](https://github.com/Alike001/factor-discovery-agent) | Factor Discovery | Qwen proposes factor recipes; frozen evidence gates; 0 of 9 certified, so 0 trades | factor-discovery-agent.vercel.app (200) |
| [Ayan1816/alpha-court](https://github.com/Ayan1816/alpha-court) | Agentic | Bull, Bear and Judge Qwen debate; human executes a simulated trade | local |
| [Jayanng/Omni](https://github.com/Jayanng/Omni) | (Cross-Asset) | UTA risk governor: rToken collateral haircut vs moving crypto PnL | none |
| [bernieboy0001/haircut](https://github.com/bernieboy0001/haircut) | (Cross-Asset) | Two demo accounts: LTV-managed vs naive bake-off; chain-locked autopsies | haircut-gray.vercel.app **404** |
| [Onegeex/Bitget-agentic-](https://github.com/Onegeex/Bitget-agentic-) | Cross-Asset | Claude Code headless as the agent; **live** Agentic sub-account (real money, small) | none |
| [xElvolution/nightdesk](https://github.com/xElvolution/nightdesk), [shadowbook](https://github.com/xElvolution/shadowbook) | Agentic | Multi-agent overnight desk, 12 gates / shadow twin of the book with "promote to live" | none |
| [armanabdullah4cv/StockPilot-Trading-Agent](https://github.com/armanabdullah4cv/StockPilot-Trading-Agent) | Agentic | Gemini + TA confluence, 9 stocks, simulated | none |
| [buildwithtolu/Tiltlock](https://github.com/buildwithtolu/Tiltlock) | (Agentic tooling) | Revenge-trading kill switch for Agentic accounts | none |
| **[neromtoobad/kibble](https://github.com/neromtoobad/kibble)** | Event-Driven | Collectible pet per rToken perp; funding = hunger; mandates = risk; Qwen decides; 3 pets on demo | Railway **404 at check** |

### Other tracks: standouts worth knowing

- **Track 3 (AI Trading Desk)**
  - [Modemola/BITGET_HACK "Blackout Desk"](https://github.com/Modemola/BITGET_HACK), https://blackout-desk-eight.vercel.app: 7 tools, 209 tests. Its finding is that 78–98% of the weekend premium closes because the stale reference catches up, not because the token corrects. Fading it is a coin flip that dies at 10 bp.
  - [Pizzylee001/gapbrief](https://github.com/Pizzylee001/gapbrief), https://gapbrief.vercel.app: a five-year weekend-gap distribution via bitget-mcp-server plus a Qwen read, for 4 tickers.
  - [Pratiikpy/argus-bitget](https://github.com/Pratiikpy/argus-bitget): same author as t2-sentiment. Has /proof and **/wrong** ("what we got wrong") pages.
  - [egbujor-emmanuel/nocturne](https://github.com/egbujor-emmanuel/nocturne): measured the weekend flow ratio at 684:1 against a Friday hour; 87 weekend-tradeable rTokens.
  - Others: Ritik200238/nightwatch, oladipsinigami/Precedent, lijianyuan10/MyDesk, PhiBao/weekend-copilot, Jayanng/baserate, comzzy/implied-world, Nifemi0/postbell, PinnacleCryptNG/MirrorLine.
- **Track 1 (Alpha Factory)**
  - [Megacollins/rift24](https://github.com/Megacollins/rift24): honestly reports that its hypothesis failed; stood down on 100% of sessions.
  - [jenzylove/residual](https://github.com/jenzylove/residual): EDGAR item 2.02 → factor-residual earnings move → hedged pair (for example long NVDA / short SMH).
  - [Dami904/SEAL](https://github.com/Dami904/SEAL): after-hours signal plus order clipping; has a demo video.
  - Others: Slumhee weekend-bounce, cunicle/bitgetstrategy (GetAgent Playbook integration), zz-0816 basis terminal and execution-aware alpha (Chinese teams), tianzeteam/stillwater-alpha.

**How crowded each sub-theme is** (from what I found; GitHub is only a sample):
- Event-Driven: about 10 entries (afterhours-sentinel, noctive, aegis24, Ballast, diagnos, sentinelx, rtoken-agent, aegis-rtoken, Chronos-Nexus, Kibble). This is the most crowded, with 1 winner.
- Cross-Asset: about 6 (VIGIL, Triad, Crossfire, nightshift, Onegeex, plus Omni and haircut).
- Market Sentiment: 1 strong entry (t2-sentiment).
- **Earnings-Driven: 1, and it is incomplete (Veto).**
- Factor Discovery: 1.
- Open Theme: 3 (custos, tare, priva), with 2 winners.

---

## 4. Deep dives: the strongest Track 2 competitors

### 4.1 VIGIL (norbert351/vigil): the most complete "desk" entry
- **Idea.** The LLM manages a mixed rToken + crypto portfolio overnight and at weekends. Each cycle (about 5 minutes) runs: sense → Qwen `qwen3.8-max` decides → risk gate → execute → sign.
- **Risk layer.**
  - Drawdown circuit breaker: 10% by day, **5% in "night mode" 22:00–06:00**, when gross exposure is also capped.
  - Kill switch (file or `POST /api/kill`), per-order cap, and single-asset, aggregate-crypto and aggregate-rToken concentration caps.
  - Fear & Greed regime rotation into SPY/QQQ.
  - **Second-model reviewer**: it audits the full plan before execution, and its verdict is signed into the log. A rejection drops only the LLM's discretionary orders; de-risking is never blocked. There is a deterministic fallback auditor.
- **Execution.** A paper ledger with fees and slippage, plus a "capability-aware hybrid" route to the Bitget demo venue (signed UTA v3). Venue-halted rTokens fall back to paper, and every row is labelled with which venue filled it.
- **Presentation to judges.**
  - `/api/metrics` (Sharpe, max DD, win rate, realized P&L) and `/api/equity`.
  - `/api/backtest?days=90`, `/api/decision-log.csv`, `/night` event timeline, `/reports/latest`, `/leaderboard`.
  - A multi-session **"Connect" (bring your own book)**, SSE stream, and break-glass webhooks to Telegram, Discord or Slack.
  - A 66-second demo video; `docs/rubric.md` mapping every judging criterion to evidence; `docs/SUBMISSION.md`; 35 tests.
- **Bitget integrations.** `bitget-mcp-server` for US data, the `bitget-signal` backend, UTA v3 demo and Qwen. A "sponsor stack is load-bearing" counterfactual table.
- **Observed numbers.** The committed CSV has about 6,500 decision rows. The last NAV is about $9,345 on a $10,000 seed (about −6.5%, DD about 7.1%). Many early rows ran on a "stub" LLM; later rows are `qwen`.
- **Weakness.** The live demo is currently suspended on Render.

### 4.2 AfterHours Sentinel (0xSheriff): the strongest real-execution event agent
- **Pipeline.** RSS event taxonomy (9 categories, entity resolver across 15 stocks, zero LLM tokens on irrelevant news) → deterministic **beta / residual z-score / volume-ratio** engine → LLM classifies direction only and never sees the z-score → dual-strategy risk engine (mean-reversion vs momentum/PEAD) that needs **3/3 signals aligned** → smart hybrid router.
- **Execution.** It queries Bitget Demo's contract list. NVDA, TSLA, AAPL, AMZN, GOOGL, META, COIN, MSTR, BTC and ETH go to the **Demo matching engine** as HMAC orders; unlisted names fall back to paper.
- **Scale and evidence.** It tracks **17 Bitget demo stock contracts**. It reports 147+ hours of unattended supervisor runtime, 545+ live event decisions and 65 tests. Logs are JSONL/CSV of about 1 MB, and it ships a submission audit CSV separating live data from calibration data.
- **Risk.** 3% sizing, 1.5% stop, 3% take-profit, max 2 positions, 2% daily loss halt.

### 4.3 t2-sentiment-agent (Pratiikpy): the most rigorous verifiability
- **Decision.** Qwen proposes a target book with a thesis, an invalidation, and "what the crowd believes vs what we do". "Flat with reasons" is a valid answer.
- **Risk kernel.** It **can only reduce** risk, with 8 pre-registered guards plus 3 structural checks, enforced as types.
- **Execution.** Every order goes through Agent Hub `bgc --paper-trading`, **previewed with `--dry-run`**, then reconciled against the venue. The agent proves its key is a demo key before trading.
- **Ledger.** One **hash-chained** ledger, a **genesis hash timestamped with OpenTimestamps** that pins code, locks, policy and metric definitions *before* the first decision, and `scripts/recompute.py` so anyone can check every published figure.
- **Honest outage stats.** It publishes how often Bitget's services answered: bitget-mcp-server 1,592 of 2,808 calls, **bitget-signal 0 of 939**.
- **Numbers (live page).** 13 decisions, 1 closed trade, −0.03%, Sharpe −8.33 (labelled noise).
- **Why it matters.** It is the most "judge-proof" architecture in the field.

### 4.4 Gloaming (angelraph)
- **Model.** Fair value = real close × (1 + blended proxy return since the close), with proxies 0.5 index futures, 0.3 BTC/ETH and 0.2 inverted DXY. It trades only while NYSE is shut, across 9 symbols.
- **Schedule and evidence.** Unattended GitHub Actions every 15 minutes since Sep 11–13, with the ledger and decisions committed to the repo. It reports that **about 91% of decisions came from Qwen**, with the fallback disclosed.
- **Desk.** A multi-page Next.js app: book vs limits, per-symbol pages, overnight timeline, grounded chat, a stress test replaying historical nights, and a **decision inspector** (inputs, the book Qwen saw, its reasoning, the risk verdict).
- **Public error corrections.** A signal-window bug and a missing-bar anchor bug were both fixed in the open with regression tests. It has 158 tests.

### 4.5 Ballast (Ritapossible)
- **Idea.** "Keep the position, switch off the night's risk for a stated price." A matched-perp hedge removes overnight variance.
- **Measured results.** Median R² 0.982; 88% p95 tail reduction; held out on 12 of 12 names; costs 11.3 bp against 20 bp to exit.
- **Structure.** A `night`, `morning` and settle loop that grades each hedge against the counterfactual, with a /settled page. "No code path to a directional trade" is enforced by a separate process holding the only write credential. Stdlib only, with `verify.py` for every claim.
- **Position.** Priced protection, explicitly not alpha.

### 4.6 Triad (danielamodu)
- **Idea.** An rAAPL vs BTC spread, with 3 signals feeding 1 AI decision.
- **Drift breaker.** After **5 consecutive AI-vs-rules disagreements, the backup rules take over for 10 ticks.**
- **Safety.** A persisted risk ledger, fail-closed after 3 failed orders, idempotent client IDs, broker reconciliation at boot, and 136 tests.
- **Honest limits.** "rToken legs are signal-only on paper: place-order rejects them"; only the BTC leg fills.
- **Snapshot.** 1,438 ticks, 44 fills, −$14.78, 37% win rate.

### 4.7 Chronos-Nexus (jubayir-hub-69)
- **Structure.** Three named agents. ORACLE scores news credibility and recency. SENTINEL applies a binding TA/orderbook veto: RSI, multi-timeframe, L2 walls, VWAP, a 75 setup score and a daily halt. CHAIRMAN is Qwen.
- **Attestation.** It hashes the "board minutes" and **anchors them in a 0-value Arbitrum Sepolia transaction**, then sends a Bitget Demo USDT-M order pegged to the mainnet best bid/offer. It scales out half at +25%.
- **Telegram.** A command desk and alerts on Telegram.

### 4.8 Crossfire (CryptoCT01)
- **Book.** A "Dual Book" of 12 US stock perps and 12 crypto perps, with a 5-minute heartbeat plus wakes on large moves (≥1.5%).
- **Explainability.** A **"Decision Cinema"** UI, `/api/explain/:tickId`, and a Sharpe/max-DD/win-rate scorecard in the UI.
- **Honesty.** It discloses a re-entry bug that hurt its win rate: "logs were not rewritten".

### 4.9 Noctive (chyokore) and Aegis24 (Frankydice): polished but thinner on evidence
- **Noctive.**
  - An 8-gate matrix (size, concurrent positions, 75% confidence, spread/depth guard, cooldown, mandatory SL, TP ≥ SL, daily loss).
  - SHA-256 receipts and an "Opening-Gap Replay Lab".
  - The scenarios are seeded demo data, clearly labelled.
- **Aegis24.**
  - A multi-agent swarm with 5 gates, including **NAV parity band ≤2.5%**, fractional Kelly and **pre-market freeze 30 minutes before Monday open**.
  - A Playbook exporter, `SUBMISSION_DOSSIER.md` and an X thread doc.
  - It claims Sharpe 2.34 and a 68% win rate over 60 days. These read like backtest or synthetic figures and cannot be verified from outside.

### 4.10 Open Theme trio: custos, tare, priva
- **custos.** Watches the *wrapper's* health rather than price, via spread, top-of-book depth against its own same-regime history, abnormal movement and a calendar penalty. Deterministic gates run first; the LLM is consulted only in the 0.25–0.5 grey zone. It publishes "exit" vs "round-trip vs hold" performance.
- **tare.** An LLM gives take/skip plus a confidence. A non-LLM Inspector sizes or vetoes using a calibration matrix (Wilson lower bound, quarter-Kelly). A **shadow book records what would have happened without the Inspector**. An **attack suite** covers headline prompt injection, fake consensus, candle forgery and confidence steering.
- **priva.** Scheduled every 5 minutes; logs a hash of each intent, and a Fernet credential vault; per-user Strategy Lab; reports honest small losses (−$116, 48.5% win rate, −0.65% DD).

### 4.11 Veto and SentinelX: interesting mechanisms, incomplete
- **Veto.** Multi-pass LLM consensus anchored to a deterministic price signal, per the TrustTrade paper cited in its README. **Embargoed memory** hides outcomes until they are genuinely in the past. The rejection log is treated as a product output, and it compares itself with a naive single-LLM baseline. 119–133 tests. Execution and dashboard are "to be added".
- **SentinelX.** An Adversary "kill shot", a post-trade autopsy graded A–F, and strategy memory that changes behaviour on the next run. It runs on a simulated world only.

---

## 5. Paper numbers seen across the field (context for the 50% quantitative half)

| Entry | What it reports | Source |
|---|---|---|
| VIGIL | about 6.5k decisions; NAV about −6.5%, DD about 7% (committed CSV, last rows) | docs/paper-log/vigil-decision-log.csv |
| Triad | 44 fills, −$14.78, 37.2% win rate, max drop from peak 1.09% | README snapshot, Sep 16 |
| Priva | −$116 on about $20k, 48.5% win rate, DD −0.65% | README |
| t2-sentiment | 1 closed trade, −0.03%, Sharpe −8.33 | live record |
| SentinelX | +0.78% (simulated world) | README |
| Catalyst (S1, 2nd) | 60% approved win rate, discipline alpha +4.15%, 176 cycles | README |
| Aegis24 | claims Sharpe 2.34, 68% win rate, DD −7.2% (not verifiable) | README |
| **Kibble (harness baseline, from README)** | per-pet Sharpe −2.12 to +0.45; **max DD 11–36%** (Night Shift 36.1%, Diamond 19.4%) | README table |

**Takeaway.** Most real paper logs are small, flat or slightly negative, and drawdowns are mostly **under 7%**. Nobody has a convincing positive Sharpe. A low-drawdown, cost-inclusive, honestly labelled log with a clear "risk layer saved X" figure would stand out. Kibble's leveraged isolated longs, with drawdowns up to 36% in its own harness, are its biggest exposure on the quantitative half.

---

## 6. Synthesis

### (a) Table stakes: what almost every serious Track 2 entry has
1. **The LLM decides and a deterministic gate vetoes or clamps**, and the gate "cannot be overridden by the model". Usually Qwen `qwen3.8-max` via `hackathon.bitgetops.com/v1`, with a clearly labelled rule fallback.
2. **Portfolio-level hard limits:** daily-loss halt, drawdown circuit breaker, max concurrent positions, per-position cap, cooldown or anti-churn, spread/liquidity guard, and a **kill switch**. Examples: VIGIL, AfterHours Sentinel, Noctive, NightShift, Diagnos, Triad, Priva, Crossfire.
3. **An append-only decision log per cycle:** event → model output → gate verdict → order/fill. It includes rejected and no-trade decisions, exported as CSV/JSONL and usually **hashed, signed or chained**. Examples: VIGIL, scanner72, t2-sentiment, Noctive, Priva, Catalyst.
4. **Bitget Demo execution (`paptrading: 1`) with order IDs**, honest sim/demo labels, and a route that is paper-only by construction. Examples: AfterHours Sentinel, scanner72, t2-sentiment, Chronos-Nexus, Priva, VIGIL venue mode.
5. **A metrics endpoint or panel:** Sharpe, max DD and win rate, with fees and slippage modelled.
6. **Unattended operation:** a cron or worker, often GitHub Actions committing the log so git history is the notary, plus heartbeat and uptime.
7. **A public live dashboard, a test suite with a count, "honest limits", and a paste-ready SUBMISSION doc.**

Kibble already has 1, most of 3 (the diary), 4 (three pets), 5 and 6, plus strong "honest limits". It is **missing portfolio-level breakers and a kill switch, a tamper-evident log, and a working live URL.**

### (b) Differentiators that stand out
- **Counterfactual proof that the risk layer adds value.** Catalyst's "discipline alpha" (the S1 2nd-place headline), tare's shadow book, Veto's naive baseline, haircut's two-account bake-off, and Ballast settling each hedge against reality. This maps directly onto "risk-control layer effectiveness".
- **Second opinion inside the loop.** VIGIL's reviewer model, Triad's drift breaker, SentinelX's adversary plus autopsy and memory, Veto's multi-pass consensus, and the bull/bear/judge courts.
- **Pre-registration and cryptographic verifiability.** Genesis hash with OpenTimestamps plus a recompute script (t2-sentiment), browser checksum verifier (Catalyst), on-chain attestation (Chronos-Nexus).
- **Market-structure insight specific to rTokens.**
  - Weekend marks and margin are frozen at Friday's close while crypto moves (Nightshift, Omni).
  - Weekend premium closure comes from the reference catching up (Blackout Desk).
  - Wrapper liquidity is thinner at weekends: top-of-book 10–100× smaller for 7 of 10 tokens (Custos).
  - Overnight risk can be hedged with perps (Ballast).
- **Breadth.** 9–17 stock contracts (AfterHours 17, Crossfire 24 across both books, Diagnos 9, Gloaming 9, Custos 10).
- **Judge ergonomics.** A "review in 90 seconds" path, a rubric-to-evidence map, an evaluator pack, a demo video, a decision inspector or "Decision Cinema", and "what we got wrong" pages.
- **Adversarial robustness.** Prompt-injection and data-forgery attack suites (tare).
- **Distribution hooks.** Telegram command desks and alerts, multi-user "connect your book" (VIGIL, Priva), Playbook export (Aegis24, Catalyst).

**Kibble's unique edge.** It is the **only consumer-facing, gamified entry** among roughly 45 repositories, which are otherwise near-identical "sentinel / desk / risk-gate" builds. Funding as hunger, liquidation as fainting, and personalities as risk mandates is a genuinely novel way to explain an agent's decisions. That makes Kibble the natural favourite for **Fan Favorite** and **Best Spread**, provided the quantitative evidence and risk rigor underneath are credible.

### (c) Concrete gaps in Kibble relative to the field
1. **The demo is unreachable right now** (Railway 404). There is no static fallback for the log and metrics.
2. **Drawdown risk on the quantitative half.** Kibble runs leveraged isolated longs (1.5–8×) that are long-only, with no hedge. Its own harness shows 11–36% drawdowns, while most competitors sit under 7%.
3. **No portfolio-level breaker, daily-loss halt or global kill switch.** The mandates are per-pet thresholds for liquidation buffer and funding. They are not account-level circuit breakers, which every strong competitor shows.
4. **No counterfactual "what the mandate saved" metric.** The fixed-rule baseline exists in the harness but is not published as a live shadow next to the model's log.
5. **The log is not tamper-evident.** There is no hash chain, head hash, verify script or browser verifier.
6. **Thin breadth.** 6 underlyings, of which only 3 execute on demo. Competitors trade 9–17 stock perps. The demo record is also short: live since 2026-09-30 07:08 UTC, while the sim log starts 09-20.
7. **Light use of Bitget's own toolkit.** Kibble uses public REST plus Yahoo, Google and EDGAR. It does not use bitget-mcp-server (earnings calendar, analyst targets), bitget-signal, Agent Hub `bgc --dry-run`, the Agentic Account or a GetAgent Playbook. Bitget staff judge this, and the handbook recommends that stack.
8. **No second-opinion or reflection loop.** There is a single model call, and the pet never learns from outcomes.
9. **No weekend-freeze or Monday-gap modelling.** Night Shift works exactly the window where Bitget clamps stock-perp marks to the Friday index, so Monday-open gap risk is where an isolated long gets liquidated. Nightshift, Omni and Aegis24's pre-market freeze all address this directly.
10. **Judge ergonomics.** Kibble has no demo video, no 90-second review path, no decision-inspector page and no evaluator JSON.

### (d) Ranked ideas (highest expected impact on the odds first)

1. **Restore and harden the live demo, and add a static evidence mirror.** Uptime ping, a nightly commit of `/api/log.csv` and `/api/metrics.json` into the repo or GitHub Pages, and a `/status` page. *Why: inaccessible materials make the entry invalid; this is table stakes.*
2. **Add a kennel-wide risk layer.**
   - A daily-loss halt, a max-drawdown circuit breaker and an aggregate gross-exposure cap.
   - A visible global kill switch (`POST /api/kill` plus a UI state).
   - A **Monday-gap guard**: de-lever or flatten isolated longs before Fri 20:00 ET (and before holidays) when the p90 historical weekend gap would breach the liquidation buffer.

   Log every trigger in the diary. *Why: this is the "risk-control effectiveness" criterion. Every strong competitor has it (VIGIL, AfterHours, Aegis24's pre-market freeze, Nightshift's Monday stress), and it directly cuts max DD for the quantitative 50%.*
3. **Add a "mandate saved you $X" shadow book.** For every veto or clamp, simulate the model's raw request next to what executed. Also run a naive baseline (same pet with no gate, and buy-and-hold at the same leverage). Publish "mandate alpha" per pet and for the kennel. *Why: the S1 2nd-place winner's headline metric, echoed by tare, Veto and haircut. It is the most persuasive evidence a risk layer works, and it fits the Open Theme "incremental value over fixed-rule baselines" wording.*
4. **Tune for the quantitative half, honestly.** Lower leverage on the three demo pets, or run a conservative "competition" mandate. Publish one **aggregate kennel equity curve** with Sharpe, Sortino, max DD, win rate, profit factor, trade count and exposure time, net of fees and funding, split into demo and sim. Show the Qwen-vs-fallback decision share and the veto and clamp rates. *Why: 50% of the score; the rest of the field sits at about 1–7% drawdown.*
5. **Grow the roster to every stock perp on Bitget demo.** Candidates include AMZN, GOOGL, META, COIN, MSTR, AMD, NFLX, QQQ and SPY; AfterHours lists 17 demo contracts. Add them as new species, or as "breeds" that reuse the art. Keep OPENAI and SPCX as the unique pre-IPO pets. *Why: answers "only 6 stocks", takes demo-executed agents from 3 to about 10, and produces more closed trades so the win rate and Sharpe mean something.*
6. **Make the diary tamper-evident.** Add a `prev_hash`/`hash` per row and commit the head hash on a cron (optionally with OpenTimestamps). Ship `npm run verify` and a browser "verify this diary" badge. *Why: table stakes among the top entries (t2-sentiment, VIGIL, Catalyst, scanner72); scores on explainability and auditability.*
7. **Build a decision inspector: "Why did Nova do that?"** For each diary line, show the exact inputs (headlines and filings with links, funding, position, mandate), the raw Qwen JSON, the gate verdict, and the order id, fill and slippage. *Why: explainability. Gloaming, Crossfire ("Decision Cinema") and Catalyst all have one.*
8. **Add a reviewer and a learning loop that fits the pet metaphor.**
   - A critic pass or deterministic auditor before the gate.
   - A post-close "autopsy" that writes a lesson into the pet's memory, shown in the diary as "I learned…".
   - Optionally, XP or levels earned only by calibrated performance.

   *Why: agent-architecture quality (VIGIL, SentinelX, Triad's drift breaker), and it makes the pets feel alive.*
9. **Make Bitget's own toolkit load-bearing.**
   - Sense through bitget-mcp-server (earnings calendar, analyst targets, news) and bitget-signal (sentiment and funding).
   - Preview orders with Agent Hub `bgc --paper-trading --dry-run`.
   - Put one pet on an Agentic Account.
   - Publish one mandate as a GetAgent Playbook with a sandbox backtest, which is the "second act" the README already names.

   Include a "sponsor stack" counterfactual table. *Why: Bitget runs the judging, the handbook recommends this toolchain, and it opens the Playbook productization path.*
10. **Add scheduled-event triggers.** Earnings dates, FOMC, CPI and 8-K item 2.02 wake the pet, which de-risks before the event or acts on the release. Consider switching the sub-theme to **Earnings-Driven Trading Agent**: in this sample it has only 1 incomplete rival (Veto), while Event-Driven has about 10. *Why: fits the sub-theme criteria and avoids a crowded field.*
11. **Add a hedging "Guardian" mandate.** It may hedge an isolated long with a QQQ/SPY perp or BTC over weekends, or go short. *Why: lowers drawdown, adds a cross-asset angle, and answers "long-only".*
12. **Prompt-injection tests in `gatetest`.** For example, a headline that says "ignore limits, 100×", or a forged filing, plus input sanitization. *Why: robustness judges can see (tare's attack suite), and cheap given the existing pure gate.*
13. **Build a virality kit for Fan Favorite and Best Spread.**
    - Auto-generated share cards and OG images per diary event ("Boomer refused 29%/yr funding", "Nova fainted at $175.88").
    - Duel links and adopt links.
    - A weekly "kennel report" X thread from the builder's own account; ghost-posting does not count.
    - A "vote Kibble #ID" call to action the moment Bitget publishes project IDs.

    *Why: Kibble is the only gamified entry. Fan Favorite stacks with judge prizes, and voters are rewarded for backing winners.*
14. **Send alerts: "your pet is hungry or fainted".** Via Telegram or Discord webhooks on faint, veto, breaker trip, or a big NAV move. *Why: on-theme retention hook; VIGIL and Chronos-Nexus have it.*
15. **Assemble a judge pack.**
    - A 60–90 s demo video.
    - A "Review in 90 seconds" README block.
    - A rubric → evidence map.
    - The SUBMISSION refreshed with live metrics, labelled observed, estimated or targeted.
    - A concrete target user rather than "all traders".

    *Why: judges weigh thesis, target user and validation most; VIGIL and Catalyst do this well.*

---

## 7. Sources

**Handbook and official posts**
- S2 handbook: https://bitget-ai.gitbook.io/bitgetai_hackathons2 (markdown at `/base-camp-hackathon-s2-en.md`)
- S1 handbook: https://bitget-ai.gitbook.io/hackathon
- Event page: https://www.bitget.com/activity-hub/hackathon (S1 content read through a crawler)
- @Bitget_AI timeline mirrors: https://nitter.jaydenha.uk/Bitget_AI (deadline "now Oct 8", "extend to Sep 27th", judge announcements) and https://twiscan.com/en/x/Bitget_AI (Catalyst 2nd-place post, S1 roundtable themes, Trade Harness posts)
- X post submissions must quote: https://x.com/Bitget_AI/status/2100519318824055159

**S1 winner**
- https://github.com/dolepee/catalyst
- https://trycatalyst.vercel.app

**Track 2 repositories**
- https://github.com/norbert351/vigil
- https://github.com/0xSheriff/afterhours-sentinel
- https://github.com/Pratiikpy/t2-sentiment-agent (live: https://t2-sentiment-agent-live.vercel.app)
- https://github.com/angelraph/gloaming
- https://github.com/Ritapossible/Ballast
- https://github.com/chyokore/noctive
- https://github.com/Frankydice/bitget-aegis24
- https://github.com/danielamodu/Triad
- https://github.com/jubayir-hub-69/Chronos-Nexus
- https://github.com/CryptoCT01/Crossfire
- https://github.com/wisdomkings001/diagnos
- https://github.com/scanner72/bitget-bot
- https://github.com/acevod/custos
- https://github.com/khalydmaina/tare
- https://github.com/thereal-awetoby/priva
- https://github.com/RonyZ1320/sentinelx
- https://github.com/Ay0bhamii/rtoken-agent
- https://github.com/GODGRACE07/veto
- https://github.com/JimmyOgb/aegis-rtoken
- https://github.com/rishu4436/nightshift
- https://github.com/Faizamurtala/hollis
- https://github.com/Alike001/factor-discovery-agent
- https://github.com/Ayan1816/alpha-court
- https://github.com/Jayanng/Omni
- https://github.com/bernieboy0001/haircut
- https://github.com/Onegeex/Bitget-agentic-
- https://github.com/xElvolution/nightdesk
- https://github.com/xElvolution/shadowbook
- https://github.com/armanabdullah4cv/StockPilot-Trading-Agent
- https://github.com/buildwithtolu/Tiltlock

**Other tracks**
- https://github.com/Modemola/BITGET_HACK
- https://github.com/Pizzylee001/gapbrief
- https://github.com/Megacollins/rift24
- https://github.com/jenzylove/residual
- https://github.com/Dami904/SEAL
- https://github.com/Pratiikpy/argus-bitget
- https://github.com/egbujor-emmanuel/nocturne

**Kibble**
- https://github.com/neromtoobad/kibble
- https://kibble.up.railway.app (404 at check time)
