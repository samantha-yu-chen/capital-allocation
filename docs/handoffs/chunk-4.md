# Chunk 4 handoff — application shell, Overview and FIRE & Monte Carlo

Package 4 is implemented on the unchanged chunk-1/2/3 engines. No accounting, tax or simulation
formula was duplicated or rewritten, no shared contract changed, and no `design/` calculation is
imported. Commits: `b52055c` (view models and tests), `e194837` (application shell and screens),
`09ad046` (defects found by driving the real browser).

## What was delivered

`src/presentation/view/` — React-free, compiled into the test build and covered by `node --test`:

- `fields.ts` describes the whole editable profile as data, each field addressed by its path into
  `Profile`. `profileSchema` remains the only validation authority.
- `overview-model.ts` shapes the deterministic ledger for the Overview screen.
- `monte-carlo-model.ts` shapes a `MonteCarloResult`, carrying chunk 3's interpretation rules with
  the numbers.
- `run-key.ts` fingerprints the inputs a result belongs to; `chart.ts` holds chart geometry;
  `format.ts` display formatting; `tabs.ts` the eight destinations.

`src/presentation/web/` — the React application, built on the Organic design tokens:

- `app.tsx` is the shell. All eight reference tabs are present: Overview; FIRE & Monte Carlo; FIRE
  Age Curve; Marginal Allocation; Reverse Solver; Scenario Comparison; Property & Leverage; Where It
  Comes From. The six unbuilt ones are flagged with their owning package in the navigation and open
  onto a screen that says what is missing and shows no figures at all.
- `screen-overview.tsx`, `screen-fire.tsx`, `screen-planned.tsx`, `profile-form.tsx`,
  `profile-state.ts`, `use-monte-carlo.ts`, `components.tsx`.

### Overview

Edits the complete profile: personal and target ages, jurisdiction (the tax year is read-only, since
only one is configured), income, household, spending including the optional per-member breakdown and
non-overlapping phases, assets, pension policy and contribution method, ISA/GIA behaviour, liquidity
and a list of known capital needs, per-wrapper portfolios, market assumptions with an editable
correlation matrix, and the simulation settings.

Shows liquid, pension and property capital separately and never as one headline; the year's cash
flow, savings rate and allowance headroom; the reference FIRE ratios; and a browsable annual ledger.
Every ledger year expands to its full set of line items, in today's money or nominal.

The **marginal income tax and NI rate** is obtained by re-running the whole projection with a larger
salary and differencing year zero. It is the model's own marginal rate, not a second tax formula. It
is labelled to say the pension policy is held constant, so salary sacrifice shrinks the taxable part
of the increment.

### FIRE & Monte Carlo

Calls `runMonteCarloBrowser` with progress, a working cancel button, error states and stale-result
invalidation. Reports success probability against the target; the success/failure split (the only
mutually exclusive view); all five observed failure-code probabilities as separate bars with the
"these overlap, never sum them" caveat; mean/P10/P25/median/P75/P90/worst-observed for terminal
wealth and for opening FIRE capital; a real percentile fan over every age boundary for each asset
category, with the same numbers in a table; sequence-risk statistics with recovered and censored
counts; the two diagnostics as explicitly non-causal associations; and the complete reproducibility
metadata.

## Conventions preserved

- **Money.** Profile inputs and all displayed results are today's money. `wealthByAge`,
  `terminalWealth` and `fireCapital` arrive real and are never deflated again; the ledger browser is
  the only place a nominal view exists, and it is labelled as such.
- **Ages.** The first wealth point is the opening balance at the current age; each later point is a
  closing balance at that age boundary. Ledger rows are half-open `[age, age+1)`, stated on screen.
- **Correlation.** Labelled on the market inputs and again under the results as the correlation of
  Gaussian log-growth shocks, *not* of arithmetic returns, with the conversion formula given.
- **Reference FIRE arithmetic is not the safety result.** Said on both screens.
- **Failure diagnostics.** Direct ledger failures and diagnostic associations are kept in separate
  cards with separate wording. No causal decomposition is offered.
- **Recovery.** The median is stated as conditional on an observed recovery, with the recovered and
  unrecovered path counts beside it.
- **The `locked` series** is described as mirroring a ledger metric, not as a claim that the pension
  stays inaccessible after the access age.
- **Property equity** is shown, always zero, and described as zero until package 5.

## Behaviour worth knowing

**Invalid input cannot reach the engine.** A box that cannot be parsed as a number becomes `NaN`, so
the schema rejects it rather than the UI silently reusing the previous value. While the profile is
invalid, `store.profile` is `null`, the run key is `null`, no engine call is made, any published
result is discarded and the header carries an "Inputs invalid" tag. Field-level rules mark their own
field with `aria-invalid` and an `aria-describedby` error; rules spanning fields (floor ≤ target ≤
comfort, portfolio weights, correlation definiteness, breakdown reconciliation) appear at the foot of
their group, which force-opens when it has an error.

**Stale results.** The run key covers the validated profile (which carries the path count and seed)
and the resolved ledger options. Any change aborts the run in flight and discards the published
result with a notice. Concurrency and batch size are deliberately **outside** the key: chunk 3
aggregates in absolute path-index order, so they cannot change the numbers, and changing them must
not throw away a valid result. Out-of-order completions are guarded by a run token, so a superseded
run can never publish.

**No partial results.** A cancelled or failed run publishes nothing. `UnsupportedProfileError` and
`PensionLimitError` get their own explanations rather than being shown as sampled plan failures.

**The path count is never reduced.** 10,000 is the default and is editable; whatever is configured is
what runs, and the metadata reports the count and path-index range actually executed.

## Verification

`npm run check`: **138 tests pass**, zero failures; strict typecheck and production build pass. That
is the 113 inherited tests plus 25 new ones in `tests/presentation-inputs.test.ts` and
`tests/presentation-screens.test.ts`, covering the field registry against the schema, NaN rejection,
field-level versus cross-field issue routing, correlation mirroring and positive-semidefiniteness
rejection, draft pruning, run-key sensitivity, chart geometry, the tab inventory, the Overview model
against the ledger, real-versus-nominal deflation, the marginal rate against an independent
re-run, the unsupported-property path, and the Monte Carlo display model against a real run.

Two of those are golden checks against the specification's own dashboard (section 80): the current
position (£75,000 liquid, £25,000 pension, £100,000 net worth) and the reference FIRE target
(£19,800 spending at 3.5% giving £565,714), both computed by the engine rather than transcribed.

### Browser verification — now actually performed

Chunk 3 could not claim browser runtime verification. It has now been done, in Google Chrome driven
headless over the Vite dev server.

`/tests/browser-worker-smoke.html` passed: browser and local results were byte-identical, mid-run
cancellation rejected as expected, a full 10,000-path run completed in **4.17 seconds** returning
68.98% success, and a 10ms UI-thread timer ticked 428 times during it.

The application itself was then driven through **40 checks, all passing**:

| Area | Result |
| --- | --- |
| Shell | All eight tabs present; the six unbuilt ones flagged with their package; arrow keys move between tabs |
| Overview | Section 80 position and reference FIRE number rendered; 25 ledger rows browsable; a year expands to its line items |
| Invalid input | An invalid profile blocks the engine, marks the field, flags the header and removes the previously shown figures; fixing it restores them |
| 10,000-path run | Completed in **4.0 s**; **242 animation frames** during the run with a **longest frame gap of 19 ms**; focusing another control mid-run took 0.1 ms at 400 paths completed |
| Result content | 68.98% success, 0.32% bridge, 31.02% depletion, median terminal £645k and P90 £5.7m — matching the chunk-3 Node benchmark exactly |
| Cancellation | Cancelling mid-run stops it and publishes no partial probability |
| Stale invalidation | Editing an input discards a finished result; editing mid-run aborts the run |
| Configurable count | A 500-path run reports 500 completed and a `[0, 500)` index range |
| Mobile (390×844) | Zero horizontal page overflow on both screens; wide tables scroll inside their own container; the tab bar scrolls with three tabs visible |
| Planned tabs | State the owning package and render no figures |
| Console | No uncaught page errors |

Screens were inspected visually at 1440×950 and 390×844. Four defects found that way were fixed in
`09ad046`: an unlabelled top gridline on the wealth axis, table row headers inheriting the uppercase
column-header style, mobile tabs each taking the full row width, and SVG axis text shrinking below
legibility on small screens.

### Toolchain note

This machine has no system Node installation. Verification used the official Node **v24.21.0**
darwin-arm64 distribution (SHA256 verified against `SHASUMS256.txt`) installed into a scratch
directory, matching chunk 3's runtime. `npm ci` was run fresh in the worktree. The only other Node on
the machine is bundled inside an unrelated application and macOS code signing prevents it loading
rollup's native binding, so it cannot run `vite build`. Nothing in the repository depends on this;
`package.json` and the lockfile are unchanged.

## Limitations

- **Property is still rejected.** A non-null property throws `UnsupportedProfileError` in the ledger.
  Both screens explain this rather than projecting a plan with the property silently omitted. There
  is no property input form yet; a property can only reach the profile programmatically.
- **Pension annual-allowance excess still throws.** The FIRE screen explains it and suggests the two
  real remedies, but the excess charge itself is not modelled.
- **Six screens are empty by design.** FIRE Age Curve, Marginal Allocation, Reverse Solver, Scenario
  Comparison, Property & Leverage and Where It Comes From have no engine yet.
- **No persistence.** Editing a profile is in-memory only; reloading the page returns the
  specification's example profile. Named scenarios and versioned local save/load are package 8.
- **One profile at a time.** There is no side-by-side comparison; that is package 8.
- **Solver settings are not exposed.** `solverTolerance` and `solverMaxIterations` stay at their
  defaults and are shown read-only in the metadata, so precision cannot be weakened from the UI.
- **No chart hover layer.** The fan chart has no tooltip; every plotted number is available in the
  table beneath it instead. Worth adding when the later screens bring more charts.
- **Single visual theme.** The Organic system ships one light theme and the app commits to it.
- **React rendering is not unit-tested.** There is no DOM test runtime in the project, so component
  behaviour is covered by the headless-browser pass described above plus tests of the React-free view
  models. Adding a DOM runtime would be a dependency decision for a later package.
- **The 1,000,000-path schema ceiling is still not a promise about browser memory.** Exact
  percentiles retain per-path, per-age samples; memory grows with count × horizon.

## Chunk 5 — paste-ready assignment

Implement package 5: the integrated property engine and the Property & Leverage screen.

Check branch, working tree and origin/main first; preserve all existing changes. Create a branch in a
separate worktree, commit in understandable stages, then merge back to main and push yourself. No PR
required. Chunks 1–4 are complete; use the latest main containing this handoff.

Read in order:

1. `docs/handoffs/chunk-4.md` (this file: the screens, the view-model layer, and how results are
   invalidated).
2. `docs/implementation-work-packages.md`, package 5.
3. `docs/handoffs/chunk-2.md` and `chunk-3.md` for the ledger and stochastic conventions you must not
   break, and `docs/architecture-decisions.md`.
4. The authoritative V0.3 spec, sections 47–56, 75 and 87–88, plus reference UI tab 7.
5. `src/domain/contracts.ts` (`propertySchema` is already defined), `src/engine/ledger.ts` (the
   `UnsupportedProfileError` you are removing, and the event order), `src/engine/accounts.ts`
   (`propertyEquity`), and `src/presentation/view/` plus `src/presentation/web/` for the screens.

Model one property: deposit funding, purchase and sale costs, applicable property taxes, mortgage
amortisation for both repayment and interest-only, refinance-rate scenarios, maintenance, insurance,
service charges, and rental occupancy, income and costs where applicable. Integrate value, debt
service, rental taxation and cash flow into the deterministic ledger **and** the stochastic paths, so
a property can change FIRE success and can cause liquidity or mortgage stress. The property return
series already exists in the market assumptions and the generator already draws it.

Count equity as spendable only through an explicitly modelled action; never let it silently fund the
bridge. Replace rent correctly — `spending.currentRentMonthlyIncluded` exists precisely so housing
costs are not counted twice. Compare buy against rent-and-invest on matching market paths, including
the deposit's opportunity cost, as full-plan comparisons rather than year-one arithmetic.

Complete the Property & Leverage screen with equity, LTV, debt-service coverage, downside leverage
and the required 3/5/7/9% mortgage scenarios. Add a property input form and change its tab status in
`src/presentation/view/tabs.ts` from `planned` to `built`. Reuse the existing view-model pattern:
put anything testable in `src/presentation/view/` so `node --test` can reach it, and keep React
components free of calculation. Reuse `Card`, `Line`, `Stat`, `BarList`, `FanChart` and the field
registry rather than inventing parallel components; a new profile field is one entry in
`NUMBER_FIELDS` or `arrayFields`.

Remove the ledger's property rejection only when the integration is real, and update both screens'
unsupported-property messaging when you do. Do not weaken the reconciliation identities, change the
event order, or introduce dynamic spending cuts. Shared interface changes require explanation and
updated consumers and tests.

Verify with `npm run check` (currently **138 tests**) and add golden tests for mortgage amortisation
and the spec's £300k property / £60k deposit leveraged-appreciation case (scenario B), purchase
funding reconciliation, housing costs counted once, and a property that changes FIRE success. Then
verify in a real browser: serve with `npm run dev`, run `/tests/browser-worker-smoke.html`, and drive
the application to confirm a property profile projects, that the Property screen's figures are real,
and that a 10,000-path run with a property still leaves the UI responsive and still cancels.
Inspect both screens at desktop and mobile widths.

Update `docs/requirements-checklist.md` (requirements 20, 21, 22 and the UI delivery table) and write
`docs/handoffs/chunk-5.md` with delivered scope, verification, limitations and chunk-6 instructions.
Report commit and merge hashes and push status. If interrupted, leave an accurate checkpoint; never
mark unfinished work complete.
