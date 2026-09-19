# Handoff — UX-8: money and percent inputs that read like money and percent

Baseline: `ab278d0` (the UX-7 merge). Ticket: `docs/ux-improvement-plan.md` § UX-8.
Presentation-only package: `git diff --stat` over the branch touches no file under `src/engine/`, and
no seed, path count, tier, starter value or `profileSchema` rule moved. No numeric output changed —
every figure on every screen is the same figure it was, and the 10,000-path FIRE run still measures
68.98%.

## Delivered

### The unit is inside the box, and it is defined once

`src/presentation/view/field-display.ts` owns what a numeric input looks like. `fieldAffix(kind)`
is the only place that decides money leads with `£`, a monthly figure trails with `/mo`, a percent
trails with `%` and a multiple trails with `×` — and that an age, a path count, a random seed and a
correlation are bare numbers, because inventing a unit for them would lie.

The unit used to be a parenthesis in the label (`Gross salary (£)`). It is now an `aria-hidden`
adornment inside the input's frame, which would have silently cost a screen-reader user the unit
entirely — so `spokenUnit(kind)` puts it back as a word in the accessible name: **“Gross salary, in
pounds”**. That string is what the provenance and language harnesses now assert.

`FieldFrame` in `components.tsx` is the component that draws it, and it is the *only* one. The FIRE
screen's spending override is not a `NumberField` (see limitations) but still wears the same frame
rather than spelling `(£ / month)` into its own label again.

### Grouping on blur, which is display and therefore cannot be an edit

A money field rests as `55,000` and hands the reader back `55000` the moment they focus it. This is
a render-time choice, not a write:

```ts
export const fieldText = (def, value, focused) => focused ? value : groupedText(def, value);
```

No blur path calls `onChange`, so AC 2 holds by construction rather than by care. It is measured
anyway: the Chrome harness snapshots every input and select on the form, runs a focus/blur cycle on
an untouched salary, and asserts the whole snapshot is identical, no `edited` marker appeared and no
error count moved.

Grouping is restricted to `money` and `monthlyMoney`. `simulation.seed` is an `integer`, and
`20,260,101` would dress an identifier up as a quantity.

**The bug Chrome caught.** The first version of `groupedText` stripped commas before regrouping, so
a blurred `1,2,3` became `123` — a plausible figure on screen while the schema was rejecting the
draft as NaN, which is the worst of both. It now regroups only text `parseDisplayText` accepts;
anything else comes back exactly as typed and the error message stays the authority. The unit test
pins both halves, including that grouping never changes what a draft means.

### One rule for what counts as a number

`parseDisplayText(def, text)` is new and `fromDisplay` is now just a rescale over it, so the box, the
arrow keys and the validator cannot disagree. Two tolerances were added, both deliberate and tested:

| Input | Result | Why |
| --- | --- | --- |
| `1,234.50` | `1234.5` | Correct grouping, the form the field itself rests in |
| `£55,000` in a money field | `55000` | The box already shows £; a payslip paste is not a mistake |
| `92.5%` in a percent field | `0.925` | Same, for the field's own trailing unit |
| `1,2,3` | **NaN** | Grouping has to be *correct* grouping; guessing 123 is the silent fallback work package 4 forbids |
| `1,23`, `,234`, `1,234,` | **NaN** | Same rule |
| `£12` in a **percent** field | **NaN** | Only the field's *own* unit is tolerated |
| `12%` in a money field, `$12`, `abc`, `` (empty) | **NaN** | Unchanged |

`toDisplay` is untouched and still returns raw digits with no separators — it is the *editable*
value, and a test asserts it never contains a comma, so a focused field always stays typeable.

### `type="text"`, and the arrow keys put back

No `type="number"` input will hold a thousands separator at all: the browser rejects the value and
hands back `''`. Grouping therefore required `type="text"` with `inputMode="decimal"`, which costs
the native spinner and arrow-key stepping. `stepDraft(def, text, ±1)` restores stepping in display
units using the registry's own `step` (so ArrowUp on a salary moves £500 and on a percent moves one
point), and returns `null` for an unparseable draft so a typo is never quietly replaced by a number
somebody invented. Chrome drives this with real CDP key events, not synthesised values.

### The annual size of a monthly figure

`annualEquivalent(def, stored)` prints `= £15,600/yr` under every `monthlyMoney` field, through
`format.money`. It is null for every other kind, and null for a draft that is not a number, so a
half-typed entry never shows `= £NaN/yr`. `NumberField` derives the number with `fromDisplay` — the
registry's only conversion authority — so for an untouched field it is exactly the stored value, and
for a draft it tracks what the reader has typed.

### The two pension-relief figures, named apart

`src/presentation/view/pension-relief.ts` is the answer to A.2 note 1. `calculatePensionRelief`
returns `totalTaxRelief` *excluding* the employee-NI saving and `personalNetCost` *including* it;
both are right, and calling either "the tax relief" makes one of them a lie. Three names, each with
the sentence that stops it being confused with the others:

| Name | Figure | What it answers |
| --- | --- | --- |
| **Tax relief** | `totalTaxRelief` | Income tax only: income tax you did not pay, plus what the provider claimed back. NI is *not* in it. |
| **Tax and National Insurance you no longer pay** | `totalTaxRelief + employeeNiSaved` | The above plus the employee NI a salary sacrifice avoids. Strictly larger whenever sacrifice saves NI. |
| **What it actually costs you** | `personalNetCost` | How much smaller take-home pay is — the only one a reader can check against a payslip. |

The test solves the reference profile under both salary sacrifice and net pay: under sacrifice the
second figure is strictly larger than the first, under net pay they coincide, and the three labels
are distinct with none a substring of another, so no screen can shorten one into the other.

### Audits that keep working

Three, all derived from the sources rather than hand-kept lists:

1. Any file under `presentation/{web,cli,view}` that touches `totalTaxRelief`, `personalNetCost` or
   `employeeNiSaved` must go through `pensionReliefLines`, and the set of such files must equal
   `PENSION_RELIEF_SURFACES`.
2. No `.tsx` outside `components.tsx` may add a numeric input (by `type="number"` or by
   `inputMode="decimal"`) beyond the named exceptions in `HAND_ROLLED_INPUTS`.
3. No screen may re-implement `fieldAffix`, `fieldText`, `groupedText` or `stepDraft`, and no label
   may spell a `(£…)` unit back into its text.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/presentation/view/field-display.ts` | New: `FieldAffix`, `fieldAffix`, `spokenUnit`, `isGrouped`, `groupedText`, `fieldText`, `parseDisplayText`, `annualEquivalent`, `stepDraft` |
| `src/presentation/view/pension-relief.ts` | New: `PensionReliefFigures`, `PensionReliefLine`, `PensionReliefLineId`, `TAX_RELIEF_LABEL`, `TAX_AND_NI_LABEL`, `PERSONAL_NET_COST_LABEL`, `pensionReliefLines`, `PENSION_RELIEF_SURFACES` |
| `src/presentation/view/fields.ts` | `fromDisplay` delegates to `parseDisplayText`; new `HOUSEHOLD_OVERRIDE_FIELD` |
| `src/presentation/web/components.tsx` | New `FieldFrame`; `NumberField` renders `type="text"`, the frame, the annual line and arrow stepping; the `UNIT` label map is gone |
| `src/presentation/web/styles.css` | `.field-input`, `.field-affix`, `.field-annual`; per-kind input padding |

No view model gained a field and no screen's props changed shape. `toDisplay`, `applyDrafts`,
`validateDrafts` and `displayValue` are untouched.

## Automated evidence

`npm run check` on Homebrew Node 24 is green:

| Step | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **307 pass, 0 fail** (292 before UX-8; 15 new) |
| `npm run build` | production bundle built successfully |

## Chrome evidence

Chrome 153.0.8010.37 headless, isolated profile at `/tmp/capital-ux8-chrome`, Vite on port 5179 and
CDP on 9230. New harness `tests/browser-number-field-ui.mjs` wrote `/tmp/ux8-ui-results.json` and the
`/tmp/ux8-*.png` screenshots.

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | browser/local equality; cancellation; 10,000 paths; **68.98%**; 4.42 s |
| Property worker smoke | browser/local equality; cancellation; 10,000 paths; **35.18%**; 4.89 s |
| Units in the frame | salary `£` / none; monthly `£` / `/mo`; target `%`; seed neither |
| Units out of the labels | “Gross salary, in pounds”, “…, in pounds per month”, “…, in percent” |
| Resting values | salary **55,000**; monthly **1,300**; seed **421337** (ungrouped) |
| Focus → blur | **55000** → **55,000** |
| Blur on an untouched field | every form value identical; edited markers 0 → 0; errors 0 → 0 |
| Keyboard-only `1,234.50` | accepted, no error, field marked as the reader's; rests as **1,234.50** |
| ArrowUp / ArrowDown ×2 from 55000 | **55500** → **54500**, resting as **54,500** |
| Keyboard-only `1,2,3` | left as typed, red border, “Gross salary needs a number… nothing is assumed on your behalf” |
| Annual equivalent | **= £15,600/yr**, and **= £24,000/yr** after retyping the monthly to 2,000 |
| FIRE spending override | `£` / `/mo`; **= £30,000/yr** at 2,500; no annual line when blank |
| Completed 10,000-path FIRE run | **68.98%** |
| Responsive (390 × 844) | 0 px horizontal overflow; all 8 tabs; 26 px left padding clears the £; adornment inside the frame |
| Uncaught page exceptions | 0 |

All thirteen existing harnesses were re-run green against this branch: `provenance`, `language`, `tier-filter`, `wizard`, `two-numbers`, `overview-headline`,
`solver-question`, `attribution`, `property`, `section61`, `marginal`, `solver` (§61's £87,600
confirmed in 361 s) and `scenario` (the 60-cell matrix in 274 s).

Four of them asserted the old presentation and were retuned, not weakened:

- `provenance` and `language`: the unit moved out of three labels, and two money values now rest
  grouped (`25,000`, `50,000`).
- `solver`: the bound-unit check now reads the frame's own affixes *as well as* the label, which is
  a stronger statement of the same claim.
- `wizard`: `arithmeticLabel` was still looking for “Simple arithmetic, not the safety result”, a
  sentence **UX-7** deleted. It was failing on `main` before this package touched anything; it now
  checks the arbitration clause UX-7 replaced it with. Worth knowing: a stale browser harness can
  sit red for a whole package, because they are run by hand.

One harness note for the next package: **headless Chrome treats an unfocused window's page as
unfocused, and then `element.focus()` fires no focus event at all.** Without
`Emulation.setFocusEmulationEnabled`, every focus/blur assertion here would have passed vacuously.

## Limitations and decisions

1. **`type="number"` is gone from `NumberField`.** It had to be: the browser refuses to hold a value
   containing a separator. The trade is the native spinner (replaced by `stepDraft` on the arrow
   keys) and the browser's own numeric filtering (replaced by `parseDisplayText` → NaN →
   `profileSchema`, which was already the authority and gives a better message).
2. **Two inputs are deliberately not `NumberField`s**, named in `HAND_ROLLED_INPUTS` so the next one
   has to be argued for. The correlation matrix is a bare decimal in [-1, 1] with its own min/max.
   The FIRE screen's spending override keeps a native numeric input because *blank* is a meaningful
   third state there ("use the profile's own schedule") that the NaN-on-invalid draft contract has
   no way to express — and keeping it native is what guarantees only blank-or-a-number can reach the
   run. It wears `FieldFrame` and prints its annual equivalent, so it looks like every other money
   box; it just does not group on blur. Giving it drafts of its own belongs with run-settings work.
3. **Grouping is money-only.** Extending it to `integer` would group a random seed. If a future
   package wants `10,000` in the path-count box, that is a new kind, not a widened rule.
4. **Pension relief is not yet on a screen.** `totalTaxRelief` and `personalNetCost` are surfaced
   only by `presentation/cli/tax-example.ts`, a developer dump, which now prints all three named
   figures and their distinguishing sentences. The naming module and its audit exist so that the
   first reader-facing surface cannot get it wrong; the audit fails the moment one reads the raw
   fields without them. A screen that *shows* the reader their own relief was not in this ticket.
5. **The reader's own precision survives.** Blurring `1,234.50` gives `1,234.50`, not `1,234.5`:
   grouping regroups digits, it does not round them.

## Paste-ready assignment — UX-9 (M): starter situations ("people like me") as labelled scenario presets

Deliver `docs/ux-improvement-plan.md` § UX-9 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What UX-9 inherits:

- `fields.ts` still owns every numeric control, and `field-display.ts` owns how one looks. A preset
  that writes values writes them as *stored* values through `writePath`/`validateCandidate`, never
  as display text — `toDisplay` is what turns them back into something a box can hold.
- A preset changes the profile, so it is an edit: UX-2's provenance must mark what it changed, and
  the reset must still lead back to the starter. Check that before checking anything else.
- `pension-relief.ts` and `two-numbers.ts` are the pattern for shared reader-facing copy — view data
  with the reader's own numbers in it, one component rendering it, and an audit test deriving its
  surface list from the sources. A preset library needs the same shape: the presets are data, and a
  test asserts every one of them validates against `profileSchema` rather than trusting it.
- Do not change anything under `src/engine/`, any seed, path count, evaluation budget, tier or
  starter value for UX-9. A preset must be a labelled, reversible starting point, never a
  recommendation, and it must not run anything on selection.
- Run the browser harnesses you might have affected, not just your own. Two packages in a row have
  found a harness sitting red from an earlier one.
