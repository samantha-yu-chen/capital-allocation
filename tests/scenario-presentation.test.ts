import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { parseProfile, type Profile } from '../src/domain/contracts.js';
import { addScenario, defaultScenarioOptions, emptyLibrary } from '../src/domain/scenarios.js';
import { defaultLedgerOptions } from '../src/engine/ledger.js';
import { runScenarioBatch, type ScenarioBatchResult } from '../src/engine/scenario.js';
import {
  SCENARIO_FIRE_FROM_FIELD, SCENARIO_FIRE_TO_FIELD, SCENARIO_PREVIEW_FIELD, SCENARIO_SALARY_FIELDS,
} from '../src/presentation/view/fields.js';
import {
  cacheNote, defaultScenarioSettings, dominanceNote, libraryRows, matrixGrid, scenarioConclusion,
  scenarioCostWarning, scenarioPlan, scenarioProgressLine, scenarioRows, scenarioSummary,
  spendingEffectRows, strategyLabel,
} from '../src/presentation/view/scenario-model.js';

const small = (count = 6): Profile => {
  const p = createExampleProfile();
  p.simulation.count = count;
  return parseProfile(p);
};
const settings = defaultScenarioSettings();
const options = defaultLedgerOptions();
const scenarioOptions = defaultScenarioOptions();
const plan = (profile: Profile, overrides: Partial<typeof settings> = {}, drafts: Record<string, string> = {}) =>
  scenarioPlan(profile, options, { ...settings, ...overrides }, drafts, scenarioOptions, []);

test('the matrix plan builds 60 cells and announces full-count work without reducing the count', () => {
  const profile = createExampleProfile();
  const model = plan(profile);
  assert.equal(model.issues.length, 0);
  assert.equal(model.cases.length, 60);
  assert.equal(model.previewPaths, null);
  assert.equal(model.simulations, 60);
  assert.equal(model.projections, 60 * 10_000);
  assert.match(model.announcement, /600,000 lifetime projections/);
  assert.match(model.announcement, /never reduced to finish sooner/);
  assert.equal(profile.simulation.count, 10_000);
  assert.deepEqual(model.spending, [1_300, 1_650, 2_000]);
  assert.deepEqual(model.salaries, [55_000, 65_000, 75_000, 90_000, 120_000]);
  assert.ok(scenarioCostWarning(model, profile));
  assert.equal(model.request.previewPaths, null);
  assert.equal(model.request.fireAgeSearch, null);
});

test('an unparseable control blocks the run instead of reusing the previous value', () => {
  const profile = createExampleProfile();
  for (const text of ['', 'abc', '-1', 'Infinity']) {
    const model = plan(profile, {}, { [SCENARIO_SALARY_FIELDS[2]!.id]: text });
    assert.ok(model.issues.some(issue => issue.id === SCENARIO_SALARY_FIELDS[2]!.id), text);
    assert.equal(model.cases.length, 0, 'no case is built while a control is invalid');
  }
  const preview = plan(profile, { previewEnabled: true }, { [SCENARIO_PREVIEW_FIELD.id]: '0' });
  assert.ok(preview.issues.some(issue => issue.id === SCENARIO_PREVIEW_FIELD.id));
  const range = plan(profile, { fireAgeEnabled: true }, { [SCENARIO_FIRE_FROM_FIELD.id]: '60', [SCENARIO_FIRE_TO_FIELD.id]: '50' });
  assert.ok(range.issues.some(issue => issue.id === SCENARIO_FIRE_TO_FIELD.id));
  const library = plan(profile, { view: 'library' });
  assert.ok(library.issues.some(issue => issue.id === null));
});

test('a preview is announced as a preview and counted at the requested paths', () => {
  const profile = createExampleProfile();
  const model = plan(profile, { previewEnabled: true });
  assert.equal(model.previewPaths, 1000);
  assert.match(model.announcement, /PREVIEW/);
  assert.match(model.announcement, /instead of the entered 10,000/);
  assert.equal(model.projections, 60 * 1000);
  const searched = plan(profile, { view: 'spending', fireAgeEnabled: true });
  assert.equal(searched.simulations, 3 * (1 + (48 - 43 + 1)));
  assert.match(searched.announcement, /complete simulations each/);
  assert.match(scenarioProgressLine(null), /Starting/);
  assert.match(scenarioProgressLine({ stage: 'ISA Heavy', casesCompleted: 2, casesPlanned: 60, paths: { completed: 5, total: 10 } }), /2 of 60/);
});

test('rows carry take-home, marginal tax, contributions, FIRE and wealth for every cell', async () => {
  const profile = small();
  const model = plan(profile);
  const result = await runScenarioBatch(profile, model.request);
  const rows = scenarioRows(result);
  assert.equal(rows.length, 60);
  const row = rows[0]!;
  assert.match(row.probability, /±/);
  assert.match(row.takeHome, /^£/);
  assert.match(row.marginalRate, /%$/);
  assert.match(row.pensionContribution, /^£/);
  assert.match(row.isaContribution, /^£/);
  assert.match(row.totalInvested, /^£/);
  assert.match(row.liquidAtFire, /^£/);
  assert.match(row.pensionAtFire, /^£/);
  assert.match(row.netWorthAtFire, /^£/);
  assert.match(row.terminalP10, /^£/);
  assert.match(row.fireAge, /^At 45$/);
  assert.ok(rows.every(r => r.status === 'evaluated' && r.reason === null));
  assert.equal(new Set(rows.map(r => r.strategy)).size, 4);
  assert.ok(rows.some(r => r.strategy === strategyLabel('property')));

  const grid = matrixGrid(result)!;
  assert.equal(grid.strategies.length, 4);
  assert.equal(grid.rows.length, 15);
  assert.ok(grid.rows.every(r => r.cells.length === 4));
  assert.match(dominanceNote(result)!, /moves FIRE success most/);
  assert.match(cacheNote(result), /computed from scratch/);
  const summary = scenarioSummary(result);
  assert.equal(summary.find(s => s.label === 'Scenarios evaluated')!.value, '60');
  assert.equal(summary.find(s => s.label === 'Paths per scenario')!.note, 'The entered count, in full');
  assert.equal(summary.find(s => s.label === 'Shared seed')!.value, String(profile.simulation.seed));
});

test('the spending table shows the surplus and the capital target from one run', async () => {
  const profile = small(8);
  const model = plan(profile, { view: 'spending' });
  const result = await runScenarioBatch(profile, model.request);
  const rows = spendingEffectRows(result);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.monthly), ['£1,300/mo', '£1,650/mo', '£2,000/mo']);
  const value = (text: string) => Number(text.replace(/[£,/mo]/g, ''));
  assert.ok(value(rows[0]!.surplus) > value(rows[2]!.surplus), 'surplus falls as spending rises');
  assert.ok(value(rows[0]!.capitalTarget) < value(rows[2]!.capitalTarget), 'the capital target rises as spending rises');
  assert.ok(value(rows[0]!.retirementSpending) < value(rows[2]!.retirementSpending));
  assert.equal(rows[0]!.fireAge, '—', 'no age is claimed when no search was run');
});

test('a lead inside the sampling interval is reported as a tie, and unsupported cells keep their reason', async () => {
  const profile = small(8);
  const result = await runScenarioBatch(profile, plan(profile, { view: 'spending' }).request);
  const conclusion = scenarioConclusion(result, profile.personal.targetSuccessProbability);
  assert.match(conclusion, /lead within paired sampling uncertainty|leads at/);

  const tied: ScenarioBatchResult = {
    ...result,
    cells: result.cells.map((cell, index) => ({ ...cell,
      simulation: { ...cell.simulation!, probability: 0.5 + index * 0.001, standardError: 0.05 } })),
  };
  assert.match(scenarioConclusion(tied, 0.9), /lead within paired sampling uncertainty/);
  const separated: ScenarioBatchResult = {
    ...result,
    cells: result.cells.map((cell, index) => ({ ...cell,
      simulation: { ...cell.simulation!, probability: index === 0 ? 0.95 : 0.2, standardError: 0.001 } })),
  };
  assert.match(scenarioConclusion(separated, 0.9), /leads at .*It clears the 90% target/);

  const none: ScenarioBatchResult = { ...result, cells: [], metadata: { ...result.metadata, evaluated: 0 } };
  assert.match(scenarioConclusion(none, 0.9), /No scenario in this batch could be evaluated/);
  const preview: ScenarioBatchResult = { ...result, metadata: { ...result.metadata, preview: true, simulationCount: 4, enteredSimulationCount: 10_000 } };
  assert.match(scenarioConclusion(preview, 0.9), /PREVIEW figures at 4 of 10,000 paths/);
});

test('saved scenarios are listed with the reproducibility inputs that make them comparable', () => {
  const profile = small();
  let stored = addScenario(emptyLibrary(), { name: 'Baseline', profile, origin: 'baseline' });
  stored = addScenario(stored, { name: 'High spend', profile, origin: 'custom',
    options: { ...defaultScenarioOptions(), monthlyHouseholdOverride: 2_000 } });
  const rows = libraryRows(stored.scenarios);
  assert.deepEqual(rows.map(r => r.name), ['Baseline', 'High spend']);
  assert.equal(rows[0]!.spending, 'Entered schedule');
  assert.equal(rows[1]!.spending, '£2,000/mo');
  assert.match(rows[0]!.paths, /6 paths, seed 421337/);
  assert.equal(rows[0]!.fireAge, '45');

  const model = scenarioPlan(profile, options, { ...settings, view: 'library' }, {}, scenarioOptions, stored.scenarios);
  assert.equal(model.issues.length, 0);
  assert.equal(model.cases.length, 2);
  assert.equal(model.simulations, 2);
});
