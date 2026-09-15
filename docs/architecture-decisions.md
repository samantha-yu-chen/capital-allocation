# Architecture decisions — chunk 1

## ADR 001: one TypeScript model, two presentations

Use strict TypeScript with pure domain functions, React/Vite for web presentation and Node 24 for tests/CLI. Zod validates untrusted inputs. The model has no React, DOM, network or filesystem dependency. Browser workers can consume the same functions later. Native Node tests avoid introducing a second test runtime. Dependency versions and npm lockfile make installation reproducible.

`design/` remains the UI reference. Its approximate calculator and generated runtime are not imported by production calculations. The minimal application links its existing Organic tokens; full screens belong to chunk 4.

## ADR 002: units and lifecycle contract

- Money is finite GBP in `number`, not integer pence. Rates are fractions (`0.05`, not `5`). Do not round intermediate results. Display rounded pence; tests use explicit tolerances. This is annual planning, not payroll/filing software.
- Profile amounts are today's-money values. Market means are nominal arithmetic annual means. Salary growth is explicitly real. Compound inflation converts between nominal ledger values and real presentation values.
- Projection years are half-open `[age, age + 1)`. Simulate `endAge - currentAge` years. Retirement starts at `targetFireAge`; pension access starts at `accessAge`. End age is the boundary after the last funded year, not one additional year of spending.
- Proposed chunk-2 event order: opening balances → income/tax/contributions and spending/withdrawals → annual market returns → closing balances. Failure is recorded when obligations cannot be funded; subsequent returns cannot erase it. Chunk 2 must implement and test this order. Chunk 3 must reuse it.
- All account flows in `LedgerYear` are nonnegative except investment returns and the signed property-transaction cash flow. Inter-account transfers have matching withdrawal/contribution entries and are not income. Employer contributions enter pension once. No capital is created by pension relief twice.
- GIA cost basis can exceed its value. Pension and SIPP balances remain separate; portfolio and access policy are shared initially. Property equity is never automatically liquidated. Household totals are authoritative; optional per-person breakdown must reconcile.
- `constant_real` tax policy explicitly scales tax thresholds with cumulative inflation, preserving this year's structure in real terms. It does not forecast enacted future-year rates. Store the base configuration version plus full assumptions in simulation metadata.
- Current/FIRE expenses are supported in the contract; optional phase overrides use non-overlapping half-open ages. Detailed expense-category UI and housing cash-flow replacement are later work.

## ADR 003: ownership boundaries

`src/domain/contracts.ts` and `fixtures.ts` are the shared input/result contracts. `src/config/tax/` owns effective-year rules; `src/domain/tax/` owns annual tax calculations. `src/engine/` will own deterministic accounting and simulation implementations in chunks 2/3. `src/presentation/` adapts outputs; it must not duplicate tax formulas.

Return-generator, ledger and simulation interfaces are contracts, not claims that those engines are implemented. New schema versions require explicit migration; unknown fields and unsupported tax years fail rather than silently falling back. Do not import code from another agent's private scratch file. Update the handoff when a public contract changes.

## ADR 004: stochastic model and worker execution (chunk 3)

Use lognormal gross growth calibrated to arithmetic annual return means/standard deviations. The profile correlation matrix describes Gaussian log-growth shocks; arithmetic-return correlation is generally different. Preserve the existing profile schema and document the previously unspecified sampling convention through the generator version. Support positive-semidefinite/singular matrices.

Seed independent path streams by seed and absolute path index, consuming five normal shocks per year regardless of scenario decisions or zero-volatility variables. Every path uses the unchanged lifetime ledger and its failure records. Aggregate in path-index order for scheduling-independent results.

Extend result/metadata interfaces locally in `monte-carlo/`, preserving the shared contracts. Report real closing wealth at age+1 and opening FIRE capital at FIRE age. Diagnostics are associations; direct ledger failure events remain separate.

Use reusable batch workers and a browser coordinator so both accounting and final percentile sorting stay off the UI thread. Reject cancelled/failed runs instead of publishing partial probabilities. Runtime/count limits never silently change simulation count or solver precision.

## ADR 005: property inside the same ledger (chunk 5)

Retain the established event order and per-account reconciliation identities. Property acquisition,
monthly mortgage amortisation aggregated annually, rental cash flow and joint tax, explicit sale,
and post-flow appreciation run inside every deterministic/stochastic projection. Failed purchases
are atomic failures; equity never funds a shortfall without a sale. Unpaid mortgage obligations
remain debt. Principal is cash outflow and equity accumulation, not consumption.

Property location and buyer eligibility are independent inputs; optional schema-1 extensions and
the property-tax version are documented in `property-model.md`. Rent replacement removes the
explicit included-rent component during owner occupation from each spending schedule. No dynamic
spending cuts. Reference FIRE arithmetic remains the entered budget before property adjustments,
labelled accordingly; full-plan success includes all housing obligations.

The rent/invest comparison uses identical generated path objects and opening financial assets.
An explicit `rentInvestment` ledger option deploys available cash from the avoided purchase budget
at acquisition age, respecting the cash reserve and ISA limit. No deposit is credited. A dedicated
worker handles comparison computation and cancellation; presentation calculations remain in
`src/presentation/view/`.

## ADR 006: one-off marginal actions and constrained usable-wealth comparisons (chunk 7)

Marginal allocation is a one-off action in the first model year, not a recurring profile salary
change or an untaxed opening-asset injection. `LedgerOptions.marginalAction` defaults to null;
ordinary runs retain their previous flows. Gross earnings use a non-pensionable bonus and the
configured workplace pension method/match/shareback. Existing cash uses opening cash and additional
RAS with relief settled and recycled in-year. Extra workplace contributions are an explicit tax
input. Reject the whole allocation when cash, ISA, pension, reserve or debt capacity is insufficient.

The action participates in the existing income/tax, spending/funding and surplus-allocation stages.
Transfers use both account entries; no reconciliation identity is relaxed. Property deposit adds
to the configured purchase commitment and reduces its debt, while overpayment reduces existing
principal and recasts the remaining original term. Future deposits remain cash until purchase;
there is no ring-fenced account, automatic borrowing or equity release.

Every destination is a full common-path lifetime simulation. A coordinator drives the existing
worker pool and requests optional compact per-path allocation observations. Ordinary Monte Carlo
runs do not pay for these observations. Pair samples by absolute path index and assert the seed,
count, generator and market assumptions before calculating comparison errors. Cancelled/failed
runs publish no partial ranking.

Rank the equal-weight mean after-tax usable financial wealth at FIRE, access (if in horizon) and
terminal ages, subject to sampled cash-reserve/liquid-years/debt constraints and a 95% lower-bound
FIRE probability test. Value hypothetical liquidation in one tax year without employment or
contributions, with configured other/state pension income, actual GIA basis/losses and remaining
pension tax-free allowance. Exclude inaccessible pension and unsold property from usable wealth;
report their net-worth effect and debt separately. This is an explicit V0.3 valuation approximation,
not an optimal drawdown policy or a forced transaction in the ledger. Pairwise standard errors
qualify rankings; static wrapper ordering and arbitrary liquidity prices are prohibited.

## ADR 007: named scenarios, versioned persistence and the scenario matrix (chunk 8)

A scenario is a name, a validated `Profile` and the plan-level run options — the retirement level,
the household spending override, the emergency-reserve policy and the surplus destination. Solver
tolerances are transport, and `marginalAction`, `rentInvestment` and `measureAllocation` belong to
the marginal and property comparisons, so a scenario never carries them and a scenario run rejects a
request that sets them. A scenario's own options win over the transport defaults: the saved plan is
the thing being compared.

Persistence is a versioned document (`kind` + `version`) in local storage behind a `ScenarioStorage`
seam, so the same load path runs under Node. Nothing persisted is trusted: every stored profile is
re-parsed by `profileSchema`, a schema-1 document is migrated explicitly with its defaults stated,
and an unknown version, a wrong kind, a duplicate id or an invalid profile is rejected with reasons
rather than partially loaded. Constructors and mutators re-parse rather than alias, so editing one
scenario cannot reach into another; the tests assert that instead of relying on structural sharing.

Strategies are profile transforms, never result adjustments. ISA Heavy contributes only what still
earns the employer match on offer. Pension Tax-Band Optimised solves, with the real annual tax API,
the smallest contribution that vacates the top non-savings band the plan occupies, then caps it at
the largest rate the annual allowance supports across the projection — probed with the expected-value
ledger plus sampled paths, as the solver does. The cap is stated in the cell rather than hidden.
Balanced keeps the contractual policy. Property buys the configured purchase; a plan that already
owns a property keeps it under every strategy, and Property and No Property are then reported as
unsupported rather than inventing or deleting an asset.

Every cell reuses the entered seed, path count, horizon and market assumptions. `assertCommonPaths`
checks the candidate before it runs and `assertScenarioPaths` checks the returned metadata and path
indices afterwards; a saved scenario that changes the draw is reported incomparable, not compared.
Cache keys cover the whole validated profile, every resolved ledger option and the engine,
simulation, generator and tax-configuration versions. A reduced-count preview must be requested
explicitly, is keyed separately so it can never satisfy a full-count request, and is labelled
wherever it appears. A batch runs in the existing coordinator worker and keeps one simulation worker
set for all of its cells; batches are stateless and aggregation stays in path-index order, so reuse
cannot change a result. A cancelled batch publishes nothing — no partial matrix.

## ADR 008: intervention comparisons and synthetic annual stress paths (chunk 9)

Attribution means a finite set of explicit one-at-a-time interventions against the entered plan.
It is not a causal percentage decomposition or a Shapley allocation: intervention sizes differ,
interactions are not simulated as a combined plan, and effects must not be summed. The objective
is full-horizon funding success; terminal wealth, downside, property equity and accessible wealth
at the candidate's own target FIRE age remain separate outcomes.

Sensitivity changes nominal arithmetic means or volatility while retaining the same Gaussian
normal draws, seed, absolute path indices, horizon and correlation matrix. `assertSensitivityPaths`
wraps the inherited `assertCommonPaths` and `assertScenarioPaths` checks: only market moments may
differ, and actual returned profiles/options/versions/counts are checked. It does not relax the
strict common-path rules used by scenario or marginal comparisons. Difference uncertainty uses
the sum of marginal standard errors, an upper bound on the paired-difference standard error under
any covariance. A finding requires exceeding 1.96 times this conservative bound.

Synthetic stress paths begin from `deterministicPath` and replace only the specified annual
observations. Two optional `MarketYear` fields carry an employment multiplier and absolute mortgage
rate override. Employment scales salary, bonus and retirement employment, including pensionable
pay; other and state income remain. A mortgage override recasts that year's remaining-term payments;
the contractual rate schedule resumes when the override ends. All path values are validated in
the ledger. Effects on wealth/debt persist naturally after the shock window; the *override* does
not persist. A stress is a single assumed path, with no probability or actual historical backtest.

`LedgerOptions.pensionWithdrawalSurtaxRate` defaults to zero. This is an explicitly hypothetical
additional charge on the taxable part of a pension withdrawal, between 0 and 20pp, applied inside
the same gross-up funding solver and included in income/total tax and reconciliation. It does not
replace tax bands or tax-free-cash rules. Snapshot usable-wealth valuation includes it too. The
analysis tests +5pp and +10pp relative to the entered option and labels them as assumptions. The
ledger version changes; default-zero numerical outcomes remain unchanged.

One coordinator owns one reusable simulation pool for the whole attribution batch. Cache keys
include the complete profile, every resolved ledger option, and engine, simulation, generator,
tax, attribution and stress versions. Cache writes commit only after the entire analysis succeeds;
failed/cancelled batches publish nothing. Each evaluated cell retains its complete Monte Carlo
result and exact inputs so every reported figure can be recomputed independently.
