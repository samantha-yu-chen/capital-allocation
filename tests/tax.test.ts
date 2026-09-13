import test from 'node:test';
import assert from 'node:assert/strict';
import { getTaxConfig, scaleTaxConfig, calculateIncomeTax, calculatePersonalAllowance,
  calculateMarginalIncomeTax, calculateNationalInsurance, calculateDividendTax,
  calculatePensionContributions, calculatePensionRelief, calculateNetIncome, taxInputFromProfile,
  assessPensionAllowance, PensionLimitError, splitPensionWithdrawal,
  calculateCapitalGainsTax, realiseGiaDisposal, assessIsaContribution } from '../src/domain/tax/index.js';
import { createExampleProfile } from '../src/domain/fixtures.js';
import type { ContributionMethod } from '../src/domain/contracts.js';

const scot = getTaxConfig('scotland', '2026/27'), uk = getTaxConfig('rest_of_uk', '2026/27');
function close(actual: number, expected: number, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, got ${actual}`);
}
function employee(method: ContributionMethod = 'salary_sacrifice', salary = 55_000) {
  const p = createExampleProfile(); p.pension.method = method;
  return { ...taxInputFromProfile(p), employmentIncome: salary, pensionablePay: salary };
}

test('config is versioned, frozen, region-specific and rejects unsupported selectors', () => {
  assert.notEqual(scot.version, uk.version);
  assert.equal(scot.effectiveFrom, '2026-04-06');
  assert.ok(Object.isFrozen(scot.nonSavingsBands[0]));
  assert.throws(() => getTaxConfig('scotland', '2025/26'));
  assert.throws(() => getTaxConfig('invalid' as 'scotland', '2026/27'));
});

// Independent cumulative band arithmetic, source register in docs/tax-rules-2026-27.md.
for (const [salary, tax] of [[0, 0], [12_570, 0], [50_270, 7540], [55_000, 9432],
  [100_000, 27_432], [110_000, 33_432], [125_140, 42_516], [150_000, 53_703]]) {
  test(`rest-of-UK annual income £${salary}`, () => close(calculateIncomeTax({ nonSavingsIncome: salary! }, uk).totalIncomeTax, tax!));
}
for (const [salary, tax] of [[0, 0], [12_570, 0], [16_537, 753.73], [29_526, 3351.53], [43_662, 6320.09],
  [55_000, 11_082.05], [75_000, 19_482.05], [100_000, 30_732.05], [110_000, 37_482.05], [125_140, 47_701.55], [150_000, 59_634.35]]) {
  test(`Scottish annual income £${salary}`, () => close(calculateIncomeTax({ nonSavingsIncome: salary! }, scot).totalIncomeTax, tax!));
}
test('marginal tax crosses Scottish boundaries and allowance taper without a £55k special case', () => {
  for (const [salary, expected] of [[12_570, 0.19], [16_537, 0.2], [29_526, 0.21], [43_662, 0.42], [75_000, 0.45],
    [100_000, 0.675], [125_140, 0.48]]) close(calculateMarginalIncomeTax({ nonSavingsIncome: salary! }, scot), expected!);
  close(calculateMarginalIncomeTax({ nonSavingsIncome: 100_000 }, uk), 0.6);
  close(calculateMarginalIncomeTax({ nonSavingsIncome: 43_661.5 }, scot), 0.315);
  assert.throws(() => calculateMarginalIncomeTax({ nonSavingsIncome: 100 }, uk, 0));
});
test('adjusted net income includes investment income; RAS restores personal allowance', () => {
  close(calculatePersonalAllowance(110_000, uk), 7570);
  close(calculateIncomeTax({ nonSavingsIncome: 99_000, dividends: 11_000 }, scot).personalAllowance, 7570);
  close(calculateIncomeTax({ nonSavingsIncome: 110_000, reliefAtSourceGross: 10_000 }, uk).personalAllowance, 12_570);
});
test('NI thresholds, category C and employer threshold are independent of income-tax region', () => {
  for (const [income, ni] of [[0, 0], [12_570, 0], [50_270, 3016], [55_000, 3110.6]])
    close(calculateNationalInsurance({ earnings: income! }, scot).employee, ni!);
  close(calculateNationalInsurance({ earnings: 55_000 }, scot).employer, 7500);
  close(calculateNationalInsurance({ earnings: 55_000, category: 'C' }, scot).employee, 0);
  close(calculateNationalInsurance({ earnings: 55_000, category: 'C' }, scot).employer, 7500);
  assert.throws(() => calculateNationalInsurance({ earnings: -1 }, scot));
});
test('HMRC dividend example: £29,570 wages, £3,000 dividends', () => {
  const r = calculateIncomeTax({ nonSavingsIncome: 29_570, dividends: 3000 }, uk);
  close(r.nonSavingsTax, 3400); close(r.dividendTax, 268.75); close(r.totalIncomeTax, 3668.75);
  close(calculateDividendTax({ nonSavingsIncome: 29_570, dividends: 3000 }, uk).tax, 268.75);
});
test('Scottish savings/dividends use UK bands and nil-rate dividends still occupy them', () => {
  const r = calculateIncomeTax({ nonSavingsIncome: 50_270, dividends: 1500 }, scot);
  close(r.dividendTax, 357.5); close(r.remainingBasicRateBandForGains, 0);
  close(calculateIncomeTax({ nonSavingsIncome: 30_000, savingsInterest: 1500 }, scot).savingsTax, 100);
  close(calculateIncomeTax({ nonSavingsIncome: 50_270, savingsInterest: 1500 }, scot).savingsTax, 400);
  close(calculateIncomeTax({ nonSavingsIncome: 150_000, savingsInterest: 1000 }, scot).savingsTax, 450);
});
test('savings starting rate stacks with unused PA and savings allowance', () => {
  const r = calculateIncomeTax({ nonSavingsIncome: 10_000, savingsInterest: 10_000 }, uk);
  close(r.savingsStartingRateUsed, 5000); close(r.savingsTax, 286);
  close(calculateIncomeTax({ nonSavingsIncome: 15_000, savingsInterest: 5000 }, uk).savingsTax, 286);
  close(calculateIncomeTax({ nonSavingsIncome: 0, savingsInterest: 18_570 }, scot).totalIncomeTax, 0);
});
test('PA allocation can move the dividend nil-rate band above the basic boundary', () => {
  // £50k wages + £10k dividends: PA-first gives £10,882.25.
  // Leave £37,700 taxable wages and allocate £270 PA to dividends: £10,839.725.
  const r = calculateIncomeTax({ nonSavingsIncome: 50_000, dividends: 10_000 }, uk);
  close(r.taxableNonSavings, 37_700); close(r.allowanceAllocation.dividends, 270);
  close(r.totalIncomeTax, 10_839.725);
});
test('all contribution methods reconcile for the section 79 salary', () => {
  const ss = calculatePensionRelief(employee(), scot);
  const np = calculatePensionRelief(employee('net_pay'), scot);
  const ras = calculatePensionRelief(employee('relief_at_source'), scot);
  close(ss.tax.totalIncomeTax, 9927.05); close(ss.ni.employee, 3055.6); close(ss.netIncomeAfterPension, 39_267.35);
  close(np.netIncomeAfterPension, 39_212.35); close(ras.netIncomeAfterPension, np.netIncomeAfterPension);
  close(ras.pension.providerTaxRelief, 550); close(ras.relief.incomeTaxSaved, 605);
  close(ss.relief.totalTaxRelief, 1155); close(np.relief.totalTaxRelief, 1155); close(ras.relief.totalTaxRelief, 1155);
  close(ss.relief.employeeNiSaved, 55); close(np.relief.employeeNiSaved, 0); close(ras.relief.employeeNiSaved, 0);
  for (const r of [ss, np, ras]) {
    close(r.pension.totalPensionAdded, 5500);
    close(r.grossIncome, r.netIncomeAfterPension + r.pension.personalCashReduction + r.tax.totalIncomeTax + r.ni.employee);
  }
});
test('Scottish RAS extends 20% basic band, not 19% starter band', () => {
  const p = employee('relief_at_source', 16_000);
  const r = calculatePensionRelief(p, scot);
  close(r.relief.incomeTaxSaved, 0); close(r.pension.providerTaxRelief, 160);
  const intermediate = calculatePensionRelief(employee('relief_at_source', 35_000), scot);
  close(intermediate.relief.incomeTaxSaved, 17.5);
});
test('RAS personal allowance restoration is in addition to band-extension relief', () => {
  const p = employee('relief_at_source', 110_000); p.policy.employeeRate = 10_000 / 110_000;
  const r = calculatePensionRelief(p, uk);
  close(r.relief.totalTaxRelief, 6000); close(r.relief.personalNetCost, 4000);
});
test('employer matching is additive and NI shareback uses actual employer savings', () => {
  const p = employee(); p.policy.employerRate = 0.03; p.policy.matchRate = 1; p.policy.matchUpToRate = 0.04;
  p.policy.employerNiSharebackRate = 1;
  const r = calculatePensionRelief(p, scot);
  close(r.pension.employerBase, 1650); close(r.pension.employerMatch, 2200); close(r.pension.employerNiShareback, 412.5);
  close(r.pension.totalPensionAdded, 7012.5);
  const low = employee('salary_sacrifice', 6000); low.policy.employeeRate = 0.5; low.policy.employerNiSharebackRate = 1;
  close(calculatePensionRelief(low, uk).pension.employerNiShareback, 150);
});
test('additional SIPP RAS contributions can coexist with workplace sacrifice', () => {
  const r = calculatePensionRelief({ ...employee(), additionalReliefAtSourceGross: 1000 }, scot);
  close(r.pension.totalPensionAdded, 6500); close(r.pension.providerTaxRelief, 200);
  close(r.relief.totalTaxRelief, 1575); close(r.relief.employeeNiSaved, 55);
});
test('pension annual allowance taper requires both income thresholds', () => {
  const base = { thresholdIncome: 200_000, adjustedIncome: 400_000, pensionInputAmount: 60_000 };
  close(assessPensionAllowance(base, uk).available, 60_000);
  close(assessPensionAllowance({ ...base, thresholdIncome: 200_001, adjustedIncome: 260_000 }, uk).available, 60_000);
  close(assessPensionAllowance({ ...base, thresholdIncome: 220_000, adjustedIncome: 300_000 }, uk).available, 40_000);
  close(assessPensionAllowance({ ...base, thresholdIncome: 220_000 }, uk).available, 10_000);
});
test('carry-forward enlarges regular allowance but never money-purchase allowance', () => {
  const p = { thresholdIncome: 100_000, adjustedIncome: 110_000, pensionInputAmount: 70_000, carryForwardAllowance: 20_000 };
  close(assessPensionAllowance(p, uk).remaining, 10_000);
  close(assessPensionAllowance({ ...p, moneyPurchaseTriggered: true }, uk).excess, 60_000);
});
test('salary sacrifice is added back for threshold income; employer funding raises adjusted income', () => {
  const p = employee('salary_sacrifice', 210_000); p.policy.employeeRate = 0.05; p.policy.employerRate = 0.1;
  const r = calculateNetIncome(p, uk);
  close(r.thresholdIncome, 210_000); close(r.adjustedIncome, 231_000);
  p.policy.sacrificeAddedBackForTaper = false;
  close(calculateNetIncome(p, uk).thresholdIncome, 199_500);
});
test('pension earnings, age, salary-floor and annual-limit violations are explicit', () => {
  const p = employee('net_pay', 10_000); p.policy.employeeRate = 1;
  assert.throws(() => calculateNetIncome({ ...p, additionalReliefAtSourceGross: 1 }, uk), PensionLimitError);
  assert.throws(() => calculateNetIncome({ ...employee(), minimumRetainedPayAnnual: 54_000 }, uk), PensionLimitError);
  const high = employee('salary_sacrifice', 120_000); high.policy.employeeRate = 0.5;
  assert.throws(() => calculateNetIncome(high, uk), (e: unknown) => e instanceof PensionLimitError && e.code === 'annual_allowance');
  assert.throws(() => calculateNetIncome({ ...employee('relief_at_source'), memberAge: 75 }, uk), PensionLimitError);
});
test('non-earner RAS minimum is supported, net-pay deferred top-up is identified', () => {
  const p = employee('relief_at_source', 0);
  close(calculateNetIncome({ ...p, additionalReliefAtSourceGross: 3600 }, uk).pension.providerTaxRelief, 720);
  assert.throws(() => calculateNetIncome({ ...p, additionalReliefAtSourceGross: 3601 }, uk), PensionLimitError);
  assert.equal(calculateNetIncome(employee('net_pay', 10_000), uk).deferredNetPayTopUpNotModelled, true);
});
test('withdrawal split respects remaining lifetime lump-sum allowance', () => {
  assert.deepEqual(splitPensionWithdrawal(40_000, 3000, uk), { gross: 40_000, taxFree: 3000, taxable: 37_000, lumpSumAllowanceRemaining: 0 });
  close(splitPensionWithdrawal(40_000, 20_000, uk).taxable, 30_000);
});
test('HMRC CGT examples retain UK basic-band capacity', () => {
  close(calculateCapitalGainsTax({ realisedGains: 12_600, remainingBasicRateBand: 17_700 }, uk).tax, 1728);
  close(calculateCapitalGainsTax({ realisedGains: 52_600, remainingBasicRateBand: 17_700 }, scot).tax, 10_842);
});
test('current losses are used first; brought-forward losses preserve the exemption', () => {
  const r = calculateCapitalGainsTax({ realisedGains: 10_000, currentYearLosses: 2000, carriedLosses: 9000, remainingBasicRateBand: 0 }, uk);
  close(r.tax, 0); close(r.broughtForwardLossUsed, 5000); close(r.carriedLossesRemaining, 4000);
  close(calculateCapitalGainsTax({ realisedGains: 1000, currentYearLosses: 2000, carriedLosses: 3000, remainingBasicRateBand: 0 }, uk).carriedLossesRemaining, 4000);
});
test('GIA disposal recognises only the realised fraction and can realise losses', () => {
  const r = realiseGiaDisposal(20_000, 15_000, 4000);
  close(r.realisedGain, 1000); close(r.remainingCostBasis, 12_000); close(r.remainingValue, 16_000);
  close(realiseGiaDisposal(15_000, 20_000, 3000).realisedLoss, 1000);
  close(realiseGiaDisposal(20_000, 15_000, 0).realisedGain, 0);
  assert.throws(() => realiseGiaDisposal(0, 100, 0));
  assert.throws(() => realiseGiaDisposal(100, 100, 101));
});
test('ISA assessment exposes overflow without silently routing capital', () => {
  assert.deepEqual(assessIsaContribution(5000, 18_000, uk), { remaining: 2000, permitted: 2000, excess: 3000, existingExcess: 0 });
  close(assessIsaContribution(0, 21_000, uk).existingExcess, 1000);
});
test('constant-real tax scaling preserves real tax at identical real incomes', () => {
  const scaled = scaleTaxConfig(scot, 2);
  close(calculateIncomeTax({ nonSavingsIncome: 110_000, dividends: 5000, savingsInterest: 3000 }, scaled).totalIncomeTax,
    2 * calculateIncomeTax({ nonSavingsIncome: 55_000, dividends: 2500, savingsInterest: 1500 }, scot).totalIncomeTax);
  close(calculateNationalInsurance({ earnings: 110_000 }, scaled).employee, 6221.2);
  close(scaled.pension.memberReliefAgeLimit, 75); close(scaled.pension.moneyPurchaseAllowance, 20_000);
  assert.throws(() => scaleTaxConfig(scot, 0));
});
test('runtime validation rejects unknown tax fields and nonfinite amounts', () => {
  assert.throws(() => calculateIncomeTax({ nonSavingsIncome: NaN }, uk));
  assert.throws(() => calculateIncomeTax({ nonSavingsIncome: -1 }, uk));
  assert.throws(() => calculateIncomeTax({ nonSavingsIncome: 100, wrong: 1 } as never, uk));
  assert.throws(() => calculatePensionContributions({ ...employee(), policy: { ...employee().policy, employeeRate: 2 } }, uk));
});
