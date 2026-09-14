import type { BalanceSheet, Profile } from '../domain/contracts.js';
export type Property = NonNullable<Profile['property']>;
export const PROPERTY_TAX_VERSION = 'residential-2026-27-v1';

/** Monthly payments inside an annual ledger. Recast at refinance over the remaining term. */
export function mortgageYear(debt: number, annualRate: number, remainingYears: number, type: Property['mortgageType']) {
  if (debt < 0 || annualRate < 0 || !Number.isFinite(debt + annualRate + remainingYears)) throw new RangeError('Invalid mortgage');
  const months = Math.max(0, Math.round(remainingYears * 12));
  if (months === 0) return { monthlyPayment: 0, interest: debt * annualRate, principal: debt,
    payment: debt * (1 + annualRate), closingDebt: 0 };
  const r = annualRate / 12;
  const monthlyPayment = months === 0 ? 0 : type === 'interest_only' ? debt * r
    : r === 0 ? debt / months : debt * r / -Math.expm1(-months * Math.log1p(r));
  let balance = debt, interest = 0, principal = 0;
  for (let m = 0; m < Math.min(12, months); m++) {
    const charge = balance * r;
    const paid = type === 'interest_only' ? 0 : Math.min(balance, Math.max(0, monthlyPayment - charge));
    interest += charge; principal += paid; balance -= paid;
  }
  // Balloon is due in the last annual interval; unpaid balances remain due thereafter.
  if (months <= 12) { principal += balance; balance = 0; }
  return { monthlyPayment, interest, principal, payment: interest + principal, closingDebt: balance };
}

/** 2026/27 residential schedules, held constant in real terms like the income-tax model.
 * Manual covers Wales and exceptional transactions; entered amount excludes legal/other costs.
 */
export function purchaseTax(property: Property, incomeRegion: Profile['personal']['taxRegion']): number {
  if (!property.purchase) return 0;
  const price = property.purchase.price;
  const location = property.taxLocation ?? (incomeRegion === 'scotland' ? 'scotland' : 'england_ni');
  if (location === 'manual') return property.purchaseTaxOverride ?? 0;
  const status = property.buyerStatus ?? 'standard';
  const first = status === 'first_time';
  const bands = location === 'scotland'
    ? [[first ? 175000 : 145000, 0], [250000, .02], [325000, .05], [750000, .10], [Infinity, .12]]
    : first && price <= 500000
      ? [[300000, 0], [500000, .05]]
      : [[125000, 0], [250000, .02], [925000, .05], [1500000, .10], [Infinity, .12]];
  let tax = 0, lower = 0;
  for (const [upper, rate] of bands) { tax += Math.max(0, Math.min(price, upper!) - lower) * rate!; lower = upper!; }
  if (status === 'additional' && price >= 40000) tax += price * (location === 'scotland' ? .08 : .05);
  return tax;
}

export function propertyYear(profile: Profile, opening: BalanceSheet, age: number, index: number, cancelledPurchase: boolean) {
  const p = cancelledPurchase ? null : profile.property;
  const buying = !!p?.purchase && p.purchase.age === age;
  const selling = !!p?.sale && p.sale.age === age;
  const startAge = p?.purchase?.age ?? profile.personal.currentAge;
  const owned = !!p && age >= startAge && (!p.sale || age < p.sale.age);
  const price = buying ? p!.purchase!.price * index : 0;
  const debt = buying ? (p!.purchase!.price - p!.purchase!.deposit) * index : opening.mortgageDebt;
  const value = buying ? price : opening.propertyValue;
  const acquisitionCosts = buying ? (p!.purchase!.transactionCosts + purchaseTax(p!, profile.personal.taxRegion)) * index : 0;
  const purchaseFunding = buying ? p!.purchase!.deposit * index + acquisitionCosts : 0;
  const saleCosts = selling ? value * p!.sale!.sellingCostRate : 0;
  const saleCash = selling ? value - saleCosts - debt : 0;
  let annualRate = p?.mortgageAnnualRate ?? 0;
  for (const change of [...(p?.rateChanges ?? [])].sort((a,b) => a.age-b.age)) if (age >= change.age) annualRate = change.annualRate;
  const mortgage = owned || (!selling && debt > 0)
    ? mortgageYear(debt, annualRate, (p?.mortgageTermYears ?? 0) - (age - startAge), p?.mortgageType ?? 'repayment')
    : mortgageYear(0, 0, 1, 'repayment');
  const rentalIncome = owned && p!.use === 'rental' ? p!.rentAnnual * p!.occupancyRate * index : 0;
  const operatingCosts = owned ? (p!.maintenanceAnnual + p!.insuranceAnnual + p!.serviceChargeAnnual + p!.councilTaxAnnual) * index + rentalIncome * p!.managementRate : 0;
  return { buying, selling, owned, value, debt, price, acquisitionCosts, purchaseFunding, saleCosts, saleCash,
    annualRate, mortgage, rentalIncome, operatingCosts,
    rentRemoved: owned && p!.use === 'owner_occupied' ? profile.spending.currentRentMonthlyIncluded * 12 * index : 0 };
}

export function leverage(value: number, debt: number, change: number) {
  const equity = value - debt;
  return { equity, ltv: value > 0 ? debt / value : null, appreciation: value * change,
    equityReturn: equity > 0 ? value * change / equity : null, stressedEquity: value * (1 + change) - debt };
}

/** Joint annual residential finance reduction; shared by the ledger and marginal funding. */
export function rentalFinanceReduction(costs: number, profit: number, adjustedIncomeExcludingSavingsAndDividends: number,
  personalAllowance: number, incomeTax: number, basicRate: number) {
  const eligible = Math.min(costs, profit, Math.max(0, adjustedIncomeExcludingSavingsAndDividends - personalAllowance));
  return { eligible, reduction: Math.min(incomeTax, eligible * basicRate) };
}
