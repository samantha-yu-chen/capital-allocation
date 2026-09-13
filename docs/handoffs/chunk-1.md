# Chunk 1 handoff — ready for Claude's chunk 2

## Delivered

Strict TypeScript project, Node 24 test/CLI tooling, React/Vite foundation page reusing the Organic stylesheet, npm lockfile, Zod input validation, shared profile/scenario/ledger/market/result contracts and the spec's example fixture.

The 2026/27 tax engine covers Scotland/rest-of-UK annual income tax, personal-allowance taper and allocation, savings/dividend taxation, NI A/C, pension contribution methods, employer match and NI shareback, pension allowances/taper/MPAA, ordinary CGT and capital losses, aggregate GIA disposals, ISA capacity and a pension-withdrawal tax-free split. Rules and effective dates are versioned and sourced.

The web page deliberately identifies itself as a foundation build. No FIRE, property or lifetime-projection output is claimed yet.

## Read first

1. `docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md` — product authority.
2. `docs/implementation-work-packages.md`, package 2 — your assignment.
3. `docs/architecture-decisions.md` — units, age/event timing and module boundaries.
4. `docs/tax-rules-2026-27.md` — sources, assumptions and supported cases.
5. `src/domain/contracts.ts`, `fixtures.ts`, `src/domain/tax/index.ts` — shared code/API.

## Commands

With Node 24 and npm on PATH:

```sh
npm ci
npm run check
npm run demo
npm run dev
```

The development machine initially lacked Node. During this delivery the official ARM64 Node v24.21.0 archive was checksum-verified and extracted to `/tmp/node-v24.21.0-darwin-arm64`. If it still exists, this session can run commands with:

```sh
export PATH="/tmp/node-v24.21.0-darwin-arm64/bin:$PATH"
```

This temporary path is not a portable dependency or repository requirement. Install Node 24 normally on another machine. Dependency cache used for clean verification: `/tmp/capital-npm-cache`.

## API integration map

| Need | API / contract |
| --- | --- |
| Validate a loaded profile | `parseProfile(unknown)`; errors have field paths; unknown fields fail |
| Fresh baseline | `createExampleProfile()`; independent object per call |
| Select rule set | `getTaxConfig(region, taxYear)`; unsupported year fails |
| Constant-real tax projection | `scaleTaxConfig(baseConfig, cumulativeInflationIndex)` |
| Yearly employment/pension/net income | `calculateNetIncome(input, config)` |
| Explain pension tax and NI savings | `calculatePensionRelief(input, config)` |
| Tax all taxable income sources together | `calculateIncomeTax(input, config)` |
| Check pension capacity | `assessPensionAllowance(input, config)` |
| Check ISA capacity | `assessIsaContribution(requested, used, config)` |
| Model aggregate GIA sale | `realiseGiaDisposal(value, costBasis, proceeds)` |
| Annual realised-gain tax | `calculateCapitalGainsTax(input, config)` |
| Split pension withdrawal | `splitPensionWithdrawal(gross, remainingLumpSumAllowance, config)` |
| Ledger/path/result types | `BalanceSheet`, `LedgerYear`, `ProjectionResult`, `MarketYear`, `MarketPath`, `ReturnGenerator`, `SimulationResult` |

`taxInputFromProfile` adapts only the baseline opening-year salary example. The ledger must supply each year's actual salary, pensionable pay, NI category, contributions and other income. It must not repeatedly reuse opening-year values.

## Accounting integration cautions

- `netIncomeAfterPension` includes every income source passed into `calculateNetIncome`, including savings/dividends. If investment receipts remain within their account, do not also credit them to cash through this total. Use component tax results and ledger entries to reconcile once.
- Add `totalPensionAdded` once. `employerContribution` already includes sacrificed salary and NI shareback. Provider RAS relief is already in the gross pension contribution.
- Tax savings, dividends and taxable pension withdrawals jointly with other income: PA taper, PSA and band occupancy depend on the entire annual snapshot. After taxable disposals, use `remainingBasicRateBandForGains` for CGT. Do not apply the annual exemption afresh on each sale.
- `personalCashReduction` includes sacrificed salary, net-pay contributions and the NET RAS cash payment. `taxableEmploymentIncome` has already deducted sacrifice/net-pay. A second deduction would understate tax.
- Reset ISA/pension annual capacity at the tax-year boundary, not on every allocation. Preserve cost basis, carried losses and lifetime lump-sum usage. Carry-forward allowance in the input is already verified; do not recycle it every projected year.
- `PensionLimitError` marks contributions that the supported model cannot process. Surface an infeasible profile/candidate; do not silently treat the rejected contribution as tax-free, cap it or create an invented excess charge.
- Negative investable surplus is possible. A valid numeric input is not proof of plan feasibility. Fund shortfalls only from accessible accounts; record failures when spending cannot be met.
- `property: null` is the baseline. A non-null property contract is reserved for chunk 5; until integrated, reject it clearly or identify it as unsupported rather than omitting its cash flows from an apparently complete result.
- Input schema includes retirement floor/target/comfort and optional phases. Fixed target spending is the initial policy; do not introduce dynamic spending cuts that silently turn failure into success.

## Known limitations to preserve visibly

Tax-year coverage is 2026/27 with an explicit constant-real future assumption. NI is annualised. Pension annual-excess charges, mid-year MPAA transitions, security-level GIA matching, special tax reliefs and property taxation are not implemented here. Low-income net-pay cases flag a later-year HMRC top-up that is not modelled as cash. Minimum-wage working hours and eligible carry-forward are caller-supplied, not inferred. Full details are in the tax-rules document.

Some future profile inputs (for example a separate SIPP contribution schedule, explicit fees or alternative allocation policies) may need schema extensions in the owning chunks. Keep existing names and conventions stable where possible; version persisted schemas if changing their meaning. Typed result interfaces are trusted engine outputs; input/scenario/metadata schemas validate external data.

## Verification

- Strict typecheck, all 50 tests and production build pass with Node 24.
- Tests cover independent tax examples/boundaries, contribution cash reconciliation, CGT/loss accounting, runtime validation and correlation-matrix checks.
- PA allocation additionally checked against an independent dense-search oracle across 56 mixed-income/region/RAS cases.
- `npm run demo` runs all six region/contribution-method combinations.
- Pinned dependencies were audited after updating Vite to 7.3.6: zero reported vulnerabilities at verification time.
- Clean verification of code commit `d595033`: exported tracked files into a fresh directory with `git archive HEAD`; `npm ci --offline --cache /tmp/capital-npm-cache --no-audit`, `npm run check` and `npm run demo` all passed. This confirms the build does not rely on untracked files or the working directory's `node_modules`.

## Next checkpoint

Start package 2 with an accumulation-only annual ledger that reconciles opening balances, income, tax, contributions, spending, returns and closing balances. Then add retirement withdrawals, pension/state-pension timing, inflation, GIA disposal tax and failure records. Finish with the spec's deterministic golden cases and a CLI projection of the baseline. Update `docs/requirements-checklist.md` and leave a chunk-2 handoff for Codex's Monte Carlo work.
