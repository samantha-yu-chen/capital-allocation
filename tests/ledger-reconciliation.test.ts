import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { deterministicPath, runDeterministicProjection, runProjection } from '../src/engine/index.js';
import { ACCOUNTS, close, profileWith, totalAccounts as total } from './ledger-helpers.js';

test('every account closes at opening + contributions - withdrawals + return', () => {
  const projection = runDeterministicProjection(createExampleProfile());
  assert.equal(projection.years.length, 64);
  for (const year of projection.years) {
    for (const account of ACCOUNTS) {
      const expected = year.opening.accounts[account] + year.contributions[account]
        - year.withdrawalsGross[account] + year.investmentReturn[account];
      close(year.closing.accounts[account], expected, 1e-6, `age ${year.age} ${account}`);
    }
  }
});

test('total wealth movement equals the section 6 cash-flow identity, with no double counting', () => {
  // Independent restatement of spec section 6: opening + active income + employer/member pension
  // + returns - taxes - living costs = closing. Written from the spec, not from engine internals.
  const projection = runDeterministicProjection(createExampleProfile());
  for (const year of projection.years) {
    const income = year.employmentIncome + year.otherIncome + year.statePensionIncome + year.rentalIncome;
    const flows = income + year.pensionContributionTotal - year.personalCashReduction
      - year.incomeTax - year.employeeNi - year.capitalGainsTax
      - year.spendingFunded - year.capitalNeedsFunded;
    close(total(year.closing.accounts), total(year.opening.accounts) + flows + total(year.investmentReturn),
      1e-6, `age ${year.age} aggregate`);
    // Pension money is added exactly once: employer funding never also arrives as personal cash.
    close(year.contributions.cash,
      income + year.pensionWithdrawalTaxFree + year.pensionWithdrawalTaxable
      + year.withdrawalsGross.isa + year.withdrawalsGross.gia,
      1e-6, `age ${year.age} cash inflow`);
    close(year.pensionContributionTotal, year.pensionContributionEmployer + year.pensionContributionMember,
      1e-6, `age ${year.age} pension split`);
    close(year.totalTax, year.incomeTax + year.employeeNi + year.capitalGainsTax, 1e-9);
  }
});

test('balances and account flows stay nonnegative, and years are continuous', () => {
  const projection = runDeterministicProjection(createExampleProfile());
  for (const [index, year] of projection.years.entries()) {
    assert.equal(year.yearIndex, index);
    assert.equal(year.age, 31 + index);
    for (const account of ACCOUNTS) {
      assert.ok(year.contributions[account] >= 0, `age ${year.age} ${account} contribution negative`);
      assert.ok(year.withdrawalsGross[account] >= 0, `age ${year.age} ${account} withdrawal negative`);
      assert.ok(year.closing.accounts[account] >= 0, `age ${year.age} ${account} balance negative`);
    }
    assert.ok(year.closing.giaCostBasis >= 0);
    assert.ok(year.spendingFunded <= year.spendingRequired + 1e-9);
    if (index > 0) assert.deepEqual(year.opening, projection.years[index - 1]!.closing);
    // Withdrawals can never exceed what the account actually held.
    assert.ok(year.withdrawalsGross.isa <= year.opening.accounts.isa + 1e-6);
    assert.ok(year.withdrawalsGross.gia <= year.opening.accounts.gia + 1e-6);
    assert.ok(year.withdrawalsGross.pension <= year.opening.accounts.pension + 1e-6);
    assert.ok(year.withdrawalsGross.sipp <= year.opening.accounts.sipp + 1e-6);
  }
  // Lifetime tax-free cash usage only ever accumulates.
  const used = projection.years.map(y => y.closing.pensionTaxFreeCashUsed);
  for (let i = 1; i < used.length; i += 1) assert.ok(used[i]! >= used[i - 1]! - 1e-9);
});

test('opening year reproduces the chunk-1 documented reference case exactly', () => {
  // docs/tax-rules-2026-27.md: Scotland, £55,000, 5% sacrifice + 5% employer, £19,800 spending.
  const year = runDeterministicProjection(createExampleProfile()).years[0]!;
  close(year.incomeTax, 9927.05, 0.005, 'income tax');
  close(year.employeeNi, 3055.60, 0.005, 'employee NI');
  close(year.pensionContributionTotal, 5500, 0.005, 'pension funding');
  close(year.investableSurplus, 19_467.35, 0.005, 'investable surplus');
  close(year.spendingRequired, 19_800, 1e-9, 'spending');
  // Savings interest and GIA dividends are inside their nil-rate bands here, so the
  // documented salary-only figures are unchanged by adding investment income to the same return.
  close(year.savingsInterestTaxed, 250, 1e-9, 'cash interest');
  close(year.giaDividendsTaxed, 300, 1e-9, 'GIA dividends');
  assert.equal(year.capitalGainsTax, 0);
  assert.equal(year.pensionAllowanceCharge, 0);
  assert.equal(year.phase, 'accumulation');
  assert.equal(year.inflationIndex, 1);
});

test('nominal ledger, real salary growth and today\'s-money inputs follow the documented conventions', () => {
  const projection = runDeterministicProjection(createExampleProfile());
  for (const year of projection.years) {
    const t = year.yearIndex;
    close(year.inflationIndex, 1.025 ** t, 1e-9, `age ${year.age} index`);
    close(year.closingInflationIndex, 1.025 ** (t + 1), 1e-9, `age ${year.age} closing index`);
    if (year.phase === 'accumulation') {
      // Salary growth is REAL, so nominal salary compounds real growth and inflation together.
      close(year.salaryNominal, 55_000 * 1.03 ** t * 1.025 ** t, 1e-6, `age ${year.age} salary`);
      close(year.spendingRequired, 19_800 * 1.025 ** t, 1e-6, `age ${year.age} spending`);
      close(year.spendingRequiredReal, 19_800, 1e-9, `age ${year.age} real spending`);
    } else {
      close(year.spendingRequired, 19_800 * 1.025 ** t, 1e-6, `age ${year.age} retirement spending`);
      assert.equal(year.salaryNominal, 0);
      assert.equal(year.pensionablePay, 0);
    }
  }
});

test('an explicitly supplied means path reproduces the deterministic run (chunk-3 seam)', () => {
  const profile = createExampleProfile();
  const years = profile.personal.endAge - profile.personal.currentAge;
  const explicit = deterministicPath(years, profile.market);
  const viaPath = runProjection(profile, { pathIndex: 7, years: explicit.years });
  const viaHelper = runDeterministicProjection(profile);
  assert.equal(viaPath.years.length, viaHelper.years.length);
  for (const [index, year] of viaPath.years.entries()) {
    assert.deepEqual(year.closing, viaHelper.years[index]!.closing);
    close(year.totalTax, viaHelper.years[index]!.totalTax, 1e-9);
  }
  assert.equal(viaPath.assumptions.pathIndex, 7);
  assert.equal(viaHelper.assumptions.pathIndex, -1);
});

test('accessible, locked and net worth stay separable and are never collapsed', () => {
  const projection = runDeterministicProjection(createExampleProfile());
  for (const year of projection.years) {
    const accounts = year.closing.accounts;
    close(year.accessibleWealth, accounts.cash + accounts.isa + accounts.gia, 1e-9);
    close(year.lockedWealth, accounts.pension + accounts.sipp, 1e-9);
    close(year.netWorth, year.accessibleWealth + year.lockedWealth, 1e-9);
  }
  // The distinction is material: locked capital is a real share of net worth at FIRE.
  const atFire = projection.years.find(y => y.age === 45)!;
  assert.ok(atFire.lockedWealth > 0);
  assert.ok(atFire.accessibleWealth < atFire.netWorth);
});

test('a market path shorter than the projection is rejected rather than truncated', () => {
  const profile = createExampleProfile();
  assert.throws(() => runProjection(profile, deterministicPath(10, profile.market)), /needs 64/);
});

test('unsupported property input is rejected, not silently dropped', () => {
  const profile = profileWith(p => {
    p.property = {
      use: 'owner_occupied', marketValue: 300_000, mortgageBalance: 240_000, mortgageAnnualRate: 0.045,
      mortgageTermYears: 25, mortgageType: 'repayment', maintenanceAnnual: 1500, insuranceAnnual: 300,
      serviceChargeAnnual: 0, councilTaxAnnual: 1400, rentAnnual: 0, occupancyRate: 0, managementRate: 0,
      purchase: null, sale: null, rateChanges: [],
    };
  });
  assert.throws(() => runDeterministicProjection(profile), /work package 5/);
  assert.equal(runDeterministicProjection(createExampleProfile()).success, true);
});
