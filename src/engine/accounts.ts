import type { AccountBalances, BalanceSheet, Profile } from '../domain/contracts.js';

/** Accounts the withdrawal order can draw from. `sipp` is drawn under the `pension` entry. */
export type WithdrawalAccount = Profile['simulation']['withdrawalOrder'][number];

export const zeroAccounts = (): AccountBalances => ({ cash: 0, isa: 0, gia: 0, pension: 0, sipp: 0 });

export function openingBalanceSheet(profile: Profile): BalanceSheet {
  const a = profile.assets;
  return {
    accounts: { cash: a.cash, isa: a.isa, gia: a.gia.marketValue, pension: a.pension, sipp: a.sipp },
    giaCostBasis: a.gia.costBasis, giaCarriedLosses: a.gia.carriedLosses,
    propertyValue: profile.property && !profile.property.purchase ? profile.property.marketValue : 0,
    mortgageDebt: profile.property && !profile.property.purchase ? profile.property.mortgageBalance : 0, pensionTaxFreeCashUsed: a.pensionTaxFreeCashUsed,
  };
}

/** Freedom Capital (spec section 12): usable before pension access. Property equity is excluded until an explicit release action is modelled. */
export const accessibleWealth = (sheet: BalanceSheet): number =>
  sheet.accounts.cash + sheet.accounts.isa + sheet.accounts.gia;

/** Retirement Capital (spec section 12): inaccessible before pension access age. */
export const lockedWealth = (sheet: BalanceSheet): number => sheet.accounts.pension + sheet.accounts.sipp;

/** Spec section 41: cash + ISA + GIA. Never includes pension. */
export const liquidWealth = (sheet: BalanceSheet): number => accessibleWealth(sheet);

export const propertyEquity = (sheet: BalanceSheet): number => sheet.propertyValue - sheet.mortgageDebt;

/** Spec section 75: kept separable on purpose. Never collapse these into one headline figure. */
export const netWorth = (sheet: BalanceSheet): number =>
  accessibleWealth(sheet) + lockedWealth(sheet) + propertyEquity(sheet);

export const financialNetWorth = (sheet: BalanceSheet): number => accessibleWealth(sheet) + lockedWealth(sheet);

/** Pro-rata gain on an aggregate pool disposal, without taxing it. */
export function proRataGain(marketValue: number, costBasis: number, proceeds: number): number {
  if (marketValue <= 0) return 0;
  return proceeds - costBasis * proceeds / marketValue;
}
