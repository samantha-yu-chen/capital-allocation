# Handoff — UX-5: the question-led Overview headline

Baseline: `ba7090d` (the UX-4 merge). Ticket: `docs/ux-improvement-plan.md` § UX-5.
Presentation-only package: no engine, schema, seed, path count, tier or starter value changed.

## Delivered

### One answer, only after the work exists

Overview now starts with “When can I be financially independent?” Before a completed run exists it
offers the explicit full-count run and a route to its settings, but renders no probability or age.
For the unchanged starter profile, completed ordinary and curve runs produce this view-model copy:

> At your target of 45, this plan succeeds in 69.0% of simulated futures (“Fragile”). The earliest
> age that meets your 90% target is 50.

`overviewHeadline` owns the whole sentence. The probability and label come from the retained
`MonteCarloResult` and the existing `confidenceBand`; the age comes from the retained
`FireAgeCurveResult`. A curve whose tested range reaches no qualifying age says so instead of
inventing one. Either completed result may stand alone, and the age clause appears only when a
completed curve exists.

Each displayed figure is itself a button to the owning tab. The source text names what can replay
the run: 10,000 paths, seed 421337 and `monte-carlo-v1` for the probability; 21 ages × 10,000 paths,
the same seed and `fire-age-curve-v1` for the earliest age.

### Precision follows the sample

`sampledProbabilityDigits` computes the binomial standard error and selects 0, 1 or 2 percentage
decimal places. The 68.98% detailed result therefore becomes 69.0% in the sentence: one decimal is
finer than its roughly 0.46 percentage-point standard error, while a second decimal would imply
unsupported precision. At observed 0% or 100%, one path is the resolution floor so zero estimated
standard error does not become unlimited display precision. The detailed FIRE screen is unchanged.

The plan's 68.98% belongs to the existing **Fragile** `[0%, 70%)` band. The example sentence in the
ticket called 69.0% “Moderate”, but its own acceptance criterion requires exact agreement with
`confidenceBand`, whose tested half-open Moderate band starts at 70%; this implementation follows
that authority rather than copying the inconsistent example label.

### App-owned curve state and synchronous stale defence

UX-4 already placed the ordinary Monte Carlo runner in `App`. UX-5 similarly lifts the curve drafts,
plan and `useAnalysis` runner out of `CurveScreen`; the engine request, worker, path count, progress,
cancellation and result UI are unchanged. A completed curve now survives navigation and is available
to Overview without recomputation.

Both runner `done` states now carry the exact input key captured when their run launched. This closes
the render-before-effect gap: if inputs change, Overview compares that captured key with the current
key and refuses the old result on the first render, before each hook's effect aborts work and resets
its owning screen. Cancelled and failed states still contain no result, so neither can populate the
headline.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/presentation/view/overview-model.ts` | `CompletedOverviewRun`, `HeadlineRunSource`, `OverviewHeadlineModel`, `sampledProbabilityDigits`, `overviewHeadline` |
| `src/presentation/web/use-monte-carlo.ts` | A `done` state now carries the captured `key` |
| `src/presentation/web/use-analysis.ts` | A generic `done` state now carries the captured `key` |
| `src/presentation/web/screen-curve.tsx` | Receives App-owned drafts, plan and runner; computation and presentation are otherwise unchanged |
| `src/presentation/web/screen-overview.tsx` | Renders the question-led card and routes its run/source actions |
| `src/presentation/web/app.tsx` | Owns the curve plan/runner and supplies both completed analyses to Overview |

## Automated evidence

`npm run check` on Homebrew Node 24 is green:

| Step | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **284 pass, 0 fail** (282 before UX-5; 2 new) |
| `npm run build` | production bundle built successfully |

`tests/presentation-screens.test.ts` proves the no-run and stale-key states carry no figures; checks
completed Monte Carlo plus curve copy and both metadata sources; walks 0%, 70%, 80%, 90%, 95% and
100% through the headline and asserts exact `confidenceBand` ids/labels; and checks that 10,000-path
69% renders as 69.0% while a noisy 40-path sample gets no decimal places.

## Chrome evidence

Chrome 153.0.8010.37 headless, isolated profile at `/tmp/capital-ux5-chrome`, Vite on port 5178 and
CDP on 9228. `tests/browser-overview-headline-ui.mjs` wrote `/tmp/ux5-ui-results.json` and the
`/tmp/ux5-headline-*.png` screenshots.

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | browser/local equality; cancellation; 10,000 paths; **68.98%**; 4.30 s; 441 timer ticks |
| Property worker smoke | browser/local equality; cancellation; 10,000 paths; **35.18%**; 4.76 s; 488 timer ticks |
| Empty state | question and explicit run action; 0 source figures and no placeholder probability |
| Completed plan | **69.0% (“Fragile”)**; source says 10,000 paths, seed 421337, `monte-carlo-v1` |
| Completed curve | **Age 50**; 21 × 10,000 paths; source says seed 421337, `fire-age-curve-v1` |
| Full curve runtime | 96.65 s on the diagnostic pass; the final pass drew 5,902 frames with a **16.8 ms** maximum gap |
| Source navigation | probability figure opened FIRE & Monte Carlo; curve figure opened FIRE Age Curve |
| Stale result | editing salary removed both sources and the 69.0% sentence immediately |
| Cancellation | cancelling a replacement ordinary run left 0 headline sources |
| Responsive layout | 0 px horizontal overflow at 390 × 844; 2 completed sources and all 8 tabs remained present |

Visual review caught and fixed a first-pass grid error where fragment children competed with the
question for grid cells. The final desktop and completed mobile screenshots have one deliberate
answer column, no overlap and no clipping.

## Limitations and decisions

1. The headline reports the ordinary Monte Carlo probability, not the curve's target-age point.
   They use common inputs and paths, but naming each owning run avoids silently substituting one
   analysis for another.
2. The curve source describes only the tested range. If no tested age qualifies, the card says
   “None in tested range”; it does not imply that no later age could qualify.
3. UX-5 does not add the “what would it take?” action. That action, salary-mode preselection and its
   no-auto-run rule are explicitly owned by UX-6.

## Paste-ready assignment — UX-6 (M): question-first Reverse Solver

Deliver `docs/ux-improvement-plan.md` § UX-6 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What UX-6 inherits:

- `overviewHeadline` supplies `probability`, `targetProbabilityText` and the completed-run sentence.
  Add the “what would it take?” action only when the completed probability is below the profile's
  target, and keep the action outside the sentence so the sentence remains pure view data.
- `App` owns navigation. Extend its solver navigation state so the action selects the salary mode,
  but never call the solver runner from navigation.
- `AnalysisState.done` and `RunState.done` now include the captured input key. Preserve that field and
  the first-render stale-result defence.
- The headline's 69.0% is deliberately “Fragile”, not “Moderate”: keep using `confidenceBand`.
- Do not change anything under `src/engine/`, any solver bound, seed, path count, evaluation budget,
  tier or starter value for UX-6.
