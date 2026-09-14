# Chunk 6 handoff — bounded reverse solvers and the FIRE Age Curve

Package 6 is implemented on the chunk-5 baseline `8c03a1d`. Implementation commits:

- `a9ca63c` — the bounded solver framework, six searched inputs and the FIRE age curve engine.
- `260e8de` — the Reverse Solver and FIRE Age Curve screens, their coordinator worker and the
  shared numeric-control registry.

A third commit carries this handoff, the requirements checklist, the package status and the
checked-in browser acceptance harness. That commit and the merge are reported with delivery; this
handoff deliberately does not try to contain its own commit hash. Work was isolated in the worktree `.claude/worktrees/chunk-6-solvers` on branch
`worktree-chunk-6-solvers`; existing main-checkout content was preserved.

## Delivered

Two destinations move from `planned` to `built`. The other six are untouched, and the three that
remain planned still name their owning package.

### The searches

`src/engine/solver.ts` searches one input at a time and scores every candidate with the complete
lifetime model — the same ledger, property cash flows, tax rules, allowances, liquidity constraints
and Monte Carlo engine the FIRE screen uses. A candidate is a validated `Profile`, so marginal tax,
National Insurance, pension relief, ISA capacity, the emergency reserve and pension access all
follow automatically rather than being re-derived by the solver. Six modes:

| Mode | What moves | Definition |
| --- | --- | --- |
| `salary` | `income.salaryAnnual` | Gross pay in today's money, everything else fixed. The extra net pay reaches the accounts through the plan's existing surplus allocation. |
| `savings` | working-life spending | The annual investable surplus, funded by cutting the current-spending schedule and any phase ending at or before the FIRE age, discretionary first. No capital is created. |
| `fire_age` | `personal.targetFireAge` | The FIRE age itself, evaluated at every whole age in order. |
| `retirement_spending` | the retirement budget for the run's level | Household retirement spending per month; working-life spending is unchanged, so this is the required spending reduction. |
| `starting_capital` | an extra opening balance | The one search that adds money the plan does not have. The destination (cash / ISA / GIA at cost / pension) is chosen explicitly because it changes the answer. |
| `pension_contribution` | `pension.employeeRate` | The employee rate, with employer rate, match and method unchanged. |

Rules that make a returned answer meaningful:

- Candidates share the profile's seed, path count and market assumptions. `assertCommonPaths`
  enforces this instead of trusting each `apply`, so a probability difference between two
  candidates is a difference in the plan, never in the draw.
- Every candidate is quantised to the mode's precision (£100 salary and savings, £500 capital,
  £5/month spending, 0.5pp contribution, 1 year) before it is evaluated, so nothing is reported at
  a precision the search never tested.
- The answer is the smallest **tested** qualifying value over all evaluations, which holds whether
  or not the probability turned out monotone in the input. `excludedValue` carries the largest
  tested value that failed, so the bracket is visible.
- The returned candidate is rebuilt and re-run from scratch through the complete model.
  `confirmed` is false if that re-evaluation does not clear the target.
- `standardError` is `sqrt(p(1-p)/n)` at the answer. Search precision and Monte Carlo sampling
  uncertainty are separate quantities and are always presented separately.

Explicit states rather than silent behaviour:

- `already_met` returns the current value and stops after one evaluation.
- `infeasible` returns no required value and reports the probability actually reached at the bound.
- `unsupported` covers a search that cannot apply — a household spending override makes both
  spending-related searches meaningless, and they say so rather than returning an unchanged answer.
- A candidate the model does not support (`PensionLimitError`, a schema rejection) is recorded as an
  invalid evaluation with its reason, not as a plan that failed to fund itself.
- When the search **bound** itself is unsupported — a large salary tapering the pension annual
  allowance below the contribution is the usual case — the bound is narrowed to the largest
  supported value and the result says so. A free probe (the expected-value ledger plus eight spread
  sample paths) narrows first; the full model then confirms, and the search keeps narrowing by
  complete simulation if the probe proved optimistic. The tapered allowance reacts to investment
  income, so it genuinely can appear on a sampled path and not on the mean one.
- Monotonicity is assumed only where a single-signed effect is genuinely expected, and is verified
  either way. `pension_contribution` and `fire_age` assume nothing: an ordered coarse grid is
  scanned and the first qualifying point is refined, and a bound that fails does not end the search
  because a middle value can qualify where both ends do not. `probabilityMonotoneObserved` and
  `feasibilityMonotoneObserved` record what the evaluations actually showed.
- The evaluation budget is a hard cap. A search that exhausts it says so and still returns the
  smallest qualifying value it tested.

`sensitivityCases` builds spec section 33's three worked cases — FIRE age +2, retirement spending
−£150/month, equity mean −1pp — and `runSolver` re-solves each of them in full. None is a scaled
headline. The weaker-returns case changes the market assumption itself, so its paths come from a
different distribution; that is stated on screen rather than presented as a common-path comparison.

### The curve

`src/engine/fire-curve.ts` runs every candidate FIRE age through the complete model on the same
seed and path indices, and reports the earliest age clearing the target, the probability at the
profile's own FIRE age, the bridge length, median capital at FIRE and median terminal wealth per
age, plus a per-age sampling standard error. Nothing is interpolated: an age that was not evaluated
has no probability, and an age the schema rejects is recorded as invalid with its reason.
`monotone` is false when a later FIRE age scored worse than an earlier one.

### The screens

Both screens run their engine in one coordinator worker (`analysis.worker.ts`), which drives the
existing Monte Carlo worker pool for each candidate. No search arithmetic, aggregation or ledger
work happens on the UI thread. Progress is reported in two dimensions — completed simulations and
the path progress of the one in flight. Cancellation, error states and stale-result invalidation
follow the chunk-4 rules exactly: a result belongs to one input key, any change to those inputs
aborts the run and discards the result, and a cancelled or failed run publishes nothing.

Because a search is many complete simulations, both screens state the cost **before** the run: the
curve announces the number of ages and lifetime projections, the solver announces the upper bound
on simulations across the primary and sensitivity searches. Neither reduces the configured path
count; lowering `simulation.count` is offered as the explicit way to trade precision for time.

The solver screen shows the searched input's definition, the headline with its status, the bracket
around the answer, the independent confirmation, the measured surplus and retirement spending of
the solved plan, the section 33 sensitivity table, and the complete evaluation trace including
unsupported candidates and their reasons. The curve screen draws only simulated ages, marks the
earliest qualifying one, and tabulates the same numbers beside the chart.

## Interfaces and conventions for the next package

- `src/engine/solver.ts`: `solveTarget`, `runSolver`, `solverBounds`, `sensitivityCases`,
  `SOLVER_MODES`, and the `SolverResult` / `SolverEvaluation` / `SolverRun` types. `EvaluateProfile`
  is the transport seam — pass one to run candidates anywhere; the default is local `runMonteCarlo`.
- `src/engine/fire-curve.ts`: `fireAgeCurve`, `FireAgeCurveResult`, `FireAgePoint`.
- `src/engine/analysis-browser.ts`: `runSolverBrowser`, `fireAgeCurveBrowser` and the worker
  message contract. Package 7 can reuse the same pattern — one coordinator worker over the existing
  pool — for any analysis that runs several full simulations per user action.
- `src/presentation/view/solver-model.ts`: `solverPlan` and `curvePlan` turn screen controls into a
  validated engine request plus the announced work; the rest are pure result-to-row transforms and
  `curveGeometry`, which is asserted in tests rather than eyeballed. React renders these and
  nothing else.
- `src/presentation/view/fields.ts`: `NumberFieldDef` now extends a new `ControlFieldDef`, so a
  numeric control that is **not** part of the profile (a search bound, an age range) is described in
  the same registry and rendered by the same `NumberField`. `toDisplay` / `fromDisplay` accept
  either. Profile fields are unchanged.
- `src/presentation/web/use-analysis.ts`: the generic run-state hook (idle / running / done /
  cancelled / error, plus `invalidated`) behind both screens.
- `ProfileFields` in `profile-form.tsx` renders named profile fields inline, for screens that need
  one or two inputs rather than a whole group.
- Solver and curve runs require `rentInvestment: null`; both throw if given the property
  comparison's funding action. Ledger options, the engine version, path indexing, the money basis
  and the age-timing convention are all unchanged from chunk 5.

## Verification

`npm run check`: **184 tests pass**, zero failures; strict typecheck and production build pass on
Node **24.21.0**. That is the 157 inherited tests plus 27 new ones: 17 in `solver.test.ts`, 9 in
`solver-presentation.test.ts`, and one more bundling assertion in
`monte-carlo-browser-build.test.ts`. One inherited assertion changed: the built-tab list in
`presentation-inputs.test.ts` now expects five built destinations. `git diff --check` passes.

Engine evidence in `tests/solver.test.ts`:

- A solved salary requirement is rebuilt **outside** the solver and re-run: the probability matches
  exactly, clears the target, and the largest tested value below it genuinely fails, one search step
  lower. The reported standard error equals `sqrt(p(1-p)/n)`.
- Already-met targets stop at the current value after a single evaluation. An unreachable target
  inside a tight bound returns no required value and reports the probability reached at the bound.
- A £2,000,000 salary bound is narrowed to the largest supported value with the tapered-allowance
  reason recorded, and the search still solves.
- The spending search returns a reduction, and the solved plan's measured retirement spending equals
  the answer. The savings search's answer equals the measured first-year investable surplus of the
  solved plan — the definition holds rather than being asserted.
- A household spending override makes both spending searches `unsupported`.
- Pension access boundary: on a plan retiring at 45 with access at 57, extra starting capital placed
  in the **pension** is infeasible at any amount up to £1,000,000 while the same search into an
  **ISA** solves and confirms. Locked capital cannot fund the bridge.
- The pension contribution search is never assumed monotone, publishes a probability for every
  tested rate, and its invalid candidates carry their reason.
- Two identical searches replay exactly, the entered profile is never mutated, the seed and path
  indices are the profile's own, and the configured path count is never reduced.
- `rentInvestment` is rejected. Cancellation rejects with `AbortError` after real progress and
  publishes nothing.
- A planned property purchase changes what the salary search requires, and changes the age curve.
- The three section 33 sensitivity cases are separate completed searches; two more working years
  lower the salary requirement.
- The curve reproduces a direct `runMonteCarlo` exactly at the profile's FIRE age, replays exactly,
  agrees with the `fire_age` search on the earliest qualifying age, and rejects an empty range, an
  oversized range and rent-comparison options.

### Real Chrome verification

Vite was served with `npm run dev -- --port 5176 --strictPort`, against an isolated
`--headless=new --remote-debugging-port=9226 --user-data-dir=/tmp/capital-chunk6-chrome` Chrome
153. `tests/browser-solver-ui.mjs` is the checked-in acceptance harness and was executed
successfully against the final screens.

| Check | Result |
| --- | --- |
| FIRE & Monte Carlo baseline | 10,000 paths, **68.98%** success — the chunk-5 figure, reproduced |
| FIRE Age Curve, ages 42–50 | 9 complete simulations (90,000 lifetime projections) in **41.94 s**; **2,523** animation frames, **16.8 ms** longest frame gap |
| Curve values | 42: 45.71%, 43: 54.30%, 44: 62.14%, 45: 68.98%, 46: 74.91%, 47: 80.02%, 48: 84.19%, 49: 87.82%, 50: 90.61% |
| Common paths | Age 45 on the curve equals the FIRE screen **exactly** (68.98%): same seed, same path indices |
| Earliest qualifying age | Age 50 — the first tabulated age at or above the 90% target; nine points drawn, one marked |
| Curve cancellation | Cancelled after nonzero progress; no completed or partial curve published |
| Curve stale invalidation | Editing the target probability discarded a finished curve and removed it from the screen |
| Reverse Solver, required salary | Up to 56 complete simulations (560,000 lifetime projections) across 4 searches, announced before the run; completed in **366.51 s** |
| Solver answer | **£87,600** gross salary (from £55,000), confirmed by an independent re-run; 28 evaluation rows traced; the tapered-allowance bound note present |
| Sensitivity | The FIRE age +2, −£150/month spending and −1pp returns cases each solved in full |
| Solver cancellation | Cancelled after nonzero progress; nothing published |
| Controls | The bound control follows the searched input's units (£ / month for spending); the capital destination appears only for the starting-capital search; the pension search shows its non-monotone definition; an out-of-direction bound blocks the run |
| Desktop/mobile | Inspected at 1440×950 and 390×844; zero horizontal page overflow on both screens |
| Console | No uncaught page errors |

The £87,600 figure is this model's answer for the section 79 example profile at a 90% target and
FIRE at 45; spec section 33's £81,500 is an illustrative number in the specification text, not a
result to reproduce.

Both chunk-3 worker smoke variants were re-run in the same browser and still pass: browser/local
byte equality, mid-run cancellation and all 10,000 paths, at **68.98%** success in 4.16 s (428 UI
timer ticks) without a property and **35.18%** in 4.61 s (472 ticks) with one. The chunk-5 property
acceptance harness was re-run end to end against these screens and passed unchanged: a 10,000-path
property run in 4.59 s with a 16.8 ms longest frame gap, FIRE cancellation, invalid-input blocking,
the 10,000-pair rent/invest comparison (buy 35.18% against renter 69.01%), comparison cancellation,
and zero horizontal overflow on Property, Overview and FIRE at 390 px. Nothing in package 6 changed
the existing screens' numbers.

`tests/browser-property-ui.mjs` remains the chunk-5 regression and now takes `APP_PORT` / `CDP_PORT`
overrides (defaults unchanged). To reproduce:

```sh
export PATH="/tmp/node-v24.21.0-darwin-arm64/bin:$PATH"  # local convenience, if still present
npm ci
npm run check
npm run dev -- --port 5176 --strictPort
# Separate terminal, with the isolated Chrome already running:
node tests/browser-solver-ui.mjs
APP_PORT=5176 CDP_PORT=9226 node tests/browser-property-ui.mjs
```

Both harnesses write JSON and desktop/mobile PNGs into `/tmp`. Do not edit source while they run:
a Vite reload resets the deliberately in-memory profile. They are explicit browser checks, not part
of `npm run check`.

## Limitations preserved explicitly

- Each search moves **one** input. It is not a joint optimiser, and nothing here ranks the six
  inputs against each other; that comparison is package 7's marginal allocation engine.
- A solved value is the smallest value that was **tested** and cleared the target on **this** seed
  and path set. Where the probability is not monotone in the input — the pension contribution and
  the FIRE age assume nothing — an untested value below the answer may also qualify, and the result
  says so. The grid is coarse by design: a finer one costs proportionally more full simulations.
- The probability behind every answer is a sampled estimate. At 10,000 paths a 90% result carries a
  95% interval of roughly ±0.6pp, which is far wider than the search step. Two candidates within
  that interval are not meaningfully different, and the screen never implies otherwise.
- `savings` cuts the current-spending schedule and phases ending at or before the FIRE age;
  a phase straddling the FIRE age is left alone, because cutting part of it would silently change
  retirement spending too. `retirement_spending` adjusts whichever quantity the run's retirement
  level actually uses, and refuses to run under a household spending override.
- `starting_capital` is an explicit hypothetical injection — the one search that adds money. Its
  destination is a user choice, not an optimisation, and a GIA injection is entered at cost so it
  carries no latent gain.
- The bound-narrowing probe samples eight paths. It is a cheap first cut, always confirmed by the
  full model; it is not a proof that every path is supported.
- Pension annual-allowance excess still throws `PensionLimitError`; no excess-charge model was
  added, so rates above the allowance are unsupported candidates rather than costed ones.
- The curve is whole ages only, and a mid-year retirement is not modelled. Points are joined to
  make the shape readable; nothing between two ages was simulated.
- The equity-return sensitivity changes the market assumption, so it is a different model on
  different draws, not a common-path comparison. It is labelled as such on screen.
- Solver and curve runs use one coordinator worker over the existing simulation pool. A full solve
  with sensitivity cases at 10,000 paths is a minutes-long run by design: the configured path count
  is never reduced to make it finish sooner.
- Three screens remain planned: Marginal Allocation, Scenario Comparison and Where It Comes From.
  Persistence remains package 8.

## Chunk 7 — paste-ready assignment for Claude

Implement package 7 in the capital-allocation repository: the marginal capital allocation engine and
the Marginal Allocation screen. Chunks 1–6 are complete on main; start from the latest main
containing this handoff.

Check branch, working tree and origin/main first. Preserve existing changes. Work on a branch in a
separate worktree, commit in understandable stages, merge back to main and push. No PR required.

Read in order:

1. `docs/handoffs/chunk-6.md`, including the interfaces and limitations above.
2. Package 7 in `docs/implementation-work-packages.md`.
3. `docs/handoffs/chunk-5.md`, `chunk-4.md`, `chunk-3.md`, `chunk-2.md`,
   `docs/architecture-decisions.md` and `docs/property-model.md`.
4. The authoritative spec, especially sections 2, 38, 43, 57–59, 77 and 82; reference UI tab 4 in
   `design/Web page UI specification/Lifetime Capital Allocation & FIRE Model.dc.html` and its
   Organic tokens.
5. `src/domain/tax/`, `src/engine/ledger.ts`, `src/engine/solver.ts`, `src/engine/analysis-browser.ts`,
   and the existing `src/presentation/view/` and `web/` patterns.

Compare the next increment of capital across pension, ISA, GIA, cash, mortgage overpayment and a
property deposit. Distinguish extra **gross earnings** from existing **after-tax cash**: apply the
exact incremental income tax, National Insurance, relief and employer treatment from the tax
configuration rather than a single marginal rate, and detect band boundaries from configuration
rather than hard-coding them. Respect eligibility, annual allowances, ISA capacity, liquidity and
existing debt; label an infeasible destination explicitly instead of silently clamping it.

Rerun complete lifetime paths for every destination using common random numbers, exactly as the
solvers do: reuse the profile's seed and path indices, assert candidates share them, and leave
`rentInvestment` null. Report changes in wealth at target ages, terminal outcomes, success
probability, downside, accessible wealth, tax paid and debt. Rank against the constrained after-tax
usable-wealth objective, and explain dominance, near-equivalence and assumption sensitivity without
turning a difference smaller than the Monte Carlo standard error into a recommendation — the
solver's presentation of sampling uncertainty is the precedent to follow.

Wire the screen to real results: the increment amount and its funding basis, each destination's
outcome, the ranking, the infeasible destinations with reasons, and the comparison basis. Use the
coordinator-worker pattern from `analysis-browser.ts` with progress and cancellation, discard stale
results after any relevant edit, and publish no partial ranking when cancelled. Announce the cost of
a run before it starts. Preserve all eight destinations; change only the Marginal Allocation tab
status to built. Keep testable logic in `src/presentation/view/`, numeric controls in the field
registry and calculations out of React.

Keep `npm run check` green (184 tests at this handoff). Add independent tests proving the
incremental tax and relief for gross earnings versus after-tax cash, allowance and eligibility
limits, pension lock-up against the bridge, at least one tax-boundary case, common-path replay,
cancellation, and a property-sensitive case covering the deposit and mortgage-overpayment
destinations. Do not weaken reconciliation identities, change event order, add dynamic spending
cuts, apply a fixed GIA haircut, keep a static wrapper ordering or silently reduce the path count.

Verify in real Chrome: run both worker smoke variants, exercise the new screen with actual results,
confirm progress, cancellation and stale invalidation on responsive 10,000-path work, and inspect
desktop and mobile widths. `tests/browser-solver-ui.mjs` and `tests/browser-property-ui.mjs` remain
useful regressions and both accept `APP_PORT` / `CDP_PORT`. Update
`docs/requirements-checklist.md` (19 and the UI table), the package status, and create
`docs/handoffs/chunk-7.md` with delivered scope, changed APIs, commands and results, limitations and
a paste-ready chunk-8 assignment. Report commit and merge hashes and push status. If interrupted,
leave an accurate checkpoint; never mark incomplete work done.
