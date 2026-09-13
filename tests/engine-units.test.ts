import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import {
  accessibleWealth, deterministicPath, emergencyReserveTarget, inflationIndices, liquidityCoverageYears,
  liquidFireRatio, lockedWealth, netWorth, openingBalanceSheet, pensionCoverageRatio, portfolioReturn,
  proRataGain, requiredBridgeCapital, requiredPostPensionCapital, solveMonotone, spendingForYear,
} from '../src/engine/index.js';
import { close } from './ledger-helpers.js';

test('solveMonotone finds the smallest sufficient amount and reports saturation', () => {
  // Tax-free case: one pound withdrawn releases one pound of net cash.
  close(solveMonotone(x => x - 10_000, 50_000).x, 10_000, 1e-5, 'untaxed');
  // 30% effective tax: GBP 20,000 gross is needed to release GBP 14,000 net.
  close(solveMonotone(x => 0.7 * x - 14_000, 50_000).x, 20_000, 1e-5, 'taxed gross-up');
  // Already satisfied at zero: withdraw nothing.
  const none = solveMonotone(x => x + 5, 100);
  assert.equal(none.x, 0);
  assert.equal(none.saturated, false);
  // Not reachable even at the full balance: report saturation, never invent capacity.
  const capped = solveMonotone(x => x - 10_000, 4000);
  assert.equal(capped.x, 4000);
  assert.equal(capped.saturated, true);
  // A zero balance cannot fund anything.
  const empty = solveMonotone(x => x - 1, 0);
  assert.equal(empty.x, 0);
  assert.equal(empty.saturated, true);
  // The answer never under-funds.
  for (const target of [1, 137.42, 9999.99]) {
    const solved = solveMonotone(x => 0.82 * x - target, 1_000_000);
    assert.ok(0.82 * solved.x >= target - 1e-6, `under-funded at ${target}`);
  }
  assert.throws(() => solveMonotone(x => x, -1));
  assert.throws(() => solveMonotone(x => x, 10, 0));
});

test('portfolio returns are the weighted nominal means of their wrapper allocation', () => {
  const profile = createExampleProfile();
  const path = deterministicPath(3, profile.market);
  const year = path.years[0]!;
  // 85% equities, 10% bonds, 5% cash against 7%, 3% and 2.5%.
  close(portfolioReturn(profile.portfolios.isa, year), 0.85 * 0.07 + 0.1 * 0.03 + 0.05 * 0.025, 1e-12, 'isa');
  // Wrappers may hold different allocations; a cash-only wrapper earns the cash return.
  close(portfolioReturn({ equities: 0, bonds: 0, cash: 1 }, year), 0.025, 1e-12, 'cash only');
  close(portfolioReturn({ equities: 1, bonds: 0, cash: 0 }, year), 0.07, 1e-12, 'equity only');
  assert.equal(path.years.length, 3);
  assert.equal(path.pathIndex, -1);
  assert.deepEqual(path.years.map(y => y.yearIndex), [0, 1, 2]);
  assert.throws(() => deterministicPath(-1, profile.market));
});

test('the inflation index starts at one and compounds from the path', () => {
  const profile = createExampleProfile();
  const indices = inflationIndices(deterministicPath(4, profile.market));
  assert.deepEqual(indices.map(v => Number(v.toFixed(10))), [1, 1.025, 1.050625, 1.0768906250]);
  // A varying path compounds year by year rather than using an average.
  const varying = inflationIndices({
    pathIndex: 0,
    years: [0.10, 0.00, 0.05].map((inflation, yearIndex) => ({
      yearIndex, equities: 0, bonds: 0, cash: 0, property: 0, inflation,
    })),
  });
  assert.deepEqual(varying, [1, 1.1, 1.1]);
});

test('balance-sheet metrics keep accessible, locked and property capital separate', () => {
  const sheet = openingBalanceSheet(createExampleProfile());
  // Fixture: GBP 10,000 cash, GBP 50,000 ISA, GBP 15,000 GIA, GBP 25,000 pension.
  close(accessibleWealth(sheet), 75_000, 1e-9, 'accessible');
  close(lockedWealth(sheet), 25_000, 1e-9, 'locked');
  close(netWorth(sheet), 100_000, 1e-9, 'net worth');
  // Property equity is never counted as accessible, even when the mortgage is fully repaid.
  const owned = { ...sheet, propertyValue: 400_000, mortgageDebt: 0 };
  close(accessibleWealth(owned), 75_000, 1e-9, 'equity is not accessible');
  close(netWorth(owned), 500_000, 1e-9, 'equity still counts in net worth');
  close(liquidityCoverageYears(75_000, 15_600), 75_000 / 15_600, 1e-12, 'coverage');
  // Zero essential spending has unbounded coverage rather than a divide-by-zero.
  assert.equal(liquidityCoverageYears(1000, 0), Infinity);
  assert.equal(liquidFireRatio(1000, 0), Infinity);
  assert.equal(pensionCoverageRatio(0, 0), Infinity);
});

test('pro-rata gain apportions an aggregate pool without taxing it', () => {
  // Half of a pool standing at a GBP 100,000 gain realises half the gain.
  close(proRataGain(200_000, 100_000, 100_000), 50_000, 1e-9, 'half disposal');
  close(proRataGain(200_000, 100_000, 200_000), 100_000, 1e-9, 'full disposal');
  close(proRataGain(200_000, 200_000, 50_000), 0, 1e-9, 'no gain');
  // A pool below cost produces a loss, not a gain.
  close(proRataGain(100_000, 200_000, 50_000), -50_000, 1e-9, 'loss');
  assert.equal(proRataGain(0, 0, 0), 0);
});

test('bridge and post-pension capital references use the two independent ages', () => {
  close(requiredBridgeCapital(19_800, 45, 57), 12 * 19_800, 1e-9, 'bridge');
  // Retiring at or after access age needs no bridge capital.
  assert.equal(requiredBridgeCapital(19_800, 60, 57), 0);
  close(requiredPostPensionCapital(19_800, 57, 95), 38 * 19_800, 1e-9, 'post-pension');
  assert.equal(requiredPostPensionCapital(19_800, 95, 95), 0);
});

test('spendingForYear resolves phases, creep and overrides in the documented precedence', () => {
  const profile = createExampleProfile();
  const options = { retirementLevel: 'target' as const, monthlyHouseholdOverride: null };
  const working = spendingForYear(profile, { age: 31, inflationIndex: 1, realSalaryGrowthMultiple: 1 }, options);
  assert.equal(working.source, 'current');
  close(working.totalReal, 19_800, 1e-9, 'current total');
  // Nominal scales with the index while real stays in today's money.
  const later = spendingForYear(profile, { age: 35, inflationIndex: 1.1, realSalaryGrowthMultiple: 1 }, options);
  close(later.totalNominal, 19_800 * 1.1, 1e-9, 'nominal');
  close(later.totalReal, 19_800, 1e-9, 'real');
  // Retirement uses its own input, not current spending.
  const retired = spendingForYear(profile, { age: 60, inflationIndex: 1, realSalaryGrowthMultiple: 1 }, options);
  assert.equal(retired.source, 'retirement');
  // The override replaces the household total and preserves essential up to the schedule's essential.
  const overridden = spendingForYear(profile, { age: 31, inflationIndex: 1, realSalaryGrowthMultiple: 1 },
    { retirementLevel: 'target', monthlyHouseholdOverride: 1000 });
  close(overridden.totalReal, 12_000, 1e-9, 'override total');
  close(overridden.essentialReal, 12_000, 1e-9, 'override is all essential below the essential base');
  close(overridden.discretionaryReal, 0, 1e-9, 'no discretionary left');
  // Emergency reserve is months of essential spending, not of total spending.
  close(emergencyReserveTarget(profile, 15_600), 7800, 1e-9, 'six months');
});
