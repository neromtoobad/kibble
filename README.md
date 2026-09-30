# Kibble

**The food is margin. Funding eats it. Feed it, and it works the hours your shares can't.**

A Stockling is a collectible creature *and* an autonomous agent. You pick a stock — any of the **95 Bitget stock perpetuals** that trade enough to paper-trade honestly — and the animal of its sector hatches: AMD a robot cat, Coinbase a hamster, SPY a mosaic tortoise. You name it and choose its personality, which is also its **risk mandate**. Then you feed it. Feeding posts margin on that stock's **rToken perpetual on Bitget**. From then on it reads the news and the filings itself, a model decides what to do about them, the mandate decides what it is *allowed* to do about them, and it writes a diary explaining both.

It pays its own funding every eight hours, and it can be liquidated. Every buy it makes is a **pinky promise** — a thesis, a target, a stop and a deadline — and every promise is graded. Every claim it makes is checkable on one page: **[/proof](https://app-production-98c2.up.railway.app/proof)**.

Built for the **Bitget AI Base Camp Hackathon S2 · Track 2 · Agentic Trading**.

> *"When tokenized US stocks make 7×24 the new normal, humans sleep — Agents don't."*
> — the S2 brief
>
> *"Wall Street sleeps. I don't."*
> — Nova, at 2am, unprompted

## Review it in 90 seconds

1. **[Meet an agent](https://app-production-98c2.up.railway.app/p/fe7c9717-86ee-4675-ae01-4472e57bd77c)** — Nova, a robot cat on NVDA: its return, its open promise, its diary.
2. **[Check its promises](https://app-production-98c2.up.railway.app/proof#promises)** — every buy was a thesis with a target, a stop and a deadline; here is how each one ended.
3. **[Price the risk layer](https://app-production-98c2.up.railway.app/proof#guardian)** — what every veto and cut saved or cost, 24 hours later, including when it cost.
4. **[The model against its twin](https://app-production-98c2.up.railway.app/proof#twin)** — each pet against its own fixed rules on the same tape.
5. **[Verify the diary](https://app-production-98c2.up.railway.app/proof#chain)** — your browser recomputes every hash; `npm run verify` does it from a terminal.
6. **[Read the raw log](https://app-production-98c2.up.railway.app/api/log?full=1)** — every row, with Bitget demo order ids where they exist ([CSV](https://app-production-98c2.up.railway.app/api/log?format=csv)).

---

## Where this came from

The creature system — the six species, the moods, the diary, the NYSE day/night clock — comes from **Stocklings**, a sibling project built for Solana's tokenized-stock hackathon. That's stated up front because it's true and because the interesting part is what had to change.

On Solana a Stockling bought a spot token and lent it for yield. On Bitget the same stock is a **perpetual future**, and that single difference rewrote the care loop into something the metaphor was only ever gesturing at:

| | Solana edition | Kibble |
|---|---|---|
| Instrument | spot token, held | isolated long on an rToken perpetual |
| What feeding does | buys shares | posts margin — it holds **more** than you fed it |
| What makes it hungry | a timer | **funding**, paid out of margin every 8 hours |
| Worst case | the price falls | **liquidation** — it faints, and you feed it back to life |
| Personality | a strategy | a strategy **and a risk mandate**: leverage, liquidation buffer, funding ceiling |
| Second act | a bonding-curve token launch | *(not yet — see Honest limits)* |

Everything below this line is new.

---

## How it decides

Track 2 asks for the model to be the decision-maker rather than an assistant. Kibble splits that into two layers that cannot overrule each other in the wrong direction:

```
  sense          judge             gate              execute
  ─────          ─────             ────              ───────
  Yahoo RSS      the model reads   the mandate,      the engine
  Google News →  them, picks one → then the risk  →  opens / adds /
  SEC EDGAR      of five actions   layer: clamp,     trims / flattens,
  (no key)       and, to buy,      veto or allow     enforces the stop
                 makes a promise                     (pure, replayable)
```

**The model decides.** It is given what actually happened — headlines, and 8-K/10-Q/10-K filings straight from EDGAR, an item 2.02 being an earnings release — plus its position, its funding cost and its own mandate. It returns one of five actions, a rationale in the pet's voice, the events it says it used, and a confidence — and with every open or add, a [pinky promise](#pinky-promises). Citations are checked against what it was actually shown; one it invented is dropped.

**The mandate is not negotiable.** Every decision passes through `gate()` in [strategy.ts](src/lib/strategy.ts) before anything executes. Leverage is clamped to the mandate — not the contract's 100× ceiling. The reserve is not spendable on request. Buying into a carry above the limit is refused. And the standing risk check outranks judgement entirely: a position near liquidation gets trimmed no matter how bullish the model is. Every clamp and veto is written to the diary, because an override the owner cannot see is one they cannot audit.

**The engine stays pure.** The model's decision is an *input* to `runEngine()`, exactly like bars and funding rates — not a call made inside it. So a replay of the same inputs always produces the same diary, every line can be re-derived after the fact, and the hourly worker and the browser reach the same place by the same route. What is deterministic is the execution and the risk layer; the judgement is the model's, and it is recorded so you can check it.

**With no key configured**, `judge()` returns null and the pet falls back to its fixed-rule personality — which is also the baseline the model is measured against. Sensing needs no key and runs either way.

## Funding is what it eats

A perpetual charges you to hold it. Every eight hours the position settles against the funding rate: a positive rate means the long pays, a negative one means it collects. Bitget publishes that number, and Kibble spends it out of the pet's margin.

So the bowl empties on a schedule the exchange sets, and **hunger drains with it** — a Stockling carrying an expensive position gets hungry faster than one that isn't. The care loop stopped being decoration and became the actual cash flow of the instrument.

It reads like this in the diary, verbatim from a real replay:

```
09-18 08:00  [funding]  Paid $0.0045 in funding — 5% a year to hold this. That comes out of my bowl.
09-18 16:00  [funding]  Paid $0.0260 in funding — 29% a year to hold this. That comes out of my bowl.
09-18 16:00  [flatten]  Funding is 29% a year and my limit is 25%. Not paying that to hold. Closed.
```

Three consecutive lines from Boomer's diary, unedited. The rate moved from 5% to 29% between two settlements, crossed the ceiling it had declared at adoption, and it closed — a risk mandate firing on its own, with nobody watching.

## It can faint

An isolated long that runs out of margin is liquidated. Kibble checks that against **each bar's low, not its close** — a wick that touches your liquidation price liquidates you, and pretending otherwise would flatter every pet in the app.

A fainted Stockling loses its position and its margin, sulks, and comes back the moment you feed it. That's the stake spot never had: the creature can actually be hurt by the thing it does.

## The five mandates

The personality you pick at adoption is the whole risk layer. Three numbers define it, and **risk runs before personality on every bar** — identically for all five, only the thresholds differ. That layer is why one Stockling survives a week and another doesn't.

| | Leverage | Trims when liquidation is nearer than | Refuses funding above | |
|---|---|---|---|---|
| 💎 **Diamond Hands** | 2× | 25% | 200%/yr | adds at every open, only ever trims to stay alive |
| ⚡ **Degen** | 8× | 12% | 120%/yr | 2% dips at any hour, 6h cooldown, asks you first above $25 |
| 🕰 **Boomer** | 1.5× | 40% | 25%/yr | regular hours only, a third of the margin never deployed |
| 📊 **Quant** | 3× | 30% | 15%/yr | weekly rebalance, and it genuinely watches the carry |
| 🌙 **Night Shift** | 4× | 20% | 60%/yr | **only acts while the NYSE is shut** |

The last one is the hackathon's premise as a temperament. It sleeps through the session and works the hours the share itself cannot trade.

## The risk layer above the mandate

A mandate is one pet's rules about one decision. Three more layers look past that — at the market's weather, the calendar and the owner's whole kennel — and they run **before the model and the personality get a say**, on every bar ([risk.ts](src/lib/risk.ts)). Each writes a diary line naming itself, so the audit trail says *which* layer overruled the pet, not just that something did.

| Layer | What it does |
|---|---|
| **Storm sense** | Each mandate declares a volatility budget — its leverage × 30% a year. The allowed leverage is that budget ÷ the stock's realised volatility over the last 48 hours, so a calm NVDA can carry more than a stormy one. Buys are sized under it; a held position more than 1.25× over it is cut back. Diamond Hands is exempt from the cut, never from the cap. |
| **Weekend guard** | From Friday 15:00 ET until Monday's open the share cannot trade but the perpetual can, and whatever it drifts to is the gap waiting at the bell. Nothing is carried above 2× through that, and the diary says how far the perp already is from the share's last close. |
| **Kennel breaker** | Across all of an owner's pets: 3% down on the day stops new risk until tomorrow; 8% below the high-water mark cuts every pet to 1× for up to 24 hours (it re-arms at 5%); total exposure is capped at 3× equity; and the owner can pull a kill switch (`POST /api/kennel`). |

In a one-off replay of the five original agents over their real bars on 30 Sep, the three layers took the average maximum drawdown from 16.3% to 14.3% and the worst from 51% to 39%. That replay script isn't in the repo — `npm run risktest` proves each layer's behaviour on synthetic tapes (19 checks), not those numbers.

## Pinky promises

A model that says "bullish, buying" has told you nothing you can check later. So every open or add comes with a promise ([engine.ts](src/lib/engine.ts)):

```
  thesis    one falsifiable sentence — what it expects and why
  target    the price that would prove it right
  stop      the price that would prove it wrong
  deadline  how long it has to play out (1 hour to 2 weeks)
```

The promise rides on the position, and the engine keeps it before anything else happens on each bar. **The stop is enforced**: touch it and the pet is out, at the stop or at the open if the bar gapped through. Reaching the target moves the stop up to the entry. Every promise ends one of four ways, each written to the hash-chained diary as it happens:

| Ending | | What happens |
|---|---|---|
| target | right | graded; the stop moves to the entry |
| stopped | wrong | graded; the position is closed |
| expired | ran out | graded; the position stays, the promise ends |
| closed | — | a kill switch, a trim to nothing or a liquidation got there first; counted, not scored |

Diamond Hands never sells on price, so its promises are graded but not enforced — it says it was wrong, and holds. A stop past the liquidation price is raised above it, and the diary says so. The scorecard — how often it was right, and how much reward it promised per unit of risk — is counted from rows nobody can edit afterwards. `npm run promisetest` walks every ending on synthetic tapes (23 checks). The first live call to `qwen3.8-max` returned *"target $235 · stop $212 · 48h"* at $220: 1.9 of reward per unit of risk, stated before the fact.

## Proof

**[/proof](https://app-production-98c2.up.railway.app/proof)** puts every claim above where it can be checked in a couple of minutes. Every number is computed from the agents' own diary and the real Bitget tape by a public route; nothing is typed in.

- **The score** — return, Sharpe, max drawdown and win rate per agent, from the engine's hourly equity marks ([metrics.ts](src/lib/metrics.ts)).
- **What the risk layer was worth** — every time a layer cut a position or refused or shrank a buy, the trade that didn't happen is marked to market 24 hours later, funding included ([proof.ts](src/lib/proof.ts)). It is allowed to come out negative, and on 30 Sep it did: over 10 settled interventions the layers cost **$1.04** (4 helped, 6 hurt). That is shown, not hidden.
- **The model against its twin** — each pet replayed on its personality's fixed rules alone, same stock, same bars, same starting equity. On 30 Sep the model was ahead of its twin for 4 of the 5 agents with a record, by +1.6 points on average.
- **Pinky promises** — the scorecard above, with every promise and how it ended.
- **The kennel** — each owner's breaker status, live.
- **The diary is a hash chain** — every row the worker writes carries `sha256(previous hash + the row)`, per pet, from `genesis:<pet id>`. The page re-verifies every chain **in your browser** with WebCrypto; `npm run verify` does the same from a terminal. Edit, drop or reorder one row and every hash after it stops matching.
- **Why did it do that?** — each recent model decision, with what it had read and what the mandate and the exchange did next.

A GitHub Action snapshots the board and the chain heads hourly to a static mirror, **[neromtoobad.github.io/kibble](https://neromtoobad.github.io/kibble/)**, so the record survives the app being down.

Every agent also has a public page, `/p/<id>`, linked from the Board. It shows the same record, and it unfurls on X to a share card rendered on request from those numbers ([card.ts](src/lib/card.ts)), so a card posted today shows next week’s numbers next week.

## Thirteen families, 95 stocks

The stock decides the animal. [build-universe.mjs](scripts/build-universe.mjs) takes every Bitget tokenized-stock perpetual trading at least **$250k a day**, joins it to the Nasdaq screener, and gives each company the animal of its sector — with a short, commented list of overrides where Nasdaq's label is wrong or the business that moves the stock isn't the one it files under (a bitcoin treasury files as software; it hatches a hamster). Leveraged, inverse and volatility ETFs are left out — a pet holding one is leverage on leverage, which is what the mandates exist to prevent — and so are metals, FX and non-US listings, which don't keep NYSE hours. The result is a checked-in snapshot, [universe.json](src/data/universe.json), because which animal a company is shouldn't change between two ticks.

Each family carries one deliberate wrong detail — a face that resolves instantly is a face you forget. The six founders, in bold, came first and keep their names.

| Animal | Stands for | Stocks | Founder and most traded | Wrong detail |
|---|---|---|---|---|
| Robot cat | Chips & hardware | 23 | **NVDA** (Nova), SNDK, SKHY, MU, INTC | left ear bent |
| Earbud hedgehog | Computers & gadgets | 6 | **AAPL** (Pip), DELL, GPRO, HPE, HPQ | one bent spine |
| Cloud | Software, cloud & AI | 16 | **OPENAI** (Nimbus), GTLB, MSFT, PLTR, CRWV | drooping puff |
| Night owl | Internet & media | 4 | **RDDT** (Lurk), BZ, GOOGL, META | one eye half closed |
| Lightning dog | EVs, power & batteries | 6 | **TSLA** (Volt), BE, FLNC, OKLO, VST | right ear folded |
| Space frog | Aerospace & space | 6 | **SPCX** (Booster), RKLB, GE, FLY, ASTS | mismatched eyes, crooked patch |
| Hamster | Crypto | 8 | CRCL, MSTR, COIN, BMNR, MARA | one cheek stuffed with a coin |
| Banker penguin | Banks, brokers & payments | 2 | HOOD, FUTU | monocle on crooked |
| Capsule bunny | Health & biotech | 2 | MRNA, TEM | one bandaged ear |
| Rhino beetle | Oil, gas & mining | 3 | USAR, COP, MP | chipped horn |
| Kangaroo | Shops & brands | 5 | CL, AMZN, BABA, GME, MCD | one parcel upside down |
| Armadillo | Industrials | 3 | GLW, ETN, VRT | one shell plate out of line |
| Mosaic tortoise | Index funds | 11 | DRAM, QQQ, SPY, EWY, SOXX | one mosaic tile missing |

The exchange's own leverage ceiling for each contract doubles as a species trait, and `npm run universetest` checks the registry against the art on disk and the build rules (14 checks).

**Nimbus is the one that only works here.** OpenAI is a private company with no share to close. On Solana it had to fall back to a flat synthetic price series, because there was no market. On Bitget `OPENAIUSDT` is a live perpetual with a real hourly tape — so the cloud never has a night, because its market never has one either. It says so:

> *"There is no closing bell for me."*

---

## Track 2, and what it asks for

Sub-theme: **Event-Driven Agent** — *"How do news / announcements / macro events drive autonomous Agent trading?"* The answer here is a creature that only gets to read the news while the shares it holds cannot trade.

| Required | Where it is |
|---|---|
| Runnable demo | the app |
| event → decision → execution flow | `sensed` → `decided` → `vetoed` → `open` in the diary; `npm run gatetest` proves the ordering |
| **Paper trading log**, run during the competition | [`/api/log`](https://app-production-98c2.up.railway.app/api/log) (`?format=csv`, `?full=1` for the reasoning rows), written every 15 minutes since 2026-09-20. Since 2026-09-30, the agents whose contract Bitget's demo exchange lists execute there, and their rows carry the order id and fill |
| Sharpe, max drawdown, win rate | [`/api/metrics`](https://app-production-98c2.up.railway.app/api/metrics), computed live by `metrics.ts` from each agent's hourly equity marks |
| Explainability | the diary, [pinky promises](#pinky-promises), and [/proof](https://app-production-98c2.up.railway.app/proof)'s decision inspector |
| Risk-control effectiveness | [/proof](https://app-production-98c2.up.railway.app/proof#guardian): what every intervention saved or cost, 24 hours later |
| Compliant X post | *(yours to post)* |

Judging is 50% quantitative — paper Sharpe, max drawdown, win rate — plus decision explainability, agent architecture, and **risk-control effectiveness**. [metrics.ts](src/lib/metrics.ts) computes the first three from the engine's own hourly equity marks rather than asserting them. Explainability is the diary: every line names what was read and why. The risk-control layer is `gate()`, and it is the one part of this that is allowed to tell the model no.

## Evidence

Nothing here reached a screen before it was replayed against real data.

**`npm run harness -- nova 30`** replays all five personalities over **720 real hourly bars and 100 real settled funding payments**, pulled live from Bitget. Run of **2026-09-18 17:00 UTC** — NVDA $220.01, funding 32.1%/yr:

| | result on $100 | closes | win | Sharpe | max DD | funding paid | deterministic |
|---|---|---|---|---|---|---|---|
| Diamond | $99.43, still 2× long, liquidation 49.4% away | 0 | — | 0.25 | 19.4% | $0.87 | yes |
| Degen | $100.00, **waiting on your permission since Aug 24** | 0 | — | — | 0.0% | $0.00 | yes |
| Boomer | $93.67, **flattened at 29%/yr vs its 25% limit** | 8 | 38% | −2.12 | 11.4% | $0.37 | yes |
| Quant | $97.73, **flattened at 19%/yr vs its 15% limit** | 3 | 33% | −0.29 | 14.6% | $0.27 | yes |
| Night Shift | $96.91, 4× long, liquidation 24.8% away | 1 | 0% | 0.45 | 36.1% | $1.72 | yes |

**Your run will not match this table**, and that is the point: the window is the last 30 days of a live tape, so it moves every hour. What reproduces exactly is each personality against *identical* bars — which is what the `deterministic` column checks, by replaying twice and comparing. Treat the numbers as dated, not fixed.

Three things that table proves. The mandates **fire on their own** — two different pets closed for two different funding ceilings, at the rate each one had declared in advance. Degen's open question **held with nobody watching**, which is the only time a permission rule matters. And every personality replays **identically from identical inputs**, so the diary is reproducible and each line can be explained.

**`npm run gatetest`** hands the engine decisions a model might actually make, including bad ones, and checks what the mandate does about them. No API key needed — the decision is an input, so a reckless one can simply be handed in:

```
✓ leverage is clamped to the mandate, not the exchange ceiling
    model asked for 20× on a contract that allows 100×; mandate allows 1.5× → got 1.5×
✓ the reserve is not spendable even on request
    model asked for $100 of $100 margin; 30% reserve → allowed $70.00
✓ buying into a carry above the limit is refused outright
    funding 164%/yr vs a 15% limit → hold
✓ a position near liquidation is trimmed however bullish the model is
    model said "add"; liquidation 4% away vs a 12% floor → trim
✓ a decision inside the mandate passes through untouched
```

and then the whole flow, end to end, on a flat tape so that nothing but the decision can move it:

```
   [decided] Read 1 item and decided: open. Guidance was raised and the shares
             cannot react until Monday. Opening.
   [vetoed]  Asked for $100.00, allowed $70.00 by the mandate.
   [open]    Guidance was raised and the shares cannot react until Monday. Opening.

✓ the decision is recorded before the execution      diary order: decided → vetoed → open
✓ the override is recorded too, not silently applied
✓ what executed obeys the mandate, not the model     asked $100 at 50×; executed $70.00 at 1.5×
```

That is the event → decision → execution flow the track asks for, in three diary lines, with the risk layer visibly disagreeing with the model in the middle one.

**`npm run liqtest`** covers the path the market may not hand us inside a demo window:

```
8× long, 4 contracts @ $200, $100 margin → liquidation at $175.88
expected ≈ (4·200 − 100) / (4·0.995) = $175.88

✓ fainted: Liquidated at $175.88. NVDA wicked to $175.38 and my margin was gone. I fainted.
  position after: flat · faints 1 · margin $3.52
✓ survives a wick that stops short
```

**`npm run exectest`** drives the execution layer against Bitget's demo exchange: the cutover, an add, a reduce-only trim, a position changed behind the engine's back, and a flatten, checking what the exchange holds after each. It needs a demo key and moves demo funds only. Run of 2026-09-24, verbatim:

```
✓ cutover mirrors the simulated position onto the exchange
    system order 1487026767821996033 fill $222.54 vs bar $222.70
✓ an add goes out as a market buy and the row keeps the order id and fill
    add order 1487026783231868929 fill $222.56 vs bar $222.70
✓ a trim goes out reduce-only
    trim order 1487026801493868545 fill $222.47 vs bar $222.70
✓ drift behind the engine's back is squared up, and the correction is written down
    The demo exchange held 0.4 NVDAUSDT and the book says 0.35. Squared it up: sold 0.05 at $222.47.
✓ a flatten closes the exchange position completely
    flatten order 1487026842895843329 fill $222.47 vs bar $222.70
```

## Honest limits

- **No real money, anywhere. Four of the eight agents execute on Bitget's demo exchange.** Since 2026-09-30 07:08 UTC, every open, add, trim and close that Nova (`NVDAUSDT`), Volt (`TSLAUSDT`) and Pip (`AAPLUSDT`) make — and, since the same day, Stack (`COINUSDT`) — is sent to Bitget's demo environment as a market order. The log row carries the order id and the fill, and `slippage_pct` compares that fill with the bar close the engine booked. Every request carries `paptrading: 1`, and no code path leaves it out, so the key can only move demo funds. Nimbus (`OPENAIUSDT`), Lurk (`RDDTUSDT`), Basket (`SPYUSDT`) and Chip (`AMDUSDT`) are not listed on demo, so they stay simulated and fill at the bar close. Every log row says which: `demo` or `sim`. The demo account holds one position per symbol, so only the first pet adopted on a demo contract trades it there.
- **The engine still keeps the books.** On demo pets the exchange does the executing. Equity, funding and liquidation in the log and the metrics are still the engine's; the exchange's own funding debits and liquidations are not read back yet. Every tick squares the exchange position up with the engine's and writes down any correction it made. Sizes snap to Bitget's 0.01-contract step, and Bitget refuses orders under 5 USDT, so the exchange can trail the book by a few dollars until the next square-up.
- **The five personalities in the table below are the fixed-rule baseline, not the model.** They are what the pet does with no key configured, and what the model is measured against. The harness scores that baseline over historical bars; it does not replay the model over them, because the news that drove a decision three weeks ago is not reconstructible per-bar and pretending otherwise would manufacture a track record.
- **The universe is a snapshot.** Volumes and leverage ceilings come from Bitget's tickers as cached on 17 Sep (bitget.com is unreachable from the machine that built it), sectors from the Nasdaq screener on 29 Sep. Leverage is clamped again against the live contract at order time, so a stale ceiling can only be too cautious.
- **Promises began on 30 Sep, and only the model makes them.** A buy the fixed rules make carries no promise, and neither does a model buy whose promise couldn't be graded (a stop above the price, say); the decision row records which.
- **Three agents joined on 30 Sep** — Stack, Basket and Chip — so their record is days, not weeks, and they get no twin comparison until they have a day of marks.
- **The log starts on 2026-09-20.** The database was recreated when the project moved, so the published log begins at 08:00 UTC that day and nothing before it is backfilled. The track recommends ≥2 weeks.
- **Maintenance margin is flat at 0.5%.** Bitget tiers it by notional; at the sizes a pet trades the first tier applies. Stated everywhere it's used rather than buried.
- **Funding is applied at the 8-hour boundary using the last settled rate at or before that bar** — the published history, not a prediction.
- **No second act yet.** The Solana edition ended with a bonding-curve launch quoted in the pet's own stock. The Bitget analogue is publishing the mandate as a **GetAgent Playbook** others can subscribe to; the schema has a `published` column and the diary has the line, but the integration isn't built.
- **Unscheduled closures are not known in advance.** The NYSE calendar — holidays and 13:00 early closes — is computed from the exchange's own rules, so Night Shift is never told the share is trading on Thanksgiving. A one-off closure, like a national day of mourning, reads as a normal session.

## Run it

```bash
npm install
npm run dev              # http://localhost:3000 — no wallet, no key, nothing to connect
```

Dev switches: `?night=1` forces the night theme, `?mood=fainted` pins a mood, `?rewind=336` pretends you were away that many hours so the engine has a window to replay (it moves the watermark, never invents prices).

```bash
npm run harness -- nova 30   # replay all five personalities on real bars + funding
npm run gatetest             # prove the mandate overrules the model, and it is logged
npm run liqtest              # prove liquidation fires on the wick, and only then
npm run sqlcheck             # every column named in SQL exists in the schema
npm run risktest             # storm sense, the weekend guard and the kennel breaker on synthetic tapes
npm run promisetest          # every way a pinky promise can end, and the validator
npm run chaintest            # the hash chain: an edit, a dropped row and a reorder are all caught
npm run verify               # re-verify every live chain from /api/chain
npm run universetest         # the 95-stock registry against the art and the build rules
node scripts/build-universe.mjs [cacheDir]   # rebuild the universe snapshot
node scripts/import-art.mjs  # raw character frames → public/pets, at the original cast's scale
npm run worker               # one tick of the worker by hand
npm run gatea0               # six calls against Bitget's demo exchange: account, mode, buy, position, close, fills
npm run exectest             # the execution layer end to end on demo; leaves the position flat
```

Optional, in `.env.local` — the app runs with none of them:

```
ANTHROPIC_API_KEY=sk-...        # or OPENAI_API_KEY (+ OPENAI_BASE_URL for anything compatible)
DATABASE_URL=postgresql://...   # Railway → Postgres → DATABASE_PUBLIC_URL
BITGET_DEMO_KEY=...             # a key created from inside Bitget's Demo mode; a live key answers 40099
BITGET_DEMO_SECRET=...
BITGET_DEMO_PASSPHRASE=...
```

Without a model key the pets run on their fixed rules and `/api/judge` answers `{judgement: null}`; sensing still works, because the feeds need no key. Without a database the Board is empty and nothing syncs, and the pet runs entirely from `localStorage`. Every screen works either way.

## Stack

Next.js 16 · TypeScript · Tailwind · Framer Motion · Railway (app, Postgres, hourly cron)

| Purpose | Source | Auth |
|---|---|---|
| Perpetual tape, contracts, leverage ceilings | Bitget `mix/market/*` | none |
| Funding rates, settled and current | Bitget `current-fund-rate`, `history-fund-rate` | none |
| Underlying share reference price | Bitget `indexPrice` | none |
| Market sessions & holidays | NYSE Rule 7.2, computed in `session.ts` | none |
| What happened to the company | Yahoo Finance RSS, Google News RSS | none |
| What the company actually filed | SEC EDGAR (8-K / 10-Q / 10-K) | none |
| Which animal a company is | Nasdaq screener (sector, industry), at build time | none |
| The decision | `qwen3.8-max` on Bitget's hackathon endpoint (`hackathon.bitgetops.com/v1`); Anthropic or anything OpenAI-compatible also works | your key |
| Execution for Nova, Volt, Pip, Stack | Bitget demo trading, `mix/order/place-order` and `mix/order/fills`, always with `paptrading: 1` | demo API key |

A device proves ownership with a random key kept in its own `localStorage` — only the SHA-256 reaches the database, and a write whose hash doesn't match is refused rather than forking a second pet.

The engine is pure, so the browser and the hourly worker produce identical actions from identical bars. A Stockling waiting on a yes/no from you is skipped entirely by the worker: the permission rule holds when nobody is watching, which is the only time it matters.

## Credits

Character art generated with Higgsfield. The six founders' prompts are in `docs/DESIGN.md`, carried over from the sibling project along with the design tokens; the seven new families, their eggs and every fainted pose were generated with `gpt_image_2_5` from the founders' art as a style reference, and every credit spent is logged in [art-src/CREDITS.md](art-src/CREDITS.md).

*Not financial advice. No real money moves: every trade is simulated or on Bitget's demo exchange. The pets are fictional; the funding rates are not.*
