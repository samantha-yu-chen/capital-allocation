# Chunk 3 handoff — reproducible Monte Carlo and FIRE analysis

Package 3 is implemented on top of the unchanged chunk-2 ledger. No accounting or tax formulas were duplicated; no `design/` calculations are imported. Core commits: `fa033c1` (generator/statistics), `ab25812` (aggregation/workers/tests). The default example still requests 10,000 paths.

## Delivered APIs

- `src/engine/monte-carlo/index.ts` (also exported from `src/engine/index.ts`): `ParametricReturnGenerator`, `runMonteCarlo`, `simulateBatch`, `distribution`, `sequenceObservation`, result/control types, and `monteCarloMetadataSchema`.
- `src/engine/monte-carlo/node.ts`: `runMonteCarloNode` uses a reusable Node worker pool. Import this entry only in Node.
- `src/engine/monte-carlo/browser.ts`: `runMonteCarloBrowser` creates a coordinator worker, which shards ledger batches among module workers. Aggregation and percentile sorting also stay off the UI thread. This entry is for Vite/browser consumers.
- `npm run monte-carlo` runs the complete 10,000-path example and prints real wealth, probabilities, sequence metrics, versions and measured runtime. `npm run monte-carlo -- 1000 2` explicitly selects 1,000 paths and two workers.

```ts
import { createExampleProfile } from './src/domain/fixtures.js';
import { runMonteCarloBrowser } from './src/engine/monte-carlo/browser.js';

const profile = createExampleProfile();
const controller = new AbortController();
const result = await runMonteCarloBrowser(profile, {
  signal: controller.signal,
  concurrency: 4,                   // default min(4, available cores)
  batchSize: 100,                    // execution granularity only
  onProgress: ({ completed, total }) => { /* update progress */ },
  ledgerOptions: { retirementLevel: 'target' },
});
// controller.abort() cancels; promise rejects with name === 'AbortError'.
```

The count and seed come from `profile.simulation`. Local `runMonteCarlo` defaults to concurrency 1 and yields between batches; browser callers should use the worker entry. Both accept resolved chunk-2 options, including `monthlyHouseholdOverride` for low/base/high spending comparisons. Floor, target and comfort are independent fixed-spending runs.

`runMonteCarlo` accepts a custom `ReturnGenerator`, or a transport-level `executeBatch(request, signal)` plus concurrency. Custom generators used with workers must be installed inside that executor; supplying both generator and executor rejects. A batch uses absolute path indices `[start, start + count)` and returns compact path summaries, not full ledgers. Inspect an individual path by regenerating its seed/index and calling `runProjection`.

Input profiles and ledger options are validated/snapshotted before asynchronous work. Errors (including property and pension-limit errors) propagate instead of being classified as sampled plan failures. Cancellation rejects rather than reporting a partial probability. Path counts are never silently reduced. Completed batches aggregate in absolute path-index order, so batch size, scheduling and core count do not change numeric results.

## Distribution and reproducibility assumptions

Generator version: `lognormal-mulberry32-boxmuller-v1`.

For each variable, configured mean `m` and volatility `v` are the **arithmetic annual nominal return mean and standard deviation**. Inflation uses the same convention for its annual rate. Sample gross growth as:

```
sigma² = log(1 + (v / (1 + m))²)
mu = log(1 + m) - sigma²/2
return = exp(mu + sigma * Z) - 1
```

This matches the configured arithmetic moments while keeping gross growth positive. Zero volatility returns the configured mean directly, with exact equality to the deterministic path's annual values. There is no clipping, return floor, or rejection/resampling that shifts moments. Unrepresentable numerical results reject explicitly.

The 5×5 matrix describes **Gaussian log-growth shocks**, in order equities, bonds, cash, property, inflation. It is not the Pearson correlation of arithmetic returns. For nonzero log volatilities, the implied arithmetic correlation is:

```
(expm1(rho * sigma_i * sigma_j)) /
  sqrt(expm1(sigma_i²) * expm1(sigma_j²))
```

The distinction must be labelled in UI assumptions. Symmetry, unit diagonal and positive semidefiniteness are checked; singular/perfect correlation is supported. Configured correlations involving a zero-volatility series have no observable effect on that series. Cross-year draws are independent: no serial correlation, regimes, historical bootstrap, fat-tail calibration or stochastic employment.

A hashed seed/path index initializes a Mulberry32 stream. Box–Muller generates five normal shocks each year, including when some volatilities are zero. Scenario decisions, salary, FIRE age, spending and wrapper allocations never enter the seed. Longer horizons preserve path prefixes. Matching ages across comparisons assumes the same starting age; changing current age reanchors year zero. Changed market moments reuse standardized shocks, but changed correlations necessarily change their transformation.

The ledger handles wrapper weights, path-by-path inflation compounding, salary growth and constant-real tax-band scaling. Opening index is 1. Never pre-average inflation. The example has zero inflation volatility by choice; stochastic inflation is supported and tested.

Metadata extends the shared base without changing `src/domain/contracts.ts`: full validated profile (including portfolios/property/market/count/seed), ledger engine version, simulation version, generator version, tax and market versions, resolved ledger options, tax policy, event order, absolute path range, money basis, age timing and quantile convention. Use `monteCarloMetadataSchema` for the extended object; the old strict base schema deliberately does not accept new fields. Same inputs reproduce exactly in the tested Node runtime; cross-runtime transcendental math can vary in last bits. Do not add timestamps or execution order to deterministic result equality.

## Outputs and interpretation

- Success reuses `projection.success`. Bridge and depletion use distinct paths containing the corresponding ledger failure code. All observed failure-code probabilities are included and can overlap; do not sum them as mutually exclusive causes.
- `terminalWealth` includes mean, P10/P25/median/P75/P90 and worst observed terminal net worth. `fireCapital` reports the same statistics for real opening investable wealth at FIRE, including pension capital.
- Quantiles linearly interpolate at `(n-1)p`. Worst observed is the sample minimum, not a guaranteed downside bound.
- `wealthByAge` includes the opening current-age balance then every closing age boundary through end age. A ledger row `[age, age+1)` appears at `age+1`, deflated by `closingInflationIndex`. Pension includes workplace pension plus SIPP; liquid is cash + ISA + GIA, matching the ledger. `locked` mirrors the ledger's pension-category metric, even after access age; it does not imply the pension remains legally inaccessible. Property equity is zero until chunk 5.
- First-five-FIRE-year drawdown: any real financial portfolio closing value more than 20% below its running peak, initialized at opening FIRE. It includes spending, tax and contribution effects, not just market returns.
- Low liquidity: opening or closing cash+ISA+GIA below two times that year's total required real spending in those first five years. It does not add pension balances after pension access.
- Recovery: years from the first >20% drawdown observation to a subsequent closing value reaching its pre-drawdown real peak, followed through terminal age. The median is **conditional on observed recovery**. Report recovered and unrecovered path counts alongside it; null means no observed recoveries. Horizons shorter than five years report their actual evaluated years.
- Diagnostic flags: any equity return below -20% in the first five FIRE years; or geometric annual inflation above 5% over that window. Conditional failure rates with/without each flag are associations, not proof of causes. Missing groups return null. No invented “excess spending” or “insufficient saving” causal decomposition is supplied; intervention-based sensitivity remains chunk 9.

## Verification and measured benchmark

`npm run check`: **113 tests pass**, zero failures; strict typecheck and production build pass on Node 24.21.0. This includes all 92 prior tests plus 21 new ones. A fresh tracked-file export of commit `4befbc8`, with an independent offline `npm ci`, also passed all 113 tests and the full check; no untracked files or shared node_modules were required.

New coverage: 100,000-draw moment tests for all five variables (0.003 absolute tolerance, >6 standard errors for tested moments); log-growth correlation test (0.012 tolerance); singular/invalid matrices; seed and horizon-prefix stability; zero-volatility path and complete ledger equality; known quantiles; real age-level aggregation; golden C/D/E probabilities; both spending effects across common paths; floor/comfort; metadata replay; caller-mutation isolation; custom generators/inflation/wrapper weights; path validation; repeated failures; sequence ordering/drawdown/recovery/censoring; progress; worker cancellation/errors; bit-identical local/out-of-order/Node-worker results. Vite builds both the browser coordinator and its nested workers in an automated test.

Measured 10,000 paths × 64 years, seed 421337, section-79 profile, four reusable workers, batches of 100, Apple M5 Pro (15 available cores), Node v24.21.0:

| Measurement | Result |
| --- | --- |
| End-to-end simulation call (startup, paths, ledgers, transport, aggregation) | **5.949 seconds** |
| Success probability | 68.98% |
| Bridge failure probability | 0.32% |
| Depletion probability | 31.02% |
| Median terminal wealth, today's GBP | £645,335.75 |
| Mean terminal wealth, today's GBP | £2,041,887.97 |
| P10 / P90 terminal wealth | £0 / £5,659,990.35 |
| Median opening FIRE capital | £718,788.14 |
| First-five-year >20% drawdown probability | 42.99% |
| Recovered / unrecovered triggered paths | 2,074 / 2,225 |
| Median recovery, conditional on recovery | 7 years |

Timing excludes TypeScript compilation and console output. No solver settings were relaxed (`1e-6`, 60 iterations), and all 10,000 requested paths completed. This is a sampled model result, not a forecast or a guarantee.

Browser runtime verification is **not claimed**: no browser was connected to the available computer-use tool. `tests/browser-worker-smoke.html`, served at `/tests/browser-worker-smoke.html` by `npm run dev`, checks browser/local equality, cancellation, a full 10,000-path run and a UI-thread timer. Run it in chunk 4, then verify actual application controls remain responsive; bundle compilation alone is not that evidence.

## Boundaries and remaining work

Property still throws `UnsupportedProfileError`. Pension annual-allowance excess still throws. No dynamic spending cuts, new tax rules, property integration, solver, FIRE-age curve or allocation optimiser was added. Existing tax/ledger limitations remain in the chunk-1 and chunk-2 handoffs. The browser application is still the foundation screen; no mock simulation charts were substituted.

Exact percentiles retain compact per-path/per-age numeric samples, so memory grows with count × horizon. The 1,000,000-count schema ceiling is not a promise of practical browser memory capacity. There is no cache or approximation, and no automatic count reduction. Local/Node final aggregation is synchronous; browser coordination moves it off the UI thread. Runtime cancellation cannot interrupt a synchronous local batch until it yields; worker cancellation terminates workers.

## Chunk 4 — paste-ready assignment

Implement package 4: the working application shell, Overview, and FIRE & Monte Carlo screens.

Check branch, working tree and origin/main first; preserve all existing changes. Create a branch in a separate worktree, commit in understandable stages, then merge back to main and push yourself. No PR required. Chunks 1–3 are complete; use the latest main containing this handoff.

Read in order:
1. `docs/handoffs/chunk-3.md` (APIs, assumptions, output timing and browser verification gap).
2. `docs/implementation-work-packages.md`, package 4.
3. `docs/architecture-decisions.md` and `docs/handoffs/chunk-2.md`.
4. The authoritative V0.3 spec, especially sections 78–80 and relevant input/output requirements.
5. `design/Web page UI specification/Lifetime Capital Allocation & FIRE Model.dc.html` and its Organic design tokens.
6. `src/domain/contracts.ts`, `src/domain/fixtures.ts`, `src/engine/index.ts`, `src/engine/monte-carlo/browser.ts`, and the current web scaffold.

Build real editable profile forms and the Overview/FIRE screens using the reference design. Preserve all eight tabs: Overview; FIRE & Monte Carlo; FIRE Age Curve; Marginal Allocation; Reverse Solver; Scenario Comparison; Property & Leverage; Where It Comes From. Identify unfinished tabs clearly. Do not import the prototype's approximate calculations.

Overview must use the real tax/ledger APIs for cash flow, distinct liquid/pension/net-worth metrics, reference FIRE target and a browsable annual ledger. FIRE & Monte Carlo must call `runMonteCarloBrowser`, show progress/cancellation/errors, and invalidate/abort stale results whenever inputs or simulation settings change. Keep 10,000 paths as the configurable default; never silently reduce count to meet a timing budget.

Show actual success, bridge/depletion and observed-failure probabilities; median/mean/P10/P25/P75/P90/worst observed terminal wealth; opening FIRE capital; age-level real wealth distributions; sequence drawdown, low liquidity and recovery statistics with censor counts. Label diagnostic crash/inflation associations as noncausal. Label the market matrix as log-growth-shock correlation. Preserve the handoff's age-boundary and inflation conventions; do not deflate outputs already in today's money. Reference FIRE arithmetic is not the safety result.

Use runtime validation, accessible labels/keyboard behaviour, desktop/mobile layouts, useful error states, and clear unsupported-property handling. No accounting rewrites, dynamic spending cuts, property integration or fake results for later tabs. Shared interface changes require explanation and updated consumers/tests.

Start browser verification with `/tests/browser-worker-smoke.html` under `npm run dev`. Then verify a real 10,000-path UI run stays responsive, cancellation works during computation, edits invalidate stale results, and invalid inputs do not enter the engine. Run `npm run check` (currently 113 tests), add meaningful UI/integration checks, inspect desktop/mobile screens, update `docs/requirements-checklist.md`, and write `docs/handoffs/chunk-4.md` with delivered scope, verification, limitations and chunk-5 instructions. Report commit/merge hashes and push status. If interrupted, leave an accurate checkpoint; never mark unfinished work complete.
