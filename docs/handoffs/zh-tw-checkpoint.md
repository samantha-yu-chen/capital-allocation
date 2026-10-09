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
