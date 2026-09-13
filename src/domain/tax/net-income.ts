import { z } from 'zod';
import { money, type Profile } from '../contracts.js';
import type { TaxConfig } from '../../config/tax/uk-2026-27.js';
import { calculateIncomeTax } from './income-tax.js';
import { calculateNationalInsurance } from './national-insurance.js';
import { assessPensionAllowance, calculatePensionContributions, pensionContributionInputSchema, PensionLimitError } from './pension.js';

export const netIncomeInputSchema = pensionContributionInputSchema.extend({
  otherNonSavingsIncome: money.default(0), savingsInterest: money.default(0), dividends: money.default(0),
  niCategory: z.enum(['A', 'C']).default('A'),
});
export type NetIncomeInput = z.input<typeof netIncomeInputSchema>;
/** Final annual settled income (RAS additional relief claimed this year), not monthly PAYE withholding. */
export function calculateNetIncome(input: NetIncomeInput, config: TaxConfig) {
  const p = netIncomeInputSchema.parse(input);
  const pension = calculatePensionContributions({ employmentIncome: p.employmentIncome, pensionablePay: p.pensionablePay,
    memberAge: p.memberAge, policy: p.policy, additionalReliefAtSourceGross: p.additionalReliefAtSourceGross,
    minimumRetainedPayAnnual: p.minimumRetainedPayAnnual }, config);
  const nonSavingsIncome = pension.taxableEmploymentIncome + p.otherNonSavingsIncome;
  const netIncomeForTaper = nonSavingsIncome + p.savingsInterest + p.dividends;
  const thresholdIncome = Math.max(0, netIncomeForTaper - pension.reliefAtSourceGross + pension.thresholdIncomeSacrificeAddback);
  const adjustedIncome = netIncomeForTaper + pension.netPayGross + pension.employerContribution;
  const allowance = assessPensionAllowance({ thresholdIncome, adjustedIncome, pensionInputAmount: pension.totalPensionAdded,
    carryForwardAllowance: p.policy.carryForwardAllowance, moneyPurchaseTriggered: p.policy.moneyPurchaseAnnualAllowanceTriggered }, config);
  if (allowance.excess > 1e-7) throw new PensionLimitError('annual_allowance',
    `Pension input exceeds available allowance by £${allowance.excess.toFixed(2)}; excess-charge modelling is not supported`);
  const tax = calculateIncomeTax({ nonSavingsIncome, savingsInterest: p.savingsInterest, dividends: p.dividends,
    reliefAtSourceGross: pension.reliefAtSourceGross }, config);
  const ni = calculateNationalInsurance({ earnings: pension.employmentIncomeAfterSacrifice, category: p.niCategory }, config);
  const grossIncome = p.employmentIncome + p.otherNonSavingsIncome + p.savingsInterest + p.dividends;
  const netIncomeAfterPension = grossIncome - pension.personalCashReduction - tax.totalIncomeTax - ni.employee;
  return { grossIncome, netIncomeAfterPension, tax, ni, pension, allowance, thresholdIncome, adjustedIncome,
    /** Net-pay low-earner top-ups are a later-year HMRC payment; do not invent a current-year receipt. */
    deferredNetPayTopUpNotModelled: pension.netPayGross > 0 && tax.adjustedNetIncome < tax.personalAllowance };
}
export function calculatePensionRelief(input: NetIncomeInput, config: TaxConfig) {
  const p = netIncomeInputSchema.parse(input);
  const result = calculateNetIncome(p, config);
  const baselineTax = calculateIncomeTax({ nonSavingsIncome: p.employmentIncome + p.otherNonSavingsIncome,
    savingsInterest: p.savingsInterest, dividends: p.dividends }, config);
  const baselineNi = calculateNationalInsurance({ earnings: p.employmentIncome, category: p.niCategory }, config);
  const incomeTaxSaved = baselineTax.totalIncomeTax - result.tax.totalIncomeTax;
  const employeeNiSaved = baselineNi.employee - result.ni.employee;
  return { ...result, relief: { incomeTaxSaved, employeeNiSaved, providerTaxRelief: result.pension.providerTaxRelief,
    totalTaxRelief: incomeTaxSaved + result.pension.providerTaxRelief,
    personalNetCost: result.pension.personalCashReduction - incomeTaxSaved - employeeNiSaved } };
}
/** Baseline fixture adapter; chunk 2 supplies each year's income/state instead. Bonus is not pensionable by default. */
export function taxInputFromProfile(profile: Profile): NetIncomeInput {
  return { employmentIncome: profile.income.salaryAnnual + profile.income.bonusAnnual,
    pensionablePay: profile.income.salaryAnnual, memberAge: profile.personal.currentAge, policy: profile.pension,
    otherNonSavingsIncome: profile.income.otherNonSavingsAnnual,
    niCategory: profile.personal.currentAge >= profile.income.statePensionAge ? 'C' : 'A' };
}
