# V0.3 implementation work packages

Status: chunks 1–8 implemented and tested. See `handoffs/chunk-8.md` for named scenarios, versioned
persistence and the scenario matrix, 230 passing tests, real Chrome evidence and the chunk-9
assignment. Prior handoffs preserve the tax, ledger, Monte Carlo, property, solver and marginal
interfaces and their limitations. Chunks 9–10 remain open.

## Authority and baseline

- Product authority: `lifetime-capital-allocation-fire-optimisation-spec-v0.3.md`.
- Visual and interaction reference: `../design/Web page UI specification/Lifetime Capital Allocation & FIRE Model.dc.html` and its Organic design tokens.
- At planning time the repository contained the spec and a UI prototype, without a production application scaffold or test suite. Chunk 1 adds the scaffold, contracts, tax engine and tests. The prototype engine explicitly describes itself as approximate. Its pooled accessible assets, simplified tax, fixed GIA haircut, small simulation counts, and standalone property calculation must not become production modelling assumptions.
- Preserve the eight reference tabs: Overview; FIRE & Monte Carlo; FIRE Age Curve; Marginal Allocation; Reverse Solver; Scenario Comparison; Property & Leverage; Where It Comes From. Put additional required analysis inside these tabs rather than inventing an unrelated navigation system.

## Working agreement

Use one numbered package per agent assignment, in the order below. Suggested ownership alternates Codex and Claude, but packages are agent independent. Each package should finish with working code, relevant tests, a runnable demonstration, and a handoff. A package is a bounded deliverable, not a promise about a subscription's available tokens or ten hours of execution. If quota interrupts work, resume its recorded checkpoint before starting the next package.

Proposed implementation baseline: TypeScript domain/engine modules, React web presentation, and a worker for expensive browser simulations. Confirm this through a short architecture decision in package 1; the spec's Python snippets are suggested interfaces, not a mandated language. Keep calculation logic independent of React and the prototype runtime. No accounts, server infrastructure, or external financial integrations are needed for this scope.

Every handoff records: delivered scope, changed public interfaces, commands and test results, unresolved limitations, next checkpoint, and remaining spec requirements. Keep a requirements-to-package/test checklist. Do not report mock results as completed features. The final package integrates and verifies; numerical correctness belongs to each engine's owning package.

## 1. Shared contracts, application scaffold, and UK tax engine

Suggested owner: Codex. Dependencies: none. Spec: 35–40, 78–79, 83, 86, 90.

Goal: give all later work one validated input model and one trustworthy tax API.

- Scaffold application, engine modules, test commands, and the shared input/result schemas. Define units, age/year timing, nominal versus real values, assumption versions, ledger interfaces, market-path interfaces, and treatment of invalid inputs.
- Create versioned Scotland/rest-of-UK tax configuration. Verify the selected tax year's rules against official sources during implementation and record sources and effective dates.
- Implement income tax, NI, personal-allowance taper, pension relief/contribution methods, employer matching and NI shareback, allowances, dividend tax, and CGT calculation primitives. Define support boundaries for tax cases explicitly.
- Establish fixtures from the spec's example profile and shared contracts for assets, GIA cost basis, spending, property, scenarios, and simulation metadata.

Done when: build and tests run from a clean checkout; jurisdiction/tax-year selection works; tax boundaries, contribution-method differences, taper, and allowance cases have independent expected-value tests. Document the interfaces and a CLI/test-harness example for the next agent.

Checkpoint: scaffold and contracts → verified tax configuration → tax functions and tests.

## 2. Deterministic lifetime ledger and account behaviour

Suggested owner: Claude. Dependencies: 1. Spec: 6, 9–14, 20–31, 37–43, 74–79.

Goal: calculate a transparent, reconciled year-by-year lifetime projection.

- Track cash, ISA, GIA and pension separately, including contributions, allowances, gains realised versus unrealised, dividends, cost basis and withdrawal taxes.
- Model salary/bonus/other income, employer contributions, salary growth, household/shared spending, essential/discretionary spending, current/FIRE spending and floor/target/comfort inputs. Support lifestyle creep and a phase-ready spending schema.
- Handle inflation consistently, accumulation, retirement, pension access, configurable state-pension income/start age, emergency reserves and known capital needs.
- Implement configurable fixed withdrawal ordering, net-of-tax spending funding, accessible versus locked capital, and explicit failure records. Reserve property integration points without treating equity as cash.

Done when: annual cash/asset movements reconcile; the spec's reference FIRE arithmetic and spending double effect pass; locked pension cannot fund the bridge; negative cash flow and tax-bearing withdrawals are tested. A harness outputs the example profile's full ledger.

Checkpoint: accumulation ledger → retirement withdrawals → reconciliation and golden tests.

**Delivered.** `src/engine/` holds the ledger, funding solver, spending schedule, balance-sheet metrics and reference FIRE arithmetic. 92 tests pass; `npm run ledger` prints the section 79 profile's full lifetime ledger. Every "done when" clause above is covered by a named test. Remaining limitations, and the interfaces chunk 3 should build on, are in `handoffs/chunk-2.md`.

## 3. Reproducible Monte Carlo and FIRE analysis

Suggested owner: Codex. Dependencies: 2. Spec: 7–19, 44–46, 65–70, 84–87.

Goal: run the same lifetime accounting over market paths and produce defensible FIRE results.

- Add a pluggable parametric return generator, documented distribution assumptions, per-wrapper portfolio allocation, inflation handling, and validated correlation support.
- Seed paths independently of scenario decisions so all comparisons can reuse matching asset/year shocks.
- Produce success probability, bridge/depletion failures, mean and required percentiles, worst observed outcome, age-level distributions by asset category, and first-five-year sequence-risk metrics.
- Distinguish directly observed failure conditions from diagnostic contributing factors; do not present crash/inflation correlations as proven causes.
- Add batch execution, progress/cancellation interfaces, complete reproducibility metadata, and configurable simulation count with a 10,000-path default.

Done when: identical inputs reproduce results; zero volatility matches the deterministic ledger; sampling statistics satisfy justified tolerances; certain success, certain failure and locked-wealth fixtures pass. Record a 10,000-path runtime benchmark.

Checkpoint: path generator → lifecycle aggregation → statistical and cross-engine validation.

**Delivered.** `src/engine/monte-carlo/` implements seeded correlated paths, real outcome aggregation, sequence diagnostics and cancellable worker batches. 113 tests pass. A 10,000-path/64-year run completed in 5.949 seconds on four workers. Browser bundles compile; live browser verification remains explicit in the chunk-4 handoff. See `handoffs/chunk-3.md`.

## 4. Working application shell, Overview, and FIRE screens

Suggested owner: Claude. Dependencies: 3. Spec: 78–80; reference UI tabs 1–2.

Goal: users can enter a complete baseline and run the real model through the supplied design.

- Build reusable navigation, forms, tables, cards and charts using the Organic design system. Retain all eight tab destinations; clearly identify unfinished destinations.
- Implement profile, jurisdiction/year, income, household/spending, assets, pension, portfolio and simulation inputs, including validation and assumption explanations.
- Connect Overview to actual cash flow, distinct wealth metrics, reference FIRE target and a browsable annual ledger.
- Connect FIRE & Monte Carlo to live results, percentile charts, bridge/failure analysis, sequence risk and simulation metadata.
- Execute simulations in a worker; support progress, cancellation, error states and stale-result invalidation when inputs change. Use today's-money presentation consistently.

Done when: editing inputs changes real results; a 10,000-path run leaves the UI responsive; invalid input cannot silently enter the engine; both screens work at desktop/mobile widths and with keyboard navigation.

Checkpoint: shell/forms → Overview → worker and FIRE results.

**Delivered.** `src/presentation/view/` holds React-free view models; `src/presentation/web/` holds the shell and the two screens on the Organic design system. All eight tabs are reachable and the six unbuilt ones name their package. 138 tests pass. Verified in Chrome: a 10,000-path run completed in 4.0 s with a 19 ms longest frame gap, reproducing the chunk-3 benchmark; cancellation, stale invalidation and input validation all behave. See `handoffs/chunk-4.md`.

## 5. Integrated property engine and Property & Leverage screen

Suggested owner: Codex. Dependencies: 4. Spec: 47–56, 75, 87–88; reference UI tab 7.

Goal: buying, owning or renting changes the same lifetime model used by FIRE.

- Model one property, deposit funding, purchase/sale costs and applicable property taxes, mortgage amortisation/type, refinance-rate scenarios, maintenance, insurance, service charges and rental occupancy/income/costs where applicable.
- Integrate property value, debt service, rental taxation and cash flow into deterministic and stochastic paths. Count equity as spendable only through an explicitly modelled action.
- Compare buy against rent-and-invest on matching market paths, including deposit opportunity cost. Replace rent correctly and avoid counting mortgage payments twice.
- Complete the property screen with equity, LTV, debt-service coverage, downside leverage and the required 3/5/7/9% mortgage scenarios.

Done when: amortisation and leverage examples pass; purchase funding reconciles; housing costs are counted once; property can change FIRE success and cause liquidity/mortgage stress; rent/buy outputs are full-plan comparisons.

Checkpoint: mortgage/property ledger → lifecycle integration → property screen and rent/buy.

**Delivered.** The same ledger now integrates property acquisition, ownership, rental tax, mortgage service and explicit sale on deterministic and stochastic paths. The Property screen provides validated inputs, leverage, rate scenarios and full-plan paired rent/invest comparisons in a worker. 157 tests pass; real Chrome verification includes 10,000 property paths, 10,000 paired comparisons and cancellation. See `handoffs/chunk-5.md` and `property-model.md`.

## 6. Reverse Solver and FIRE Age Curve screens

Suggested owner: Claude. Dependencies: 5. Spec: 17, 32–33, 60; reference UI tabs 3 and 5.

Goal: answer when the plan reaches its target and what income/savings changes are required.

- Implement required annual savings and gross-salary solvers, plus age and spending-reduction modes shown by the reference UI. Provide starting-capital and pension-contribution searches described in section 60 through the same bounded solver framework.
- Reuse seeds and engine assumptions, enforce allowances/liquidity/spending floors, and handle already-achieved targets, unreachable targets, bounds and numerical tolerance explicitly.
- Avoid blindly assuming monotonic behaviour for every contribution strategy; confirm returned candidates against the full model and show precision appropriate to Monte Carlo uncertainty.
- Wire the solver and age-curve screens, earliest qualifying age, target probability and sensitivity examples to real results.

Done when: returned solutions satisfy the target on re-evaluation; infeasible searches are labelled; pension boundaries and spending-search direction are tested; both screens handle progress/cancellation/stale results.

Checkpoint: savings/salary searches → other searches and age curve → screens.

**Delivered.** `src/engine/solver.ts` searches six inputs — gross salary, annual savings, FIRE age, retirement spending, extra starting capital and the employee pension contribution — scoring every candidate with the complete lifetime model on the profile's own seed and path indices. `src/engine/fire-curve.ts` runs every candidate FIRE age the same way. Already-met targets, bounds nothing reaches, unsupported candidates, non-monotone inputs and an exhausted evaluation budget are all explicit result states, and every returned candidate is re-run from scratch to confirm it. The FIRE Age Curve and Reverse Solver screens run both engines in a coordinator worker with progress, cancellation and stale-result invalidation. 184 tests pass; real Chrome verification covers a 10,000-path curve and solver run, cancellation and responsive layout. See `handoffs/chunk-6.md`.

## 7. Marginal capital allocation engine and screen

Suggested owner: Codex. Dependencies: 6. Spec: 2, 38, 43, 57–59, 77, 82; reference UI tab 4.

Goal: compare the next increment of capital on an economically consistent basis.

- Distinguish extra gross earnings from existing after-tax cash; apply exact incremental taxes/relief and detect tax boundaries from configuration.
- Compare pension, ISA, GIA, cash, mortgage overpayment and property deposit, with eligibility, allowance, liquidity and debt constraints. Label infeasible options explicitly.
- Rerun complete lifetime paths using common random numbers; show changes in wealth at target ages, terminal outcomes, probability, downside, accessible wealth, tax and debt.
- Rank against the constrained after-tax usable-wealth objective. Explain dominance, near-equivalence and assumption sensitivity without turning tiny simulation differences into firm recommendations.

Done when: all six destinations are computed or explicitly ineligible; no fixed GIA haircut or static wrapper ordering remains; tests cover allowance limits, pension lock-up and tax boundaries; the screen explains the comparison basis and tradeoffs.

Checkpoint: candidate funding and constraints → comparison/ranking → screen.

**Delivered.** `marginal-funding.ts` and the lifetime ledger compare one-off gross earnings or
existing after-tax cash across pension, ISA, GIA, cash, mortgage overpayment and property deposit.
`compareMarginal` reruns full common paths and ranks after-tax usable wealth only under explicit
probability, reserve, liquidity and debt constraints, with paired sampling uncertainty and
infeasible reasons. The Marginal Allocation screen uses the coordinator/worker pool, announces
cost, reports progress and discards cancelled/stale results. 208 tests pass; Chrome acceptance
covers both funding bases, actual property destinations, responsive 10,000-path work, cancellation
and desktop/mobile layout. See `handoffs/chunk-7.md`.

## 8. Named scenarios and Scenario Comparison screen

Suggested owner: Claude. Dependencies: 7. Spec: 61–66, 81, 88; reference UI tab 6.

Goal: compare meaningful saved alternatives consistently.

- Implement named scenario creation/editing/duplication and versioned local save/load, using the shared profile contract.
- Provide the required strategy presets, income uplifts and configurable low/base/high spending cases.
- Evaluate the required 5 salary × 3 spending × 4 strategy matrix, including property, with comparable assumptions and common paths.
- Show take-home, marginal tax, pension/ISA/total contributions, FIRE probability/age, liquid wealth, pension and total wealth as relevant to each comparison.
- Cache using complete versioned inputs; batch expensive comparisons with progress/cancellation. Label any reduced-path preview and distinguish it from a full-count result.

Done when: all 60 combinations are available and reproducible; saved scenarios round-trip; changing one scenario does not mutate another; spending cases show both surplus and capital-target effects.

Checkpoint: named scenarios → matrix runner/cache → comparison screen.

**Delivered.** `src/domain/scenarios.ts` owns named scenarios and the versioned library; `src/engine/scenario.ts` owns the strategies, the matrix and the batch runner; `src/presentation/view/scenario-model.ts` and the built Scenario Comparison screen present them. 230 tests pass. Every "done when" clause has a named test: all 60 combinations evaluate and reproduce, a cell replays the engine's own simulation exactly, the library round-trips and migrates while refusing invalid or unknown documents, scenario independence is asserted rather than assumed, and the spending cases assert both effects. Real Chrome evidence, measured timings and the limitations chunk 9 inherits are in `handoffs/chunk-8.md`.

## 9. Attribution, sensitivity, and stress analysis

Suggested owner: Codex. Dependencies: 8. Spec: 34, 61, 69–72, 91–92; reference UI tab 8 plus FIRE analysis.

Goal: explain what drives the gap and how the plan responds to adverse conditions.

- Complete Where It Comes From with income, spending, FIRE timing, allocation, investment-risk and property comparisons derived from the engines.
- Cover sensitivity to equity return/volatility, inflation, spending, salary growth, FIRE age, mortgage rate, property growth and pension withdrawal tax.
- Implement deterministic crash, high-inflation, lost-decade, mortgage-shock, property-crash and job-loss stress paths. Historical-style scenarios must have documented assumptions rather than implying an actual historical backtest.
- Report funding failures and diagnostic risk factors transparently. Explain whether income, expenses or allocation has the largest tested effect, while noting interactions between changes.

Done when: charts and explanatory text trace to computed results; stress paths use the same ledger; tests verify shock timing, bridge failures and property effects; no attribution output is canned prototype arithmetic.

Checkpoint: sensitivity/stress runners → attribution calculations → integrated analysis UI.

## 10. Full-product acceptance and release handoff

Suggested owner: Claude. Dependencies: 9. Spec: 85–89 and the complete requirements checklist; all eight tabs.

Goal: deliver a locally runnable V0.3 with all required features connected and verified.

- Audit every section 88 MUST against implementation and tests, plus remaining in-scope details in the comprehensive spec. Fix integration gaps; do not silently move required modelling into deferred scope.
- Run the complete golden/statistical/regression suite and end-to-end flows across all screens, jurisdictions, pension access, property and scenarios.
- Verify stale-result handling, reproducibility metadata, local scenario persistence, accessibility, responsive layout and visual agreement with the supplied design.
- Benchmark default simulations, solvers and the scenario matrix; address measured bottlenecks without weakening accounting or silently reducing the configured path count.
- Document installation, usage, assumptions, calculation conventions, test commands, measured performance and explicit limitations. Produce a production build and final agent handoff.

Done when: a clean checkout runs using documented commands; all 29 section 88 requirements have evidence; all eight tabs use actual engines; required checks pass and remaining limitations are stated. Deployment can be a separate assignment if desired.

Checkpoint: requirement audit → integration fixes/verification → build and documentation.

## Explicit scope boundaries

Use the spec's permitted V0.3 simplifications: deterministic salary growth, a parametric market model, configurable fixed withdrawal ordering, and initially current/FIRE expense phases. Keep extension points for later models.

Do not add live bank/broker connections, multiple properties, couples tax optimisation, international tax, estate planning, stochastic employment loss, historical bootstrap, regime switching, dynamic withdrawal strategies or AI financial recommendations. Optional expense shocks can follow the mandatory release. Deterministic job-loss stress testing is still in scope.

Next assignment: package 9 to Codex. Use `handoffs/chunk-8.md` for the paste-ready assignment.
Packages 1–8 supply the shared validated profile, complete tax/property lifetime ledger, common-path
workers, reverse solvers, marginal comparisons and the named-scenario matrix. Build attribution,
sensitivity and deterministic stress analysis on the same ledger and common paths, preserving all
inherited funding, uncertainty, cancellation and reproducibility conventions.
