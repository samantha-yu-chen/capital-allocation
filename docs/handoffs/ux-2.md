# Handoff — UX-2: value provenance (default vs edited) and reset

Baseline: `f76ddd5` (the UX-1 merge). Ticket: `docs/ux-improvement-plan.md` § UX-2.
Presentation-only package. No engine, schema, seed, path count, tier classification or convention
changed. `src/engine/` and `src/domain/` have no diff at all.

## The problem, in the user's words

*"should be some management of what to change, what's default by calc."* Ninety inputs each rendered
a number and none of them said whether that number was a curated default or something the reader had
typed. There was also no single answer to "what is the default": the Overview button said "the
specification's example profile", and nothing else in the UI referred to it.

## Delivered

- **One starter profile.** `src/presentation/view/starter-profile.ts` exports `createStarterProfile()`
  and `STARTER_PROFILE_LABEL`. It returns `createExampleProfile()` — the same worked example, under a
  name that says what it is for. AC 4 is asserted three ways: JSON equality with the fixture, run-key
  equality, and a freshness check that mutating one copy cannot affect the next.
- **The comparison, React-free.** `src/presentation/view/provenance.ts`:
  - `provenance(profile, starter) → Map<fieldId, 'default' | 'edited'>` — AC 1's function, keyed on
    the same ids the registry uses, covering numeric *and* choice entries.
  - `fieldProvenance(profile, starter) → Map<fieldId, ProvenanceEntry>` — the described form the UI
    renders: state, the starter's value as that control would show it, whether a reset has anything
    to restore, the sentence for the tooltip and assistive technology, and the reset's accessible
    name.
  - `resetToStarter(profile, starter, ids) → Profile`, `resettableInGroup`, `editedEntries`,
    `draftsClearedBy`, `provenanceSummary`.
- **Markers and resets in the form.** `ProfileForm` computes the map once and attaches the marker
  through `NumberField`, `SelectField`, `CheckboxField` and the four composite editors' headings, so
  no call site carries provenance logic. Per-group reset buttons appear only when that group has
  something to put back, and name the count. The Overview button is now "Reset everything to the
  starter profile", with a sentence saying what the starter is and is not.
- **Derivation notes as registry data.** `ControlFieldDef.derivedFrom` and
  `ChoiceFieldDef.derivedFrom` carry a plain sentence where a default is worked out rather than
  chosen, and the form renders "The default is …" under the control. There is no parallel map, per
  the UX-1 handoff's instruction.

### The two rules that keep it honest

1. **Stored values, never display strings.** `toDisplay` tidies to 12 significant figures, so `0.07`
   and `0.070000000000001` both render as `7` — and the engine would see different numbers. The
   comparison uses `Object.is` for numbers and a key-ordered serialisation for structures. A test
   pins both directions: the invisible difference reads as `edited`, and retyping a value that is
   already there does not manufacture one.
2. **No default is invented.** A field the starter has no value for — a phase row, any field of a
   property the starter does not include — reads as `edited`, offers no reset, and says so
   ("… the starter profile has no value for it, so there is nothing to reset it to"). Resetting such
   a field to a made-up number would be worse than offering nothing. The composite that owns it does
   reset: "spending phases" goes back to the empty list, "include a property" back to none.

### A reset is an edit

`resetField` / `resetGroup` write the starter's value into the profile and drop **only** the drafts
that reset invalidates (the field's own id and anything beneath it). Everything else in `drafts`
stays, so another field's in-flight invalid draft keeps reporting its own issue and the plan stays
blocked — AC 3, asserted in both the unit tests and Chrome. A reset that itself breaks a cross-field
rule (restoring retirement spending under a floor the reader raised) fails validation like any other
edit rather than being applied quietly.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/presentation/view/starter-profile.ts` | **New.** `createStarterProfile`, `STARTER_PROFILE_LABEL` |
| `src/presentation/view/provenance.ts` | **New.** `Provenance`, `ProvenanceEntry`, `provenance`, `fieldProvenance`, `editedEntries`, `resettableInGroup`, `resetToStarter`, `draftsClearedBy`, `provenanceSummary` |
| `src/presentation/view/fields.ts` | `ControlFieldDef.derivedFrom?` and `ChoiceFieldDef.derivedFrom?` added; the private `field()` helper takes `derivedFrom` after `help` |
| `src/presentation/web/components.tsx` | `FieldMark` and `ProvenanceMark` exported; `NumberField`, `SelectField`, `CheckboxField` gained an optional `mark` |
| `src/presentation/web/profile-state.ts` | `ProfileStore` gained `provenance`, `resetField`, `resetGroup`; `reset()` now builds the starter |
| `src/presentation/web/profile-form.tsx` | `Choice`'s render prop is now `(def, mark)`; the four editors take a `mark`; group reset and the summary line added |
| `src/presentation/web/styles.css` | `.field-label-row`, `.provenance`, `.link-button`, `.visually-hidden` |

## Measured results

`npm run check` equivalent, all green:

| Step | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `tsc -p tsconfig.build.json && node --test build/tests/*.test.js` | **269 pass, 0 fail** (258 before; 11 new) |
| `vite build` | built in 964 ms |

New suite `tests/presentation-provenance.test.ts` (11 tests): the starter is byte-identical to the
fixture (AC 4); an untouched profile is entirely default and every registry entry is described;
provenance follows scalar, array-backed and percent fields including the matrix cell and the editor
that owns it (AC 1); display rounding does not decide provenance, in both directions (AC 1); choice
controls read their default in words; every recorded derivation is true of the starter; a reset
restores the starter value and clears the marker (AC 2); a group reset restores only its group; a
reset is validated and leaves another field's invalid draft reporting (AC 3); a reset clears only the
drafts it invalidates and a reset-induced error is still unfilterable; the summary counts correctly.

### Chrome verification

New harness `tests/browser-provenance-ui.mjs` (Chrome 153 headless, `APP_PORT=5176 CDP_PORT=9226`,
results in `/tmp/ux2-ui-results.json`, screenshots `/tmp/ux2-*.png`). Measured:

| Check | Result |
| --- | --- |
| Markers on an untouched profile | **0**; summary reads "Every one of these 90 values is still the starter profile's." |
| Group reset buttons when nothing is edited | none rendered |
| Money field (`income.salaryAnnual` → 61,000) | marker appears; reset labelled "Reset Gross salary to the default £55000"; reset restores `55000` and clears the marker |
| Percent field (`pension.employeeRate` → 12%) | marker appears; "Reset Employee contribution to the default 5%"; reset restores `5` |
| Select (`personal.taxRegion` → rest of UK) | marker appears; "Reset Tax region to the default Scotland"; reset restores `scotland` |
| Reset while `personal.currentAge` is empty | still blocked; the age keeps its own message ("Invalid input: expected number, received NaN") and its empty box; salary restored; an unrelated edited field (Cash) untouched — **AC 3** |
| After repairing the age | model runs again; only Cash still marked |
| Group reset | "Reset income (2 values) to the default" restores salary and bonus, leaves Cash at 25,000 |
| After resetting every edit | net worth back to **£100,000**, the starter's own figure |
| Marker vs tier filter | a hidden field shows no marker (it shows nothing); its edit survives and the marker returns at `Everything` |
| Whole-profile reset | agrees with the per-field one: nothing marked, ISA back to 50,000, net worth £100,000 |
| Horizontal overflow at 390 × 844 | 0 px, markers and resets included |
| Uncaught console exceptions | 0 |

Regressions, same browser and server:

| Harness | Result |
| --- | --- |
| Worker smoke, baseline | `passed: true`, 10,000 paths, success **0.6898** — matches chunk 10 and UX-1 |
| Worker smoke, `?property` | `passed: true`, 10,000 paths, success **0.3518** — matches chunk 10 and UX-1 |
| `tests/browser-tier-filter-ui.mjs` | PASS; 13 / 30 / 85 inputs, validation still unmaskable, mobile overflow 0/0/0 |
| `tests/browser-property-ui.mjs` | passed; full run 4.65 s, 282 frames, max gap 16.8 ms; mobile overflow 0/0/0 |
| `tests/browser-solver-ui.mjs` | passed; FIRE 68.98%, curve 42:45.71 … 50:90.61, required gross salary **£87,600 confirmed** in 368.9 s |

### What the first Chrome run caught

Provenance originally read the last profile the schema accepted. With one field emptied, every other
marker and reset on the form disappeared — precisely when a reader most needs to know which values
are theirs. It now reads the drafted candidate, so a box holding an unparseable draft is reported as
the reader's, not as the default. Fixed in `5c31ba7`; the harness asserts it.

## Deviations and limitations

1. **Provenance is not shown for a value at its default.** There is no "default" badge: on a form of
   ninety inputs, badging the eighty-five untouched ones would say nothing. What the reader changed
   is what stands out, and the summary line gives the count. The derivation sentence *is* shown
   whatever the state, since it explains the default rather than the change.
2. **The starter's value is shown with `toDisplay` formatting**, so a reset label reads "£55000",
   not "£55,000". Thousands separators are UX-8's job (`fromDisplay`/`toDisplay` and the £/% affixes
   are explicitly that ticket's scope); when it lands, the label improves for free because the
   wording comes from one view function.
3. **The summary and the per-group resets appear only on the filterable Overview form.** The FIRE and
   Property screens render targeted groups without the depth chooser (UX-1's deviation 1); their
   per-field markers and resets do work — the marker is attached in `FieldGrid`, not in the chooser.
4. **Provenance is against the starter, not against "last saved".** Loading a scenario from the
   library replaces the working profile, and every field that differs from the starter then reads as
   edited, which is accurate but not always what a reader means by "changed". UX-9 introduces chosen
   starter situations and its AC 3 asks provenance to compare against the chosen starter; that is the
   right place to generalise `createStarterProfile()` into "the starter in force".
5. **`npm` itself is still unusable on this machine** (the Node 24 install at
   `/tmp/node-v24.21.0-darwin-arm64` has a truncated `lib/node_modules/npm`). The three stages of
   `npm run check` were run individually with `node_modules/.bin/tsc` and `node_modules/.bin/vite`
   against a `node_modules` symlinked from the primary checkout.

## Paste-ready assignment — UX-3 (M): plain-language layer

Deliver `docs/ux-improvement-plan.md` § UX-3 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What you inherit:

- `src/presentation/view/fields.ts` remains the single description of the editable surface. Add
  `plainLabel` / `plainHelp` to the same entries, beside `tier` (UX-1) and `derivedFrom` (UX-2) —
  still no parallel map. Note that `derivedFrom` is already plain-language prose aimed at the same
  reader; keep the two consistent in voice, and do not duplicate one inside the other.
- The tiers are your list of what must have plain help: 13 essential and 24 common entries, recorded
  in `docs/handoffs/ux-1.md` and asserted in `tests/presentation-inputs.test.ts`.
- `provenance.ts` writes user-facing sentences too (the marker's note, the reset's accessible name).
  If UX-3 introduces a glossary or a message map, those sentences are candidates for it — but the
  starter's *value* formatting must keep coming from `toDisplay`, so UX-8 can improve it once.
- The validation-message rewrite must not touch `profileSchema`: `tests/presentation-provenance.test.ts`
  asserts reset behaviour through real schema issues, and `tests/presentation-inputs.test.ts` pins the
  issue paths. Keep the map keyed on path + message, as the ticket says.
- `ProfileForm` renders every control through `NumberField` or the `Choice` wrapper, and the wrapper
  already receives the def. A popover or side panel should hang off those two places, not off the
  individual call sites, or it will not cover the composite editors.

Do not touch `src/engine/`, `profileSchema`, the tier classification or the starter profile without
saying why in your own handoff.
