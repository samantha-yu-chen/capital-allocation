import { createExampleProfile } from '../../domain/fixtures.js';
import { runDeterministicProjection, type LedgerYearDetail } from '../../engine/index.js';

const pounds = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
const ratio = (n: number) => Number.isFinite(n) ? `${(100 * n).toFixed(1)}%` : 'n/a';

const profile = createExampleProfile();
const projection = runDeterministicProjection(profile);
const { metrics, assumptions } = projection;

console.log('Deterministic lifetime ledger - spec section 79 example profile');
console.log(`Age ${profile.personal.currentAge} to ${profile.personal.endAge}, FIRE at ${profile.personal.targetFireAge}, ` +
  `pension access ${profile.pension.accessAge}, ${profile.personal.taxRegion}, tax year ${profile.personal.taxYear}.`);
console.log(`Engine ${assumptions.engineVersion}; tax config ${assumptions.taxConfigVersion}; ` +
  `policy ${assumptions.taxPolicy}; ${assumptions.years} projected years.`);
console.log('Expected-value path (configured nominal means). This is a reference projection, NOT a FIRE safety measure.\n');

const showReal = (year: LedgerYearDetail) => ({
  age: year.age,
  phase: year.phase,
  salary: pounds(year.salaryNominal / year.inflationIndex),
  tax: pounds(year.totalTax / year.inflationIndex),
  spend: pounds(year.spendingFunded / year.inflationIndex),
  surplus: pounds(year.investableSurplus / year.inflationIndex),
  pensionIn: pounds(year.pensionContributionTotal / year.inflationIndex),
  drawn: pounds((year.withdrawalsGross.isa + year.withdrawalsGross.gia
    + year.withdrawalsGross.pension + year.withdrawalsGross.sipp) / year.inflationIndex),
  cash: pounds(year.closing.accounts.cash / year.closingInflationIndex),
  isa: pounds(year.closing.accounts.isa / year.closingInflationIndex),
  gia: pounds(year.closing.accounts.gia / year.closingInflationIndex),
  pension: pounds((year.closing.accounts.pension + year.closing.accounts.sipp) / year.closingInflationIndex),
  accessible: pounds(year.accessibleWealth / year.closingInflationIndex),
  shortfall: year.shortfall > 0.005 ? pounds(year.shortfall / year.inflationIndex) : '-',
});

console.log('All figures below are in TODAY\'S money (nominal ledger values deflated by the year\'s inflation index).');
console.log('\nAccumulation and the pre-pension bridge:');
console.table(projection.years.filter(y => y.age <= profile.pension.accessAge).map(showReal));

console.log('\nPost-pension-access retirement, every fifth year:');
console.table(projection.years.filter(y => y.age > profile.pension.accessAge && (y.age % 5 === 0 || y.age === profile.personal.endAge - 1)).map(showReal));

console.log('\nReference FIRE arithmetic (today\'s money, spec sections 18 and 76):');
console.table([{
  'retirement spending': pounds(metrics.retirementSpendingReal),
  'reference FIRE number': pounds(metrics.referenceFireNumber),
  [`investable at ${metrics.fireAge}`]: pounds(metrics.investableAssetsAtFireReal),
  'reference FIRE ratio': ratio(metrics.referenceFireRatio),
}]);
console.table([{
  'bridge years': metrics.bridgeYears,
  'accessible at FIRE': pounds(metrics.accessibleWealthAtFireReal),
  'bridge capital required': pounds(metrics.requiredBridgeCapitalReal),
  'liquid FIRE ratio': ratio(metrics.liquidFireRatio),
  'locked at FIRE': pounds(metrics.lockedWealthAtFireReal),
  'pension coverage': ratio(metrics.pensionCoverageRatio),
}]);
console.table([{
  'terminal net worth': pounds(metrics.terminalNetWorthReal),
  'peak net worth': pounds(metrics.peakNetWorthReal),
  'years with shortfall': metrics.yearsWithShortfall,
  'first failure age': metrics.firstFailureAge ?? 'none',
  success: projection.success,
}]);

if (projection.failures.length > 0) {
  console.log('\nFailure records (spending that accessible capital could not fund):');
  console.table(projection.failures.slice(0, 12).map(f => ({ age: f.age, code: f.code, shortfall: pounds(f.shortfall) })));
  if (projection.failures.length > 12) console.log(`... ${projection.failures.length - 12} further failure records.`);
} else {
  console.log('\nNo funding failures on the expected-value path.');
}

console.log('\nSpending double effect (spec section 61 / golden scenario F), same profile, three monthly levels:');
console.table([profile.spending.scenarioMonthly.low, profile.spending.scenarioMonthly.base, profile.spending.scenarioMonthly.high]
  .map(monthly => {
    const run = runDeterministicProjection(profile, { monthlyHouseholdOverride: monthly });
    const firstYear = run.years[0]!;
    return {
      'monthly spending': pounds(monthly),
      'year-1 investable surplus': pounds(firstYear.investableSurplus),
      'reference FIRE number': pounds(run.metrics.referenceFireNumber),
      'accessible at FIRE': pounds(run.metrics.accessibleWealthAtFireReal),
      'terminal net worth': pounds(run.metrics.terminalNetWorthReal),
      success: run.success,
    };
  }));

console.log('\nMonte Carlo, property integration and solvers are not part of this chunk.');
