import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { runDeterministicProjection } from '../src/engine/index.js';
import { calculateNetIncome, getTaxConfig, taxInputFromProfile } from '../src/domain/tax/index.js';
import { close, profileWith, strippedProfile } from './ledger-helpers.js';

test('GIA defers tax on unrealised growth and taxes only realised gains', () => {
  // turnoverRate and gainRealisationRate are 0 in the fixture, so nothing is realised while
  // the pool is only accumulating. Spec section 40 forbids taxing annual appreciation.
  const projection = runDeterministicProjection(createExampleProfile());
  const accumulation = projection.years.filter(y => y.phase === 'accumulation');
  for (const year of accumulation) {
    assert.equal(year.giaRealisedGains, 0, `age ${year.age} realised a gain with zero turnover`);
    assert.equal(year.capitalGainsTax, 0, `age ${year.age} taxed unrealised growth`);
    assert.equal(year.giaDisposalProceeds, 0);
  }
  const last = accumulation[accumulation.length - 1]!;
  // Real unrealised gains have accrued and remain untaxed.
  assert.ok(last.closing.accounts.gia > last.closing.giaCostBasis + 10_000);
});

test('GIA turnover realises gains, steps the cost basis up and charges CGT above the exemption', () => {
  const profile = profileWith(p => {
    p.gia = { dividendYield: 0, turnoverRate: 1, gainRealisationRate: 1 };
    p.assets.gia = { marketValue: 200_000, costBasis: 100_000, carriedLosses: 0 };
  });
  const year = runDeterministicProjection(profile).years[0]!;
  // Selling and rebuying the whole pool crystallises the entire GBP 100,000 gain.
  close(year.giaTurnoverRealisedGain, 100_000, 1e-6, 'turnover gain');
  close(year.giaTurnoverProceeds, 200_000, 1e-6, 'turnover proceeds');
  // The basis steps up to the market value, so the same gain is never taxed twice.
  close(year.opening.giaCostBasis + year.giaTurnoverRealisedGain, 200_000, 1e-6, 'stepped basis');
  // Taxable gain is the realised gain less the GBP 3,000 annual exemption.
  close(year.giaCgtExemptionUsed, 3000, 1e-6, 'exemption');
  close(year.giaTaxableGains, 97_000, 1e-6, 'taxable gains');
  assert.ok(year.capitalGainsTax > 0);
  // Next year has nothing left to realise: the gain was already taxed and based up.
  const second = runDeterministicProjection(profile).years[1]!;
  assert.ok(second.giaTurnoverRealisedGain < year.giaTurnoverRealisedGain);
});

test('GIA dividends are taxed yearly and the annual exemption is not reapplied per disposal', () => {
  const profile = profileWith(p => {
    p.assets.gia = { marketValue: 400_000, costBasis: 100_000, carriedLosses: 0 };
    p.gia = { dividendYield: 0.03, turnoverRate: 0, gainRealisationRate: 0 };
  });
  const year = runDeterministicProjection(profile).years[0]!;
  close(year.giaDividendsTaxed, 12_000, 1e-6, 'dividends');
  // Well above the GBP 500 dividend allowance, so dividend tax is actually charged.
  assert.ok(year.incomeTax > runDeterministicProjection(
    profileWith(p => { p.assets.gia = { marketValue: 400_000, costBasis: 100_000, carriedLosses: 0 }; p.gia = { dividendYield: 0, turnoverRate: 0, gainRealisationRate: 0 }; }),
  ).years[0]!.incomeTax);
  // Taxed dividends accumulate inside the wrapper, so they raise the base cost.
  close(year.closing.giaCostBasis, year.opening.giaCostBasis + year.giaDividendsTaxed, 1e-6, 'basis');
  // One annual CGT exemption per year, never one per disposal.
  for (const y of runDeterministicProjection(profile).years) assert.ok(y.giaCgtExemptionUsed <= 3000 * y.inflationIndex + 1e-6);
});

test('ISA capacity is capped per year, resets at the tax-year boundary and respects prior use', () => {
  const projection = runDeterministicProjection(createExampleProfile());
  for (const year of projection.years) {
    // Allowance is scaled by the constant-real tax policy, never exceeded.
    assert.ok(year.allocatedToIsa <= 20_000 * year.inflationIndex + 1e-6, `age ${year.age} over ISA allowance`);
    assert.ok(year.isaAllowanceUsed <= 20_000 * year.inflationIndex + 1e-6);
  }
  // Year 0 honours allowance already used; later years start fresh.
  const partlyUsed = runDeterministicProjection(profileWith(p => { p.isa.allowanceUsed = 15_000; }));
  close(partlyUsed.years[0]!.allocatedToIsa, 5000, 1e-6, 'year 0 ISA headroom');
  assert.ok(partlyUsed.years[0]!.allocatedToGia > 14_000, 'overflow should reach the GIA');
  assert.ok(partlyUsed.years[1]!.allocatedToIsa > 15_000, 'allowance must reset the next year');
});

test('ISA holdings bear no CGT, dividend tax or withdrawal tax', () => {
  // Everything accessible sits in the ISA and the whole retirement is funded from it.
  const profile = strippedProfile(p => {
    p.assets.isa = 900_000;
    p.gia.dividendYield = 0;
  });
  const projection = runDeterministicProjection(profile);
  for (const year of projection.years) {
    if (year.withdrawalsGross.isa > 0) {
      assert.equal(year.capitalGainsTax, 0, `age ${year.age} taxed an ISA disposal`);
      assert.equal(year.incomeTax, 0, `age ${year.age} taxed an ISA withdrawal`);
      // Tax-free means the gross withdrawal equals the spending it funds.
      close(year.withdrawalsGross.isa, year.spendingFunded, 1e-4, `age ${year.age} ISA gross-up`);
    }
  }
  assert.equal(projection.success, true);
});

test('cash is a distinct account contributing to liquidity coverage', () => {
  const projection = runDeterministicProjection(createExampleProfile());
  const year = projection.years[0]!;
  // Interest is taxable savings income measured on the opening balance.
  close(year.savingsInterestTaxed, 10_000 * 0.025, 1e-9, 'interest');
  // Liquidity coverage counts cash + ISA + GIA against essential spending, never pension.
  close(year.liquidityCoverageYears, year.accessibleWealth / year.spendingEssentialRequired, 1e-9, 'coverage');
  assert.ok(year.accessibleWealth < year.netWorth);
  assert.ok(year.emergencyReserveTarget > 0);
});

test('surplus is retained in cash until the emergency reserve is covered', () => {
  // 24 months of essential spending is GBP 31,200 against GBP 10,000 of opening cash.
  const projection = runDeterministicProjection(profileWith(p => { p.liquidity.emergencyFundMonths = 24; }));
  const year = projection.years[0]!;
  close(year.emergencyReserveTarget, 31_200, 1e-6, 'reserve target');
  assert.equal(year.allocatedToIsa, 0, 'should not invest while below the reserve');
  close(year.allocatedToCashReserve, year.investableSurplus, 1e-6, 'retained in cash');
  assert.ok(year.closing.accounts.cash > 30_000);
  // Once the reserve is covered, investing resumes.
  const later = projection.years.find(y => y.allocatedToIsa > 0);
  assert.ok(later !== undefined && later.age > 31, 'investment should resume after the reserve is filled');
});

test('the tax region chosen on the profile reaches every projected year of the ledger', () => {
  // Spec §88 item 2. The tax unit tests prove the two band tables differ; this proves the *ledger*
  // uses the profile's own one, so a hard-coded region fails here and not only in a unit test.
  // Salary is the only income, so the first year's tax is exactly the annual API's answer.
  const only = (region: 'scotland' | 'rest_of_uk') => profileWith(p => {
    p.personal.taxRegion = region;
    p.assets.cash = 0;
    p.assets.isa = 0;
    p.assets.gia = { marketValue: 0, costBasis: 0, carriedLosses: 0 };
    p.liquidity.emergencyFundMonths = 0;
  });
  const scotland = only('scotland'), restOfUk = only('rest_of_uk');
  const scottish = runDeterministicProjection(scotland), uk = runDeterministicProjection(restOfUk);

  for (const [label, profile, projection] of
    [['Scottish', scotland, scottish], ['rest-of-UK', restOfUk, uk]] as const) {
    const expected = calculateNetIncome(taxInputFromProfile(profile),
      getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear));
    close(projection.years[0]!.incomeTax, expected.tax.totalIncomeTax, 1e-6, `${label} first-year income tax`);
    close(projection.years[0]!.employeeNi, expected.ni.employee, 1e-6, `${label} first-year NI`);
  }

  // The regions really are distinguishable through the ledger, in the first year and a later one.
  const later = scottish.years.findIndex(y => y.age === 40);
  for (const index of [0, later]) {
    const s = scottish.years[index]!, u = uk.years[index]!;
    assert.equal(s.age, u.age, 'the two runs must line up year by year');
    assert.notEqual(s.incomeTax, u.incomeTax, `age ${s.age} produced identical income tax in both regions`);
  }

  // NI is not devolved, so it must NOT move with the region. A wrong config would change both.
  close(scottish.years[later]!.employeeNi, uk.years[later]!.employeeNi, 1e-9, 'employee NI is not devolved');
});

test('known capital needs are funded in the year they fall due', () => {
  const profile = profileWith(p => {
    p.liquidity.capitalNeeds = [{ age: 40, amount: 25_000, label: 'car replacement' }];
  });
  const projection = runDeterministicProjection(profile);
  for (const year of projection.years) {
    const expected = year.age === 40 ? 25_000 * year.inflationIndex : 0;
    close(year.capitalNeedsRequired, expected, 1e-6, `age ${year.age} capital need`);
    close(year.capitalNeedsFunded, expected, 1e-6, `age ${year.age} funded`);
  }
  // The need is a real cost: it leaves less wealth than the same plan without it.
  assert.ok(projection.metrics.terminalNetWorthReal
    < runDeterministicProjection(createExampleProfile()).metrics.terminalNetWorthReal);
});

test('pension stays locked until access age, then funds spending with tax', () => {
  // Nothing accessible, a large pension, and FIRE twelve years before access.
  const profile = strippedProfile(p => { p.assets.pension = 900_000; });
  const projection = runDeterministicProjection(profile);
  for (const year of projection.years) {
    if (year.age < 57) {
      assert.equal(year.pensionAccessible, false, `age ${year.age} should be locked`);
      assert.equal(year.withdrawalsGross.pension, 0, `age ${year.age} drew a locked pension`);
      assert.equal(year.pensionWithdrawalTaxFree, 0);
    } else {
      assert.equal(year.pensionAccessible, true);
    }
  }
  const first = projection.years.find(y => y.age === 57)!;
  assert.ok(first.withdrawalsGross.pension > 0, 'pension must be drawable at access age');
  // UFPLS-style split: a quarter tax free while lump-sum allowance remains.
  close(first.pensionWithdrawalTaxFree, 0.25 * first.withdrawalsGross.pension, 1e-4, 'tax-free quarter');
  close(first.pensionWithdrawalTaxable, 0.75 * first.withdrawalsGross.pension, 1e-4, 'taxable three quarters');
  // The withdrawal is grossed up for the tax it creates, so spending is met exactly.
  close(first.spendingFunded, first.spendingRequired, 1e-4, 'funded in full');
  assert.equal(first.shortfall, 0);
  close(first.closing.pensionTaxFreeCashUsed, first.pensionWithdrawalTaxFree, 1e-6, 'lump sum usage tracked');
});

test('pension and SIPP are separate balances drawn under one access policy', () => {
  const profile = strippedProfile(p => {
    p.personal.currentAge = 57;
    p.personal.targetFireAge = 57;
    // A workplace pension too small to cover one year, so the draw must reach the SIPP.
    p.assets.pension = 10_000;
    p.assets.sipp = 500_000;
  });
  const projection = runDeterministicProjection(profile);
  const first = projection.years[0]!;
  // The workplace pension is exhausted before the SIPP; both are reported separately.
  assert.ok(first.withdrawalsGross.pension + first.withdrawalsGross.sipp > 10_000,
    'the year needs more than the workplace pension holds');
  close(first.withdrawalsGross.pension, 10_000, 1e-4, 'pension drawn first');
  assert.ok(first.withdrawalsGross.sipp > 0, 'SIPP should cover the remainder');
  assert.equal(first.closing.accounts.pension, 0);
  assert.ok(first.closing.accounts.sipp > 0);
  // Contributions never land in the SIPP: there is no SIPP contribution schedule in the schema.
  for (const year of projection.years) assert.equal(year.contributions.sipp, 0);
});

test('the withdrawal order is configurable and actually changes which account is drawn', () => {
  const base = runDeterministicProjection(createExampleProfile());
  const isaFirst = runDeterministicProjection(
    profileWith(p => { p.simulation.withdrawalOrder = ['isa', 'gia', 'cash', 'pension']; }));
  const atFireBase = base.years.find(y => y.age === 45)!;
  const atFireIsa = isaFirst.years.find(y => y.age === 45)!;
  // Default order is cash then GIA; the override draws the ISA and leaves cash untouched.
  assert.ok(atFireBase.withdrawalsGross.gia > 0 && atFireBase.opening.accounts.cash > 0);
  close(atFireBase.closing.accounts.cash, 0, 1e-6, 'default order spends cash first');
  assert.ok(atFireIsa.withdrawalsGross.isa > 0, 'ISA should be drawn first');
  assert.equal(atFireIsa.withdrawalsGross.gia, 0, 'GIA should be untouched');
  assert.ok(atFireIsa.closing.accounts.cash > 9000, 'cash should be preserved when ordered last');
  assert.notEqual(base.metrics.terminalNetWorthReal, isaFirst.metrics.terminalNetWorthReal);
});

test('configurable state pension starts at its configured age and is taxed as income', () => {
  const profile = strippedProfile(p => {
    p.assets.isa = 700_000;
    p.income.statePensionAnnual = 25_000;
    p.income.statePensionAge = 70;
  });
  const projection = runDeterministicProjection(profile);
  for (const year of projection.years) {
    if (year.age < 70) {
      assert.equal(year.statePensionIncome, 0, `age ${year.age} paid state pension early`);
    } else {
      close(year.statePensionIncome, 25_000 * year.inflationIndex, 1e-6, `age ${year.age} state pension`);
    }
  }
  const before = projection.years.find(y => y.age === 69)!;
  const after = projection.years.find(y => y.age === 70)!;
  // Above the personal allowance, so it is genuinely taxed, and it replaces ISA withdrawals.
  assert.equal(before.incomeTax, 0);
  assert.ok(after.incomeTax > 0, 'state pension above the allowance must be taxed');
  assert.ok(after.withdrawalsGross.isa < before.withdrawalsGross.isa, 'state pension should reduce drawdown');
  // Employee NI is not charged at or above state pension age (category C).
  assert.equal(after.employeeNi, 0);
});

test('lifestyle creep diverts a share of real income growth into spending', () => {
  const projection = runDeterministicProjection(profileWith(p => { p.spending.lifestyleCreepRate = 0.25; }));
  const baseline = runDeterministicProjection(createExampleProfile());
  const year = projection.years[5]!;
  // 25% of cumulative real salary growth, on top of the GBP 19,800 base.
  close(year.lifestyleCreepReal, 0.25 * 55_000 * (1.03 ** 5 - 1), 1e-6, 'creep');
  close(year.spendingRequiredReal, 19_800 + 0.25 * 55_000 * (1.03 ** 5 - 1), 1e-6, 'real spending');
  assert.ok(year.investableSurplus < baseline.years[5]!.investableSurplus, 'creep must reduce surplus');
  // Creep applies to working years only; retirement spending is its own input.
  close(projection.years.find(y => y.phase !== 'accumulation')!.lifestyleCreepReal, 0, 1e-12, 'no creep in retirement');
  assert.ok(projection.metrics.terminalNetWorthReal < baseline.metrics.terminalNetWorthReal);
});

test('phase overrides replace the spending schedule over their half-open age range', () => {
  const projection = runDeterministicProjection(profileWith(p => {
    p.spending.phases = [{ startAge: 45, endAge: 57, essentialMonthly: 1000, discretionaryMonthly: 200 }];
  }));
  for (const year of projection.years) {
    if (year.age >= 45 && year.age < 57) {
      assert.equal(year.spendingSource, 'phase', `age ${year.age} ignored its phase`);
      close(year.spendingRequiredReal, 12 * 1200, 1e-9, `age ${year.age} phase spending`);
    } else {
      assert.notEqual(year.spendingSource, 'phase');
    }
  }
  // Half-open: age 57 is outside the phase and back on the retirement schedule.
  close(projection.years.find(y => y.age === 57)!.spendingRequiredReal, 19_800, 1e-9, 'age 57');
});

test('an infeasible pension contribution is surfaced, not silently capped', () => {
  // 80% of a high salary breaches the annual allowance, which chunk 1 refuses to model as a charge.
  const profile = profileWith(p => {
    p.income.salaryAnnual = 200_000;
    p.pension.employeeRate = 0.8;
    p.pension.employerRate = 0.1;
  });
  assert.throws(() => runDeterministicProjection(profile), (error: unknown) => {
    assert.ok(error instanceof RangeError);
    assert.match((error as Error).message, /Age 31/);
    assert.match((error as Error).message, /allowance/);
    return true;
  });
});
