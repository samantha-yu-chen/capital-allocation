# Package 11 — English / Taiwan Traditional Chinese

## Delivered scope

English is the fresh-browser default. The visible English / 繁體中文 selector switches the complete
web application to Taiwan Traditional Chinese: all eight tabs, profile fields/help/validation,
onboarding and six starters, glossary, Learn, charts/accessible descriptions, progress, cancellation,
unsupported errors, completed engine results, uncertainty and explanatory copy. Browser preference
persists across reload; denied/unavailable storage safely falls back to English.

Independent catalogs live in `src/presentation/i18n/`. React subscribes to the locale context and
translates display copy at render time. Switching preserves mounted edits, running workers and
completed results. No domain, engine or tax configuration changed relative to baseline `01f2e84`.
Locale is not a profile field and does not enter run/cache keys. Currency stays GBP; existing money,
rate, real/nominal and age-boundary conventions remain authoritative.

Custom scenario names and notes remain literal, including names equal to authored English catalog
keys. Generated case labels and app-owned preset/migration notes translate separately. Raw profile,
metadata JSON keys, technical IDs, seeds and path indices are unchanged. A progress display issue
was corrected: completed scenarios now say scenarios, while simulation paths still say paths.

## Interfaces and maintenance

- `i18n/locale.ts`: `Locale = 'en' | 'zh-TW'`, `DEFAULT_LOCALE`, `LOCALE_STORAGE_KEY`, `message`,
  `translateText`, `readLocale`. Storage key: `capital-allocation:locale:v1`.
- `web/locale.tsx`: `LocaleProvider`, `useLocale`, `LanguagePicker`; provider wraps App without
  remounting it. `document.lang` follows the selection.
- Domain-specific Chinese catalogs and anchored dynamic templates preserve numeric values. Unknown
  copy stays literal; add catalog coverage when authoring new display text. English source copy
  remains the default. ID-based glossary/Learn catalogs preserve relationships and links.
- `i18n/scenario-result.ts`: pure display adapters preserve user data and original engine objects.
- `view/progress.ts`: `progressCountLine`, `ProgressUnit`; shared Progress accepts optional `unit`.
- Shared cards/fields translate authored string display props. Use a ReactNode for a literal
  user-authored value passed to a shared component that otherwise translates string notes.

Add new authored copy to the relevant catalog/template and update `tests/locale.test.ts`. Do not
translate IDs, stored user data, engine inputs or cache keys. Static AST coverage excludes the
unused planned-screen fallback and explicitly permits bilingual language names/technical formulas.

## Automated acceptance

Node 24 / npm, `npm run check`: **368/368 tests**, strict typecheck and production build passed;
`git diff --check` passed. Final code gate `/tmp/zh-tw-check-28.log`.
Main bundle **849.33 kB / 276.41 kB gzip**; the pre-existing Vite size advisory remains.

Locale tests cover default/storage errors, catalog parity, all field-help/glossary/Learn entries,
static copy across rendered screens, dynamic numeric tokens, actual engine outputs, immutability,
property/no-property attribution, library name collisions/custom notes and progress units.
Original reconciliation/tax/Monte Carlo/solver/property suites remain green.

## Real Chrome acceptance

All full runs retain **10,000 paths**. Explicit preview is separately requested and labelled.
No repository edits were made while browser harnesses ran. Isolated Chrome used APP_PORT=5183,
CDP_PORT=9234. Actual mobile result screenshots were visually inspected. Harnesses are manual,
intentionally outside `npm test`.

| Harness | Measured evidence |
| --- | --- |
| `browser-locale-ui.mjs` (final) | Both worker smokes equal local output and cancel correctly: baseline 68.98%, 4.227 s; property 35.18%, 4.645 s. Fresh English, persisted Chinese, eight tabs, edits retained, 68.98% FIRE switch during/after, cancel/stale, 0 px mobile overflow, no exceptions. |
| `browser-locale-solver-ui.mjs` | Real curve ages 45/46/47: 68.98/74.91/80.02%; salary £87,600, confirmed 90.02% ± 0.59%, excluded £87,500. Numeric equality across locales, cancellation/stale, 0 px mobile overflow. Curve maximum frame gap 16.8 ms; salary 24 candidates, 94.36 s, 16.8 ms gap. |
| `browser-locale-property-ui.mjs` | Six allocation destinations, actual pension 69.11%, ISA/GIA 69.05%, cash 69.04%; mortgage/deposit infeasible reasons translated. 10,000-pair buy 35.18% vs rent/invest 69.01%, mortgage-shortfall 33.23%/0.00%. Numeric equality, cancel/stale, 0 px mobile overflow; allocation max gap 16.8 ms, property 33.3 ms. |
| `browser-locale-attribution-ui.mjs` | 28 lever/sensitivity cases + 7 stresses, baseline desktop 91.672 s / 5,485 frames / 16.8 ms; property mobile 121.087 s / 7,250 frames / 16.8 ms. Every numeric token matches English, invalid age/cancel/stale, 0 overflow/no exceptions. |
| `browser-locale-scenario-ui.mjs` | Full 60-cell matrix 260.410 s / 15,626 frames / 33.4 ms max gap; spending 13.213 s / 3 rows; income 21.890 s / 5 rows; library 4.937 s / 2 rows. Both worker smokes, numeric equality in all four modes, switch during/after, cancel/stale, desktop/mobile 0 overflow/no exceptions. |
| `browser-locale-scenario-library-ui.mjs` (final) | Mobile 4.736 s / 285 frames / 33.4 ms; custom names, within-batch cache, explicit preview, invalid-import rejection, schema-1 migration. 0 overflow/no exceptions. |
| Original `browser-solver-ui.mjs` (English) | Passed; nine-age curve 40.30 s, age 50 success 90.61%; four-search solver 350.09 s, confirmed £87,600, sensitivities/unsupported candidates, cancellation/stale and all four overflow checks 0. |
| Original `browser-property-ui.mjs` (English) | Passed; full property run 4.82 s / 293 frames / 16.8 ms; paired comparison, validation/cancellation, property/Overview/FIRE mobile overflow 0. |

Commands (run sequentially against the same isolated browser):

```sh
APP_PORT=5183 CDP_PORT=9234 node tests/browser-locale-ui.mjs
APP_PORT=5183 CDP_PORT=9234 node tests/browser-locale-solver-ui.mjs
APP_PORT=5183 CDP_PORT=9234 node tests/browser-locale-property-ui.mjs
APP_PORT=5183 CDP_PORT=9234 node tests/browser-locale-attribution-ui.mjs
APP_PORT=5183 CDP_PORT=9234 node tests/browser-locale-scenario-ui.mjs
APP_PORT=5183 CDP_PORT=9234 node tests/browser-locale-scenario-library-ui.mjs
# Select English before the original English-only regression harnesses:
APP_PORT=5183 CDP_PORT=9234 node tests/browser-solver-ui.mjs
APP_PORT=5183 CDP_PORT=9234 node tests/browser-property-ui.mjs
```

Detailed chronological logs and repaired harness assumptions are in `zh-tw-checkpoint.md`.
The first scenario matrix attempt timed out; a completed-result recovery had unreliable wall time.
Acceptance uses the successful complete rerun above, not that recovery.

## Limitations and next assignment

V0.3 modelling/tax limitations from chunk 10 remain unchanged. This is a language preference, not
localization of the financial jurisdiction, GBP currency or raw reproducibility formats. Custom
user text is not machine-translated. The existing bundle-size advisory is not a build failure.

No required localization work remains. Commit/merge hashes and push status are reported at delivery.
The primary checkout stays on `main`; after the merge is pushed to `origin/main`, the human must run
`git pull --ff-only` there, per repository convention. The pre-existing untracked `.claude/` tree
was not modified. No hosted deployment verification is claimed by this local acceptance.

Paste-ready next assignment:

> Pull origin/main with `git pull --ff-only` in the primary checkout. Read this handoff and the
> original chunk-10 modelling limits before any follow-up work. English / 繁體中文 localization is
> delivered; preserve locale-independent run keys, user-authored scenario data and numeric tokens.
> If requesting a new feature, specify its scope rather than treating an engine limitation as a
> translation defect. Hosted deployment verification can be a separate assignment if desired.
