# Handoff — UX-1: field tiering (essential / common / expert)

Baseline: `9c4f56c` (the UX plan commit on top of v0.3). Ticket: `docs/ux-improvement-plan.md` § UX-1.
This is a presentation-only package. No engine, schema, seed, path count or convention changed.

## Delivered

- `NumberFieldDef` carries a required `tier: 'essential' | 'common' | 'expert'`. The `field()`
  constructor takes it as a positional argument, so an untiered field is a **compile error**, not
  only a test failure.
- The select, checkbox, free-text and composite-editor controls that used to be inline JSX in
  `profile-form.tsx` are now registry data: `ChoiceFieldDef` / `CHOICE_FIELDS` / `choiceFieldsFor()`
  own their label, options, help text and tier. `profile-form.tsx` renders them through one
  `Choice` wrapper and no longer holds any control metadata.
- `fieldVisibility(mode, numbers, choices, issues)` is the React-free filter. It returns `shows(id)`,
  `showsGroup(group)`, the `forced` set and `inputCount`.
- `ProfileForm` gained `filterable`. When set it renders the depth chooser
  (`Essential only` / `Essential + common` / `Everything`, default `Essential + common`) held in
  component state. Only the Overview form sets it — see *Deviations*.
- A group with nothing visible is not rendered. A group carrying an issue is rendered and opened,
  and the offending entry is forced visible whatever the filter says.

### The rule that makes validation unmaskable

`forcedFieldIds()` matches an issue path against a registry id as `path === id || path.startsWith(id + '.')`.
So an issue reported at `market.correlation` forces the matrix editor; an issue at
`market.correlation.0.1` forces both the cell and the editor that owns it. Nothing else expert comes
along for the ride — verified in Chrome and in a unit test.

## The recorded classification

**Essential — 13 entries** (the list AC 2 pins; `tests/presentation-inputs.test.ts` asserts the
registry's essential set is exactly this):

`personal.currentAge`, `personal.targetFireAge`, `personal.taxRegion`, `income.salaryAnnual`,
`spending.current.essentialMonthly`, `spending.current.discretionaryMonthly`,
`spending.retirement.essentialMonthly`, `spending.retirement.discretionaryMonthly`,
`assets.cash`, `assets.isa`, `assets.pension`, `pension.employeeRate`, `pension.employerRate`.

**Common — 24 entries:** `personal.endAge`, `personal.targetSuccessProbability`,
`income.bonusAnnual`, `income.otherNonSavingsAnnual`, `income.salaryGrowthReal`,
`income.statePensionAnnual`, `income.statePensionAge`, `spending.currentRentMonthlyIncluded`,
`spending.lifestyleCreepRate`, `assets.gia.marketValue`, `assets.sipp`, `pension.matchUpToRate`,
`pension.matchRate`, `pension.accessAge`, `pension.method`, `pension.salarySacrificeAvailable`,
`liquidity.emergencyFundMonths`, and the property core: `property` (the include checkbox),
`property.use`, `property.mortgageType`, `property.marketValue`, `property.mortgageBalance`,
`property.mortgageAnnualRate`, `property.mortgageTermYears`.

**Expert — 68 entries.** Totals on a profile that has a property but no phases, capital needs,
breakdown or refinance rows: 13 essential + 24 common + 68 expert = **105** registry entries.
Everything else, that is: portfolios, market moments and the correlation matrix, the whole
`wrappers` group, the `household` group, floor/comfort runs, the three scenario spending cases,
phases, capital needs, withdrawal order, seed, path count, reference withdrawal rate, NI shareback,
MPAA/taper flags, carry-forward, GIA cost basis/carried losses, lifetime lump sum already taken,
post-FIRE employment income, minimum liquid years, tax year, assumption version, and every property
field beyond the four core ones.

### Judgement calls against the ticket's starting list

| Field | Ticket | Delivered | Why |
| --- | --- | --- | --- |
| `pension.matchUpToRate`, `pension.matchRate` | expert | **common** | The employer match is something an ordinary employee knows and it changes the answer materially. Leaving it expert would hide the single biggest free contribution in the model. |
| `pension.accessAge` | expert | **common** | It is the gate on every early-retirement plan. It has a correct default (57), so it is not essential, but it should be visible to anyone comparing FIRE ages. |
| `pension.method`, `pension.salarySacrificeAvailable` | not listed | **common** | The schema refuses `salary_sacrifice` when sacrifice is unavailable, so a reader who cannot see the pair cannot fix that error from the default view. |
| `household.adults`, `household.children` | not listed | **expert** | They feed **only** the optional spending breakdown's reconciliation (`contracts.ts` superRefine); with no breakdown they change nothing. Showing a field that cannot move a result is exactly the noise this ticket removes. |
| `isa.allowanceUsed` | not listed | **expert** | Defaults to 0 and only matters for a partial current tax year; making it expert lets the whole `wrappers` group disappear from the default view, which is the intent of the ticket. |
| `income.retirementEmploymentAnnual` | expert | expert | Kept expert, but note it is plain-language-friendly; UX-3 may want plain help for it anyway. |

## Measured results

`npm run check` equivalent, all green:

| Step | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `tsc -p tsconfig.build.json && node --test build/tests/*.test.js` | **258 pass, 0 fail** (253 before; 5 new) |
| `vite build` | built in 942 ms |

New tests in `tests/presentation-inputs.test.ts`:

1. *every registry entry carries a tier, and the essential set is exactly the recorded list* — AC 1 and AC 2's list.
2. *the default filter keeps the profile form to a readable number of inputs* — AC 2's ≤ 40.
3. *tier depth is cumulative, so a filter only ever adds to the one below it*.
4. *filtering is display only: the profile, the validation and the run key never move* — AC 3.
5. *a validation issue is never filtered away, however deep the field is* — AC 4's view-model half.

### Chrome verification

New harness `tests/browser-tier-filter-ui.mjs` (Chrome 153 headless, `APP_PORT=5176 CDP_PORT=9226`,
results in `/tmp/ux1-ui-results.json`, screenshots `/tmp/ux1-*.png`). Measured:

| Check | Result |
| --- | --- |
| Rendered inputs: Essential only / default / Everything | **13 / 30 / 85** (AC 2: ≤ 40) |
| Default filter on load | `Essential + common` |
| Groups hidden by default | Household, ISA & GIA behaviour, Portfolios by wrapper, Market assumptions, Simulation |
| Net worth across all three filters | identical (`baseline == essential == all == restored`) |
| Hidden stored values after a round trip | equities 7%, seed 421337, ISA equities 85% — unchanged |
| Non-PSD correlation, then switch to **Essential only** | matrix rendered, offending cell rendered, "Correlation must be symmetric, unit-diagonal and positive semidefinite" shown, group open, "Fix the inputs before the model can run" banner present, and Simulation still hidden (**AC 4**) |
| After repair, at the same filter | Market assumptions disappears again |
| FIRE tab's targeted `simulation` group | `simulation.count` and `simulation.seed` still rendered; no filter control |
| Horizontal overflow at 390 × 844, each of the three filters | 0 px |
| Uncaught console exceptions | 0 |

Regressions, same browser and server:

| Harness | Result |
| --- | --- |
| Worker smoke, baseline | `passed: true`, 10,000 paths, success **0.6898** — matches chunk 10 |
| Worker smoke, `?property` | `passed: true`, 10,000 paths, success **0.3518** — matches chunk 10 |
| `tests/browser-property-ui.mjs` | passed; full run 4.63 s, 282 frames, max gap 16.8 ms; mobile overflow 0/0/0 |
| `tests/browser-solver-ui.mjs` | passed; FIRE 68.98%, curve 42:45.71 … 50:90.61, required gross salary **£87,600 confirmed** in 370 s |

## Changed public interfaces

`src/presentation/view/fields.ts` — added: `FieldTier`, `TierMode`, `TIER_MODES`,
`DEFAULT_TIER_MODE`, `tierInMode`, `ChoiceControl`, `ChoiceOption`, `ChoiceFieldDef`,
`CHOICE_FIELDS`, `choiceFieldsFor`, `isGridField` (moved here from `profile-form.tsx`),
`forcedFieldIds`, `Visibility`, `fieldVisibility`. Changed: `NumberFieldDef` now has `tier`;
the private `field()` helper takes `tier` before `help`.

`src/presentation/web/profile-form.tsx` — `ProfileForm` gained the optional `filterable` prop.
`ProfileFields` is unchanged in signature and is deliberately never filtered.

## Deviations and limitations

1. **The filter is opt-in per form, not global.** `screen-fire.tsx` renders
   `<ProfileForm groups={['simulation']}/>` and `screen-property.tsx` renders
   `groups={['property','spending']}`; both consist mostly of expert-tier fields, so a default
   `Essential + common` there would have emptied those screens. Forms without `filterable` behave
   exactly as before (mode `all`). Only Overview is filterable today. A later ticket that gives the
   property screen its own chooser should do it deliberately.
2. **The chooser is not persisted** beyond the component's lifetime — the ticket asked for component
   state, not profile or storage state, so switching tabs and returning resets it to the default.
3. **Tiers are not yet used by anything but the form.** UX-3 and UX-4 both consume them; nothing
   reads `tier` outside `fieldVisibility` today.
4. **`npm` itself was unusable on this machine** — the Node 24 install at
   `/tmp/node-v24.21.0-darwin-arm64` has a truncated `lib/node_modules/npm`. The three stages of
   `npm run check` were run individually with `node_modules/.bin/tsc` and `node_modules/.bin/vite`
   against a `node_modules` symlinked from the primary checkout. Anyone re-running this in a fresh
   worktree needs `npm ci` or the same symlink.

## Inheritance note for UX-4 (read before writing that ticket's tests)

UX-4 AC 1 says "wizard field set ⊆ essential tier", but the wizard's own step list in the plan
includes **bonus** (step 2), **rent inside current spending** (step 3) and **GIA** (step 4), all of
which are `common` here and should stay common — none of them is needed for a first meaningful
answer, and promoting them would push the essential view past the "handful of numbers" it is for.
Read that AC as: *the wizard's field set ⊆ essential ∪ common, and every essential field appears in
the wizard.* Both halves are checkable against this registry.

## Paste-ready assignment — UX-2 (M): value provenance

Deliver `docs/ux-improvement-plan.md` § UX-2 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What you inherit from UX-1:

- `src/presentation/view/fields.ts` is the single description of the editable surface: numeric
  fields in `NUMBER_FIELDS` / `arrayFields`, everything else in `CHOICE_FIELDS` / `choiceFieldsFor`.
  Put UX-2's derivation notes on those same entries as optional data; do **not** add a parallel map.
- Every entry has a `tier`. Use it to decide which fields get a per-field reset affordance first if
  you need to stage the work — but the AC asks for all of them.
- `provenance(profile, starter)` must key on the same ids this registry uses (`def.id`, the
  dot-joined path), so the marker can be looked up for a choice field as easily as a numeric one.
- `ProfileForm` renders choice controls through the `Choice` wrapper; add the marker and the reset
  button inside that wrapper and `NumberField` rather than at each call site.
- `fieldVisibility` must keep working: a reset that introduces a validation error has to force the
  field visible. Add a test for reset-while-filtered.
- The starter profile must stay byte-identical to `createExampleProfile()` (UX-2 AC 4). Note that
  `screen-overview.tsx` still calls `store.reset()` labelled "Reset to the specification's example
  profile" — that button and UX-2's per-group reset must not end up with two different ideas of
  what the default is.

Do not touch `src/engine/`, `profileSchema`, or the tier classification above without saying why in
your own handoff.
