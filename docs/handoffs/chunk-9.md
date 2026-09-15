# Chunk 9 handoff — attribution, sensitivity and deterministic stresses

Package 9 is implemented and verified. The final documentation commit and merge hashes are reported
with delivery; this file does not try to contain its own commit hash.

The engine and screen were built by Codex in worktree `/tmp/capital-allocation-package-9` on branch
`codex/package-9`, baseline freshly fetched `origin/main` at `c08744f`. Acceptance was finished in a
second session from worktree `.claude/worktrees/chunk-8-scenarios` on branch `worktree-chunk-9-finish`,
branched from the same implementation commit so the delivered tree is byte-identical to the one that
was measured. The primary checkout stays on `main`; its untracked `.claude/` is untouched.
Implementation commits:

- `1c3ee8f` — annual stress inputs and full-count analysis runners with independent tests.
- `284209c` — the Where It Comes From screen, its view model and one shared worker pool.

The documentation/acceptance commit and merge are reported with delivery.

## Scope and interpretation

Where It Comes From compares the entered plan with eight explicit interventions: salary +£10,000,
fixed discretionary spending −£3,000/year, pension contributions that leave the top occupied tax
band, ISA-then-GIA surplus, GIA surplus, FIRE two years later, shifting 10pp of bonds/cash to equities
in every wrapper, and either £10,000 more deposit for a planned property or a mortgage term five
years shorter for an existing property. No asset or additional income is invented to fund a deposit.
A profile that cannot express an intervention reports its validation/unsupported reason.

Nineteen sensitivity rows cover equity nominal mean ±2pp, equity volatility ±5pp, inflation mean
±1pp, real salary growth ±1pp, FIRE age ±2 years, mortgage rates ±2pp (including scheduled refinances),
property nominal growth ±2pp, all three configured spending cases and hypothetical +5pp/+10pp tax
on taxable pension withdrawals. Baseline plus interventions and sensitivity rows total 28 cases;
identical versioned inputs reuse the result. No count reduction or implicit preview exists here.

Every probability and wealth figure comes from a complete Monte Carlo result retained with its
exact profile and resolved ledger options. The objective is full-horizon funding success. Liquid,
pension and property equity at each candidate's own FIRE age, terminal median/P10 wealth, bridge
failures, observed failure events and sequence diagnostics are reported separately. The largest
*tested* income/expenses/allocation improvement is named only beyond sampling uncertainty.

Effects are not additive and not causal shares. Interactions between taxes, savings, bridge
liquidity and capital requirements are explained, not assigned invented numerical weights. Equal
inputs or effects inside uncertainty never become an optimisation finding. The difference SE is
conservatively bounded by the sum of the two marginal SEs; a finding must exceed 1.96 times that
bound. Monte Carlo SE is not model uncertainty.

Seven deterministic stress paths use the same ledger: synthetic 2000-style three-year equity
losses, synthetic 2008-style single-year equity crash, ten-year high inflation, ten-year zero
nominal equity return, three-year 9% mortgage rate, one-year −30% property return and one-year lost
employment. Assumptions are displayed beside each result. These are not historical backtests or
sampled probabilities. The shock start age is editable, defaults to the current age, and applies to
`[age, age+1)`. Multi-year windows truncate at endAge; every other year/asset uses the entered mean.

## Public interfaces

- `MarketYear` adds optional `employmentMultiplier` and `mortgageAnnualRate`. Missing fields preserve
  prior behavior. Salary, bonus, retirement employment and pensionable pay follow the employment
  multiplier; other/state income do not. The annual rate override recasts remaining-term payments
  for that year only; the contractual schedule resumes afterwards. Persisting debt/wealth effects
  are accounting consequences, not accidental persistence of the override.
- `LedgerOptions.pensionWithdrawalSurtaxRate` defaults to zero, is validated in [0, 0.2], and is
  included in every resolved option record/key. The hypothetical charge applies to the taxable
  pension withdrawal inside the gross-up funding solve; it contributes to income/total tax.
  `LedgerYearDetail.pensionWithdrawalSurtax` is its audit field. `usableWealth` accepts the optional
  rate and allocation snapshots pass it through. Default-zero results retain their numerical values.
- Engine version: `deterministic-ledger-v4-stress-property-residential-2026-27-v1`. The parametric
  generator and simulation versions are unchanged. ADR 008 records the decisions.
- `stress.ts`: `STRESSES`, `STRESS_ASSUMPTIONS`, `stressPath`, `runStress`, `StressResult`, `STRESS_VERSION`.
- `attribution.ts`: `buildAnalysisCases`, `reduceSpending`, `runAttribution`, `assertSensitivityPaths`,
  `analysisCellKey`, `AttributionRequest/Result/Progress`, `AnalysisCell`, `AnalysisCache`.
- `assertSensitivityPaths` permits changed market moments only, preserving correlation, horizon,
  seed/count and Gaussian draws; it invokes the inherited strict assertions with market moments
  normalised only for the identity check. Returned actual profiles/options/versions are checked.
- `runAttributionBrowser` and attribution request/progress/done coordinator messages use one
  `createBrowserSimulationPool` for the whole batch, closed in `finally`. Cache entries commit only
  after complete success, never during a failed/cancelled run. Keys include every profile field,
  ledger option and engine/simulation/generator/tax/attribution/stress version.
- `attribution-model.ts` contains the testable presentation and conclusions. `STRESS_AGE_FIELD`
  joins the field registry. React only renders controls and results using the Organic components.
  All eight destinations remain reachable; only Where It Comes From changes from planned to built.

## Verification checkpoint

`npm run check`: 245 tests (230 before this package), zero failures; strict typecheck and production
build pass on Node 24.21.0. The fifteen new tests cover exact shock timing and recovery of
contractual input values, job-loss pensionable pay and fixed spending, stressed bridge/mortgage
failures, full account and aggregate reconciliation under property/mortgage shocks, taxable pension
gross-up, all sensitivity input directions, funded-fixture wealth directions, widened sampled equity
tails, exact replay of every supported cell against direct `runMonteCarlo`, unchanged Gaussian
shocks, cache completeness, wrong evaluator metadata, cancellation and failure with no cache
publication, and presentation traceability.

Browser commands, each against a freshly launched isolated Chrome:

```sh
PATH=/tmp/node-v24.21.0-darwin-arm64/bin:$PATH npm run check
npm run dev -- --port 5181 --strictPort
APP_PORT=5181 CDP_PORT=9231 node tests/browser-attribution-ui.mjs
APP_PORT=5181 CDP_PORT=9231 node tests/browser-scenario-ui.mjs
APP_PORT=5181 CDP_PORT=9231 node tests/browser-marginal-ui.mjs
APP_PORT=5181 CDP_PORT=9231 node tests/browser-property-ui.mjs
APP_PORT=5181 CDP_PORT=9231 node tests/browser-solver-ui.mjs
```

All harnesses now fail explicitly when their CDP connection closes unexpectedly. No application
source is edited during a harness. `/tmp/chunk9-ui-results.json` and `/tmp/chunk9-*.png` carry the
new acceptance evidence. Regression harnesses retain their own chunk-5/6/7/8 artifact names.

### Real Chrome evidence

Final `tests/browser-attribution-ui.mjs` run, isolated Chrome on ports 5181/9231, 226 s end to end:

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | 10,000 paths; 68.98%; 4.28 s; 440 UI timer ticks; browser/local byte equality and cancellation pass |
| Property worker smoke | 10,000 paths; 35.18%; 4.62 s; 474 ticks; equality and cancellation pass |
| Validation | Clearing the stress age disables the run button |
| Progress/cancellation | Nonzero progress observed, then cancelling leaves no result element and states that no partial analysis is published |
| Full-count desktop | 28 cases at the full 10,000 paths plus seven stresses in 92.40 s; 5,543 animation frames, 33.3 ms longest gap; baseline reproduces the FIRE screen's own 68.98% |
| Stale results | Editing the stress age discards the completed analysis and says so |
| Full-count mobile, configured property | The same analysis with a real property purchase in 122.85 s at 390 px; baseline reproduces the property smoke's 35.18% |
| Layout | Zero page overflow at 1440×950 and 390×844 |
| Console | No uncaught page errors |

Desktop conclusion, full count: *Lower expenses has the largest tested improvement among income,
expenses and allocation: Fixed spending −£3,000/year in all phases (13.56 pp).* The supporting rows:
salary +£10,000 gives +10.05 pp, the band-vacating pension contribution +6.56 pp, FIRE two years
later +11.04 pp, GIA-only surplus −2.21 pp, and both the ISA-then-GIA row (the entered policy) and
the 10pp equity shift land inside the sampling bound and are reported as such rather than as
findings. With no property configured, the property intervention and the four property/mortgage
sensitivity rows are reported unsupported with their reason, and no figures.

Two measured results that look wrong and are not, recorded so a later package does not "fix" them:

- With the desktop stress age set to 45 — the profile's own target FIRE age — job loss changes
  terminal net worth by exactly £0. At 45 the year is no longer a working year, so the employment
  multiplier has only `retirementEmploymentAnnual` to act on, and this fixture has none. Set the
  stress age to a working year and the same stress bites.
- In the mobile property run, crash 2000, crash 2008, lost decade and mortgage shock all end at
  £558,440. All four deplete the financial accounts completely, so terminal net worth is the
  property equity left standing; the mortgage is fully repaid before the horizon, so even the rate
  shock leaves the same residual. The stresses differ during the projection, not at its end.

Regressions, each on a freshly started isolated Chrome. Every known-good baseline from chunks 5–8 is
unchanged:

| Harness | Measured result |
| --- | --- |
| `browser-scenario-ui.mjs` | Passed in 344 s. 60 cells at the full 10,000 paths in 273.57 s; 16,415 frames, 16.8 ms longest gap. Spending cases in 14.13 s reproducing £445,714 / £565,714 / £685,714 and 86.70% / 68.98% / 46.17% exactly; preview 1.82 s; library 13.72 s |
| `browser-marginal-ui.mjs` | Passed in 122 s. Gross 24.04 s, existing cash 24.43 s, deposit 31.15 s, mortgage 30.68 s; 1,443 frames, 16.8 ms longest gap |
| `browser-property-ui.mjs` | Passed in 40 s. 10,000 property pairs in 5.03 s; 303 frames, 16.8 ms longest gap; zero mobile overflow |
| `browser-solver-ui.mjs` | Passed in 460 s. FIRE baseline 68.98%; the 42–50 age curve in 40.83 s with all nine values unchanged (45.71 / 54.30 / 62.14 / 68.98 / 74.91 / 80.02 / 84.19 / 87.82 / 90.61) and age 50 earliest qualifying; the complete salary solve in 368.79 s confirming £87,600 with its allowance note; zero overflow at both widths |

This matters because `ENGINE_VERSION` moved from `deterministic-ledger-v3-marginal-property-…` to
`deterministic-ledger-v4-stress-property-…`. Every cache key is invalidated and every figure above
is recomputed from scratch, so reproducing £87,600, age 50, the nine curve values, the 60-cell
matrix timing and both smoke probabilities is evidence that package 9 added to the model rather than
changing it.

### A harness defect worth keeping

The CDP-close guard added to the four harnesses in `284209c` was inserted above `const ws = new
WebSocket(...)` in `browser-marginal-ui.mjs`, `browser-property-ui.mjs` and `browser-solver-ui.mjs`.
`ws` is a `const` in the temporal dead zone at that point, so all three exited immediately with
`ReferenceError: Cannot access 'ws' before initialization` — in under a tenth of a second, which is
easy to mistake for a Chrome or port problem rather than a broken harness. They were repaired by
moving the guard below the socket construction, and only then did the three regressions above
actually run. **A harness that exits non-zero in under a second has failed to launch, not passed:
check the exit code and the elapsed time together.**

## Explicit boundaries

- Interventions are fixed sizes, not globally optimal policies; combined interactions are not
  simulated, and no causal decomposition is claimed. A fixed cut cannot breach the retirement
  floor or exceed discretionary spending in a phase. Low/base/high household overrides retain
  their inherited meaning: they replace the total schedule in separate runs.
- No property is invented when absent. A larger deposit or shorter existing mortgage term tests
  leverage in the entered property. The dedicated Property screen continues to own rent/invest
  comparisons and actual sale modeling; unsold equity never becomes accessible money here.
- Pension tax sensitivity is an additional hypothetical withdrawal charge, not alternate legislation
  or a universal marginal rate. Inherited pension allowance excess remains unsupported, with no
  result for that candidate. Default tax configuration and all existing rates remain unchanged.
- Stress employment loss is annual, with no benefits, severance, job-search duration distribution or
  permanent earnings scar. A shock after FIRE changes only entered retirement employment, if any.
  Mortgage overrides have no lender fees/underwriting. Shock magnitudes are documented presets;
  their timing is editable. No historical dataset, backtest or forecast is implied.
- The coordinator cache lasts one batch, not a reload or subsequent run. Full retained summaries
  increase analysis-result size; no per-path full ledger array is retained for Monte Carlo cells.
  Deterministic stress ledgers are retained in full for audit. Runtime still scales with the entered
  path count, and very large configured counts have no promised latency/memory ceiling.
- All inherited property, tax, solver, marginal and scenario support boundaries continue to apply.

## Chunk 10 — paste-ready assignment

Implement package 10: full-product acceptance and release handoff. Fetch current origin/main first,
read AGENTS.md/CLAUDE.md, this handoff, package 10, architecture decisions, requirements-checklist.md,
v0.3-requirements-checklist.md, all inherited support boundaries and the full authoritative spec.
Use a branch in an isolated worktree; preserve primary main and its untracked .claude/.

Audit every section-88 MUST and remaining in-scope spec detail against real implementation and tests.
Fix integration gaps instead of silently deferring them. Exercise all eight screens, Scotland and
rest-of-UK taxes, pension access, property, scenarios, attribution, sensitivity and deterministic
stresses. Verify reproducibility, all ledger identities, local persistence, stale-result handling,
progress/cancellation, accessibility and responsive layout. Keep React calculation-free and numeric
controls in the field registry. Never lower simulation.count, weaken reconciliation or add dynamic
spending cuts. Never display an unsupported case as a funded-plan failure.

Treat the status lines in requirements-checklist.md as claims to verify, not as evidence: re-derive
each one from the code and a named test.

Before trusting any browser harness, confirm it actually starts. Run each of
tests/browser-{attribution,scenario,marginal,property,solver}-ui.mjs and check the exit code and the
elapsed time together: a harness that exits non-zero in under a second has failed to launch, not
failed an assertion.

Run npm run check and fresh isolated Chrome harnesses, both worker smokes, default simulations,
solvers and the full 60-cell matrix. Preserve the common normal draws/absolute path indices and
complete versioned cache keys. Many-simulation analyses must reuse one worker pool for the batch.
Benchmark with full configured counts and document hardware/concurrency plus remaining constraints.

Known-good baselines to re-verify, explaining any movement before the package is called done:
245 tests passing; worker smoke 68.98% and 35.18% at 10,000 paths; the full-count Where It Comes From
analysis (28 cases plus seven stresses) in about 92 s on desktop; the 60-cell scenario matrix in
about 274 s; reverse solver required salary £87,600; FIRE age curve earliest qualifying age 50 with
the nine values 45.71 / 54.30 / 62.14 / 68.98 / 74.91 / 80.02 / 84.19 / 87.82 / 90.61; section 80
dashboard figures £75,000 liquid, £25,000 pension, £100,000 net worth, £19,800 target spending and
£565,714 reference FIRE number.

Update README, both requirements audits, package status and a release handoff with measured evidence
and explicit limitations. Commit after green gates, build the merge against current origin/main with
commit-tree, push without force, and report hashes/push status. Tell the user to run git pull --ff-only
in the primary checkout; never move its checked-out main ref from another worktree.
