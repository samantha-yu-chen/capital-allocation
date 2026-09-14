import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { parseProfile, type Profile } from '../src/domain/contracts.js';
import {
  MAX_SCENARIOS, SCENARIO_LIBRARY_KIND, addScenario, createScenario, defaultScenarioOptions,
  duplicateScenario, emptyLibrary, loadScenarioLibrary, memoryScenarioStorage, readScenarioLibrary,
  removeScenario, replaceScenario, saveScenarioLibrary, serialiseLibrary,
} from '../src/domain/scenarios.js';
import {
  CAPITAL_STRATEGIES, SCENARIO_PRESETS, bandOptimisedContribution, buildIncomeCases,
  buildLibraryCases, buildScenarioMatrix, buildSpendingCases, capitalStrategy, engineVersions,
  memoryScenarioCache, runScenarioBatch, scenarioCellKey, scenarioPreset,
} from '../src/engine/scenario.js';
import { defaultLedgerOptions, runDeterministicProjection } from '../src/engine/ledger.js';
import { runMonteCarlo, simulateBatch } from '../src/engine/monte-carlo/simulation.js';
import { createWorkerPool } from '../src/engine/monte-carlo/worker-pool.js';
import { getTaxConfig, taxInputFromProfile, calculateNetIncome } from '../src/domain/tax/index.js';
import { defaultProperty } from '../src/presentation/view/property-model.js';

const small = (count = 8): Profile => {
  const p = createExampleProfile();
  p.simulation.count = count;
  return parseProfile(p);
};
const context = (profile: Profile) => ({ property: defaultProperty(profile), salaryAxis: [55_000, 65_000, 75_000, 90_000, 120_000] });
const SALARIES = [55_000, 65_000, 75_000, 90_000, 120_000];
const SPENDING = [1_300, 1_650, 2_000];

// ---------------------------------------------------------------------------
// Named scenarios and versioned persistence
// ---------------------------------------------------------------------------

test('saved scenarios round-trip through a versioned document and reject anything unvalidated', () => {
  const profile = small();
  let library = addScenario(emptyLibrary(), { name: 'Baseline', profile, origin: 'baseline' });
  library = addScenario(library, { name: 'Pension Heavy', profile, origin: 'pension_heavy',
    options: { ...defaultScenarioOptions(), monthlyHouseholdOverride: 1_650 } });
  const storage = memoryScenarioStorage();
  saveScenarioLibrary(storage, library, '2026-09-14T00:00:00.000Z');

  const reloaded = readScenarioLibrary(storage);
  assert.equal(reloaded.ok, true);
  assert.ok(reloaded.ok);
  assert.equal(reloaded.empty, false);
  assert.equal(reloaded.migratedFrom, null);
  assert.deepEqual(reloaded.library.scenarios.map(s => s.name), ['Baseline', 'Pension Heavy']);
  assert.deepEqual(reloaded.library.scenarios[0]!.profile, profile);
  assert.equal(reloaded.library.scenarios[1]!.options.monthlyHouseholdOverride, 1_650);
  assert.equal(reloaded.library.savedAt, '2026-09-14T00:00:00.000Z');

  // Anything the profile schema would reject must not load, even from "our own" storage.
  const corrupted = JSON.parse(serialiseLibrary(library)) as { scenarios: { profile: Profile }[] };
  corrupted.scenarios[0]!.profile.income.salaryAnnual = -1;
  const rejected = loadScenarioLibrary(corrupted);
  assert.equal(rejected.ok, false);
  assert.ok(!rejected.ok && rejected.issues.some(i => i.includes('salaryAnnual')));

  for (const bad of ['{', '[]', 'null', JSON.stringify({ kind: 'something-else', version: '2', savedAt: 'x', scenarios: [] }),
    JSON.stringify({ kind: SCENARIO_LIBRARY_KIND, version: '9', savedAt: 'x', scenarios: [] })]) {
    assert.equal(loadScenarioLibrary(bad).ok, false, bad);
  }
  const duplicated = JSON.parse(serialiseLibrary(library)) as { scenarios: unknown[] };
  duplicated.scenarios.push(JSON.parse(JSON.stringify(duplicated.scenarios[0])));
  const duplicateLoad = loadScenarioLibrary(duplicated);
  assert.ok(!duplicateLoad.ok && duplicateLoad.issues.some(i => i.includes('Duplicate scenario id')));

  assert.equal(readScenarioLibrary(memoryScenarioStorage()).empty, true);
});

test('a schema-1 library migrates on load and a schema-1 document is never read as schema 2', () => {
  const profile = small();
  const v1 = {
    kind: SCENARIO_LIBRARY_KIND, version: '1', savedAt: '2026-01-01T00:00:00.000Z',
    scenarios: [{ schemaVersion: '1', id: 'baseline', name: 'Old baseline', profile }],
  };
  const migrated = loadScenarioLibrary(v1);
  assert.ok(migrated.ok);
  assert.equal(migrated.migratedFrom, '1');
  assert.equal(migrated.library.version, '2');
  const scenario = migrated.library.scenarios[0]!;
  assert.equal(scenario.schemaVersion, '2');
  assert.equal(scenario.id, 'baseline');
  assert.equal(scenario.origin, 'migrated-v1');
  assert.deepEqual(scenario.options, defaultScenarioOptions());
  assert.deepEqual(scenario.profile, profile);

  // The migration still validates: a v1 document with an invalid profile is rejected, not upgraded.
  const broken = JSON.parse(JSON.stringify(v1)) as typeof v1;
  broken.scenarios[0]!.profile.simulation.count = 0;
  assert.equal(loadScenarioLibrary(broken).ok, false);
  // A v1 document carrying a v2-only field is rejected rather than partially migrated.
  const mixed = JSON.parse(JSON.stringify(v1)) as { scenarios: Record<string, unknown>[] };
  mixed.scenarios[0]!['options'] = defaultScenarioOptions();
  assert.equal(loadScenarioLibrary({ ...v1, scenarios: mixed.scenarios }).ok, false);
});

test('editing or duplicating one scenario cannot mutate another', () => {
  const profile = small();
  let library = addScenario(emptyLibrary(), { name: 'A', profile });
  library = addScenario(library, { name: 'B', profile });
  const [a, b] = library.scenarios as [typeof library.scenarios[number], typeof library.scenarios[number]];
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.profile, b.profile);

  const copy = duplicateScenario(a, 'A copy');
  assert.notEqual(copy.id, a.id);
  copy.profile.income.salaryAnnual = 999_999;
  copy.options.monthlyHouseholdOverride = 4_000;
  assert.equal(a.profile.income.salaryAnnual, profile.income.salaryAnnual);
  assert.equal(a.options.monthlyHouseholdOverride, null);

  const edited = replaceScenario(library, a.id, {
    profile: parseProfile({ ...profile, income: { ...profile.income, salaryAnnual: 120_000 } }),
    options: { ...defaultScenarioOptions(), surplusAllocation: 'gia_only' },
  });
  assert.equal(edited.scenarios[0]!.profile.income.salaryAnnual, 120_000);
  assert.equal(edited.scenarios[1]!.profile.income.salaryAnnual, profile.income.salaryAnnual);
  assert.equal(edited.scenarios[1]!.options.surplusAllocation, 'isa_then_gia');
  assert.equal(library.scenarios[0]!.profile.income.salaryAnnual, profile.income.salaryAnnual);

  // The caller's own object is never adopted by reference either.
  const source = small();
  const held = createScenario({ name: 'Held', profile: source });
  source.assets.cash = 12_345;
  assert.notEqual(held.profile.assets.cash, 12_345);

  // Adding a colliding name suffixes rather than replacing an existing scenario.
  const collided = addScenario(library, { name: 'A', profile });
  assert.deepEqual(collided.scenarios.map(s => s.name), ['A', 'B', 'A 2']);
  assert.equal(removeScenario(collided, b.id).scenarios.length, 2);
  assert.throws(() => replaceScenario(library, 'missing', { name: 'x' }), /Unknown scenario/);
  let full = emptyLibrary();
  for (let i = 0; i < MAX_SCENARIOS; i++) full = addScenario(full, { name: `S${i}`, profile });
  assert.throws(() => addScenario(full, { name: 'one too many', profile }), /at most/);
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

test('the band-optimised strategy removes a real tax band and the presets stay distinct', () => {
  const profile = small();
  const config = getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear);
  const bandOf = (candidate: Profile): number => {
    const settled = calculateNetIncome(taxInputFromProfile(candidate), config);
    const last = settled.tax.nonSavingsSlices.at(-1)!;
    return config.nonSavingsBands.findIndex(band => band.name === last.band);
  };
  const solved = bandOptimisedContribution(profile);
  assert.ok(solved.rate > profile.pension.employeeRate, solved.reason);
  const optimised = parseProfile({ ...profile, pension: { ...profile.pension, employeeRate: solved.rate } });
  assert.ok(bandOf(optimised) < bandOf(profile), 'the optimised contribution must vacate the top occupied band');
  // Minimal: a materially smaller contribution must not already clear the band.
  const smaller = parseProfile({ ...profile, pension: { ...profile.pension, employeeRate: solved.rate - 0.005 } });
  assert.equal(bandOf(smaller), bandOf(profile));

  const plan = { profile, options: defaultScenarioOptions() };
  const rates = new Map(CAPITAL_STRATEGIES.map(id => [id, capitalStrategy(id).apply(plan, context(profile)).profile.pension.employeeRate]));
  assert.equal(rates.get('isa_heavy'), Math.min(profile.pension.employeeRate, profile.pension.matchUpToRate));
  assert.equal(rates.get('balanced'), profile.pension.employeeRate);
  assert.equal(rates.get('pension_band_optimised'), solved.rate);
  assert.equal(capitalStrategy('property').apply(plan, context(profile)).profile.property !== null, true);
  assert.equal(capitalStrategy('balanced').apply(plan, context(profile)).profile.property, null);

  // Every section 64 preset either produces a plan or states why it cannot.
  for (const id of SCENARIO_PRESETS) {
    const preset = scenarioPreset(id);
    try {
      const outcome = preset.apply(plan, context(profile));
      assert.ok(outcome.note.length > 0, id);
      parseProfile(outcome.profile);
    } catch (error) {
      assert.match(String(error), /UnsupportedScenarioError|already/, id);
    }
  }
  assert.equal(scenarioPreset('income_growth').apply(plan, context(profile)).profile.income.salaryAnnual, 65_000);
  assert.ok(scenarioPreset('pension_heavy').apply(plan, context(profile)).profile.pension.employeeRate > profile.pension.employeeRate);
  assert.equal(scenarioPreset('aggressive_fire').apply(plan, context(profile)).profile.personal.targetFireAge, profile.personal.targetFireAge - 3);
  assert.equal(scenarioPreset('conservative_fire').apply(plan, context(profile)).profile.personal.targetFireAge, profile.personal.targetFireAge + 3);
  assert.throws(() => scenarioPreset('no_property').apply(plan, context(profile)), /already has no property/);
});

test('a plan that already owns a property keeps it and reports the unsupported cases honestly', () => {
  const base = small();
  const owned = parseProfile({ ...base, property: { ...defaultProperty(base), purchase: null } });
  const plan = { profile: owned, options: defaultScenarioOptions() };
  for (const id of ['isa_heavy', 'balanced', 'pension_band_optimised'] as const)
    assert.notEqual(capitalStrategy(id).apply(plan, context(owned)).profile.property, null, id);
  assert.throws(() => capitalStrategy('property').apply(plan, context(owned)), /already owns/);
  assert.throws(() => scenarioPreset('no_property').apply(plan, context(owned)), /would delete an asset/);

  const cases = buildScenarioMatrix(owned, { salaries: [55_000], monthlySpending: [1_650], strategies: [...CAPITAL_STRATEGIES], context: context(owned) });
  const property = cases.find(c => c.axes.strategy === 'property')!;
  assert.equal(property.status, 'unsupported');
  assert.ok(property.status === 'unsupported' && /already owns/.test(property.reason));
  assert.equal(cases.filter(c => c.status === 'planned').length, 3);
});

// ---------------------------------------------------------------------------
// Matrix, common paths, cache and cancellation
// ---------------------------------------------------------------------------

test('all 60 salary x spending x strategy combinations are available and reproducible', async () => {
  const profile = small(6);
  const cases = buildScenarioMatrix(profile, { salaries: SALARIES, monthlySpending: SPENDING, strategies: [...CAPITAL_STRATEGIES], context: context(profile) });
  assert.equal(cases.length, 60);
  assert.equal(new Set(cases.map(c => c.id)).size, 60);
  assert.equal(cases.filter(c => c.status === 'planned').length, 60);

  const result = await runScenarioBatch(profile, { cases });
  assert.equal(result.cells.length, 60);
  assert.equal(result.metadata.evaluated, 60);
  assert.equal(result.metadata.unsupported, 0);
  assert.equal(result.metadata.preview, false);
  assert.equal(result.metadata.simulationCount, 6);
  assert.equal(result.metadata.seed, profile.simulation.seed);
  assert.ok(result.cells.every(c => c.simulation && c.deterministic));
  assert.equal(new Set(result.cells.map(c => c.simulation!.simulationCount)).size, 1);
  // Every axis value is actually represented.
  assert.deepEqual([...new Set(result.cells.map(c => c.axes.salary))].sort((a, b) => a! - b!), SALARIES);
  assert.deepEqual([...new Set(result.cells.map(c => c.axes.monthlySpending))].sort((a, b) => a! - b!), SPENDING);
  assert.equal(new Set(result.cells.map(c => c.axes.strategy)).size, 4);
  assert.equal(result.cells.filter(c => c.plan!.hasProperty).length, 15);

  // Reproducible: a second batch returns identical numbers.
  const again = await runScenarioBatch(profile, { cases });
  assert.deepEqual(again.cells.map(c => c.simulation!.probability), result.cells.map(c => c.simulation!.probability));
  assert.deepEqual(again.cells.map(c => c.simulation!.terminalMedian), result.cells.map(c => c.simulation!.terminalMedian));
});

test('a scenario cell replays the identical common-path simulation the engine runs directly', async () => {
  const profile = small(12);
  const cases = buildScenarioMatrix(profile, { salaries: [75_000], monthlySpending: [1_650], strategies: ['balanced', 'property'], context: context(profile) });
  const result = await runScenarioBatch(profile, { cases });
  for (const [index, cell] of result.cells.entries()) {
    const item = cases[index]!;
    assert.ok(item.status === 'planned');
    const direct = await runMonteCarlo(item.plan.profile, { ledgerOptions: { ...defaultLedgerOptions(), ...item.plan.options } });
    assert.equal(cell.simulation!.probability, direct.successProbability);
    assert.equal(cell.simulation!.terminalMedian, direct.terminalWealth.median);
    assert.equal(cell.simulation!.terminalP10, direct.terminalWealth.p10);
    assert.equal(cell.simulation!.liquidAtFire,
      direct.wealthByAge[profile.personal.targetFireAge - profile.personal.currentAge]!.liquid.median);
    assert.deepEqual(direct.metadata.pathIndices, result.metadata.pathIndices);
    assert.equal(direct.metadata.seed, profile.simulation.seed);
  }
  // A saved scenario that changes the draw is reported as incomparable rather than silently compared.
  const foreign = parseProfile({ ...profile, simulation: { ...profile.simulation, seed: profile.simulation.seed + 1 } });
  const mixed = await runScenarioBatch(profile, {
    cases: buildLibraryCases([
      { id: 'same', name: 'Same seed', profile, options: defaultScenarioOptions() },
      { id: 'other', name: 'Other seed', profile: foreign, options: defaultScenarioOptions() },
    ]),
  });
  assert.equal(mixed.cells[0]!.status, 'evaluated');
  assert.equal(mixed.cells[1]!.status, 'unsupported');
  assert.match(mixed.cells[1]!.reason!, /seed/);
});

test('cache keys cover every versioned input and a hit is only reused for identical inputs', async () => {
  const profile = small(6);
  const options = defaultLedgerOptions();
  const key = scenarioCellKey(profile, options);
  assert.equal(key, scenarioCellKey(parseProfile(JSON.parse(JSON.stringify(profile))), { ...options }));

  const changes: [string, () => string][] = [
    ['seed', () => scenarioCellKey(parseProfile({ ...profile, simulation: { ...profile.simulation, seed: 1 } }), options)],
    ['count', () => scenarioCellKey(parseProfile({ ...profile, simulation: { ...profile.simulation, count: 7 } }), options)],
    ['salary', () => scenarioCellKey(parseProfile({ ...profile, income: { ...profile.income, salaryAnnual: 56_000 } }), options)],
    ['market', () => scenarioCellKey(parseProfile({ ...profile, market: { ...profile.market, assumptionVersion: 'other' } }), options)],
    ['retirementLevel', () => scenarioCellKey(profile, { ...options, retirementLevel: 'floor' })],
    ['spendingOverride', () => scenarioCellKey(profile, { ...options, monthlyHouseholdOverride: 1_650 })],
    ['surplusAllocation', () => scenarioCellKey(profile, { ...options, surplusAllocation: 'gia_only' })],
    ['fundEmergencyReserve', () => scenarioCellKey(profile, { ...options, fundEmergencyReserve: false })],
    ['measureAllocation', () => scenarioCellKey(profile, { ...options, measureAllocation: true })],
    ['solverTolerance', () => scenarioCellKey(profile, { ...options, solverTolerance: 1e-5 })],
    ['solverMaxIterations', () => scenarioCellKey(profile, { ...options, solverMaxIterations: 61 })],
    ['fireAgeSearch', () => scenarioCellKey(profile, options, { fromAge: 40, toAge: 45 })],
  ];
  for (const [name, build] of changes) assert.notEqual(build(), key, `${name} must change the cache key`);
  for (const version of Object.values(engineVersions(profile))) assert.ok(key.includes(version), version);

  const cache = memoryScenarioCache();
  const cases = buildSpendingCases(profile, SPENDING, 'balanced', context(profile));
  let evaluations = 0;
  const counting = async (candidate: Profile, inner: { ledgerOptions: typeof options }) => {
    evaluations += 1;
    return runMonteCarlo(candidate, { ledgerOptions: inner.ledgerOptions });
  };
  const first = await runScenarioBatch(profile, { cases }, { cache, evaluate: counting });
  assert.equal(evaluations, 3);
  assert.equal(first.metadata.cacheHits, 0);
  const second = await runScenarioBatch(profile, { cases }, { cache, evaluate: counting });
  assert.equal(evaluations, 3, 'identical inputs must reuse the cached cells');
  assert.equal(second.metadata.cacheHits, 3);
  assert.ok(second.cells.every(c => c.fromCache));
  assert.deepEqual(second.cells.map(c => c.simulation!.probability), first.cells.map(c => c.simulation!.probability));
  // A different transport-level ledger option is a different key, so it recomputes.
  await runScenarioBatch(profile, { cases, ledgerOptions: { solverTolerance: 1e-5 } }, { cache, evaluate: counting });
  assert.equal(evaluations, 6);
  // A scenario's own plan options win over the transport defaults, so they cannot be overridden away.
  const overridden = await runScenarioBatch(profile, { cases, ledgerOptions: { monthlyHouseholdOverride: 9_999 } }, { cache, evaluate: counting });
  assert.equal(evaluations, 6);
  assert.deepEqual(overridden.cells.map(c => c.axes.monthlySpending), SPENDING);
});

test('an explicit preview is labelled and never substituted for a full-count run', async () => {
  const profile = small(20);
  const cases = buildSpendingCases(profile, [1_650], 'balanced', context(profile));
  const preview = await runScenarioBatch(profile, { cases, previewPaths: 4 });
  assert.equal(preview.metadata.preview, true);
  assert.equal(preview.metadata.simulationCount, 4);
  assert.equal(preview.metadata.enteredSimulationCount, 20);
  assert.equal(preview.cells[0]!.simulation!.simulationCount, 4);

  const full = await runScenarioBatch(profile, { cases });
  assert.equal(full.metadata.preview, false);
  assert.equal(full.metadata.simulationCount, 20);
  // The preview shares the cheaper prefix of the same paths but is a different, separately keyed result.
  assert.notEqual(preview.cells[0]!.key, full.cells[0]!.key);
  const cache = memoryScenarioCache();
  await runScenarioBatch(profile, { cases, previewPaths: 4 }, { cache });
  const afterPreview = await runScenarioBatch(profile, { cases }, { cache });
  assert.equal(afterPreview.metadata.cacheHits, 0, 'a preview must never satisfy a full-count request');
  assert.equal(afterPreview.metadata.simulationCount, 20);
  await assert.rejects(runScenarioBatch(profile, { cases, previewPaths: 0 }), /previewPaths/);
});

test('cancelling after real progress publishes no cells at all', async () => {
  const profile = small(40);
  const cases = buildScenarioMatrix(profile, { salaries: SALARIES, monthlySpending: SPENDING, strategies: [...CAPITAL_STRATEGIES], context: context(profile) });
  const controller = new AbortController();
  const seen: number[] = [];
  const run = runScenarioBatch(profile, { cases }, {
    signal: controller.signal,
    onProgress: progress => {
      seen.push(progress.casesCompleted);
      if (progress.casesCompleted >= 2) controller.abort();
    },
  });
  await assert.rejects(run, (error: Error) => error.name === 'AbortError');
  assert.ok(seen.some(value => value >= 2), 'real progress must have been observed before cancelling');
  assert.ok(seen.at(-1)! < 60, 'the batch must not have completed');
});

test('a scenario run leaves the marginal and rent-investment actions alone', async () => {
  const profile = small(4);
  const cases = buildSpendingCases(profile, [1_650], 'balanced', context(profile));
  await assert.rejects(runScenarioBatch(profile, { cases, ledgerOptions: { rentInvestment: { age: 40, amount: 1_000 } } }), /rentInvestment/);
  await assert.rejects(runScenarioBatch(profile, { cases, ledgerOptions: { marginalAction: { amount: 1_000, basis: 'gross_earnings', destination: 'isa' } } }), /marginalAction/);
  const clean = await runScenarioBatch(profile, { cases });
  assert.equal(clean.metadata.baseOptions.rentInvestment, null);
  assert.equal(clean.metadata.baseOptions.marginalAction, null);
  assert.equal(clean.metadata.baseOptions.measureAllocation, false);
});

// ---------------------------------------------------------------------------
// Spending and income effects
// ---------------------------------------------------------------------------

test('spending cases show both the surplus effect and the capital-target effect', async () => {
  const profile = small(12);
  const cases = buildSpendingCases(profile, SPENDING, 'balanced', context(profile));
  const result = await runScenarioBatch(profile, { cases });
  const [low, base, high] = result.cells.map(c => c.deterministic!) as [NonNullable<typeof result.cells[number]['deterministic']>, ...NonNullable<typeof result.cells[number]['deterministic']>[]];

  // Surplus effect: spending more leaves less to invest this year.
  assert.ok(low.investableSurplus > base!.investableSurplus);
  assert.ok(base!.investableSurplus > high!.investableSurplus);
  assert.ok(low.totalInvested > high!.totalInvested);
  // Capital-target effect: spending more raises the capital the plan must reach.
  assert.ok(low.retirementSpendingReal < base!.retirementSpendingReal);
  assert.ok(base!.referenceFireNumber < high!.referenceFireNumber);
  const near = (value: number, expected: number) => assert.ok(Math.abs(value - expected) < 1e-6, `${value} ≉ ${expected}`);
  near(low.retirementSpendingReal, 12 * 1_300);
  near(high!.retirementSpendingReal, 12 * 2_000);
  near(low.spendingTotal, 12 * 1_300);
  // Both effects point the same way, so probability falls as the spending case rises.
  const probabilities = result.cells.map(c => c.simulation!.probability);
  assert.ok(probabilities[0]! >= probabilities[1]!);
  assert.ok(probabilities[1]! >= probabilities[2]!);
  // The override reaches retirement years too, so this is not only a working-life surplus change.
  const projection = runDeterministicProjection(
    (cases[2] as Extract<typeof cases[number], { status: 'planned' }>).plan.profile,
    { ...defaultLedgerOptions(), monthlyHouseholdOverride: 2_000 });
  const retirementYear = projection.years.find(y => y.phase !== 'accumulation')!;
  near(retirementYear.spendingRequired / retirementYear.inflationIndex, 12 * 2_000);
});

test('income uplift cells report real take-home, marginal tax, contributions and wealth', async () => {
  const profile = small(8);
  const cases = buildIncomeCases(profile, SALARIES, 1_650, 'balanced', context(profile));
  const result = await runScenarioBatch(profile, { cases });
  assert.equal(result.cells.length, 5);
  const rows = result.cells.map(c => c.deterministic!);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i]!.takeHome > rows[i - 1]!.takeHome, 'take-home must rise with salary');
    assert.ok(rows[i]!.pensionTotal > rows[i - 1]!.pensionTotal);
    assert.ok(rows[i]!.totalInvested > rows[i - 1]!.totalInvested);
  }
  assert.ok(rows.every(row => row.marginalRate > 0 && row.marginalRate < 1));
  // £120k crosses the personal-allowance taper, so its marginal rate exceeds the £55k plan's.
  assert.ok(rows[4]!.marginalRate > rows[0]!.marginalRate);
  assert.ok(result.cells.every(c => c.simulation!.liquidAtFire >= 0 && c.simulation!.pensionAtFire >= 0));
  assert.ok(result.cells.every(c => c.simulation!.netWorthAtFire >= c.simulation!.liquidAtFire));
  assert.ok(result.cells.at(-1)!.simulation!.probability >= result.cells[0]!.simulation!.probability);
  // Take-home is measured after the member contribution, so it is below gross pay.
  assert.ok(rows.every(row => row.takeHome < row.grossIncome));
});

test('one worker set serves a whole batch and still returns identical results', async () => {
  const profile = small(10);
  let created = 0, terminated = 0;
  const pool = createWorkerPool(2, () => {
    created += 1;
    let reply: ((message: { result: ReturnType<typeof simulateBatch> }) => void) | null = null;
    return {
      post: request => queueMicrotask(() => reply?.({ result: simulateBatch(request) })),
      listen: handler => { reply = handler as typeof reply; },
      terminate: () => { terminated += 1; },
    };
  });
  const options = defaultLedgerOptions();
  const run = () => runMonteCarlo(profile, { concurrency: 2, batchSize: 3, executeBatch: pool.executeBatch, ledgerOptions: options });
  const first = await run();
  const second = await run();
  const third = await run();
  // A completed simulation must not tear down a pool its owner still holds.
  assert.equal(created, 2, 'the batch must reuse one worker set rather than respawning per simulation');
  assert.equal(terminated, 0);
  assert.equal(second.successProbability, first.successProbability);
  assert.equal(third.terminalWealth.median, first.terminalWealth.median);
  assert.deepEqual(second.metadata.pathIndices, first.metadata.pathIndices);
  pool.close();
  assert.equal(terminated, 2);
  await assert.rejects(run(), /closed/);
});

test('an optional FIRE age search reports the earliest qualifying age from complete simulations', async () => {
  const profile = small(6);
  const cases = buildSpendingCases(profile, [1_300], 'balanced', context(profile));
  const result = await runScenarioBatch(profile, { cases, fireAgeSearch: { fromAge: 45, toAge: 47 } });
  const fire = result.cells[0]!.fireAge!;
  assert.equal(fire.fromAge, 45);
  assert.equal(fire.toAge, 47);
  assert.ok(fire.earliestQualifyingAge === null || (fire.earliestQualifyingAge >= 45 && fire.earliestQualifyingAge <= 47));
  assert.equal(result.metadata.fireAgeSearch!.toAge, 47);
  assert.ok(result.cells[0]!.key!.includes('fireAgeSearch'));
});
