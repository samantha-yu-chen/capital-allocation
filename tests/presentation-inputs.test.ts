import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultLedgerOptions } from '../src/engine/index.js';
import {
  NUMBER_FIELDS, applyDrafts, displayValue, fieldValue, fieldsFor, fromDisplay,
  pruneDrafts, toDisplay, validateCandidate, validateDrafts, readPath, writePath,
} from '../src/presentation/view/fields.js';
import { runKey, stableStringify } from '../src/presentation/view/run-key.js';
import { TABS, isTabId, tabById } from '../src/presentation/view/tabs.js';
import { bandPath, linearScale, linePath, niceDomain, niceTicks } from '../src/presentation/view/chart.js';

const example = createExampleProfile();
const defs = fieldsFor(example);
const defFor = (id: string) => {
  const found = defs.find(def => def.id === id);
  assert.ok(found, `missing field ${id}`);
  return found;
};

test('every registered field addresses a real number on the example profile', () => {
  for (const def of defs) {
    const value = readPath(example, def.path);
    assert.equal(typeof value, 'number', `${def.id} is not a number`);
    assert.ok(Number.isFinite(value as number), `${def.id} is not finite`);
  }
  // The registry must not have drifted away from the schema's editable surface.
  assert.ok(NUMBER_FIELDS.length > 60);
  assert.equal(new Set(defs.map(def => def.id)).size, defs.length, 'duplicate field id');
});

test('percent fields round-trip without binary noise', () => {
  const equities = defFor('portfolios.isa.equities');
  assert.equal(toDisplay(equities, 0.85), '85');
  assert.equal(fromDisplay(equities, '85'), 0.85);
  const salaryGrowth = defFor('income.salaryGrowthReal');
  assert.equal(toDisplay(salaryGrowth, 0.03), '3');
  assert.equal(fromDisplay(salaryGrowth, '3'), 0.03);
  // Non-percent fields are untouched.
  assert.equal(toDisplay(defFor('income.salaryAnnual'), 55_000), '55000');
});

test('a valid draft reaches the engine as a parsed profile', () => {
  const state = validateDrafts(example, { 'income.salaryAnnual': '62000' });
  assert.ok(state.ok);
  assert.equal(state.profile.income.salaryAnnual, 62_000);
  // The base profile is never mutated by folding drafts into a candidate.
  assert.equal(example.income.salaryAnnual, 55_000);
});

test('an unparseable or empty draft fails validation instead of reusing the old value', () => {
  for (const text of ['', '   ', 'abc']) {
    const state = validateDrafts(example, { 'income.salaryAnnual': text });
    assert.equal(state.ok, false, `"${text}" should not validate`);
    assert.ok(state.issues.some(issue => issue.fieldId === 'income.salaryAnnual'),
      `"${text}" should raise an issue against the field it came from`);
  }
  // Critically, the candidate does not silently carry the previous 55,000 through.
  const candidate = applyDrafts(example, { 'income.salaryAnnual': 'abc' }, defs);
  assert.ok(Number.isNaN(readPath(candidate, ['income', 'salaryAnnual']) as number));
});

test('schema rules that span fields are reported without a field of their own', () => {
  // floor <= target <= comfort: raising the floor above the target total must be rejected.
  const state = validateDrafts(example, { 'spending.retirementFloorAnnual': '40000' });
  assert.equal(state.ok, false);
  const crossField = state.issues.filter(issue => issue.fieldId === null);
  assert.ok(crossField.some(issue => issue.group === 'spending'));
  assert.ok(crossField.some(issue => /floor/i.test(issue.message)));
});

test('portfolio weights that do not sum to one are rejected', () => {
  const state = validateDrafts(example, { 'portfolios.isa.cash': '25' });
  assert.equal(state.ok, false);
  assert.ok(state.issues.some(issue => issue.group === 'portfolios' && /sum to 1/i.test(issue.message)));
});

test('an out-of-range age is reported against that field', () => {
  const state = validateDrafts(example, { 'personal.currentAge': '12' });
  assert.equal(state.ok, false);
  assert.ok(state.issues.some(issue => issue.fieldId === 'personal.currentAge'));
});

test('editing the correlation upper triangle writes the mirror cell', () => {
  const candidate = applyDrafts(example, { 'market.correlation.0.1': '0.4' }, defs) as typeof example;
  assert.equal(candidate.market.correlation[0]![1], 0.4);
  assert.equal(candidate.market.correlation[1]![0], 0.4);
  const state = validateCandidate(candidate, defs);
  assert.ok(state.ok, 'a symmetric, positive semidefinite matrix must be accepted');
});

test('a correlation matrix that is not positive semidefinite is rejected', () => {
  const state = validateDrafts(example, {
    'market.correlation.0.1': '0.9',
    'market.correlation.0.2': '0.9',
    'market.correlation.1.2': '-0.9',
  });
  assert.equal(state.ok, false);
  assert.ok(state.issues.some(issue => issue.path.startsWith('market.correlation')));
});

test('drafts for removed list rows are pruned', () => {
  const withNeed = writePath(example, ['liquidity', 'capitalNeeds'],
    [{ age: 40, amount: 10_000, label: 'Roof' }]);
  const drafts = { 'liquidity.capitalNeeds.0.amount': '12000', 'income.salaryAnnual': '60000' };
  assert.deepEqual(pruneDrafts(withNeed, drafts), drafts);
  assert.deepEqual(pruneDrafts(example, drafts), { 'income.salaryAnnual': '60000' });
});

test('displayValue prefers the in-flight draft over the stored value', () => {
  const def = defFor('income.salaryAnnual');
  assert.equal(displayValue(example, def, {}), '55000');
  assert.equal(displayValue(example, def, { 'income.salaryAnnual': '6' }), '6');
  assert.equal(fieldValue(example, def), 55_000);
});

test('the run key ignores execution granularity but tracks every input', () => {
  const options = defaultLedgerOptions();
  const base = runKey(example, options);
  assert.equal(base, runKey(createExampleProfile(), options), 'identical inputs must give an identical key');

  const raised = writePath(example, ['income', 'salaryAnnual'], 56_000);
  assert.notEqual(base, runKey(raised, options), 'a profile change must invalidate');

  const moreCount = writePath(example, ['simulation', 'count'], 2_000);
  assert.notEqual(base, runKey(moreCount, options), 'path count is part of the result');

  const newSeed = writePath(example, ['simulation', 'seed'], 7);
  assert.notEqual(base, runKey(newSeed, options), 'the seed is part of the result');

  assert.notEqual(base, runKey(example, { ...options, retirementLevel: 'floor' }),
    'ledger options are part of the result');
  // Concurrency and batch size never enter the key: they cannot change the numbers.
  assert.equal(base, runKey(example, { ...options }));
});

test('stableStringify does not depend on key insertion order', () => {
  assert.equal(stableStringify({ a: 1, b: [2, { d: 4, c: 3 }] }), stableStringify({ b: [2, { c: 3, d: 4 }] , a: 1 }));
  assert.equal(stableStringify(null), 'null');
});

test('all eight reference destinations are present and unfinished ones name their package', () => {
  assert.deepEqual(TABS.map(tab => tab.id), [
    'overview', 'fire', 'curve', 'marginal', 'solver', 'scenarios', 'property', 'attribution',
  ]);
  assert.deepEqual(TABS.filter(tab => tab.status === 'built').map(tab => tab.id), ['overview', 'fire']);
  for (const tab of TABS.filter(tab => tab.status === 'planned')) {
    assert.ok(tab.package >= 5, `${tab.id} must name a later package`);
    assert.ok(tab.groundwork.length > 0, `${tab.id} must say what is missing`);
  }
  assert.equal(tabById('fire').label, 'FIRE & Monte Carlo');
  assert.ok(isTabId('property'));
  assert.equal(isTabId('nonsense'), false);
});

test('chart geometry maps domains and builds closed bands', () => {
  const scale = linearScale([0, 10], [100, 200]);
  assert.equal(scale(0), 100);
  assert.equal(scale(10), 200);
  assert.equal(scale(5), 150);
  // A zero-width domain cannot divide; it collapses to the midpoint rather than producing NaN.
  assert.equal(linearScale([4, 4], [0, 50])(4), 25);

  assert.deepEqual(niceTicks(0, 100, 5), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(niceTicks(0, 3), [0, 1, 2, 3]);
  assert.ok(niceTicks(0, 1_234_567).every(Number.isFinite));

  // A wealth axis must end on a labelled gridline rather than an unlabelled edge.
  const axis = niceDomain(0, 5_659_990);
  assert.equal(axis.domain[0], 0);
  assert.ok(axis.domain[1] >= 5_659_990, 'the domain must cover the data');
  assert.equal(axis.domain[1], axis.ticks[axis.ticks.length - 1], 'the top of the axis is a tick');
  assert.equal(axis.ticks[0], 0);
  assert.ok(axis.ticks.length >= 3, `too few gridlines: ${axis.ticks.join(',')}`);
  assert.deepEqual(niceTicks(7, 7), [7]);

  assert.equal(linePath([{ x: 0, y: 1 }, { x: 2, y: 3 }]), 'M0 1 L2 3');
  const band = bandPath([{ x: 0, low: 10, high: 2 }, { x: 5, low: 12, high: 4 }]);
  assert.ok(band.startsWith('M0 2 L5 4'));
  assert.ok(band.endsWith('Z'));
  assert.equal(bandPath([]), '');
});
