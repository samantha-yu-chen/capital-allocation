# Chunk 5 handoff — integrated property and Property & Leverage

Package 5 is implemented on the chunk-4 baseline `95af9a9`. Implementation commits:

- `4a063c4` — integrated property funding, tax, mortgage debt and paired lifetime comparisons.
- `dbfb87a` — Property screen, conditional field registry, property audit presentation, browser
  acceptance harness, and boundary fixes found during verification.
- `9b9e412` — include housing obligations in emergency reserves and liquidity coverage.

The documentation commit and merge are reported with delivery; this handoff deliberately does not
try to contain its own commit hash. Work was isolated in branch `chunk-5-property` at
`/private/tmp/capital-chunk-5`; existing main-checkout content was preserved.

## Delivered

One property now participates in `runProjection`, `runDeterministicProjection`, local/Node/browser
Monte Carlo and FIRE success. The property rejection is removed. Both existing screens have lost
the obsolete unsupported-property messaging and expose real property figures.

- Purchases fund the deposit, legal/other costs and location-specific purchase tax through the
  fixed withdrawal order, including withdrawal tax. An unfunded purchase is cancelled atomically
  and leaves a persistent failure and auditable shortfall; it never creates a partly funded house.
- Monthly repayment amortisation is aggregated into the annual ledger. Interest-only loans carry
  principal until their term-end balloon. Rate changes recast over the remaining term. Unpaid
  interest capitalises, principal remains due and overdue debt continues accruing interest.
- Maintenance, insurance, service charges, owner-paid council tax, occupancy-adjusted rent and
  management costs enter cash flow. Rental profit joins the annual non-savings tax calculation;
  operating losses and restricted finance costs carry forward. Residential mortgage finance
  relief is a capped basic-rate reduction, not an interest deduction.
- Scheduled sales pay selling costs and settle debt before proceeds become cash. Rental disposals
  use nominal acquisition basis and share the annual CGT exemption/loss pool with GIA disposals.
  Unfunded negative equity remains debt. Owner-occupied sales assume full private residence relief.
- Property appreciation uses each path's existing property-return series. Equity stays separate
  from financial/accessible wealth and cannot silently pay for the bridge.
- `currentRentMonthlyIncluded` is removed once during owner occupation, from each supplied
  spending schedule, and restored on sale. Rental investments leave the household's rent alone.
  Mortgage payments appear once, separately from living consumption; principal builds equity.
- Full-plan rent/invest comparisons reuse the identical generated path object for each pair,
  retaining identical opening financial assets. The renter invests available cash from the
  avoided deposit/cost budget at the purchase age, respects its reserve, fills unused ISA
  allowance, then GIA. Existing invested capital stays invested. Neither plan receives free money.

The built **Property & Leverage** tab has conditional inputs, equity, LTV, debt-service coverage,
downside equity shocks, deterministic equity drawdown, 3/5/7/9% full-plan mortgage scenarios,
a real annual property ledger and a cancellable worker comparison. Comparisons show FIRE success,
mean/median/P10/P90 terminal wealth, liquid capital, minimum liquidity, maximum net-worth drawdown,
and debt exposure. Comparisons require a planned purchase; existing ownership has no unspent
deposit. The baseline profile still has no property until the user enables one.

## Interfaces and conventions for the next package

Read [`../property-model.md`](../property-model.md) for exact timing, tax sources, identities and
input interpretation; ADR 005 records the architecture choice.

- `src/engine/property.ts`: `mortgageYear`, `purchaseTax`, `propertyYear`, `leverage`, `Property`.
- `src/engine/property-comparison.ts`: `comparePropertyPlans`, `rentAndInvestProfile`,
  `PropertyComparison`. The browser adapter is `property-comparison-browser.ts`; its dedicated
  worker owns all paired computation. It yields progress every 50 pairs and never reduces count.
- `src/presentation/view/property-model.ts`: profile-edit helpers, `computeProperty` and
  `comparisonRows`. React only renders these results. `fields.ts` remains the numeric field
  registry and `profileSchema` the validation authority.
- Optional schema-1 property additions: `taxLocation`, `buyerStatus`, `purchaseTaxOverride`,
  `acquisitionCostBasis`. Existing profiles remain valid. Existing rental sales now require
  explicit historical basis. Mortgage rates must be nonnegative, and transaction/refinance
  timelines are validated.
- `LedgerOptions.rentInvestment`: explicit cash investment action `{age, amount}` or resolved
  default `null`. This is used by the renter alternative; it creates no capital. All consumers,
  option validation and reproducibility keys include it. Leave it null for ordinary solver runs.
- `LedgerYearDetail` now carries transaction, appreciation, mortgage required/funded, rental
  profit/relief/carry and purchase-shortfall audit fields. `mortgagePrincipal` is principal actually
  paid; `mortgagePrincipalRequired` includes balloon/overdue obligations. The existing base
  `LedgerYear` property fields are populated. GIA-named CGT allowance/loss totals now reflect the
  joint GIA/property assessment; realised gains are separately available by asset.
- Engine version: `deterministic-ledger-v2-property-residential-2026-27-v1`. Parametric generator
  version, seeds, path indexing and simulation aggregation order are unchanged.
- Original per-account identities and top-level event order are unchanged. Property-aware
  financial and net-worth reconciliation identities are additionally tested. No dynamic cuts.
- Money remains nominal inside the ledger and real in Monte Carlo/view results. First wealth
  point is opening current age, then closing age boundaries. Never deflate simulation results twice.
- Reference FIRE arithmetic intentionally remains the entered retirement budget before property
  adjustments, now explicitly labelled on both screens. It is not safety analysis: the complete
  ledger includes housing changes, mortgage maturity, rental cash flow and taxes in success.
- Emergency reserves and liquidity coverage include property operating costs and scheduled mortgage service. The sequence-risk low-liquidity measure uses the same housing obligations; it remains a diagnostic, not a causal explanation.

## Verification

`npm run check`: **157 tests pass**, zero failures; strict typecheck and production build pass on
Node **24.21.0**. This is 138 inherited tests plus 19 new tests in `property.test.ts` and
`property-presentation.test.ts`; obsolete rejection expectations were replaced with integration
assertions. `git diff --check` passes.

Golden and integration evidence includes:

- £240,000 / 5% / 25-year mortgage: monthly payment £1,403.016099619; closing first-year balance
  £235,051.423551982; first-year interest £11,887.616747412. Expected values were independently
  checked with 40-digit decimal closed-form arithmetic. Zero-rate payoff, full-term amortisation,
  interest-only balloon, overdue balances and remaining-term refinance are covered.
- Scenario B: £300,000 value / £60,000 equity; 5% growth gives £15,000 appreciation and 25% gross
  equity return. A 10% property fall gives a 50% equity loss before costs.
- Purchase/sale reconciliation checks every account plus aggregate financial and net-worth
  identities across the horizon. A fully GIA-funded £60,000 purchase independently verifies
  the withdrawal gross-up through 18%/24% CGT and the annual exemption.
- Rent removed once across accumulation, FIRE and explicit phases; restored on sale; not removed
  for a rental investment. Owner housing changes a zero-volatility FIRE fixture from certain
  failure to certain success. Stochastic and deterministic ledger outcomes agree at zero vol.
- Mortgage/bridge failures, unfunded atomic purchases, negative-equity sales, rental occupancy,
  finance relief/carry, historical sale basis, input validation and tax schedules are tested.
- Paired comparisons replay exactly, preserve inputs, match ordinary Monte Carlo buy results,
  preserve debt exposure at acquisition and cancel without partial results.

### Real Chrome verification

Vite was served with `npm run dev -- --port 5175`. Both smoke variants passed:

| Run | Result |
| --- | --- |
| `/tests/browser-worker-smoke.html` | Browser/local byte equality; mid-run cancellation; all 10,000 paths; 68.98% success; 4.11 s; 422 UI timer ticks |
| `/tests/browser-worker-smoke.html?property` | Same checks with a planned property and £700 included monthly rent; 10,000 paths; 35.18% success; 4.49 s; 461 UI timer ticks |
| Actual FIRE screen with property | 10,000 paths completed in **4.78 s**, **292 animation frames**, **16.8 ms** longest frame gap; 35.18% success |
| FIRE cancellation | Cancel after nonzero progress; no completed/partial result published |
| Property inputs | £60,000 starting equity, 80% LTV, 1.44× coverage, £66,600 actual purchase funding and computed 3/5/7/9% scenarios; invalid deposit blocks projection |
| Property comparison | All 10,000 pairs completed; buy 35.18% vs renter 69.01%; median terminal net worth £596,173 vs £650,111; buy P90 maximum debt £240,000 |
| Comparison cancellation | Cancel after nonzero progress; no partial results |
| Stale invalidation | Property edits discard a finished comparison and abort one in flight; seed edits discard a completed FIRE result |
| Desktop/mobile | Inspected at 1440×950 and 390×844; zero horizontal page overflow on Property, Overview and FIRE; wide tables scroll within containers |
| Console | No uncaught page errors |

The renter probability differs slightly from the unmodified baseline because it explicitly
invests the cash retained from avoiding the purchase, subject to the reserve. This is a funding
policy difference recorded in comparison metadata, not different market paths.

`tests/browser-property-ui.mjs` is the checked-in Node/CDP acceptance harness, executed successfully
against the final screen. Start an isolated Chrome with
`--headless=new --remote-debugging-port=9225 --user-data-dir=/tmp/capital-chunk5-chrome`, then run:

```sh
export PATH="/tmp/node-v24.21.0-darwin-arm64/bin:$PATH"  # local convenience, if still present
npm ci
npm run check
npm run dev -- --port 5175
# Separate terminal, with the isolated Chrome already running:
node tests/browser-property-ui.mjs
```

It writes `/tmp/chunk5-ui-results.json` and desktop/mobile PNGs. Do not edit source while it runs:
Vite reloads reset the deliberately in-memory profile. Smoke tests are browser pages; the CDP
harness is an explicit browser check, not part of `npm run check`.

## Limitations preserved explicitly

- One residential property, fixed use, annual lifecycle timing. No automatic sales, cash-out
  refinancing, mortgage underwriting/approval model, lender fees or repossession. Configured
  refinance changes rates only. Mortgage interest uses the scheduled monthly amortisation;
  annual unpaid amounts are carried as debt rather than modelling intra-year arrears collection.
- Purchase price/deposit/costs are known real amounts inflated to acquisition age; pre-purchase
  market appreciation does not reprice that contractual assumption. Property volatility applies
  once ownership begins. Property costs and rents grow with inflation, not automatically with value.
- Included rent is a component of every supplied budget/phase, capped by that year's total.
  Other household spending must exclude the separately entered mortgage/property costs. The
  mortgage principal is never counted again as living consumption.
- Standard and eligible first-time SDLT/LBTT plus explicitly selected additional-dwelling rates
  are calculated. Wales and exceptional tax cases require an explicit manual tax amount. No
  eligibility inference, refund timing, corporate ownership, nonresident surcharge automation,
  mixed-use relief, prior rental-business tax carry inputs or future tax legislation forecast.
  Owner-occupied sales assume full private residence relief. All frozen rule sources are linked in
  `property-model.md`.
- Terminal net worth includes unsold equity and unrealised gains; it is not a hypothetical
  after-liquidation cash value. Liquidity and debt are reported separately. Equity can remain
  substantial on a failed FIRE path.
- The full-plan mortgage-rate table is deterministic. To sample another rate/refinance plan,
  edit the property and rerun FIRE; no canned probabilities appear in that table.
- Rent/invest compares planned acquisition only. The renter retains the same spending schedule
  through the same horizon and invests its avoided purchase budget from available cash. This
  is one explicit comparison policy, not an allocation optimiser.
- The paired comparison currently uses one dedicated worker; ordinary Monte Carlo still uses
  its existing pool. Exact sample distributions consume memory with configured count; there is
  no hidden path-count reduction or promise that the schema's one-million ceiling fits browsers.
- Five screens remain planned: FIRE Age Curve, Reverse Solver, Marginal Allocation, Scenario
  Comparison and Where It Comes From. Persistence remains package 8. Pension annual-allowance
  excess still throws `PensionLimitError`; no excess-charge model was added.

## Chunk 6 — paste-ready assignment for Claude

Implement package 6 in the capital-allocation repository: the Reverse Solver and FIRE Age Curve
engines and screens. Chunks 1–5 are complete on main; start from the latest main containing this
handoff.

Check branch, working tree and origin/main first. Preserve existing changes. Work on a branch in
a separate worktree, commit in understandable stages, merge back to main and push. No PR required.

Read in order:

1. `docs/handoffs/chunk-5.md`, including the property interfaces and limitations above.
2. Package 6 in `docs/implementation-work-packages.md`.
3. `docs/handoffs/chunk-2.md`, `chunk-3.md`, `chunk-4.md`,
   `docs/architecture-decisions.md` and `docs/property-model.md`.
4. The authoritative spec, especially sections 17, 32–33 and 60; reference UI tabs 3 and 5 in
   `design/Web page UI specification/Lifetime Capital Allocation & FIRE Model.dc.html` and its
   Organic tokens.
5. `src/domain/contracts.ts`, `src/engine/ledger.ts`, `src/engine/solve.ts`,
   `src/engine/monte-carlo/`, and the existing `src/presentation/view/` and `web/` patterns.

Build bounded searches for required annual savings and gross salary, plus FIRE age, spending
reduction, starting capital and pension contributions. Define what each searched input changes
and how cash is funded; do not create capital, bypass tax/allowances or optimise a reference ratio
instead of full-plan success. Reuse identical seeds/path indices across candidates. Preserve the
configured simulation count, property cash flows, fixed spending policy, pension access and
liquidity constraints. Leave `rentInvestment` null for ordinary solver candidates.

Handle already-achieved targets, unreachable targets, invalid/pension-limit candidates, bounds,
non-monotonic strategies and numerical tolerance explicitly. Confirm every returned candidate
against the complete model. Distinguish search precision from Monte Carlo uncertainty and avoid
false precision. Do not assume monotonicity for every pension/allocation strategy or skip feasibility
checks around property purchases, balloons and pension access.

Wire both screens to real results: target probability, earliest qualifying FIRE age, age curve,
solver modes and computed sensitivity examples. Use workers with progress/cancellation, discard
stale results after any relevant edit, and publish no partial success when cancelled. Preserve all
eight destinations; change only these two tab statuses to built. Keep testable logic in
`src/presentation/view/`, numeric fields in the field registry and calculations out of React.
Reuse the existing shared Organic components.

Keep `npm run check` green (157 tests at this handoff). Add independent tests proving returned
solutions meet their targets when reevaluated, bounded infeasibility, pension-access boundaries,
spending-search direction, common-path replay, cancellation and at least one property-sensitive
solver/age-curve case. Do not weaken reconciliation identities, change event order, add dynamic
spending cuts or silently reduce count.

Verify in real Chrome: run both worker smoke variants, exercise both new screens with actual
results, confirm progress/cancellation/stale invalidation and responsive 10,000-path work, and
inspect desktop/mobile widths. The checked-in property browser harness remains a useful regression.
Update `docs/requirements-checklist.md` (16, 17, 18 and the UI table), package status and create
`docs/handoffs/chunk-6.md` with delivered scope, changed APIs, commands/results, limitations and a
paste-ready chunk-7 assignment. Report commit/merge hashes and push status. If interrupted, leave
an accurate checkpoint; never mark incomplete work done.
