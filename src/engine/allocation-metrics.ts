import type { BalanceSheet, Profile } from '../domain/contracts.js';
import { calculateIncomeTax, calculateCapitalGainsTax, getTaxConfig, scaleTaxConfig, splitPensionWithdrawal } from '../domain/tax/index.js';
import type { DeterministicProjection } from './ledger.js';
import { accessibleWealth } from './accounts.js';

export function allocationAges(profile: Profile): number[] {
  return [...new Set([profile.personal.targetFireAge, profile.pension.accessAge, profile.personal.endAge])]
    .filter(age => age >= profile.personal.currentAge && age <= profile.personal.endAge).sort((a,b) => a-b);
}
/** Snapshot valuation, not an extra ledger withdrawal. One tax year liquidation with no employment,
 * current other/state pension income, no contributions, actual GIA basis/losses and remaining lump sum.
 * Unsold property is excluded; mortgage debt is reported and constrained separately.
 */
export function usableWealth(profile: Profile, sheet: BalanceSheet, age: number, index: number): number {
  const config = scaleTaxConfig(getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear), index);
  const background = (profile.income.otherNonSavingsAnnual + (age >= profile.income.statePensionAge ? profile.income.statePensionAnnual : 0)) * index;
  const gross = age >= profile.pension.accessAge ? sheet.accounts.pension + sheet.accounts.sipp : 0;
  const split = splitPensionWithdrawal(gross, Math.max(0, config.pension.lumpSumAllowance - sheet.pensionTaxFreeCashUsed), config);
  const before = calculateIncomeTax({ nonSavingsIncome: background }, config);
  const after = calculateIncomeTax({ nonSavingsIncome: background + split.taxable }, config);
  const gain = sheet.accounts.gia - sheet.giaCostBasis;
  const cgt = calculateCapitalGainsTax({ realisedGains: Math.max(0, gain), currentYearLosses: Math.max(0, -gain),
    carriedLosses: sheet.giaCarriedLosses, remainingBasicRateBand: after.remainingBasicRateBandForGains }, config);
  return (accessibleWealth(sheet) + gross - (after.totalIncomeTax - before.totalIncomeTax) - cgt.tax) / index;
}
export interface AllocationSample {
  usable: number[]; accessible: number[]; netWorth: number[]; debt: number[];
  score: number; tax: number; maxDebt: number; minimumLiquidity: number; minimumReserve: number;
}
export function allocationSample(profile: Profile, projection: DeterministicProjection): AllocationSample {
  const usable: number[] = [], accessible: number[] = [], netWorth: number[] = [], debt: number[] = [];
  for (const age of allocationAges(profile)) {
    const y = projection.years[Math.min(age - profile.personal.currentAge, projection.years.length - 1)]!;
    const terminal = age === profile.personal.endAge;
    const sheet = terminal ? y.closing : y.opening;
    const index = terminal ? y.closingInflationIndex : y.inflationIndex;
    debt.push(sheet.mortgageDebt / index);
    usable.push(usableWealth(profile, sheet, age, index));
    accessible.push(accessibleWealth(sheet) / index);
    netWorth.push((accessibleWealth(sheet) + sheet.accounts.pension + sheet.accounts.sipp + sheet.propertyValue - sheet.mortgageDebt) / index);
  }
  return { usable, accessible, netWorth, debt, score: usable.reduce((a,b) => a+b, 0) / usable.length,
    tax: projection.years.reduce((sum,y) => sum + y.totalTax / y.inflationIndex, 0),
    maxDebt: Math.max(...projection.years.map(y => Math.max(y.opening.mortgageDebt / y.inflationIndex, y.closing.mortgageDebt / y.closingInflationIndex,
      y.propertyPurchasePrice > 0 ? (y.propertyPurchasePrice - y.propertyPurchaseFunding + y.propertyAcquisitionCosts) / y.inflationIndex : 0))),
    minimumLiquidity: Math.min(...projection.years.map(y => y.liquidityCoverageYears)),
    minimumReserve: Math.min(...projection.years.map(y => (y.closing.accounts.cash - y.emergencyReserveTarget) / y.closingInflationIndex)),
  };
}
