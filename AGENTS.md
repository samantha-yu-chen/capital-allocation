# Working agreement for coding agents

This file is the canonical instruction set for any agent working in this repository, whichever tool
it runs under. `CLAUDE.md` carries the same rules in short form plus a few Claude Code specifics.
Keep the two consistent: put durable, tool-independent rules **here**.

The product authority is
[`docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md`](docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md).
This file describes how to work, not what to model.

## Read before you start

1. `docs/implementation-work-packages.md` — the numbered packages, their scope and who owns what.
2. The most recent `docs/handoffs/chunk-N.md` — it contains the paste-ready assignment for the next
   package, the interfaces you inherit and the limitations you must not silently drop.
3. `docs/architecture-decisions.md` — units, lifecycle timing, event order, ownership boundaries.
4. `docs/requirements-checklist.md` — what is genuinely done and what the evidence is.
5. `docs/property-model.md` and `docs/tax-rules-2026-27.md` when touching property or tax.

Do not start a package before reading its handoff. Do not treat an interface, a prototype output or
a placeholder as delivered functionality.

## Commands

Node 24 with npm (see `.nvmrc`). No API keys, servers or external services are required.

| Command | What it does |
| --- | --- |
| `npm ci` | Install from the lockfile |
| `npm run check` | **The gate.** Strict typecheck, the full test suite, then the production build |
| `npm test` | Compiles to `build/` and runs `node --test build/tests/*.test.js` |
| `npm run typecheck` / `npm run build` | The individual parts of `check` |
| `npm run dev -- --port 5176 --strictPort` | Serves the app, plus `/tests/browser-worker-smoke.html` |
| `npm run ledger` / `npm run monte-carlo` / `npm run demo` | CLI harnesses that print real engine output |

`npm run check` must be green before you commit anything you intend to merge. `build/` and `dist/`
are generated and git-ignored.

## Layout

| Path | Contents |
| --- | --- |
| `src/domain/` | `contracts.ts` (the Zod profile schema — the single validation authority), the tax engine, fixtures |
| `src/config/tax/` | Versioned, effective-dated tax rules |
| `src/engine/` | Deterministic ledger, property, `monte-carlo/`, the reverse solvers, the FIRE age curve, and the browser workers that drive them |
| `src/presentation/view/` | React-free view models. **All testable presentation logic lives here** |
| `src/presentation/web/` | React screens on the Organic design system from `design/` |
| `src/presentation/cli/` | Node harnesses |
| `tests/` | `node:test` suites. `*.test.ts` run under `npm test`; `browser-*.mjs` and `browser-worker-smoke.html` are manual Chrome/CDP checks and are deliberately **not** part of `npm test` |

## Conventions that must not break

These are load-bearing. Breaking one silently invalidates results that look fine on screen.

- **Money and units.** GBP in `number`, rates as fractions, no rounding inside engines. Values are
  nominal inside the ledger and real (today's money) in Monte Carlo and view results. Never deflate
  a real figure a second time. Formatting belongs only in `src/presentation/view/format.ts`.
- **Timing.** Projected year `t` covers `[age, age+1)`. The first wealth point is the opening
  balance at the current age; every later point is a closing age boundary.
- **Event order.** ADR 002's per-year order is fixed. Do not reorder it, and do not let a later
  market return erase a funding failure already recorded.
- **Reconciliation.** Per-account and aggregate identities are asserted across the whole horizon.
  Do not weaken an identity to make a change pass.
- **Fixed spending policy.** Floor, target and comfort are separate runs. There are no dynamic
  in-run spending cuts.
- **Path count.** Never reduce `simulation.count` to make something finish sooner. If an analysis is
  expensive, say so before running it and let the user lower the count.
- **Common paths.** Seeds and path indices depend on the seed and absolute path index only, never on
  scenario decisions. Any comparison between plans must reuse matching paths, and should assert it
  rather than trust it. Leave `LedgerOptions.rentInvestment` null outside the property comparison.
- **Validation.** `profileSchema` is the only authority. An unparseable input becomes `NaN` and
  fails validation; it must never fall back to a previous value or reach an engine.
- **React.** No calculations in components. Numeric inputs are described in the field registry
  (`src/presentation/view/fields.ts`), not inline.
- **The eight tabs.** All eight reference destinations stay reachable. An unbuilt one names its
  owning package and renders no illustrative figure that could be mistaken for a result.
- **Honest failure.** Cancelled or failed runs publish nothing — no partial result, no cached
  number standing in for a real one. Unsupported cases (for example a pension contribution above the
  available annual allowance, which throws `PensionLimitError`) are reported as unsupported, not as
  a plan that failed to fund itself.
- **Uncertainty.** A sampled probability carries a standard error. Do not present a difference
  smaller than that error as a finding.

## Definition of done for a package

1. `npm run check` green, with new tests that would fail without your change.
2. Real-browser verification in Chrome where the package touches a screen: run both worker smoke
   variants, exercise the new screen with actual results, and confirm progress, cancellation,
   stale-result invalidation and responsive 10,000-path work at desktop and mobile widths. The
   checked-in harnesses (`tests/browser-solver-ui.mjs`, `tests/browser-property-ui.mjs`) are
   regressions; both accept `APP_PORT` / `CDP_PORT`.
3. `docs/requirements-checklist.md` updated with evidence, not adjectives.
4. The package marked delivered in `docs/implementation-work-packages.md`.
5. A new `docs/handoffs/chunk-N.md` recording delivered scope, changed public interfaces, commands
   and measured results, explicit limitations, and a paste-ready assignment for the next package.
6. Commit and merge hashes and push status reported.

If work is interrupted, leave an accurate checkpoint. Never mark incomplete work done.

## Git and worktrees

- Work on a branch in a separate git worktree so parallel sessions cannot collide.
- Commit in understandable stages with messages that explain the decision, not the diff.
- Merge to `main` and push. No PR is required for a package.
- Never force-push and never rewrite published history.
- **The primary checkout stays on `main`.** A branch can only be checked out in one worktree, so a
  worktree session cannot move the local `main` ref. The convention is: build the merge commit and
  push it to `origin/main`, then the human runs `git pull --ff-only` in the primary checkout. Say so
  in the delivery report; do not leave the primary working tree in a stale state to avoid the step.

## Local environment notes

Node may not be on `PATH` in a fresh shell on the development machine. A local install has been used
at `/tmp/node-v24.21.0-darwin-arm64/bin` — prepend it to `PATH` if it is still present, otherwise
install Node 24 normally.

Browser verification uses an isolated headless Chrome, so it cannot disturb a browser the human is
using:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9226 --user-data-dir=/tmp/capital-chunk-chrome about:blank
```

Do not edit application source while a browser harness runs: a Vite reload resets the deliberately
in-memory profile.
