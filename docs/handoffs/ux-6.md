# Handoff — UX-6: the question-first Reverse Solver

Baseline: `171b6e0` (the UX-5 merge). Ticket: `docs/ux-improvement-plan.md` § UX-6.
Presentation-only package: `git diff --stat` over the branch touches no file under `src/engine/`, so
no solver bound, seed, path count, evaluation budget, tier or starter value moved.

## Delivered

### One spoken question, six answers

The Reverse Solver's top section is now the question **“To hit my goal, what would my … need to
be?”**, with the six existing searches as its answers: *gross salary*, *annual savings*, *FIRE age*,
*retirement spending*, *extra starting capital*, *pension contribution*. Each carries one plain
sentence about what it would move (“What you would have to earn, before tax, with your spending and
everything else unchanged.”).

This is a re-labelling, not a re-scoping. `SOLVER_QUESTIONS` is asserted to cover exactly
`SOLVER_MODE_OPTIONS`, the `SolverRequest` each choice builds is unchanged, and the mode's own
precise definition stays on screen under the plain one — what a search *holds fixed* is what makes
its answer meaningful, so it is not hidden behind a disclosure.

`QuestionPicker` (`src/presentation/web/question-picker.tsx`) renders it as a real `radiogroup`: one
tab stop, arrow keys between the six, `aria-checked` on the selected one, and the question itself as
the group's label and the card's heading. The `<select label="Searched input">` is gone; the
`data-question` attribute is the stable handle the browser harnesses use.

The run button now names what it will answer — “Work out my gross salary” — and the idle card says
so too, because a solve is up to 56 complete simulations and must stay a deliberate act.

### Every outcome as one honest sentence

`solverAnswer` maps a `SolverResult` to a single sentence whose honesty clause is part of the
sentence, not a footnote below it. For the reference profile at 10,000 paths:

> You would need a gross salary of about £87,600 (we confirmed £87,600 clears your 90% target and
> that £87,500 does not).

| Reader-facing status | What the sentence must carry |
| --- | --- |
| `achieved` | the confirmed bracket: the value that cleared and the largest tested value that did not |
| `budget_exhausted` | the same answer, plus the range the requirement still lies in, plus what to raise |
| `already_met` | the current value and its probability, and that no smaller value was looked for |
| `infeasible` | no value at all, the bound it failed at, and that nothing beyond it was tested |
| `unsupported` | the engine's own reason, verbatim, as a question that does not apply |

`budget_exhausted` is not an engine status; it is `solved` that ran out of evaluations. It is derived
from the result — `evaluations.length >= metadata.maxEvaluations` **and** a bracket still wider than
the mode's own `precision` — rather than by matching the engine's note text, so a reworded note
cannot silently move a plan into or out of that state. A failed confirmation run replaces “we
confirmed” with “the re-run did not reproduce it, so treat it as unverified”, and a missing
`excludedValue` says nothing below the answer was tested instead of implying a tested lower bound.

The sentence is rendered above the existing headline, detail rows, sensitivity block and evaluation
trace, all unchanged: the plain words are a ladder to the engine's own numbers, not a replacement.

### The Overview route into it

A completed Overview probability **below** the profile's target now offers **“What would it take to
reach 90%?”**. `overviewHeadline` gained `targetProbability` and `belowTarget`; the offer is outside
`sentence`, so the sentence stays pure view data about runs that happened. `belowTarget` is false
with no run, with a stale run, with only a curve, and when the probability meets the target exactly.

`App` owns the solver's selected question (`solverMode`), so `openSolverQuestion('salary')` selects
and navigates — and does nothing else. Arriving on the screen leaves the runner idle: no progress
bar, no result, no answer sentence, only the run button. UX-5's captured-input-key defence on
`AnalysisState.done` and `RunState.done` is untouched.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/presentation/view/solver-model.ts` | `SOLVER_QUESTION_STEM`, `SOLVER_QUESTIONS`, `SolverQuestionOption`, `solverQuestion`, `SolverAnswerStatus`, `SolverAnswerModel`, `solverAnswer` |
| `src/presentation/view/overview-model.ts` | `OverviewHeadlineModel` gained `targetProbability` and `belowTarget` |
| `src/presentation/view/tabs.ts` | The solver tab summary is question-shaped; id, label and status unchanged |
| `src/presentation/web/question-picker.tsx` | New: `QuestionPicker`, `QuestionChoice` |
| `src/presentation/web/screen-solver.tsx` | Takes `mode` / `onMode` from `App`; question picker and answer sentence |
| `src/presentation/web/screen-overview.tsx` | `onOpenSolverQuestion` prop; the gated “what would it take?” action |
| `src/presentation/web/app.tsx` | Owns `solverMode` and `openSolverQuestion` |

`SOLVER_MODE_OPTIONS` is retained and still exported: it is the list the question picker is tested
against, and nothing else now renders it.

## Automated evidence

`npm run check` on Homebrew Node 24 is green:

| Step | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **287 pass, 0 fail** (284 before UX-6; 3 new) |
| `npm run build` | production bundle built successfully |

`tests/solver-presentation.test.ts` reaches all five reader-facing statuses from **real solves** on
one deliberately stretched profile (`endAge` 80, 24 paths, retirement spending raised until the
entered salary does not fund it) rather than from hand-built result objects: target 90% solves,
`maxEvaluations: 3` exhausts, target 10% is already met, target 100% is infeasible, and a household
spending override makes the savings search unsupported. It also checks the unconfirmed and
unbracketed wordings, and that a `decrease` search keeps its `/ month` units.
`tests/presentation-screens.test.ts` checks the `belowTarget` gate across empty, stale, curve-only,
below, exactly-at and above-target cases, and that the sentence never mentions the offer.

## Chrome evidence

Chrome 153.0.8010.37 headless, isolated profile at `/tmp/capital-ux6-chrome`, Vite on port 5178 and
CDP on 9228. New harness `tests/browser-solver-question-ui.mjs` wrote `/tmp/ux6-ui-results.json` and
the `/tmp/ux6-*.png` screenshots; the chunk-6 regression `tests/browser-solver-ui.mjs` was updated
for the radio group and re-run.

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | browser/local equality; cancellation; 10,000 paths; **68.98%**; 4.30 s |
| Property worker smoke | browser/local equality; cancellation; 10,000 paths; **35.18%**; 4.95 s |
| Offer before any run | 0 “what would it take?” buttons |
| Offer after a completed run | **“What would it take to reach 90%?”** (69.0% against a 90% target) |
| Offer when the target is met | 0 buttons after re-running against a 60% target |
| Following the offer | landed on `tab-solver`, `salary` pre-selected |
| No auto-run | idle card shown; 0 progress bars; no “Completed in”; 0 answer sentences |
| Question stem | “To hit my goal, what would my … need to be?”, 6 choices |
| Answer at full count | **£87,600** — “You would need a gross salary of about £87,600 (we confirmed £87,600 clears your 90% target and that £87,500 does not).” in 99.40 s over 14 simulations |
| Sentence vs headline | the `.stat-hero` figure appears verbatim inside the sentence |
| Switching the question | `fire_age` selected, button becomes “Work out my FIRE age”, previous answer discarded |
| chunk-6 regression | curve 42.18 s, earliest age 50; solver **£87,600** confirmed with the four section 33 searches in 374.19 s; allowance note present; cancellation publishes nothing |
| Responsive | 0 px horizontal overflow at 390 × 844 and 1440 × 950; picker stacks to one column; 6 choices and all 8 tabs present |

A first visual pass stacked the card title “What would have to change for this plan to work”
directly above the question stem, which said the same thing twice and cost two heading-sized lines
on a phone. The card title was removed and the stem promoted to the card's `h3`.

## Limitations and decisions

1. The offer always opens the **salary** question, as the ticket specifies. It is an offer to search,
   not a claim that salary is the right lever — the other five questions are one click away, and the
   screen never ranks them.
2. `budget_exhausted` is a presentation state derived from the result. A search that happens to use
   its last evaluation *and* narrow to precision is reported as `achieved`, which is what it is.
3. The answer sentence reports the primary search only. The section 33 sensitivity cases stay in
   their own table, because each is a separate completed search and folding one into the sentence
   would read as a range the primary search did not establish.
4. UX-6 does not touch the two-success-numbers problem (the reference FIRE number beside the Monte
   Carlo probability). That is explicitly UX-7.

## Paste-ready assignment — UX-7 (S): one story for the two success numbers

Deliver `docs/ux-improvement-plan.md` § UX-7 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What UX-7 inherits:

- `overviewHeadline` is the established place for the authoritative answer, and its `sentence` is
  pure view data: keep any new affordance outside it, gated the way `belowTarget` is.
- `solverAnswer` is the pattern for turning an engine result into one plain sentence that keeps its
  own honesty clause. Reuse the shape rather than inventing a second one.
- `confidenceBand` remains the only authority for a probability's label; the reference FIRE
  arithmetic in `fire-metrics.ts` remains reference-only and must not be relabelled as a safety
  result.
- `QuestionPicker` is available if a screen needs a single visible choice; it is a `radiogroup` with
  `data-question` handles that the browser harnesses select on.
- Do not change anything under `src/engine/`, any seed, path count, evaluation budget, tier or
  starter value for UX-7.
