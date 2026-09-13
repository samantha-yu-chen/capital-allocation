import { createExampleProfile } from '../../domain/fixtures.js';
import { calculatePensionRelief, getTaxConfig, taxInputFromProfile } from '../../domain/tax/index.js';
import type { ContributionMethod, TaxRegion } from '../../domain/contracts.js';

const pounds = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const profile = createExampleProfile();
console.log('Section 79 example: £55,000 salary, 5% employee + 5% employer pension, £19,800 annual spending.');
console.log('Tax year 2026/27. Annual settled tax; no investment income in this opening-year example.\n');
const rows = [];
for (const region of ['scotland', 'rest_of_uk'] as TaxRegion[]) {
  for (const method of ['salary_sacrifice', 'net_pay', 'relief_at_source'] as ContributionMethod[]) {
    const input = taxInputFromProfile(profile);
    input.policy = { ...input.policy, method };
    const r = calculatePensionRelief(input, getTaxConfig(region, '2026/27'));
    const spending = 12 * (profile.spending.current.essentialMonthly + profile.spending.current.discretionaryMonthly);
    rows.push({ region, method, incomeTax: pounds(r.tax.totalIncomeTax), employeeNI: pounds(r.ni.employee),
      netIncome: pounds(r.netIncomeAfterPension), pensionAdded: pounds(r.pension.totalPensionAdded),
      afterSpending: pounds(r.netIncomeAfterPension - spending) });
  }
}
console.table(rows);
console.log('This demonstrates annual tax primitives. Lifetime ledger and FIRE results are not implemented in chunk 1.');
