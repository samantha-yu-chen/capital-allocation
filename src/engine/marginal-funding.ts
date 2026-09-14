import { rentalFinanceReduction } from './property.js';
import { z } from 'zod';
import { calculateNetIncome, type NetIncomeInput, type TaxConfig } from '../domain/tax/index.js';

export const marginalActionSchema = z.strictObject({
  amount: z.number().finite().positive(),
  basis: z.enum(['gross_earnings', 'after_tax_cash']),
  destination: z.enum(['pension', 'isa', 'gia', 'cash', 'mortgage', 'deposit']),
});
export type MarginalAction = z.infer<typeof marginalActionSchema>;
export type MarginalDestination = MarginalAction['destination'];
export class MarginalInfeasibleError extends RangeError {
  constructor(message: string) { super(message); this.name = 'MarginalInfeasibleError'; }
}

/** Annual settled liabilities, including additional claimed RAS relief, never a marginal-rate proxy.
 * The extra earnings are a one-off non-pensionable bonus; base employer contributions stay fixed.
 * Gross-funded pension uses the workplace method and its remaining match cap / NI shareback.
 * Existing cash uses additional RAS and receives no employer match. Relief is recycled in-year.
 */
export function marginalFunding(action: MarginalAction, input: NetIncomeInput, config: TaxConfig,
  rentalFinance: { costs: number; profit: number } = { costs: 0, profit: 0 }) {
  action = marginalActionSchema.parse(action);
  const settle = (i: NetIncomeInput) => {
    const n = calculateNetIncome(i, config);
    // The same capped residential finance reduction as the ledger's joint annual assessment.
    const { reduction } = rentalFinanceReduction(rentalFinance.costs, rentalFinance.profit,
      n.tax.adjustedNetIncome - (i.savingsInterest ?? 0) - (i.dividends ?? 0), n.tax.personalAllowance,
      n.tax.totalIncomeTax, config.ukBands[0]!.rate);
    return { ...n, netIncomeAfterPension: n.netIncomeAfterPension + reduction,
      tax: { ...n.tax, totalIncomeTax: n.tax.totalIncomeTax - reduction } };
  };
  const baseline = settle(input);
  const gross = action.basis === 'gross_earnings' ? action.amount : 0;
  const withEarnings = { ...input, employmentIncome: input.employmentIncome + gross };
  const income = settle(withEarnings);
  let workplace = 0, ras = 0;
  let funded = income;
  if (action.destination === 'pension') {
    const target = baseline.netIncomeAfterPension - (action.basis === 'after_tax_cash' ? action.amount : 0);
    const at = (value: number) => settle({ ...withEarnings,
      ...(action.basis === 'after_tax_cash' ? { additionalReliefAtSourceGross: value } : { additionalWorkplaceGross: value }),
    });
    // An unsupported trial is an upper bound, not a permitted contribution or silent cap.
    let low = 0, high = Math.max(withEarnings.employmentIncome, config.pension.nonEarnerGrossLimit) + config.pension.annualAllowance;
    for (let i = 0; i < 65; i++) {
      const mid = (low + high) / 2;
      try { if (at(mid).netIncomeAfterPension > target) low = mid; else high = mid; }
      catch (error) { if (error instanceof RangeError) high = mid; else throw error; }
    }
    funded = at(low);
    if (Math.abs(funded.netIncomeAfterPension - target) > 1e-5)
      throw new MarginalInfeasibleError('The full increment cannot enter pension within member eligibility, relevant earnings, retained pay and annual allowance limits.');
    if (action.basis === 'after_tax_cash') ras = low; else workplace = low;
  }
  const allocation = action.destination === 'pension' ? 0
    : action.basis === 'after_tax_cash' ? action.amount : income.netIncomeAfterPension - baseline.netIncomeAfterPension;
  if (allocation < 0) throw new MarginalInfeasibleError('Extra earnings leave no positive settled cash to allocate.');
  return { gross, workplace, ras, allocation,
    pensionAdded: funded.pension.totalPensionAdded - baseline.pension.totalPensionAdded,
    incomeTax: funded.tax.totalIncomeTax - baseline.tax.totalIncomeTax,
    employeeNi: funded.ni.employee - baseline.ni.employee,
    employerAdded: funded.pension.employerContribution - baseline.pension.employerContribution,
    providerRelief: funded.pension.providerTaxRelief - baseline.pension.providerTaxRelief,
    boundaryCrossings: [
      ...config.nonSavingsBands.flatMap(b => b.upper === null ? [] : [{ label: `${b.name} taxable band`,
        before: baseline.tax.taxableNonSavings - (b.name === 'starter' ? 0 : baseline.pension.reliefAtSourceGross),
        after: funded.tax.taxableNonSavings - (b.name === 'starter' ? 0 : funded.pension.reliefAtSourceGross), threshold: b.upper }]),
      { label: 'Personal allowance taper', before: baseline.tax.adjustedNetIncome, after: funded.tax.adjustedNetIncome, threshold: config.taperThreshold },
      { label: 'NI upper earnings limit', before: baseline.pension.employmentIncomeAfterSacrifice, after: funded.pension.employmentIncomeAfterSacrifice, threshold: config.ni.upperEarningsLimit },
      { label: 'NI primary threshold', before: baseline.pension.employmentIncomeAfterSacrifice, after: funded.pension.employmentIncomeAfterSacrifice, threshold: config.ni.primaryThreshold },
    ].filter(b => Math.min(b.before,b.after) <= b.threshold + 1e-7 && Math.max(b.before,b.after) >= b.threshold - 1e-7 && Math.abs(b.before-b.after) > 1e-7),
    netCashChange: funded.netIncomeAfterPension - baseline.netIncomeAfterPension,
  };
}
