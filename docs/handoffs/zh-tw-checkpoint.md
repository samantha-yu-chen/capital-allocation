# Traditional Chinese localization — in progress

Worktree: `.worktrees/zh-tw`, branch `feat/zh-tw`, baseline `01f2e84`.

## Requested outcome

English by default, a visible English / 繁體中文 switch, Taiwan Traditional Chinese across the
application, translations maintained in a separate module. Preserve profiles, completed results,
worker behavior, numeric units, tax jurisdiction and all eight destinations on language changes.

## Implemented so far (not delivered)

- Independent `src/presentation/i18n/` catalogs and pure locale selection helpers.
- React locale provider outside `App`, storage preference with safe fallback to English,
  document `lang` and a visible language selector.
- Shell navigation labels, brand, onboarding/learn links and main heading localized.
- Shared numeric/select/checkbox components translate labels, help and options at render time,
  so cached English view models remain reusable and language changes preserve mounted inputs.
- Static profile fields and groups have translated labels and explanations (142 registry-authored
  help/note/derivation entries, plus shared asset help). Variable phase/refinance/capital-need and
  correlation labels have explicit anchored templates. Property choice labels/options translated.
- All 25 glossary terms/definitions translated in a separate ID-based catalog, preserving IDs and
  cross-references. Glossary UI subscribes to locale changes.
- Shell summaries, header badges and tax disclosure translated. Some shell/shared UI translations
  are currently inline; move those into the independent catalogs while finishing the UI.
- Five locale tests cover defaults/storage errors, message parity, static field/group text coverage,
  numeric/unknown-text preservation and variable indices, and full glossary coverage.
- Dependencies installed in this worktree. First `npm run check` passed (347 tests, typecheck and
  build); after adding glossary, typecheck passed. Latest full check completed successfully: 348 tests, 0 failures, typecheck and production build
  passed; output `/tmp/zh-tw-check-2.log`. `git diff --check` also passed.

## Required next work

- Translate every screen, field registry label/help/option, starter situation, glossary, learn panel,
  validation/run state and dynamic view-model explanation. Profile editor prose, provenance and arrival notes still need translation. Avoid DOM rewriting and translating user-authored scenario names.
- Keep presentation logic React-free. Locale must not enter engine inputs or cache/run keys.
- Meaningful coverage tests, `npm run check`, isolated Chrome verification including both worker
  smoke variants, actual 10,000-path results, switching during/after a run, invalidation,
  cancellation, persistence, all destinations and mobile overflow.
- Update requirements checklist/work packages and write final handoff with measured evidence.
- Commit in stages, merge and push according to AGENTS.md. Primary checkout stays on main.

No completion claim, commit, merge or push has been made. No browser evidence yet. The first
full check emitted the existing Vite bundle-size advisory; locale catalog splitting can be reviewed
when the full translation coverage is in place. Primary checkout has an untracked `.claude/` tree;
do not modify it. The task worktree is inside primary `.worktrees/`, which is not currently ignored;
avoid accidentally adding it from the primary checkout.

## Second localization stage — onboarding, profile prose and FIRE

This stage adds `starter-zh-TW.ts`, `onboarding-zh-TW.ts`, `profile-zh-TW.ts`,
`fire-zh-TW.ts`, `fire-templates.ts`, `errors-zh-TW.ts`, and `common-zh-TW.ts`.
Translation remains render-time and React-free in `i18n/`; mounted components subscribe to the
locale context. No domain, tax configuration, engine input or result format has changed.

- All six starter cards, descriptions and reasoning; fact values, selection actions, jump labels
  and provenance notes; all five wizard steps and result explanations are translated.
- The shared two-number explanation translates the reader's actual path count and withdrawal rate,
  retaining the success probability as the authority.
- FIRE controls, cards, result labels, diagnostic explanations, sequence notes, metadata labels,
  progress, chart descriptions and age/count-dependent paragraphs are translated.
- Profile editors, tier filter explanation, reset/provenance text and field arrival notices are
  translated. Validation rewrite strings and numeric-bound messages are localized for display;
  `profileSchema` and the issue data are unchanged. Unsupported pension-limit messages retain ages
  and excess amounts.
- Shell/shared/glossary inline Chinese copy has moved into independent catalogs. The language
  selector intentionally keeps bilingual names. Technical metadata IDs remain exact identifiers.

Latest automated evidence: `/tmp/zh-tw-check-7.log`, `npm run check` passes **353 tests, 0 failures**,
strict typecheck and production build. The existing bundle-size advisory remains (722.36 kB main
bundle, 231.46 kB gzipped). `git diff --check` passes.

`tests/browser-locale-ui.mjs` is an incremental CDP harness, explicitly not a certification that all
screen bodies are localized. Latest run `/tmp/zh-tw-browser-3.log` exits 0; output also saved at
`/tmp/zh-tw-ui-results.json`, mobile image `/tmp/zh-tw-fire-mobile.png` visually inspected:

- Baseline worker smoke: browser/local equality, cancellation, **10,000 paths, 68.98%, 4.283 s**.
- Property worker smoke: equality, cancellation, **10,000 paths, 35.18%, 4.735 s**.
- English fresh default; Traditional Chinese persistence after reload.
- Six starter cards and wizard heading localized.
- Salary edit survives switching in both directions; translated glossary definition opens.
- All eight navigation destinations reachable.
- Real FIRE run remains **68.98%** when switched while running and again after completion.
- Input edit discards stale results; cancellation publishes no partial result.
- **0 px** mobile overflow at 390 × 844; **0** uncaught page exceptions.

Two failed assertions were in the new tests/harness, not production failures: numeric-token
comparison initially counted English punctuation as numbers; glossary probe initially selected the
first term (FIRE) while asserting the today's-money definition. Both now target what they claim.
A provenance test initially expected grouped digits where the existing provenance model uses
ungrouped digits; it now asserts the source and translated numeric tokens are identical.

The dev server (exec session **6489**, port **5183**) and isolated Chrome (exec session **25654**,
CDP **9234**, profile `/tmp/capital-zh-tw-chrome`) were left available. Revalidate live handles before
reuse. Latest harness session **84829** and check session **64255** are completed successfully.

### Next work still required

The seven other screen bodies and Learn panel do not yet subscribe to locale. Shared cards/fields
translate some text there, but that does **not** establish full coverage. Continue with Overview,
Curve, Solver, Marginal, Scenarios, Property, Attribution and Learn, including all dynamic view-model
text and error/unsupported states. Preserve user-authored scenario names and labels verbatim.
Add source/catalog coverage and browser evidence for those surfaces, plus final English regressions.
Update delivery docs, commit/merge/push, and perform the complete goal audit only after full coverage.

The earlier statement that no commit had been made refers to the initial checkpoint only: stage 1
is committed as **176d950**. No merge or push has occurred. The objective remains active.

## Stage 3 — Overview and Learn (incremental, not delivery)

Added independent `overview-zh-TW.ts` and `learn-zh-TW.ts` catalogs. Overview now translates its
ledger rows, real/nominal explanations, assumptions, cash-flow details and completed-run headline
at render time. Learn translates all five model sections and eight screen sections by stable ID,
retaining source paths, glossary relationships and navigation IDs. English still returns the
original model objects. No engine or profile contract changed.

`tests/locale.test.ts` now checks all Learn section IDs, paragraph counts, source/term relationships,
English identity and Overview template numeric tokens. The starter caveat source audit now accepts
`text(STARTER_ILLUSTRATION_CAVEAT)` as well as direct rendering; it continues to require the shared
constant and a standalone reader surface.

Evidence: `npm run check` green, **355/355**, `/tmp/zh-tw-check-9.log`; production main bundle
749.45 kB (242.82 kB gzip), existing Vite size advisory. Chrome `/tmp/zh-tw-browser-5.log` exits 0:
worker smoke **10,000 paths**, baseline **68.98%, 4.184 s**, property **35.18%, 4.633 s**, exact
browser/local equality and cancellation; Overview text and all **5 + 8** Learn sections present,
English round trip, full FIRE result **68.98%** preserved across switches during and after execution,
stale result discarded after seed edit, cancellation publishes nothing, **0 px** mobile overflow,
**0** runtime exceptions. The earlier browser-4 failure was a harness assertion using an invented
English heading; browser-5 checks the source's actual heading.

Remaining: Curve, Solver, Marginal, Scenarios, Property and Attribution bodies, dynamic result/error
copy, full coverage audit, browser evidence for those analyses, final delivery docs, merge and push.
Overview/Learn evidence above is incremental and does not certify every failure variant or all
screens. Do not mark the localization goal complete. No merge/push yet.

## Stage 4 — FIRE age curve and Reverse Solver (incremental, not delivery)

Added independent `curve-zh-TW.ts` / `solver-zh-TW.ts`. Both screens subscribe to locale without
adding it to a run key. Controls, six question options and precise mode definitions, progress,
work announcements, chart accessibility, result labels, evaluation traces, sensitivity descriptions,
constraints/unsupported reasons and dynamic answer/honesty clauses translate at render time.
Numeric data, raw technical metadata JSON and stable React keys remain unchanged. Error display now
handles a named `PensionLimitError` around an age-qualified allowance reason.

Tests now cover all six definitions, controls and source-authored static screen strings, actual
engine results for achieved / already-met / infeasible / budget-exhausted / unsupported, real curve
results with reached/unreached targets, and numeric tokens in dynamic announcements and chart aria
copy. Result objects are compared before/after translation. A visual audit found an overbroad
short `Reaches…` template intercepting the full headline, plus a nested named error retaining
English; both were fixed and regression assertions now reject those residual fragments. A singular
`search` announcement was also caught and fixed by the new tests.

Latest gate: `npm run check`, **359/359**, typecheck and production build green,
`/tmp/zh-tw-check-16.log`. Main bundle 783.19 kB / 253.33 kB gzip;
existing Vite size advisory remains. `git diff --check` green.

New manual harness `tests/browser-locale-solver-ui.mjs`, latest
`/tmp/zh-tw-browser-solver-4.log` exit 0, JSON `/tmp/zh-tw-solver-ui-results.json`:

- Actual **10,000-path** curve at ages **45/46/47**: **68.98% / 74.91% / 80.02%**.
  Table numeric cells identical in English and Chinese; chart aria localized. 796 animation frames,
  maximum gap **16.8 ms**. Three candidate ages were explicitly chosen; path count was not reduced.
- Actual salary search, sensitivity explicitly disabled: **£87,600**, confirmed **90.02% ± 0.59%**,
  lower tested **£87,500** fails. Full run **94.36 s**, 24 searched candidates, 10,000 paths each.
  5,667 animation frames, maximum gap **16.8 ms**. Switching during execution and after completion
  preserves the answer and all sentence numeric tokens.
- Both analyses discard finished results after relevant input edits; cancellation publishes none.
- Both at **390 × 844**: **0 px** page overflow; **0** uncaught runtime exceptions.
  `/tmp/zh-tw-curve-mobile.png` and `/tmp/zh-tw-solver-mobile.png` show actual result regions and were
  visually inspected. PensionLimitError remains the exact technical class name, its prose is Chinese.
- Invalid solver bound blocks execution and has a translated error.

The first browser attempt stopped because the harness expected a grouped `10,000` input where the
existing integer field holds `10000`; the assertion now compares the numeric value. This did not
change the input component. Browser-2/3 passed the behavior checks; browser-4 additionally rejects
the residual headline/error fragments discovered in visual review.

Remaining full-goal work: Marginal Allocation, Scenario Comparison, Property & Leverage and
Attribution screen bodies and their dynamic data/error copy; full source/catalog coverage audit;
corresponding real browser evidence plus final English regressions and both worker smokes; final
delivery docs, merge and push. Existing earlier stage evidence remains incremental. No merge or
push yet; goal remains active. Revalidate ports 5183 / 9234 before reusing them. Harness session
39434 and gate session 94287 completed successfully.

## Stage 5 — Marginal Allocation and Property (incremental, not delivery)

Independent `marginal-zh-TW.ts` / `property-zh-TW.ts` now cover screen controls, funding bases,
allocation classification/rank, all seven comparison-basis paragraphs, funding audits, constraints,
known infeasibility reasons, configured tax-band/basis names, property cash flow/leverage/rate
labels, purchase versus rent explanations, comparison results, progress and cancellation. Both
screens subscribe to locale at render time. A `property-comparison-result` test ID identifies the
real comparison table. Raw reproducibility JSON, profile data, numeric formats and engine code
remain unchanged. Raw numeric Zod control issues now have translated display messages, preserving
bound values and strict/non-strict comparisons.

Added tests for both allocation funding bases using actual engine output, result immutability,
property comparison labels from a real paired run, every tax-boundary label/basis in both tax
regions, control issues, authored static copy and numeric tokens in dynamic funding/progress text.
Latest gate `/tmp/zh-tw-check-18.log`: **361/361**, typecheck and production build green. Main bundle
**804.63 kB / 261.72 kB gzip**, existing Vite size advisory. `git diff --check` green.

New `tests/browser-locale-property-ui.mjs` ran successfully, latest
`/tmp/zh-tw-browser-property-2.log`, JSON `/tmp/zh-tw-property-ui-results.json`:

- Both worker smokes at **10,000 paths**, equality and cancellation true: baseline **68.98%,
  4.649 s**; property **35.18%, 5.432 s**.
- Allocation: all six cards present, all numeric tokens identical across English/Chinese switches
  during/after execution. Pension **69.11%**, ISA/GIA **69.05%**, cash **69.04%**; mortgage/deposit
  explicitly infeasible for the no-property profile and display translated reasons. 1,467 frames,
  maximum gap **16.8 ms**. The path count remained **10,000**.
- Property: full **10,000** paired paths; all ten comparison rows preserve both numeric columns
  across switches. Buy **35.18%**, rent/invest **69.01%**; mortgage-shortfall **33.23% / 0.00%**.
  2,213 frames, maximum gap **33.3 ms**.
- Relevant input edits discard both finished results; both cancellation paths publish nothing.
  Invalid allocation amount blocks execution with a translated error.
- Both at **390 × 844**, **0 px** page overflow, **0** uncaught runtime exceptions.
  `/tmp/zh-tw-marginal-mobile.png` and `/tmp/zh-tw-property-mobile.png` visually inspected; wide
  property tables retain the existing internal horizontal scroll.

Browser-1 stopped on a harness regex escaped incorrectly inside a CDP expression (`\d` became
`d`); browser-2 uses `[0-9]` and passes. No production change was needed for that harness failure.
Gate session 35995 and harness session 47393 are completed successfully. Ports 5183 / 9234 were
left running; revalidate live state before reuse.

Remaining: Scenario Comparison and Attribution bodies/dynamic errors; full localization coverage
and final English/browser regressions; final delivery docs, merge and push. No merge/push yet,
no full-delivery claim, and the active goal must remain active.

## Stage 6 — Attribution (incremental, not delivery)

Independent `attribution-zh-TW.ts` covers attribution controls, all seven stress assumptions,
lever/sensitivity labels, explanatory caveats, failure diagnostics, uncertainty, conclusions,
progress and known unsupported reasons. The screen translates display text at render time;
engine results, run keys, profile data and raw metadata remain unchanged. Corrected the diagnostic
translation of “first five FIRE years” to “FIRE 後最初五年內”. Tests cover actual attribution
outputs with and without property, numeric token preservation and result immutability.

Gate `/tmp/zh-tw-check-20.log`: **363/363**, strict typecheck and production build green.
Bundle **819.65 kB / 267.14 kB gzip**, existing Vite size advisory.
`tests/browser-locale-attribution-ui.mjs` passed, log
`/tmp/zh-tw-browser-attribution-1.log`, JSON `/tmp/zh-tw-attribution-ui-results.json`:

- Both worker smokes: **10,000 paths**, exact equality and cancellation true; baseline
  **68.98%, 4.257 s**, property **35.18%, 4.639 s**.
- Each full analysis contains **28** lever/sensitivity cases and **7** stress cases. English and
  Chinese result numeric tokens match across switching during and after execution.
- Desktop baseline: **91.672 s**, **5,485 frames**, maximum gap **16.8 ms**, **0 px** overflow.
- Property mobile **390 × 844**: **121.087 s**, **7,250 frames**, maximum gap **16.8 ms**,
  **0 px** overflow. Baseline mobile also checks zero overflow.
- Invalid stress age blocks execution with a translated error; editing an input clears stale
  results; cancellation publishes nothing. **0** uncaught runtime exceptions.
- Actual baseline and property mobile result screenshots visually inspected:
  `/tmp/zh-tw-attribution-mobile.png`, `/tmp/zh-tw-attribution-property-mobile.png`.

Harness session 55607 completed successfully before any further repository edits.
Remaining: Scenario Comparison, full localization audit and final regressions, delivery docs,
merge and push. No full-delivery claim; goal remains active.

## Stage 7 in progress — Scenario Comparison

Uncommitted work now adds `scenario-zh-TW.ts` and `scenario-result.ts`, connects the scenario
screen to locale, and translates static controls/tables, strategies/presets, the seven basis
paragraphs, cost announcements, cache messages, salary notes, generated matrix labels, strategy
notes, conclusions and dominance prose. `localizeScenarioResult` clones display labels, preserving
library names verbatim. Engine/run keys unchanged. English source copy remains the default.

Gate `/tmp/zh-tw-check-21.log` passed **364/364**, typecheck/build green;
**846.17 kB / 275.26 kB gzip**, existing Vite advisory. This is interim evidence only.
No scenario browser verification yet and this stage is not delivered or committed.

Next work:
- Audit and finish dynamic library validation/import/migration errors and preset error prefixes;
  progress must translate authored suffixes while preserving user names.
- Preserve library notes in `localizeScenarioResult`, avoid translating arbitrary user-authored
  library names/notes (including names equal to catalog keys such as Cash/Baseline).
- Test actual matrix/spending/income/library results, including user-name collisions, numeric
  token equality and source-result immutability. Add scenario screen to static-source audit.
- Real Chrome 10,000-path matrix/spending/income/library verification including both worker smokes,
  switch during/after, cancel/stale/cache/preview, mobile and desktop. Do not edit repository files
  while harness runs. Ports 5183/9234 were left running but must be revalidated.
- Final full UI/catalog audit, existing English regressions, completion docs, commit/merge/push.

Working tree is authoritative; do not rerun the AST wrapping script on the already edited screen.
The broad replacement initially changed some React keys; those keys were restored to untranslated
values. ScenarioResult uses a pure display result helper so no lookup/calculation is added to JSX.

### Stage 7 follow-up (still incomplete)

Added known import/schema/preset error display templates, dedicated progress localization that
matches the case before translating its authored suffix, and preserves library labels and notes
verbatim. Static screen audit includes scenarios. Actual small-count engine tests cover all four
comparison modes, numeric tokens, result immutability, conclusion/dominance and user-name collisions.
Gate 23 passed **365/365** (after gate 22 caught one missing static title, now fixed).

Browser attempts (terminal; safe to edit):
- `browser-locale-scenario-ui.mjs` attempt 1 failed only on CSS-uppercase name assertion; fixed.
- Attempt 2 completed both 10,000-path worker smokes and launched full 60-cell 10,000-path matrix.
  Harness timed out after 20 minutes. A later read-only CDP check found the completed result.
- `/tmp/zh-tw-scenario-recovery.mjs` verified all 60 rows and exact English/Chinese numeric tokens;
  recorded 60,746 animation frames, maximum gap 300.1 ms. Wall time is not reliable for this
  recovered run; do not claim a performance pass. Actual screenshots saved matrix desktop/mobile.
- Recovery verified spending: 3 rows, 12.819 s, 770 frames, 16.8 ms max gap; income: 5 rows,
  20.913 s, 1,256 frames, 16.8 ms max gap. Cancel/stale assertions passed before these.
- Library run stopped on numeric-token ordering in cache prose (English 1 of 2, Chinese 2 then 1).
  Fixed translation to 1／2; engine figures unchanged. Added regression case. Gate 24 started as
  exec session 10842, log `/tmp/zh-tw-check-24.log`; revalidate its terminal status.

Browser logs `/tmp/zh-tw-browser-scenario-{1,2}.log` and
`/tmp/zh-tw-browser-scenario-recovery-1.log`. No complete scenario JSON evidence yet.
Next: finish successful browser run including library/cache/preview/migration/import, inspect
screenshots, address matrix performance evidence, complete final whole-UI audit and delivery docs.
No Scenario commit yet. Do not mark complete, merge or push before remaining acceptance work.

### Stage 7 verified

The complete rerun `/tmp/zh-tw-browser-scenario-3.log` passed (session 15982 terminal):
both worker smokes, 60-cell 10,000-path matrix **260.410 s / 15,626 frames / 33.4 ms**;
spending **13.213 s / 793 frames / 33.3 ms**; income **21.890 s / 1,314 frames / 16.8 ms**;
library **4.937 s / 297 frames / 16.8 ms**. All numeric tokens match between English and Chinese,
cancel/stale behavior passed, desktop/mobile overflow zero, no runtime exceptions.
`/tmp/zh-tw-scenario-ui-results.json` retains measurements. This replaces the unreliable recovered
matrix timing as acceptance evidence.

Final library rerun `/tmp/zh-tw-browser-final-library.log`: **4.736 s / 285 frames / 33.4 ms**,
cache, explicit preview, invalid-import rejection and schema-1 migration passed; user names retained.
The migration note now translates only for app-owned origins; custom notes remain literal. Actual
matrix and library mobile screenshots visually inspected. Progress uses a React-free count helper
and the correct scenario/path unit. Static AST coverage includes every rendered screen and shared
label/help/aria prop; technical identifiers/formula/bilingual language names are intentional.

Final gate `/tmp/zh-tw-check-28.log`: **368/368**, strict typecheck/build green;
**849.33 kB / 276.41 kB gzip**, existing Vite advisory. Final basic browser test passed, both
10,000-path smokes, default English, persisted Chinese, all eight tabs, edited-input preservation,
68.98% FIRE switching during/after, cancel/stale, zero mobile overflow/no exceptions.
Original English `browser-solver-ui.mjs` passed: curve **40.30 s**, age 50 **90.61%**, solver
**350.09 s**, confirmed **£87,600**, sensitivities, unsupported candidates, cancel/stale and all
four overflow checks zero. Original `browser-property-ui.mjs` passed: full run **4.82 s**,
293 frames/16.8 ms, paired comparison, cancellation, validation and zero overflow on property,
Overview and FIRE. Final batch session 7938 terminal. No browser job remains active.
