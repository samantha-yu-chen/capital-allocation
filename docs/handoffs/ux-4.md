# Handoff — UX-4: the “Start here” wizard

Baseline: `967c4b4` (the UX-3 merge and measured solver follow-up). Ticket:
`docs/ux-improvement-plan.md` § UX-4. Presentation-only package. No engine, schema, seed, path count,
tier classification or starter-profile value changed.

## Delivered

### One entry point, the same eight analysis tabs

`Start here` sits above the tablist in the sidebar. It opens automatically until dismissed, stores
that dismissal under `capital-allocation:start-here-dismissed:v1`, and remains available as a
sidebar button afterwards. Selecting any analysis tab leaves the wizard and opens that tab; the
tablist itself still contains exactly the eight reference destinations on desktop and mobile.

The five-step rail is a real sequence rather than a new analysis destination:

1. **About you:** current age, target FIRE age and tax region.
2. **Income:** salary, bonus and employee/employer pension rates, with one sentence distinguishing
   the employer amount.
3. **Spending:** current and retirement essential/discretionary monthly spending plus included rent;
   “Use my current spending for retirement” copies the two current values through `store.edit`.
4. **What you have:** cash, ISA, workplace pension and GIA market value.
5. **See your result:** the deterministic reference first, then the optional full simulation.

`ProfileFields` already rendered named numeric registry entries. `ProfileChoiceFields` is its new
choice-control counterpart; the tax-region select therefore passes through the same `Choice`,
`SelectField`, provenance marker, plain help and glossary wiring as the full form. Nothing in the
wizard names or explains a field separately from UX-3's registry.

The inherited UX-1 note resolves the ticket's inconsistent AC 1 literally: bonus, included rent and
GIA were deliberately classified `common` and remain so. `WIZARD_FIELD_IDS` contains every one of
the 13 essential entries plus exactly those three requested common entries. The test rejects an
expert field and rejects a missing essential field.

### Progression and validation

`wizardStepIssues` assigns a field issue to the step containing that id and assigns a cross-field
issue to the step containing its group. Continue and forward jumps both stop at the first invalid
step. The message is `store.plainIssues`, so the age-order failure in Chrome reads UX-3's sentence
beginning “These three ages have to run in order”; the schema output remains unchanged.

The result step also refuses to render figures while the complete profile is invalid. That matters
when a reader reopens the wizard after making an expert-only field invalid in Overview: the wizard
does not hide that failure or send an unparseable value to an engine.

### One deterministic source and one stochastic runner

`wizardResult` calls `computeOverview`; it does not reproduce FIRE arithmetic. For the unchanged
starter profile it shows:

- reference FIRE number **£565,714**, labelled “Simple arithmetic, not the safety result”;
- projected investable assets at FIRE **£755,017**, labelled as one deterministic path rather than
  a probability or forecast;
- the deterministic funding outcome, including first failure age when one exists.

The invitation beneath those figures says the entered 10,000 paths will run only on the button.
The wizard receives `runner.state`, `onRun` and `runner.cancel` from `App`, exactly as `FireScreen`
does. It therefore shares progress, cancellation, the completed result, and the same `runKey`; no
simulation can start from mounting or progressing through the wizard. Editing any shared profile
field aborts an in-flight run and removes the published probability through the existing hook.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/presentation/view/wizard-model.ts` | **New.** `WizardStepId`, `WizardStep`, `WIZARD_STEPS`, `WIZARD_FIELD_IDS`, `wizardStepIssues`, `WizardResult`, `wizardResult`, `wizardTierCoverage` |
| `src/presentation/web/profile-form.tsx` | `ProfileChoiceFields`, the named-choice counterpart to `ProfileFields` |
| `src/presentation/web/screen-wizard.tsx` | **New.** Five-step wizard and deterministic/full-run result surface |
| `src/presentation/web/app.tsx` | App-level wizard open/dismiss state; shared Monte Carlo runner supplied to the wizard; sidebar entry point |
| `src/presentation/web/styles.css` | Responsive step rail, stage, result and sidebar-entry styling on Organic tokens |

## Automated evidence

`npm run check` on Homebrew Node 24 is green:

| Step | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **282 pass, 0 fail** (278 before UX-4; 4 new) |
| `npm run build` | production bundle built in 1.09 s on the final pass |

`tests/presentation-wizard.test.ts` proves that every essential field appears, only the ticket's
three common fields extend the set, wizard-only edits parse through `profileSchema`, the age-order
issue remains plain and belongs to About you, the deterministic values come from the Overview model,
and the run key is byte-for-byte the FIRE run key.

## Chrome evidence

Chrome 153.0.8010.37 headless, isolated profile at `/tmp/capital-ux4-chrome`, Vite on port 5177 and
CDP on 9227. `tests/browser-wizard-ui.mjs` produced `/tmp/ux4-ui-results.json` and screenshots
`/tmp/ux4-wizard-*.png`.

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | browser/local equality; cancellation; 10,000 paths; **68.98%**; 5.14 s; 526 timer ticks |
| Property worker smoke | browser/local equality; cancellation; 10,000 paths; **35.18%**; 5.68 s; 581 timer ticks |
| Invalid progression | FIRE age 20 stayed on About you and showed the plain age-order message |
| Implicit work | no progress or probability existed before the explicit run button |
| Deterministic result | £565,714 reference number and £755,017 FIRE-age wealth, both qualified |
| Cancellation | progress advanced; cancel published no probability |
| Full wizard run | **68.98%**, identical to the FIRE tab's shared completed result |
| Responsiveness | 324 animation frames; **16.8 ms maximum frame gap** during the full run |
| Stale result | editing salary removed the 68.98% result immediately |
| Persistence | dismissal survived reload; the sidebar button reopened the wizard |
| Responsive layout | 0 px horizontal overflow at 390 × 844; five steps and all eight tabs present |

Visual review of the desktop result, completed probability and mobile screenshots found no clipped
content or overlapping controls. The mobile tablist and step rail scroll horizontally by design;
the document itself does not overflow.

The wizard is the default first surface, so the three earlier Overview harnesses now select the
Overview tab explicitly before exercising it. All passed unchanged in substance:
`browser-tier-filter-ui.mjs` (13 / 30 / 85 inputs and unmaskable expert error),
`browser-provenance-ui.mjs` (money/percent/select and group resets), and
`browser-language-ui.mjs` (30 of 30 visible inputs explained, plain validation, glossary and zero
desktop/mobile overflow).

## Limitations and decisions

1. The wizard keeps the starter's retirement spending until the reader changes it or presses “Use
   my current spending for retirement”. It does not silently keep retirement spending coupled to
   later current-spending edits; doing so would overwrite an explicit answer and confuse UX-2
   provenance.
2. A valid advanced profile may contain an expert-field error the wizard cannot repair. Step 5
   reports that inputs need attention rather than exposing expert controls inside the guided path;
   Overview remains the repair surface.
3. Dismissal is a local device preference, like the saved scenario library. Clearing site storage
   makes the wizard appear automatically again.

## Paste-ready assignment — UX-5 (M): question-led Overview headline

Deliver `docs/ux-improvement-plan.md` § UX-5 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What UX-5 inherits:

- `App` owns the only ordinary Monte Carlo runner and now shares it between the wizard and FIRE.
  The Overview headline must consume that completed state from `App`; do not create a third runner
  or cache a probability in Overview.
- A wizard-launched result is a normal FIRE result with the same `runKey`. It must populate the UX-5
  headline exactly as a FIRE-launched run does, and an edit must clear both at once.
- Dismissal/open state is presentation state and is deliberately absent from `runKey`.
- The wizard's “See the full FIRE result” is the existing plain-language bridge to the detailed
  result. UX-5 should link its probability to the same `fire` tab and keep this vocabulary aligned.
- The FIRE-age curve still owns a separate `useAnalysis` hook inside `CurveScreen`, so its completed
  result is not yet lifted to `App`. UX-5 needs that result for the earliest qualifying age; lift
  the state without changing curve computation, path count, common paths or cancellation rules.

Do not change an engine, schema, seed, path count, tier or starter value for UX-5. If the headline
cannot name an earliest age because no completed curve exists, it must show no age, as the ticket
requires.
