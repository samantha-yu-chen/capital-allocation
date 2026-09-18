import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultLedgerOptions } from '../src/engine/index.js';
import {
  CHOICE_FIELDS, DEFAULT_TIER_MODE, NUMBER_FIELDS, TIER_MODES, applyDrafts, choiceFieldsFor, displayValue,
  fieldValue, fieldVisibility, fieldsFor, forcedFieldIds, fromDisplay, isGridField,
  pruneDrafts, tierInMode, toDisplay, validateCandidate, validateDrafts, readPath, writePath,
  type FieldTier, type TierMode,
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

/**
 * The recorded essential set (UX-1). Changing it is a product decision, not an implementation
 * detail, so it is spelled out here rather than derived from the registry.
 */
const ESSENTIAL_IDS = [
  'personal.currentAge',
  'personal.targetFireAge',
  'personal.taxRegion',
  'income.salaryAnnual',
  'spending.current.essentialMonthly',
  'spending.current.discretionaryMonthly',
  'spending.retirement.essentialMonthly',
  'spending.retirement.discretionaryMonthly',
  'assets.cash',
  'assets.isa',
  'assets.pension',
  'pension.employeeRate',
  'pension.employerRate',
];

/** The groups the Overview profile form renders; property has its own screen. */
const OVERVIEW_GROUPS = new Set([
  'personal', 'income', 'household', 'spending', 'assets', 'pension',
  'wrappers', 'liquidity', 'portfolios', 'market', 'simulation',
]);

const withProperty = validateCandidate(writePath(example, ['property'], {
  use: 'owner_occupied', mortgageType: 'repayment', marketValue: 450_000, mortgageBalance: 220_000,
  mortgageAnnualRate: 0.045, mortgageTermYears: 18, maintenanceAnnual: 2_000, insuranceAnnual: 400,
  serviceChargeAnnual: 0, councilTaxAnnual: 2_100, rentAnnual: 0, occupancyRate: 0, managementRate: 0,
  purchase: null, sale: null, rateChanges: [],
}), []);

test('every registry entry carries a tier, and the essential set is exactly the recorded list', () => {
  const tiers: readonly FieldTier[] = ['essential', 'common', 'expert'];
  // Completeness: no entry, numeric or otherwise, may reach the form untiered.
  for (const def of defs) {
    assert.ok(tiers.includes(def.tier), `${def.id} has no valid tier`);
  }
  for (const def of choiceFieldsFor(example)) {
    assert.ok(tiers.includes(def.tier), `${def.id} has no valid tier`);
  }
  assert.ok(withProperty.ok, 'the property fixture must parse');
  for (const def of [...fieldsFor(withProperty.profile), ...choiceFieldsFor(withProperty.profile)]) {
    assert.ok(tiers.includes(def.tier), `${def.id} has no valid tier`);
  }
  assert.ok(CHOICE_FIELDS.length > 0);

  const essential = [...defs, ...choiceFieldsFor(example)]
    .filter(def => def.tier === 'essential').map(def => def.id).sort();
  assert.deepEqual(essential, [...ESSENTIAL_IDS].sort());
});

test('the default filter keeps the profile form to a readable number of inputs', () => {
  const numbers = defs.filter(def => OVERVIEW_GROUPS.has(def.group));
  const choices = choiceFieldsFor(example).filter(def => OVERVIEW_GROUPS.has(def.group));
  assert.equal(DEFAULT_TIER_MODE, 'common');

  const shown = fieldVisibility(DEFAULT_TIER_MODE, numbers, choices);
  assert.ok(shown.inputCount <= 40, `default view renders ${shown.inputCount} inputs`);
  // It must still be a usable form, not a stub.
  assert.ok(shown.inputCount >= 25, `default view renders only ${shown.inputCount} inputs`);

  const minimal = fieldVisibility('essential', numbers, choices);
  assert.equal(minimal.inputCount, ESSENTIAL_IDS.length);

  const everything = fieldVisibility('all', numbers, choices);
  const total = numbers.filter(isGridField).length + choices.filter(def => def.control !== 'editor').length;
  assert.equal(everything.inputCount, total, 'Everything must hide nothing');
  assert.ok(everything.inputCount > 60, 'the full surface is the one the audit found');

  // Groups whose fields are all filtered out disappear; ones with a visible field stay.
  assert.equal(shown.showsGroup('market'), false);
  assert.equal(shown.showsGroup('portfolios'), false);
  assert.equal(shown.showsGroup('wrappers'), false);
  assert.equal(shown.showsGroup('simulation'), false);
  assert.equal(shown.showsGroup('personal'), true);
  assert.equal(shown.showsGroup('assets'), true);
  assert.equal(everything.showsGroup('market'), true);
  assert.equal(minimal.showsGroup('income'), true);
  assert.equal(minimal.showsGroup('liquidity'), false);
});

test('tier depth is cumulative, so a filter only ever adds to the one below it', () => {
  assert.equal(tierInMode('essential', 'essential'), true);
  assert.equal(tierInMode('common', 'essential'), false);
  assert.equal(tierInMode('common', 'common'), true);
  assert.equal(tierInMode('expert', 'common'), false);
  assert.equal(tierInMode('expert', 'all'), true);
  assert.deepEqual(TIER_MODES.map(option => option.mode), ['essential', 'common', 'all']);

  const choices = choiceFieldsFor(example);
  const ids = (mode: TierMode) => {
    const visibility = fieldVisibility(mode, defs, choices);
    return new Set([...defs, ...choices].map(def => def.id).filter(id => visibility.shows(id)));
  };
  const essential = ids('essential');
  const common = ids('common');
  const all = ids('all');
  for (const id of essential) assert.ok(common.has(id), `${id} vanished when the filter widened`);
  for (const id of common) assert.ok(all.has(id), `${id} vanished at Everything`);
  assert.equal(all.size, defs.length + choices.length);
});

test('filtering is display only: the profile, the validation and the run key never move', () => {
  const options = defaultLedgerOptions();
  const drafts = { 'income.salaryAnnual': '61000' };
  const before = JSON.stringify(example);
  const baselineKey = runKey(example, options);
  const baselineIssues = JSON.stringify(validateDrafts(example, drafts).issues);

  for (const option of TIER_MODES) {
    const visibility = fieldVisibility(option.mode, defs, choiceFieldsFor(example),
      validateDrafts(example, drafts).issues);
    assert.ok(visibility.inputCount >= 0);
    assert.equal(JSON.stringify(example), before, `${option.mode} mutated the profile`);
    assert.equal(runKey(example, options), baselineKey, `${option.mode} moved the run key`);
    assert.equal(JSON.stringify(validateDrafts(example, drafts).issues), baselineIssues,
      `${option.mode} changed the validation state`);
    // A hidden field still holds its stored value, and the engine still receives it.
    assert.equal(fieldValue(example, defFor('market.equities.meanNominal')), 0.07);
  }

  // The same edit produces the same key whichever filter was on screen when it was made.
  const edited = writePath(example, ['income', 'salaryAnnual'], 61_000);
  assert.equal(runKey(edited, options), runKey(writePath(createExampleProfile(), ['income', 'salaryAnnual'], 61_000), options));
  assert.notEqual(runKey(edited, options), baselineKey);
});

test('a validation issue is never filtered away, however deep the field is', () => {
  // Correlation asymmetry is reported against the matrix, whose fields are all expert.
  const asymmetric = writePath(example, ['market', 'correlation', 0, 1], 0.9);
  const state = validateCandidate(asymmetric, defs);
  assert.equal(state.ok, false);
  const visibility = fieldVisibility('essential', defs, choiceFieldsFor(example), state.issues);
  assert.ok(visibility.shows('market.correlation'), 'the matrix must surface in Essential only');
  assert.ok(visibility.showsGroup('market'), 'its group must surface with it');
  // Nothing else expert came along for the ride.
  assert.equal(visibility.shows('simulation.seed'), false);
  assert.equal(visibility.shows('market.equities.volatility'), false);

  // A cell-level issue forces both the cell and the editor that owns it.
  const cellIssues = [{ fieldId: 'market.correlation.0.1', group: 'market' as const, path: 'market.correlation.0.1', message: 'x' }];
  const forced = forcedFieldIds(cellIssues, ['market.correlation', 'market.correlation.0.1', 'market.correlation.0.2']);
  assert.deepEqual([...forced].sort(), ['market.correlation', 'market.correlation.0.1']);

  // An expert numeric field with its own issue surfaces in Essential only too.
  const badSeed = validateDrafts(example, { 'simulation.seed': '-1' });
  assert.equal(badSeed.ok, false);
  const seedVisible = fieldVisibility('essential', defs, choiceFieldsFor(example), badSeed.issues);
  assert.ok(seedVisible.shows('simulation.seed'));
  assert.ok(seedVisible.showsGroup('simulation'));
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
  assert.deepEqual(TABS.filter(tab => tab.status === 'built').map(tab => tab.id),
    ['overview', 'fire', 'curve', 'marginal', 'solver', 'scenarios', 'property', 'attribution']);
  for (const tab of TABS.filter(tab => tab.status === 'planned')) {
    assert.ok(tab.package >= 9, `${tab.id} must name a later package`);
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
