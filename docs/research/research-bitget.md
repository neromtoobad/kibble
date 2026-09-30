# Bitget platform research for Kibble (Bitget AI Base Camp S2, Track 2)

Researched 2026-09-30. Read-only: no orders placed, no authenticated endpoint called.

## 0. How this was verified (read first)

- **Live API calls were not possible from this machine.** The local resolver (phone hotspot, 172.20.10.1) returns NXDOMAIN for every `*.bitget.com` host (`api`, `www`, `agent`, `wspap`, `ws`), while `google.com` and `hackathon.bitgetops.com` resolve. Pinning the IP by hand was refused by the permission layer, so no live GET was run.
- **Stand-in data (dated):** Optic's local cache (`~/Documents/Hacks/Hackathon/optic-bitget/data/optic.db`) holds the full `/api/v2/mix/market/contracts` and `/tickers` payloads for USDT-FUTURES from **2026-09-17 13:47 UTC**, plus NVDA/AAPL `current-fund-rate` and `open-interest`. The universe table in section 4 comes from that snapshot. Demo availability comes from Kibble's `PLAN.md` ("Verified facts, 20 Sep").
- **Docs:** the handbook markdown (fetched today, `hb_en.md` in this scratchpad), the Bitget-AI GitHub repos, CCXT's `bitget.ts` endpoint map, the tiagosiebler `bitget-api` SDK types, and Bitget doc/support pages read through a search-engine crawler.
- **Run the section 8 commands from Railway (or any network that resolves bitget.com)** to confirm today's numbers, especially items marked UNVERIFIED.

---

## 1. Market-data "senses" for stock perps

All of these are public and need no key. They use the classic v2 mix API (the one Kibble already calls) unless marked v3.

| Sense | Endpoint | What you get | Stock-perp status |
|---|---|---|---|
| Last / mark / index / funding / OI in one call | `GET /api/v2/mix/market/tickers?productType=USDT-FUTURES` (or `ticker?symbol=`) | `lastPr, markPrice, indexPrice, fundingRate, holdingAmount` (OI in base units), `usdtVolume`, `bidSz/askSz`, `change24h`, `openUtc` | **Verified (9/17 snapshot):** NVDA last 218.41, mark 218.39, index 218.249, fr 0.000179, OI 86,178 NVDA, 24h vol $19.3M. Kibble does not read `holdingAmount` yet, so this sense is free. |
| Mark/index/last only | `GET /api/v2/mix/market/symbol-price` | `price, indexPrice, markPrice, ts` | Lighter than a ticker call. |
| Open interest | `GET /api/v2/mix/market/open-interest` | `openInterestList[{symbol,size}]` | **Verified 9/17:** NVDA 86,139, AAPL 19,863. |
| OI limit / position tiers | `GET /api/v2/mix/market/oi-limit`, `query-position-lever` | Per-symbol OI caps; leverage/MMR tiers | Stock perps have their own OI limits (Bitget support article). |
| Funding now + caps | `GET /api/v2/mix/market/current-fund-rate` | `fundingRate, fundingRateInterval, nextUpdate, minFundingRate, maxFundingRate` | **Verified 9/17:** NVDA cap ±1%, AAPL cap ±0.5%, 8h interval. Kibble already reads the first three. |
| Funding history | `GET /api/v2/mix/market/history-fund-rate` | Settled rates | Already used. |
| Next funding time | `GET /api/v2/mix/market/funding-time` | `nextFundingTime, ratePeriod` | Redundant with `nextUpdate`. |
| Order book | `GET /api/v2/mix/market/merge-depth?precision=&limit=` | Aggregated asks/bids | Useful for slippage and a "crowd at the door" sense. Depth outside US hours matters because the index is then built from this book (section 1b). |
| Index / mark candles | `GET /api/v2/mix/market/history-index-candles`, `history-mark-candles` | OHLC of index and mark | Lets a pet chart "the real share" (index) against "my perp". During closures the index is internal, so label it. |
| Taker buy/sell volume | `GET /api/v2/mix/market/taker-buy-sell?symbol=&period=5m..1d` | `buyVolume, sellVolume, ts` | **UNVERIFIED for stock perps.** "Trading insight" endpoints historically cover only a subset of symbols; check `/api/v2/spot/market/support-symbols` (`futureList`). |
| Long/short (accounts) | `GET /api/v2/mix/market/account-long-short?symbol=&period=` | `longAccountRatio, shortAccountRatio, longShortAccountRatio` | UNVERIFIED for stock perps (same caveat). |
| Long/short (positions) | `GET /api/v2/mix/market/position-long-short` | `longPositionRatio, shortPositionRatio, longShortPositionRatio` | UNVERIFIED for stock perps. |
| Long/short (aggregate) | `GET /api/v2/mix/market/long-short` | `longRatio, shortRatio, longShortRatio` | UNVERIFIED. v3 twins: `/api/v3/market/futures-long-short`, `futures-account-long-short`, `futures-position-long-short`, `futures-active-buy-sell`. |
| **Liquidations (public)** | **v3** `GET /api/v3/market/liquidations?category=USDT-FUTURES&symbol=&limit=&cursor=` | `list[{symbol, side, price, amount, ts}]`, last 3 days | New public feed. It could drive "another creature fainted nearby" events. UNVERIFIED whether stock perps appear. |
| **Cash dividends** | **v3** `GET /api/v3/market/cash-dividend-records?symbol=&type=pending\|paid` | `exDividendDate, cashDividendPerShare, cashDividendTimestamp` | SDK comment: "RWA stock futures cash dividend records". Stock-perp specific. |
| **Splits / reverse splits** | **v3** `GET /api/v3/market/split-records?symbol=` | `type, status, adjustmentRatio, exDividendDate, tradingHaltStartTime, tradingHaltEndTime` | Gives halt windows. Positions can't be opened or closed during them, and open orders are cancelled. |
| **Market session state** | **v3** `GET /api/v3/reality/market/states` | `market: US, daylightType, stateList[{state, timeZone, startTime, endTime}]` (pre 04:00–09:30, regular 09:30–16:00, after 16:00–20:00, overnight 20:00–04:00 ET) | Could replace Kibble's own NYSE clock with Bitget's. |
| **Trading calendar** | **v3** `GET /api/v3/reality/market/calendar` | `timeZone, regularConfig[], specificConfig[{remark,startTime,endTime}]` (holidays, early closes) | Same use. |
| **Per-stock trading hours** | **v3** `GET /api/v3/reality/market/stock-info?symbol=` | `code, name, tradingPeriod[pre_market, regular, after_hours…], weekendTradable: yes\|no` | The doc example uses the rToken symbol `RAAPLUSDT`, so it may cover rToken spot only. Test with and without `symbol`. |
| Fundamentals (Bitget-native) | **v3** `/api/v3/reality/market/company-overview`, `valuation-indicators`, `earnings-forecast`, `dividends`, `inner-trades`, `executive-shareholdings`, `sharehold-detail`, `share-capital-change`, `suspension-resumption-info` (param `code=AAPL`) | P/E, market cap, 52w range, EPS/revenue forecasts, insider trades, suspensions | Public per CCXT (weight 20). A Bitget-native alternative or supplement to EDGAR for the earnings-driven sub-theme. |
| Index composition | **v3** `GET /api/v3/market/index-components?symbol=` | `componentList[{exchange, spotPair, equivalentPrice, weight}]` | Shows which feeds build the index (Pyth/dxFeed per support docs). |
| Instrument classification | **v3** `GET /api/v3/market/instruments?category=USDT-FUTURES` | `symbolType: crypto\|metal\|stock\|commodity`, `isRwa`, `isReality` (spot), `areaSymbol`, `status`, `maintainTime` | **The authoritative way to separate stocks from metals and commodities** (see section 4). |

### 1b. Stock-perp mechanics the pets should know

Sources: Bitget support articles 12560603845668 and 12560603894212.

- **Hours:** marketed as 24/7. The TradFi overview (2026-09-03) says hours "expanded from an initial 5×24h to 24/7 **for some assets**", so check `weekendTradable` and `maintainTime` per symbol rather than assuming.
- **Index price has two modes.** In *external mode* (US market open) it is a weighted average of external feeds every 200 ms. In *internal mode* (daily halts, weekends, holidays) it is advanced by an EMA of **the perp's own order book**: impact notional 2,000 USDT, τ = 300 s, step cap c = 0.1. It switches to internal mode if more than half the sources are stale for over 2 h.
  - This is Kibble's "night shift" premise in Bitget's own words. At night the index stops tracking the share and follows the perp's own order book.
- **Index band:** during closures the internal index can't move more than **±10%** from the last external close (adjustable; shown as "Index Price Protection" on the contract page).
- **Mark clamp:** mark = clamp(calc, index × (1 ± d)). d is typically 3%, but **5% for NVDA, TSLA, AAPL, RDDT, MSFT, META, AMZN, GOOGL, COIN, MSTR, HOOD, CRCL** and others. Liquidation runs on mark.
- **Funding:** usually 8 h (15 of the 324 RWA contracts use 4 h, mostly metals and commodities). Per-symbol caps come from `min/maxFundingRate`.
- **Cash dividends are paid through the funding mechanism.** Longs receive and shorts pay, settled at the after-hours close on T-1 before ex-date. Positions opened on ex-date don't qualify. The record appears in Financial Records as "Cash Dividend Fee" and as `cashDividend` on position endpoints. A pet holding a long should see this as a "treat".
- **Splits / reverse splits / stock dividends:** a special trading halt. Position size and average price are rescaled at the pre-halt mark snapshot, **unfilled orders are auto-cancelled** (this would include exchange TP/SL orders), and funding pauses.
- **Pre-IPO perps** (OPENAI, SpaceX-related SPCX, ANTHROPIC, MOONSHOT): 5–20x typical, 24/7. There is no public share behind them, which matches Kibble's `preIpo` flag.

---

## 2. Demo-trading API: what could move risk enforcement onto the exchange

Setup (classic demo docs): a Demo API key plus the `paptrading: 1` header on REST. Demo WebSocket endpoints are `wss://wspap.bitget.com/v2/ws/public` and `/v2/ws/private`. Classic demo docs publish **no whitelist** of supported endpoints. They say only "use the Demo key + header". UTA (v3) demo is documented as **"Phase 1"**: instruments, tickers and orderbook; assets, settings and setLeverage; place/modify/cancel order, open orders, order history and positions. It explicitly excludes batch orders, plan/trigger orders, copy trading and transfers (per the bitget-go SDK notes citing Bitget's UTA docs). Kibble uses the classic v2 path, which is the right choice for now.

| Capability | Endpoint | Key params | Why it matters for Kibble | Demo status |
|---|---|---|---|---|
| TP/SL attached at entry | `POST /api/v2/mix/order/place-order` (already used) | `presetStopSurplusPrice`, `presetStopLossPrice` (+ `…ExecutePrice`) | **Smallest change:** the exchange holds the stop from the moment of fill | UNTESTED on demo |
| Position-level TP+SL | `POST /api/v2/mix/order/place-pos-tpsl` | `stopLossTriggerPrice`, `stopLossTriggerType: mark_price\|fill_price`, `stopLossExecutePrice` (0 = market), omit size = whole position; `holdSide: buy` in one-way mode | Whole-position stop that follows adds and trims. Trigger on `mark_price` so it matches liquidation logic | UNTESTED |
| Single TP/SL / trailing | `POST /api/v2/mix/order/place-tpsl-order` | `planType: profit_plan\|loss_plan\|moving_plan\|pos_profit\|pos_loss`; `moving_plan` needs `rangeRate` (callback) and executes at market only | Trailing stop = "the pet refuses to give back more than X%" | UNTESTED |
| Modify / cancel TP/SL | `POST /api/v2/mix/order/modify-tpsl-order`, `cancel-plan-order`; list via `GET orders-plan-pending?planType=profit_loss` | | Re-arm after resize, and after split halts that cancel orders | UNTESTED |
| Trigger / trailing entry | `POST /api/v2/mix/order/place-plan-order` | `planType: normal_plan\|track_plan`, `callbackRatio` (track), `triggerType`, `reduceOnly`, optional attached TP/SL | "Buy the dip if it reaches X" while the engine sleeps between 15-min ticks | UNTESTED |
| Reduce-only | `place-order` `reduceOnly: YES` (one-way mode) or `tradeSide: close` (hedge) | | Guarantees trims can't flip or grow a position | Likely works (normal order) |
| Batch | `POST /api/v2/mix/order/batch-place-order` | up to 50 | Minor; one order per pet per tick is fine | UNTESTED |
| Flash close | `POST /api/v2/mix/order/close-positions` | `symbol, productType, holdSide` | Clean "faint" or kill-switch | UNTESTED |
| Isolated margin add/remove | `POST /api/v2/mix/account/set-margin` (`amount` +/-, `holdSide`); `set-auto-margin` | | "Feeding" can literally add isolated margin, moving the liquidation price | UNTESTED |
| Liq price preview | `GET /api/v2/mix/account/liq-price` (private) | | Before a feed/add | UNTESTED |
| **Exchange truth on the open position** | `GET /api/v2/mix/position/single-position` (**already called**) | Response includes `totalFee` (accumulated funding), `cashDividend`, `liquidationPrice`, `breakEvenPrice`, `marginRatio`, `keepMarginRate`, `takeProfitId/stopLossId`, `autoMargin` | **Zero new endpoints:** read funding and dividends back from fields Kibble already receives | Works (already live) |
| Closed-position ledger | `GET /api/v2/mix/position/history-position` | `pnl, netProfit (= pnl + totalFunding + openFee + closeFee), totalFunding, cashDividend, openAvgPrice, closeAvgPrice` (3-month window) | Real realized P&L per pet cycle | UNTESTED on demo |
| Bills (funding/liquidation) | `GET /api/v2/mix/account/bill?productType=USDT-FUTURES&businessType=…` | `contract_settle_fee` (funding), `burst_long_loss_query`, `burst_buy`, `burst_sell` (liquidations), `force_close_long`, `append_margin`, `reduce_margin`, `auto_append_margin`, `open_long`, `close_long`, `buy`, `sell`; `onlyFunding=yes`; 30-day window per call, 90-day history | Closes README's stated gap: "the exchange's own funding debits and liquidations are not read back yet" | UNTESTED. CCXT issue #28041: on a **UTA** demo account this returns 40404 (UTA must use `/api/v3/account/financial-records`). Kibble's v2 orders work, so its demo account is presumably classic and this should be fine. |
| Private WebSocket | `wss://wspap.bitget.com/v2/ws/private`: `positions`, `orders`, `orders-algo` (plan/TP-SL), `positions-history`, `account`, `fill` | | Push-based faint/stop events. Kibble's worker is a 15-min cron, so REST reads per tick are simpler | UNTESTED |

**Demo leverage is lower than live.** Kibble's PLAN.md (9/20) recorded demo max lever **25/25/25/20** for NVDA/TSLA/AAPL/SPCX. Live is **100/100/100/75**, and `pets.ts` hardcodes 100/75. Clamp leverage to the demo contract's `maxLever` before `set-leverage`.

**Suggested demo probe, in order.** Not run. It needs the demo key and must always carry `paptrading: 1`:
1. `place-pos-tpsl` on the existing NVDA position with a far-away SL (for example −50% mark).
2. `orders-plan-pending?planType=profit_loss` to see it.
3. `cancel-plan-order`.
4. `account/bill?businessType=contract_settle_fee`.
5. `history-position`.

If step 1 returns 40xxx, treat exchange-side stops as unavailable on demo and say so in the README.

---

## 3. Bitget AI / agent ecosystem (handbook Chapter V "Developer Toolkit")

The handbook's recommended toolchain for **Agentic Trading** (verbatim structure from `hb_en.md` line 398):
- **Paper (primary):** GetAgent Skill → publish on Playbook → **GetAgent Studio** Paper Trading.
- **Execution layer:** Agent Hub + **Agentic account OAuth**.
- **Perception layer:** `bitget-signal` (crypto macro, sentiment, news) + `bitget-mcp-server` (US data).
- The hint box says `--paper-trading` routes to "Bitget's Demo environment … and produces exactly the paper-trading logs required by the Agentic Trading track". Kibble's demo execution matches this. The two sim pets (OPENAI, RDDT) do not.

| Component | What it is | Relevance to Kibble |
|---|---|---|
| **Bitget Agent Hub** ([github.com/Bitget-AI/agent_hub](https://github.com/Bitget-AI/agent_hub); the handbook links the older BitgetLimited/agent_hub) | Official, MIT-licensed. Packages: `@bitget-ai/bitget-agent-sdk` (TS SDK, **UTA v3**, 89 ops, 14 intent verbs, `readOnly` / `paperTrading` config, `safeInvoke`, `discover`), `bitget-agent-cli` (`bgc`), `bitget-agent-mcp` (stdio MCP; `--paper-trading` adds `paptrading: 1`), `bitget-agent-skill`, installer `npx @bitget-ai/bitget-agent-installer upgrade-all --target all` | **This is the official agent SDK and MCP server.** It is UTA v3 only, and classic accounts must create an Agent sub-account first. UTA demo is "Phase 1", so plan/TP-SL orders may not work there. **Don't migrate execution before the deadline.** Cite it as the reference architecture, or use its read-only `market` verb. |
| **bitget-mcp-server** (`https://agent.bitget.com/mcp`, HTTP, no key) | Read-only US stock/ETF data: quotes, K-lines, fundamentals, earnings calendar, statements, dividends, insider trades, 13F, analyst targets, ETF data, **news & sentiment** | Handbook's US perception layer. It could replace or augment Yahoo/Google RSS and EDGAR with a Bitget-native source. Tool names aren't published; list them with an MCP `tools/list` from Railway. DNS-blocked locally. |
| **bitget-signal** (`npx @bitget-ai/bitget-signal`; public MCP at `https://datahub.noxiaohao.com/mcp`, per Optic's client) | 5 skills: macro-analyst, market-intel, news-briefing, sentiment-analyst, technical-analysis. 19 tools incl. `tradfi_news` (earnings calendar, company news, profiles), `technical_analysis`, `crypto_derivatives`, `derivatives_sentiment`, `macro_indicators`, `rates_yields` | **Verified working for NVDAUSDT on 9/17** (Optic: `crypto_derivatives` ticker cross-check and `technical_analysis` RSI 76.5 / MACD). Optic's client is reusable: `optic-bitget/src/lib/bitget/signal.ts`. The edge rejects Python's default User-Agent. |
| **Agentic Account** (OAuth) | Dedicated agent sub-account: isolated funds, quota control, no withdrawals | Mainly for live trading. Kibble's demo key approach is also accepted ("a regular account with a manual API Key also works", handbook FAQ). |
| **Playbook / GetAgent Studio** (`npx @bitget-ai/getagent-skill@latest install --client agent`; bitget.com/…/playbook; getagent.studio) | NL → strategy → sandbox backtest → publish → Studio paper trading with logs | The handbook's "primary" paper route. Optional: publish a simplified pet rule set for NVDAUSDT as an extra Bitget-native log. Needs a bitget.com login (blocked on this network). |
| **Copy trading API** (`/api/v2/copy/mix-trader/*`, `/mix-follower/*`, v3 `/api/v3/copy/futures/*`) | Elite-trader and follower ops | Not useful here. Not in UTA demo Phase 1. The coming `top-trader-flow` signal in bitget-signal may be interesting later. |
| **Bitget Wallet MCP** (`github.com/bitget-wallet-ai-lab/bitget-wallet-mcp`) | On-chain wallet ops | Not relevant. |
| **Chainbase AgentKey** | Partner data layer, "not an official Bitget product" | Not Bitget-native. |
| **Qwen** (`https://hackathon.bitgetops.com/v1`, `qwen3.8-max`) | Already in use | The handbook lists Cursor and Codex as eligible tools, and says using Qwen "does not affect judging". |

Note: the handbook's Agent Hub install prompt points at `https://www.bitget.careers/support/articles/12560603894122`, while the Agentic Account section uses `https://www.bitget.com/support/articles/12560603894122`. Treat the `.careers` domain with suspicion and use the `bitget.com` link.

---

## 4. Stock-perpetual universe

### 4a. How to recognize stock perps programmatically
- **v2 `contracts`:** `isRwa: "YES"` (Kibble's and Optic's current filter), with `symbolStatus: "normal"`. `symbolType` is always `"perpetual"` in v2, so it doesn't help. **`isRwa` also includes metals, commodities, FX, indices, HK/JP/KR quanto and pre-IPO.**
- **v3 `instruments?category=USDT-FUTURES`:** `symbolType: stock | metal | commodity | crypto` is the authoritative split. `isReality` is spot-only and flags rTokens (symbols like `RAAPLUSDT`, `RMUUSDT`).
- **Naming:** `<TICKER>USDT`. Quanto non-USD names end in `HKDUSDT`. Some collisions carry a `STOCK` suffix (`CVXSTOCKUSDT`, `DIASTOCKUSDT`, `NOKSTOCKUSDT`, `RTXSTOCKUSDT`, `QNTSTOCKUSDT`, `STXSTOCKUSDT`, `BBSTOCKUSDT`) to avoid clashing with crypto tickers.

### 4b. Counts (live snapshot 2026-09-17 13:47 UTC, from Optic cache)
- USDT-FUTURES contracts: **790**. `isRwa=YES`: **324** (all `normal`).
- Heuristic classes (authoritative split = v3 `symbolType`): **US single stocks ~211**, non-US equities (HK/JP/KR/CN incl. HKD quanto) 38, ETFs 25, leveraged/inverse ETFs 26, indices 5 (SP500, NDX100, HSI, JP225, KR200), pre-IPO 4 (OPENAI, SPCX, ANTHROPIC, MOONSHOT), metals 6, commodities 4, FX 3, GPU-compute 2 (B200, H100). **Stock-like total ≈ 309.** Bitget's own academy page (Aug 2026) says "250+ U.S. stock perps".
- Max leverage: 100x × 18, 75x × 3 (SNDK, SPCX, XAUT), 50x × 11, 25x × 4, 20x × 275, 10x × 3, 5x × 10.
- Funding interval: 8h × 309, 4h × 15.
- Liquidity is concentrated. Total RWA 24h volume was ≈ $1.63B, but only **89** contracts traded > $1M and **134** traded < $100k. Kibble's six: SPCX #6 ($96.1M), TSLA #17 ($25.5M), NVDA #19 ($19.3M), AAPL #37 ($5.7M), OPENAI #64 ($1.9M), RDDT #71 ($1.4M; funding −0.139%/8h at snapshot, so longs were being paid).

### 4c. Demo environment
- Known (Kibble PLAN.md, verified 2026-09-20 with `paptrading: 1`): **NVDAUSDT, TSLAUSDT, AAPLUSDT, SPCXUSDT present** (max lever 25/25/25/20, min trade 0.01). **OPENAIUSDT and RDDTUSDT absent.**
- **The full demo count was not verified today (DNS block).** Run section 8 command 2 from Railway to get it.

### 4d. Full table (live, 2026-09-17 snapshot, sorted by 24h USDT volume)
"Class" is a name-based heuristic. OI USDT = `holdingAmount × lastPr`. Funding rate is per interval.

| # | Symbol | Base | Class (heuristic) | Max lev | Fund int (h) | 24h vol USDT (M) | OI USDT (M) | Funding rate | Listed (openTime) | Kibble |
|---:|---|---|---|---:|---:|---:|---:|---:|---|---|
| 1 | XAUUSDT | XAU | metal | 100 | 4 | 289.95 | 55.96 | 0 | 2025-12-12 |  |
| 2 | SOXLUSDT | SOXL | lev/inv ETF | 20 | 8 | 118.50 | 58.91 | 0 | 2026-04-08 |  |
| 3 | XAGUSDT | XAG | metal | 100 | 4 | 112.71 | 21.92 | 0 | 2026-01-07 |  |
| 4 | KORUUSDT | KORU | lev/inv ETF | 20 | 8 | 101.75 | 46.74 | 0 | 2026-06-22 |  |
| 5 | SNDKUSDT | SNDK | US stock | 75 | 8 | 98.85 | 40.93 | 0.000069 | 2026-04-14 |  |
| 6 | SPCXUSDT | SPCX | pre-IPO | 75 | 8 | 96.08 | 31.67 | 0 | 2026-06-09 | Booster (in demo per PLAN.md 9/20) |
| 7 | CLUSDT | CL | commodity | 100 | 4 | 56.20 | 47.45 | 0 | 2026-03-13 |  |
| 8 | SNXXUSDT | SNXX | lev/inv ETF | 20 | 8 | 41.38 | 5.37 | 0.000065 | 2026-07-13 |  |
| 9 | SKHYNIXUSDT | SKHYNIX | non-US equity | 20 | 4 | 41.07 | 22.86 | 0.000617 | 2026-06-02 |  |
| 10 | CRCLUSDT | CRCL | US stock | 25 | 8 | 40.00 | 16.05 | 0.000728 | 2026-02-02 |  |
| 11 | XAUTUSDT | XAUT | metal | 75 | 4 | 37.98 | 30.02 | 0.00005 | 2025-04-03 |  |
| 12 | SKHYUSDT | SKHY | US stock | 20 | 8 | 36.74 | 27.64 | 0 | 2026-07-01 |  |
| 13 | MSTRUSDT | MSTR | US stock | 25 | 8 | 35.97 | 23.46 | 0.000231 | 2026-02-02 |  |
| 14 | BZUSDT | BZ | commodity | 100 | 4 | 31.18 | 34.59 | 0 | 2026-04-01 |  |
| 15 | MUUSDT | MU | US stock | 50 | 8 | 29.34 | 24.47 | 0.000304 | 2026-02-11 |  |
| 16 | PAXGUSDT | PAXG | metal | 50 | 4 | 27.78 | 9.02 | 0.00005 | 2024-06-29 |  |
| 17 | TSLAUSDT | TSLA | US stock | 100 | 8 | 25.54 | 14.79 | 0 | 2026-02-02 | Volt (demo) |
| 18 | SOXSUSDT | SOXS | lev/inv ETF | 20 | 8 | 20.13 | 5.22 | 0 | 2026-04-08 |  |
| 19 | NVDAUSDT | NVDA | US stock | 100 | 8 | 19.31 | 18.82 | 0.000179 | 2026-02-02 | Nova (demo) |
| 20 | INTCUSDT | INTC | US stock | 50 | 8 | 17.63 | 11.53 | 0.000162 | 2026-02-02 |  |
| 21 | DRAMUSDT | DRAM | US stock | 20 | 8 | 17.48 | 23.63 | 0.000041 | 2026-05-08 |  |
| 22 | GTLBUSDT | GTLB | US stock | 20 | 8 | 15.34 | 0.43 | 0.000324 | 2026-09-02 |  |
| 23 | MRVLUSDT | MRVL | US stock | 20 | 8 | 14.41 | 6.13 | 0 | 2026-02-02 |  |
| 24 | HOODUSDT | HOOD | US stock | 20 | 8 | 12.71 | 4.66 | 0.000158 | 2026-02-02 |  |
| 25 | NAVERUSDT | NAVER | non-US equity | 20 | 8 | 12.19 | 0.06 | 0 | 2026-08-14 |  |
| 26 | COINUSDT | COIN | US stock | 20 | 8 | 12.14 | 5.23 | 0.000076 | 2026-02-02 |  |
| 27 | SAMSUNGEMUSDT | SAMSUNGEM | non-US equity | 20 | 8 | 11.47 | 0.22 | 0 | 2026-08-14 |  |
| 28 | HANMIUSDT | HANMI | non-US equity | 20 | 8 | 10.33 | 0.10 | 0 | 2026-08-14 |  |
| 29 | QQQUSDT | QQQ | ETF | 20 | 8 | 9.49 | 15.29 | 0.000287 | 2026-02-02 |  |
| 30 | LGELECTRONICSUSDT | LGELECTRONICS | non-US equity | 20 | 8 | 9.10 | 0.29 | 0 | 2026-08-14 |  |
| 31 | SAMSUNGUSDT | SAMSUNG | non-US equity | 20 | 4 | 8.45 | 1.84 | 0.000768 | 2026-06-02 |  |
| 32 | SPYUSDT | SPY | ETF | 50 | 8 | 7.84 | 12.80 | 0 | 2026-02-11 |  |
| 33 | MSFTUSDT | MSFT | US stock | 100 | 8 | 7.07 | 4.10 | 0 | 2026-02-02 |  |
| 34 | LITEUSDT | LITE | US stock | 20 | 8 | 6.93 | 3.20 | 0 | 2026-04-14 |  |
| 35 | PLTRUSDT | PLTR | US stock | 20 | 8 | 6.54 | 2.84 | 0 | 2026-02-02 |  |
| 36 | CRWVUSDT | CRWV | US stock | 20 | 8 | 6.27 | 1.45 | 0 | 2026-04-27 |  |
| 37 | AAPLUSDT | AAPL | US stock | 100 | 8 | 5.68 | 6.28 | 0 | 2026-02-02 | Pip (demo) |
| 38 | NBISUSDT | NBIS | US stock | 20 | 8 | 5.58 | 1.96 | 0.000011 | 2026-04-21 |  |
| 39 | BEUSDT | BE | US stock | 20 | 8 | 5.13 | 1.89 | 0 | 2026-04-21 |  |
| 40 | GOOGLUSDT | GOOGL | US stock | 100 | 8 | 5.11 | 17.94 | 0 | 2026-02-02 |  |
| 41 | CRDOUSDT | CRDO | US stock | 20 | 8 | 5.02 | 1.37 | 0 | 2026-04-27 |  |
| 42 | METAUSDT | META | US stock | 100 | 8 | 4.84 | 4.23 | 0 | 2026-02-02 |  |
| 43 | CBRSUSDT | CBRS | US stock | 20 | 8 | 4.82 | 2.33 | 0 | 2026-05-14 |  |
| 44 | UNITREEUSDT | UNITREE | non-US equity | 20 | 4 | 4.62 | 1.57 | 0 | 2026-08-19 |  |
| 45 | AAOIUSDT | AAOI | US stock | 20 | 8 | 4.59 | 2.21 | 0.000161 | 2026-04-21 |  |
| 46 | AMZNUSDT | AMZN | US stock | 100 | 8 | 4.38 | 4.11 | 0.00009 | 2026-02-02 |  |
| 47 | ORCLUSDT | ORCL | US stock | 20 | 8 | 4.04 | 6.41 | 0.000042 | 2026-02-02 |  |
| 48 | DELLUSDT | DELL | US stock | 20 | 8 | 3.75 | 4.38 | 0 | 2026-05-29 |  |
| 49 | AMDUSDT | AMD | US stock | 20 | 8 | 3.67 | 2.71 | 0 | 2026-04-14 |  |
| 50 | ARMUSDT | ARM | US stock | 20 | 8 | 3.66 | 1.19 | 0.000086 | 2026-02-02 |  |
| 51 | MRNAUSDT | MRNA | US stock | 20 | 8 | 3.63 | 0.55 | 0 | 2026-08-20 |  |
| 52 | COHRUSDT | COHR | US stock | 20 | 8 | 3.52 | 1.93 | 0 | 2026-04-21 |  |
| 53 | AVGOUSDT | AVGO | US stock | 20 | 8 | 3.51 | 7.56 | 0.000599 | 2026-02-11 |  |
| 54 | ANTHROPICUSDT | ANTHROPIC | pre-IPO | 20 | 8 | 3.49 | 25.28 | 0 | 2026-06-02 |  |
| 55 | RKLBUSDT | RKLB | US stock | 20 | 8 | 3.22 | 4.46 | 0.000344 | 2026-04-08 |  |
| 56 | ZHIPUUSDT | ZHIPU | non-US equity | 20 | 8 | 3.11 | 1.73 | 0 | 2026-06-24 |  |
| 57 | AXTIUSDT | AXTI | US stock | 20 | 8 | 2.79 | 1.36 | 0 | 2026-05-08 |  |
| 58 | EWYUSDT | EWY | ETF | 20 | 8 | 2.70 | 2.93 | 0 | 2026-03-16 |  |
| 59 | USARUSDT | USAR | US stock | 20 | 8 | 2.28 | 0.40 | 0 | 2026-05-08 |  |
| 60 | GPROUSDT | GPRO | US stock | 20 | 8 | 2.27 | 0.33 | 0 | 2026-09-03 |  |
| 61 | FLNCUSDT | FLNC | US stock | 20 | 8 | 2.17 | 0.34 | 0 | 2026-06-16 |  |
| 62 | TQQQUSDT | TQQQ | lev/inv ETF | 20 | 8 | 2.16 | 8.25 | 0.000181 | 2026-03-30 |  |
| 63 | MUUUSDT | MUU | lev/inv ETF | 20 | 8 | 2.06 | 2.70 | 0 | 2026-06-18 |  |
| 64 | OPENAIUSDT | OPENAI | pre-IPO | 20 | 8 | 1.93 | 2.54 | 0 | 2026-05-26 | Nimbus (sim, not in demo) |
| 65 | ZSUSDT | ZS | US stock | 20 | 8 | 1.87 | 0.06 | 0 | 2026-09-02 |  |
| 66 | MINIMAXUSDT | MINIMAX | non-US equity | 20 | 8 | 1.75 | 1.19 | 0.000078 | 2026-06-24 |  |
| 67 | IONQUSDT | IONQ | US stock | 20 | 8 | 1.66 | 1.20 | 0 | 2026-04-21 |  |
| 68 | ZHIPUHKDUSDT | ZHIPUHKD | non-US equity | 20 | 8 | 1.45 | 0.62 | 0 | 2026-07-22 |  |
| 69 | TEAMUSDT | TEAM | US stock | 20 | 8 | 1.41 | 0.05 | 0 | 2026-09-02 |  |
| 70 | BMNRUSDT | BMNR | US stock | 20 | 8 | 1.40 | 1.17 | 0.000086 | 2026-06-16 |  |
| 71 | RDDTUSDT | RDDT | US stock | 20 | 8 | 1.37 | 0.46 | -0.00139 | 2026-02-02 | Lurk (sim, not in demo) |
| 72 | GEUSDT | GE | US stock | 20 | 8 | 1.37 | 0.47 | 0 | 2026-02-02 |  |
| 73 | XPDUSDT | XPD | metal | 100 | 4 | 1.32 | 5.01 | 0.000028 | 2026-01-30 |  |
| 74 | STXSTOCKUSDT | STXSTOCK | US stock | 20 | 8 | 1.28 | 0.34 | 0 | 2026-04-14 |  |
| 75 | GLWUSDT | GLW | US stock | 20 | 8 | 1.28 | 1.69 | 0 | 2026-06-10 |  |
| 76 | ZHONGJIUSDT | ZHONGJI | non-US equity | 20 | 8 | 1.27 | 0.50 | 0.000592 | 2026-08-14 |  |
| 77 | MSTUUSDT | MSTU | lev/inv ETF | 20 | 8 | 1.22 | 1.98 | 0 | 2026-07-06 |  |
| 78 | TSMUSDT | TSM | US stock | 20 | 8 | 1.20 | 2.06 | 0 | 2026-03-02 |  |
| 79 | WDCUSDT | WDC | US stock | 20 | 8 | 1.18 | 1.31 | 0 | 2026-05-18 |  |
| 80 | APLDUSDT | APLD | US stock | 20 | 8 | 1.17 | 0.21 | 0 | 2026-04-27 |  |
| 81 | CSOPSK2LHKDUSDT | CSOPSK2LHKD | non-US equity | 20 | 8 | 1.16 | 0.18 | 0.001247 | 2026-08-12 |  |
| 82 | OKLOUSDT | OKLO | US stock | 20 | 8 | 1.15 | 0.79 | 0 | 2026-04-27 |  |
| 83 | COPPERUSDT | COPPER | commodity | 100 | 4 | 1.15 | 2.00 | 0 | 2026-03-09 |  |
| 84 | LASERTECUSDT | LASERTEC | non-US equity | 20 | 8 | 1.10 | 0.83 | 0 | 2026-06-04 |  |
| 85 | MARAUSDT | MARA | US stock | 20 | 8 | 1.06 | 0.06 | 0 | 2026-08-26 |  |
| 86 | XPTUSDT | XPT | metal | 100 | 4 | 1.06 | 1.21 | 0.000062 | 2026-01-30 |  |
| 87 | KIOXIAUSDT | KIOXIA | non-US equity | 20 | 8 | 1.04 | 1.44 | 0.00005 | 2026-06-04 |  |
| 88 | MVLLUSDT | MVLL | lev/inv ETF | 20 | 8 | 1.03 | 0.72 | 0 | 2026-06-27 |  |
| 89 | AMATUSDT | AMAT | US stock | 20 | 8 | 1.02 | 1.67 | 0 | 2026-04-14 |  |
| 90 | NATGASUSDT | NATGAS | commodity | 100 | 4 | 1.00 | 8.44 | 0.000583 | 2026-04-01 |  |
| 91 | IRENUSDT | IREN | US stock | 20 | 8 | 0.99 | 1.58 | 0 | 2026-06-08 |  |
| 92 | BABAUSDT | BABA | US stock | 20 | 8 | 0.99 | 2.23 | 0 | 2026-02-02 |  |
| 93 | TEMUSDT | TEM | US stock | 20 | 8 | 0.95 | 0.21 | 0 | 2026-08-20 |  |
| 94 | SQQQUSDT | SQQQ | lev/inv ETF | 20 | 8 | 0.94 | 2.96 | 0 | 2026-03-30 |  |
| 95 | FLYUSDT | FLY | US stock | 20 | 8 | 0.94 | 0.23 | 0.001659 | 2026-04-14 |  |
| 96 | PANWUSDT | PANW | US stock | 20 | 8 | 0.93 | 1.33 | 0 | 2026-05-25 |  |
| 97 | QCOMUSDT | QCOM | US stock | 20 | 8 | 0.89 | 1.25 | 0 | 2026-05-18 |  |
| 98 | CXMTUSDT | CXMT | non-US equity | 20 | 8 | 0.85 | 0.66 | 0.000821 | 2026-08-17 |  |
| 99 | SOXXUSDT | SOXX | ETF | 20 | 8 | 0.85 | 3.02 | 0 | 2026-06-29 |  |
| 100 | CSOPSS2LHKDUSDT | CSOPSS2LHKD | non-US equity | 20 | 8 | 0.82 | 0.07 | 0.001887 | 2026-08-12 |  |
| 101 | ASTSUSDT | ASTS | US stock | 20 | 8 | 0.80 | 1.03 | 0 | 2026-05-18 |  |
| 102 | INTWUSDT | INTW | US stock | 20 | 8 | 0.80 | 0.60 | 0 | 2026-07-13 |  |
| 103 | CONLUSDT | CONL | lev/inv ETF | 20 | 8 | 0.75 | 0.29 | 0 | 2026-07-06 |  |
| 104 | DDOGUSDT | DDOG | US stock | 20 | 8 | 0.73 | 0.14 | 0 | 2026-08-10 |  |
| 105 | NDX100USDT | NDX100 | index | 50 | 8 | 0.72 | 3.32 | 0.000543 | 2026-05-21 |  |
| 106 | EWTUSDT | EWT | ETF | 20 | 8 | 0.71 | 1.36 | 0 | 2026-03-24 |  |
| 107 | BAUSDT | BA | US stock | 20 | 8 | 0.68 | 0.24 | 0 | 2026-04-08 |  |
| 108 | NOKSTOCKUSDT | NOKSTOCK | US stock | 20 | 8 | 0.66 | 1.70 | 0 | 2026-05-18 |  |
| 109 | GDXUSDT | GDX | ETF | 20 | 8 | 0.64 | 0.29 | 0 | 2026-08-17 |  |
| 110 | SOFTBANKUSDT | SOFTBANK | non-US equity | 20 | 8 | 0.63 | 0.30 | 0.001312 | 2026-09-07 |  |
| 111 | SUMIELECUSDT | SUMIELEC | non-US equity | 20 | 8 | 0.62 | 0.08 | 0 | 2026-07-07 |  |
| 112 | HSIUSDT | HSI | index | 20 | 8 | 0.62 | 0.05 | 0 | 2026-08-26 |  |
| 113 | COPUSDT | COP | US stock | 50 | 8 | 0.61 | 0.17 | 0 | 2026-03-10 |  |
| 114 | VSTUSDT | VST | US stock | 20 | 8 | 0.55 | 1.25 | 0 | 2026-08-03 |  |
| 115 | NETUSDT | NET | US stock | 20 | 8 | 0.54 | 0.43 | 0 | 2026-08-17 |  |
| 116 | SKUUUSDT | SKUU | lev/inv ETF | 20 | 8 | 0.53 | 0.53 | 0 | 2026-07-28 |  |
| 117 | HYUNDAIUSDT | HYUNDAI | non-US equity | 20 | 4 | 0.51 | 1.06 | 0 | 2026-06-02 |  |
| 118 | UVXYUSDT | UVXY | lev/inv ETF | 20 | 8 | 0.49 | 1.14 | 0 | 2026-06-16 |  |
| 119 | BNCUSDT | BNC | US stock | 5 | 8 | 0.49 | 0.98 | 0.000935 | 2026-07-06 |  |
| 120 | AEHRUSDT | AEHR | US stock | 20 | 8 | 0.49 | 0.37 | 0 | 2026-06-10 |  |
| 121 | MPUSDT | MP | US stock | 20 | 8 | 0.48 | 0.17 | 0 | 2026-04-27 |  |
| 122 | XIAOMIHKDUSDT | XIAOMIHKD | non-US equity | 20 | 8 | 0.47 | 0.79 | 0 | 2026-07-22 |  |
| 123 | MINIMAXHKDUSDT | MINIMAXHKD | non-US equity | 20 | 8 | 0.46 | 0.41 | 0 | 2026-07-21 |  |
| 124 | FUTUUSDT | FUTU | US stock | 20 | 8 | 0.46 | 0.48 | 0 | 2026-02-02 |  |
| 125 | TOKYOELUSDT | TOKYOEL | non-US equity | 20 | 8 | 0.45 | 0.45 | 0 | 2026-06-04 |  |
| 126 | RAMUSDT | RAM | US stock | 20 | 8 | 0.44 | 0.57 | 0 | 2026-06-25 |  |
| 127 | PURRUSDT | PURR | US stock | 20 | 8 | 0.43 | 0.10 | 0 | 2026-08-26 |  |
| 128 | USDJPYUSDT | USDJPY | fx | 100 | 8 | 0.42 | 0.37 | 0 | 2026-09-09 |  |
| 129 | KWEBUSDT | KWEB | ETF | 25 | 8 | 0.42 | 0.46 | 0 | 2026-03-24 |  |
| 130 | NOWUSDT | NOW | US stock | 20 | 8 | 0.39 | 0.63 | 0 | 2026-06-01 |  |
| 131 | IBMUSDT | IBM | US stock | 20 | 8 | 0.38 | 0.93 | 0 | 2026-06-01 |  |
| 132 | SP500USDT | SP500 | index | 50 | 8 | 0.38 | 7.13 | 0 | 2026-05-21 |  |
| 133 | ETNUSDT | ETN | US stock | 20 | 8 | 0.37 | 0.71 | -0.005851 | 2026-05-12 |  |
| 134 | NVDLUSDT | NVDL | lev/inv ETF | 20 | 8 | 0.36 | 0.16 | 0 | 2026-07-20 |  |
| 135 | CIENUSDT | CIEN | US stock | 20 | 8 | 0.36 | 0.18 | 0 | 2026-06-08 |  |
| 136 | HPEUSDT | HPE | US stock | 20 | 8 | 0.35 | 0.69 | 0 | 2026-06-08 |  |
| 137 | HPQUSDT | HPQ | US stock | 20 | 8 | 0.34 | 0.05 | -0.005343 | 2026-08-27 |  |
| 138 | GMEUSDT | GME | US stock | 20 | 8 | 0.34 | 0.36 | 0 | 2026-02-02 |  |
| 139 | SKDDUSDT | SKDD | lev/inv ETF | 20 | 8 | 0.33 | 0.33 | -0.000136 | 2026-07-28 |  |
| 140 | SMCIUSDT | SMCI | US stock | 20 | 8 | 0.33 | 1.35 | 0 | 2026-05-18 |  |
| 141 | JP225USDT | JP225 | index | 20 | 8 | 0.32 | 0.09 | 0 | 2026-08-24 |  |
| 142 | EWJUSDT | EWJ | ETF | 20 | 8 | 0.31 | 0.64 | 0 | 2026-03-16 |  |
| 143 | MCDUSDT | MCD | US stock | 20 | 8 | 0.29 | 1.96 | 0.000293 | 2026-02-02 |  |
| 144 | ASMLUSDT | ASML | US stock | 20 | 8 | 0.28 | 1.03 | 0 | 2026-02-02 |  |
| 145 | ADVANTESTUSDT | ADVANTEST | non-US equity | 20 | 8 | 0.28 | 0.16 | 0 | 2026-06-04 |  |
| 146 | SMRUSDT | SMR | US stock | 20 | 8 | 0.28 | 0.19 | 0 | 2026-06-04 |  |
| 147 | VRTUSDT | VRT | US stock | 20 | 8 | 0.26 | 0.39 | 0 | 2026-05-12 |  |
| 148 | ONDSUSDT | ONDS | US stock | 20 | 8 | 0.25 | 0.77 | 0 | 2026-05-18 |  |
| 149 | XOMUSDT | XOM | US stock | 50 | 8 | 0.25 | 0.21 | 0 | 2026-03-10 |  |
| 150 | ABNBUSDT | ABNB | US stock | 20 | 8 | 0.24 | 0.08 | 0 | 2026-06-15 |  |
| 151 | AXONUSDT | AXON | US stock | 20 | 8 | 0.24 | 0.37 | 0 | 2026-06-01 |  |
| 152 | AMCUSDT | AMC | US stock | 20 | 8 | 0.23 | 0.16 | 0 | 2026-06-08 |  |
| 153 | NFLXUSDT | NFLX | US stock | 50 | 8 | 0.22 | 1.63 | 0 | 2026-04-08 |  |
| 154 | APPUSDT | APP | US stock | 20 | 8 | 0.22 | 0.60 | 0 | 2026-02-02 |  |
| 155 | SHAZUSDT | SHAZ | US stock | 20 | 8 | 0.21 | 0.12 | 0 | 2026-07-22 |  |
| 156 | ALABUSDT | ALAB | US stock | 20 | 8 | 0.21 | 0.26 | 0.000023 | 2026-06-18 |  |
| 157 | OXYUSDT | OXY | US stock | 50 | 8 | 0.20 | 0.13 | 0 | 2026-03-10 |  |
| 158 | TSLLUSDT | TSLL | lev/inv ETF | 20 | 8 | 0.20 | 0.15 | 0 | 2026-07-20 |  |
| 159 | DKNGUSDT | DKNG | US stock | 20 | 8 | 0.19 | 0.15 | 0 | 2026-06-15 |  |
| 160 | LYTEUSDT | LYTE | US stock | 20 | 8 | 0.19 | 0.10 | 0 | 2026-08-17 |  |
| 161 | WMTUSDT | WMT | US stock | 50 | 8 | 0.19 | 0.59 | 0 | 2026-03-02 |  |
| 162 | JOBYUSDT | JOBY | US stock | 20 | 8 | 0.19 | 0.17 | 0 | 2026-05-25 |  |
| 163 | ANETUSDT | ANET | US stock | 20 | 8 | 0.18 | 0.08 | 0 | 2026-08-13 |  |
| 164 | TENCENTUSDT | TENCENT | non-US equity | 20 | 8 | 0.18 | 1.58 | 0 | 2026-07-01 |  |
| 165 | TENCENTHKDUSDT | TENCENTHKD | non-US equity | 20 | 8 | 0.17 | 0.39 | 0 | 2026-07-22 |  |
| 166 | MOONSHOTUSDT | MOONSHOT | pre-IPO | 10 | 8 | 0.17 | 0.90 | 0 | 2026-08-07 |  |
| 167 | KR200USDT | KR200 | index | 20 | 4 | 0.16 | 0.07 | 0.000282 | 2026-08-14 |  |
| 168 | DJTUSDT | DJT | US stock | 20 | 8 | 0.16 | 0.07 | 0 | 2026-08-25 |  |
| 169 | LLYUSDT | LLY | US stock | 20 | 8 | 0.15 | 2.24 | 0 | 2026-02-02 |  |
| 170 | KOUSDT | KO | US stock | 20 | 8 | 0.15 | 0.54 | 0 | 2026-06-15 |  |
| 171 | SPCHUSDT | SPCH | US stock | 20 | 8 | 0.15 | 0.29 | 0 | 2026-08-04 |  |
| 172 | NKEUSDT | NKE | US stock | 20 | 8 | 0.15 | 0.91 | 0.003363 | 2026-06-15 |  |
| 173 | GIGADEVICEUSDT | GIGADEVICE | non-US equity | 5 | 8 | 0.15 | 0.35 | 0 | 2026-07-01 |  |
| 174 | CRWDUSDT | CRWD | US stock | 20 | 8 | 0.15 | 0.94 | 0 | 2026-07-06 |  |
| 175 | FWDIUSDT | FWDI | US stock | 5 | 8 | 0.14 | 0.31 | 0 | 2026-07-06 |  |
| 176 | UNHUSDT | UNH | US stock | 20 | 8 | 0.14 | 0.21 | 0 | 2026-02-02 |  |
| 177 | XIAOMIUSDT | XIAOMI | non-US equity | 5 | 8 | 0.14 | 0.81 | 0 | 2026-07-01 |  |
| 178 | SMICUSDT | SMIC | non-US equity | 5 | 8 | 0.14 | 0.40 | 0 | 2026-07-01 |  |
| 179 | TMFUSDT | TMF | lev/inv ETF | 20 | 8 | 0.13 | 0.24 | 0 | 2026-07-28 |  |
| 180 | UBERUSDT | UBER | US stock | 20 | 8 | 0.13 | 0.33 | 0 | 2026-08-10 |  |
| 181 | BYDUSDT | BYD | non-US equity | 20 | 8 | 0.13 | 0.06 | 0 | 2026-09-07 |  |
| 182 | GEVUSDT | GEV | US stock | 20 | 8 | 0.12 | 0.64 | 0 | 2026-06-22 |  |
| 183 | SHEINUSDT | SHEIN | non-US equity | 20 | 8 | 0.12 | 0.26 | 0 | 2026-08-27 |  |
| 184 | QNTSTOCKUSDT | QNTSTOCK | US stock | 5 | 8 | 0.12 | 0.22 | 0 | 2026-05-29 |  |
| 185 | QBTSUSDT | QBTS | US stock | 20 | 8 | 0.12 | 0.06 | 0 | 2026-05-25 |  |
| 186 | COSTUSDT | COST | US stock | 25 | 8 | 0.11 | 0.43 | 0 | 2026-03-02 |  |
| 187 | OKTAUSDT | OKTA | US stock | 20 | 8 | 0.11 | 0.12 | 0 | 2026-08-28 |  |
| 188 | MDBUSDT | MDB | US stock | 20 | 8 | 0.11 | 0.12 | 0 | 2026-06-08 |  |
| 189 | KUAISHOUUSDT | KUAISHOU | non-US equity | 5 | 8 | 0.10 | 0.46 | 0 | 2026-07-13 |  |
| 190 | ADBEUSDT | ADBE | US stock | 20 | 8 | 0.10 | 0.50 | 0 | 2026-06-08 |  |
| 191 | TSEMUSDT | TSEM | US stock | 20 | 8 | 0.10 | 0.10 | 0 | 2026-06-10 |  |
| 192 | ACHRUSDT | ACHR | US stock | 20 | 8 | 0.10 | 0.17 | 0 | 2026-05-25 |  |
| 193 | CSCOUSDT | CSCO | US stock | 20 | 8 | 0.09 | 0.22 | 0 | 2026-05-18 |  |
| 194 | MEITUANUSDT | MEITUAN | non-US equity | 5 | 8 | 0.09 | 0.31 | 0 | 2026-07-01 |  |
| 195 | LRCXUSDT | LRCX | US stock | 20 | 8 | 0.09 | 0.35 | 0 | 2026-06-18 |  |
| 196 | MSFUUSDT | MSFU | lev/inv ETF | 20 | 8 | 0.09 | 0.08 | 0 | 2026-07-20 |  |
| 197 | JDUSDT | JD | US stock | 20 | 8 | 0.09 | 0.53 | 0 | 2026-02-02 |  |
| 198 | PYPLUSDT | PYPL | US stock | 20 | 8 | 0.09 | 0.08 | 0 | 2026-08-03 |  |
| 199 | KLACUSDT | KLAC | US stock | 20 | 8 | 0.09 | 0.21 | 0 | 2026-06-22 |  |
| 200 | SNOWUSDT | SNOW | US stock | 20 | 8 | 0.09 | 0.21 | 0 | 2026-05-28 |  |
| 201 | RCATUSDT | RCAT | US stock | 20 | 8 | 0.09 | 0.04 | 0 | 2026-06-01 |  |
| 202 | SSPCUSDT | SSPC | US stock | 20 | 8 | 0.08 | 0.05 | 0 | 2026-08-04 |  |
| 203 | AVAVUSDT | AVAV | US stock | 20 | 8 | 0.08 | 0.27 | 0 | 2026-06-01 |  |
| 204 | SMHUSDT | SMH | ETF | 20 | 8 | 0.08 | 0.57 | 0.000115 | 2026-06-16 |  |
| 205 | LENOVOHKDUSDT | LENOVOHKD | non-US equity | 20 | 8 | 0.08 | 0.11 | 0 | 2026-08-14 |  |
| 206 | INDAUSDT | INDA | ETF | 20 | 8 | 0.08 | 0.25 | 0 | 2026-04-08 |  |
| 207 | CPNGUSDT | CPNG | US stock | 20 | 8 | 0.08 | 0.16 | 0 | 2026-07-16 |  |
| 208 | BOTUSDT | BOT | US stock | 5 | 8 | 0.08 | 0.30 | 0.00044 | 2026-07-13 |  |
| 209 | AMZUUSDT | AMZU | lev/inv ETF | 20 | 8 | 0.08 | 0.05 | 0 | 2026-07-20 |  |
| 210 | STRCUSDT | STRC | US stock | 20 | 8 | 0.08 | 4.21 | 0 | 2026-06-23 |  |
| 211 | CRMUSDT | CRM | US stock | 20 | 8 | 0.08 | 0.39 | 0 | 2026-06-29 |  |
| 212 | PDDUSDT | PDD | US stock | 20 | 8 | 0.07 | 0.81 | 0 | 2026-06-29 |  |
| 213 | SOFIUSDT | SOFI | US stock | 20 | 8 | 0.07 | 0.30 | 0 | 2026-07-22 |  |
| 214 | KSTRUSDT | KSTR | US stock | 20 | 8 | 0.07 | 0.57 | 0 | 2026-07-06 |  |
| 215 | OUSTUSDT | OUST | US stock | 20 | 8 | 0.07 | 0.24 | 0 | 2026-05-18 |  |
| 216 | RGTIUSDT | RGTI | US stock | 20 | 8 | 0.07 | 0.22 | 0 | 2026-05-25 |  |
| 217 | RDWUSDT | RDW | US stock | 20 | 8 | 0.07 | 0.34 | 0 | 2026-05-18 |  |
| 218 | AMKRUSDT | AMKR | US stock | 20 | 8 | 0.06 | 0.16 | 0 | 2026-06-29 |  |
| 219 | TZAUSDT | TZA | lev/inv ETF | 20 | 8 | 0.06 | 0.13 | 0 | 2026-07-20 |  |
| 220 | SHEINHKDUSDT | SHEINHKD | non-US equity | 20 | 8 | 0.06 | 0.15 | 0 | 2026-09-01 |  |
| 221 | TWLOUSDT | TWLO | US stock | 20 | 8 | 0.06 | 0.07 | 0 | 2026-06-08 |  |
| 222 | CVXSTOCKUSDT | CVXSTOCK | US stock | 20 | 8 | 0.06 | 0.05 | 0 | 2026-09-15 |  |
| 223 | ISRGUSDT | ISRG | US stock | 20 | 8 | 0.06 | 0.08 | 0 | 2026-06-16 |  |
| 224 | GSUSDT | GS | US stock | 20 | 8 | 0.06 | 0.16 | 0 | 2026-06-22 |  |
| 225 | GGLLUSDT | GGLL | lev/inv ETF | 20 | 8 | 0.06 | 0.20 | 0 | 2026-07-20 |  |
| 226 | APDUSDT | APD | US stock | 20 | 8 | 0.05 | 0.11 | 0 | 2026-06-22 |  |
| 227 | TERUSDT | TER | US stock | 20 | 8 | 0.05 | 0.16 | 0.000378 | 2026-06-18 |  |
| 228 | BACUSDT | BAC | US stock | 20 | 8 | 0.05 | 0.30 | 0 | 2026-06-29 |  |
| 229 | EURUSDUSDT | EURUSD | fx | 100 | 8 | 0.05 | 0.20 | 0 | 2026-09-09 |  |
| 230 | MELIUSDT | MELI | US stock | 20 | 8 | 0.05 | 0.13 | 0 | 2026-08-10 |  |
| 231 | CATUSDT | CAT | US stock | 20 | 8 | 0.05 | 0.37 | 0 | 2026-06-22 |  |
| 232 | TTWOUSDT | TTWO | US stock | 20 | 8 | 0.05 | 0.75 | 0 | 2026-07-06 |  |
| 233 | PEPUSDT | PEP | US stock | 20 | 8 | 0.05 | 0.20 | 0 | 2026-08-04 |  |
| 234 | TXNUSDT | TXN | US stock | 20 | 8 | 0.05 | 0.11 | 0 | 2026-06-29 |  |
| 235 | DEUSDT | DE | US stock | 20 | 8 | 0.05 | 0.01 | 0 | 2026-08-24 |  |
| 236 | BSPUSDT | BSP | US stock | 20 | 8 | 0.05 | 0.12 | 0 | 2026-07-06 |  |
| 237 | BRKBUSDT | BRKB | US stock | 20 | 8 | 0.05 | 0.31 | 0 | 2026-05-25 |  |
| 238 | KTOSUSDT | KTOS | US stock | 20 | 8 | 0.04 | 0.26 | 0 | 2026-06-01 |  |
| 239 | BXUSDT | BX | US stock | 20 | 8 | 0.04 | 1.40 | 0 | 2026-06-08 |  |
| 240 | NIOUSDT | NIO | US stock | 20 | 8 | 0.04 | 1.21 | 0 | 2026-05-08 |  |
| 241 | FCXUSDT | FCX | US stock | 20 | 8 | 0.04 | 0.04 | 0 | 2026-09-09 |  |
| 242 | DOOSENERUSDT | DOOSENER | non-US equity | 20 | 8 | 0.04 | 0.07 | 0 | 2026-06-04 |  |
| 243 | SITMUSDT | SITM | US stock | 20 | 8 | 0.04 | 0.08 | 0 | 2026-06-04 |  |
| 244 | POPMARTUSDT | POPMART | non-US equity | 20 | 8 | 0.04 | 0.45 | 0 | 2026-07-01 |  |
| 245 | LINUSDT | LIN | US stock | 20 | 8 | 0.04 | 0.06 | 0 | 2026-06-22 |  |
| 246 | MRKUSDT | MRK | US stock | 20 | 8 | 0.04 | 0.12 | 0 | 2026-08-20 |  |
| 247 | POETUSDT | POET | US stock | 20 | 8 | 0.04 | 0.27 | 0 | 2026-05-18 |  |
| 248 | FOXAUSDT | FOXA | US stock | 20 | 8 | 0.04 | 0.07 | 0 | 2026-06-15 |  |
| 249 | AMGNUSDT | AMGN | US stock | 20 | 8 | 0.04 | 0.06 | 0 | 2026-08-03 |  |
| 250 | INFQUSDT | INFQ | US stock | 20 | 8 | 0.04 | 0.10 | 0 | 2026-05-12 |  |
| 251 | PENGUSDT | PENG | US stock | 20 | 8 | 0.04 | 0.02 | 0 | 2026-07-22 |  |
| 252 | CCLUSDT | CCL | US stock | 20 | 8 | 0.04 | 0.34 | 0 | 2026-06-15 |  |
| 253 | VOOUSDT | VOO | ETF | 20 | 8 | 0.04 | 0.14 | 0 | 2026-06-29 |  |
| 254 | IWMUSDT | IWM | ETF | 20 | 8 | 0.04 | 0.45 | 0 | 2026-06-08 |  |
| 255 | DFENUSDT | DFEN | lev/inv ETF | 20 | 8 | 0.04 | 0.51 | 0 | 2026-06-01 |  |
| 256 | BITOUSDT | BITO | ETF | 20 | 8 | 0.04 | 0.27 | 0 | 2026-07-28 |  |
| 257 | SATLUSDT | SATL | US stock | 20 | 8 | 0.04 | 0.11 | 0 | 2026-06-08 |  |
| 258 | METUUSDT | METU | lev/inv ETF | 20 | 8 | 0.03 | 0.10 | 0 | 2026-07-20 |  |
| 259 | DOOSBOTUSDT | DOOSBOT | non-US equity | 20 | 8 | 0.03 | 0.06 | 0 | 2026-06-04 |  |
| 260 | ASXUSDT | ASX | US stock | 20 | 8 | 0.03 | 0.04 | 0 | 2026-06-29 |  |
| 261 | RIOUSDT | RIO | US stock | 20 | 8 | 0.03 | 0.10 | 0 | 2026-09-09 |  |
| 262 | LWLGUSDT | LWLG | US stock | 20 | 8 | 0.03 | 0.03 | 0 | 2026-05-08 |  |
| 263 | ROKUSDT | ROK | US stock | 20 | 8 | 0.03 | 0.05 | 0 | 2026-06-16 |  |
| 264 | ARQQUSDT | ARQQ | US stock | 20 | 8 | 0.03 | 0.06 | 0 | 2026-05-25 |  |
| 265 | GFSUSDT | GFS | US stock | 20 | 8 | 0.03 | 0.03 | 0 | 2026-08-04 |  |
| 266 | AAPUUSDT | AAPU | lev/inv ETF | 20 | 8 | 0.03 | 0.14 | 0 | 2026-07-20 |  |
| 267 | VUSDT | V | US stock | 20 | 8 | 0.03 | 0.13 | 0 | 2026-06-15 |  |
| 268 | MARUSDT | MAR | US stock | 20 | 8 | 0.03 | 0.12 | 0 | 2026-06-15 |  |
| 269 | OSSUSDT | OSS | US stock | 20 | 8 | 0.02 | 0.13 | 0 | 2026-06-10 |  |
| 270 | EWHUSDT | EWH | ETF | 20 | 8 | 0.02 | 0.05 | 0 | 2026-04-08 |  |
| 271 | EWZUSDT | EWZ | ETF | 20 | 8 | 0.02 | 0.05 | 0 | 2026-08-03 |  |
| 272 | XLEUSDT | XLE | ETF | 20 | 8 | 0.02 | 0.07 | 0 | 2026-08-03 |  |
| 273 | MUFGUSDT | MUFG | US stock | 20 | 8 | 0.02 | 0.01 | 0 | 2026-07-16 |  |
| 274 | RTXSTOCKUSDT | RTXSTOCK | US stock | 20 | 8 | 0.02 | 0.14 | 0 | 2026-06-01 |  |
| 275 | EVEXUSDT | EVEX | US stock | 20 | 8 | 0.02 | 0.09 | 0 | 2026-06-01 |  |
| 276 | XBIUSDT | XBI | ETF | 20 | 8 | 0.02 | 0.11 | 0 | 2026-07-13 |  |
| 277 | DXYZUSDT | DXYZ | US stock | 20 | 8 | 0.02 | 0.14 | 0 | 2026-06-08 |  |
| 278 | NETEASEUSDT | NETEASE | non-US equity | 5 | 8 | 0.02 | 0.04 | 0 | 2026-07-01 |  |
| 279 | AALUSDT | AAL | US stock | 20 | 8 | 0.02 | 0.13 | 0 | 2026-06-29 |  |
| 280 | GBPUSDUSDT | GBPUSD | fx | 100 | 8 | 0.02 | 0.01 | 0 | 2026-09-09 |  |
| 281 | WENUSDT | WEN | US stock | 20 | 8 | 0.02 | 0.10 | 0 | 2026-06-29 |  |
| 282 | VEEVUSDT | VEEV | US stock | 20 | 8 | 0.02 | 0.01 | 0 | 2026-08-28 |  |
| 283 | SHOPUSDT | SHOP | US stock | 20 | 8 | 0.02 | 0.26 | 0 | 2026-08-03 |  |
| 284 | JPMUSDT | JPM | US stock | 20 | 8 | 0.02 | 0.21 | 0 | 2026-06-22 |  |
| 285 | LMTUSDT | LMT | US stock | 20 | 8 | 0.02 | 0.06 | 0 | 2026-06-01 |  |
| 286 | FLEXUSDT | FLEX | US stock | 20 | 8 | 0.02 | 0.22 | 0 | 2026-06-22 |  |
| 287 | ECHOUSDT | ECHO | US stock | 20 | 8 | 0.02 | 0.06 | -0.000717 | 2026-07-06 |  |
| 288 | SPIRUSDT | SPIR | US stock | 20 | 8 | 0.01 | 0.01 | 0 | 2026-06-08 |  |
| 289 | NTAPUSDT | NTAP | US stock | 20 | 8 | 0.01 | 0.01 | 0 | 2026-06-01 |  |
| 290 | ADIUSDT | ADI | US stock | 20 | 8 | 0.01 | 0.07 | 0.000096 | 2026-06-22 |  |
| 291 | SONYUSDT | SONY | US stock | 20 | 8 | 0.01 | 0.21 | 0 | 2026-06-24 |  |
| 292 | KOPNUSDT | KOPN | US stock | 20 | 8 | 0.01 | 0.02 | 0 | 2026-05-08 |  |
| 293 | VALEUSDT | VALE | US stock | 20 | 8 | 0.01 | 0.03 | 0 | 2026-09-09 |  |
| 294 | EUVUSDT | EUV | US stock | 20 | 8 | 0.01 | 0.11 | 0.000224 | 2026-07-06 |  |
| 295 | XNDUUSDT | XNDU | lev/inv ETF | 20 | 8 | 0.01 | 0.04 | 0 | 2026-06-18 |  |
| 296 | BBSTOCKUSDT | BBSTOCK | US stock | 20 | 8 | 0.01 | 0.03 | 0 | 2026-06-04 |  |
| 297 | CMCSAUSDT | CMCSA | US stock | 20 | 8 | 0.01 | 0.04 | 0 | 2026-06-15 |  |
| 298 | SIMOUSDT | SIMO | US stock | 20 | 8 | 0.01 | 0.03 | 0 | 2026-06-10 |  |
| 299 | QUBTUSDT | QUBT | US stock | 20 | 8 | 0.01 | 0.06 | 0 | 2026-05-25 |  |
| 300 | PLUSDT | PL | US stock | 20 | 8 | 0.01 | 0.08 | 0 | 2026-06-08 |  |
| 301 | BUDUSDT | BUD | US stock | 20 | 8 | 0.01 | 0.13 | 0 | 2026-06-15 |  |
| 302 | NVSUSDT | NVS | US stock | 20 | 8 | 0.01 | 0.05 | 0 | 2026-09-02 |  |
| 303 | XLUUSDT | XLU | ETF | 20 | 8 | 0.01 | 0.38 | 0 | 2026-06-16 |  |
| 304 | XLVUSDT | XLV | ETF | 20 | 8 | 0.01 | 0.07 | 0 | 2026-07-28 |  |
| 305 | DISKUSDT | DISK | US stock | 20 | 8 | 0.01 | 0.01 | 0 | 2026-07-06 |  |
| 306 | DIASTOCKUSDT | DIASTOCK | ETF | 20 | 8 | 0.01 | 0.13 | 0 | 2026-07-06 |  |
| 307 | CGNXUSDT | CGNX | US stock | 20 | 8 | 0.01 | 0.04 | 0 | 2026-06-16 |  |
| 308 | NOCUSDT | NOC | US stock | 20 | 8 | 0.01 | 0.06 | 0 | 2026-06-01 |  |
| 309 | JMKEUSDT | JMKE | US stock | 20 | 8 | 0.01 | 0.00 | -0.006152 | 2026-07-30 |  |
| 310 | ZMUSDT | ZM | US stock | 20 | 8 | 0.01 | 0.03 | 0 | 2026-08-03 |  |
| 311 | BKNGUSDT | BKNG | US stock | 20 | 8 | 0.01 | 0.12 | 0 | 2026-08-04 |  |
| 312 | GILDUSDT | GILD | US stock | 20 | 8 | 0.01 | 0.08 | 0 | 2026-07-28 |  |
| 313 | IBITUSDT | IBIT | ETF | 20 | 8 | 0.01 | 0.00 | 0 | 2026-09-17 |  |
| 314 | SGOVUSDT | SGOV | ETF | 20 | 8 | 0.01 | 0.01 | 0 | 2026-06-16 |  |
| 315 | XLKUSDT | XLK | ETF | 20 | 8 | 0.01 | 0.01 | 0 | 2026-06-16 |  |
| 316 | IBBUSDT | IBB | ETF | 20 | 8 | 0.01 | 0.02 | 0 | 2026-07-28 |  |
| 317 | CLSKUSDT | CLSK | US stock | 20 | 8 | 0.00 | 0.00 | 0 | 2026-09-17 |  |
| 318 | BHPUSDT | BHP | US stock | 20 | 8 | 0.00 | 0.01 | 0 | 2026-09-09 |  |
| 319 | TBTUSDT | TBT | lev/inv ETF | 20 | 8 | 0.00 | 0.01 | 0 | 2026-07-28 |  |
| 320 | TMUSDT | TM | US stock | 20 | 8 | 0.00 | 0.02 | 0 | 2026-07-16 |  |
| 321 | H100USDT | H100 | GPU-compute? | 10 | 8 | 0.00 | 0.04 | 0 | 2026-09-08 |  |
| 322 | B200USDT | B200 | GPU-compute? | 10 | 8 | 0.00 | 0.18 | 0 | 2026-09-08 |  |
| 323 | BOTZUSDT | BOTZ | ETF | 20 | 8 | 0.00 | 0.01 | 0 | 2026-07-28 |  |
| 324 | QLDUSDT | QLD | lev/inv ETF | 20 | 8 | 0.00 | 0.00 | 0 | 2026-09-17 |  |

---

## 5. rToken spot vs stock perps: what matters for an agent holding stock exposure

| | rToken spot (Reality) | Stock perp (USDT-M) |
|---|---|---|
| What it is | Token issued by **Reality Protocol**, 1:1 backed by shares custodied via Alpaca Securities. Symbols `R<TICKER>USDT` (e.g. `RAAPLUSDT`). 600+ tokens (Bitget academy, Aug 2026) | Derivative that tracks an index. No ownership. 250+ US names |
| Access via API | **UTA (v3) only.** `isReality` flag in v3 instruments; tickers and candles are public. **Order book, fills and order placement are whitelist-only** (`/api/v3/trade/place-reality-order`, `/api/v3/account/reality-orderbook`). No modify, no batch, no WebSocket orders (Reality Trading Guide) | Classic v2 mix and UTA v3. Fully public market data. Kibble already trades it on demo |
| Hours | Trades 24/7 on Bitget. Mint/redeem 24×5 with stablecoins | 24/7 (some names 5×24; check `weekendTradable`) |
| Leverage / shorting | None (spot); margin loans on some | 1–100x, long or short |
| Carry | None. **Dividends credited in USDT** automatically | **Funding every 4/8h.** Dividends arrive as a funding-style transfer (longs receive at T-1 after-hours close) |
| Liquidation | None | Yes, on mark, with ±3–5% mark clamp and ±10% closure index band |
| Corporate actions | Splits handled automatically | Special halt: orders cancelled, position rescaled |
| Candle caveats | rToken candles: `market` type only; intervals 1m/5m/15m/1H/4H/1D; volume empty before 2026-07-09 | Full candle set, plus index and mark candles |
| Demo | Not available (whitelist + UTA) | Available for listed demo symbols |

**Implications for Kibble:**
1. The perp is the right instrument for "a pet that can faint". rToken spot can't be liquidated and pays no funding, so it would remove the "hunger" mechanic.
2. rToken prices during US hours route to the real US order book, so an rToken ticker (for example `RNVDAUSDT`, if listed) is a cleaner "cash share" reference than Yahoo. Tickers are public. Test symbol availability first.
3. The index can drift away from the real share when US markets are closed. A pet reasoning at night should say "my index is Bitget's EMA of its own book, capped at ±10% from Friday's close", not "NVDA is at X".
4. Delta-neutral rToken-long / perp-short (Bitget's "Strategy 1") is a natural Cross-Asset sub-theme idea, but it isn't feasible on demo.

---

## 6. Ranked recommendations (impact on judging vs effort, deadline-aware)

Judging for Track 2 is 50% quantitative (paper Sharpe, max drawdown, win rate) and 50% judges (decision explainability, agent architecture quality, risk-control layer effectiveness).

| Rank | Integration | Impact | Effort | Notes |
|---:|---|---|---|---|
| 1 | **Read exchange truth back:** use `totalFee`, `cashDividend`, `liquidationPrice`, `breakEvenPrice` and `marginRatio` from `single-position` (already fetched), plus `account/bill?businessType=contract_settle_fee` and `history-position` for the 3 demo pets | High: closes the README's own admitted gap; makes funding ("hunger") Bitget's number, not the engine's | Low (fields exist; 2 GETs) | Log both engine and exchange values, and their difference, per row |
| 2 | **Exchange-enforced stop-loss:** `presetStopLossPrice` on the opening `place-order`, or `place-pos-tpsl` with `stopLossTriggerType=mark_price`; re-arm with `modify-tpsl-order` after adds and trims | High for "risk-control layer effectiveness": the stop lives on Bitget even if the 15-min worker is down | Low–medium | Classic demo support UNTESTED. Probe first (section 2). Re-arm after split halts, which cancel orders |
| 3 | **Bitget's own session model:** `v3/reality/market/states` + `calendar` + `stock-info.weekendTradable`, and name the external/internal index mode in the pet's reasoning | Medium–high for explainability; the "night shift" becomes Bitget's documented mechanism | Low | stock-info may cover rTokens only; states and calendar are market-wide |
| 4 | **Crowd senses:** `holdingAmount` (OI, free in tickers), `merge-depth` spread/depth, v2 `taker-buy-sell` / `position-long-short` / `account-long-short`, v3 `liquidations` | Medium: richer, Bitget-native inputs to the LLM | Low–medium | Insight endpoints may not cover stock perps. Degrade gracefully |
| 5 | **Corporate-action senses:** v3 `cash-dividend-records` (pending), `split-records`, `reality/market/earnings-forecast`, `dividends`, `inner-trades` | Medium: fits the Earnings-Driven / Event-Driven sub-themes; a dividend is a "treat" for a long pet | Medium | A Bitget-native alternative to EDGAR |
| 6 | **Handbook perception layer:** call `bitget-signal` MCP (`technical_analysis`, `tradfi_news`, `derivatives_sentiment`) and `bitget-mcp-server` (US news & sentiment, earnings calendar) from the worker | Medium: the handbook names exactly these for Track 2 perception | Low–medium (reuse Optic's MCP client) | agent.bitget.com is blocked on this network, so test from Railway |
| 7 | **Demo leverage clamp:** read `maxLever` from the demo contracts list before `set-leverage` | Low but prevents rejections | Trivial | Demo 25/25/25/20 vs live 100/100/100/75 |
| 8 | Agent Hub SDK (`@bitget-ai/bitget-agent-sdk`) | Narrative only | High risk if used for execution (UTA only; demo Phase 1 lacks plan orders) | Mention as reference; don't migrate now |
| 9 | Playbook + GetAgent Studio paper run | Low–medium ("primary" route in the handbook) | Medium, needs bitget.com login | Optional extra log |
| 10 | Copy trading, Bitget Wallet, AgentKey | Low | – | Skip |

---

## 7. Useful facts at a glance
- Stock-perp funding is 8h with per-symbol caps (NVDA ±1%, AAPL ±0.5%). Bitget's own guide suggests exiting "if the hourly funding rate exceeds 0.15%".
- Minimum order: 5 USDT notional (Kibble already handles error 45110). NVDA `minTradeNum` 0.01, `sizeMultiplier` 0.01, `posLimit` 0.2, `maxMarketOrderQty` 9,500.
- NVDA/TSLA/AAPL/RDDT perps listed 2026-02-02; SPCX 2026-06-09; OPENAI 2026-05-26 (`openTime`).
- Public REST rate limit is about 20 req/s. The trading-insight endpoints are heavier (CCXT weight 20).

---

## 8. Verification commands (run from Railway or a network that resolves bitget.com; public, no auth)

```bash
B=https://api.bitget.com
# 1 live universe + field check
curl -s "$B/api/v2/mix/market/contracts?productType=USDT-FUTURES" | jq '[.data[]|select(.isRwa=="YES")]|length'
# 2 demo universe (public endpoint, demo header)
curl -s -H "paptrading: 1" "$B/api/v2/mix/market/contracts?productType=USDT-FUTURES" | jq '[.data[]|select(.isRwa=="YES")|{symbol,maxLever}]'
# 3 authoritative stock split
curl -s "$B/api/v3/market/instruments?category=USDT-FUTURES" | jq '[.data[]|select(.symbolType=="stock")]|length'
# 4 session + per-stock hours
curl -s "$B/api/v3/reality/market/states"; curl -s "$B/api/v3/reality/market/calendar"
curl -s "$B/api/v3/reality/market/stock-info?symbol=NVDAUSDT"; curl -s "$B/api/v3/reality/market/stock-info" | jq '.data|length'
# 5 crowd senses coverage for stock perps
for p in taker-buy-sell account-long-short position-long-short long-short; do echo $p; curl -s "$B/api/v2/mix/market/$p?symbol=NVDAUSDT&period=1h" | head -c 300; echo; done
curl -s "$B/api/v2/spot/market/support-symbols" | jq '.data.futureList|map(select(test("NVDA|TSLA|AAPL")))'
curl -s "$B/api/v3/market/liquidations?category=USDT-FUTURES&symbol=NVDAUSDT&limit=20"
# 6 corporate actions
curl -s "$B/api/v3/market/cash-dividend-records?symbol=AAPLUSDT&type=pending"; curl -s "$B/api/v3/market/split-records"
curl -s "$B/api/v3/reality/market/earnings-forecast?code=NVDA"
# 7 depth + price trio
curl -s "$B/api/v2/mix/market/merge-depth?symbol=NVDAUSDT&productType=USDT-FUTURES&limit=15"
curl -s "$B/api/v2/mix/market/symbol-price?symbol=NVDAUSDT&productType=USDT-FUTURES"
# 8 US-stock MCP tool list (HTTP MCP)
curl -s -X POST https://agent.bitget.com/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"kibble","version":"1"}}}'
```

---

## 9. Sources
- Hackathon handbook: https://bitget-ai.gitbook.io/bitgetai_hackathons2/base-camp-hackathon-s2-en (raw: `…/base-camp-hackathon-s2-en.md`; saved as `hb_en.md` in this scratchpad). Chapter IV Track 2, Chapter V Developer Toolkit, Chapter VI FAQ.
- Bitget API docs:
  - https://www.bitget.com/api-doc/common/intro
  - Classic demo trading: https://www.bitget.com/api-doc/classic/demotrading/restapi and https://www.bitget.com/api-doc/classic/demotrading/websocket
  - TP/SL: https://www.bitget.com/zh-CN/api-doc/classic/contract/plan/Place-Tpsl-Order and https://www.bitget.com/zh-CN/api-doc/classic/contract/plan/Place-Pos-Tpsl-Order
  - Trigger catalog: https://www.bitget.com/docs/catalog/classic-contract-plan/classic-contract-plan
  - Bills: https://www.bitget.com/zh-CN/api-doc/classic/contract/account/Get-Account-Bill
  - Positions: https://www.bitget.com/api-doc/classic/contract/position/get-all-position and https://www.bitget.com/api-doc/classic/contract/position/Get-History-Position
  - Positions WebSocket: https://www.bitget.com/api-doc/classic/contract/websocket/private/Positions-Channel
  - Taker buy/sell: https://www.bitget.com/zh-CN/api-doc/classic/common/apidata/Taker-Buy-Sell
  - Reality: https://www.bitget.com/docs/catalog/reality/market-data and https://www.bitget.com/api-doc/uta/reality-trading-guide
  - Instruments: https://www.bitget.com/docs/catalog/market-market-data/market-instruments
- Bitget support and academy:
  - Traditional-asset perps overview (index/mark mechanics): https://www.bitget.com/support/articles/12560603845668
  - TradFi perps overview (dividends, splits, pre-IPO, hours): https://www.bitget.com/support/articles/12560603894212
  - Stock perps guide: https://www.bitget.com/support/articles/12560603847519
  - rToken & perps API guide: https://www.bitget.com/academy/bitget-rtoken-stock-perps-api-guide
  - MCP FAQ: https://www.bitget.com/support/articles/12560603890586
- GitHub:
  - https://github.com/Bitget-AI/agent_hub
  - https://github.com/Bitget-AI/agent-sdk
  - https://github.com/Bitget-AI/agent-mcp
  - https://github.com/Bitget-AI/bitget-signal
  - CCXT endpoint map: https://github.com/ccxt/ccxt/blob/master/ts/src/bitget.ts
  - tiagosiebler SDK types: https://github.com/tiagosiebler/bitget-api (src/rest-client-v2.ts, rest-client-v3.ts, types/response/v3/reality.ts, types/response/v3/public.ts)
  - UTA demo Phase-1 list: https://pkg.go.dev/github.com/tigusigalpa/bitget-go
  - UTA bill 40404: https://github.com/ccxt/ccxt/issues/28041
- Local: Optic cache `~/Documents/Hacks/Hackathon/optic-bitget/data/optic.db` (2026-09-17), `optic-bitget/artifacts/rwa-universe.json`, `bitget-signal-status.json`, `evidence-NVDA.json`; Kibble `~/Documents/Hacks/Hackathon/stocklings-bitget/PLAN.md` (demo facts 2026-09-20), `src/lib/exchange.ts`, `src/lib/bitget.ts`.
