import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { referenceFireNumber, runDeterministicProjection } from '../src/engine/index.js';
import { close, profileWith, strippedProfile } from './ledger-helpers.js';

test('golden scenario A: the reference FIRE number is spending divided by the withdrawal rate', () => {
  // Spec section 87: GBP 40,000 at 4% is GBP 1,000,000.
  close(referenceFireNumber(40_000, 0.04), 1_000_000, 1e-9, 'scenario A');
  close(referenceFireNumber(30_000, 0.04), 750_000, 1e-9, 'section 18 example');
  // The fixture's own 3.5% reference.
  const metrics = runDeterministicProjection(createExampleProfile()).metrics;
  close(metrics.referenceFireNumber, 19_800 / 0.035, 1e-6, 'fixture');
  close(metrics.referenceFireRatio, metrics.investableAssetsAtFireReal / metrics.referenceFireNumber, 1e-9);
  assert.throws(() => referenceFireNumber(40_000, 0));
});

test('golden scenario C: very high starting wealth never fails', () => {
  const projection = runDeterministicProjection(strippedProfile(p => { p.assets.isa = 10_000_000; }));
  assert.equal(projection.success, true);
  assert.deepEqual(projection.failures, []);
  assert.equal(projection.metrics.yearsWithShortfall, 0);
  assert.equal(projection.metrics.firstFailureAge, null);
  for (const year of projection.years) close(year.spendingFunded, year.spendingRequired, 1e-4, `age ${year.age}`);
  assert.ok(projection.metrics.terminalNetWorthReal > 10_000_000);
});

test('golden scenario D: zero assets, zero income and positive spending fails every year', () => {
  const projection = runDeterministicProjection(strippedProfile(() => { /* everything already stripped */ }));
  assert.equal(projection.success, false);
  assert.equal(projection.metrics.firstFailureAge, 45);
  assert.equal(projection.metrics.yearsWithShortfall, projection.years.length);
  for (const year of projection.years) {
    assert.equal(year.spendingFunded, 0, `age ${year.age} funded spending from nothing`);
    close(year.shortfall, year.spendingRequired, 1e-6, `age ${year.age} shortfall`);
    assert.ok(year.failures.some(f => f.code === 'unfunded_essential_spending'));
    // With no pension at all this is plain depletion, NOT a locked-wealth failure.
    assert.ok(!year.failures.some(f => f.code === 'pre_pension_liquidity'),
      `age ${year.age} misattributed depletion to locked capital`);
    assert.equal(year.netWorth, 0);
  }
});

test('golden scenario E: wealth locked in an inaccessible pension fails the bridge', () => {
  // Spec sections 13 and 42: a large pension with zero liquid wealth before access age.
  const projection = runDeterministicProjection(strippedProfile(p => { p.assets.pension = 800_000; }));
  assert.equal(projection.success, false);
  const bridge = projection.years.filter(y => y.age < 57);
  const afterAccess = projection.years.filter(y => y.age >= 57);
  assert.equal(bridge.length, 12, 'a 45 to 57 bridge is twelve years');
  for (const year of bridge) {
    assert.equal(year.spendingFunded, 0, `age ${year.age} spent locked capital`);
    assert.equal(year.withdrawalsGross.pension, 0);
    // The defining property: failure while net worth is large and rising.
    assert.ok(year.failures.some(f => f.code === 'pre_pension_liquidity'), `age ${year.age} missing bridge failure`);
    assert.ok(year.failures.some(f => f.code === 'unfunded_essential_spending'));
    assert.equal(year.accessibleWealth, 0);
    assert.ok(year.lockedWealth > 800_000, `age ${year.age} locked wealth should keep compounding`);
    assert.ok(year.netWorth > 800_000);
  }
  // Once the pension unlocks the same plan funds itself, so the failure was liquidity, not solvency.
  for (const year of afterAccess) {
    assert.deepEqual(year.failures, [], `age ${year.age} should be funded after access age`);
    close(year.spendingFunded, year.spendingRequired, 1e-4, `age ${year.age}`);
  }
  assert.ok(projection.failures.every(f => f.age < 57));
  // Total net worth alone would have called this plan a success; the metrics keep them separate.
  const atBridge = bridge[0]!;
  assert.ok(atBridge.netWorth > 10 * atBridge.spendingRequired);
  assert.equal(projection.metrics.accessibleWealthAtFireReal, 0);
  assert.ok(projection.metrics.lockedWealthAtFireReal > 0);
  assert.equal(projection.metrics.liquidFireRatio, 0);
});

test('golden scenario F: lower spending both raises surplus and lowers the capital requirement', () => {
  const profile = createExampleProfile();
  const runs = [1300, 1650, 2000].map(monthly => ({
    monthly, run: runDeterministicProjection(profile, { monthlyHouseholdOverride: monthly }),
  }));
  for (let i = 1; i < runs.length; i += 1) {
    const lower = runs[i - 1]!;
    const higher = runs[i]!;
    // Effect one: more investable surplus while working (spec section 31).
    assert.ok(lower.run.years[0]!.investableSurplus > higher.run.years[0]!.investableSurplus,
      `surplus should fall as spending rises (${lower.monthly} vs ${higher.monthly})`);
    // Effect two: a smaller capital requirement (spec sections 18 and 13).
    assert.ok(lower.run.metrics.referenceFireNumber < higher.run.metrics.referenceFireNumber,
      'the reference FIRE number must fall with spending');
    assert.ok(lower.run.metrics.requiredBridgeCapitalReal < higher.run.metrics.requiredBridgeCapitalReal,
      'bridge capital required must fall with spending');
    // Both effects compound into more wealth.
    assert.ok(lower.run.metrics.accessibleWealthAtFireReal > higher.run.metrics.accessibleWealthAtFireReal);
    assert.ok(lower.run.metrics.terminalNetWorthReal > higher.run.metrics.terminalNetWorthReal);
  }
  // The GBP 1,300 / 1,650 / 2,000 cases are configurable inputs, never hard-coded.
  close(runs[0]!.run.years[0]!.spendingRequired, 15_600, 1e-9, 'low case');
  close(runs[1]!.run.years[0]!.spendingRequired, 19_800, 1e-9, 'base case');
  close(runs[2]!.run.years[0]!.spendingRequired, 24_000, 1e-9, 'high case');
  close(runs[0]!.run.years[0]!.investableSurplus - runs[2]!.run.years[0]!.investableSurplus, 8400, 0.01,
    'the surplus difference is exactly the spending difference');
});

test('floor, target and comfort retirement levels are distinct runs, not in-run spending cuts', () => {
  const profile = createExampleProfile();
  const levels = (['floor', 'target', 'comfort'] as const).map(retirementLevel =>
    runDeterministicProjection(profile, { retirementLevel }));
  const [floor, target, comfort] = levels;
  const retired = (index: number) => levels[index]!.years.find(y => y.phase !== 'accumulation')!;
  close(retired(0).spendingRequiredReal, 15_600, 1e-9, 'floor');
  close(retired(1).spendingRequiredReal, 19_800, 1e-9, 'target');
  close(retired(2).spendingRequiredReal, 24_000, 1e-9, 'comfort');
  // The floor is entirely essential; comfort adds discretionary on top of the same essential base.
  close(retired(0).spendingDiscretionaryRequired, 0, 1e-9, 'floor is all essential');
  close(retired(2).spendingEssentialRequired / retired(2).inflationIndex, 15_600, 1e-6, 'comfort keeps the essential base');
  // Working years are unaffected by the retirement level.
  close(floor!.years[0]!.spendingRequired, target!.years[0]!.spendingRequired, 1e-9, 'working years match');
  assert.ok(floor!.metrics.terminalNetWorthReal > comfort!.metrics.terminalNetWorthReal);
  // Spending stays at the chosen level every year: no dynamic cut turns failure into success.
  for (const year of comfort!.years.filter(y => y.phase !== 'accumulation'))
    close(year.spendingRequiredReal, 24_000, 1e-9, `age ${year.age} held the comfort level`);
});

test('negative investable surplus is funded from accessible accounts and recorded', () => {
  const projection = runDeterministicProjection(createExampleProfile());
  const bridge = projection.years.find(y => y.age === 45)!;
  // No earned income, so this year's flows cannot cover spending.
  assert.ok(bridge.investableSurplus < 0, 'the bridge year must show a negative surplus');
  assert.equal(bridge.allocatedToIsa, 0);
  assert.equal(bridge.allocatedToGia, 0);
  // It is funded from accessible capital, in the configured order, without failing.
  close(bridge.spendingFunded, bridge.spendingRequired, 1e-4, 'still funded');
  assert.equal(bridge.shortfall, 0);
  assert.deepEqual(bridge.failures, []);
  assert.ok(bridge.withdrawalsGross.gia > 0);
  // Cash is spent first under the default order. The solver stops within its tolerance on the
  // over-funded side, so a sub-penny residue can remain; it never under-funds.
  close(bridge.closing.accounts.cash, 0, 1e-5, 'cash spent first');
});

test('a tax-bearing withdrawal is grossed up so net spending is met exactly', () => {
  // Only a taxable pension is available, so every pound of spending must carry its own tax.
  const profile = strippedProfile(p => {
    p.personal.currentAge = 57;
    p.personal.targetFireAge = 57;
    p.assets.pension = 1_500_000;
    p.spending.retirement = { essentialMonthly: 4000, discretionaryMonthly: 1000 };
    p.spending.retirementFloorAnnual = 48_000;
    p.spending.retirementComfortAnnual = 72_000;
  });
  const year = runDeterministicProjection(profile).years[0]!;
  assert.ok(year.incomeTax > 0, 'a large pension withdrawal must be taxed');
  close(year.spendingFunded, 60_000, 1e-4, 'net spending met');
  assert.equal(year.shortfall, 0);
  // Gross withdrawal exceeds spending by exactly the tax it generated.
  close(year.withdrawalsGross.pension, 60_000 + year.totalTax, 1e-4, 'gross-up');
  close(year.pensionWithdrawalTaxFree + year.pensionWithdrawalTaxable, year.withdrawalsGross.pension, 1e-9);
  // A quarter is tax free, so the effective rate is well below the marginal rate on the taxable part.
  assert.ok(year.totalTax / year.withdrawalsGross.pension < 0.4);
});

test('shortfalls are classified and the plan cannot recover by later returns', () => {
  // Enough accessible capital for part of the bridge, then nothing until pension access.
  const projection = runDeterministicProjection(strippedProfile(p => {
    p.assets.isa = 45_000;
    p.assets.pension = 600_000;
  }));
  assert.equal(projection.success, false);
  const failedAges = [...new Set(projection.failures.map(f => f.age))].sort((a, b) => a - b);
  // The first years are funded from the ISA; failure starts once it is exhausted.
  assert.ok(failedAges[0]! > 45, 'early years should be funded from the ISA');
  assert.ok(failedAges.every(age => age < 57), 'failures must stop once the pension unlocks');
  for (const age of failedAges) {
    const year = projection.years.find(y => y.age === age)!;
    assert.ok(year.failures.some(f => f.code === 'pre_pension_liquidity'));
    assert.ok(year.failures.some(f => f.code === 'portfolio_depletion'));
    assert.equal(year.accessibleWealth, 0);
  }
  // Success is never restored: the recorded failures persist even though later years fund fully.
  assert.equal(projection.success, false);
  assert.ok(projection.metrics.totalShortfallNominal > 0);
  assert.ok(projection.years[projection.years.length - 1]!.shortfall === 0,
    'the final year funds itself, which must not erase the earlier failures');
});

test('the bridge is measured and reported separately from post-pension sustainability', () => {
  const metrics = runDeterministicProjection(createExampleProfile()).metrics;
  assert.equal(metrics.fireAge, 45);
  assert.equal(metrics.bridgeYears, 12);
  close(metrics.requiredBridgeCapitalReal, 12 * 19_800, 1e-6, 'bridge capital');
  close(metrics.requiredPostPensionCapitalReal, (95 - 57) * 19_800, 1e-6, 'post-pension capital');
  close(metrics.liquidFireRatio, metrics.accessibleWealthAtFireReal / metrics.requiredBridgeCapitalReal, 1e-9);
  close(metrics.pensionCoverageRatio, metrics.lockedWealthAtFireReal / metrics.requiredPostPensionCapitalReal, 1e-9);
  // Phases are labelled from the two independent ages.
  const projection = runDeterministicProjection(createExampleProfile());
  assert.equal(projection.years.filter(y => y.phase === 'accumulation').length, 14);
  assert.equal(projection.years.filter(y => y.phase === 'bridge').length, 12);
  assert.equal(projection.years.filter(y => y.phase === 'retirement').length, 38);
});

test('post-FIRE employment income reduces drawdown without becoming pensionable', () => {
  const projection = runDeterministicProjection(profileWith(p => { p.income.retirementEmploymentAnnual = 12_000; }));
  const baseline = runDeterministicProjection(createExampleProfile());
  const year = projection.years.find(y => y.age === 45)!;
  close(year.employmentIncome, 12_000 * year.inflationIndex, 1e-6, 'retirement employment');
  assert.equal(year.pensionablePay, 0, 'post-FIRE employment is not pensionable');
  assert.equal(year.pensionContributionTotal, 0);
  assert.ok(year.withdrawalsGross.gia + year.withdrawalsGross.isa
    < baseline.years.find(y => y.age === 45)!.withdrawalsGross.gia, 'earnings should reduce drawdown');
  assert.ok(projection.metrics.terminalNetWorthReal > baseline.metrics.terminalNetWorthReal);
});
