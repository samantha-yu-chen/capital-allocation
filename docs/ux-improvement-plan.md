# UX improvement plan — making the model usable by non-financial adults

Status: proposed. Baseline: the v0.3 release (package 10 merged, `96c36c3`). This document is the
result of a supervisor inspection of the delivered product: a UI complexity audit, and a spot audit
of the calculation engine. It turns the findings into practical, agent-sized tickets. Each ticket
has explicit acceptance criteria (AC) so an agent (Opus or Codex) can pick it up, deliver it, and
prove it delivered it.

**The product goal these tickets serve:** a general adult — not a finance person — should be able to
answer, with this app, in their first session:

1. *"Where do I stand financially?"*
2. *"When can I be financially independent?"*
3. *"If I want to hit my goal by age X, what salary (or savings) do I need?"* (reverse mode)
4. *"Which of these numbers should I change, and which are safe defaults?"*

The engines already answer all four. The gap is entirely presentation: the inputs and results are
expressed in the vocabulary of the spec, not of the user.

---

## Part A — Inspection findings

### A.1 UI complexity audit

The profile surface exposes **~90 numeric fields plus a 5×5 correlation matrix, a withdrawal-order
editor, phase/capital-need list editors and eight select/checkbox controls**, all through one
uniform field registry (`src/presentation/view/fields.ts`) rendered as twelve collapsible groups
(`src/presentation/web/profile-form.tsx`). Specific problems, in order of harm:

1. **No tiering of inputs.** "Gross salary" (everyone must set) and "GIA turnover — share of the
   holding sold and rebought each year" (almost nobody should touch) have identical visual weight.
   A first-time user cannot tell the five numbers that matter from the eighty-five that have sound
   defaults. This is the single biggest barrier.
2. **No provenance on values.** Every field shows a number, but nothing says whether it is a
   default from the example profile, a calculated suggestion, or something the user entered.
   The user's own words: *"should be some management of what to change, what's default by calc."*
3. **Jargon without a ladder.** GIA, SIPP, ISA allowance, salary sacrifice, NI shareback, MPAA,
   taper, cost basis, carried losses, Gaussian log-growth shock correlation, positive semidefinite,
   p10/p90, standard error — all appear as field labels or help text with no glossary and no
   plain-language first sentence. Help text often explains the *modelling convention* (correct, and
   worth keeping) but never the *concept* (missing).
4. **No guided path to a first result.** The app opens on Overview with the example profile. There
   is no "start here" flow that walks a new user through the handful of personal numbers and then
   shows their own answer. Every screen assumes the user already knows which tab answers which
   question.
5. **Question-shaped engines behind noun-shaped screens.** "Reverse Solver", "Marginal Allocation",
   "Where It Comes From" are engine names. The user's questions — "when can I retire?", "what
   salary do I need?", "where should my next £1,000 go?" — are answered by those screens but never
   asked by them.
6. **Validation messages speak schema.** `Require floor <= target <= comfort retirement spending`,
   `Correlation must be symmetric, unit-diagonal and positive semidefinite` — accurate, and useless
   to the target user.
7. **Raw number inputs.** Money fields have no £ prefix or thousands separators while typing;
   percent fields show no % suffix; monthly vs annual is stated only in the label.
8. **Two success numbers, no arbitration for the lay reader.** The reference FIRE number (4%-rule
   arithmetic) and the Monte Carlo success probability coexist. The code and help text are honest
   about which is authoritative, but a lay user still sees two different-looking verdicts.
9. **No in-app learning material.** The only conceptual documentation is the spec (dense) and a PDF
   learning deck in `docs/learnings/` that is not reachable from the app.

### A.2 Calculation audit — result: no math errors found

The engine was spot-audited at the points most likely to be silently wrong. Everything checked was
correct. Agents picking up tickets below must not "fix" any of these:

| Checked | Verdict |
| --- | --- |
| Lognormal return parameterisation (`generator.ts`): `σ² = log(1+(v/(1+m))²)`, `μ = log(1+m) − σ²/2` | **Correct.** Exactly preserves the configured arithmetic mean m and volatility v: E[1+r] = 1+m, Var = v². Box-Muller uses `log(1−u)` with u∈[0,1), so log(0) is unreachable. |
| Correlation applied to Gaussian log-shocks with semidefinite Cholesky (schema and generator agree) | **Correct**, and the UI help text about arithmetic-vs-log correlation is right. |
| 2026/27 tax config (`uk-2026-27.ts`) vs post-Autumn-Budget-2025 rules | **Correct**: PA £12,570 frozen w/ £100k taper at 50%; rUK bands 20/40/45 at 37,700/125,140; dividend rates 10.75/35.75/39.35 (the +2pp April 2026 change is in); NI 8%/2% above £12,570/£50,270, employer 15% above £5,000; CGT 18/24 with £3,000 AEA; AA £60k, taper 200k/260k → £10k floor, MPAA £10k, LSA £268,275; ISA £20k. Sources and verification date recorded in the file. |
| Income tax personal-allowance allocation (`income-tax.ts`) | Optimises the PA split across non-savings/savings/dividends over the boundary polygon rather than assuming "non-savings first" — **more correct than most calculators**. RAS extends bands but not the Scottish starter band, per the documented choice. |
| NI (`national-insurance.ts`) | Correct annualised Class 1, category C at state-pension age. |
| Nominal/real convention: nominal ledger, `inflationIndices` with index[0]=1, real presentation | Consistent; `closingInflationIndex` deflates closing balances; no double deflation found. |
| Percentiles (`statistics.ts`) | Standard linear interpolation at (n−1)p; `worst` correctly labelled an observed minimum. |
| Reference FIRE arithmetic (`fire-metrics.ts`) | Matches spec §13/§18/§76 and is consistently flagged as reference-only, not a safety result. |
| `scaleTaxConfig` constant-real policy | Scales every monetary threshold, never a rate; lump-sum allowance included. |

Two presentation-level observations (not bugs) feed tickets below:

- `calculatePensionRelief` reports `totalTaxRelief` excluding the employee-NI saving while
  `personalNetCost` includes it. Numerically consistent, but any screen surfacing both must label
  them precisely (picked up in UX-8).
- The reference FIRE number divides *gross* retirement spending by the withdrawal rate; withdrawal
  taxes are only in the Monte Carlo/ledger path. Already documented as reference-only; the lay
  explanation of the two numbers is ticket UX-7.

**Because the math is sound, every ticket below is presentation-layer only.** No ticket may change
an engine result, an engine version, `profileSchema` semantics, seeds, path counts, or any
convention in `AGENTS.md` ("Conventions that must not break"). If a ticket seems to require an
engine change, stop and report instead.

---

## Part B — Ground rules for every ticket

These apply to all tickets and are part of each ticket's AC even where not restated:

1. **Process.** Work per `AGENTS.md`: branch in a worktree; `npm run check` green with new tests
   that fail without the change; real-Chrome verification for anything touching a screen (both
   worker smoke variants, desktop and mobile widths); update `docs/requirements-checklist.md` if a
   claim changes; write a handoff `docs/handoffs/ux-N.md` naming delivered scope, limitations, and
   the next ticket's inheritance.
2. **Architecture.** Calculations and all testable presentation logic stay in
   `src/presentation/view/` (React-free, unit-tested). React components in `src/presentation/web/`
   render view-model output only. Numeric inputs are described in the field registry
   (`src/presentation/view/fields.ts`), never inline.
3. **Honesty.** No simplification may hide uncertainty or manufacture a result: no reduced path
   counts, no unlabelled previews, no figure a lay user could mistake for advice. The existing
   "not regulated financial advice" framing stays visible.
4. **The eight tabs stay reachable.** New surfaces (wizard, basic mode) are additive entry points,
   not replacements for the reference tabs.
5. **Language.** Plain-English first sentence, precise sentence second. Reading level: assume the
   user knows "salary", "rent", "pension" and nothing else. Keep established technical terms in
   parentheses so advanced users can map back to the spec.

Suggested order: UX-1 → UX-2 → UX-3 → UX-4 → UX-5/UX-6 (parallel-safe) → UX-7 → UX-8 → UX-9 →
UX-10. UX-1..3 are the foundation the rest reuse. Sizes: S ≈ half a package, M ≈ one package,
L ≈ a package and a half.

---

## Part C — Tickets

### UX-1 (M) — Field tiering: essential / common / expert, described in the registry — **delivered**

Delivered. `NumberFieldDef.tier` is required (an untiered field is a compile error) and the select,
checkbox, text and composite-editor controls moved out of `profile-form.tsx` into `CHOICE_FIELDS` /
`choiceFieldsFor`. `fieldVisibility` is the React-free filter; `ProfileForm` gained `filterable`,
set only on Overview. 13 essential, 24 common, 68 expert. The default view renders 30 inputs
(13 in `Essential only`, 85 in `Everything`); a non-positive-semidefinite correlation matrix
surfaces its editor, cell and message in `Essential only` while the rest of the expert surface
stays hidden. 258 tests pass. Final classification, judgement calls against the starting list, the
measured Chrome evidence and the UX-4 inheritance note are in `docs/handoffs/ux-1.md`.

**Problem.** All ~90 fields carry equal weight (finding A.1.1).

**Tasks.**
- Add a `tier: 'essential' | 'common' | 'expert'` property to `NumberFieldDef` (and to the select/
  checkbox controls' definitions, which today are inline in `profile-form.tsx` — move their
  metadata into the registry as part of this ticket).
- Classify every field. Starting classification (adjust with judgement, record the final list in
  the handoff):
  - **essential** (~12): current age, target FIRE age, gross salary, current essential+discretionary
    spending, retirement essential+discretionary spending, cash, ISA, pension balances, employee/
    employer pension rates, tax region.
  - **common** (~25): bonus, other income, state pension amount/age, GIA balance, SIPP, emergency
    reserve months, property core fields (value, mortgage balance/rate/term), salary growth,
    lifestyle creep, end age, target success probability.
  - **expert** (everything else): correlation matrix, per-wrapper portfolios, market moments, GIA
    turnover/realisation/dividend yield, NI shareback, MPAA/taper flags, carry-forward, withdrawal
    order, seed, path count, floor/comfort runs, scenario bands, phases, capital needs.
- `ProfileForm` gains a view filter (`Essential only` / `Essential + common` / `Everything`),
  defaulting to `Essential + common`, persisted in component state (not the profile). Hidden
  fields keep their stored values — filtering is display-only and must not touch the profile or
  the run key.
- A group whose fields are all filtered out is hidden; a group with a validation error is always
  shown expanded with the offending field visible regardless of filter (validation must never be
  maskable).

**AC.**
1. Every entry in the field registry (numeric, select, checkbox) has a tier; a unit test asserts
   completeness (no untiered field can be added without failing it).
2. With the default filter, the rendered profile form shows ≤ 40 inputs; a test on the view-model
   filter function (not on React) asserts the essential set is exactly the recorded list.
3. Switching filters never changes the profile object, the validation state, or the run key —
   asserted by a test that filters and compares serialised profiles/keys.
4. A profile made invalid in an expert field (e.g. correlation asymmetry via a saved library entry)
   surfaces that field and its error even in `Essential only` view — Chrome-verified.
5. `npm run check` green; Chrome verification at desktop and mobile widths; handoff written.

### UX-2 (M) — Value provenance: default vs edited, and "reset to default" — **delivered**

Delivered. `src/presentation/view/starter-profile.ts` names the one profile the app calls a default
(`createStarterProfile()`, byte-identical to `createExampleProfile()`), and
`src/presentation/view/provenance.ts` is the React-free comparison: `provenance(profile, starter)`
returns the `default`/`edited` map, `fieldProvenance` adds the wording each control shows, and
`resetToStarter` produces the restored profile the store revalidates. Comparison is on stored
values, never display strings; an entry the starter has no value for (a phase row, a property it
does not include) reads as the reader's own and offers no reset rather than inventing a default.
Derivation notes live on the registry entries themselves, and a test asserts each claim is true of
the starter. Markers and resets are attached once, in `ProfileForm`, so they cover the numeric grid,
the selects and checkboxes, and the composite editors. 269 tests pass; both worker smoke variants,
the tier-filter, property and solver harnesses and a new `tests/browser-provenance-ui.mjs` pass in
Chrome. Details, deviations and the UX-3 inheritance note are in `docs/handoffs/ux-2.md`.

**Problem.** Nothing distinguishes a curated default from a user-entered value (finding A.1.2;
this is the user's most explicit request).

**Tasks.**
- Introduce a single canonical **starter profile** (the current example profile, renamed and
  documented as such) in `src/presentation/view/` and record, per field id, whether the working
  profile's value differs from it. This is pure data comparison in the view layer — no schema
  change, so saved scenario libraries are unaffected.
- `NumberField` (and select/checkbox) shows a small "edited" marker when the value differs from
  the starter value, with an accessible label ("changed from default 5%").
- Per-field "reset to default" affordance and a per-group "reset group" action, both routed through
  the existing draft/edit machinery so validation still runs.
- Where a default is *derived* rather than arbitrary (e.g. retirement spending defaulting to
  current spending, phase rows seeded from FIRE age), the marker's tooltip says what it was derived
  from. Derivation notes live in the registry as data.

**AC.**
1. A view-model function `provenance(profile, starter) → Map<fieldId, 'default' | 'edited'>` exists
   with tests covering scalar, array-backed and percent fields (display rounding must not cause
   false "edited" flags — compare stored values, not display strings).
2. Editing any field flips its marker; resetting restores the starter value and the marker returns
   to `default` — Chrome-verified on at least one money, one percent and one select field.
3. Reset actions go through `profileSchema` validation like any edit (asserted by a test that a
   reset while another field holds an invalid draft still reports that field's issue).
4. No engine input changes: the starter profile is byte-identical to the previous default profile
   (test compares the fixtures).
5. `npm run check` green; handoff written.

### UX-3 (M) — Plain-language layer: labels, help, glossary

**Problem.** Jargon-first labels and convention-first help (finding A.1.3).

**Tasks.**
- Add optional `plainLabel` and `plainHelp` strings to registry entries. Rendering rule: plain
  first, technical term in parentheses once — e.g. "General investment account (GIA) — investments
  outside tax shelters; gains and dividends are taxed."
- Write plain help for every **essential** and **common** field (UX-1's tiers). Expert fields keep
  their current precise help; add plain help opportunistically.
- Add a glossary as data in `src/presentation/view/` (term → one-paragraph plain definition,
  ~25 terms: ISA, GIA, SIPP, salary sacrifice, FIRE, bridge period, Monte Carlo, success
  probability, percentile, nominal vs today's money, withdrawal rate, annual allowance, MPAA,
  taper, cost basis, drawdown, sequence risk, equity, volatility, correlation, inflation index,
  state pension, net worth vs accessible wealth, standard error, emergency fund).
- Terms occurring in labels/help/results link to their glossary entry (popover or side panel —
  match the Organic design system; no new dependency).
- Rewrite the cross-field validation messages surfaced by `fields.ts` into human sentences via a
  message map keyed on the schema issue path+message (the schema itself must not change): e.g.
  "Your floor spending should be at most your target, and comfort at least your target — floor is
  the least you could live on, comfort is the most you'd like."

**AC.**
1. Every essential and common field has `plainHelp`; a test asserts it (tier from UX-1).
2. Glossary is data with a test that every term referenced from labels/help/results resolves (no
   dangling references), and every glossary entry is referenced at least once.
3. `profileSchema` and its messages are unchanged (test: schema issue list for a fixture of invalid
   profiles is byte-identical before/after); only the presentation map differs.
4. The five most common invalid states (floor/target/comfort order, portfolio weights ≠ 100%,
   ages out of order, blank field, breakdown mismatch) each show a rewritten message —
   unit-tested through the message map and Chrome-verified for two of them.
5. `npm run check` green; desktop + mobile Chrome verification (popovers must be usable at 400px
   width); handoff written.

### UX-4 (L) — "Start here" wizard producing a first personal result

**Problem.** No guided path from empty-headed arrival to "my own number" (finding A.1.4).

**Tasks.**
- New route/surface (within the existing shell, e.g. an Overview-hosted panel shown until
  dismissed, or a ninth *navigation* entry that is explicitly an entry point, not a ninth analysis
  tab — the eight reference tabs stay as they are) presenting 5 steps:
  1. About you — age, target FIRE age (with "not sure? leave our suggestion" default), tax region.
  2. Income — salary, bonus, pension contribution rates (explain the employer match in one line).
  3. Spending — current monthly, expected retirement monthly (defaulted from current), rent inside
     it if renting.
  4. What you have — cash, ISA, pension, GIA (each with a one-line plain definition from UX-3).
  5. See your result — runs the deterministic ledger immediately (it is instant and free) and
     shows: reference FIRE number, wealth-at-FIRE, and a clearly-labelled invitation to run the
     full 10,000-path simulation for the real success probability.
- The wizard edits the same profile through the same registry/draft/validation machinery — it is a
  filtered view (UX-1 essential tier), not a second form. Fields not shown keep starter defaults
  (UX-2 provenance shows this afterwards).
- Step 5's deterministic figures must carry the existing reference-only framing ("simple
  arithmetic, not the safety result") and a single button that runs the real Monte Carlo with the
  normal progress/cancel UI.
- Dismissal state in `localStorage`; re-openable from the sidebar.

**AC.**
1. Completing the wizard with only essential inputs yields a valid profile (test: wizard field set
   ⊆ essential tier; a profile built from wizard-only edits parses).
2. Invalid input blocks progression with the plain message (UX-3) attached to the field — Chrome-
   verified (e.g. FIRE age below current age).
3. Step 5 shows deterministic results labelled as reference arithmetic, and launching the full run
   from it produces the same success probability as launching from the FIRE tab with the same
   profile (Chrome-verified once; the run key must be identical, asserted in a test).
4. The wizard never runs a simulation implicitly — the 10,000-path run starts only on the explicit
   button, with progress and cancellation working (Chrome-verified).
5. All eight reference tabs remain reachable while the wizard exists, at desktop and mobile widths.
6. `npm run check` green; both worker smoke variants pass; handoff written.

### UX-5 (M) — Question-led headline: "When can I be financially independent?"

**Problem.** The app's central answer is scattered across FIRE, Curve and Solver tabs (findings
A.1.4/A.1.5).

**Tasks.**
- Overview gains a headline card, populated only from **completed** runs (never a placeholder
  figure): plan success probability at the target FIRE age with its confidence-band label (the
  §16 bands already exist in `monte-carlo-model.ts`), and — when a FIRE-age-curve result exists —
  the earliest qualifying age, in a sentence: "At your target of 55, this plan succeeds in 69.0%
  of simulated futures ('Moderate'). The earliest age that meets your 90% target is 58."
- Each figure names the run it came from (the existing metadata) and links to the owning tab.
  Stale-result invalidation must clear the card exactly as it clears the owning screens.
- If no run has been made, the card shows the question and a "run" affordance — never a number.
  A cancelled/failed run leaves the card empty (existing publish rules).

**AC.**
1. The card is a view-model (`overview-model.ts` extension) with tests: no-run state, success
   state, stale state, band boundary values (band labels must match `confidenceBand` exactly).
2. No number renders without a completed run backing it (test + Chrome verification of the
   invalidation path: edit salary after a run and the card empties).
3. Sentence copy comes from the view model (testable), uses plain language, and reports the
   probability with its standard-error-appropriate precision (reuse the existing formatting rules;
   never more decimal places than the sampling error supports).
4. `npm run check` green; Chrome desktop + mobile; handoff written.

### UX-6 (M) — Reverse mode, question-first: "What do I need to change to hit my goal?"

**Problem.** The Reverse Solver already answers "what salary do I need" (§33/§61, confirmed to
£100), but the screen is engine-shaped (finding A.1.5).

**Tasks.**
- Rework the Reverse Solver screen's top section into a question picker: "To hit my goal, what
  would my … need to be?" with the six existing search inputs as answers (salary / annual savings /
  FIRE age / retirement spending / extra starting capital / pension contribution). This is a
  re-labelling and re-grouping of the existing controls through the registry — solver inputs,
  bounds and behaviour are untouched.
- Present the result as a sentence with the existing precision/bracket honesty: "You would need a
  gross salary of about £87,600 (we confirmed £87,600 clears your 90% target and £87,500 does
  not)." Infeasible/budget-exhausted states keep their explicit wording, translated to plain
  language via UX-3's message layer.
- Add a "what would it take?" link from the UX-5 headline card (when probability < target) that
  lands on this screen with the salary question pre-selected — pre-selection only; it must not
  auto-start a solve (solves are expensive and always explicit).

**AC.**
1. Solver engine, bounds, seeds and evaluation budget untouched (no diff under `src/engine/`).
2. The six modes are selectable and each renders its existing controls; a view-model test maps
   every solver status (achieved, already-met, infeasible, budget-exhausted, unsupported) to a
   plain sentence that includes the bracket or bound honesty.
3. The known baseline reproduces: the reference profile's required salary solve still reports
   £87,600 with confirmation (Chrome-verified once at full count, or via the checked-in solver
   harness `tests/browser-solver-ui.mjs`).
4. Navigation from the Overview card pre-selects the salary question and does not auto-run —
   Chrome-verified.
5. `npm run check` green; handoff written.

### UX-7 (S) — One story for the two success numbers

**Problem.** Reference FIRE arithmetic vs Monte Carlo probability confuses lay readers (findings
A.1.8, A.2 note 2).

**Tasks.**
- Write one canonical explanation as view data, shown wherever both numbers are visible (Overview,
  FIRE tab, wizard step 5): "The FIRE number is simple arithmetic — yearly spending ÷ 4% (your
  configured rate) — useful as a landmark, silent about taxes and bad market years. The success
  probability simulates your actual plan 10,000 times with taxes, inflation and market ups and
  downs; it is the number your target is judged against."
- Audit every current surface showing the reference number for the reference-only caveat; add it
  where missing, through the shared component.

**AC.**
1. The explanation is one shared constant/component; a test asserts the surfaces that show the
   reference FIRE number also render the caveat (extend `presentation-screens.test.ts` pattern).
2. Wording states the configured withdrawal rate dynamically (not hard-coded "4%") — unit test with
   a non-default rate.
3. No numeric output changes anywhere (existing screen tests unchanged).
4. `npm run check` green; handoff written.

### UX-8 (S) — Money and percent inputs that read like money and percent

**Problem.** Raw `<input type=number>` ergonomics (finding A.1.7).

**Tasks.**
- `NumberField` renders a £ prefix for money/monthlyMoney kinds, a % suffix for percent, "/mo" for
  monthly kinds, and formats thousands separators **on blur** (draft text while focused stays raw —
  the NaN-on-invalid contract in `fields.ts` must be preserved; `fromDisplay` may additionally
  accept commas by stripping them, with tests).
- Monthly fields show the annual equivalent as inert help text ("= £19,800/yr"), computed in the
  view layer.
- Label the pension-relief figures precisely where surfaced (A.2 note 1): "tax relief" vs "tax +
  NI you no longer pay" are different numbers and must be named differently.

**AC.**
1. `fromDisplay('1,234.50')` parses to 1234.5; `'1,2,3'` and `'£12'` still become NaN or are
   normalised — behaviour chosen, documented and tested; empty string still NaN; round-trip
   `toDisplay(fromDisplay(x))` stable for the test corpus.
2. Focus/blur formatting never fires a profile edit by itself (test: blurring an untouched field
   leaves drafts and profile identical).
3. Annual equivalents derive from stored values in a tested view function.
4. Chrome verification includes keyboard-only entry and mobile width.
5. `npm run check` green; handoff written.

### UX-9 (M) — Starter situations ("people like me") as labelled scenario presets

**Problem.** A blank-slate general user does not know plausible values (findings A.1.2/A.1.4).

**Tasks.**
- Ship 4–6 curated starter profiles as named entries in the existing scenario library machinery
  (`src/domain/scenarios.ts` — no schema change): e.g. "Renting, late 20s, starting out",
  "Family, 40s, mid-mortgage", "50s, pension-heavy, FIRE soon", "Contractor, no employer pension".
  Values must be internally consistent and validated; document the reasoning for each in the
  handoff.
- A picker (wizard step 1 and/or scenario screen) clones a starter into the working profile via the
  existing duplication path; UX-2 provenance then marks everything "default" relative to the chosen
  starter.
- Each starter card states clearly it is an illustration, not advice or a benchmark.

**AC.**
1. Every starter parses under `profileSchema` (test iterates all of them) and runs the
   deterministic ledger without failure records at its own target (test).
2. Choosing a starter never mutates other library entries (reuse the scenario-independence test
   pattern).
3. Provenance (UX-2) compares against the chosen starter after selection (test).
4. Cards carry the illustration caveat — Chrome-verified.
5. `npm run check` green; handoff written.

### UX-10 (M) — In-app "Learn" panel and a written learning doc

**Problem.** No conceptual on-ramp; the only deck is a PDF outside the app (finding A.1.9; the
user had to write their own learning notes to use their own product).

**Tasks.**
- Write `docs/learnings/how-the-model-works.md`: a plain-language walkthrough (≤ 2,500 words) of
  the model for a general adult — what a year looks like (earn → tax → spend → invest → grow), what
  the simulation does, what success probability means, why results are in today's money, what the
  app deliberately does not do (advice, predictions, dynamic spending cuts). Derive strictly from
  the spec and ADRs; where the doc states a number or rule, cite the source file.
- Surface it in-app: a "How this works" panel reachable from the sidebar, rendering per-screen
  sections (each tab gets 2–4 paragraphs: the question the tab answers, how to read its output).
  Content lives as data in `src/presentation/view/`; the markdown doc and in-app text share
  phrasing (copy divergence is acceptable, contradiction is not — reviewer checks in the handoff).
- Link glossary terms (UX-3) from the learn text.

**AC.**
1. `docs/learnings/how-the-model-works.md` exists, cites sources, and contains no claim
   contradicting `AGENTS.md` conventions or ADRs (reviewed statement in the handoff).
2. Every one of the eight tabs has a learn section; a test asserts the section map covers all tab
   ids.
3. The panel renders at desktop and mobile widths without breaking tab reachability —
   Chrome-verified.
4. No engine or profile change of any kind.
5. `npm run check` green; handoff written.

---

## Part D — Explicitly out of scope for these tickets

- Any engine change, any new modelled feature (couples optimisation, multiple properties, dynamic
  withdrawal…) — the v0.3 scope boundaries in `docs/implementation-work-packages.md` stand.
- Recommendation language ("you should…") anywhere. The app explains and simulates; it does not
  advise.
- Localisation/translation of the UI (a separate decision; keep copy in data so it stays cheap).
- Auto-running expensive simulations. Explicit run buttons with cost announcements remain the rule.
