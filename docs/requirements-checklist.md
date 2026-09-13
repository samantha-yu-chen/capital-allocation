# V0.3 requirements tracking

This checklist tracks section 88 of the comprehensive spec. “Foundation” means contracts/primitives exist; it does not claim the full lifetime behaviour is implemented. Additional requirements inside the full spec remain authoritative.

| # | MUST requirement | Owning chunks | Status / evidence after chunk 1 |
| --- | --- | --- | --- |
| 1 | UK tax model | 1, 2 | Annual primitives implemented; `tests/tax.test.ts`, `tax-allocation.test.ts`; supported cases in tax-rules document |
| 2 | Scotland support | 1 | Implemented and tested alongside rest of UK |
| 3 | Salary and spending | 1, 2, 4 | Validated input + tax demo; lifetime cash flow pending |
| 4 | Essential/discretionary expenses | 1, 2, 4 | Validated inputs; expense engine pending |
| 5 | £1,300/£1,650/£2,000 cases | 1, 8, 9 | Fixture/schema supplied; scenario runs pending |
| 6 | Pension | 1, 2 | Contribution methods/relief/limits/withdrawal split tested; account lifecycle pending |
| 7 | ISA | 1, 2 | Allowance assessment tested; account lifecycle pending |
| 8 | GIA | 1, 2 | Cost basis, disposal, dividends, CGT/loss primitives tested; annual account ledger pending |
| 9 | Cash | 1, 2 | Separate account contract and savings-tax primitive; cash ledger pending |
| 10 | Accessible vs locked capital | 1, 2, 3 | Separate contracts; access/failure logic pending |
| 11 | Deterministic yearly projection | 2 | Ledger/result interfaces supplied; implementation pending |
| 12 | Monte Carlo returns | 3 | Generator/path contracts supplied; implementation pending |
| 13 | FIRE probability | 3 | Pending |
| 14 | Sequence risk | 3 | Pending |
| 15 | Pre-pension bridge | 2, 3 | Pending |
| 16 | FIRE-age probability curve | 6 | Pending |
| 17 | Reverse savings solver | 6 | Pending |
| 18 | Reverse gross-salary solver | 6 | Pending |
| 19 | Marginal pension/ISA/GIA | 7 | Tax primitives ready; optimiser pending |
| 20 | Single-property model | 5 | Input/ledger contracts supplied; implementation pending |
| 21 | Property leverage | 5 | Pending |
| 22 | Rent vs buy | 5 | Pending |
| 23 | Named scenarios | 8 | Versioned scenario schema supplied; storage/comparisons pending |
| 24 | Deterministic stress cases | 9 | Pending |
| 25 | Percentiles | 3 | Result interfaces supplied; implementation pending |
| 26 | Seeded reproducibility | 3 | Seed/metadata contracts supplied; generator tests pending |
| 27 | Sensitivity | 9 | Pending |
| 28 | Income-vs-allocation attribution | 9 | Pending |
| 29 | Spending sensitivity | 8, 9 | Pending |

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

- Known income tax, NI, contribution relief, dividends, CGT: implemented, 50 tests overall after chunk 1.
- FIRE £40k/4% = £1m; compound growth; spending double effect: chunk 2.
- Mortgage amortisation; £300k/£60k leveraged appreciation: chunk 5.
- Certain success/failure; locked-wealth failure; zero-volatility equality; seeded repeatability and sampling statistics: chunks 2/3.
- Release acceptance across all requirements and screens: chunk 10.

Maintain this checklist as each package lands; add test/file references as evidence. Do not treat prototype outputs or an interface alone as finished functionality.
