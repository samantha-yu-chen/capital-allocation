# Capital allocation

Lifetime capital allocation and FIRE modelling for a UK resident. The [comprehensive V0.3 spec](docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md) is the product authority; [design/](design/) contains the UI reference.

Chunk 1 delivers the TypeScript/React scaffold, validated financial contracts and a versioned 2026/27 UK tax engine. The lifetime ledger, simulations and dashboard are subsequent chunks. See the [assignment plan](docs/implementation-work-packages.md), [requirements checklist](docs/requirements-checklist.md) and [Claude handoff](docs/handoffs/chunk-1.md).

## Run

Install Node.js 24 with npm (also specified in `.nvmrc`), then:

```sh
npm ci
npm run check
npm run demo
npm run dev
```

`check` runs strict typechecking, the tests and the production build. `demo` prints the spec's £55k example for both tax regions and all three pension methods. `dev` serves the foundation page on localhost; it does not yet expose the eight dashboard screens.

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
