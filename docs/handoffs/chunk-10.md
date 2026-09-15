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

Three findings. All three were fixed rather than deferred.

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

`npm run check`: 251 tests (245 before this package), zero failures; strict typecheck and production
build pass on Node 24.21.0. The six new tests cover the per-case salary solve against an independent
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
| Dev server | Vite 7.3.6 on 127.0.0.1:5182 |

Harnesses were run **sequentially**, one at a time, so each duration is comparable with chunk 9's.
Running them in parallel would have shortened the wall clock and made every benchmark meaningless.

