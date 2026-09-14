# Chunk 7 handoff — marginal lifetime capital allocation

Package 7 is implemented and verified. The final documentation commit and merge hashes are reported
with delivery; this file does not try to contain its own commit hash.

Worktree: `/tmp/capital-chunk-7`, branch `worktree-chunk-7-marginal`, baseline
`9bc4fd5` from freshly fetched `origin/main`. The primary checkout remains on `main`; its existing
untracked `.claude/` was preserved. Implementation commits:

- `39e8659` — exact one-off funding, full-path comparison, constrained objective and independent tests.
- `9ed7a38` — Marginal Allocation screen, coordinator worker and desktop/mobile acceptance harness.

- `dc95997` — immutable input metadata, finite zero-spending liquidity margins and recurring-reserve treatment of voluntary mortgage principal.

The documentation/acceptance commit and merge are reported with delivery.

## Implemented scope

`compareMarginal` runs the entered baseline and pension, ISA, GIA, cash, mortgage-overpayment and
property-deposit alternatives. Every supported candidate uses the complete annual ledger and all
configured Monte Carlo paths. Invalid destinations carry reasons and no invented result. Existing
cash is transferred from the entered opening cash balance; extra gross earnings are a one-off
non-pensionable bonus, not a recurring salary increase or free after-tax opening asset.

- Gross-funded pension uses the selected workplace method, remaining contractual employer match,
  base employer pension and employer NI shareback. Existing cash uses additional RAS, no employer
  match, with provider and additional relief claimed and recycled in the same annual settlement.
- Funding uses exact annual income-tax/NI/pension APIs, including investment income, rental profit
  and the capped residential finance reduction. It solves the contribution whose settled net cost
  uses the entire budget; allowance/member-eligibility/earnings limits reject the full option rather
  than silently capping it. Ordinary payroll contributions stay unchanged in subsequent years.
- ISA subscriptions use remaining annual capacity before the ordinary surplus allocation. GIA
  transfers increase actual cost basis, and future dividends, turnover and disposals use the real
  tax engine. Cash has its own returns and tax on every lifetime path.
- Mortgage overpayment reduces actual existing principal and recasts payments over the remaining
  original term. Deposits increase the configured planned purchase deposit at unchanged price and
  costs, reducing its borrowing; future deposits remain cash until acquisition. No property is
  invented when none is configured. Full purchase funding failures remain persistent ledger failures.
- Every account and aggregate financial/net-worth identity is retained over the whole horizon.
  Top-level event order, nominal ledger/real output convention, spending policy and pension access
  rules are unchanged. Mortgage closing balances use the existing sub-nanopound zero normalisation
  to avoid treating floating-point payoff residue as negative debt.

## Objective and uncertainty

The objective is the equal-weight mean of real after-tax usable financial wealth at target FIRE age,
pension access age (when in the horizon) and terminal age, with duplicate ages removed. A snapshot
values liquidation in one tax year with no employment/contributions and the configured other/state
pension income. GIA uses actual basis/losses, pension uses remaining lump-sum allowance and income
tax, and locked pension is excluded before access. Unsold property equity is excluded from usable
wealth. Mortgage debt is separately reported and constrained, not counted as accessible capital.

A rank is available only when the candidate's 95% probability lower bound clears the target,
minimum liquid years and cash reserve hold at every sampled closing boundary, and maximum real debt
stays below the explicit request ceiling. These conservative sampled constraints can leave all
options unranked; the screen then explicitly declines to recommend a destination.

Each option reports probability and its standard error, paired probability/mean-objective changes
and their errors, mean/median/P10/worst terminal wealth, lifetime real tax, maximum debt and target-age
usable/accessible/net wealth and debt. Samples are paired by absolute path index, with metadata and
sample assertions. Differences within paired uncertainty share a rank. Dominance additionally
requires a material probability advantage and no worse downside, accessible wealth or debt;
otherwise the classification is near equivalent, assumption sensitive or inferior as supported by
the comparisons. Sensitivity wording explains conditional tax, bridge, return and mortgage tradeoffs;
it does not claim that additional sensitivity scenarios were simulated.

## APIs and integration

- `src/engine/marginal-funding.ts`: `MarginalAction`, schema, `marginalFunding`,
  `MarginalInfeasibleError`. The funding audit includes tax-basis crossings derived from configuration.
- `src/engine/marginal.ts`: `compareMarginal`, `MarginalRequest`, `MarginalResult`,
  `MarginalProgress`, `assertMarginalPaths`, `taxBoundaries`. The `EvaluateProfile` transport seam
  remains compatible with the solver. Requests specify `amount`, `basis`, `maximumDebt` and optional
  ledger options; incoming `marginalAction` and `rentInvestment` must be null.
- `LedgerOptions` adds `marginalAction` (default null) and `measureAllocation` (default false).
  All options, including these additions, are included in simulation metadata and run keys. Marginal metadata snapshots the validated profile/request plus generator, tax and engine versions.
  `LedgerYearDetail.marginalFunding` is null except for the action's first-year funding audit.
  `mortgageOverpayment` separately identifies voluntary principal so it is excluded from recurring
  emergency-reserve/sequence-liquidity requirements, while remaining in funded principal identities.
- Pension tax inputs add `additionalWorkplaceGross` (default zero). Existing inputs retain their
  previous results. `rentalFinanceReduction` is shared by the ledger and marginal funding, using
  the tax configuration's UK basic rate.
- `src/engine/allocation-metrics.ts`: pure snapshot valuation and compact allocation-path audit.
  `MonteCarloResult.allocationSamples` is present only with `measureAllocation: true`; ordinary
  simulations retain their previous output shape and avoid valuation work. The marginal public
  result aggregates the samples and does not retain the full path array for each candidate.
- Engine version: `deterministic-ledger-v3-marginal-property-residential-2026-27-v1`.
  Generator, seed and path-index conventions are unchanged.
- `analysis-browser.ts` / `analysis.worker.ts`: `compareMarginalBrowser` and new marginal request,
  progress and completion messages. The coordinator drives the existing worker pool. Progress and
  complete aggregation stay off the main thread; cancellation terminates the coordinator and
  publishes no partial ranking.
- `src/presentation/view/marginal-model.ts`: controls-to-request validation, work announcement,
  formatting, ranking conclusion and comparison explanations. Numeric controls are in `fields.ts`.
  React renders these and uses `useAnalysis` for cancellation, errors and stale-input invalidation.
  All eight tabs remain reachable; only Marginal Allocation changes status in this package.

## Validation checkpoint

`npm run check`: 208 tests, zero failures; strict typecheck and production build pass on Node 24.21.0.
`git diff --check` passes. New independent tests cover two-slice UK tax/NI, RAS relief recycling,
workplace methods, employer match/shareback, PA taper, member age/earnings/MPAA/annual allowance,
ISA/cash/property capacity, reserve rejection, all six destinations' lifetime reconciliation,
one-off funding, locked-pension bridge failure, identical common-path replay/direct Monte Carlo,
cancellation after real progress, current mortgage/future deposit, rental finance relief,
GIA basis/pension-access snapshot valuation, constraints and equivalent-wrapper classification.
Zero-essential-spending plans use a finite real liquidity margin rather than an infinite ratio;
request/profile snapshots remain accurate even when a caller edits its inputs during a run.
Voluntary overpayment is independently asserted not to enlarge recurring reserve requirements.
Presentation tests cover invalid drafts, full-count cost announcement, funding-basis keys, all six
rows, sampling uncertainty and explicit no-recommendation output.

Browser commands (isolated Chrome must already be running):

```sh
npm ci
npm run check
npm run dev -- --port 5177 --strictPort
APP_PORT=5177 CDP_PORT=9227 node tests/browser-marginal-ui.mjs
APP_PORT=5177 CDP_PORT=9227 node tests/browser-property-ui.mjs
APP_PORT=5177 CDP_PORT=9227 node tests/browser-solver-ui.mjs
```

### Real Chrome evidence

Final `tests/browser-marginal-ui.mjs` run, isolated Chrome on ports 5177/9227:

| Check | Measured result |
| --- | --- |
| Baseline worker smoke | 10,000 paths; 68.98%; 4.30 s; 441 UI timer ticks; browser/local byte equality and cancellation pass |
| Property worker smoke | 10,000 paths; 35.18%; 4.72 s; 483 ticks; equality and cancellation pass |
| Marginal, £1,000 gross bonus | 24.27 s; full 10,000 paths per supported plan; 1456 animation frames, 16.8 ms longest gap |
| Marginal, £1,000 existing cash | 24.88 s; full 10,000 paths per supported plan, on 390px mobile |
| Actual deposit destination | £10,000 gross increment, configured purchase and £200,000 opening cash: 31.09 s; evaluated deposit, actual target-age debt and usable wealth |
| Actual mortgage destination | Same increment/cash with existing ownership: 30.64 s; evaluated overpayment and actual debt outcomes |
| Progress/cancellation | Nonzero progress observed; cancelling publishes no result element or partial ranking |
| Stale results | Amount and funding basis edits discard completed results; target-probability edit aborts an in-flight run |
| Validation/layout | Invalid numeric draft blocks execution; all six cards present; zero page overflow at 1440×950 and 390×844; screenshots visually inspected |
| Console | No uncaught page errors |

The default gross comparison reports pension 69.11%, ISA 69.05%, against the unchanged 68.98%
baseline. These small changes do not produce a recommendation: the plans do not clear all hard
constraints, and the screen says so. £1,000 gross yields £560 for a non-pension destination under
the example's configured Scotland/NI treatment, versus £1,000 added through salary sacrifice.
Existing £1,000 cash produces approximately £1,724 RAS pension funding after claimed/recycled
Scottish relief, without employer funding. These are fixture results, not hard-coded rankings.

`tests/browser-property-ui.mjs` also passed: 10,000 property paths in 4.66 s, 282 animation frames,
16.8 ms maximum gap; real FIRE 35.18%, rent/invest comparison, cancellation, validation and zero
mobile overflow. `tests/browser-solver-ui.mjs` passed: FIRE baseline 68.98%, the 42–50 age curve
in 39.95 s with all nine values unchanged and age 50 earliest qualifying; the complete salary solve
and sensitivities in 364.05 s, independently confirmed £87,600; cancellation, controls and zero
desktop/mobile overflow. These regressions preceded the final allocation-only snapshot/liquidity
refinement; both smoke variants and the full marginal harness ran again after it, and all 208 tests
and the production build pass on the final application source.

Artifacts: `/tmp/chunk7-ui-results.json`, `/tmp/chunk7-{desktop,mobile}.png`,
`/tmp/chunk7-{desktop,mobile}-results.png`, `/tmp/chunk7-deposit-desktop.png`,
`/tmp/chunk7-mortgage-mobile.png`, `/tmp/chunk5-ui-results.json`, `/tmp/chunk6-ui-results.json`.
No source was edited while a browser harness was running.

## Explicit limitations for subsequent work

- This is one one-off increment, not a recurring contribution optimiser or a mixed-destination
  split. Gross pay is explicitly a non-pensionable bonus; ordinary contractual employer base pay
  does not increase. Existing after-tax cash must already be in the opening cash account; no
  implicit ISA/GIA liquidation is inserted to obtain it.
- RAS additional relief is settled/recycled in the same model year, consistent with the tax engine;
  intra-year refund delays or borrowing to bridge those delays are not modelled. Funding budgets
  are assessed before discretionary portfolio/pension withdrawals; the complete ledger still
  settles taxes from actual withdrawals and includes those effects in lifetime outcomes.
- Full-year pension excess charges remain unsupported, and eligible historical carry-forward is
  entered by the user. Inherited low-earner net-pay later-year top-ups remain unmodelled.
- One-tax-year liquidation is an explicit approximation for valuation, not a forced portfolio sale
  in the simulated plan or an optimal phased pension withdrawal. It can heavily tax large pension
  balances. Tax-policy and liquidation-timing assumptions can change rankings.
- Future deposits increase the specified real deposit commitment; until purchase, that budget is
  ordinary cash and can be consumed by the plan. Cash growth need not match inflation; the later
  full-plan funding calculation must meet the commitment or record failure. Property appreciation,
  sale, costs, rent replacement, tax and debt all remain in the same lifetime model.
- No lender eligibility/underwriting, early-repayment charges, lender fees, automatic equity release,
  property search or automatic sale. The entered mortgage rate/term apply after overpayment with
  payments recast. Maximum-debt exposure includes opening debt before overpayment; target-age debt
  shows the reduction. All chunk-5 property support boundaries remain in force.
- Hard reserve/liquidity constraints use sampled closing boundaries rather than intra-year cash
  minima. Passing them is not proof for unobserved paths. Standard errors describe Monte Carlo
  sampling only, not model uncertainty. No static wrapper ordering or fixed GIA haircut is used.
- Persistence remains package 8. Scenario Comparison and Where It Comes From remain planned.

## Chunk 8 — paste-ready assignment

Implement package 8 in the capital-allocation repository: named scenarios, versioned local
save/load and the Scenario Comparison screen. Start from the latest `origin/main` containing the
completed chunk-7 handoff. Read `AGENTS.md`, this handoff, package 8, the chunk-6/5/3 interfaces,
architecture decisions, requirements checklist, property/tax modelling boundaries, authoritative
spec sections 61–66, 81 and 88, and reference UI tab 6 with its Organic tokens.

Preserve existing changes and the primary checkout on main. Use an isolated branch/worktree,
commit understandable stages after green gates, build a merge against current origin/main and
push it without rewriting history. Tell the user to run `git pull --ff-only` in the primary checkout.

Implement named scenario creation/edit/duplication and versioned local persistence using the shared
validated profile contract. Provide required strategy presets, income uplifts, configurable
low/base/high spending cases and all 5 salary × 3 spending × 4 strategy matrix combinations,
including property. Scenarios must not mutate each other. Every comparison uses common market
paths and the complete ledger, explicit tax/allowance/liquidity constraints, fixed spending and
unchanged count. Keep `rentInvestment` and `marginalAction` null for ordinary scenario runs unless
an explicitly documented strategy requests an action; include all options and versions in keys.

Show real take-home, tax, contribution, FIRE, liquid/pension/net-wealth results. Execute expensive
work in coordinator workers with progress/cancellation; publish no partial or stale results. Any
reduced-count preview must be explicitly selected and labelled, never silently substituted.
Keep calculations in view models and numeric controls in the field registry. Retain eight tabs and
change only Scenario Comparison to built. Test 60-combination coverage, exact common-path replay,
scenario independence, persistence/migration validation, caching keys, cancellation and the spending
double effect. Run `npm run check`, both worker smoke variants and real desktop/mobile Chrome
flows, including responsive full-count work and stale invalidation. Update README, requirements,
package status and `docs/handoffs/chunk-8.md` with evidence, limitations and the next assignment.
Report commit/merge hashes and push status; leave an accurate checkpoint if interrupted.
