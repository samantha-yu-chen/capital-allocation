import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { parseProfile, scenarioSchema } from '../src/domain/contracts.js';

test('section 79 fixture is valid, serializable and independent per call', () => {
  const p = createExampleProfile();
  assert.equal(p.assets.cash + p.assets.isa + p.assets.gia.marketValue, 75_000);
  assert.equal(p.assets.pension, 25_000);
  assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(p))), p);
  p.assets.cash = 0;
  assert.equal(createExampleProfile().assets.cash, 10_000);
  assert.equal(scenarioSchema.parse({ schemaVersion: '1', id: 'baseline', name: 'Baseline', profile: p }).name, 'Baseline');
});
test('invalid financial inputs fail at the boundary', () => {
  for (const invalid of [-1, NaN, Infinity, '55000']) {
    const p = createExampleProfile();
    assert.throws(() => parseProfile({ ...p, income: { ...p.income, salaryAnnual: invalid } }));
  }
  const p = createExampleProfile();
  assert.throws(() => parseProfile({ ...p, tax: 'typo' }));
  p.portfolios.isa.equities = 1;
  assert.throws(() => parseProfile(p));
});
test('age, expense and withdrawal relationships are enforced', () => {
  const mutations = [
    (p: ReturnType<typeof createExampleProfile>) => { p.personal.endAge = 40; },
    (p: ReturnType<typeof createExampleProfile>) => { p.spending.retirementFloorAnnual = 30_000; },
    (p: ReturnType<typeof createExampleProfile>) => { p.simulation.withdrawalOrder = ['cash', 'cash', 'isa', 'pension']; },
    (p: ReturnType<typeof createExampleProfile>) => { p.pension.salarySacrificeAvailable = false; },
    (p: ReturnType<typeof createExampleProfile>) => { p.spending.phases = [{ startAge: 40, endAge: 50, essentialMonthly: 1, discretionaryMonthly: 0 }, { startAge: 45, endAge: 60, essentialMonthly: 1, discretionaryMonthly: 0 }]; },
    (p: ReturnType<typeof createExampleProfile>) => { p.spending.breakdown = { sharedMonthly: 1, perAdultMonthly: 1, perChildMonthly: 1 }; },
  ];
  for (const mutate of mutations) { const p = createExampleProfile(); mutate(p); assert.throws(() => parseProfile(p)); }
});
test('correlation rejects asymmetric and non-positive-semidefinite inputs', () => {
  const p = createExampleProfile();
  p.market.correlation[0]![1] = 0.5;
  assert.throws(() => parseProfile(p));
  p.market.correlation = [[1, 0.9, 0.9, 0, 0], [0.9, 1, -0.9, 0, 0], [0.9, -0.9, 1, 0, 0], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]];
  assert.throws(() => parseProfile(p));
  p.market.correlation = Array.from({ length: 5 }, () => Array<number>(5).fill(1));
  assert.doesNotThrow(() => parseProfile(p));
});
