# Kibble

**The food is margin. Funding eats it. Feed it, and it works the hours your shares can't.**

A Stockling is a collectible creature *and* an autonomous agent. You pick an egg, it hatches, you name it and choose its personality — which is also its **risk mandate**. Then you feed it. Feeding posts margin on that stock's **rToken perpetual on Bitget**. From then on it reads the news and the filings itself, a model decides what to do about them, the mandate decides what it is *allowed* to do about them, and it writes a diary explaining both.

It pays its own funding every eight hours, and it can be liquidated.

Built for the **Bitget AI Base Camp Hackathon S2 · Track 2 · Agentic Trading**.

> *"When tokenized US stocks make 7×24 the new normal, humans sleep — Agents don't."*
> — the S2 brief
>
> *"Wall Street sleeps. I don't."*
> — Nova, at 2am, unprompted

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
  Yahoo RSS      the model reads   the mandate       the engine
  Google News →  them and picks →  clamps, vetoes →  opens / adds /
  SEC EDGAR      one of five       or allows it      trims / flattens
  (no key)       actions                             (pure, replayable)
```

**The model decides.** It is given what actually happened — headlines, and 8-K/10-Q/10-K filings straight from EDGAR, an item 2.02 being an earnings release — plus its position, its funding cost and its own mandate. It returns one of five actions, a rationale in the pet's voice, the events it says it used, and a confidence. Citations are checked against what it was actually shown; one it invented is dropped.

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

## The six

The home stock decides the species. Each carries one deliberate wrong detail — a face that resolves instantly is a face you forget. Every one of them trades on Bitget as an rToken perpetual; the exchange's own leverage ceiling doubles as a species trait.

| Stockling | Species | Home stock | Perpetual | Bitget max | Wrong detail |
|---|---|---|---|---|---|
| Nova | Robot cat | NVDA | `NVDAUSDT` | 100× | left ear bent |
| Volt | Lightning dog | TSLA | `TSLAUSDT` | 100× | right ear folded |
| Pip | Earbud hedgehog | AAPL | `AAPLUSDT` | 100× | one bent spine |
| Booster | Space frog | SPCX | `SPCXUSDT` | 75× | mismatched eyes, crooked patch |
| Nimbus | Cloud | OpenAI | `OPENAIUSDT` | 20× | drooping puff |
| Lurk | Night owl | RDDT | `RDDTUSDT` | 20× | one eye half closed |

**Nimbus is the one that only works here.** OpenAI is a private company with no share to close. On Solana it had to fall back to a flat synthetic price series, because there was no market. On Bitget `OPENAIUSDT` is a live perpetual with a real hourly tape — so the cloud never has a night, because its market never has one either. It says so:

> *"There is no closing bell for me."*

---

## Track 2, and what it asks for

Sub-theme: **Event-Driven Agent** — *"How do news / announcements / macro events drive autonomous Agent trading?"* The answer here is a creature that only gets to read the news while the shares it holds cannot trade.

| Required | Where it is |
|---|---|
| Runnable demo | the app |
| event → decision → execution flow | `sensed` → `decided` → `vetoed` → `open` in the diary; `npm run gatetest` proves the ordering |
| **Paper trading log**, run during the competition | [`/api/log`](https://app-production-98c2.up.railway.app/api/log) (`?format=csv`, `?full=1` for the reasoning rows), written every 15 minutes since 2026-09-20. Since 2026-09-30, three of the five agents execute on Bitget's demo exchange and their rows carry the order id and fill |
| Sharpe, max drawdown, win rate | [`/api/metrics`](https://app-production-98c2.up.railway.app/api/metrics), computed live by `metrics.ts` from each agent's hourly equity marks |
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

- **No real money, anywhere. Three of the five agents execute on Bitget's demo exchange.** Since 2026-09-30 07:08 UTC, every open, add, trim and close that Nova (`NVDAUSDT`), Volt (`TSLAUSDT`) and Pip (`AAPLUSDT`) make is sent to Bitget's demo environment as a market order. The log row carries the order id and the fill, and `slippage_pct` compares that fill with the bar close the engine booked. Every request carries `paptrading: 1`, and no code path leaves it out, so the key can only move demo funds. Nimbus (`OPENAIUSDT`) and Lurk (`RDDTUSDT`) are not listed on demo, so they stay simulated and fill at the bar close. Every log row says which: `demo` or `sim`.
- **The engine still keeps the books.** On demo pets the exchange does the executing. Equity, funding and liquidation in the log and the metrics are still the engine's; the exchange's own funding debits and liquidations are not read back yet. Every tick squares the exchange position up with the engine's and writes down any correction it made. Sizes snap to Bitget's 0.01-contract step, and Bitget refuses orders under 5 USDT, so the exchange can trail the book by a few dollars until the next square-up.
- **The five personalities in the table below are the fixed-rule baseline, not the model.** They are what the pet does with no key configured, and what the model is measured against. The harness scores that baseline over historical bars; it does not replay the model over them, because the news that drove a decision three weeks ago is not reconstructible per-bar and pretending otherwise would manufacture a track record.
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
| The decision | `qwen3.8-max` on Bitget's hackathon endpoint (`hackathon.bitgetops.com/v1`); Anthropic or anything OpenAI-compatible also works | your key |
| Execution for Nova, Volt, Pip | Bitget demo trading, `mix/order/place-order` and `mix/order/fills`, always with `paptrading: 1` | demo API key |

A device proves ownership with a random key kept in its own `localStorage` — only the SHA-256 reaches the database, and a write whose hash doesn't match is refused rather than forking a second pet.

The engine is pure, so the browser and the hourly worker produce identical actions from identical bars. A Stockling waiting on a yes/no from you is skipped entirely by the worker: the permission rule holds when nobody is watching, which is the only time it matters.

## Credits

Character art generated with Higgsfield from the prompts recorded in `docs/DESIGN.md`, carried over from the sibling project along with the design tokens.

*Not financial advice. No real money moves: every trade is simulated or on Bitget's demo exchange. The pets are fictional; the funding rates are not.*
