# V0.3 requirements tracking

This checklist tracks section 88 of the comprehensive spec. “Foundation” means contracts/primitives exist; it does not claim the full lifetime behaviour is implemented. Additional requirements inside the full spec remain authoritative.

After chunk 4 the deterministic ledger and Monte Carlo analysis are implemented and tested, and the Overview and FIRE & Monte Carlo screens run them for real in the browser. Solver, property, marginal-allocation, saved-scenario and attribution requirements remain open. See `handoffs/chunk-4.md` for the 138-test verification and the measured in-browser 10,000-path run; `handoffs/chunk-3.md` holds the engine benchmark. `docs/v0.3-requirements-checklist.md` holds the longer per-item acceptance analysis kept for the package-10 audit.

| # | MUST requirement | Owning chunks | Status / evidence after chunk 4 |
| --- | --- | --- | --- |
| 1 | UK tax model | 1, 2 | Annual primitives, plus one joint annual assessment per projected year in the ledger; `tests/tax.test.ts`, `tax-allocation.test.ts`, and `ledger-reconciliation.test.ts` reproduces the documented £9,927.05 / £3,055.60 reference case |
| 2 | Scotland support | 1 | Implemented and tested alongside rest of UK; the ledger selects the region's config every year |
| 3 | Salary and spending | 1, 2, 4 | **Done.** Real salary growth, bonus, other and retirement employment income, household spending and investable surplus per year; `ledger-reconciliation.test.ts`, `ledger-accounts.test.ts`. All editable on Overview, with the year's cash flow, savings rate and marginal rate read from the ledger; `presentation-screens.test.ts` |
| 4 | Essential/discretionary expenses | 1, 2, 4 | **Done.** Split tracked per year; essential drives the emergency reserve, liquidity coverage and failure classification. Floor/target/comfort are separate runs, with no dynamic in-run cuts; `ledger-golden.test.ts`. Both parts are editable, the level is selectable on the FIRE screen, and the ledger browser shows each year's split |
| 5 | £1,300/£1,650/£2,000 cases | 1, 2, 4, 8, 9 | **Done in engine, including probability.** `monthlyHouseholdOverride` runs common-path £1,300/£1,650/£2,000 cases; `monte-carlo.test.ts` asserts surplus, capital-target, wealth and probability effects. The FIRE screen exposes the override so any case can be run one at a time; the saved side-by-side matrix remains chunks 8/9. |
| 6 | Pension | 1, 2 | **Done in engine.** Contributions added once per year, access-age gating, UFPLS split, lifetime lump-sum tracking, taxed withdrawals grossed up, pension and SIPP as separate balances; `ledger-accounts.test.ts` |
| 7 | ISA | 1, 2 | **Done in engine.** Annual capacity capped, reset at the tax-year boundary, prior-year use respected, holdings and withdrawals wholly untaxed; `ledger-accounts.test.ts` |
| 8 | GIA | 1, 2 | **Done in engine.** Cost basis, carried losses, turnover-driven realisation, dividends taxed and added to base cost, one annual CGT exemption, unrealised gains deferred; `ledger-accounts.test.ts` |
| 9 | Cash | 1, 2 | **Done in engine.** Distinct settlement account with taxable interest, emergency-reserve gating and liquidity coverage; `ledger-accounts.test.ts` |
| 10 | Accessible vs locked capital | 1, 2, 3, 4 | **Done.** Freedom Capital and Retirement Capital reported separately every year and never collapsed; property equity excluded until an explicit release action is modelled; `ledger-reconciliation.test.ts`, `engine-units.test.ts`. Overview shows the three separately and the FIRE screen plots each category on its own; `presentation-screens.test.ts` asserts they are never combined into one headline |
| 11 | Deterministic yearly projection | 2, 4 | **Done.** Reconciled year-by-year ledger carrying every section 6 line item; per-account and aggregate identities asserted across all 64 years; `npm run ledger` prints it. Overview browses every year in today's money or nominal, each row expandable to its full line items, and labels the deterministic run as not a FIRE-safety measure |
| 12 | Monte Carlo returns | 3 | **Done.** Pluggable calibrated lognormal returns, validated Gaussian log-growth correlation, per-wrapper ledger allocation; `monte-carlo-generator.test.ts`. |
| 13 | FIRE probability | 3, 4 | **Done.** Full-lifecycle path success, bridge/depletion and overlapping observed failure probabilities; golden C/D/E in `monte-carlo.test.ts`. Shown live against the target on the FIRE screen, with the overlap caveat next to the bars; a 10,000-path run in Chrome reproduced 68.98% success, 0.32% bridge and 31.02% depletion |
| 14 | Sequence risk | 3, 4 | **Done.** First-five-year real drawdown, two-years-spending liquidity, conditional recovery median and censored counts; controlled sequence tests in `monte-carlo.test.ts`. Presented on the FIRE screen with recovered/unrecovered counts and the conditional-median caveat; `presentation-screens.test.ts` |
| 15 | Pre-pension bridge | 2, 3, 4 | **Done.** Chunk-2 bridge accounting reused; locked-pension probability is 100% failure in golden E. Distinct-path counts tested in `monte-carlo.test.ts`. Bridge length, required bridge capital, its coverage ratio and the bridge-failure probability are all on screen |
| 16 | FIRE-age probability curve | 6 | Pending |
| 17 | Reverse savings solver | 6 | Pending |
| 18 | Reverse gross-salary solver | 6 | Pending |
| 19 | Marginal pension/ISA/GIA | 7 | Tax primitives and a whole-life ledger to re-run are ready; optimiser pending |
| 20 | Single-property model | 5 | Input/ledger contracts supplied. The ledger rejects a non-null property rather than omitting its cash flows |
| 21 | Property leverage | 5 | Pending |
| 22 | Rent vs buy | 5 | Pending |
| 23 | Named scenarios | 8 | Versioned scenario schema supplied; storage/comparisons pending |
| 24 | Deterministic stress cases | 9 | Pending. Chunk 9 can drive them through this ledger by supplying shocked `MarketPath`s |
| 25 | Percentiles | 3, 4 | **Done.** Mean, P10/P25/P50/P75/P90, observed minimum, FIRE capital and real age-boundary asset distributions; known-quantile and zero-volatility aggregation tests. Terminal wealth and opening FIRE capital are tabulated in full, and every age boundary is drawn as a percentile fan with the same numbers in an adjacent table |
| 26 | Seeded reproducibility | 3, 4 | **Done.** Seed/index streams, scenario-independent shocks, full extended metadata, replay and identical local/worker/out-of-order batch results; generator and simulation tests. The full metadata record is shown after every run, and browser/local result equality was confirmed in Chrome for the first time in chunk 4 |
| 27 | Sensitivity | 9 | Pending |
| 28 | Income-vs-allocation attribution | 9 | Pending |
| 29 | Spending sensitivity | 2, 8, 9 | **Engine probability comparisons available.** Shared-path configurable monthly spending and fixed floor/target/comfort runs tested alongside deterministic double effects; sensitivity UI and broader analysis remain chunks 8/9. |

## UI delivery

All eight destinations are reachable in the shell from chunk 4. "Reachable, labelled" means the tab
exists and states which package owns it; it renders no illustrative figures.

| Reference tab | Owning chunk | Status |
| --- | --- | --- |
| Overview | 4 | **Built.** Full profile editing with runtime validation, separable liquid/pension/property wealth, the year's cash flow and marginal rate, the reference FIRE ratios, and a browsable annual ledger in today's money or nominal |
| FIRE & Monte Carlo | 4 | **Built.** Live `runMonteCarloBrowser` runs with progress, cancellation, error states and stale-result invalidation; probabilities, percentiles, age-level fans, sequence risk, diagnostics and reproducibility metadata |
| FIRE Age Curve | 6 | Reachable, labelled |
| Marginal Allocation | 7 | Reachable, labelled |
| Reverse Solver | 6 | Reachable, labelled |
| Scenario Comparison | 8 | Reachable, labelled |
| Property & Leverage | 5 | Reachable, labelled. The ledger still rejects a non-null property rather than omitting its cash flows |
| Where It Comes From | 9 | Reachable, labelled |

## Golden cases (sections 86–87)

- Known income tax, NI, contribution relief, dividends, CGT: implemented, 50 tests after chunk 1.
- FIRE £40k/4% = £1m (scenario A), compound growth, and the spending double effect (scenario F): **done in chunk 2**; 92 tests overall.
- Certain success (C), certain failure (D) and locked-wealth failure (E): **done deterministically and probabilistically**; `monte-carlo.test.ts` covers C/D/E across paths.
- Zero-volatility equality: the ledger already consumes a supplied `MarketPath`, and `ledger-reconciliation.test.ts` pins that an explicit means path reproduces the deterministic run. Chunk 3 now asserts generator zero-volatility equality and complete ledger/real-distribution equality.
- Mortgage amortisation, and £300k/£60k leveraged appreciation (scenario B): chunk 5.
- Seeded repeatability and sampling statistics: **done**, `monte-carlo-generator.test.ts` and `monte-carlo.test.ts`.
- Section 80 dashboard figures (£75,000 liquid, £25,000 pension, £100,000 net worth, £19,800 target spending, £565,714 reference FIRE number): **done in chunk 4**, asserted against the engine in `presentation-screens.test.ts` and confirmed rendering in Chrome.
- Release acceptance across all requirements and screens: chunk 10.

Maintain this checklist as each package lands; add test/file references as evidence. Do not treat prototype outputs or an interface alone as finished functionality.
