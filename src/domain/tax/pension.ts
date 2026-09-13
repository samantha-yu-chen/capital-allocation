import { z } from 'zod';
import { age, money, pensionPolicySchema } from '../contracts.js';
import type { TaxConfig } from '../../config/tax/uk-2026-27.js';
import { calculateNationalInsurance } from './national-insurance.js';

export const pensionContributionInputSchema = z.strictObject({ employmentIncome: money,
  /** Contractual contribution basis before sacrifice. Explicitly passed; bonus inclusion is employer-specific. */
  pensionablePay: money, memberAge: age, policy: pensionPolicySchema,
  additionalReliefAtSourceGross: money.default(0),
  /** Caller supplies the lawful retained earnings floor (e.g. minimum-wage hours). */
  minimumRetainedPayAnnual: money.default(0),
});
export type PensionContributionInput = z.input<typeof pensionContributionInputSchema>;
export class PensionLimitError extends RangeError {
  constructor(public readonly code: 'earnings_limit' | 'annual_allowance' | 'salary_floor' | 'member_age', message: string) {
    super(message); this.name = 'PensionLimitError';
  }
}
export function calculatePensionContributions(input: PensionContributionInput, config: TaxConfig) {
  const p = pensionContributionInputSchema.parse(input), policy = p.policy;
  const employeeGross = p.pensionablePay * policy.employeeRate;
  const salarySacrifice = policy.method === 'salary_sacrifice' ? employeeGross : 0;
  const netPayGross = policy.method === 'net_pay' ? employeeGross : 0;
  const reliefAtSourceGross = (policy.method === 'relief_at_source' ? employeeGross : 0) + p.additionalReliefAtSourceGross;
  if (salarySacrifice > p.employmentIncome || (salarySacrifice > 0 && p.employmentIncome - salarySacrifice < p.minimumRetainedPayAnnual))
    throw new PensionLimitError('salary_floor', 'Salary sacrifice exceeds available earnings or the supplied retained-pay floor');
  if (p.memberAge >= config.pension.memberReliefAgeLimit && netPayGross + reliefAtSourceGross > 0)
    throw new PensionLimitError('member_age', 'Relievable member contributions are not supported at age 75 or above');
  const relevantEarnings = p.employmentIncome - salarySacrifice;
  if (netPayGross > relevantEarnings || netPayGross + reliefAtSourceGross > Math.max(relevantEarnings, config.pension.nonEarnerGrossLimit))
    throw new PensionLimitError('earnings_limit', 'Member contributions exceed relevant earnings / the relief-at-source minimum');
  const beforeNi = calculateNationalInsurance({ earnings: p.employmentIncome }, config);
  const afterNi = calculateNationalInsurance({ earnings: p.employmentIncome - salarySacrifice }, config);
  const employerNiSaving = beforeNi.employer - afterNi.employer;
  const employerNiShareback = employerNiSaving * policy.employerNiSharebackRate;
  const employerBase = p.pensionablePay * policy.employerRate;
  const employerMatch = p.pensionablePay * Math.min(policy.employeeRate, policy.matchUpToRate) * policy.matchRate;
  const employerContribution = employerBase + employerMatch + employerNiShareback + salarySacrifice;
  const providerTaxRelief = reliefAtSourceGross * config.pension.reliefAtSourceRate;
  const reliefAtSourceNet = reliefAtSourceGross - providerTaxRelief;
  return { salarySacrifice, netPayGross, reliefAtSourceGross, reliefAtSourceNet, providerTaxRelief,
    employerBase, employerMatch, employerNiSaving, employerNiShareback, employerContribution,
    memberGross: netPayGross + reliefAtSourceGross,
    totalPensionAdded: employerContribution + netPayGross + reliefAtSourceGross,
    employmentIncomeAfterSacrifice: p.employmentIncome - salarySacrifice,
    taxableEmploymentIncome: p.employmentIncome - salarySacrifice - netPayGross,
    /** Reduction in gross personal cash before income tax/NI, includes sacrificed salary. */
    personalCashReduction: salarySacrifice + netPayGross + reliefAtSourceNet,
    thresholdIncomeSacrificeAddback: policy.sacrificeAddedBackForTaper ? salarySacrifice : 0 };
}
const allowanceSchema = z.strictObject({ thresholdIncome: money, adjustedIncome: money,
  pensionInputAmount: money, carryForwardAllowance: money.default(0), moneyPurchaseTriggered: z.boolean().default(false) });
/** Defined-contribution schemes only; carry-forward cannot enlarge the MPAA. */
export function assessPensionAllowance(input: z.input<typeof allowanceSchema>, config: TaxConfig) {
  const p = allowanceSchema.parse(input), c = config.pension;
  const tapered = p.thresholdIncome > c.thresholdIncomeLimit && p.adjustedIncome > c.adjustedIncomeLimit;
  const annualAllowance = tapered ? Math.max(c.minimumAnnualAllowance,
    c.annualAllowance - (p.adjustedIncome - c.adjustedIncomeLimit) * c.taperReductionRate) : c.annualAllowance;
  const available = p.moneyPurchaseTriggered ? Math.min(annualAllowance, c.moneyPurchaseAllowance) : annualAllowance + p.carryForwardAllowance;
  return { annualAllowance, available, tapered, excess: Math.max(0, p.pensionInputAmount - available),
    remaining: Math.max(0, available - p.pensionInputAmount) };
}
/** UFPLS-style split primitive. Chunk 2 must enforce access and account/lump-sum state. */
export function splitPensionWithdrawal(gross: number, lumpSumAllowanceRemaining: number, config: TaxConfig) {
  money.parse(gross); money.parse(lumpSumAllowanceRemaining);
  const taxFree = Math.min(gross * config.pension.taxFreeFraction, lumpSumAllowanceRemaining);
  return { gross, taxFree, taxable: gross - taxFree, lumpSumAllowanceRemaining: lumpSumAllowanceRemaining - taxFree };
}
