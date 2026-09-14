# Capital allocation

Lifetime capital allocation and FIRE modelling for a UK resident. The [comprehensive V0.3 spec](docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md) is the product authority; [design/](design/) contains the UI reference.

Chunks 1–4 deliver the TypeScript/React scaffold, validated contracts, 2026/27 UK tax engine, deterministic lifetime ledger, reproducible worker-based Monte Carlo FIRE analysis, and a working application whose Overview and FIRE & Monte Carlo screens run those engines for real. All eight reference tabs are reachable; the six still to come name the package that owns them. See the [assignment plan](docs/implementation-work-packages.md), [requirements checklist](docs/requirements-checklist.md) and [latest handoff](docs/handoffs/chunk-4.md).

## Run

Install Node.js 24 with npm (also specified in `.nvmrc`), then:

```sh
npm ci
npm run check
npm run demo
npm run ledger
npm run monte-carlo
npm run dev
```

`check` runs strict typechecking, the tests and the production build. `demo` prints the spec's £55k example for both tax regions and all three pension methods. `dev` serves the application on localhost, along with the worker verification page at `/tests/browser-worker-smoke.html`.

Editing a profile in the application is in-memory only; there is no persistence yet. A simulation runs in a worker, so a 10,000-path run leaves the interface responsive, and it can be cancelled while it runs. Results are discarded whenever an input changes, because a result only describes the inputs that produced it.

Individual commands: `npm test`, `npm run typecheck`, `npm run build`. Web build output is `dist/`; compiled engine/CLI and declaration files are in `build/`. Both are ignored by Git. Use a normal dependency install; no API keys or external services are required to run calculations.

## Shared API

```ts
import { createExampleProfile } from './src/domain/fixtures.js';
import { getTaxConfig, calculatePensionRelief, taxInputFromProfile } from './src/domain/tax/index.js';

const profile = createExampleProfile();
const config = getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear);
const result = calculatePensionRelief(taxInputFromProfile(profile), config);
console.log(result.netIncomeAfterPension);
```

Inputs use GBP and fractional rates, with runtime validation and no silent tax-year fallback. See [architecture conventions](docs/architecture-decisions.md) and [tax sources/support boundaries](docs/tax-rules-2026-27.md) before extending calculations. This is annual decision-support modelling, not payroll or tax-return preparation.
