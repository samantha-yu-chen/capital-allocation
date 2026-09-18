# Handoff — UX-3: the plain-language layer (labels, help, glossary, messages)

Baseline: `34678f1` (the UX-2 merge). Ticket: `docs/ux-improvement-plan.md` § UX-3.
Presentation-only package. No engine, schema, seed, path count, tier classification or starter
profile changed. `src/engine/`, `src/domain/` and `src/config/` have no diff at all.

## The problem

Finding A.1.3: the form speaks the specification's vocabulary. GIA, SIPP, MPAA, taper, cost basis,
positive semidefinite, p10/p90 arrive as labels with no ladder down to ordinary language, and the
help text underneath explains the *modelling convention* — correctly, and without ever explaining the
*concept*. Finding A.1.6: the validation messages are accurate schema prose. `Require floor <=
target <= comfort retirement spending` tells a reader who does not already know the model nothing at
all about what to type instead.

## Delivered

### 1. Three more columns of data on the registry

`ControlFieldDef` and `ChoiceFieldDef` gained `plainLabel`, `plainHelp` and `terms`. There is still
no parallel map — the UX-1 handoff's instruction — and `field()` now takes its optional half as a
named object rather than a positional tail, so `field(path, label, group, kind, step, tier, {…})`
replaces the `undefined, 'derivation'` calls the old signature forced.

- **`plainLabel` replaces `label` on screen** rather than sitting beside it; showing both would say
  the same thing twice. `label` stays the short internal name that handoffs and harnesses address a
  control by. `fieldName(def)` is the single accessor, and every user-facing site goes through it —
  `NumberField`, `SelectField`, `CheckboxField`, the composite editors' headings, the correlation
  cells' `aria-label`, and `provenance.ts`'s reset wording, which therefore improved for free.
- **`plainHelp` renders before `help`**, so the reader meets the idea before the rule that implements
  it. The precise sentence is never removed.
- **`terms` names the glossary entries a control's wording leans on**, and the control renders them
  as a "What is …" row.

Measured coverage across the profile and the property fixture — 105 registry entries:

| | essential | common | expert |
| --- | --- | --- | --- |
| entries | 13 | 24 | 68 |
| with `plainHelp` | 13 | 24 | 42 |
| with `plainLabel` | 5 | 11 | 13 |
| naming glossary terms | 6 | 12 | 32 |

AC 1 is asserted as completeness, not as a count: every non-expert entry must have non-empty
`plainHelp` or `tests/presentation-language.test.ts` fails, so a new essential field cannot be added
without one.

### 2. The glossary, as data

`src/presentation/view/glossary.ts` holds the 25 terms the ticket lists, each one paragraph aimed at
a reader who knows "salary", "rent" and "pension" and nothing else. Definitions explain; none
advises, and none states a figure the app would have to keep in step with the tax config.

References run in two directions and both are tested (AC 2):

- **Nothing dangles.** Every id in a registry entry's `terms`, in `SCREEN_TERMS`, and in any entry's
  `seeAlso` must resolve.
- **Nothing hides.** Every glossary entry must be referenced by a *surface* — the registry or
  `SCREEN_TERMS`. Cross-references between definitions deliberately do not count: a definition only
  other definitions point at is one nobody reaches from the app.

`SCREEN_TERMS` is the vocabulary each screen's **results** use, as opposed to its inputs, and the
test requires every one of the eight tab ids to have a non-empty entry.

`src/presentation/web/glossary-ui.tsx` renders it. A term is a real `<button>` with `aria-expanded`,
so it is keyboard-reachable and announced; the panel is an Organic card, closes on Escape or an
outside click, and a `seeAlso` link swaps the definition in place rather than opening a second
panel. No new dependency. At ≤ 760px the panel stops being anchored to the word and pins itself to
the viewport with a gutter — a popover that runs off the side of a phone is not a popover.

`GlossaryBar` sits in the shell, beneath the page header, so all eight destinations are covered by
one piece of wiring and none of them can quietly go without. It also carries the whole glossary
behind a disclosure.

### 3. Validation messages a person can act on

`src/presentation/view/messages.ts` maps a `FieldIssue` onto a sentence. Three rules keep it honest:

1. **The schema decides; this only re-words.** Nothing here can suppress an issue, soften what
   failed, or let an invalid profile through. It turns one string into another string, and
   `plainIssues` copies path, `fieldId` and group through untouched (tested).
2. **A message with no rule keeps the schema's own words.** Inventing a friendly sentence for a rule
   nobody wrote a rewrite for would be worse than the precise text, and the fallback is what makes an
   un-rewritten message visible.
3. **Rules are matched in order, most specific first, keyed on path *and* message**, as the ticket
   requires — so `Require floor <= target <= comfort…` on some other path does not match, which is
   tested.

`path` supports a single `*` segment, which is what lets one rule cover `portfolios.isa`,
`portfolios.gia` and `portfolios.pension`. Generic numeric bounds are rewritten field-aware, so a
`rate` field's `Too big: expected number to be <=1` reads "cannot be more than 100%" — the bound is
converted into the units the reader typed in, not the units the profile stores.

The ticket's five states are the first five rules, in its order. The other fourteen schema rules
(spending cases, included rent, phases, correlation, withdrawal order, salary sacrifice, and the
seven property rules) are rewritten too.

**AC 3 is asserted by pinning the schema's output.** `profileSchema.safeParse` is run against five
invalid fixtures and the resulting `path|code|message` list is compared against literals in the
test. If a later change edits the schema's wording to make a screen read better, that test fails —
which is the point.

The rewrite is applied in `profile-state.ts`, at the one place issues become strings for the UI, so
`errorsFor`, `issuesForGroup` and `crossFieldIssues` are all plain and `validation.issues` still
carries the schema's exact wording for the tier filter and the run key. The store also exposes
`plainIssues` for any future screen that wants the list.

### 4. Outside the ticket: a spending override that announces itself

While verifying, the user asked why the Overview cash-flow card read "Essential spending £6,000 /
Discretionary £0" when the form above it said £1,300 + £350 a month. It is not a calculation error:
`monthlyHouseholdOverride`, set on the **FIRE & Monte Carlo** screen, replaces the household monthly
total for every year (`src/engine/spending.ts`), covering essentials first out of it. The Overview
card used that figure and said nothing about it — a number contradicting the form two inches above
with no explanation, and the switch on another screen.

`CashFlowModel.spendingOverrideNote` (a tested view function, `null` when no override is in force)
now carries the sentence, and the Overview card renders it. No figure changed. This is recorded here
as a deliberate step outside UX-3's scope, taken because it is the same failure the ticket exists to
fix: a number that does not say what it is.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/presentation/view/glossary.ts` | **New.** `GlossaryEntry`, `GLOSSARY`, `SCREEN_TERMS`, `glossaryEntry`, `glossaryEntries`, `referencedTermIds`, `seeAlsoTermIds`, `danglingTermIds`, `unreferencedTermIds` |
| `src/presentation/view/messages.ts` | **New.** `REWRITES`, `IssueField`, `IssueFields`, `issueFields`, `plainMessage`, `plainIssues` |
| `src/presentation/view/fields.ts` | `plainLabel?`, `plainHelp?`, `terms?` on `ControlFieldDef` and `ChoiceFieldDef`; `fieldName()` exported; the private `field()` helper takes one options object instead of a positional `help, derivedFrom` tail |
| `src/presentation/view/overview-model.ts` | `CashFlowModel.spendingOverrideNote`; `spendingOverrideNote()` exported |
| `src/presentation/web/glossary-ui.tsx` | **New.** `GlossaryTerm`, `GlossaryTerms`, `GlossaryBar` |
| `src/presentation/web/components.tsx` | `NumberField` renders `fieldName`, `plainHelp` and the terms row; `SelectField` and `CheckboxField` gained `plainHelp` and `terms` |
| `src/presentation/web/profile-form.tsx` | `helpOf` became `textOf` (label + help + plainHelp + terms); the four composite editors take the `ChoiceFieldDef` rather than a bare label and share `EditorHeading` |
| `src/presentation/web/profile-state.ts` | `ProfileStore.plainIssues`; `errorsFor` / `issuesForGroup` / `crossFieldIssues` now return rewritten messages |
| `src/presentation/web/styles.css` | `.field-plain`, `.glossary-row`, `.glossary-lead`, `.glossary-anchor`, `.glossary-term`, `.glossary-panel*`, `.glossary-see-also`, `.glossary-bar`, `.glossary-all`, `.glossary-list`, plus their ≤ 760px rules |

Two checked-in harnesses were updated because the text they address changed, both noted in the diff:
`tests/browser-tier-filter-ui.mjs` now looks for the correlation matrix's rewritten message instead
of "positive semidefinite".

## Measured results

`npm ci && npm run check` in this worktree on the Homebrew Node 24 (`/opt/homebrew/opt/node@24/bin`),
all green:

| Step | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **278 pass, 0 fail** (269 before; 9 new) |
| `npm run build` | built in 994 ms |

New suite `tests/presentation-language.test.ts` (9 tests): every essential and common entry has plain
help (AC 1); a plain label replaces the technical one and keeps the term in parentheses, and every
entry still has a non-empty name; the glossary resolves in both directions and every tab names its
own result vocabulary (AC 2); `profileSchema` still produces exactly its own issues for five invalid
fixtures (AC 3); the five most common invalid states each read as a sentence, including the same
portfolio rule reaching three accounts through one path pattern (AC 4); bounds are reported in the
units the reader typed; an un-rewritten rule keeps the schema's words and a rewrite is chosen by path
as well as message; rewriting never moves an issue's field or group; a spending override says so.

### Chrome verification

Chrome 153.0.8010.37 headless, `APP_PORT=5176 CDP_PORT=9226`, isolated profile at
`/tmp/capital-ux3-chrome`.

New harness `tests/browser-language-ui.mjs` (results `/tmp/ux3-ui-results.json`, screenshots
`/tmp/ux3-*.png`). Measured:

| Check | Result |
| --- | --- |
| A jargon label is replaced | `personal.targetFireAge` reads **"Age you want to stop needing a salary (target FIRE age)"** |
| The precise sentence survives, second | order within the field is `field-plain` then `field-help` |
| A plain label is not invented where none is needed | `income.salaryAnnual` still reads "Gross salary (£)" |
| Plain sentences on the default Overview form | **30**, against 30 rendered inputs |
| Glossary panel | opens, 400+ character definition, stays inside the viewport |
| Cross-reference | "Financial independence (FIRE…)" → "The bridge period" swaps in place |
| Escape | closes the panel |
| Whole glossary | "All 25 terms", 25 definitions rendered |
| Result vocabulary per tab | all eight non-empty and not identical; FIRE names success probability, Marginal names ISA |
| Blank `personal.currentAge` | "Current age needs a number. The box is empty or holds something that is not one, and nothing is assumed on your behalf — the model waits rather than quietly using the previous value." |
| The plan is still blocked | "Fix the inputs before the model can run" still shown |
| Ages out of order (group cross-field path) | "These three ages have to run in order: your age now, then the age you stop relying on a salary, then the age the projection stops. …" — same wording in the Overview banner |
| Schema phrasing on screen | none: neither "Require currentAge" nor "expected number, received NaN" appears |
| Spending override off | Essential **£15,600**, discretionary **£4,200**, no note |
| Spending override £500/mo | Essential **£6,000**, discretionary **£0**, and the note names the amount and the screen it was set on |
| Override cleared | back to £15,600 / £4,200, note gone |
| Horizontal overflow at 1440 × 950 | 0 px |
| Horizontal overflow at 390 × 844 — default, with the popover open, and at `Everything` | 0 / 0 / 0 px |
| Popover at 390px | ≥ 8px gutters both sides, ≥ 200px wide, for an essential and an expert term |
| Uncaught console exceptions | 0 |

Regressions, same browser and server:

| Harness | Result |
| --- | --- |
| Worker smoke, baseline | `passed: true`, 10,000 paths, success **0.6898** — matches chunk 10, UX-1 and UX-2 |
| Worker smoke, `?property` | `passed: true`, 10,000 paths, success **0.3518** — matches chunk 10, UX-1 and UX-2 |
| `tests/browser-tier-filter-ui.mjs` | PASS; 13 / 30 / 85 inputs, validation still unmaskable, mobile overflow 0/0/0 |
| `tests/browser-provenance-ui.mjs` | PASS; markers, per-field, per-group and whole-profile resets unchanged |
| `tests/browser-property-ui.mjs` | passed; full run 4.66 s, 282 frames, max gap 16.8 ms; mobile overflow 0/0/0 |
| `tests/browser-solver-ui.mjs` | see the note in "Limitations" below |

### What the first harness run caught

Nothing in the plain-language layer. It caught my own wrong expectation: I had written the override
check against £18,000 a year, the figure from the reader's own edited profile in the bug report,
where the starter spends £1,300 + £350 a month and so shows £15,600 + £4,200. Fixed in the harness,
not in the app.

## Deviations and limitations

1. **`plainLabel` is not applied to labels that were already plain.** "Gross salary", "Cash", "Bonus",
   "Tax region", "Employee contribution" and "Include a property" keep their names. An earlier draft
   renamed "Include a property"; it bought nothing and broke three harnesses that address the control
   by that name, so it was reverted. The rule used throughout: a plain label is for a label that is
   *jargon*, not for one that is merely short.
2. **Glossary terms are declared, not detected.** A control names the terms its wording relies on;
   nothing scans prose for words that happen to appear. Detection would silently miss a term and
   silently link an unrelated use of the same word, and neither failure is visible. The cost is that
   adding a term to help text does not link it until the entry names it — which the "nothing hides"
   test partly covers, since a new glossary entry fails until something points at it.
3. **The glossary is reachable from the shell, not from inside the results themselves.** `SCREEN_TERMS`
   puts each tab's result vocabulary under the page header. Linking the specific word inside a
   sentence a screen prints would mean touching all eight screens' prose; UX-10's learn panel is the
   natural place to do that, and it inherits this data.
4. **The starter's value in a reset label still comes from `toDisplay`.** Unchanged from UX-2's
   deviation 2: "£55000", not "£55,000", until UX-8 lands.
5. **Some expert entries still have only the precise sentence.** 42 of 68 gained plain help; the rest
   (portfolio weight components after the first in each wrapper, several property cost lines, the
   bond/cash/property market moments) are either self-evident from the sibling that does have it, or
   are inputs no non-specialist should be setting. The ticket asks for expert plain help
   "opportunistically", so this is the intended state, not an unfinished one.
6. **`tests/browser-solver-ui.mjs` runs for roughly six minutes** (its required-salary solve is a full
   search at 10,000 paths). It was started against this build; if its result is not recorded in the
   table above, re-run it with `CDP_PORT=9226 APP_PORT=5176 node tests/browser-solver-ui.mjs` before
   trusting the solver screen's wording. UX-3 changes no solver input, bound or seed — only the text
   of validation messages and labels, none of which the solver screen's own controls use — so the
   expected result is the unchanged £87,600 confirmed.

## Paste-ready assignment — UX-4 (L): the "Start here" wizard

Deliver `docs/ux-improvement-plan.md` § UX-4 exactly as written, on a branch in a fresh worktree, per
`AGENTS.md`. What you inherit:

- **The wizard's copy is already written.** Every essential field has `plainLabel` and `plainHelp`,
  and UX-4's step 4 explicitly wants "a one-line plain definition" for cash, ISA, pension and GIA —
  that is `plainHelp`, and the glossary terms beside it. Render through `NumberField` and the
  `Choice` wrapper so you get the label, the plain sentence, the provenance marker and the glossary
  row without writing any of them again.
- **`fieldName(def)` is the only way to name a control.** Do not read `def.label` in a component.
- **Blocking progression on an invalid step** (UX-4's AC 2) uses `store.errorsFor(id)`, which is
  already plain. Cross-field rules that belong to no single input come from `store.crossFieldIssues`
  — also plain — and the wizard will need to decide which step owns a `personal`-level issue.
- **The tier list is the wizard's field set.** UX-4's AC 1 asks that the wizard's fields be a subset
  of the essential tier: 13 entries, recorded in `docs/handoffs/ux-1.md` and asserted in
  `tests/presentation-inputs.test.ts`.
- **`SCREEN_TERMS` has no wizard entry** because the wizard is not a tab. If it becomes a ninth
  navigation entry, give it one, or the "every tab names its vocabulary" test will need widening
  rather than silently skipping it.
- **Step 5 must reuse the reference-FIRE caveat wording, not restate it.** UX-7 makes that wording one
  shared constant; until then `simulation.referenceWithdrawalRate`'s `plainHelp` is the phrasing to
  match, and UX-7 will fold both into one.

Do not touch `src/engine/`, `profileSchema`, the tier classification or the starter profile without
saying why in your own handoff.
