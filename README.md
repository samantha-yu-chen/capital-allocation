# Capital allocation

A locally runnable lifetime capital-allocation and FIRE model for a UK resident, with Scotland and
rest-of-UK 2026/27 tax rules. The [V0.3 specification](docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md)
is the product authority; [design/](design/) contains the Organic UI reference.

Packages 1–7 provide a reconciled annual ledger, seeded Monte Carlo, integrated property,
bounded reverse solvers, an age curve and marginal capital allocation. Six of the eight reference
screens run real engines:

| Screen | Available functionality |
| --- | --- |
| Overview | Validated profile inputs, cash flow, separate liquid/pension/property wealth and annual ledger |
| FIRE & Monte Carlo | Full lifetime success, bridge/depletion failures, percentiles and sequence diagnostics |
| FIRE Age Curve | Every selected whole retirement age simulated on common market paths |
| Marginal Allocation | One-off gross earnings or existing after-tax cash across pension, ISA, GIA, cash, mortgage overpayment and property deposit |
| Reverse Solver | Salary, savings, FIRE age, retirement spending, starting capital and pension-contribution searches, plus worked sensitivity cases |
| Property & Leverage | Purchase/sale, housing costs, mortgages, rental tax, leverage and paired rent/invest comparison |
| Scenario Comparison | Planned: package 8, including local persistence and the scenario matrix |
| Where It Comes From | Planned: package 9, attribution and stress analysis |

See the [work packages](docs/implementation-work-packages.md), [requirements evidence](docs/requirements-checklist.md)
and [chunk-7 handoff](docs/handoffs/chunk-7.md) for delivery details and remaining scope.

## Run

Install Node.js 24 with npm (`.nvmrc`), then:

```sh
npm ci
npm run check
npm run dev -- --port 5177 --strictPort
```

Open `http://127.0.0.1:5177`. No API keys, accounts, backend servers or external financial services
are needed. Profile edits are in memory only; refreshing loses them until package 8 adds persistence.

`npm run check` runs strict typechecking, all 208 tests and the production build. Individual commands
are `npm test`, `npm run typecheck` and `npm run build`. `npm run demo`, `npm run ledger` and
`npm run monte-carlo` print actual tax, annual ledger and simulation outputs. Generated `build/`
and `dist/` directories are Git-ignored.

Calculations run in browser workers. Expensive comparisons announce their cost before execution,
report progress and support cancellation. Cancelled or failed analyses publish nothing, and edits
invalidate results. The default is 10,000 paths; analyses never lower the count automatically.
A marginal comparison runs up to seven full simulations, while a complete reverse solve with
sensitivity cases can take several minutes.

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
APP_PORT=5177 CDP_PORT=9227 node tests/browser-marginal-ui.mjs
APP_PORT=5177 CDP_PORT=9227 node tests/browser-property-ui.mjs
APP_PORT=5177 CDP_PORT=9227 node tests/browser-solver-ui.mjs
```

These manual harnesses write JSON and desktop/mobile screenshots into `/tmp`; they are separate
from `npm test`. The marginal harness also runs both worker smoke variants at
`/tests/browser-worker-smoke.html` and `?property`. Do not edit application source while a harness
runs: a Vite reload resets the in-memory profile.

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

`runDeterministicProjection`, `runMonteCarlo`, `comparePropertyPlans`, `solveTarget`, `runSolver`
and `fireAgeCurve` expose the other analyses. Browser adapters use worker coordinators and the
same engines. Shared validation is in `src/domain/contracts.ts`; testable presentation logic lives
in `src/presentation/view/`.

Money is GBP, with fractional rates and no rounding inside engines. Ledger figures are nominal;
Monte Carlo and view results are in today's money. Ages are opening-current then closing-year
boundaries. Pension access, actual disposal taxes, property funding and fixed spending are enforced
inside the ledger. [Architecture decisions](docs/architecture-decisions.md),
[tax support boundaries](docs/tax-rules-2026-27.md), [property assumptions](docs/property-model.md)
and the handoffs document the limits. This is annual decision-support modelling, not payroll,
tax-return preparation or a guarantee of future outcomes.
