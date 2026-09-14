# Chunk 8 handoff — named scenarios, versioned persistence and Scenario Comparison

Package 8 is implemented and verified. The final documentation commit and merge hashes are reported
with delivery; this file does not try to contain its own commit hash.

Worktree: `.claude/worktrees/chunk-8-scenarios`, branch `worktree-chunk-8-scenarios`, baseline
`78ce9a9` from freshly fetched `origin/main`. The primary checkout remains on `main`; its existing
untracked `.claude/` was preserved. Implementation commits:

- `1d5f883` — named scenarios, the versioned library with migration, and the common-path matrix runner.
- `17c21c1` — the Scenario Comparison screen, its view model and field-registry controls.

The documentation/acceptance commit and merge are reported with delivery.

## Implemented scope

A **scenario** is a name, a validated `Profile` and the plan-level run options — retirement level,
household monthly spending override, emergency-reserve policy and surplus destination.
`profileSchema` stays the only validation authority: a scenario is constructed by parsing, so it can
never hold a profile an engine would reject, and every constructor and mutator re-parses rather than
aliasing. Editing, duplicating or replacing one scenario cannot reach into another, and the tests
assert that instead of relying on structural sharing.

The **library** is a versioned document (`kind` + `version`) behind a `ScenarioStorage` seam, so the
same load path runs under Node and in `localStorage`. Nothing persisted is trusted: every stored
profile is re-parsed on load, a schema-1 document is migrated explicitly with its defaulted options
stated on screen, and an unknown version, a wrong kind, a duplicate id or name, or an invalid
profile is refused with reasons rather than partially loaded. Import and export use the same path.

Four **comparisons** run on common random numbers: the section 63 matrix (5 salaries × 3 spending
cases × 4 capital strategies = 60 cells), the section 61 spending cases, the section 62 income
bands, and the saved scenarios themselves. Each cell is a complete lifetime simulation at the
entered path count through the same ledger, tax rules, allowances, property cash flows, spending
policy and Monte Carlo engine as the FIRE screen. Nothing is scaled, blended or interpolated.

Strategies are profile transforms:

| Strategy (section 63) | Transform |
| --- | --- |
| ISA Heavy | Employee contribution reduced to the match-preserving minimum (`min(employeeRate, matchUpToRate)`); surplus fills ISA then GIA |
| Pension Tax-Band Optimised | Smallest contribution that vacates the top occupied non-savings band, solved with the real annual tax API, then capped at what the annual allowance supports across the projection |
| Balanced | The entered contractual policy; the matrix reference point |
| Property | Buys the configured purchase inside the same lifetime model |

The eight section 64 presets — Baseline, ISA Heavy, Pension Heavy, Income Growth, Property Heavy,
No Property, Aggressive FIRE, Conservative FIRE — create named scenarios from the current profile
and each records what it changed. Income Growth moves to the next band on the configured uplift
axis; Aggressive/Conservative FIRE shift the target age by three years; Pension Heavy adds ten
percentage points, capped by the allowance. A preset this profile cannot express states why instead
of creating a misleading scenario.

Results carry, per cell: first-year real take-home, marginal income tax and NI on the next £1,000 of
gross salary, member/employer/total pension contributions, ISA and GIA allocations, total invested,
investable surplus, retirement budget and reference FIRE number; FIRE success with its sampling
interval, bridge and depletion probabilities; median liquid, pension, property-equity and net wealth
at that plan's own target FIRE age; and mean/median/P10/worst terminal wealth. An optional
earliest-qualifying-FIRE-age search per cell reuses `fireAgeCurve`; it is off by default because
each candidate age is another complete simulation.

## Conventions retained

- **Common random numbers.** Every candidate keeps the entered seed, path count, horizon and market
  assumptions. `assertCommonPaths` (now exported from `solver.ts`) checks the candidate profile
  before it runs; `assertScenarioPaths` checks the returned metadata and absolute path indices
  afterwards. A saved scenario that changes the draw is reported incomparable, not compared.
- **Full count.** The path count is never lowered automatically. A reduced-count preview must be
  requested explicitly, is keyed separately so it can never satisfy a full-count request, and is
  labelled in the announcement, a banner, the summary and the conclusion.
- **Unsupported is not failure.** A strategy this profile cannot express, or a contribution beyond
  the available annual allowance, states its reason and shows no figures.
- **Honest cancellation.** A cancelled batch rejects and publishes nothing — no partial matrix, and
  no already-computed cell shown on its own.
- **Uncertainty.** A lead inside the combined 95% sampling interval of the two cells is reported as
  a tie, not as a finding.
- Money stays nominal in the ledger and real in view output; `marginalAction` and `rentInvestment`
  stay null for scenario runs and a request that sets them is rejected; ADR 002's event order,
  fixed spending policy and reconciliation identities are unchanged.

## APIs and integration

- `src/domain/scenarios.ts`: `scenarioSchema` (version 2), `scenarioSchemaV1`, `scenarioOptionsSchema`,
  `defaultScenarioOptions`, `createScenario`, `duplicateScenario`, `updateScenario`, `addScenario`,
  `replaceScenario`, `removeScenario`, `scenarioLibrarySchema`, `emptyLibrary`, `serialiseLibrary`,
  `loadScenarioLibrary`, `saveScenarioLibrary`, `readScenarioLibrary`, `ScenarioStorage`,
  `memoryScenarioStorage`. **Breaking:** `scenarioSchema`/`Scenario` moved off `contracts.ts` and
  went from version 1 to version 2; version 1 is retained only for migration.
- `src/domain/stable-json.ts`: `stableStringify`, moved out of the view layer so the engine can key
  a cache without importing presentation. `run-key.ts` re-exports it, so its callers are unchanged.
- `src/engine/scenario.ts`: `CAPITAL_STRATEGIES`, `CAPITAL_STRATEGY_DEFINITIONS`, `capitalStrategy`,
  `SCENARIO_PRESETS`, `SCENARIO_PRESET_DEFINITIONS`, `scenarioPreset`, `bandOptimisedContribution`,
  `buildScenarioMatrix`, `buildSpendingCases`, `buildIncomeCases`, `buildLibraryCases`,
  `runScenarioBatch`, `scenarioCellKey`, `engineVersions`, `memoryScenarioCache`,
  `assertScenarioPaths`, `UnsupportedScenarioError`, `ownsExistingProperty`.
  `SCENARIO_VERSION = 'scenario-matrix-v1'`.
- `src/engine/ledger.ts`: `marginalIncrement` — the model's own marginal tax/NI on the next slice of
  gross salary, measured by re-running the projection. `overview-model.ts`'s `marginalOnIncrement`
  now delegates to it, so there is one implementation rather than two.
- `src/engine/solver.ts`: `assertCommonPaths` is now exported.
- `src/engine/monte-carlo/browser-pool.ts`: `createBrowserSimulationPool` and an optional `pool` on
  `runMonteCarloBrowserPool`, so an analysis running many simulations can keep one worker set.
  Batches are stateless and aggregation stays in path-index order, so reuse cannot change a result.
- `analysis-browser.ts` / `analysis.worker.ts`: `runScenariosBrowser` plus the `scenarios` request,
  progress and completion messages. The coordinator holds one simulation pool and one cache for the
  whole batch and closes the pool in a `finally`.
- `src/presentation/view/scenario-model.ts`: control validation, cost announcement, formatting,
  rows, the matrix pivot, the spending-effect table, the conclusion and the dominance note.
  `fields.ts` adds `SCENARIO_SALARY_FIELDS`, `SCENARIO_PREVIEW_FIELD`, `SCENARIO_FIRE_FROM_FIELD`
  and `SCENARIO_FIRE_TO_FIELD`; the spending cases reuse the existing `spending.scenarioMonthly.*`
  profile fields. `use-scenario-library.ts` owns the browser storage adapter and library state.
  All eight tabs remain reachable; only Scenario Comparison changes status in this package.

## Validation checkpoint

`npm run check`: 230 tests (208 before this package), zero failures; strict typecheck and production
build pass on Node 24.21.0. New tests cover the persistence round trip; refusal of an invalid
profile, a malformed document, a wrong kind, an unknown version and duplicate ids; schema-1
migration including refusal of an invalid or field-mixed v1 document; scenario independence for
edit, duplicate and construction; the band-optimised contribution actually vacating a band and a
materially smaller one not doing so; existing ownership keeping its property under every strategy;
all 60 combinations evaluating and reproducing; a cell replaying `runMonteCarlo` exactly on the same
path indices; an incomparable seed being reported; cache-key completeness across twelve inputs and
the four engine versions, plus a cached hit only for identical inputs; preview labelling and
separate keying; cancellation after real progress publishing nothing; `rentInvestment`/
`marginalAction` rejection; the spending double effect including the retirement-year override; the
income-uplift figures; the optional FIRE age search; and one worker set serving several simulations
with identical results. Presentation tests cover invalid drafts blocking a run, the full-count and
preview announcements, every required column, the spending table, the tie-inside-uncertainty
conclusion and the library listing.

Browser commands (isolated Chrome must already be running):

```sh
npm ci
npm run check
npm run dev -- --port 5179 --strictPort
APP_PORT=5179 CDP_PORT=9229 node tests/browser-scenario-ui.mjs
APP_PORT=5179 CDP_PORT=9229 node tests/browser-marginal-ui.mjs
APP_PORT=5179 CDP_PORT=9229 node tests/browser-property-ui.mjs
APP_PORT=5179 CDP_PORT=9229 node tests/browser-solver-ui.mjs
```

### Real Chrome evidence

Final `tests/browser-scenario-ui.mjs` run, isolated Chrome on ports 5179/9229:

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | 10,000 paths; 68.98%; 4.16 s; 427 UI timer ticks; browser/local byte equality and cancellation pass |
| Property worker smoke | 10,000 paths; 35.18%; 4.60 s; 471 ticks; equality and cancellation pass |
| Required matrix | 60 cells at the full 10,000 paths in 276.57 s; 16,595 animation frames, 16.8 ms longest gap; 60 evaluated, 0 unsupported |
| Persistence | 5 saved scenarios survive a real page reload: "Loaded 5 scenario(s) saved at …", stored document `version: "2"` |
| Refusal | A stored profile edited to `salaryAnnual: -1` is refused on load with the field named, and nothing is loaded |
| Migration | A schema-1 document loads as "Migrated 1 scenario(s) from schema 1" with its defaulted options stated |
| Unknown version | Importing a `version: "99"` document is refused: "Unsupported scenario library version" |
| Independence | The Income Growth scenario holds £65,000 while Baseline still holds £55,000 in the same library |
| Validation | An unparseable salary band disables the run button |
| Progress/cancellation | Nonzero progress observed; cancelling publishes no result element and states that no partial matrix is published |
| Stale results | Editing a salary band discards the completed 60-cell result |
| Preview | Explicitly chosen 1,000-path preview completes in 1.82 s and is labelled "PREVIEW — 1000 of 10000 paths … not a full-count result"; the full-count run carries no PREVIEW text |
| Spending cases | 3 full-count cases in 13.98 s, both effects present (below) |
| Saved scenarios | 3 saved scenarios compared at full count in 13.98 s on a 390 px viewport |
| Layout | Zero page overflow at 1440×950 and 390×844; screenshots visually inspected |
| Console | No uncaught page errors |

Spending sensitivity, full count, from the run above — both halves of the effect in one table:

| Case | Investable surplus | Total invested | Retirement budget | Reference FIRE number | FIRE success |
| --- | ---: | ---: | ---: | ---: | ---: |
| £1,300/mo | £23,667 | £29,167 | £15,600 | £445,714 | 86.70% ± 0.67% |
| £1,650/mo | £19,467 | £24,967 | £19,800 | £565,714 | 68.98% ± 0.91% |
| £2,000/mo | £15,267 | £20,767 | £24,000 | £685,714 | 46.17% ± 0.98% |

The £1,650 case reproduces the FIRE screen's own 68.98% and the section 80 reference FIRE number of
£565,714 exactly, which is the cross-check that a scenario cell replays the entered plan rather than
approximating it. Saved-scenario comparison at £55k: Baseline 68.98% ± 0.91% (£5,500 pension,
£19,467 ISA, £562,187 liquid at FIRE), ISA Heavy 66.67% ± 0.92% (£2,750 pension, £40,807 take-home),
Pension Heavy 73.63% ± 0.86% (£11,000 pension, £275,125 pension wealth at FIRE). At £55k/£1,300 the
four strategies give 85.2% / 90.5% / 86.7% / 7.7% — the Property cell is low because the configured
£300,000 purchase consumes essentially all of this profile's £75,000 of financial assets. These are
fixture results, not hard-coded rankings.

Regressions, each on a freshly started isolated Chrome: `tests/browser-marginal-ui.mjs` passed —
gross 23.36 s, existing cash 24.27 s, deposit 32.01 s, mortgage 30.63 s, 1,402 frames, 16.8 ms
maximum gap. `tests/browser-property-ui.mjs` passed — 10,000 property pairs in 5.10 s, 310 frames,
zero mobile overflow. `tests/browser-solver-ui.mjs` passed — FIRE baseline 68.98%, the 42–50 age
curve in 43.21 s with all nine values unchanged (45.71 / 54.30 / 62.14 / 68.98 / 74.91 / 80.02 /
84.19 / 87.82 / 90.61) and age 50 earliest qualifying, and the complete salary solve in 384.35 s
confirming £87,600. Every known-good baseline from chunk 7 is unchanged.

Artifacts: `/tmp/chunk8-ui-results.json`, `/tmp/chunk8-{desktop,mobile}.png`,
`/tmp/chunk8-matrix-desktop.png`, `/tmp/chunk8-mobile-results.png`, `/tmp/chunk8-library-desktop.png`.
No source was edited while a browser harness was running.

### A measured performance finding worth keeping

The first full-matrix run took over 20 minutes because the coordinator created and tore down a
simulation worker set for every cell — 240 module-worker spawns against the Vite dev server, which
produced bursts of four cells in 20 s separated by multi-minute stalls. Sharing one worker set
across the batch brought the same 60 cells, at the same path count and with identical numbers, to
276 s. The engine cost is not the issue: measured in Node, a property cell and a balanced cell both
cost about 4.9 ms per path. If a later package adds another many-simulation analysis, give it one
pool rather than one per simulation.

## Explicit limitations for subsequent work

- The matrix axes are salary, household monthly spending and capital strategy only. Every other
  input is shared with the entered profile, so a cell is not an independently tuned plan. Scenario
  options override the transport defaults, which means a run setting chosen on the FIRE screen does
  not silently override a saved scenario's own choice.
- "FIRE age" in a cell is the plan's own target age unless the optional search is enabled, and that
  search reports the earliest age clearing the target *within the requested range*; it is not a
  continuous solve. Section 61's "required salary" is not re-solved per spending case: the Reverse
  Solver owns that search, and running it three times costs several minutes per case.
- Pension Tax-Band Optimised targets the top occupied non-savings band using the first projected
  year. Its lifetime allowance cap is found with the solver's probe — the expected-value ledger plus
  four sampled paths — so a path outside the probe that still breaches the allowance is reported as
  an unsupported cell rather than as a plan that failed. Full-year pension excess charges remain
  unsupported, as in chunk 7.
- The Property strategy uses one configured purchase; V0.3 models a single property. A plan that
  already owns one keeps it under every strategy, and Property and No Property are then unsupported
  rather than inventing or deleting an asset. The default purchase offered when none is configured
  is the same editable default the Property screen uses — an input, not a recommendation.
- Persistence is `localStorage` in one browser profile: no accounts, sync, server or file download.
  Storage that is unavailable behaves as empty. The library holds at most 40 scenarios. Profile
  edits themselves remain in memory; only saved scenarios persist.
- The cache lives for one coordinator instance, so it reuses cells inside a batch and across
  re-runs of the same page session, not across reloads. It is keyed on the complete versioned
  inputs, so it cannot return a cell computed for anything else.
- The dominance note compares mean probability across each axis holding nothing else fixed; it is a
  description of this matrix on one set of common paths, not an attribution of a single plan's gap.
  Real attribution, sensitivity and stress analysis are package 9.
- Standard errors describe Monte Carlo sampling only, not model uncertainty. All chunk 5 property,
  chunk 6 solver and chunk 7 marginal boundaries remain in force.

## Chunk 9 — paste-ready assignment

Implement package 9 in the capital-allocation repository: attribution, sensitivity and deterministic
stress analysis, completing the Where It Comes From screen. Start from the latest `origin/main`
containing the completed chunk-8 handoff. Read `AGENTS.md`, this handoff, package 9, the chunk-8/7/6/5/3
interfaces, `docs/architecture-decisions.md` (ADR 002 event order, ADR 006 allocation, ADR 007
scenarios), `docs/requirements-checklist.md`, `docs/property-model.md`, `docs/tax-rules-2026-27.md`,
spec sections 34, 61, 69–72 and 91–92, and reference UI tab 8. An interface, a prototype output or a
placeholder is not delivered functionality.

Preserve existing changes and the primary checkout on main. Use an isolated branch/worktree, commit
understandable stages after green gates, build a merge against current `origin/main`
(`git commit-tree <tree> -p origin/main -p HEAD`), push it with
`git push origin <merge>:refs/heads/main`, and never force-push or rewrite history. Tell the user to
run `git pull --ff-only` in the primary checkout, and say why.

Complete Where It Comes From with income, spending, FIRE timing, allocation, investment-risk and
property comparisons derived from the engines. Cover sensitivity to equity return and volatility,
inflation, spending, salary growth, FIRE age, mortgage rate, property growth and pension withdrawal
tax. Implement deterministic crash, high-inflation, lost-decade, mortgage-shock, property-crash and
job-loss stress paths through the same ledger by supplying shocked `MarketPath`s; historical-style
scenarios must document their assumptions rather than implying an actual backtest. Report funding
failures and diagnostic risk factors transparently, and explain whether income, expenses or
allocation has the largest tested effect while noting interactions.

Reuse the inherited conventions rather than reinventing them: common random numbers with
`assertCommonPaths`/`assertScenarioPaths`, `rentInvestment` and `marginalAction` null for ordinary
runs, the full configured path count with any reduced-count preview explicitly chosen and labelled,
complete versioned cache keys, coordinator workers with progress and cancellation that publish
nothing partial, unsupported cases reported as unsupported, calculations in `src/presentation/view/`
and numeric controls in the field registry. A many-simulation analysis should keep one simulation
worker set via `createBrowserSimulationPool` rather than one per simulation. Keep all eight tabs
reachable and change only Where It Comes From to built.

Test shock timing, bridge failures, property effects and that no attribution output is canned
prototype arithmetic, with tests that would fail without the change. Run `npm run check`, both
worker smoke variants and real desktop/mobile Chrome flows on a freshly started isolated Chrome,
including full-count work, progress, cancellation and stale invalidation. Known-good baselines to
re-verify: worker smoke 68.98% and 35.18% at 10,000 paths; solver required salary £87,600; FIRE age
curve earliest qualifying age 50; the 60-cell matrix in about 276 s; 230 tests passing. If any of
these move, explain why before calling the package done. Update README,
`docs/requirements-checklist.md`, mark package 9 delivered in `docs/implementation-work-packages.md`,
add any ADR your design needs, and write `docs/handoffs/chunk-9.md` with measured evidence, explicit
limitations and the paste-ready chunk 10 assignment. Report commit and merge hashes and push status;
leave an accurate checkpoint if interrupted.
