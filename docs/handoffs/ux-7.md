# Handoff — UX-7: one story for the two success numbers

Baseline: `dc1d722` (the UX-6 merge). Ticket: `docs/ux-improvement-plan.md` § UX-7.
Presentation-only package: `git diff --stat` over the branch touches no file under `src/engine/`, and
no seed, path count, tier, starter value or `profileSchema` rule moved. No numeric output changed —
every figure on every screen is the same figure it was, with the same formatting.

## Delivered

### One explanation, owned by the view layer

`src/presentation/view/two-numbers.ts` is the single canonical answer to finding A.1.8. It computes
nothing; it turns the profile's own withdrawal rate and path count into one story with two halves:

> **The FIRE number is a landmark.** The FIRE number is simple arithmetic: your yearly retirement
> spending ÷ 3.50%, the withdrawal rate you configured. It is a useful landmark for the size of pot
> you are aiming at, and it is silent about the tax you pay on withdrawals and about bad market
> years arriving early.
>
> **The success probability is the verdict.** The success probability simulates your actual plan
> 10,000 times, with taxes, inflation and market ups and downs. It is the number your target is
> judged against.

and one line short enough to sit under a figure:

> 3.50% arithmetic, so a landmark and not the safety result: the success probability over 10,000
> simulated futures is the number your target is judged against.

Both numbers in that copy are the reader's. `twoNumbersStoryFor(profile)` reads
`simulation.referenceWithdrawalRate` and `simulation.count`, so a 4.25% plan says 4.25% — the
ticket's AC 2, and Chrome-verified by retuning the rate in the running app. A rate outside `(0, 1)`
or a non-positive path count throws `RangeError` rather than printing “0%” or “NaN times”.

The arbitration itself is not free prose. `AUTHORITY_CLAUSE` is the exported constant that appears
in both the verdict sentence and the one-line caveat, and `authority` is the literal type
`'success-probability'`, so the reference arithmetic cannot be relabelled as the safety result by a
later edit without failing to compile or failing a test. `confidenceBand` is still the only
authority for a probability's label, and `fire-metrics.ts` is untouched.

### One component, two variants, five surfaces

`src/presentation/web/two-numbers.tsx` renders it and nothing else renders it. `full` is the two
titled sentences plus the existing glossary terms (*success probability*, *withdrawal rate*); `note`
is the caveat as a footnote. The `data-two-numbers` attribute is the stable handle the browser
harness selects on.

| Surface | Variant | Why |
| --- | --- | --- |
| Overview → Reference FIRE target | `full` | The headline probability and the reference card are both on this screen |
| FIRE & Monte Carlo → Reference FIRE number | `full` | The landmark sits directly above the run that judges the plan |
| Start-here wizard, step 5 | `full` | The step where a first-timer meets both numbers for the first time |
| FIRE Age Curve → Reference FIRE number | `note` | The probability curve is the screen; the reference figure is one stat beside it |
| Scenario Comparison → spending sensitivity | `note` | One column of a table whose other columns are simulated results |

Each screen's own hand-written half-sentence about the reference number was replaced rather than
supplemented: “A reference ratio only — the probability below … is the safety result”, “A reference
ratio, not the safety result above” and “Simple arithmetic, not the safety result” are gone, and the
figure-specific facts they were mixed with (property adjustments, which retirement budget is used)
stayed as their own sentence. The Overview card keeps its title, “Transparent arithmetic, not a
safety result”.

### An audit that keeps working

The ticket asks for an audit of every surface showing the reference number. A list checked once
rots, so the check derives the list from the sources: `tests/presentation-two-numbers.test.ts` scans
every `.tsx` under `src/presentation/web/`, takes the files that render `referenceFireNumber` or
print “Reference FIRE”, and asserts that set equals `REFERENCE_FIRE_SURFACES` **and** that each of
those files renders `<TwoNumbers` from the shared module. A sixth surface added later without the
explanation fails the suite; so does deleting the explanation from an existing one — verified by
removing it from `screen-curve.tsx`, which fails with
`src/presentation/web/screen-curve.tsx shows the reference number without the shared explanation`.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/presentation/view/two-numbers.ts` | New: `AUTHORITY_CLAUSE`, `TwoNumbersInput`, `TwoNumbersPart`, `TwoNumbersStory`, `twoNumbersStory`, `twoNumbersStoryFor`, `ReferenceFireSurface`, `REFERENCE_FIRE_SURFACES` |
| `src/presentation/web/two-numbers.tsx` | New: `TwoNumbers` (`variant: 'full' | 'note'`) |
| `src/presentation/web/screen-overview.tsx` | `ReferenceFire` takes `profile` |
| `src/presentation/web/screen-curve.tsx` | `CurveResult` takes `story` |
| `src/presentation/web/screen-scenarios.tsx` | `ScenarioResult` takes `story` (nullable: no profile, no story) |
| `src/presentation/web/styles.css` | `.two-numbers`, `.two-numbers-question`, `.two-numbers-parts`, stacking to one column below 760px |

No view model gained a field and no screen's props changed shape beyond those three, because the
story is derived from the profile each screen already holds.

## Automated evidence

`npm run check` on Homebrew Node 24 is green:

| Step | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **292 pass, 0 fail** (287 before UX-7; 5 new) |
| `npm run build` | production bundle built successfully |

The five new tests cover the dynamic rate at 3.50%, 4.25% and the profile's own value; the path
count in both variants; the arbitration clause in both variants and its absence from the landmark
sentence; the four `RangeError` guards; the surface audit; and that the registry still describes
screens that exist and label the figure the way it says they do.

## Chrome evidence

Chrome 153.0.8010.37 headless, isolated profile at `/tmp/capital-ux7-chrome`, Vite on port 5178 and
CDP on 9229. New harness `tests/browser-two-numbers-ui.mjs` wrote `/tmp/ux7-ui-results.json` and the
`/tmp/ux7-*.png` screenshots.

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | browser/local equality; cancellation; 10,000 paths; **68.98%**; 4.21 s |
| Property worker smoke | browser/local equality; cancellation; 10,000 paths; **35.18%**; 4.71 s |
| Overview | exactly 1 full story, quoting **÷ 3.50%** and **10,000 times**, with the arbitration clause |
| Rate retuned to 4.25% in the app | the same story now reads **÷ 4.25%** and no longer says 3.50% |
| FIRE, after a completed run | the story and the **68.98%** probability on screen together |
| FIRE, after a salary edit | “Inputs changed” shown, no probability, story still 1 |
| FIRE, cancelled run | no probability, story still 1 |
| FIRE Age Curve, 2 ages at the configured 10,000 paths | 0 full stories, 1 caveat note carrying the clause |
| Wizard step 5 | 1 full story, **÷ 3.50%**, arbitration clause present |
| Scenario spending comparison at full count (3 cases, 15.7 s) | 3 spending rows, 0 full stories, 1 caveat note |
| Responsive | 0 px horizontal overflow at 390 × 844; all 8 tabs present; the two halves stack to one column |
| Uncaught page exceptions | 0 |

One harness bug is worth recording for the next package: card kickers are uppercased by the design
system's `text-transform`, so `innerText` reports “REFERENCE FIRE NUMBER”. Wait on the component's
`data-` handle rather than on a label CSS has transformed.

## Limitations and decisions

1. The audit covers `src/presentation/web/`. `src/presentation/cli/ledger-example.ts` also prints a
   reference FIRE number; it is a developer CLI dump of `ProjectionMetrics`, not a reader-facing
   surface, and it was deliberately left out of the registry rather than silently included.
2. The full variant is a two-column block of prose. It is deliberately not a disclosure: the whole
   point of the ticket is that the arbitration is the first thing a reader sees next to the two
   numbers, so hiding it behind “learn more” would restore the finding.
3. The story describes the *reference withdrawal rate* and the *configured path count*. It does not
   quote the target probability, because the target belongs to the plan and the story belongs to the
   two numbers; the target is already named by the Overview headline and the confidence band.
4. The scenario spending table carries the caveat once, under the table, rather than per row. Each
   row's reference number is the same arithmetic on a different spending case, so a per-row caveat
   would repeat one sentence three times.

## Paste-ready assignment — UX-8 (S): money and percent inputs that read like money and percent

Deliver `docs/ux-improvement-plan.md` § UX-8 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What UX-8 inherits:

- `fields.ts` keeps the NaN-on-invalid contract: an unparseable draft must reach `profileSchema` as
  `NaN` and be rejected there, never fall back to the previous value. `toDisplay`/`fromDisplay` are
  the only conversion authority and `displayScale` is what makes a percent field read in percent.
- `two-numbers.ts` is the pattern for shared reader-facing copy: view data with the reader's own
  numbers in it, one component rendering it, and an audit test deriving its surface list from the
  sources. UX-8's pension-relief labelling (A.2 note 1) is the same shape of problem.
- `format.ts` owns every display format. An annual-equivalent helper for monthly fields belongs
  there or in the field registry, not inline in a component.
- Do not change anything under `src/engine/`, any seed, path count, evaluation budget, tier or
  starter value for UX-8, and do not change a stored value as a side effect of focus or blur.
