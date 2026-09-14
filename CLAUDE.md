# CLAUDE.md

[`AGENTS.md`](AGENTS.md) is the canonical working agreement for this repository — read it before
starting a package. It covers the reading order, the layout, the conventions that must not break and
the definition of done. This file repeats only the rules you need constantly, plus the parts that
are specific to Claude Code.

## Before you start a package

Read `docs/implementation-work-packages.md`, then the most recent `docs/handoffs/chunk-N.md` — it
contains the paste-ready assignment for the next package and the interfaces you inherit. An
interface, a prototype output or a placeholder is not delivered functionality.

## Commands

Node 24. `npm run check` (strict typecheck → full test suite → production build) is the gate and
must be green before you commit work you intend to merge. `npm run dev -- --port 5176 --strictPort`
serves the app and the worker smoke page at `/tests/browser-worker-smoke.html`. Node may not be on
`PATH`; a local install has been used at `/tmp/node-v24.21.0-darwin-arm64/bin`.

## The short list of things that silently invalidate results

- Money is nominal in the ledger and real in Monte Carlo and view results. Never deflate twice.
- Projected year `t` covers `[age, age+1)`. ADR 002's event order is fixed.
- Never weaken a reconciliation identity, add a dynamic in-run spending cut, or reduce
  `simulation.count` to make something finish sooner.
- Comparisons reuse matching seeds and path indices, and assert it rather than trusting it. Leave
  `rentInvestment` null outside the property comparison.
- `profileSchema` is the only validation authority; invalid input must never reach an engine.
- Calculations stay out of React; testable presentation logic lives in `src/presentation/view/` and
  numeric inputs are described in the field registry.
- All eight tabs stay reachable, and an unbuilt one renders no figure that could pass for a result.
- Cancelled or failed runs publish nothing. Unsupported cases are reported as unsupported, not as
  plan failures.

## Git, worktrees and delivery

Work on a branch in a separate worktree, commit in understandable stages, merge to `main` and push.
No PR is required. Never force-push.

The primary checkout stays on `main`, and a branch can only be checked out in one worktree, so a
worktree session **cannot** move the local `main` ref — and a background session is additionally
blocked from running git against the shared checkout. The convention is therefore:

1. Build the merge commit against `origin/main` (`git commit-tree <tree> -p origin/main -p HEAD`).
2. Push it: `git push origin <merge>:refs/heads/main`.
3. Tell the user to run `git pull --ff-only` in the primary checkout, and say why.

Do not fast-forward the local `main` ref from a worktree while it is checked out elsewhere: it moves
HEAD without touching that working tree, so every new file shows up as deleted.

Finish by reporting commit and merge hashes, push status, and anything the user still has to do.

## Verification before you call a package done

`npm run check` green with tests that would fail without your change; real Chrome verification for
anything touching a screen (both worker smoke variants, the new screen with actual results,
progress, cancellation, stale-result invalidation, desktop and mobile widths); then update
`docs/requirements-checklist.md`, mark the package delivered in
`docs/implementation-work-packages.md`, and write `docs/handoffs/chunk-N.md`.
