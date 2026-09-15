# Chunk 10 handoff — full-product acceptance and release

Package 10 is delivered. This is the release handoff: what the audit checked, what it found, what it
changed, what was measured and on what hardware, and what a future assignment would still have to
live with.

Work was done in worktree `.claude/worktrees/chunk-10-acceptance` on branch
`worktree-chunk-10-acceptance`, branched from freshly fetched `origin/main` at `a41847d` (the
package-9 merge). The primary checkout stays on `main` and its untracked `.claude/` is untouched.
Commits are reported with delivery; this file does not try to contain its own hash.

## What an acceptance audit means here

Package 10's brief was explicit: treat the status lines in `docs/requirements-checklist.md` as
*claims to verify, not evidence*. So every section 88 MUST was re-derived twice — once from the
source that implements it, once from a test that fails if it is removed — and the checklist was
rewritten from that, not edited around it. `docs/v0.3-requirements-checklist.md` is the long form:
all 29 requirements, the eight tabs, and the eleven cross-cutting ambiguities the planning draft had
left open, each now with a decision and the code that implements it.

Two things the audit deliberately did **not** do. It did not accept "the engine does X" without a
named test, and it did not accept a browser harness's exit status without its elapsed time (see
"Harnesses that lie about passing" below).

## What the audit found

Four findings. All four were fixed rather than deferred; none was moved into deferred scope.

### 1. Section 61's required-salary column did not exist

§61's table is four columns: monthly spending, FIRE age at the target success probability, required
salary, reference FIRE number — and the spec is specific that "FIRE age and required salary must come
from the model". The Scenario Comparison spending table had three of the four. Nothing else in the
product solved a required salary per spending case either: the Reverse Solver's own §33 sensitivity
block moves *retirement* spending by £150/month, which is a different question from "at £1,300,
£1,650 and £2,000 a month, what salary does this plan need?".

Each spending case now re-solves its own gross salary, through the same bounded `solveTarget` the
Reverse Solver screen uses, against that cell's own resolved ledger options including its household
spending override. The answer is bracketed to £100, re-run independently to confirm it, and shown
with both sides of the bracket and the number of complete simulations the search spent. A target
nothing inside the bound reaches reports the bound it tested rather than a clamped figure.

It is opt-in, because it costs up to twenty-six complete simulations per case instead of one. ADR
009 records why the cost is announced as a ceiling rather than an expectation.

### 2. Section 16's presentation labels existed nowhere

§16 allows a user-defined target — implemented, as `personal.targetSuccessProbability` — and lists
five presentation labels for a probability: Fragile, Moderate, Strong, High confidence, Very
conservative. None of the five appeared anywhere in the repository.

`confidenceBand` now supplies them from the view layer, as contiguous half-open bands so that no
probability falls between two labels and a boundary belongs to the higher band. No engine reads it.
The FIRE screen shows the band beside the headline and states, in as many words, that the user's own
target and not the band is what every solver, curve and constraint is measured against.

### 3. One claim was overstated, and had no test behind it

`docs/requirements-checklist.md` said the ledger "selects the region's config every year". It does
not: it resolves the profile's region once per run and rescales that configuration in real terms each
projected year, which is the correct behaviour — a tax region does not change mid-projection. The
wording is corrected.

More usefully, the underlying behaviour had no test that would fail if the ledger hard-coded a
region. Scotland and rest-of-UK were each covered inside the tax unit tests, and one rest-of-UK
profile ran through `marginal.test.ts`, but nothing contrasted the two *through the ledger*. There is
now a test that does, at an early and a late projected year, against each region's own
`calculateNetIncome`.

### 4. A shared worker pool died on its first unsupported candidate

Found by the new column failing in Chrome with `Error: Worker pool is closed`, and older than the
column. `runMonteCarlo` aborts its own internal controller as soon as one batch fails, which cancels
the sibling batches still in flight; the pool treated *any* abort on a batch signal as a reason to
close itself and terminate every worker. Right for the pool's owner, wrong for one run inside it — an
analysis keeping a single pool across many simulations lost it the first time a candidate was
unsupported, and every later simulation then failed with a message about the pool rather than about
the candidate.

Nothing had exercised it. The scenario matrix detects an unsupported strategy with a deterministic
probe before simulating, the age curve rejects an invalid age at the schema, and the Reverse Solver
screen builds a fresh pool per simulation. A bounded solve inside a scenario cell is the first thing
to run a failing candidate through a pool that must outlive it, and it hits the case immediately:
the salary search evaluates its far bound first, and that bound exceeds the tapered annual allowance.

Aborting a batch now terminates the worker actually running it — a worker halfway through 10,000
paths does not stop because a promise was rejected — and replaces it, so the pool stays usable and
only its owner closes it. This is the one change in the package that touches a path every browser
analysis uses, so all six harnesses were re-run after it; all six pass.

## Harnesses that lie about passing

Chunk 9 recorded this and it earned its place again: **a browser harness that exits non-zero in
under a second has failed to launch, not failed an assertion.** Every harness in this package was run
through a wrapper that starts a fresh isolated Chrome, waits for CDP to answer, runs the harness, and
then prints the elapsed time and the exit code together on adjacent lines. Reading them as a pair is
the whole point: `EXIT=1` after 0.08 s is a bad port or a broken harness; `EXIT=1` after 340 s is a
real regression.

## Changed public interfaces

- `ScenarioBatchRequest.salarySearch?: SalarySearch | null` — `{ targetProbability, bound,
  maxEvaluations }`. Null or omitted preserves prior behaviour exactly. `maxEvaluations` must be at
  least 3; `targetProbability` must be a fraction in [0, 1] or null (meaning the profile's own
  target); `bound` must be non-negative or null (meaning the solver's own default bound).
- `ScenarioCell.requiredSalary: ScenarioRequiredSalary | null` — the completed search: status,
  target, current salary and probability, required salary and its probability, the confirmation
  re-run and whether it cleared, the excluded (largest non-clearing) salary, the bound actually
  tested, the precision, the standard error, the message, the evaluations spent and the solver's
  notes. Null when no search was requested.
- `ScenarioBatchResult.metadata.salarySearch` echoes the request.
- `scenarioCellKey(profile, options, fireAgeSearch, salarySearch)` gains a fourth argument and now
  also folds in `SOLVER_VERSION`. **Every scenario cache key changes**, which is intended: a cell
  computed without a salary search must never satisfy a request that needs one, and a rebuilt solver
  must not silently reuse an answer the previous one produced.
- `scenario-model.ts` gains `ScenarioSettings.salaryEnabled`, `SALARY_SEARCH_EVALUATIONS`,
  `requiredSalaryText` and `requiredSalaryNotes`; `ScenarioRow` and `SpendingEffectRow` gain
  `requiredSalary` and `requiredSalaryNotes`.
- `monte-carlo-model.ts` gains `CONFIDENCE_BANDS`, `ConfidenceBand`, `ConfidenceBandId` and
  `confidenceBand`. Presentation only; no engine consumes them.
- No engine version changed. The ledger, simulation, generator and tax configuration versions are
  identical to package 9's, which is why every inherited baseline below is directly comparable.

## Verification

`npm run check`: 253 tests (245 before this package), zero failures; strict typecheck and production
build pass on Node 24.21.0. The eight new tests cover the per-case salary solve against an independent
`solveTarget`, its monotonicity across the three spending cases, cache-key and input validation,
cancellation committing nothing, the row formatting for every solver status including an unconfirmed
answer, and the confidence bands' boundaries and contiguity.

### Hardware, concurrency and configuration

| | |
| --- | --- |
| Machine | Apple M5 Pro, 15 cores, 24 GB, macOS 26.5 |
| Node | 24.21.0 |
| Chrome | 153.0.8010.37, `--headless=new`, a fresh `--user-data-dir` per harness |
| App worker concurrency | `min(4, navigator.hardwareConcurrency)` = 4 |
| Batch size | 100 paths |
| Path count | 10,000 (the entered count; never lowered by the product) |
| Dev server | Vite 7.3.6, 127.0.0.1 |

Harnesses were run **sequentially**, one at a time, so each duration is comparable with chunk 9's.
Running them in parallel would have shortened the wall clock and made every benchmark meaningless.

### Real Chrome evidence

Every row below is a harness run against a **freshly launched** isolated Chrome, at the release
commit, with nothing else editing the repository. Exit code and elapsed time are read together.

| Harness | Elapsed | Measured result |
| --- | --- | --- |
| `browser-property-ui.mjs` | 42 s, exit 0 | 10,000 property pairs in ~5 s; zero mobile overflow |
| `browser-marginal-ui.mjs` | 125 s, exit 0 | Gross 25.33 s, existing cash 25.18 s; 1,519 frames, 33.2 ms longest gap |
| `browser-attribution-ui.mjs` | 229 s, exit 0 | 28 cases at 10,000 paths plus seven stresses on desktop; the property mobile run after it |
| `browser-scenario-ui.mjs` | 344 s, exit 0 | 60 cells at the full 10,000 paths in 271.72 s; 16,303 frames, 16.8 ms longest gap; spending cases 13.92 s; preview 1.82 s; library 14.12 s |
| `browser-solver-ui.mjs` | see below | FIRE 68.98%; the 42–50 age curve in 42.08 s with all nine values unchanged and age 50 earliest qualifying |
| `browser-section61-ui.mjs` | 32 s, exit 0 | The new section 61 search at an explicitly lowered 400 paths |
| `browser-section61-ui.mjs` `FULL_COUNT=1` | 398 s, exit 0 | The same search at the full 10,000 paths: three bounded salary solves in 290.84 s |

Both worker smoke variants ran at the start of every one of those harnesses and reproduced
**68.98%** and **35.18%** at 10,000 paths every time.

### Known-good baselines, re-verified

| Baseline | Chunk 9 | This release |
| --- | --- | --- |
| Tests passing | 245 | 253 (eight added) |
| Worker smoke, baseline | 68.98% | 68.98% |
| Worker smoke, property | 35.18% | 35.18% |
| Where It Comes From, full count, desktop | 92.40 s | 93.30 s |
| 60-cell scenario matrix | 273.57 s | 271.72 s |
| Reverse solver required salary | £87,600 | £87,600, confirmed |
| FIRE age curve earliest qualifying age | 50 | 50 |
| FIRE age curve, nine values | 45.71 / 54.30 / 62.14 / 68.98 / 74.91 / 80.02 / 84.19 / 87.82 / 90.61 | identical |
| Section 80 dashboard figures | £75,000 / £25,000 / £100,000 / £19,800 / £565,714 | identical (`presentation-screens.test.ts`) |
| Spending cases | £445,714 / £565,714 / £685,714 and 86.70% / 68.98% / 46.17% | identical |

Nothing moved that needs explaining. No engine version changed in this package, which is why these
are directly comparable rather than coincidentally similar.

### Section 61's required salary, measured

At the **full 10,000 paths**, three bounded salary solves completed in 290.84 s (the whole harness,
including both worker smokes, took 398 s):

| Case | Required gross salary | Bracket | Confirmation re-run | Simulations spent |
| --- | --- | --- | --- | --- |
| £1,300/mo | £60,800 | £60,600 did not clear, £60,800 cleared | 90.03% | 24 |
| £1,650/mo | **£87,600** | £87,500 did not clear, £87,600 cleared | 90.02% | 24 |
| £2,000/mo | £117,500 | £117,400 did not clear, £117,500 cleared | 90.00% | 23 |

The entered plan spends £1,650/month, so the middle row asks exactly what the Reverse Solver asks —
and it returns **£87,600**, the same answer the solver screen reaches by its own route in 371.86 s.
Two independent paths through the bounded search agreeing to the £100 precision is the strongest
evidence in this package that the new column is solving rather than approximating. The three
answers rise with spending, as they must.

Every cell reports that its search bound was reduced — for the £1,650 case, values above £173,500
exceed the available pension annual allowance at age 37 — and says in as many words that this is a
modelling boundary, not a plan failure. The £1,300 cell additionally says its search stopped at its
evaluation budget, so its answer is the smallest qualifying value *tested* and the true requirement
lies somewhere above £60,600. That is the honest report, not a hidden approximation.

A reduced-count run is kept as the routine regression (32 s at 400 paths) because the full-count one
takes nearly seven minutes. At 400 paths the same three cases give £59,400 / £86,200 / £115,800 —
each within what that path count can resolve, and the middle one 1.6% from the full-count answer.

## Performance, and what was and was not optimised

Spec §85 asks for deterministic seeds, batch simulation, caching and parallelisation, and says
plainly that correctness takes priority over optimisation. Three of those four are implemented:
batches of 100 paths, a cache keyed on the complete versioned inputs, and a worker pool at
`min(4, hardwareConcurrency)`. **Vectorisation is not implemented** — the ledger is a scalar
year-by-year loop, deliberately, because every reconciliation identity is asserted against it.

The measured bottleneck is the ledger itself, not the transport: a 10,000-path simulation takes
about 4.3 s, and every analysis is a multiple of that. The scenario matrix is 60 of them; a
required-salary solve is up to 26 per case. Nothing here was made faster by lowering a path count,
weakening an identity or adding a dynamic spending cut, and the one change that *would* help most —
vectorising the ledger — is exactly the change most likely to break the identities that make the
numbers trustworthy.

One build note: the main bundle is now 500.3 kB (149.6 kB gzipped), just over Vite's 500 kB advisory
threshold. It is a warning, not an error, and the build passes; code-splitting the eight screens is
the obvious remedy if it matters later.

## A process failure worth recording

Two harnesses failed in the first verification pass — the scenario harness after 367 s with
`CDP CONNECTION CLOSED`, the solver harness after 401 s with a timeout. Both had run for minutes, so
by the rule above neither was a launch failure. Both passed on a clean re-run with identical
baselines.

The difference was that during the first pass **documentation files were being edited in the same
working tree.** `AGENTS.md` warns against editing *application source* while a harness runs; the
warning is too narrow. Any write inside the tree Vite is watching can reload the page, and a reload
resets the deliberately in-memory profile mid-run. Treat the whole working tree as frozen for the
duration of a harness, not just `src/`.

## Explicit boundaries

Everything inherited from chunks 1–9 still applies; none of it is superseded. In addition:

- The required-salary search is bounded and quantised to £100, and it searches **salary only**. It
  does not co-optimise spending, contributions or FIRE age, and a case whose target is unreachable
  inside the supported bound reports that bound rather than an answer.
- Its cost is real: up to 26 complete simulations per case. At 10,000 paths and three cases that is
  tens of minutes, which is why it is off by default and why the ceiling is announced first.
- §16's bands are labels. Nothing reads them, and they must never be turned into thresholds an
  engine acts on — the user's target is the only such figure.
- §36 is disclosed, not modelled: the configured tax structure is held constant in real terms for
  the whole projection. The hypothetical pension-withdrawal charge on Where It Comes From is one
  example of what a change could cost, not a forecast of tax policy.
- §30's stochastic expense shock is not implemented; the spec makes it optional for V0.3. Known
  capital needs and the one-year job-loss stress cover the deterministic half of that need.
- The §89 deferred list stays deferred in full.
- Runtime scales with the entered path count. No latency or memory ceiling is promised for a very
  large configured count.

## For whoever picks this up next

There is no package 11. If the product is taken further, the three things this audit would flag as
the most valuable next work, in order:

1. **Vectorise or otherwise speed up the ledger**, behind the existing identity assertions. Every
   expensive analysis is a multiple of one 4.3 s simulation, so this is the only change that moves
   all of them at once. The identities are the safety net that makes it attempt-able.
2. **Persist the analysis caches across a reload.** Today a coordinator cache lasts one batch. A
   versioned, keyed cache that survives a refresh would make the expensive screens far more usable
   without weakening anything — the keys already cover every input and version.
3. **§30's stochastic expense shock**, which is the only optional V0.3 item left unbuilt.
