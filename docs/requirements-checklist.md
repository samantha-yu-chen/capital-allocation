# V0.3 requirements tracking

This checklist tracks section 88 of the comprehensive spec. “Foundation” means contracts/primitives exist; it does not claim the full lifetime behaviour is implemented. Additional requirements inside the full spec remain authoritative.

**Package 10 completed the acceptance audit.** Every line below was re-derived from the source and a
named test rather than carried forward from the previous status line. The audit found two in-scope
spec details with no implementation behind them — section 61's required-salary column and section
16's presentation labels — and both are now built and tested; it also corrected one overstated claim
(row 2). `docs/v0.3-requirements-checklist.md` is the long form of the same audit, including the
eight tabs and the eleven cross-cutting ambiguities it closed. `handoffs/chunk-10.md` carries the
measured release evidence: 251 passing tests, benchmark numbers, hardware and the remaining limits.

**UX-1 added a display-only tier filter to the Overview profile form.** Every "editable on Overview"
claim below still holds: the default view shows the essential and common inputs, `Everything`
restores all of them, hidden fields keep their stored values, and a field carrying a validation
issue is shown whatever the filter says. The filter never touches the profile, the validation state
or the run key — `tests/presentation-inputs.test.ts` and `tests/browser-tier-filter-ui.mjs` assert
it. `handoffs/ux-1.md` records the classification and the measured evidence.

**UX-2 added value provenance and reset to the same form.** Every control described in the field
registry now says whether it holds the starter profile's value or the reader's, and offers a way
back — per field, per group, or the whole profile. This changes no engine input: the starter profile
is `createExampleProfile()` under a name that says what it is for, asserted byte-identical in
`tests/presentation-provenance.test.ts`, and a reset is an ordinary edit that `profileSchema` judges
like anything typed. Provenance compares stored values, never the text on screen, and a field the
starter has no value for offers no reset rather than inventing one.
`tests/browser-provenance-ui.mjs` carries the Chrome evidence, including that a reset never tidies
away another field's validation error. `handoffs/ux-2.md` records the details.

**UX-3 added the plain-language layer over the same registry.** Labels, help text and validation
messages now speak to a reader who is not a finance professional, without losing the precise
wording: `plainLabel` replaces the short internal name on screen and keeps the technical term once
in parentheses, `plainHelp` is rendered *before* the existing `help`, and every essential and common
entry has one — `tests/presentation-language.test.ts` fails if an entry is added without it. A
twenty-five term glossary (`src/presentation/view/glossary.ts`) is reachable from the words that use
it and from every screen; the same suite refuses a dangling reference and a definition nothing points
at. `profileSchema` is unchanged, and the suite pins its issue paths, codes and messages for five
invalid fixtures so a future "fix" to its wording fails rather than passing quietly; the rewritten
sentences are a presentation map laid over that output, and a rule with no rewrite keeps the
schema's own words. `tests/browser-language-ui.mjs` carries the Chrome evidence, including the
popover at 390px. It also records one correction outside the ticket: a household spending override
set on the FIRE screen used to rewrite the Overview cash-flow card silently, and now says so.
`handoffs/ux-3.md` records the details.

**UX-4 added the guided path to a first personal result.** `Start here` is a persistent entry point
beside the unchanged eight-tab analysis navigation. Its five steps render the existing registry
controls against the shared profile store, so plain help, provenance, schema validation and run-key
invalidation are the same mechanisms used everywhere else. Step 5 reads the deterministic Overview
model for its clearly qualified reference figures and launches the App's one Monte Carlo runner only
after an explicit click. `tests/presentation-wizard.test.ts` checks tier coverage, schema validity,
plain issue ownership and exact run-key reuse; `tests/browser-wizard-ui.mjs` carries the Chrome
evidence for invalid-step blocking, 10,000-path progress/cancellation, identical 68.98% results on
the wizard and FIRE tab, stale invalidation, persistent dismissal, both worker smoke variants and a
390px layout with all eight tabs still reachable. `handoffs/ux-4.md` records the details.

**UX-5 put the stochastic answer at the top of Overview without inventing one.** The headline is a
pure view model over completed runs: it ignores a result whose captured run key differs from the
current profile/options key, uses the existing section 16 `confidenceBand`, and rounds the sampled
probability only as finely as its binomial standard error supports. Its probability source links to
FIRE & Monte Carlo; its optional earliest-age source links to FIRE Age Curve; both name their path
count, seed and version metadata. The curve runner is now App-owned so a completed result remains
available across tabs, while cancellation, failure and edits still publish no figure.
`tests/presentation-screens.test.ts` covers empty/completed/stale states, all band boundaries and
precision; `tests/browser-overview-headline-ui.mjs` covers both 10,000-path worker smokes, the full
21 × 10,000-path curve, source navigation, cancellation, salary-edit invalidation and desktop/mobile
layout. `handoffs/ux-5.md` records the measured evidence.

**UX-6 asked the Reverse Solver's question out loud without touching the search behind it.** The six
engine modes are now the answers to “To hit my goal, what would my … need to be?” in a keyboard
radio group, and every outcome becomes one plain sentence through `solverAnswer`: an achieved answer
carries its confirmed bracket, a search that used its whole evaluation budget carries the range the
requirement still lies in, an unreachable one names the bound it failed at, an already-met one says
it did not look lower, and an unsupported one keeps the engine's own reason. Budget exhaustion is
derived from the result (evaluations used against `metadata.maxEvaluations`, and a bracket still
wider than the search precision), not from matching the engine's prose. `src/engine/` is untouched:
`git diff --stat` over the branch shows no engine file. `tests/solver-presentation.test.ts` maps all
five statuses from real solves on one profile and checks the unconfirmed and unbracketed wordings;
`tests/presentation-screens.test.ts` checks that the Overview “what would it take?” offer needs a
current completed run measuring a shortfall and never enters the sentence. Chrome evidence:
`tests/browser-solver-question-ui.mjs` (both worker smokes at 10,000 paths and 68.98%/35.18%, the
offer absent before a run and when the target is met, the route pre-selecting salary with nothing
running, the £87,600 answer sentence in 99.40 s, and a 390px layout with zero overflow and all eight
tabs) and the chunk-6 regression `tests/browser-solver-ui.mjs` (£87,600 confirmed with the four
section 33 searches in 374.19 s). `handoffs/ux-6.md` records the measured evidence.

**UX-7 gave the two success numbers one story, in the reader's own figures.** The reference FIRE
number and the Monte Carlo probability are now arbitrated wherever they are visible, by one
explanation that lives in `view/two-numbers.ts` and is rendered by one component: the FIRE number is
named a landmark computed as yearly retirement spending ÷ the configured withdrawal rate, silent
about withdrawal tax and sequence of returns, and the success probability is named the number the
target is judged against. Both halves quote the profile's own `referenceWithdrawalRate` and
`simulation.count`, so the copy is never a hard-coded “4%” or “10,000”. `confidenceBand` remains the
only authority for a probability's label and `fire-metrics.ts` is unchanged, so no figure moved.
`tests/presentation-two-numbers.test.ts` pins the dynamic rate and path count, the arbitration
clause in both the full and one-line variants, the `RangeError` guards, and — derived from the
sources rather than a hand-kept list — that every screen rendering the reference FIRE number renders
the shared explanation. Chrome evidence: `tests/browser-two-numbers-ui.mjs` (both worker smokes at
10,000 paths and 68.98%/35.18%, the story on Overview, FIRE, the wizard and, as the short caveat, the
curve and the full-count scenario spending table, the rate retuned live to 4.25%, no figure beside an
invalidated or cancelled run, and a 390px layout with zero overflow and all eight tabs).
`handoffs/ux-7.md` records the measured evidence.

**UX-8 made the numeric inputs read like the things they hold, without loosening what they accept.**
The unit moved out of the label and into the input's own frame — £ leading a money field, `/mo`
trailing a monthly one, `%` trailing a percent one — and survives in the accessible name as a word
(“Gross salary, in pounds”), so a screen-reader user still hears the unit the adornment shows.
Money figures rest with thousands separators and return to raw digits on focus, which is display
only: `fieldText` picks between the draft and the grouped form at render time, so no blur path calls
`onChange`, and Chrome measures every value on the form as identical across a focus/blur cycle with
no edited marker appearing. `parseDisplayText` in `view/field-display.ts` is now the single rule for
what counts as a number in a box and `fromDisplay` only rescales it, so the box, the arrow keys and
`profileSchema` cannot disagree: the field's own unit typed back into it (`£55,000` off a payslip)
and correct thousands grouping are accepted, while `1,2,3`, `£12` in a percent box and an empty box
all still reach the schema as NaN and are rejected there — work package 4's NaN-on-invalid contract
is unchanged. Because no `type="number"` input will hold a separator, the box is `type="text"` with
a decimal keypad and `stepDraft` restores arrow-key stepping in the registry's own step; the
correlation matrix and the FIRE spending override stay native numeric inputs for stated reasons, and
an audit test fails the next input added outside that named set. Monthly fields carry the annual
equivalent (`= £15,600/yr`) derived through the registry's own conversion. `view/pension-relief.ts`
names A.2 note 1's two figures apart — “Tax relief” excludes employee NI, “Tax and National
Insurance you no longer pay” includes it, “What it actually costs you” is `personalNetCost` — with
an audit that fails any surface reading the raw fields without those names. No engine file, seed,
path count or stored value changed. `tests/presentation-field-display.test.ts` pins the units, the
grouping (including that a malformed grouping is never rewritten into a plausible number), the
round-trip corpus, the annual equivalents, the stepping guards and both audits. Chrome evidence:
`tests/browser-number-field-ui.mjs` (both worker smokes at 10,000 paths and 68.98%/35.18%,
keyboard-only entry and arrow-key stepping through CDP key events, the typo refused in words, the
annual line following the value, a completed 10,000-path FIRE run still at 68.98%, and a 390px
layout with zero overflow and all eight tabs), plus all thirteen existing browser harnesses re-run green.
`handoffs/ux-8.md` records the measured evidence.

**UX-9 gave a blank-slate reader somewhere plausible to start, and made “default” mean the place
they started from.** `src/domain/starter-situations.ts` holds six labelled whole situations — the
specification's worked example, a late-20s renter, a higher earner inside the personal-allowance
withdrawal band, a contractor with no employer contribution, a family part-way through a mortgage,
and someone in their fifties whose wealth is mostly locked in a pension — each built through
`parseProfile`, so `profileSchema` stays the only validation authority and a situation cannot hold a
profile an engine would reject. Choosing one replaces both the values on the form and the UX-2
provenance baseline, because a baseline the values did not come from would mark real defaults as
edits; the reset then leads back to the chosen situation, and the worked example is one of the six so
the choice is reversible. What a situation may change is deliberately narrow: `market`, `simulation`
and `portfolios` are copied verbatim from the worked example in every entry, so no seed, path count,
withdrawal order, return assumption or asset weight moved, and a test asserts each of them. Target
FIRE ages were chosen by measurement — each situation funds itself on the reference path with about
the margin the worked example leaves itself (projected wealth 1.20–1.35× its own reference FIRE
number) — and the suite fails if one stops doing so. Every card carries one caveat string built in by
`view/starter-picker.ts` rather than passed in by a screen, states nothing that could be read as a
result, and lists facts read off its own parsed profile instead of restated literals.
`tests/presentation-starter-situations.test.ts` (11 tests) pins the parse, the zero-failure
deterministic run at each situation's own target, the model-invariance guard, the independence of two
`starterProfile` calls and of a library built entirely from starters, that provenance quotes the
*chosen* starter's value and not the profile it replaced, and — derived from the sources — that every
screen building a card renders the caveat and that no picker surface starts a run. Chrome evidence:
`tests/browser-starter-ui.mjs` (both worker smokes at 10,000 paths and 68.98%/35.18%; six cards each
with the caveat verbatim and twelve facts; choosing rewrote age 31→43 and FIRE age 45→61 with zero
edited markers and zero progress bars; one edit offered “Reset Gross salary to the default £74000”
and never £55000; the global reset landed on 74,000; the family's £320,000 property arrived as a
default rather than an edit; two Scenario-screen choices saved two named library entries without
rewriting the first; the worked example was reachable again at 55,000; 390px with zero overflow, all
six caveats still rendered and all eight tabs), plus all fourteen existing browser harnesses re-run
green and unretuned, including the 60-cell scenario matrix and §61's £87,600 confirmed in 419.08 s.
`handoffs/ux-9.md` records the measured evidence.

**UX-10 gave the model an explanation of itself, and made the written and in-app versions unable to
contradict each other.** `docs/learnings/how-the-model-works.md` (1,931 words, under the ticket's
2,500 cap, asserted) walks a general adult through one projected year, tax and pensions, what the
simulation adds, how to read the two verdict numbers, and what the model deliberately refuses to do;
every claim that is a rule names the file it comes from. `src/presentation/view/learn.ts` is the same
explanation as view data — five method sections plus one per screen, keyed on `TabId` so the
coverage test derives its list from `TABS` rather than restating it — and
`src/presentation/web/learn-panel.tsx` is the only component that renders a section, reached from a
sidebar entry beneath the eight destinations. The mechanism holding the two halves together is
`LEARN_SHARED_CLAIMS`: the eight conventions a reader can be actively misled by (ADR 002's fixed
event order and half-open year, a recorded failure a later good market cannot erase, nominal in the
ledger and real on screen, no dynamic in-run spending cut, the arbitration clause, sampling error,
"explains and simulates") are one string each, and the test reads the markdown file to prove both
surfaces still carry them verbatim — a claim reworded in either place fails the suite, verified by
breaking one. Wording other modules own (`AUTHORITY_CLAUSE`, `STARTER_ILLUSTRATION_CAVEAT`, the
three pension-relief labels) is interpolated, never paraphrased. The panel reports nothing: no `£`
and no percentage reaches the prose, no phrase that reads as advice, and an audit derived from the
sources fails any second component that starts rendering learn sections or any learn surface that
could start a run. No engine, schema or profile file changed — a test walks `src/engine` and
`src/domain` and fails if either reaches the learn copy. `tests/presentation-learn.test.ts`
(11 tests) pins the eight-tab coverage, the 2–4 paragraph shape, the shared claims on both surfaces,
the quoted constants, that every cited path exists and every glossary term resolves, and both audits.
Chrome evidence: `tests/browser-learn-ui.mjs` (both worker smokes at 10,000 paths and
68.98%/35.18%; the panel reachable from the sidebar with all eight tabs still beside it; the section
that opens is the screen the reader came from, measured from Overview, Property and Where It Comes
From; 1,827 words rendered with zero money figures, zero percentages and zero advice phrases in the
prose; zero progress bars and zero published probabilities from opening it; a completed 10,000-path
run still reading 68.98% after a visit to the panel and back; a stale result still discarded and a
cancelled run still publishing nothing; 390px with zero overflow, all eight tabs, all eight sections
and zero overflow again after expanding one). All fifteen existing browser harnesses are green,
twelve in one sweep and the three longest — `scenario` (the 60-cell matrix), `section61` and
`solver` (§61's £87,600 confirmed in 387.22 s) — after being re-run on a freshly started Chrome:
their first-sweep failures were a closed CDP connection and two run timeouts in a browser that had
already served twelve harnesses, not assertion failures. None needed retuning.
`handoffs/ux-10.md` records the measured evidence and the browser-hygiene rule it implies.

**UX-11 closed the dead end after a starting situation was chosen, and explained the flat spending
column that made a correct ledger look broken.** Two reader-reported problems, both presentation.

*Finding 2, the substantial one.* A starter card advertised twelve figures and none of them said
where any of them could be changed; worse, `household.adults` and `household.children` sat at the
`expert` tier, so going from the contractor situation (one adult) to a two-adult family meant
leaving the picker, finding a filterable form, changing a display setting nobody had mentioned and
scrolling. `src/presentation/view/field-navigation.ts` is the React-free answer: it resolves a
registry id to its reader-facing name, its group, the destination whose form renders that group and
its tier; `raiseModeFor` computes the smallest widening of the reader's chosen depth that would put
the target on screen and returns null when none is needed; `tierRaiseNote` authors the sentence the
reader is shown when it moves. An id this profile has no input for resolves to `null`, so a fact
about a property nobody owns stays plain text rather than becoming a link to nothing. `StarterFact`
now carries the ids it is read from, with honest arity — "Household" is two inputs, "Cash, ISA and
GIA" is three, "Property" is whichever inputs that profile's shape has — and only the card in use
turns them into links, because a fact on a card you have not chosen describes a profile the form
does not hold. Four labelled jumps ("Change your household / your salary / your spending / the age
you want to stop") sit beneath the grid, authored in `view/starter-picker.ts`. `ProfileForm` serves
a focus request by widening its own filter, opening the group, scrolling to the box and focusing it,
and prints what it did; the depth itself moved to the shell so it survives leaving the screen.
`household.adults` and `household.children` were re-tiered `expert` → `common`, which changes
visibility and nothing else: no default, no validation and no figure on any screen moved.
`tests/presentation-field-navigation.test.ts` (8 tests) pins the registry→target map, that every
group names a destination, the re-tiering and that the default depth shows it, that widening is
minimal and one-directional, that the note names the field and says the plan did not change, that
every fact id and every jump id resolves for all six situations, that no jump target is an expert
input, and — derived from the sources — that only `profile-form.tsx` may move the filter and only
while rendering `tierRaiseNote`. `tests/presentation-starter-situations.test.ts` gained the audit
that links are gated on the chosen card and resolved against the reader's profile, and that no
picker surface can start a run to serve one.

*Finding 1, the comprehension fix.* The reported "spending is the same across all years" was the
correct appearance of constant real spending on the ledger's default money basis, not a missing
compound: `inflationIndices` accumulates a running product and `spendingForYear` multiplies real
spending by it. No engine changed and the default did not move — "every result is in today's money"
is the app's contract in the `todays-money` glossary entry, the learn panel and every other screen.
`moneyBasisExplanation` in `overview-model.ts` authors, beside the basis it describes, why the
column behaves as it does and where the growing figure is; `inflationComparison` quotes one chosen
year in both bases from the row the ledger produced, opening on the first year the plan stops
earning (`defaultComparisonAge`, derived from the recorded phase). Both render next to the
money-basis control. `tests/presentation-screens.test.ts` gained four tests, including the one that
pins what the explanation claims — twenty years on the index has compounded past 1.4, nominal
spending has grown with it and real spending is flat to a rounding error — plus an audit failing any
surface that offers the basis choice without the explanation, or that types the wording into the TSX
instead of reading it from the view model. 343 tests pass (329 before UX-11; 14 new).

Chrome evidence: `tests/browser-field-navigation-ui.mjs` (both worker smokes at 10,000 paths and
68.98%/35.18%; all twelve facts on the card in use are buttons and all twelve on a card that is not
are plain text; ten fact links and all four jumps landed on their own input, focused, with the group
open and the box inside the viewport, including the `personal.taxRegion` select that had no
addressable id before UX-11; the property fact crossed to Property & Leverage; household visible at
the default depth, and from a deliberately narrowed "Essential only" the jump moved the radio to
"Essential + common" and printed "Detail raised to … Nothing about your plan changed"; zero progress
bars and zero published probabilities from any jump; a completed 10,000-path result unchanged at
72.31% across a jump and discarded by a real edit; the real-terms spending column £19,800 → £19,800
from age 31 to 51 while the cash-terms column ran £19,800 → £32,445, with the explanation reading
"prices do rise here, every year" and the pair quoting age 45 at 41.3%; all eight tabs; zero
overflow at 390px before and after a jump). The app's own 10,000-path FIRE run still reads **68.98%**
with progress shown, still empties on an edit, and still publishes nothing when cancelled. All
fifteen existing browser harnesses are green, the three longest each on a freshly started Chrome
(`scenario` 334 s, `section61` 31 s, `solver` 475 s with §61's £87,600 confirmed in 383.09 s). Two
needed retuning, both deliberately: `browser-tier-filter-ui.mjs` pinned Household as hidden at the
default depth, which is exactly what UX-11 changed, so the assertion is inverted rather than deleted;
and `browser-starter-ui.mjs` read the choose button as "the first button in the card", which fact
links now precede. `handoffs/ux-11.md` records the measured evidence.

Earlier interfaces and their boundaries stay authoritative: `handoffs/chunk-9.md` for
attribution/sensitivity/stress, `handoffs/chunk-8.md` for scenarios, `handoffs/chunk-7.md` for
marginal allocation, `handoffs/chunk-6.md` for the solvers and `property-model.md` for property.

| # | MUST requirement | Owning chunks | Status / evidence after the package 10 audit |
| --- | --- | --- | --- |
| 1 | UK tax model | 1, 2 | Annual primitives, plus one joint annual assessment per projected year in the ledger; `tests/tax.test.ts`, `tax-allocation.test.ts`, and `ledger-reconciliation.test.ts` reproduces the documented £9,927.05 / £3,055.60 reference case |
| 2 | Scotland support | 1, 2, 10 | **Done.** Scottish and rest-of-UK band tables are separate versioned configurations, each exercised at twelve income points in `tests/tax.test.ts`, which also pins that Scottish savings and dividend income still use UK bands. The ledger resolves the profile's region once per run and rescales that configuration in real terms every projected year — the audit corrected the previous "selects the region's config every year" wording, which overstated what the code does. `tests/ledger-accounts.test.ts` "the tax region chosen on the profile reaches every projected year of the ledger" contrasts the same profile in both regions against each region's own `calculateNetIncome` at an early and a late year, so a hard-coded region now fails a test; before package 10 the claim rested only on the tax unit tests |
| 3 | Salary and spending | 1, 2, 4 | **Done.** Real salary growth, bonus, other and retirement employment income, household spending and investable surplus per year; `ledger-reconciliation.test.ts`, `ledger-accounts.test.ts`. All editable on Overview, with the year's cash flow, savings rate and marginal rate read from the ledger; `presentation-screens.test.ts` |
| 4 | Essential/discretionary expenses | 1, 2, 4 | **Done.** Split tracked per year; essential drives the emergency reserve, liquidity coverage and failure classification. Floor/target/comfort are separate runs, with no dynamic in-run cuts; `ledger-golden.test.ts`. Both parts are editable, the level is selectable on the FIRE screen, and the ledger browser shows each year's split |
| 5 | £1,300/£1,650/£2,000 cases | 1, 2, 4, 8, 10 | **Done.** `monthlyHouseholdOverride` runs common-path cases; `monte-carlo.test.ts` asserts surplus, capital-target, wealth and probability effects. The three configurable cases are a side-by-side table on Scenario Comparison showing both halves of the effect — the surplus each case leaves and the retirement budget and reference capital it creates — and they form the spending axis of the 60-cell matrix; `scenario.test.ts`, `scenario-presentation.test.ts`, `browser-scenario-ui.mjs`. Package 10 added the fourth section 61 column: each case also re-solves its own required gross salary; `browser-section61-ui.mjs` |
| 6 | Pension | 1, 2 | **Done in engine.** Contributions added once per year, access-age gating, UFPLS split, lifetime lump-sum tracking, taxed withdrawals grossed up, pension and SIPP as separate balances; `ledger-accounts.test.ts` |
| 7 | ISA | 1, 2 | **Done in engine.** Annual capacity capped, reset at the tax-year boundary, prior-year use respected, holdings and withdrawals wholly untaxed; `ledger-accounts.test.ts` |
| 8 | GIA | 1, 2 | **Done in engine.** Cost basis, carried losses, turnover-driven realisation, dividends taxed and added to base cost, one annual CGT exemption, unrealised gains deferred; `ledger-accounts.test.ts` |
| 9 | Cash | 1, 2 | **Done in engine.** Distinct settlement account with taxable interest, emergency-reserve gating and liquidity coverage; `ledger-accounts.test.ts` |
| 10 | Accessible vs locked capital | 1, 2, 3, 4 | **Done.** Freedom Capital and Retirement Capital reported separately every year and never collapsed; property equity excluded until an explicit release action is modelled; `ledger-reconciliation.test.ts`, `engine-units.test.ts`. Overview shows the three separately and the FIRE screen plots each category on its own; `presentation-screens.test.ts` asserts they are never combined into one headline |
| 11 | Deterministic yearly projection | 2, 4 | **Done.** Reconciled year-by-year ledger carrying every section 6 line item; per-account and aggregate identities asserted across all 64 years; `npm run ledger` prints it. Overview browses every year in today's money or nominal, each row expandable to its full line items, and labels the deterministic run as not a FIRE-safety measure |
| 12 | Monte Carlo returns | 3 | **Done.** Pluggable calibrated lognormal returns, validated Gaussian log-growth correlation, per-wrapper ledger allocation; `monte-carlo-generator.test.ts`. |
| 13 | FIRE probability | 3, 4, 10 | **Done.** Full-lifecycle path success, bridge/depletion and overlapping observed failure probabilities; golden C/D/E in `monte-carlo.test.ts`. Shown live against the target on the FIRE screen, with the overlap caveat next to the bars; a 10,000-path run in Chrome reproduced 68.98% success, 0.32% bridge and 31.02% depletion. Package 10 added section 16's five presentation labels — Fragile, Moderate, Strong, High confidence, Very conservative — as a reading aid beside the figure, with contiguous half-open bands and an explicit note that the user's own target, not the band, is what every solver, curve and constraint is measured against; `presentation-screens.test.ts` |
| 14 | Sequence risk | 3, 4 | **Done.** First-five-year real drawdown, two-years-spending liquidity, conditional recovery median and censored counts; controlled sequence tests in `monte-carlo.test.ts`. Presented on the FIRE screen with recovered/unrecovered counts and the conditional-median caveat; `presentation-screens.test.ts` |
| 15 | Pre-pension bridge | 2, 3, 4 | **Done.** Chunk-2 bridge accounting reused; locked-pension probability is 100% failure in golden E. Distinct-path counts tested in `monte-carlo.test.ts`. Bridge length, required bridge capital, its coverage ratio and the bridge-failure probability are all on screen |
| 16 | FIRE-age probability curve | 6 | **Done.** `fireAgeCurve` runs the complete model at every candidate FIRE age on one seed and path index set, reports the earliest age clearing the target, and flags a curve that does not rise with every extra working year. Tested against a direct `runMonteCarlo` at the profile's own FIRE age, for exact replay, for property sensitivity and for cancellation in `solver.test.ts`; drawn on the built FIRE Age Curve screen with the same numbers tabulated beside the chart and a 95% sampling interval per age |
| 17 | Reverse savings solver | 6 | **Done.** The `savings` mode searches the annual investable surplus, funded by cutting the working-life budget rather than by creating capital, and the solved plan's measured first-year surplus is asserted to equal the answer. `retirement_spending`, `fire_age`, `starting_capital` and `pension_contribution` searches share the same bounded framework; `solver.test.ts` covers already-met targets, bounded infeasibility, spending-search direction, the pension-access boundary and the non-monotone contribution scan |
| 18 | Reverse gross-salary solver | 6 | **Done.** The `salary` mode searches gross pay through the real marginal tax, NI and pension rules, brackets the answer to £100, re-runs the returned candidate through the complete model to confirm it, and narrows the bound explicitly when the tapered annual allowance stops supporting larger salaries. Section 33's sensitivity cases are each re-solved in full rather than scaled. Shown on the built Reverse Solver screen with the whole evaluation trace |
| 19 | Marginal pension/ISA/GIA | 7 | **Done.** `compareMarginal` compares all six destinations with one-off gross versus existing-cash funding, exact configured tax/NI/relief/matching, explicit infeasibility and complete common-path lifetime reruns. Target-age after-tax usable wealth is ranked only under probability/reserve/liquidity/debt constraints; paired standard errors qualify the ranking. `marginal.test.ts` covers independent tax slices, allowance/eligibility, bridge lock-up, reconciliation, replay, cancellation, deposit/overpayment and rental relief. `marginal-presentation.test.ts` and `browser-marginal-ui.mjs` cover the real screen, full 10,000-path work, cancellation, invalidation and desktop/mobile output. |
| 20 | Single-property model | 5 | **Done.** Atomic, tax-grossed-up purchase funding; acquisition/sale taxes and costs; owner/rental operating cash flows; explicit sale proceeds; amortisation, interest-only balloons and arrears in every deterministic/stochastic path. `property.test.ts`, `ledger-reconciliation.test.ts`, `monte-carlo.test.ts`; property changes FIRE success. Tax boundaries in `property-model.md` |
| 21 | Property leverage | 5 | **Done.** Equity, LTV, debt-service coverage, downside leverage, equity drawdown and full-plan 3/5/7/9% mortgage scenarios on the built Property screen. Golden scenario B and repayment/refinance/balloon tests in `property.test.ts`; view-model checks in `property-presentation.test.ts` |
| 22 | Rent vs buy | 5 | **Done.** Full-plan paired paths with the deposit and acquisition-cost opportunity cost, unused ISA allowance/GIA investment, success and terminal/liquidity/drawdown/debt distributions. Included rent replaced once while owner occupied. Reproducible and cancellable worker comparison; `property-presentation.test.ts`, `browser-property-ui.mjs` |
| 23 | Named scenarios | 8 | **Done.** Named creation, renaming, duplication, replacement and deletion on the shared validated profile plus its plan options, with the eight section 64 presets as explicit transforms. The local library is a versioned document re-validated on every load: `scenario.test.ts` covers the round trip, schema-1 migration, and rejection of an invalid profile, an unknown version, a wrong kind and duplicate ids. Independence is asserted, not assumed. Verified in Chrome across a real page reload, including a refused corrupt document and a migrated schema-1 document; `browser-scenario-ui.mjs` |
| 24 | Deterministic stress cases | 9 | **Done.** Seven synthetic paths — two crash styles, high inflation, a lost decade, a mortgage-rate shock, a property crash and a one-year job loss — run through the same ledger by replacing only the specified annual observations of `deterministicPath`. Two optional `MarketYear` fields (`employmentMultiplier`, `mortgageAnnualRate`) carry the shock; `attribution.test.ts` asserts every shock lands only in its declared annual interval, that contractual inputs resume afterwards, that job loss moves income, contributions and pensionable pay once while leaving fixed spending alone, that a stressed bridge and a stressed mortgage record real funding failures, and that account and aggregate reconciliation still hold under property and mortgage shocks. The start age is editable and each card states its own assumptions; no historical backtest is implied |
| 25 | Percentiles | 3, 4 | **Done.** Mean, P10/P25/P50/P75/P90, observed minimum, FIRE capital and real age-boundary asset distributions; known-quantile and zero-volatility aggregation tests. Terminal wealth and opening FIRE capital are tabulated in full, and every age boundary is drawn as a percentile fan with the same numbers in an adjacent table |
| 26 | Seeded reproducibility | 3, 4 | **Done.** Seed/index streams, scenario-independent shocks, full extended metadata, replay and identical local/worker/out-of-order batch results; generator and simulation tests. The full metadata record is shown after every run, and browser/local result equality was confirmed in Chrome for the first time in chunk 4 |
| 27 | Sensitivity | 9 | **Done.** Nineteen rows across nine assumption families — equity nominal mean ±2pp, equity volatility ±5pp, inflation ±1pp, real salary growth ±1pp, FIRE age ±2 years, mortgage rates ±2pp including scheduled refinances, property nominal growth ±2pp, all three configured spending cases, and a hypothetical +5pp/+10pp charge on taxable pension withdrawals. Each row is a complete lifetime simulation at the entered path count. `assertSensitivityPaths` permits changed market moments only and still applies the inherited `assertCommonPaths`/`assertScenarioPaths` checks to everything else; `attribution.test.ts` asserts every axis varies in its declared direction without touching seed or count, that moment changes preserve the same underlying Gaussian shocks, and that a funded fixture's wealth, debt service and income actually move. Property-dependent rows are reported unsupported, not as failures |
| 28 | Income-vs-allocation attribution | 9 | **Done.** Nine one-at-a-time interventions rerun the complete plan: salary +£10,000, fixed spending −£3,000/year, a band-vacating pension contribution, ISA-then-GIA and GIA-only surplus routing, FIRE two years later, 10pp of bonds/cash shifted to equities in every wrapper, and either a £10,000 larger deposit or a five-year shorter mortgage term. `attributionConclusion` names the largest tested income/expenses/allocation improvement only when it clears 1.96× the summed marginal standard errors and no rival is inside that bound; `attribution-presentation.test.ts` asserts that every figure traces to retained engine output and that equal or sampling-noisy effects never become findings. Effects are explicitly not additive and not causal shares |
| 29 | Spending sensitivity | 2, 6, 8, 9, 10 | **Done.** Shared-path configurable monthly spending and fixed floor/target/comfort runs, tested alongside deterministic double effects. Chunk 6 adds the bounded `retirement_spending` search and a re-solved −£150/month case on the Reverse Solver. Chunk 8 adds the section 61 side-by-side table on common paths, with both effects and an optional earliest-qualifying-FIRE-age search per case. Chunk 9 adds the three configured cases as sensitivity rows on Where It Comes From, and a fixed −£3,000/year discretionary cut that `reduceSpending` refuses to make if it would breach the retirement floor or exceed discretionary spending in any phase. **Chunk 10 completes section 61's table**: the required-salary column was missing and nothing else in the product solved it per spending case, so each case now re-solves its own gross salary through the same bounded solver the Reverse Solver uses — bracketed to £100, confirmed by an independent re-run, shown with the simulations it spent, and reporting the bound it tested when nothing inside it clears the target. Off by default because it costs up to 25 further complete simulations per case, announced as a ceiling before the run; `scenario.test.ts`, `scenario-presentation.test.ts`, `browser-section61-ui.mjs` |

## UI delivery

All eight destinations are reachable in the shell from chunk 4. "Reachable, labelled" means the tab
exists and states which package owns it; it renders no illustrative figures.

| Reference tab | Owning chunk | Status |
| --- | --- | --- |
| Overview | 4 | **Built.** Full profile editing with runtime validation, separable liquid/pension/property wealth, the year's cash flow and marginal rate, the reference FIRE ratios, and a browsable annual ledger in today's money or nominal |
| FIRE & Monte Carlo | 4 | **Built.** Live `runMonteCarloBrowser` runs with progress, cancellation, error states and stale-result invalidation; probabilities, percentiles, age-level fans, sequence risk, diagnostics and reproducibility metadata |
| FIRE Age Curve | 6 | **Built.** Live `fireAgeCurveBrowser` runs with per-age and per-path progress, cancellation, error states and stale-result invalidation; the probability curve, the earliest qualifying age, bridge length, capital at FIRE and terminal wealth per age, and the sampling interval beside every probability |
| Marginal Allocation | 7 | **Built.** Amount, funding basis and maximum-debt controls; six evaluated/infeasible destinations; exact first-year funding audit and configured tax boundaries; constrained rankings, paired uncertainty and target-age outcomes. Coordinator-worker progress/cancellation and stale-result invalidation verified in Chrome at 10,000 paths, including actual deposit and mortgage cases, 1440px desktop and 390px mobile. |
| Reverse Solver | 6 | **Built.** Six searched inputs against the full model, the bracket around each answer, an independent confirmation run, the complete evaluation trace including unsupported candidates, and section 33's sensitivity cases as separate searches. Progress, cancellation and stale invalidation as on FIRE |
| Scenario Comparison | 8, 10 | **Built.** Named scenarios with versioned local save/load, migration and refusal of unreadable documents; the eight section 64 presets; an optional section 61 required-salary solve per case; four comparisons on common random numbers — the 5 × 3 × 4 matrix, spending cases, income bands and saved scenarios — each cell a complete lifetime simulation at the entered path count. Take-home, marginal rate, pension/ISA/total contributions, FIRE success with its sampling interval, optional earliest qualifying FIRE age, and liquid/pension/net wealth at FIRE. Coordinator-worker progress in both scenarios and paths, cancellation, stale-result invalidation and an explicitly chosen, labelled preview, verified in Chrome at 10,000 paths on 1440px desktop and 390px mobile |
| Property & Leverage | 5 | **Built.** Validated conditional property form, equity/LTV/coverage/downside, rate scenarios, complete property ledger and cancellable 10,000-pair rent/invest comparison. Verified in Chrome at 1440px and 390px. Overview includes property ledger audit lines; FIRE includes property wealth and mortgage failures |
| Where It Comes From | 9 | **Built.** An editable stress start age, path count and target; nine one-at-a-time interventions and nineteen sensitivity rows, each a complete lifetime rerun at the entered path count on the same seed, absolute path indices and underlying Gaussian shocks; a signed effect with a conservative difference bound beside every bar; observed funding events and sequence/crash/inflation diagnostics labelled as associations rather than causes; seven deterministic stress cards stating their own assumptions with a full funding-failure audit; and per-case profiles, options, engine results and stress ledgers exposed for recomputation. Coordinator-worker progress in both cases and paths, cancellation that publishes no partial analysis, and stale-result invalidation verified in Chrome at 10,000 paths on 1440px desktop and 390px mobile |

## Golden cases (sections 86–87)

- Known income tax, NI, contribution relief, dividends, CGT: implemented, 50 tests after chunk 1.
- FIRE £40k/4% = £1m (scenario A), compound growth, and the spending double effect (scenario F): **done in chunk 2**; 92 tests overall.
- Certain success (C), certain failure (D) and locked-wealth failure (E): **done deterministically and probabilistically**; `monte-carlo.test.ts` covers C/D/E across paths.
- Zero-volatility equality: the ledger already consumes a supplied `MarketPath`, and `ledger-reconciliation.test.ts` pins that an explicit means path reproduces the deterministic run. Chunk 3 now asserts generator zero-volatility equality and complete ledger/real-distribution equality.
- Mortgage amortisation and £300k/£60k leveraged appreciation (scenario B): **done in chunk 5**, plus GIA-tax-bearing purchase funding, full property reconciliation, housing counted once, explicit sale and changed FIRE success. `property.test.ts`.
- Seeded repeatability and sampling statistics: **done**, `monte-carlo-generator.test.ts` and `monte-carlo.test.ts`.
- Section 80 dashboard figures (£75,000 liquid, £25,000 pension, £100,000 net worth, £19,800 target spending, £565,714 reference FIRE number): **done in chunk 4**, asserted against the engine in `presentation-screens.test.ts` and confirmed rendering in Chrome.
- Release acceptance across all requirements and screens: **done in chunk 10**. Every section 88
  MUST above was re-derived from the source and a named test; the two gaps found were closed rather
  than deferred, and `docs/handoffs/chunk-10.md` carries the measured Chrome evidence, the benchmark
  numbers with their hardware and concurrency, and the limitations that remain.

Maintain this checklist as each package lands; add test/file references as evidence. Do not treat prototype outputs or an interface alone as finished functionality.
