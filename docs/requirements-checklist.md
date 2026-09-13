# V0.3 requirements tracking

This checklist tracks section 88 of the comprehensive spec. “Foundation” means contracts/primitives exist; it does not claim the full lifetime behaviour is implemented. Additional requirements inside the full spec remain authoritative.

After chunk 2 the deterministic lifetime ledger is implemented and tested. Every Monte Carlo, solver, property, scenario and UI requirement is still open. `docs/v0.3-requirements-checklist.md` holds the longer per-item acceptance analysis kept for the package-10 audit.

| # | MUST requirement | Owning chunks | Status / evidence after chunk 2 |
| --- | --- | --- | --- |
| 1 | UK tax model | 1, 2 | Annual primitives, plus one joint annual assessment per projected year in the ledger; `tests/tax.test.ts`, `tax-allocation.test.ts`, and `ledger-reconciliation.test.ts` reproduces the documented £9,927.05 / £3,055.60 reference case |
| 2 | Scotland support | 1 | Implemented and tested alongside rest of UK; the ledger selects the region's config every year |
| 3 | Salary and spending | 1, 2, 4 | **Done in engine.** Real salary growth, bonus, other and retirement employment income, household spending and investable surplus per year; `ledger-reconciliation.test.ts`, `ledger-accounts.test.ts`. UI pending (chunk 4) |
| 4 | Essential/discretionary expenses | 1, 2, 4 | **Done in engine.** Split tracked per year; essential drives the emergency reserve, liquidity coverage and failure classification. Floor/target/comfort are separate runs, with no dynamic in-run cuts; `ledger-golden.test.ts` |
| 5 | £1,300/£1,650/£2,000 cases | 1, 2, 8, 9 | **Runnable deterministically** through `monthlyHouseholdOverride`; both spending effects asserted in `ledger-golden.test.ts` and printed by `npm run ledger`. Probability and matrix runs pending (chunks 6, 8) |
| 6 | Pension | 1, 2 | **Done in engine.** Contributions added once per year, access-age gating, UFPLS split, lifetime lump-sum tracking, taxed withdrawals grossed up, pension and SIPP as separate balances; `ledger-accounts.test.ts` |
| 7 | ISA | 1, 2 | **Done in engine.** Annual capacity capped, reset at the tax-year boundary, prior-year use respected, holdings and withdrawals wholly untaxed; `ledger-accounts.test.ts` |
| 8 | GIA | 1, 2 | **Done in engine.** Cost basis, carried losses, turnover-driven realisation, dividends taxed and added to base cost, one annual CGT exemption, unrealised gains deferred; `ledger-accounts.test.ts` |
| 9 | Cash | 1, 2 | **Done in engine.** Distinct settlement account with taxable interest, emergency-reserve gating and liquidity coverage; `ledger-accounts.test.ts` |
| 10 | Accessible vs locked capital | 1, 2, 3 | **Done in engine.** Freedom Capital and Retirement Capital reported separately every year and never collapsed; property equity excluded until an explicit release action is modelled; `ledger-reconciliation.test.ts`, `engine-units.test.ts` |
| 11 | Deterministic yearly projection | 2 | **Done.** Reconciled year-by-year ledger carrying every section 6 line item; per-account and aggregate identities asserted across all 64 years; `npm run ledger` prints it; explicitly labelled as not a FIRE-safety measure |
| 12 | Monte Carlo returns | 3 | Generator/path contracts supplied; the ledger already runs off a supplied `MarketPath`. Sampling pending |
| 13 | FIRE probability | 3 | Pending. Chunk 2 deliberately reports no probability |
| 14 | Sequence risk | 3 | Pending |
| 15 | Pre-pension bridge | 2, 3 | **Done deterministically.** Bridge phase, bridge years and required bridge capital reported; the locked-pension bridge failure is golden scenario E in `ledger-golden.test.ts`. Probability across paths pending (chunk 3) |
| 16 | FIRE-age probability curve | 6 | Pending |
| 17 | Reverse savings solver | 6 | Pending |
| 18 | Reverse gross-salary solver | 6 | Pending |
| 19 | Marginal pension/ISA/GIA | 7 | Tax primitives and a whole-life ledger to re-run are ready; optimiser pending |
| 20 | Single-property model | 5 | Input/ledger contracts supplied. The ledger rejects a non-null property rather than omitting its cash flows |
| 21 | Property leverage | 5 | Pending |
| 22 | Rent vs buy | 5 | Pending |
| 23 | Named scenarios | 8 | Versioned scenario schema supplied; storage/comparisons pending |
| 24 | Deterministic stress cases | 9 | Pending. Chunk 9 can drive them through this ledger by supplying shocked `MarketPath`s |
| 25 | Percentiles | 3 | Result interfaces supplied; implementation pending |
| 26 | Seeded reproducibility | 3 | Seed/metadata contracts supplied; generator tests pending |
| 27 | Sensitivity | 9 | Pending |
| 28 | Income-vs-allocation attribution | 9 | Pending |
| 29 | Spending sensitivity | 2, 8, 9 | Deterministic spending sensitivity works today (spending level is an engine option and both effects are asserted). Probability-based sensitivity pending (chunks 8, 9) |

## UI delivery

| Reference tab | Owning chunk | Status |
| --- | --- | --- |
| Overview | 4 | Pending |
| FIRE & Monte Carlo | 4 | Pending |
| FIRE Age Curve | 6 | Pending |
| Marginal Allocation | 7 | Pending |
| Reverse Solver | 6 | Pending |
| Scenario Comparison | 8 | Pending |
| Property & Leverage | 5 | Pending |
| Where It Comes From | 9 | Pending |

## Golden cases (sections 86–87)

- Known income tax, NI, contribution relief, dividends, CGT: implemented, 50 tests after chunk 1.
- FIRE £40k/4% = £1m (scenario A), compound growth, and the spending double effect (scenario F): **done in chunk 2**; 92 tests overall.
- Certain success (C), certain failure (D) and locked-wealth failure (E): **done deterministically in chunk 2**. Their probability form needs chunk 3.
- Zero-volatility equality: the ledger already consumes a supplied `MarketPath`, and `ledger-reconciliation.test.ts` pins that an explicit means path reproduces the deterministic run. Closing this case needs chunk 3's sampled generator at zero volatility.
- Mortgage amortisation, and £300k/£60k leveraged appreciation (scenario B): chunk 5.
- Seeded repeatability and sampling statistics: chunk 3.
- Release acceptance across all requirements and screens: chunk 10.

Maintain this checklist as each package lands; add test/file references as evidence. Do not treat prototype outputs or an interface alone as finished functionality.
