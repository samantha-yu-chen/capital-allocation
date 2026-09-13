# Chunk 2 handoff — deterministic lifetime ledger, ready for Codex's chunk 3

Work package 2. Built on chunk 1's contracts and tax engine; nothing from `design/` is imported.
Branch `worktree-chunk-2-ledger`, merged to `main`.

## What this slice added

One new directory, `src/engine/`, plus a CLI harness and four test files:

| File | Contents |
| --- | --- |
| `src/engine/ledger.ts` | `runProjection` / `runDeterministicProjection`, `LedgerYearDetail`, `ProjectionMetrics`, `LedgerOptions`, `UnsupportedProfileError` |
| `src/engine/solve.ts` | `solveMonotone` — the withdrawal gross-up root finder |
| `src/engine/spending.ts` | `spendingForYear`, `splitRetirement`, `retirementAnnualReal`, `emergencyReserveTarget`, `capitalNeedsForAge` |
| `src/engine/accounts.ts` | `openingBalanceSheet`, `accessibleWealth`, `lockedWealth`, `netWorth`, `financialNetWorth`, `propertyEquity`, `proRataGain` |
| `src/engine/returns.ts` | `portfolioReturn`, `deterministicPath`, `inflationIndices` |
| `src/engine/fire-metrics.ts` | `referenceFireNumber`, `referenceFireRatio`, `requiredBridgeCapital`, `liquidFireRatio`, `requiredPostPensionCapital`, `pensionCoverageRatio`, `liquidityCoverageYears` |
| `src/presentation/cli/ledger-example.ts` | `npm run ledger` |
| `tests/ledger-{reconciliation,accounts,golden}.test.ts`, `tests/engine-units.test.ts` | 42 new tests |

No file in `src/domain/` or `src/config/` was modified, and **no shared contract changed** — see
"Interfaces" below.

## The one API you need

```ts
import { runProjection, runDeterministicProjection } from './src/engine/index.js';

const projection = runDeterministicProjection(profile);          // expected-value means path
const projection = runProjection(profile, path, options);         // any MarketPath
```

`runProjection(profile: Profile, path: MarketPath, overrides?: Partial<LedgerOptions>)` returns
`DeterministicProjection`, which **extends the shared `ProjectionResult`** (`years`, `failures`,
`success`) and adds `metrics` and `assumptions`. `years` is `LedgerYearDetail[]`, which extends the
shared `LedgerYear` with ~45 audit fields (every intermediate the year used).

`LedgerOptions` (all optional, `defaultLedgerOptions()` shown):

| Option | Default | Purpose |
| --- | --- | --- |
| `retirementLevel` | `'target'` | `'floor' \| 'target' \| 'comfort'` — spec §25 as three separate runs |
| `monthlyHouseholdOverride` | `null` | Replaces the household monthly total in every phase (§21's 1300/1650/2000) |
| `fundEmergencyReserve` | `true` | Retain surplus in cash until §41's reserve is covered |
| `surplusAllocation` | `'isa_then_gia'` | Also `'gia_only'`, `'cash_only'` |
| `solverTolerance` | `1e-6` | Currency over-funding bound on the gross-up |
| `solverMaxIterations` | `60` | |

## Calculation conventions I chose, and why

These are decisions, not restatements of the spec. Chunk 3 must preserve them for the
zero-volatility cross-check to mean anything.

**Cash is the settlement account.** All income, withdrawals, taxes, contributions and spending
flow through cash. That gives one identity holding for every account in every year, which the
tests assert:

```
closing.X = opening.X + contributions.X - withdrawalsGross.X + investmentReturn.X
```

**`withdrawalOrder` is honoured literally, including `cash`.** Because cash is the settlement
account it would otherwise always be spent first. Instead, `cash`'s position in the order gates
how much of the **opening** cash balance may be released at that point. An order ending in `cash`
genuinely preserves the cash balance and liquidates ISA/GIA/pension first — tested.

**Taxable investment income is measured on opening balances; growth compounds on post-flow
balances.** This is the important one. The tax bill depends on the withdrawal, and the withdrawal
depends on the tax bill. Measuring cash interest and GIA dividends on **opening** balances breaks
that cycle. Those two figures are *tax inputs only and never balance movements* — the only thing
that moves a balance is `investmentReturn` — so the reconciliation identity stays exact rather than
approximately true. Growth then applies to post-flow balances, per ADR 002's event order.

**Withdrawals are grossed up for their own tax.** `solveMonotone` finds the smallest gross
withdrawal whose net cash covers the remaining need. It never under-funds (it returns the
bracket endpoint that satisfies the constraint) and reports `saturated` when the balance cannot
reach the target, which becomes a failure record rather than invented capacity. Accounts are
solved sequentially in `withdrawalOrder`, each with the earlier accounts fixed, so CGT correctly
sees the basic-rate band left by any pension withdrawal ahead of it.

**Tax is assessed jointly, once per year**, through `calculateNetIncome`, with employment income,
other income, state pension, the taxable slice of any pension withdrawal, cash interest and GIA
dividends in the same call — so the PA taper, PSA, dividend allowance and band occupancy see the
whole annual picture. CGT then uses `remainingBasicRateBandForGains`. Per chunk 1's caution,
`netIncomeAfterPension` is **not** used to credit cash; cash inflow is built from gross income less
`personalCashReduction` and the tax components, so investment income is never double counted.

**Nominal ledger, today's-money inputs.** `inflationIndex[0] = 1`, so year 0 equals the profile's
figures; `index[t] = Π(1 + inflation_j)`. Salary growth is real, so nominal salary compounds real
growth **and** inflation. `LedgerYearDetail` carries both `inflationIndex` (opening) and
`closingInflationIndex`, so presentation can deflate opening and closing values correctly.

**GIA.** Dividend yield on the opening balance is taxable each year and, being accumulated inside
the wrapper, is added to the cost basis. `turnoverRate` sells and rebuys that fraction of the pool
(value unchanged), and `gainRealisationRate` is the share of the pro-rata gain actually
crystallised; the realised gain steps the basis up so it is never taxed twice. One annual CGT
exemption per year. Unrealised growth is untaxed.

**Pension.** Contributions are added exactly once (`totalPensionAdded`, which already includes
employer money and provider RAS relief). Post-FIRE employment is not pensionable, so the policy
follows `pensionablePay`, which is salary. Withdrawals are blocked before `accessAge`, split
UFPLS-style, and cumulative tax-free cash is tracked against the lump-sum allowance.
Pension and SIPP are separate balances under one access policy; the workplace pension is drawn
first. There is no SIPP contribution schedule in the profile schema, so `contributions.sipp` is
always 0.

**Failure classification.** Multiple codes can fire in one year:
`pre_pension_liquidity` (shortfall before `accessAge` while locked wealth exists — the golden
scenario E signature), `unfunded_essential_spending` (funded below the essential figure),
`portfolio_depletion` (shortfall with accessible wealth at zero), `insolvency` (negative net
worth). `success` is `failures.length === 0`, so a later good year can never erase an earlier
failure. Spending is funded before known capital needs when both cannot be met.

**No dynamic spending cuts.** Target spending is held every year. Floor/comfort are separate runs.

## Verification

`npm run check` (typecheck, tests, production build) passes on Node 24.21.0.

- **92 tests pass**, 0 fail — chunk 1's 50 plus 42 new.
- `npm run ledger` prints the §79 profile's full 64-year ledger in today's money.

Concrete results on the example profile (Scotland, £55k, FIRE 45, access 57, end 95):

| Check | Value |
| --- | --- |
| Year-0 income tax / NI | £9,927.05 / £3,055.60 — matches `docs/tax-rules-2026-27.md` exactly |
| Year-0 investable surplus | £19,467.35 — matches the documented figure |
| Investable at 45 (real) | £755,017 (accessible £589,676 + locked £165,341) |
| Reference FIRE number | £565,714 (£19,800 / 3.5%); ratio 133.5% |
| Liquid FIRE ratio / pension coverage | 248.2% / 22.0% |
| Terminal net worth (real) | £1,876,588, no funding failures |
| Spending cases £1,300 / £1,650 / £2,000 | surplus £23,667 / £19,467 / £15,267; FIRE number £445,714 / £565,714 / £685,714; terminal £2,952,566 / £1,876,588 / £761,880 |

Golden scenarios: **A** (£40k/4% = £1m), **C** (high wealth never fails), **D** (zero assets/income
fails every year, classified as depletion not locked capital), **E** (£800k locked pension fails all
twelve bridge years while net worth exceeds £800k and rises, then funds itself from 57), **F** (lower
spending raises surplus *and* lowers the capital requirement, with the surplus difference equal to
the spending difference to the penny). **B** needs chunk 5.

Reconciliation is asserted two independent ways for all 64 years: the per-account identity above,
and spec §6's aggregate cash-flow identity written from the spec rather than from engine
internals.

Two test expectations were corrected during development, both mine rather than the engine's: the
SIPP test assumed one year would exhaust a £40,000 workplace pension, and a residual-cash
assertion used strict equality where the solver legitimately stops within tolerance on the
over-funded side.

### Performance

Measured, 200 runs each, single-threaded, Node 24.21.0 on Apple Silicon:

| Profile shape | ms/projection | 10,000 paths |
| --- | --- | --- |
| Accumulation-heavy (§79 baseline) | 1.98 | ~20 s |
| Withdrawal-heavy (£3m pension, all years drawing) | 1.88 | ~19 s |

The gross-up solver was the bottleneck (~40 bisection iterations per solved account per year, each
costing a full joint tax assessment at ~5.8 µs). Replacing plain bisection with alternating
false-position/bisection cut projections 4–5x with results identical to the pound. It also made the
solve effectively exact: over-funding fell from ~6e-7 to ~5e-13, because the root is found
analytically inside a linear tax segment instead of being bracketed down to a tolerance.
`scaleTaxConfig` is only ~1.6 µs at 64 calls per projection, so it is not worth caching.

## Limitations — please preserve these visibly

- **Property is rejected, not ignored.** A non-null `profile.property` throws
  `UnsupportedProfileError`. Chunk 5 integrates it. `propertyValue`, `mortgageDebt` and every
  property field in `LedgerYear` are therefore hard 0 today, and `propertyEquity` is excluded from
  accessible wealth (spec §42: release must never be implicit).
- **Annual timing only.** No mid-year cash-flow weighting; growth applies to post-flow balances, so
  a year's contributions earn a full year of return and its withdrawals earn none.
- **Tax-year coverage is 2026/27** with the explicit `constant_real` assumption. `scaleTaxConfig`
  scales thresholds by cumulative inflation; it does not forecast legislation.
- **Pension annual-allowance excess is not modelled as a charge.** It throws
  `PensionLimitError` with the age prefixed. `pensionAllowanceCharge` is always 0. A solver or
  optimiser must mark such a candidate infeasible.
- **Surplus allocation is a transparent default, not an optimisation** (reserve, then ISA
  allowance, then GIA). Chunk 7 owns the marginal allocation decision.
- **Bridge/post-pension capital references are undiscounted real** sums (years × spending). They
  are coverage ratios, not sustainability claims.
- **A fully depleted GIA keeps any residual cost basis**; no loss write-off event is modelled,
  matching chunk 1's refusal to invent one.
- **Lifestyle creep applies to working years only** and is keyed to cumulative real salary growth.
- **`referenceFireRatio` and friends are reference arithmetic.** Spec §6 forbids presenting the
  deterministic run as FIRE safety. The CLI says so in its own output; the UI must too.

## Chunk 3 — Monte Carlo, for Codex

**You should not need to write any lifetime accounting.** The seam is already there:

```ts
const result = runProjection(profile, sampledPath, options);
// result.success, result.failures, result.years[t].{accessibleWealth, lockedWealth, netWorth}, result.metrics
```

1. **Implement `ReturnGenerator`** (already declared in `src/domain/contracts.ts`) to produce a
   `MarketPath` of `endAge - currentAge` `MarketYear`s. `runProjection` throws if the path is
   shorter, and reads `equities`, `bonds`, `cash`, `inflation` per year (`property` is read but
   unused until chunk 5). Correlation ordering is fixed by the schema: equities, bonds, cash,
   property, inflation.
2. **The zero-volatility test (§86) is the cross-engine check.** At zero volatility your sampled
   path should equal `deterministicPath(years, profile.market)`, and
   `tests/ledger-reconciliation.test.ts` already pins that an explicitly supplied means path
   reproduces `runDeterministicProjection` exactly. So assert your generator's zero-volatility
   output equals `deterministicPath(...)`, and the ledger equality follows.
3. **Inflation is per-path.** `inflationIndices` compounds year by year from the path, and the
   `constant_real` tax policy rescales thresholds by that index, so a high-inflation path moves
   tax thresholds with it. Do not pre-average inflation.
4. **Success and failure semantics are already implemented** — reuse `result.success` and the four
   `FailureCode`s rather than recomputing. `pre_pension_liquidity` is your bridge-failure
   probability; `portfolio_depletion` is your depletion probability. Note a year can carry more
   than one code, so count distinct paths, not failure events.
5. **Performance**: ~2 ms per path, so ~20 s for 10,000 paths single-threaded. Run it in a worker
   (§85) and/or shard across cores. Note that `solverTolerance` is **not** a useful speed knob any
   more: measured across `1e-6`, `1e-4`, `0.01` and `1`, runtime moves only 1.95 → 1.80 ms and the
   actual over-funding stays at 4.6e-13, because false position lands on the root before the
   tolerance ever binds. Look for wins in parallelism, not in loosening the solver, and do not
   reduce the configured path count to hit a time budget.
6. **Percentiles and `wealthByAge`** should read `years[t].accessibleWealth` / `lockedWealth` /
   `netWorth` and deflate by `closingInflationIndex` for today's-money presentation.
7. **Reproducibility metadata**: `projection.assumptions` already carries `engineVersion`
   (`deterministic-ledger-v1`), `taxConfigVersion`, `taxPolicy`, `marketAssumptionVersion`,
   `pathIndex` and the resolved `options`. Feed these into `simulationMetadataSchema` alongside
   your `returnGeneratorVersion`.
8. **Do not add dynamic withdrawal strategies or spending cuts.** They are explicitly out of V0.3
   scope and would turn modelled failures into false successes.

If you do need to change a shared interface, note that chunk 2 changed none: `LedgerYearDetail`
extends `LedgerYear` and `DeterministicProjection` extends `ProjectionResult`, so chunk 1's
contracts are untouched and both are assignable where the base types are expected.

## Commands

```sh
export PATH="/tmp/node-v24.21.0-darwin-arm64/bin:$PATH"   # if this temp Node is still present
npm ci
npm run check      # typecheck + 92 tests + production build
npm run ledger     # full lifetime ledger for the section 79 profile
npm run demo       # chunk 1's tax examples
```

Node 24 is required (`engines: >=24 <25`). The `/tmp` Node path is a local convenience from chunk 1,
not a repository dependency.
