# Architecture decisions — chunk 1

## ADR 001: one TypeScript model, two presentations

Use strict TypeScript with pure domain functions, React/Vite for web presentation and Node 24 for tests/CLI. Zod validates untrusted inputs. The model has no React, DOM, network or filesystem dependency. Browser workers can consume the same functions later. Native Node tests avoid introducing a second test runtime. Dependency versions and npm lockfile make installation reproducible.

`design/` remains the UI reference. Its approximate calculator and generated runtime are not imported by production calculations. The minimal application links its existing Organic tokens; full screens belong to chunk 4.

## ADR 002: units and lifecycle contract

- Money is finite GBP in `number`, not integer pence. Rates are fractions (`0.05`, not `5`). Do not round intermediate results. Display rounded pence; tests use explicit tolerances. This is annual planning, not payroll/filing software.
- Profile amounts are today's-money values. Market means are nominal arithmetic annual means. Salary growth is explicitly real. Compound inflation converts between nominal ledger values and real presentation values.
- Projection years are half-open `[age, age + 1)`. Simulate `endAge - currentAge` years. Retirement starts at `targetFireAge`; pension access starts at `accessAge`. End age is the boundary after the last funded year, not one additional year of spending.
- Proposed chunk-2 event order: opening balances → income/tax/contributions and spending/withdrawals → annual market returns → closing balances. Failure is recorded when obligations cannot be funded; subsequent returns cannot erase it. Chunk 2 must implement and test this order. Chunk 3 must reuse it.
- All account flows in `LedgerYear` are nonnegative except investment returns and the signed property-transaction cash flow. Inter-account transfers have matching withdrawal/contribution entries and are not income. Employer contributions enter pension once. No capital is created by pension relief twice.
- GIA cost basis can exceed its value. Pension and SIPP balances remain separate; portfolio and access policy are shared initially. Property equity is never automatically liquidated. Household totals are authoritative; optional per-person breakdown must reconcile.
- `constant_real` tax policy explicitly scales tax thresholds with cumulative inflation, preserving this year's structure in real terms. It does not forecast enacted future-year rates. Store the base configuration version plus full assumptions in simulation metadata.
- Current/FIRE expenses are supported in the contract; optional phase overrides use non-overlapping half-open ages. Detailed expense-category UI and housing cash-flow replacement are later work.

## ADR 003: ownership boundaries

`src/domain/contracts.ts` and `fixtures.ts` are the shared input/result contracts. `src/config/tax/` owns effective-year rules; `src/domain/tax/` owns annual tax calculations. `src/engine/` will own deterministic accounting and simulation implementations in chunks 2/3. `src/presentation/` adapts outputs; it must not duplicate tax formulas.

Return-generator, ledger and simulation interfaces are contracts, not claims that those engines are implemented. New schema versions require explicit migration; unknown fields and unsupported tax years fail rather than silently falling back. Do not import code from another agent's private scratch file. Update the handoff when a public contract changes.
