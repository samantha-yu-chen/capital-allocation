import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultLedgerOptions, runDeterministicProjection, runMonteCarlo, type FireAgeCurveResult } from '../src/engine/index.js';
import {
  computeOverview, ledgerRow, marginalOnIncrement, overviewHeadline, sampledProbabilityDigits,
} from '../src/presentation/view/overview-model.js';
import {
  CONFIDENCE_BANDS, WEALTH_CATEGORIES, confidenceBand, diagnosticRows, distributionRows, metadataRows,
  observedFailureRows, sequenceRows, successSplit, wealthSeries,
} from '../src/presentation/view/monte-carlo-model.js';
import { money, moneyCompact, moneySigned, percent, ratio } from '../src/presentation/view/format.js';
import { writePath } from '../src/presentation/view/fields.js';
import { runKey } from '../src/presentation/view/run-key.js';

const example = createExampleProfile();
const close = (actual: number, expected: number, tolerance: number, message: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

test('section 16 confidence bands label a probability without becoming the target', () => {
  // Spec §16's five labels, as half-open bands. A boundary belongs to the higher band.
  assert.deepEqual(CONFIDENCE_BANDS.map(b => b.label),
    ['Fragile', 'Moderate', 'Strong', 'High confidence', 'Very conservative']);
  const label = (p: number) => confidenceBand(p).label;
  assert.equal(label(0), 'Fragile');
  assert.equal(label(0.6899), 'Fragile');
  assert.equal(label(0.7), 'Moderate');
  assert.equal(label(0.7999), 'Moderate');
  assert.equal(label(0.8), 'Strong');
  assert.equal(label(0.8999), 'Strong');
  assert.equal(label(0.9), 'High confidence');
  assert.equal(label(0.9499), 'High confidence');
  assert.equal(label(0.95), 'Very conservative');
  assert.equal(label(1), 'Very conservative');
  // Every band is contiguous, so no probability falls between two labels.
  CONFIDENCE_BANDS.forEach((band, index) => {
    const previous = CONFIDENCE_BANDS[index - 1];
    if (previous) assert.equal(band.from, previous.to);
  });
  // The label is presentation only: the engine target is still the profile's own figure.
  assert.equal(example.personal.targetSuccessProbability, 0.9);
  assert.throws(() => confidenceBand(1.2), /between 0 and 1/);
  assert.throws(() => confidenceBand(Number.NaN), /between 0 and 1/);
});

test('the Overview headline publishes only completed, current runs with traceable plain-language copy', async () => {
  const profile = writePath(example, ['simulation', 'count'], 40);
  const options = defaultLedgerOptions();
  const key = runKey(profile, options);
  const result = await runMonteCarlo(profile, { batchSize: 8, ledgerOptions: options });

  const empty = overviewHeadline(key, null, null);
  assert.equal(empty.state, 'empty');
  assert.equal(empty.sentence, null);
  assert.equal(empty.probabilityText, null, 'an empty card never invents a number');
  assert.deepEqual(empty.sources, []);

  const stale = overviewHeadline(`${key}-changed`, { key, result }, null);
  assert.equal(stale.state, 'empty', 'a completed result for old inputs is still stale');
  assert.equal(stale.sentence, null);

  const curve: FireAgeCurveResult = {
    points: [{
      age: 58, status: 'evaluated', message: null, probability: 0.91, meetsTarget: true,
      standardError: 0.004, bridgeFailureProbability: 0.02, depletionProbability: 0.03,
      medianTerminalWealthReal: 500_000, medianFireCapitalReal: 700_000,
      medianLiquidAtFireReal: 450_000, bridgeYears: 0,
    }],
    targetProbability: 0.9, earliestQualifyingAge: 58, targetFireAge: 55,
    probabilityAtTargetAge: null, monotone: true, retirementSpendingAnnualReal: 19_800,
    referenceFireNumber: 565_714,
    metadata: {
      curveVersion: 'fire-age-curve-v1', engineVersion: result.metadata.engineVersion,
      generatorVersion: result.metadata.returnGeneratorVersion, seed: profile.simulation.seed,
      simulationCount: profile.simulation.count, pathIndices: { start: 0, endExclusive: profile.simulation.count },
      ledgerOptions: options, moneyBasis: 'today',
    },
  };
  const complete = overviewHeadline(key, { key, result }, { key, result: curve });
  assert.equal(complete.state, 'complete');
  assert.equal(complete.probability, result.successProbability);
  assert.match(complete.sentence!, new RegExp(`At your target of ${profile.personal.targetFireAge}, this plan succeeds in`));
  assert.match(complete.sentence!, /The earliest age that meets your 90% target is 58\./);
  assert.equal(complete.sources[0]!.tab, 'fire');
  assert.match(complete.sources[0]!.metadata, new RegExp(`40 paths, seed ${profile.simulation.seed}`));
  assert.equal(complete.sources[1]!.tab, 'curve');
  assert.match(complete.sources[1]!.metadata, /1 ages × 40 paths/);

  // UX-6: the "what would it take?" offer is gated on a measured shortfall, and is never in the
  // sentence — the sentence stays pure view data about runs that actually happened.
  assert.equal(empty.belowTarget, false, 'an offer to search needs a completed run behind it');
  assert.equal(stale.belowTarget, false, 'a stale result cannot open a search for the current plan');
  assert.equal(complete.targetProbability, profile.personal.targetSuccessProbability);
  assert.equal(complete.belowTarget, result.successProbability < profile.personal.targetSuccessProbability);
  for (const clause of ['what would it take', 'salary', 'solver']) {
    assert.ok(!complete.sentence!.toLowerCase().includes(clause), `the sentence stays free of "${clause}"`);
  }
  const short = overviewHeadline(key, { key, result: { ...result, successProbability: 0.5 } }, null);
  assert.equal(short.belowTarget, true);
  const over = overviewHeadline(key, { key, result: { ...result, successProbability: 0.95 } }, null);
  assert.equal(over.belowTarget, false, 'a plan that already clears its target is offered no fix');
  const exactly = overviewHeadline(key, { key, result: { ...result, successProbability: 0.9 } }, null);
  assert.equal(exactly.belowTarget, false, 'meeting the target exactly is meeting it');
  // A curve alone measures no probability for the entered plan, so it opens no search either.
  assert.equal(overviewHeadline(key, null, { key, result: curve }).belowTarget, false);
});

test('Overview headline bands and displayed precision follow the shared confidence rules', async () => {
  const profile = writePath(example, ['simulation', 'count'], 40);
  const options = defaultLedgerOptions();
  const key = runKey(profile, options);
  const result = await runMonteCarlo(profile, { batchSize: 8, ledgerOptions: options });
  for (const probability of [0, 0.7, 0.8, 0.9, 0.95, 1]) {
    const adjusted = {
      ...result,
      successProbability: probability,
      metadata: { ...result.metadata, simulationCount: 10_000 },
    };
    const model = overviewHeadline(key, { key, result: adjusted }, null);
    assert.equal(model.bandLabel, confidenceBand(probability).label);
    assert.equal(model.bandId, confidenceBand(probability).id);
  }
  assert.equal(sampledProbabilityDigits(0.69, 10_000), 1);
  assert.equal(overviewHeadline(key, {
    key,
    result: { ...result, successProbability: 0.69, metadata: { ...result.metadata, simulationCount: 10_000 } },
  }, null).probabilityText, '69.0%');
  assert.equal(sampledProbabilityDigits(0.69, 40), 0, 'a noisy small sample is not shown to decimal places');
  assert.throws(() => sampledProbabilityDigits(1.1, 10_000), /fraction/);
});

test('Overview reproduces the specification section 80 current position', () => {
  const model = computeOverview(example);
  // Spec §80: liquid £75,000, pension £25,000, property equity £0, net worth £100,000.
  assert.equal(model.position.liquid, 75_000);
  assert.equal(model.position.pension, 25_000);
  assert.equal(model.position.propertyEquity, 0);
  assert.equal(model.position.netWorth, 100_000);
  // The three components are reported separately and never collapsed into one figure.
  assert.equal(model.position.liquid + model.position.pension + model.position.propertyEquity, model.position.netWorth);
});

test('Overview reproduces the specification section 80 reference FIRE target', () => {
  const model = computeOverview(example);
  // §80: target spending £19,800 at a 3.5% reference rate gives £565,714.
  assert.equal(model.reference.retirementSpendingReal, 19_800);
  assert.equal(model.reference.withdrawalRate, 0.035);
  close(model.reference.referenceFireNumber, 565_714, 1, 'reference FIRE number');
  assert.equal(money(model.reference.referenceFireNumber), '£565,714');
});

test('Overview cash flow is read from the ledger rather than recomputed', () => {
  const model = computeOverview(example);
  const first = runDeterministicProjection(example).years[0]!;
  assert.equal(model.cashFlow.age, example.personal.currentAge);
  assert.equal(model.cashFlow.grossIncome, first.grossIncome);
  assert.equal(model.cashFlow.incomeTax, first.incomeTax);
  assert.equal(model.cashFlow.employeeNi, first.employeeNi);
  assert.equal(model.cashFlow.pensionContributionTotal, first.pensionContributionTotal);
  assert.equal(model.cashFlow.investableSurplus, first.investableSurplus);
  // Take-home is active income less the personal pension cost and the tax bill; the surplus is
  // exactly what remains after spending and capital needs.
  close(
    model.cashFlow.takeHome - model.cashFlow.totalSpending - model.cashFlow.capitalNeeds,
    model.cashFlow.investableSurplus, 1e-6, 'surplus reconciles with take-home',
  );
  close(model.cashFlow.savingsRate, model.cashFlow.investableSurplus / model.cashFlow.takeHome, 1e-12, 'savings rate');
});

test('the marginal rate comes from re-running the engine, not a parallel tax formula', () => {
  const options = defaultLedgerOptions();
  const first = runDeterministicProjection(example, options).years[0]!;
  const outcome = marginalOnIncrement(example, first, options, 1_000);
  assert.ok('model' in outcome);
  const uplifted = runDeterministicProjection(
    writePath(example, ['income', 'salaryAnnual'], example.income.salaryAnnual + 1_000), options,
  ).years[0]!;
  assert.equal(outcome.model.incomeTax, uplifted.incomeTax - first.incomeTax);
  assert.equal(outcome.model.employeeNi, uplifted.employeeNi - first.employeeNi);
  assert.equal(outcome.model.rate, outcome.model.total / 1_000);
  // A Scottish higher-rate-ish earner under 5% salary sacrifice: a real, bounded rate.
  assert.ok(outcome.model.rate > 0 && outcome.model.rate < 1, `implausible marginal rate ${outcome.model.rate}`);
});

test('a property profile projects its actual equity', () => {
  const withProperty = writePath(example, ['property'], {
    use: 'owner_occupied', marketValue: 300_000, mortgageBalance: 200_000, mortgageAnnualRate: 0.045,
    mortgageTermYears: 25, mortgageType: 'repayment', maintenanceAnnual: 3_000, insuranceAnnual: 400,
    serviceChargeAnnual: 0, councilTaxAnnual: 1_800, rentAnnual: 0, occupancyRate: 0, managementRate: 0,
    purchase: null, sale: null, rateChanges: [],
  });
  assert.equal(computeOverview(withProperty).position.propertyEquity, 100000);
});

test('a ledger row carries both bases, with real values deflated by the right index', () => {
  const projection = runDeterministicProjection(example);
  const year = projection.years[10]!;
  const row = ledgerRow(year);
  assert.equal(row.age, example.personal.currentAge + 10);
  // Flows use the opening index; closing balances use the closing index.
  close(row.real.grossIncome, year.grossIncome / year.inflationIndex, 1e-9, 'real gross income');
  close(row.real.netWorth, year.netWorth / year.closingInflationIndex, 1e-9, 'real net worth');
  assert.equal(row.nominal.grossIncome, year.grossIncome);
  assert.equal(row.nominal.netWorth, year.netWorth);
  // Year zero has an opening index of one, so the two bases agree there.
  const firstRow = ledgerRow(projection.years[0]!);
  assert.equal(firstRow.inflationIndex, 1);
  assert.equal(firstRow.real.grossIncome, firstRow.nominal.grossIncome);
});

test('the ledger browser covers every projected year', () => {
  const model = computeOverview(example);
  assert.equal(model.rows.length, example.personal.endAge - example.personal.currentAge);
  assert.equal(model.rows[0]!.age, example.personal.currentAge);
  assert.equal(model.rows[model.rows.length - 1]!.age, example.personal.endAge - 1);
  assert.deepEqual(
    [...new Set(model.rows.map(row => row.phase))].sort(),
    ['accumulation', 'bridge', 'retirement'],
  );
});

test('Monte Carlo display model reads the result without re-deriving it', async () => {
  const profile = writePath(example, ['simulation', 'count'], 40);
  const result = await runMonteCarlo(profile, { batchSize: 8 });

  const split = successSplit(result);
  close(split.success + split.failure, 1, 1e-12, 'success and failure partition the paths');
  assert.equal(split.success, result.successProbability);

  const failures = observedFailureRows(result);
  assert.equal(failures.length, 5, 'every observed failure code is reported, including zeroes');
  for (let i = 1; i < failures.length; i++) {
    assert.ok(failures[i - 1]!.probability >= failures[i]!.probability, 'rows are ordered by frequency');
  }
  assert.equal(
    failures.find(row => row.code === 'pre_pension_liquidity')!.probability,
    result.bridgeFailureProbability,
  );
  assert.equal(
    failures.find(row => row.code === 'portfolio_depletion')!.probability,
    result.depletionProbability,
  );

  const terminal = distributionRows(result.terminalWealth);
  assert.deepEqual(terminal.map(row => row.label), ['Mean', 'P10', 'P25', 'Median', 'P75', 'P90', 'Worst observed']);
  assert.equal(terminal.find(row => row.label === 'Median')!.value, result.terminalWealth.median);
  assert.ok(/not a guaranteed downside bound/.test(terminal[6]!.note ?? ''));

  for (const category of WEALTH_CATEGORIES) {
    const series = wealthSeries(result, category.id);
    assert.equal(series.length, result.wealthByAge.length);
    assert.equal(series[0]!.age, profile.personal.currentAge);
    assert.equal(series[series.length - 1]!.age, profile.personal.endAge);
    for (const point of series) {
      assert.ok(point.p10 <= point.median && point.median <= point.p90, 'percentiles are ordered');
    }
  }
  // Property equity stays zero everywhere until package 5 integrates it.
  assert.ok(wealthSeries(result, 'propertyEquity').every(point => point.p90 === 0));

  const sequence = sequenceRows(result);
  assert.equal(sequence.length, 4);
  assert.ok(/Conditional on an observed recovery/.test(sequence[3]!.note));
  assert.ok(sequence[3]!.note.includes(String(result.sequenceRisk.recoveredPaths)));
  assert.ok(sequence[3]!.note.includes(String(result.sequenceRisk.unrecoveredPaths)));

  const diagnostics = diagnosticRows(result);
  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]!.paths, result.diagnostics.earlyEquityCrash.paths);
  assert.equal(diagnostics[1]!.failureWhenPresent, result.diagnostics.highEarlyInflation.failureProbabilityWhenPresent);

  const metadata = metadataRows(result);
  const value = (label: string) => metadata.find(row => row.label === label)?.value;
  assert.equal(value('Paths completed'), '40');
  assert.equal(value('Seed'), String(profile.simulation.seed));
  assert.equal(value('Return generator'), result.metadata.returnGeneratorVersion);
  assert.equal(value('Percentile method'), 'linear-(n-1)p');
  assert.ok(value('Money basis')!.startsWith('today'));
  assert.equal(value('Path index range'), '[0, 40)');
  // Spec §36: holding the tax structure constant is permitted, but the output must disclose it.
  const taxPolicy = value('Tax policy')!;
  assert.ok(taxPolicy.startsWith(result.metadata.taxPolicy), 'the policy token is still reported verbatim');
  assert.match(taxPolicy, /held constant in real terms for the whole projection/);
  assert.match(taxPolicy, /Future changes to tax law are not modelled/);
  assert.ok(taxPolicy.includes(profile.personal.taxYear), 'the disclosure names the configured tax year');
});

test('the requested path count is what runs', async () => {
  const profile = writePath(example, ['simulation', 'count'], 37);
  const result = await runMonteCarlo(profile, { batchSize: 10 });
  assert.equal(result.metadata.simulationCount, 37);
  assert.equal(metadataRows(result).find(row => row.label === 'Paths completed')!.value, '37');
});

test('formatting keeps infinities, negatives and missing values honest', () => {
  assert.equal(money(565_714.2857), '£565,714');
  assert.equal(money(Number.NaN), '—');
  assert.equal(moneySigned(-1_200), '-£1,200');
  assert.equal(moneySigned(1_200), '+£1,200');
  assert.equal(percent(0.6898, 2), '68.98%');
  assert.equal(percent(Number.NaN), '—');
  // A coverage ratio with nothing required is not an error; it is "no requirement".
  assert.equal(ratio(Infinity), 'no requirement');
  assert.equal(ratio(1.2345), '1.23×');
  assert.equal(moneyCompact(2_041_888), '£2.0m');
  assert.equal(moneyCompact(645_336), '£645k');
  assert.equal(moneyCompact(-980), '-£980');
});
