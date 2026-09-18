/**
 * Overview view model, derived entirely from the deterministic ledger.
 *
 * Nothing here recomputes tax, spending or balances: every figure is read off a `LedgerYearDetail`
 * or `ProjectionMetrics` produced by `src/engine`. The marginal rate is obtained by re-running the
 * real projection with a larger salary, so it is the model's own marginal rate rather than a
 * parallel tax formula.
 */
import type { LedgerYearDetail, LedgerOptions, DeterministicProjection, ProjectionMetrics, MarginalIncrement } from '../../engine/index.js';
import { accessibleWealth, lockedWealth, netWorth, propertyEquity, openingBalanceSheet, runDeterministicProjection, marginalIncrement } from '../../engine/index.js';
import type { FailureEvent, Profile } from '../../domain/contracts.js';
import { money } from './format.js';

export interface PositionModel {
  liquid: number;
  pension: number;
  propertyEquity: number;
  netWorth: number;
}

export interface CashFlowModel {
  age: number;
  grossIncome: number;
  employmentIncome: number;
  otherIncome: number;
  statePensionIncome: number;
  pensionContributionEmployer: number;
  pensionContributionMember: number;
  pensionContributionTotal: number;
  personalCashReduction: number;
  incomeTax: number;
  employeeNi: number;
  capitalGainsTax: number;
  totalTax: number;
  takeHome: number;
  essentialSpending: number;
  discretionarySpending: number;
  totalSpending: number;
  /**
   * Set when the spending on this card is a run-level override rather than the schedule the reader
   * entered. The override lives on another screen, so without saying so the card shows a figure the
   * form contradicts and gives no clue why.
   */
  spendingOverrideNote: string | null;
  capitalNeeds: number;
  investableSurplus: number;
  /** NaN when there is no take-home pay to express the surplus against. */
  savingsRate: number;
  allocatedToCashReserve: number;
  allocatedToIsa: number;
  allocatedToGia: number;
  isaAllowanceRemaining: number;
  pensionAllowanceRemaining: number;
}

export type MarginalModel = MarginalIncrement;

export interface ReferenceFireModel extends ProjectionMetrics {
  withdrawalRate: number;
}

export interface LedgerRowValues {
  rentalIncome: number;
  propertyOperatingCosts: number;
  mortgageInterest: number;
  mortgagePrincipal: number;
  propertyTransactionCashFlow: number;
  rentRemoved: number;
  rentalFinanceRelief: number;
  propertyPurchaseFunding: number;
  propertyAcquisitionCosts: number;
  propertyAppreciation: number;
  propertyValue: number;
  mortgageDebt: number;
  propertyEquity: number;

  grossIncome: number;
  employmentIncome: number;
  otherIncome: number;
  statePensionIncome: number;
  pensionContributionEmployer: number;
  pensionContributionMember: number;
  pensionContributionTotal: number;
  incomeTax: number;
  employeeNi: number;
  capitalGainsTax: number;
  totalTax: number;
  spendingEssential: number;
  spendingDiscretionary: number;
  spendingRequired: number;
  spendingFunded: number;
  capitalNeedsRequired: number;
  capitalNeedsFunded: number;
  shortfall: number;
  investableSurplus: number;
  allocatedToCashReserve: number;
  allocatedToIsa: number;
  allocatedToGia: number;
  withdrawalIsa: number;
  withdrawalGia: number;
  withdrawalPension: number;
  pensionWithdrawalTaxFree: number;
  pensionWithdrawalTaxable: number;
  investmentReturnTotal: number;
  closingCash: number;
  closingIsa: number;
  closingGia: number;
  closingPension: number;
  closingSipp: number;
  giaCostBasis: number;
  liquid: number;
  pensionBalance: number;
  netWorth: number;
  emergencyReserveTarget: number;
}

export interface LedgerRowModel {
  yearIndex: number;
  age: number;
  phase: LedgerYearDetail['phase'];
  spendingSource: LedgerYearDetail['spendingSource'];
  inflationIndex: number;
  closingInflationIndex: number;
  pensionAccessible: boolean;
  liquidityCoverageYears: number;
  meetsMinimumLiquidity: boolean;
  isaAllowanceRemaining: number;
  pensionAllowanceRemaining: number;
  failures: readonly FailureEvent[];
  /** As the ledger computes them. */
  nominal: LedgerRowValues;
  /** Today's money: flows divided by the opening index, closing balances by the closing index. */
  real: LedgerRowValues;
}

export type MoneyBasis = 'real' | 'nominal';

export interface OverviewModel {
  position: PositionModel;
  cashFlow: CashFlowModel;
  /** Null when the increment cannot be modelled, with the reason stated. */
  marginal: MarginalModel | null;
  marginalUnavailable: string | null;
  reference: ReferenceFireModel;
  rows: readonly LedgerRowModel[];
  metrics: ProjectionMetrics;
  assumptions: DeterministicProjection['assumptions'];
  success: boolean;
  failures: readonly FailureEvent[];
}

function values(year: LedgerYearDetail, flowDivisor: number, closingDivisor: number): LedgerRowValues {
  const flow = (value: number) => value / flowDivisor;
  const stock = (value: number) => value / closingDivisor;
  const closing = year.closing.accounts;
  const investmentReturnTotal = year.investmentReturn.cash + year.investmentReturn.isa
    + year.investmentReturn.gia + year.investmentReturn.pension + year.investmentReturn.sipp;
  return {
    rentalIncome: flow(year.rentalIncome),
    propertyOperatingCosts: flow(year.propertyOperatingCosts),
    mortgageInterest: flow(year.mortgageInterest),
    mortgagePrincipal: flow(year.mortgagePrincipal),
    propertyTransactionCashFlow: flow(year.propertyTransactionCashFlow),
    rentRemoved: flow(year.rentRemoved),
    rentalFinanceRelief: flow(year.rentalFinanceRelief),
    propertyPurchaseFunding: flow(year.propertyPurchaseFunding),
    propertyAcquisitionCosts: flow(year.propertyAcquisitionCosts),
    propertyAppreciation: flow(year.propertyAppreciation),
    propertyValue: stock(year.closing.propertyValue),
    mortgageDebt: stock(year.closing.mortgageDebt),
    propertyEquity: stock(year.closing.propertyValue-year.closing.mortgageDebt),
    grossIncome: flow(year.grossIncome),
    employmentIncome: flow(year.employmentIncome),
    otherIncome: flow(year.otherIncome),
    statePensionIncome: flow(year.statePensionIncome),
    pensionContributionEmployer: flow(year.pensionContributionEmployer),
    pensionContributionMember: flow(year.pensionContributionMember),
    pensionContributionTotal: flow(year.pensionContributionTotal),
    incomeTax: flow(year.incomeTax),
    employeeNi: flow(year.employeeNi),
    capitalGainsTax: flow(year.capitalGainsTax),
    totalTax: flow(year.totalTax),
    spendingEssential: flow(year.spendingEssentialRequired),
    spendingDiscretionary: flow(year.spendingDiscretionaryRequired),
    spendingRequired: flow(year.spendingRequired),
    spendingFunded: flow(year.spendingFunded),
    capitalNeedsRequired: flow(year.capitalNeedsRequired),
    capitalNeedsFunded: flow(year.capitalNeedsFunded),
    shortfall: flow(year.shortfall),
    investableSurplus: flow(year.investableSurplus),
    allocatedToCashReserve: flow(year.allocatedToCashReserve),
    allocatedToIsa: flow(year.allocatedToIsa),
    allocatedToGia: flow(year.allocatedToGia),
    withdrawalIsa: flow(year.withdrawalsGross.isa),
    withdrawalGia: flow(year.withdrawalsGross.gia),
    withdrawalPension: flow(year.withdrawalsGross.pension + year.withdrawalsGross.sipp),
    pensionWithdrawalTaxFree: flow(year.pensionWithdrawalTaxFree),
    pensionWithdrawalTaxable: flow(year.pensionWithdrawalTaxable),
    investmentReturnTotal: stock(investmentReturnTotal),
    closingCash: stock(closing.cash),
    closingIsa: stock(closing.isa),
    closingGia: stock(closing.gia),
    closingPension: stock(closing.pension),
    closingSipp: stock(closing.sipp),
    giaCostBasis: stock(year.closing.giaCostBasis),
    liquid: stock(year.accessibleWealth),
    pensionBalance: stock(year.lockedWealth),
    netWorth: stock(year.netWorth),
    emergencyReserveTarget: flow(year.emergencyReserveTarget),
  };
}

export function ledgerRow(year: LedgerYearDetail): LedgerRowModel {
  return {
    yearIndex: year.yearIndex,
    age: year.age,
    phase: year.phase,
    spendingSource: year.spendingSource,
    inflationIndex: year.inflationIndex,
    closingInflationIndex: year.closingInflationIndex,
    pensionAccessible: year.pensionAccessible,
    liquidityCoverageYears: year.liquidityCoverageYears,
    meetsMinimumLiquidity: year.meetsMinimumLiquidity,
    isaAllowanceRemaining: year.isaAllowanceRemaining,
    pensionAllowanceRemaining: year.pensionAllowanceRemaining,
    failures: year.failures,
    nominal: values(year, 1, 1),
    real: values(year, year.inflationIndex, year.closingInflationIndex),
  };
}

/** The sentence a spending override earns: what replaced the schedule, and where it was set. */
export function spendingOverrideNote(monthlyHouseholdOverride: number | null | undefined): string | null {
  if (monthlyHouseholdOverride === null || monthlyHouseholdOverride === undefined) return null;
  return `These are not the amounts entered above: a household spending override of `
    + `${money(monthlyHouseholdOverride)} a month is in force, set on the FIRE & Monte Carlo screen, and it `
    + `replaces the monthly total for every year. Essentials are covered first out of it, so the `
    + `discretionary line is whatever is left.`;
}

function cashFlow(year: LedgerYearDetail, override: number | null | undefined): CashFlowModel {
  const activeIncome = year.employmentIncome + year.otherIncome + year.statePensionIncome + year.rentalIncome;
  const takeHome = activeIncome - year.personalCashReduction - year.totalTax;
  return {
    age: year.age,
    grossIncome: year.grossIncome,
    employmentIncome: year.employmentIncome,
    otherIncome: year.otherIncome,
    statePensionIncome: year.statePensionIncome,
    pensionContributionEmployer: year.pensionContributionEmployer,
    pensionContributionMember: year.pensionContributionMember,
    pensionContributionTotal: year.pensionContributionTotal,
    personalCashReduction: year.personalCashReduction,
    incomeTax: year.incomeTax,
    employeeNi: year.employeeNi,
    capitalGainsTax: year.capitalGainsTax,
    totalTax: year.totalTax,
    takeHome,
    essentialSpending: year.spendingEssentialRequired,
    discretionarySpending: year.spendingDiscretionaryRequired,
    totalSpending: year.spendingRequired,
    spendingOverrideNote: spendingOverrideNote(override),
    capitalNeeds: year.capitalNeedsRequired,
    investableSurplus: year.investableSurplus,
    savingsRate: takeHome > 0 ? year.investableSurplus / takeHome : Number.NaN,
    allocatedToCashReserve: year.allocatedToCashReserve,
    allocatedToIsa: year.allocatedToIsa,
    allocatedToGia: year.allocatedToGia,
    isaAllowanceRemaining: year.isaAllowanceRemaining,
    pensionAllowanceRemaining: year.pensionAllowanceRemaining,
  };
}

/** Presentation wrapper around the engine's own marginal measurement: an unsupported uplifted
 * profile becomes a stated reason rather than a thrown error. */
export function marginalOnIncrement(
  profile: Profile, base: LedgerYearDetail, options: Partial<LedgerOptions>, increment: number,
): { model: MarginalModel } | { unavailable: string } {
  try {
    return { model: marginalIncrement(profile, base, options, increment) };
  } catch (error) {
    return { unavailable: error instanceof Error ? error.message : String(error) };
  }
}

/** Runs the deterministic ledger and shapes it for the Overview screen. Throws what the engine throws. */
export function computeOverview(
  profile: Profile, options: Partial<LedgerOptions> = {}, marginalIncrement = 1000,
): OverviewModel {
  const projection = runDeterministicProjection(profile, options);
  const first = projection.years[0]!;
  const opening = openingBalanceSheet(profile);
  const marginal = marginalOnIncrement(profile, first, options, marginalIncrement);
  return {
    position: {
      liquid: accessibleWealth(opening),
      pension: lockedWealth(opening),
      propertyEquity: propertyEquity(opening),
      netWorth: netWorth(opening),
    },
    cashFlow: cashFlow(first, options.monthlyHouseholdOverride),
    marginal: 'model' in marginal ? marginal.model : null,
    marginalUnavailable: 'unavailable' in marginal ? marginal.unavailable : null,
    reference: { ...projection.metrics, withdrawalRate: profile.simulation.referenceWithdrawalRate },
    rows: projection.years.map(ledgerRow),
    metrics: projection.metrics,
    assumptions: projection.assumptions,
    success: projection.success,
    failures: projection.failures,
  };
}
