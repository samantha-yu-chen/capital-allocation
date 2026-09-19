# Handoff — UX-9: starter situations ("people like me") as labelled scenario presets

Baseline: `7168c21` (the UX-8 merge). Ticket: `docs/ux-improvement-plan.md` § UX-9.
Presentation-and-fixture package: `git diff --stat` over the branch touches no file under
`src/engine/`, and `profileSchema` is unchanged. No figure on any screen moved for the profile the
app opens with — the 10,000-path FIRE run still measures **68.98%** and the property comparison
**35.18%**.

## Delivered

### Six whole situations, and what a situation is allowed to change

`src/domain/starter-situations.ts` holds the data. A situation is a name, a sentence saying who it is
drawn for, a list of reasons for its figures, the plan-level `ScenarioOptions`, and a builder that
goes through `parseProfile` — so `profileSchema` stays the only validation authority and a situation
cannot hold a profile an engine would reject. `starterProfile(id)` re-parses on every call, so two
callers never share structure.

The narrowing decision is the important one: **`market`, `simulation` and `portfolios` are read off
the worked example in every entry, not restated.** The same seed, the same 10,000 paths, the same
return assumptions, the same withdrawal order, the same 85/10/5 asset mix. A situation changes your
circumstances and never the model behind them, and a test compares all three blocks against
`createExampleProfile()` for every entry. Two consequences worth stating:

- Choosing a situation cannot quietly make a run cheaper, slower, or incomparable with another.
- There is no age-varying glide path. A more bond-heavy allocation for the fifty-four-year-old would
  look like care and read as investment advice, which Part D of the plan forbids.

`portfolios` being shared is why the six cards differ *only* in things a reader can check against
their own life.

### The six, and why each figure is what it is

The full reasoning for each is in the module and rendered under “Why these figures” on its own card.
The summary:

| Situation | Shape | Why it is in the set |
| --- | --- | --- |
| **The worked example** | 31, Scotland, £55,000, FIRE 45 | Spec §79 unchanged. It is a card so the choice is *reversible*: there is a way back to the figures the app opened with. |
| **Renting, late 20s, starting out** | 28, rUK, £32,000, FIRE 53, £850 of £1,700 spend is rent | Small assets on purpose — the point is what thirty years of contributions do. Auto-enrolment minimums (5%/3%). Rent recorded in `currentRentMonthlyIncluded` so the property comparison can remove it honestly. |
| **Higher salary, renting, 30s** | 36, rUK, £112,000, FIRE 47, 12% sacrifice | Sits inside the band where the personal allowance is withdrawn at 50p in the pound, so the Marginal Allocation screen says something surprising and true. `sacrificeAddedBackForTaper` true, matching the post-2015 rule the tax engine implements. GIA holds a real gain, so CGT is live in the withdrawal ordering. |
| **Contractor, no employer pension** | 38, rUK, £82,000, FIRE 51, relief at source into a SIPP | Employer rate **0** and no match: structurally different from a smaller employer contribution, and the marginal answer changes because of it. £35,000 cash and a **twelve**-month emergency fund, because a contract ending is an income gap. Salary growth 1% real — a day rate gets no annual review. |
| **Family, 40s, mid-mortgage** | 43, rUK, £74,000 + £3,000 bonus, 2 adults 2 children, FIRE 61 | The only owner-occupier. `purchase` is null because the house is already owned — a purchase inside the projection would charge stamp duty and a deposit already paid. Monthly spending excludes the mortgage, which the ledger charges as its own lines (ADR 002). 6%/5% with a 1:1 match on the first 5%, so the marginal engine's “free money” boundary is a real one. |
| **50s, pension-heavy, FIRE soon** | 54, Scotland, £88,000, FIRE 59, £430,000 pension vs £160,000 outside | The ratio *is* the situation: Attribution and the Reverse Solver behave completely differently when the money is mostly inaccessible. FIRE 59 against access age 57 means no bridge — deliberately, so the reader can shorten it and watch a bridge failure appear. |

Two conventions applied across all six, both documented in the module:

- **State pension is £0 everywhere.** It is a real entitlement, but crediting one the reader has not
  checked would flatter every plan. It is an input for them to add.
- **Contractor income is recorded as PAYE salary.** The limited-company dividend route is not
  modelled, and the card says so rather than implying it is.

### FIRE ages chosen by measurement, not optimism

Each situation's target FIRE age was swept against the deterministic ledger and set so the plan funds
itself with roughly the margin the worked example leaves itself. Measured projected wealth at the
target FIRE age against that situation's own reference FIRE number:

| Situation | Reference FIRE number | Projected at target | Ratio | Deterministic failures |
| --- | --- | --- | --- | --- |
| The worked example | £565,714 | £755,017 | 1.33× | 0 |
| Renting, late 20s | £428,571 | £577,623 | 1.35× | 0 |
| Higher salary, renting, 30s | £822,857 | £1,094,515 | 1.33× | 0 |
| Contractor, no employer pension | £668,571 | £879,973 | 1.32× | 0 |
| Family, 40s, mid-mortgage | £822,857 | £1,057,758 | 1.29× | 0 |
| 50s, pension-heavy | £788,571 | £944,220 | 1.20× | 0 |

The sweep also recorded where each plan *stops* funding itself, which is what the card's reasoning
line quotes: the late-20s renter fails below 47, the family below 57. A starting point that failed at
its own target would teach the reader nothing except that the app is broken; one that could not fail
would be equally misleading. The suite asserts zero failure records for all six, so a future edit to
any figure has to keep that true.

### Choosing one is an edit, and provenance follows it

This is the part the assignment said to check before anything else. UX-2 compares every registry
entry against a starter profile; there is now more than one, so `profile-state.ts` holds the chosen
one in state:

```ts
const [starterId, setStarterId] = useState<string>(DEFAULT_STARTER_ID);
const starter = useMemo(() => starterProfile(starterId), [starterId]);
```

`chooseStarter(id)` sets the form **and** the baseline together, from two independent parses. They are
never allowed to disagree, because a baseline the values did not come from would mark a situation's
own defaults as the reader's edits — on the family situation that would be most of the form. Drafts
are dropped, because they were text typed against a profile that no longer exists. `reset()` now
returns to the chosen situation rather than to the worked example.

`provenance.ts` is untouched. Its wording still says “the starter profile” without naming it, which
is correct everywhere it appears and useless on its own once there are six — so the *name* is written
in exactly one place, `starterProvenanceNote` in `view/starter-picker.ts`, and rendered by the tier
filter, the Overview reset footnote and wizard step 1. The sentence differs for the opening default
("the situation the app opens with") from a chosen one ("the starter situation you chose"), because
"the one you chose" would be untrue before anybody chose.

### One author for the caveat

`src/presentation/view/starter-picker.ts` is the reader-facing half, following `two-numbers.ts` and
`pension-relief.ts`. `STARTER_ILLUSTRATION_CAVEAT` is built into every card by `starterCards()`
rather than passed in by a screen, so a screen cannot render a card without it, and the audit asserts
the string verbatim on all six. `STARTER_CHOICE_EFFECT` says what choosing does *before* the click.

Card facts are read off the parsed profile and formatted through `format.ts` — never restated as
literals — so a card cannot drift away from the situation it describes. Twelve facts: age, target
FIRE age, household, tax region, salary, spending now, retirement spending, liquid wealth, pension
wealth, what you pay in and how, what the employer pays in, and the property.

The cards are deliberately **not** ranked by outcome and carry no probability or projected figure. A
set of illustrations ordered by how well each plan does is a leaderboard, and the picker has run
nothing.

### Where the picker lives, and what it does on each surface

| Surface | Effect of choosing |
| --- | --- |
| Wizard step 1 (“About you”) | Replaces the working profile and the provenance baseline. Nothing else. |
| Scenario screen, “Named scenarios” card | The same, **plus** `library.add` saves it as a named entry with `origin: starter:<id>` and the situation's own `who` as the note. `addScenario` parses again into its own copy, so the saved entry and the form cannot alias each other. |

Neither starts a run. A reader browsing starting points has not asked to spend 10,000 paths, and an
audit test fails a picker surface whose source mentions `runner.run(`, `runMonteCarlo` or `onRun`.

### Audits that keep working

1. Every file under `presentation/web` that builds a starter card (`starterCards` or `starterCard(`)
   must equal `STARTER_PICKER_SURFACES`, and must render `card.caveat`.
2. A screen may quote `STARTER_ILLUSTRATION_CAVEAT` itself (the Overview reset does) but only the
   constant — never a reworded copy that could soften while the original stays in the module.
3. Any other screen that reaches a situation at all — `STARTER_SITUATIONS`, `starterProfile(`,
   `starterSituation(`, `chooseStarter`, or a literal situation id — must go through
   `<StarterPicker>`. Naming a situation inside a screen is how a hard-coded figure gets in.
4. The set must keep covering both tax regions, at least two contribution methods, someone with no
   employer contribution, an owner-occupier and a non-owner, a household with children, and a renter.

## Changed public interfaces

| File | Change |
| --- | --- |
| `src/domain/starter-situations.ts` | New: `StarterSituationId`, `StarterSituation`, `STARTER_SITUATIONS`, `DEFAULT_STARTER_ID`, `starterSituation`, `starterProfile` |
| `src/presentation/view/starter-picker.ts` | New: `STARTER_ILLUSTRATION_CAVEAT`, `STARTER_CHOICE_EFFECT`, `StarterFact`, `StarterCard`, `starterFacts`, `starterCards`, `starterCard`, `starterName`, `starterProvenanceNote`, `STARTER_PICKER_SURFACES` |
| `src/presentation/view/starter-profile.ts` | `createStarterProfile()` now delegates to `starterProfile(DEFAULT_STARTER_ID)`; still byte-identical to `createExampleProfile()`, asserted twice |
| `src/presentation/web/profile-state.ts` | `ProfileStore` gains `starterId`, `starterName`, `starterNote`, `chooseStarter`; `reset()` returns to the chosen situation |
| `src/presentation/web/starter-picker.tsx` | New `StarterPicker` component |
| `src/presentation/view/wizard-model.ts` | The `about` step's prompt mentions starting from a situation. No step, field id or coverage rule changed |
| `src/presentation/web/styles.css` | `.starter-grid`, `.starter-card`, `.starter-who`, `.starter-caveat`, `.starter-facts`, `.starter-reasoning` |

`provenance.ts`, `fields.ts`, `field-display.ts`, `two-numbers.ts`, `scenarios.ts` and every engine
module are untouched. No view model gained a field and no screen's props changed shape.

## Automated evidence

`npm run check` on Homebrew Node 24 is green:

| Step | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **318 pass, 0 fail** (307 before UX-9; 11 new) |
| `npm run build` | production bundle built successfully |

## Chrome evidence

Chrome 153.0.8010.50 headless, isolated profile at `/tmp/capital-ux9-chrome`, Vite on port 5179 and
CDP on 9230. New harness `tests/browser-starter-ui.mjs` wrote `/tmp/ux9-ui-results.json` and the
`/tmp/ux9-*.png` screenshots.

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | browser/local equality; cancellation; 10,000 paths; **68.98%**; 4.23 s |
| Property worker smoke | browser/local equality; cancellation; 10,000 paths; **35.18%**; 4.60 s |
| Cards on wizard step 1 | **6**, in declared order, worked example pre-chosen (`aria-pressed=true`) |
| Caveat per card | 6 of 6 carry the string verbatim; 12 facts each |
| No result on a card | no card text matches `probability` |
| Choosing the family situation | age **31 → 43**, FIRE age **45 → 61** |
| Run started by choosing | progress bars **0**, running buttons **0**, published probability **0** |
| Form after choosing | salary **74,000**, pension **135,000**, edited markers **0** of 105 values |
| The note names it | “…the starter situation you chose, **Family, 40s, mid-mortgage**…”, followed by the illustration caveat |
| One edit (salary → 91000) | exactly one marker, “Reset Gross salary to the default **£74000**”, and **not** £55000 |
| Global reset | salary back to **74,000** (not 55,000), 0 markers |
| New structure | `property.marketValue` **320,000**, mortgage **145,000**, marked **default**, not edited |
| Scenario screen picker | 6 cards; choosing saved **1** named row at £88,000 with `starter:fifties-pension-heavy`; a second choice saved a 2nd row at £82,000 and left the first byte-identical; nothing ran |
| Reversible | the worked example reachable again: salary **55,000**, age **31**, 0 markers |
| Tabs | all **8** reachable throughout |
| Responsive (390 × 844) | **0 px** horizontal overflow, 6 cards, **6** caveats still rendered, card width 311 px inside the 16 px gutter; choosing at mobile width still 0 px overflow and age 28 |
| Uncaught page exceptions | **0** |

All fourteen existing harnesses were re-run green against this branch: `provenance`, `tier-filter`,
`wizard`, `number-field`, `language`, `two-numbers`, `overview-headline`, `solver-question`,
`attribution`, `marginal`, `property`, `section61`, `scenario` and `solver`. **None needed retuning**
— the wording added to the provenance summary paragraph is appended after the sentence
`provenanceSummary` owns, which is what the existing regexes already allowed for.

One harness note for the next package: a table header uppercased by CSS comes back uppercased from
`element.innerText`, because `innerText` reports what is rendered. Read the library table's name cell
case-insensitively, or use `textContent`.

## Limitations and decisions

1. **Six situations, not a questionnaire.** The picker is a set of cards to recognise yourself in,
   not a flow that derives a profile from answers. A derived profile would be a recommendation with
   extra steps, and the ticket asked for labelled starting points.
2. **Every situation funds itself deterministically, which makes the set optimistic as a sample of
   the population.** That is the AC, and it is the right trade for a *starting point* — but it means
   the cards are not a claim about how achievable FIRE is. Nothing on a card says otherwise, and no
   card shows a probability.
3. **No Monte Carlo figure is asserted per situation.** Six 10,000-path runs in the suite would cost
   minutes for a presentation package. The deterministic ledger is asserted instead, which is what
   AC 1 asks for; a reader gets the probability by pressing the run button like anyone else.
4. **`provenance.ts` still says “the starter profile” generically.** Threading the chosen name into
   every per-field note would have reworded ninety tooltips and four existing harness assertions for
   a sentence that is already on screen twice. If a later package wants the name in the per-field
   note, `starterName` is the one place to read it from.
5. **The Scenario screen's picker always saves.** Choosing there both loads and saves, which is what
   makes the situations *named library entries* as the ticket asks. Choosing the same one twice
   therefore creates “Name 2” — `addScenario` suffixes rather than replacing, which is the existing
   library rule and is better than silently overwriting a row the reader may have edited.
6. **The state pension is £0 in all six.** Realistic for nobody, honest for everybody: it is the one
   large figure a reader must look up rather than accept. Each card's reasoning says so.
7. **The contractor is modelled as PAYE salary.** The engine does not model dividends from a personal
   company, so the situation records what it can and the card names the gap.
8. **Property is one situation's business.** Only the family owns; the other five leave `property`
   null, so the Property & Leverage screen still offers its own default purchase to edit. A second
   owner-occupier would have added a card without adding a structural case.

## Paste-ready assignment — UX-10 (M): in-app "Learn" panel and a written learning doc

Deliver `docs/ux-improvement-plan.md` § UX-10 exactly as written, on a branch in a fresh worktree,
per `AGENTS.md`. What UX-10 inherits:

- **AC 4 is absolute: no engine or profile change of any kind.** That now includes
  `src/domain/starter-situations.ts` — a learn panel must not adjust a situation's figures to make an
  example read better.
- `glossary.ts` (UX-3) already owns term definitions and `GlossaryBar` already renders per-tab terms
  keyed on `TabId`. A learn section map keyed the same way is the shape to copy, and `tabs.ts` is
  where the eight ids come from, so the coverage test derives its list rather than restating it.
- `two-numbers.ts`, `pension-relief.ts` and now `starter-picker.ts` are the pattern for shared
  reader-facing copy: view data in `src/presentation/view/`, one component rendering it, and an audit
  test deriving its surface list from the sources. A learn panel is the fourth instance — and the
  first with enough prose that a *contradiction* between it and the markdown doc is a real risk. The
  arbitration clause (`AUTHORITY_CLAUSE`), the caveat (`STARTER_ILLUSTRATION_CAVEAT`) and the three
  pension-relief labels are already single-authored strings; quote them rather than paraphrasing, or
  the doc and the app will disagree about which number decides.
- The conventions the doc must not contradict are in `AGENTS.md` and `docs/architecture-decisions.md`,
  not in anybody's memory: money nominal in the ledger and real in results, year `t` covering
  `[age, age+1)`, ADR 002's fixed event order, no dynamic in-run spending cuts, a sampled probability
  carrying a standard error. Cite the source file where the doc states a number or a rule.
- Run the browser harnesses you might have affected, not just your own. Three packages in a row have
  found, or nearly found, a harness sitting red from an earlier one — and note the `innerText`
  casing trap above if you read a table.
