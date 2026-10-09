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
