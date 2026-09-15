# Capital allocation

A locally runnable lifetime capital-allocation and FIRE model for a UK resident, with Scotland and
rest-of-UK 2026/27 tax rules. The [V0.3 specification](docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md)
is the product authority; [design/](design/) contains the Organic UI reference.

Packages 1–9 provide a reconciled annual ledger, seeded Monte Carlo, integrated property,
bounded reverse solvers, an age curve, marginal capital allocation, named scenario comparison,
attribution, sensitivity and deterministic stresses. All eight reference screens run real engines:

| Screen | Available functionality |
| --- | --- |
| Overview | Validated profile inputs, cash flow, separate liquid/pension/property wealth and annual ledger |
| FIRE & Monte Carlo | Full lifetime success, bridge/depletion failures, percentiles and sequence diagnostics |
| FIRE Age Curve | Every selected whole retirement age simulated on common market paths |
| Marginal Allocation | One-off gross earnings or existing after-tax cash across pension, ISA, GIA, cash, mortgage overpayment and property deposit |
| Reverse Solver | Salary, savings, FIRE age, retirement spending, starting capital and pension-contribution searches, plus worked sensitivity cases |
| Property & Leverage | Purchase/sale, housing costs, mortgages, rental tax, leverage and paired rent/invest comparison |
| Scenario Comparison | Named scenarios with versioned local save/load, the 5 × 3 × 4 salary/spending/strategy matrix, spending and income sensitivity, all on common market paths |
| Where It Comes From | Full-count intervention comparisons, nine sensitivity families, seven deterministic stresses, funding diagnostics and traceable engine results |

See the [work packages](docs/implementation-work-packages.md), [requirements evidence](docs/requirements-checklist.md)
and [chunk-9 handoff](docs/handoffs/chunk-9.md) for delivery details and remaining scope.

## Run

Install Node.js 24 with npm (`.nvmrc`), then:

```sh
npm ci
npm run check
npm run dev -- --port 5177 --strictPort
```

Open `http://127.0.0.1:5177`. No API keys, accounts, backend servers or external financial services
are needed. Profile edits are still in memory only, but a *named scenario* saved on the Scenario
Comparison screen is stored in this browser's local storage and survives a refresh. Nothing is sent
anywhere: the library is a versioned JSON document you can also export and re-import by hand.

`npm run check` runs strict typechecking, all 245 tests and the production build. Individual commands
are `npm test`, `npm run typecheck` and `npm run build`. `npm run demo`, `npm run ledger` and
`npm run monte-carlo` print actual tax, annual ledger and simulation outputs. Generated `build/`
and `dist/` directories are Git-ignored.

Calculations run in browser workers. Expensive comparisons announce their cost before execution,
report progress and support cancellation. Cancelled or failed analyses publish nothing, and edits
invalidate results. The default is 10,000 paths; analyses never lower the count automatically.
A marginal comparison runs up to seven full simulations, the required scenario matrix runs sixty,
and a complete reverse solve with sensitivity cases can take several minutes.

## Attribution, sensitivity and stress analysis

Where It Comes From reruns your full plan for explicit changes to income, expenses, FIRE timing,
allocation, portfolio risk and configured property leverage. It reports the largest tested
income/expenses/allocation improvement only beyond sampling uncertainty. Effects are not additive
and are not shares of a causal decomposition. Success, terminal wealth and accessible capital are
separate objectives.

Sensitivity covers equity return and volatility, inflation, spending, salary growth, FIRE age,
mortgage rates, property growth and hypothetical additional tax on taxable pension withdrawals.
Each case uses the full entered path count and matching underlying Gaussian shocks. The batch
reuses one worker pool and caches identical complete versioned inputs; it can take several minutes.

Seven synthetic stress paths cover two crash styles, high inflation, a lost decade, mortgage and
property shocks, and job loss. Choose the start age; each shock applies to the specified annual
interval through the same lifetime ledger. Assumptions, funding failures and complete stress
ledgers are auditable. These are single assumed paths, not historical backtests or probabilities.
The pension tax tests add a hypothetical 5pp/10pp charge on taxable withdrawals; configured tax laws
are unchanged. Ineligible cases show reasons and no invented figures.

## Scenario comparison

Save the current profile as a named scenario, or create one from a preset — Baseline, ISA Heavy,
Pension Heavy, Income Growth, Property Heavy, No Property, Aggressive FIRE, Conservative FIRE. Each
preset is an explicit transform of your plan and says what it changed; a preset this profile cannot
express states why instead of creating a misleading scenario. The library is versioned: it is
re-validated on every load, an older document is migrated explicitly, and a document this build
cannot read is refused with reasons rather than partially loaded.

Four comparisons run on common random numbers: the required matrix of five salaries × three
spending cases × four capital strategies, the section 61 spending cases, the section 62 income
bands, and your saved scenarios. Every cell is a complete lifetime simulation at the entered path
count, reporting take-home, marginal rate, pension and ISA contributions, total invested, FIRE
success with its sampling interval, and liquid, pension and net wealth at that plan's own FIRE age.
Spending cases show both halves of their effect — the investable surplus they leave and the capital
target they create. A lead inside the paired sampling interval is reported as a tie.

The path count is never lowered for you. A reduced-path preview has to be asked for, is labelled a
preview everywhere it appears, and is cached separately so it can never stand in for a full-count
result. Cancelling publishes no partial matrix.

## Marginal allocation

Enter a one-off amount, its funding basis and the maximum real debt you accept. Gross earnings mean
an extra non-pensionable bonus in the current year, with exact incremental tax and NI. Pension uses
the workplace method, remaining employer match and NI shareback. Existing after-tax cash is moved
from the opening cash account; pension uses RAS with relief claimed and recycled in the same annual
settlement. No capital is credited twice and no contribution is silently capped.

Every supported destination reruns the whole plan on matching seed/path indices. Results include
wealth at FIRE, pension access and terminal ages; success and paired sampling uncertainty; downside;
accessible capital; lifetime taxes; and debt. A configured property's deposit reduces its planned
borrowing; mortgage overpayment recasts existing debt over its remaining term. Missing property,
insufficient cash, exhausted allowances and other unsupported destinations have explicit reasons.

Ranking uses mean after-tax usable financial wealth at the target ages, subject to the FIRE
probability, emergency cash, liquid-years and maximum-debt constraints. A one-tax-year financial
liquidation valuation uses actual GIA basis/losses and pension tax-free allowance; locked pension and
unsold property equity cannot fund the bridge. Phased pension drawdown can have different tax
outcomes. Shared ranks and classifications respect sampling uncertainty. When no candidate meets
the constraints, the screen gives no allocation recommendation.

## Verify in Chrome

Use a separate headless Chrome profile so testing does not disturb your normal browser:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9227 \
  --user-data-dir=/tmp/capital-chunk7-chrome about:blank

# With Vite running on port 5177:
APP_PORT=5177 CDP_PORT=9227 node tests/browser-scenario-ui.mjs
APP_PORT=5177 CDP_PORT=9227 node tests/browser-marginal-ui.mjs
APP_PORT=5177 CDP_PORT=9227 node tests/browser-property-ui.mjs
APP_PORT=5177 CDP_PORT=9227 node tests/browser-solver-ui.mjs
```

These manual harnesses write JSON and desktop/mobile screenshots into `/tmp`; they are separate
from `npm test`. The scenario and marginal harnesses also run both worker smoke variants at
`/tests/browser-worker-smoke.html` and `?property`. The scenario harness clears and rewrites the
saved scenario library in that isolated Chrome profile, so run it against a throwaway
`--user-data-dir`. Do not edit application source while a harness runs: a Vite reload resets the
in-memory profile.

## Engine APIs and assumptions

```ts
import { createExampleProfile } from './src/domain/fixtures.js';
import { compareMarginal } from './src/engine/marginal.js';

const profile = createExampleProfile();
const result = await compareMarginal(profile, {
  amount: 1000,
  basis: 'gross_earnings',
  maximumDebt: 0,
});
console.log(result.candidates);
```

`runDeterministicProjection`, `runMonteCarlo`, `comparePropertyPlans`, `solveTarget`, `runSolver`,
`fireAgeCurve`, `buildScenarioMatrix` and `runScenarioBatch` expose the other analyses;
`loadScenarioLibrary` validates and migrates a saved scenario document. Browser adapters use worker coordinators and the
same engines. Shared validation is in `src/domain/contracts.ts`; testable presentation logic lives
in `src/presentation/view/`.

Money is GBP, with fractional rates and no rounding inside engines. Ledger figures are nominal;
Monte Carlo and view results are in today's money. Ages are opening-current then closing-year
boundaries. Pension access, actual disposal taxes, property funding and fixed spending are enforced
inside the ledger. [Architecture decisions](docs/architecture-decisions.md),
[tax support boundaries](docs/tax-rules-2026-27.md), [property assumptions](docs/property-model.md)
and the handoffs document the limits. This is annual decision-support modelling, not payroll,
tax-return preparation or a guarantee of future outcomes.
