# Deployment (Vercel)

The app is a static Vite build. Vercel serves the files in `dist/` and nothing else: there is no
server, no API route and no database in this project, and hosting adds none. Every engine still runs
in the visitor's own browser, in the same workers the local dev server uses.

## What the hosted build does and does not change

- **Calculations.** Unchanged. The ledger, Monte Carlo, solvers and comparisons run in browser
  workers on the visitor's machine. Nothing is sent to Vercel beyond the request for the static
  files, and no figure is computed anywhere but the visitor's browser.
- **Saved scenarios.** Still local storage, and local storage is per origin. The scenario library
  saved on the hosted origin is a different library from the one saved at `http://127.0.0.1:5177`.
  Neither is a backup of the other; the versioned JSON export is still the only way to move one.
- **Path counts and cost.** Unchanged, and still the visitor's CPU. A full-count reverse solve or
  the 5 × 3 × 4 matrix takes minutes on a hosted build exactly as it does locally, and a phone is
  slower than a laptop. Nothing lowers a path count because the app is hosted.
- **Verification.** The manual Chrome harnesses in `tests/` and
  `/tests/browser-worker-smoke.html` are served by the Vite dev server and are **not** part of
  `dist`. They cannot be pointed at the hosted app. A deployment is not evidence for the definition
  of done in [`AGENTS.md`](../AGENTS.md); `npm run check` and the local harnesses still are.

## Project settings

[`vercel.json`](../vercel.json) at the repository root is the authority for the build. It pins:

| Setting | Value |
| --- | --- |
| Framework preset | `vite` |
| Install command | `npm ci` (lockfile only, like CI) |
| Build command | `npm run build` (strict `tsc -p tsconfig.build.json`, then `vite build`) |
| Output directory | `dist` |

The build therefore fails on a type error rather than shipping one. Node 24 comes from
`engines.node` in `package.json`; keep the Vercel project's Node version on 24.x so the hosted build
matches `.nvmrc`. Do not re-enter these commands in the Vercel dashboard — dashboard overrides win
over the file and the two then drift silently.

`vercel.json` also sets cache headers: the content-hashed files under `/assets/` (including the four
worker bundles) are immutable for a year, and `/` must revalidate, so a new deployment is picked up
on the next load instead of serving a stale shell against fresh workers.

## Deploying

With the Vercel Git integration connected to `samantha-yu-chen/capital-allocation`, a push to `main`
is a production deployment and any other branch is a preview. Without it, deploy from a clean
checkout with the CLI:

```sh
npx vercel --prod
```

Run `npm run check` first. The Vercel build repeats the typecheck and the build, but not the tests.

## Access

Production is currently behind Vercel Authentication, so opening the URL prompts for a Vercel login
and only members of the account can see the app. To publish it to anyone with the link, turn that
off in the Vercel project: **Settings → Deployment Protection → Vercel Authentication**, or set it
to protect preview deployments only.

Nothing in the app needs an account, an API key or a backend, so a public deployment exposes no
credential. It does expose the model itself, and the limitations in
[`docs/requirements-checklist.md`](requirements-checklist.md) and the handoffs apply to a visitor who
never reads them: this is annual decision-support modelling for a UK resident under 2026/27 Scotland
and rest-of-UK rules, not advice, not a guarantee, and not a tax return.
