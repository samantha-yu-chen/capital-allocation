import { marginalFunding, MarginalInfeasibleError, type MarginalAction } from './marginal-funding.js';
import { propertyYear, mortgageYear, rentalFinanceReduction, PROPERTY_TAX_VERSION } from './property.js';
import type {
  AccountBalances, BalanceSheet, FailureEvent, LedgerYear, MarketPath, Profile, ProjectionResult,
} from '../domain/contracts.js';
import {
  assessIsaContribution, calculateCapitalGainsTax, calculateNetIncome, getTaxConfig,
  PensionLimitError, realiseGiaDisposal, scaleTaxConfig, splitPensionWithdrawal, type TaxConfig,
} from '../domain/tax/index.js';
import { accessibleWealth, financialNetWorth, lockedWealth, netWorth, openingBalanceSheet, proRataGain } from './accounts.js';
import {
  liquidityCoverageYears, liquidFireRatio, pensionCoverageRatio, referenceFireNumber,
  referenceFireRatio, requiredBridgeCapital, requiredPostPensionCapital,
} from './fire-metrics.js';
import { deterministicPath, inflationIndices, portfolioReturn } from './returns.js';
import { solveMonotone } from './solve.js';
import {
  capitalNeedsForAge, emergencyReserveTarget, retirementAnnualReal, spendingForYear,
  type RetirementSpendingLevel, type SpendingOptions, type SpendingYear,
} from './spending.js';

export const ENGINE_VERSION = 'deterministic-ledger-v3-marginal-property-' + PROPERTY_TAX_VERSION;

/** Raised for validated profiles whose features this chunk deliberately does not model. */
export class UnsupportedProfileError extends Error {
  constructor(public readonly feature: string, message: string) {
    super(message);
    this.name = 'UnsupportedProfileError';
  }
}

export interface LedgerOptions extends SpendingOptions {
  marginalAction: MarginalAction | null;
  measureAllocation: boolean;
  /** Explicit rent-comparison cash investment action, in today's GBP; never creates capital. */
  rentInvestment: { age: number; amount: number } | null;
  /** Retain surplus in cash until the section 41 emergency reserve is covered, before investing. */
  fundEmergencyReserve: boolean;
  /**
   * Where investable surplus goes. The default fills the ISA allowance and puts the remainder in
   * the GIA. This is a transparent chunk-2 default, not an optimised answer: the marginal
   * allocation engine (chunk 7) owns that decision.
   */
  surplusAllocation: 'isa_then_gia' | 'gia_only' | 'cash_only';
  solverTolerance: number;
  solverMaxIterations: number;
}

export const defaultLedgerOptions = (): LedgerOptions => ({
  retirementLevel: 'target', monthlyHouseholdOverride: null, marginalAction: null, measureAllocation: false, fundEmergencyReserve: true, rentInvestment: null,
  surplusAllocation: 'isa_then_gia', solverTolerance: 1e-6, solverMaxIterations: 60,
});

/** Every §6 line item plus the intermediate values needed to audit the year. Extends the shared contract. */
export interface LedgerYearDetail extends LedgerYear {
  marginalFunding: ReturnType<typeof marginalFunding> | null;
  propertyPurchaseShortfall: number;
  propertyPurchasePrice: number;
  propertyAcquisitionCosts: number;
  propertyPurchaseFunding: number;
  propertySaleCosts: number;
  propertyAppreciation: number;
  propertyOperatingCostsFunded: number;
  mortgageInterestFunded: number;
  mortgagePrincipalRequired: number;
  mortgageRate: number;
  rentRemoved: number;
  rentalTaxableProfit: number;
  rentalFinanceRelief: number;
  rentalLossCarry: number;
  rentalFinanceCostCarry: number;
  propertyRealisedGain: number;
  propertyRealisedLoss: number;
  taxConfigVersion: string;
  /** Cumulative inflation index at the END of this year; deflates `closing` to today's money. */
  closingInflationIndex: number;
  salaryNominal: number;
  bonusNominal: number;
  pensionablePay: number;
  grossIncome: number;
  spendingSource: SpendingYear['source'];
  spendingEssentialRequired: number;
  spendingDiscretionaryRequired: number;
  spendingRequiredReal: number;
  lifestyleCreepReal: number;
  capitalNeedsRequired: number;
  capitalNeedsFunded: number;
  shortfall: number;
  savingsInterestTaxed: number;
  giaDividendsTaxed: number;
  giaTurnoverProceeds: number;
  giaTurnoverRealisedGain: number;
  giaDisposalProceeds: number;
  giaRealisedGains: number;
  giaRealisedLosses: number;
  giaTaxableGains: number;
  giaCgtExemptionUsed: number;
  pensionWithdrawalTaxFree: number;
  pensionWithdrawalTaxable: number;
  pensionContributionEmployer: number;
  pensionContributionMember: number;
  pensionContributionTotal: number;
  personalCashReduction: number;
  totalTax: number;
  /** Spec §31: net active income less cash living costs. Negative values are real and must not be clamped. */
  investableSurplus: number;
  allocatedToCashReserve: number;
  allocatedToIsa: number;
  allocatedToGia: number;
  isaAllowanceUsed: number;
  isaAllowanceRemaining: number;
  pensionAllowanceRemaining: number;
  pensionAccessible: boolean;
  accessibleWealth: number;
  lockedWealth: number;
  netWorth: number;
  emergencyReserveTarget: number;
  liquidityCoverageYears: number;
  meetsMinimumLiquidity: boolean;
}

export interface ProjectionMetrics {
  fireAge: number;
  bridgeYears: number;
  /** Today's money throughout. Reference arithmetic only - not a safety measure (spec §6). */
  retirementSpendingReal: number;
  referenceFireNumber: number;
  investableAssetsAtFireReal: number;
  referenceFireRatio: number;
  accessibleWealthAtFireReal: number;
  lockedWealthAtFireReal: number;
  requiredBridgeCapitalReal: number;
  liquidFireRatio: number;
  requiredPostPensionCapitalReal: number;
  pensionCoverageRatio: number;
  terminalNetWorthNominal: number;
  terminalNetWorthReal: number;
  peakNetWorthReal: number;
  firstFailureAge: number | null;
  totalShortfallNominal: number;
  yearsWithShortfall: number;
}

export interface ProjectionAssumptions {
  engineVersion: string;
  taxConfigVersion: string;
  taxPolicy: Profile['simulation']['taxPolicy'];
  marketAssumptionVersion: string;
  pathIndex: number;
  years: number;
  options: LedgerOptions;
  /** ADR 002 event order, implemented in this sequence for every year. */
  eventOrder: readonly string[];
}

export interface DeterministicProjection extends ProjectionResult {
  years: LedgerYearDetail[];
  metrics: ProjectionMetrics;
  assumptions: ProjectionAssumptions;
}

const EVENT_ORDER = [
  'opening balances',
  'taxable investment income measured on opening balances',
  'employment income, pension contributions and annual tax',
  'spending, capital needs and gross-of-tax withdrawals in the configured order',
  'surplus allocation',
  'market returns on post-flow balances',
  'closing balances and failure records',
] as const;

const clampZero = (value: number): number => Math.abs(value) < 1e-9 ? 0 : value;

function cloneSheet(sheet: BalanceSheet): BalanceSheet {
  return {
    accounts: { ...sheet.accounts }, giaCostBasis: sheet.giaCostBasis, giaCarriedLosses: sheet.giaCarriedLosses,
    propertyValue: sheet.propertyValue, mortgageDebt: sheet.mortgageDebt, pensionTaxFreeCashUsed: sheet.pensionTaxFreeCashUsed,
  };
}

/** Expected-value run: the configured nominal means every year. */
export function runDeterministicProjection(profile: Profile, overrides: Partial<LedgerOptions> = {}): DeterministicProjection {
  const years = profile.personal.endAge - profile.personal.currentAge;
  return runProjection(profile, deterministicPath(years, profile.market), overrides);
}

/**
 * One complete lifetime ledger over one market path.
 *
 * Conventions (see docs/handoffs/chunk-2.md):
 * - Projected year `t` covers the half-open age interval `[currentAge + t, currentAge + t + 1)`.
 * - Ledger values are NOMINAL. Profile amounts are today's money; `inflationIndex` converts.
 * - Salary growth is real, so nominal salary compounds both real growth and inflation.
 * - Taxable investment income is measured on OPENING balances, which breaks the circular
 *   dependency between the tax bill and the withdrawal that funds it. Those figures are tax
 *   inputs only, never balance movements, so the reconciliation identity stays exact.
 * - Market growth compounds on POST-FLOW balances, per the ADR 002 event order.
 */
export function runProjection(profile: Profile, path: MarketPath, overrides: Partial<LedgerOptions> = {}): DeterministicProjection {
  const options: LedgerOptions = { ...defaultLedgerOptions(), ...overrides };
  const totalYears = profile.personal.endAge - profile.personal.currentAge;
  if (path.years.length < totalYears)
    throw new RangeError(`Market path supplies ${path.years.length} years; the projection needs ${totalYears}`);
  const baseConfig = getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear);
  const indices = inflationIndices(path);
  const tolerance = options.solverTolerance;

  let sheet = openingBalanceSheet(profile);
  const years: LedgerYearDetail[] = [];
  const allFailures: FailureEvent[] = [];
  let cancelledPurchase = false;
  let failedPurchase: FailureEvent | null = null;
  let propertyBasis = profile.property?.acquisitionCostBasis ?? 0;
  let rentalLossCarry = 0, rentalFinanceCostCarry = 0;
  let depositBudget = 0;

  for (let t = 0; t < totalYears; t += 1) {
    const age = profile.personal.currentAge + t;
    const marketYear = path.years[t]!;
    const inflationIndex = indices[t]!;
    const closingInflationIndex = inflationIndex * (1 + marketYear.inflation);
    // `constant_real` (the only supported policy): keep this year's structure in real terms.
    const config: TaxConfig = scaleTaxConfig(baseConfig, inflationIndex);
    const opening = cloneSheet(sheet);

    const working = age < profile.personal.targetFireAge;
    const phase: LedgerYear['phase'] = working ? 'accumulation'
      : age < profile.pension.accessAge ? 'bridge' : 'retirement';
    const realGrowth = (1 + profile.income.salaryGrowthReal) ** t;
    const salaryNominal = working ? profile.income.salaryAnnual * realGrowth * inflationIndex : 0;
    const bonusNominal = working ? profile.income.bonusAnnual * realGrowth * inflationIndex : 0;
    // Post-FIRE employment is not pensionable: the contribution policy follows the salary.
    const retirementEmployment = working ? 0 : profile.income.retirementEmploymentAnnual * inflationIndex;
    let employmentIncome = salaryNominal + bonusNominal + retirementEmployment;
    const pensionablePay = salaryNominal;
    const otherIncome = profile.income.otherNonSavingsAnnual * inflationIndex;
    const statePensionIncome = age >= profile.income.statePensionAge ? profile.income.statePensionAnnual * inflationIndex : 0;
    const niCategory = age >= profile.income.statePensionAge ? 'C' as const : 'A' as const;

    const savingsInterestTaxed = Math.max(0, opening.accounts.cash * marketYear.cash);
    const giaDividendsTaxed = opening.accounts.gia * profile.gia.dividendYield;
    // Turnover is a sell-and-rebuy: value is unchanged, realised gain steps the cost basis up.
    const giaTurnoverProceeds = opening.accounts.gia * profile.gia.turnoverRate;
    const giaTurnoverRealisedGain = Math.max(0,
      proRataGain(opening.accounts.gia, opening.giaCostBasis, giaTurnoverProceeds)) * profile.gia.gainRealisationRate;
    const basisAfterTurnover = opening.giaCostBasis + giaTurnoverRealisedGain;

    const spending = spendingForYear(profile, { age, inflationIndex, realSalaryGrowthMultiple: realGrowth }, options);
    const property = propertyYear(profile, opening, age, inflationIndex, cancelledPurchase);
    // The included rent component belongs to every supplied spending schedule. Remove it once,
    // bounded by that schedule's total (essentials first), only during owner occupation.
    const rentRemoved = Math.min(spending.totalNominal, property.rentRemoved);
    const essentialRent = Math.min(spending.essentialNominal, rentRemoved);
    spending.essentialNominal -= essentialRent;
    spending.discretionaryNominal -= rentRemoved - essentialRent;
    spending.totalNominal -= rentRemoved;
    spending.essentialReal = spending.essentialNominal / inflationIndex;
    spending.discretionaryReal = spending.discretionaryNominal / inflationIndex;
    spending.totalReal = spending.totalNominal / inflationIndex;
    const rentalProfit = property.rentalIncome - (profile.property?.use === 'rental' ? property.operatingCosts : 0);
    const rentalTaxableProfit = Math.max(0, rentalProfit - rentalLossCarry);
    const nextRentalLossCarry = Math.max(0, rentalLossCarry - rentalProfit);
    const action = t === 0 ? options.marginalAction : null;
    if (action?.basis === 'after_tax_cash' && action.amount > opening.accounts.cash + tolerance)
      throw new MarginalInfeasibleError('The increment exceeds existing opening cash; no implicit sale of ISA/GIA is assumed.');
    const marginal = action ? marginalFunding(action, {
      employmentIncome, pensionablePay, memberAge: age, policy: profile.pension,
      otherNonSavingsIncome: otherIncome + statePensionIncome + rentalTaxableProfit,
      savingsInterest: savingsInterestTaxed, dividends: giaDividendsTaxed, niCategory,
    }, config, { costs: rentalFinanceCostCarry + (profile.property?.use === 'rental' ? property.mortgage.interest : 0), profit: rentalTaxableProfit }) : null;
    employmentIncome += marginal?.gross ?? 0;
    const direct = marginal?.allocation ?? 0;
    // Property actions use the current year's actual debt. Recast the scheduled payment after the
    // one-off principal payment, retaining the original term and the accounting principal line.
    if (action?.destination === 'deposit') {
      if (!profile.property?.purchase)
        throw new MarginalInfeasibleError('A property deposit requires a configured planned purchase.');
      if (direct > profile.property.purchase.price - profile.property.purchase.deposit + tolerance)
        throw new MarginalInfeasibleError('The full increment exceeds the additional deposit capacity.');
      depositBudget = direct;
    }
    if (property.buying && depositBudget > 0) {
      const extraDeposit = depositBudget * inflationIndex;
      property.debt -= extraDeposit;
      property.purchaseFunding += extraDeposit;
      property.mortgage = mortgageYear(property.debt, property.annualRate, profile.property!.mortgageTermYears, profile.property!.mortgageType);
    }
    if (action?.destination === 'mortgage') {
      if (!property.owned || property.buying || property.debt <= 0)
        throw new MarginalInfeasibleError('Mortgage overpayment requires an existing owned property with debt.');
      if (direct > property.debt + tolerance)
        throw new MarginalInfeasibleError('The full increment exceeds the remaining mortgage.');
      property.mortgage = mortgageYear(property.debt - direct, property.annualRate,
        profile.property!.mortgageTermYears - (age - (profile.property!.purchase?.age ?? profile.personal.currentAge)), profile.property!.mortgageType);
      property.mortgage.principal += direct;
      property.mortgage.payment += direct;
    }
    const financeCosts = rentalFinanceCostCarry + (profile.property?.use === 'rental' ? property.mortgage.interest : 0);
    const propertyGain = property.selling && profile.property?.use === 'rental'
      ? property.value - property.saleCosts - propertyBasis : 0;
    const capitalNeedsRequired = capitalNeedsForAge(profile, age, inflationIndex);
    const propertyRequired = property.operatingCosts + property.mortgage.payment + property.purchaseFunding + Math.max(0, -property.saleCash);
    const directTransfer = action && ['isa', 'gia'].includes(action.destination) ? direct : 0;
    const need = spending.totalNominal + capitalNeedsRequired + propertyRequired + directTransfer;
    const isaUsedAtStart = t === 0 ? profile.isa.allowanceUsed : 0;
    const pensionAccessible = age >= profile.pension.accessAge;
    const pensionCapacity = pensionAccessible ? opening.accounts.pension + opening.accounts.sipp : 0;
    const lumpSumRemaining = Math.max(0, config.pension.lumpSumAllowance - opening.pensionTaxFreeCashUsed);

    const evaluate = (cashAllowed: number, isaWithdrawal: number, giaProceeds: number, pensionGross: number) => {
      const pensionFromPension = Math.min(pensionGross, opening.accounts.pension);
      const pensionFromSipp = pensionGross - pensionFromPension;
      const split = splitPensionWithdrawal(pensionGross, lumpSumRemaining, config);
      const disposal = opening.accounts.gia > 0
        ? realiseGiaDisposal(opening.accounts.gia, basisAfterTurnover, giaProceeds)
        : { proceeds: 0, basisDisposed: 0, realisedGain: 0, realisedLoss: 0, remainingValue: 0, remainingCostBasis: basisAfterTurnover };
      const realisedGains = giaTurnoverRealisedGain + disposal.realisedGain;
      let net;
      try {
        net = calculateNetIncome({
          employmentIncome, pensionablePay, memberAge: age, policy: profile.pension,
          additionalWorkplaceGross: marginal?.workplace ?? 0, additionalReliefAtSourceGross: marginal?.ras ?? 0,
          otherNonSavingsIncome: otherIncome + statePensionIncome + split.taxable + rentalTaxableProfit,
          savingsInterest: savingsInterestTaxed, dividends: giaDividendsTaxed, niCategory,
        }, config);
      } catch (error) {
        if (error instanceof PensionLimitError)
          throw new PensionLimitError(error.code, `Age ${age}: ${error.message}`);
        throw error;
      }
      const cgt = calculateCapitalGainsTax({
        realisedGains: realisedGains + Math.max(0, propertyGain), currentYearLosses: disposal.realisedLoss + Math.max(0, -propertyGain), carriedLosses: opening.giaCarriedLosses,
        remainingBasicRateBand: net.tax.remainingBasicRateBandForGains,
      }, config);
      const { eligible: eligibleFinanceCosts, reduction: rentalFinanceRelief } = rentalFinanceReduction(financeCosts,
        rentalTaxableProfit, net.tax.adjustedNetIncome - savingsInterestTaxed - giaDividendsTaxed,
        net.tax.personalAllowance, net.tax.totalIncomeTax, config.ukBands[0]!.rate);
      const totalTax = net.tax.totalIncomeTax - rentalFinanceRelief + net.ni.employee + cgt.tax;
      const cashInflow = employmentIncome + otherIncome + statePensionIncome + split.gross + isaWithdrawal + giaProceeds + property.rentalIncome + Math.max(0, property.saleCash);
      const cashOutflowBeforeSpending = net.pension.personalCashReduction + totalTax;
      return {
        pensionFromPension, pensionFromSipp, split, disposal, realisedGains, net, cgt, totalTax,
        cashInflow, cashOutflowBeforeSpending, rentalFinanceRelief, eligibleFinanceCosts,
        available: cashAllowed + cashInflow - cashOutflowBeforeSpending,
      };
    };

    // Fund the year in the configured order. `cash` is the settlement account, so its position
    // controls how much of the OPENING cash balance may be released at that point; the other
    // entries are liquidations grossed up for the tax they create.
    let cashAllowed = 0;
    let isaWithdrawal = 0;
    let giaProceeds = 0;
    let pensionGross = 0;
    const surplusNow = () => evaluate(cashAllowed, isaWithdrawal, giaProceeds, pensionGross).available - need;
    for (const account of profile.simulation.withdrawalOrder) {
      if (surplusNow() >= -tolerance) break;
      if (account === 'cash') {
        cashAllowed = opening.accounts.cash;
      } else if (account === 'isa') {
        isaWithdrawal = solveMonotone(x => evaluate(cashAllowed, x, giaProceeds, pensionGross).available - need,
          opening.accounts.isa, tolerance, options.solverMaxIterations).x;
      } else if (account === 'gia') {
        giaProceeds = solveMonotone(x => evaluate(cashAllowed, isaWithdrawal, x, pensionGross).available - need,
          opening.accounts.gia, tolerance, options.solverMaxIterations).x;
      } else {
        pensionGross = solveMonotone(x => evaluate(cashAllowed, isaWithdrawal, giaProceeds, x).available - need,
          pensionCapacity, tolerance, options.solverMaxIterations).x;
      }
    }

    const result = evaluate(cashAllowed, isaWithdrawal, giaProceeds, pensionGross);
    // A purchase is atomic. If its full-year obligations cannot be funded, retry this year
    // without buying; keep the failure, but never create a partly funded house or lose a deposit.
    if (property.buying && result.available < need - tolerance) {
      failedPurchase = { age, code: 'unfunded_essential_spending', shortfall: need - result.available };
      cancelledPurchase = true;
      t -= 1;
      continue;
    }
    if (action && result.available < need - tolerance)
      throw new MarginalInfeasibleError('The full allocation cannot be funded alongside the current year obligations.');
    let available = Math.max(0, result.available);
    const fund = (required: number) => { const paid = Math.min(required, available); available -= paid; return paid; };
    const spendingFunded = fund(spending.totalNominal);
    const operatingFunded = fund(property.operatingCosts);
    const interestFunded = fund(property.mortgage.interest);
    const principalFunded = fund(property.mortgage.principal);
    const saleDeficitFunded = fund(Math.max(0, -property.saleCash));
    const capitalNeedsFunded = fund(capitalNeedsRequired);
    const purchaseFunded = fund(property.purchaseFunding);
    const propertyFunded = operatingFunded + interestFunded + principalFunded + saleDeficitFunded + purchaseFunded;
    const propertyPurchaseShortfall = failedPurchase?.age === age ? failedPurchase.shortfall : 0;
    const shortfall = clampZero(need - directTransfer - spendingFunded - capitalNeedsFunded - propertyFunded) + propertyPurchaseShortfall;
    const cashBeforeAllocation = opening.accounts.cash + result.cashInflow
      - result.cashOutflowBeforeSpending - spendingFunded - capitalNeedsFunded - propertyFunded;
    const investableSurplus = result.cashInflow - result.cashOutflowBeforeSpending - spendingFunded - capitalNeedsFunded - propertyFunded;
    const annualEssential = spending.essentialNominal + property.operatingCosts + property.mortgage.payment;
    const reserveTarget = emergencyReserveTarget(profile, annualEssential);
    const reserveShortfallGate = options.fundEmergencyReserve ? reserveTarget : 0;
    const retained = directTransfer + ((action?.destination === 'cash' || (action?.destination === 'deposit' && !property.buying)) && action.basis === 'gross_earnings' ? direct : 0);
    if (action && action.destination !== 'cash' && cashBeforeAllocation - directTransfer < reserveShortfallGate - tolerance)
      throw new MarginalInfeasibleError('The allocation would leave cash below the current emergency reserve.');
    const investable = Math.max(0, Math.min(Math.max(0, investableSurplus - retained), cashBeforeAllocation - reserveShortfallGate - retained));
    const allocatedToCashReserve = Math.max(0, investableSurplus) - investable;
    const rentInvestment = options.rentInvestment?.age === age
      ? Math.min(options.rentInvestment.amount * inflationIndex, Math.max(0, cashBeforeAllocation - reserveShortfallGate - investable)) : 0;
    const directIsa = action?.destination === 'isa' ? direct : 0;
    const directGia = action?.destination === 'gia' ? direct : 0;
    if (directIsa > Math.max(0, config.isaAllowance - isaUsedAtStart) + tolerance)
      throw new MarginalInfeasibleError('The full increment exceeds remaining ISA subscription capacity.');
    const isaAssessment = assessIsaContribution(investable + rentInvestment, isaUsedAtStart + directIsa, config);
    const allocatedToIsa = directIsa + (options.surplusAllocation === 'isa_then_gia' ? isaAssessment.permitted : Math.min(rentInvestment, isaAssessment.remaining));
    const allocatedToGia = directGia + (options.surplusAllocation === 'cash_only' ? rentInvestment - (allocatedToIsa - directIsa) : investable + rentInvestment - (allocatedToIsa - directIsa));

    const contributions: AccountBalances = {
      cash: result.cashInflow,
      isa: allocatedToIsa, gia: allocatedToGia, pension: result.net.pension.totalPensionAdded, sipp: 0,
    };
    const withdrawalsGross: AccountBalances = {
      cash: result.net.pension.personalCashReduction + result.totalTax + spendingFunded
        + capitalNeedsFunded + propertyFunded + allocatedToIsa + allocatedToGia,
      isa: isaWithdrawal, gia: giaProceeds, pension: result.pensionFromPension, sipp: result.pensionFromSipp,
    };
    const postFlow: AccountBalances = {
      cash: clampZero(opening.accounts.cash + contributions.cash - withdrawalsGross.cash),
      isa: clampZero(opening.accounts.isa + contributions.isa - withdrawalsGross.isa),
      gia: clampZero(opening.accounts.gia + contributions.gia - withdrawalsGross.gia),
      pension: clampZero(opening.accounts.pension + contributions.pension - withdrawalsGross.pension),
      sipp: clampZero(opening.accounts.sipp + contributions.sipp - withdrawalsGross.sipp),
    };
    const pensionReturnRate = portfolioReturn(profile.portfolios.pension, marketYear);
    const investmentReturn: AccountBalances = {
      cash: postFlow.cash * marketYear.cash,
      isa: postFlow.isa * portfolioReturn(profile.portfolios.isa, marketYear),
      gia: postFlow.gia * portfolioReturn(profile.portfolios.gia, marketYear),
      pension: postFlow.pension * pensionReturnRate,
      sipp: postFlow.sipp * pensionReturnRate,
    };
    const closing: BalanceSheet = {
      accounts: {
        cash: postFlow.cash + investmentReturn.cash, isa: postFlow.isa + investmentReturn.isa,
        gia: postFlow.gia + investmentReturn.gia, pension: postFlow.pension + investmentReturn.pension,
        sipp: postFlow.sipp + investmentReturn.sipp,
      },
      // Taxed dividends stay inside the GIA as accumulated units, so they raise the base cost.
      giaCostBasis: clampZero(basisAfterTurnover - result.disposal.basisDisposed + allocatedToGia + giaDividendsTaxed),
      giaCarriedLosses: result.cgt.carriedLossesRemaining,
      propertyValue: property.owned ? property.value * (1 + marketYear.property) : 0,
      mortgageDebt: clampZero(property.selling ? Math.max(0, -property.saleCash - saleDeficitFunded)
        : property.debt - principalFunded + property.mortgage.interest - interestFunded),
      pensionTaxFreeCashUsed: opening.pensionTaxFreeCashUsed + result.split.taxFree,
    };

    if (property.buying) propertyBasis = property.price + property.acquisitionCosts;
    rentalLossCarry = nextRentalLossCarry;
    rentalFinanceCostCarry = Math.max(0, financeCosts - result.eligibleFinanceCosts);
    const failures: FailureEvent[] = [];
    if (failedPurchase?.age === age) failures.push(failedPurchase);
    const mortgageShortfall = property.mortgage.payment - interestFunded - principalFunded
      + Math.max(0, -property.saleCash) - saleDeficitFunded;
    if (mortgageShortfall > tolerance) failures.push({ age, code: 'mortgage_shortfall', shortfall: mortgageShortfall });
    if (operatingFunded < property.operatingCosts - tolerance)
      failures.push({ age, code: 'unfunded_essential_spending', shortfall: property.operatingCosts - operatingFunded });
    if (shortfall > tolerance) {
      if (!pensionAccessible && lockedWealth(opening) > tolerance)
        failures.push({ age, code: 'pre_pension_liquidity', shortfall });
      if (spendingFunded < spending.essentialNominal - tolerance)
        failures.push({ age, code: 'unfunded_essential_spending', shortfall: spending.essentialNominal - spendingFunded });
      if (accessibleWealth(closing) <= tolerance)
        failures.push({ age, code: 'portfolio_depletion', shortfall });
    }
    if (netWorth(closing) < -tolerance)
      failures.push({ age, code: 'insolvency', shortfall: -netWorth(closing) });
    allFailures.push(...failures);

    years.push({
      marginalFunding: marginal, yearIndex: t, age, phase, inflationIndex, closingInflationIndex, opening, closing,
      employmentIncome, otherIncome, statePensionIncome, rentalIncome: property.rentalIncome,
      contributions, withdrawalsGross, investmentReturn,
      incomeTax: result.net.tax.totalIncomeTax - result.rentalFinanceRelief, employeeNi: result.net.ni.employee,
      capitalGainsTax: result.cgt.tax,
      // Chunk 1 rejects contributions above the available allowance instead of modelling a charge.
      pensionAllowanceCharge: 0,
      spendingRequired: spending.totalNominal, spendingFunded,
      propertyOperatingCosts: property.operatingCosts, mortgageInterest: property.mortgage.interest,
      mortgagePrincipal: principalFunded,
      propertyTransactionCashFlow: Math.max(0, property.saleCash) - saleDeficitFunded - purchaseFunded,
      propertyPurchaseShortfall, propertyPurchasePrice: property.price, propertyAcquisitionCosts: property.acquisitionCosts,
      propertyPurchaseFunding: purchaseFunded, propertySaleCosts: property.saleCosts,
      propertyAppreciation: property.owned ? property.value * marketYear.property : 0,
      propertyOperatingCostsFunded: operatingFunded, mortgageInterestFunded: interestFunded,
      mortgagePrincipalRequired: property.mortgage.principal, mortgageRate: property.annualRate,
      rentRemoved, rentalTaxableProfit, rentalFinanceRelief: result.rentalFinanceRelief,
      rentalLossCarry, rentalFinanceCostCarry,
      propertyRealisedGain: Math.max(0, propertyGain), propertyRealisedLoss: Math.max(0, -propertyGain),
      failures,
      taxConfigVersion: config.version,
      salaryNominal, bonusNominal, pensionablePay,
      grossIncome: employmentIncome + otherIncome + statePensionIncome + savingsInterestTaxed
        + giaDividendsTaxed + result.split.gross + property.rentalIncome,
      spendingSource: spending.source,
      spendingEssentialRequired: spending.essentialNominal,
      spendingDiscretionaryRequired: spending.discretionaryNominal,
      spendingRequiredReal: spending.totalReal,
      lifestyleCreepReal: spending.lifestyleCreepReal,
      capitalNeedsRequired, capitalNeedsFunded, shortfall,
      savingsInterestTaxed, giaDividendsTaxed, giaTurnoverProceeds, giaTurnoverRealisedGain,
      giaDisposalProceeds: giaProceeds,
      giaRealisedGains: result.realisedGains, giaRealisedLosses: result.disposal.realisedLoss,
      giaTaxableGains: result.cgt.taxableGains, giaCgtExemptionUsed: result.cgt.exemptionUsed,
      pensionWithdrawalTaxFree: result.split.taxFree, pensionWithdrawalTaxable: result.split.taxable,
      pensionContributionEmployer: result.net.pension.employerContribution,
      pensionContributionMember: result.net.pension.memberGross,
      pensionContributionTotal: result.net.pension.totalPensionAdded,
      personalCashReduction: result.net.pension.personalCashReduction,
      totalTax: result.totalTax, investableSurplus,
      allocatedToCashReserve, allocatedToIsa, allocatedToGia,
      isaAllowanceUsed: isaUsedAtStart + allocatedToIsa,
      isaAllowanceRemaining: Math.max(0, config.isaAllowance - isaUsedAtStart - allocatedToIsa),
      pensionAllowanceRemaining: result.net.allowance.remaining,
      pensionAccessible,
      accessibleWealth: accessibleWealth(closing), lockedWealth: lockedWealth(closing), netWorth: netWorth(closing),
      emergencyReserveTarget: reserveTarget,
      liquidityCoverageYears: liquidityCoverageYears(accessibleWealth(closing), annualEssential),
      meetsMinimumLiquidity:
        liquidityCoverageYears(accessibleWealth(closing), annualEssential) >= profile.liquidity.minimumLiquidYears,
    });
    sheet = closing;
  }

  return {
    years, failures: allFailures, success: allFailures.length === 0,
    metrics: buildMetrics(profile, years, options),
    assumptions: {
      engineVersion: ENGINE_VERSION, taxConfigVersion: baseConfig.version,
      taxPolicy: profile.simulation.taxPolicy, marketAssumptionVersion: profile.market.assumptionVersion,
      pathIndex: path.pathIndex, years: totalYears, options, eventOrder: EVENT_ORDER,
    },
  };
}

function buildMetrics(profile: Profile, years: LedgerYearDetail[], options: LedgerOptions): ProjectionMetrics {
  const retirementSpendingReal = retirementAnnualReal(profile, options);
  const fireNumber = referenceFireNumber(retirementSpendingReal, profile.simulation.referenceWithdrawalRate);
  const fireIndex = profile.personal.targetFireAge - profile.personal.currentAge;
  const fireYear = years[Math.min(fireIndex, years.length - 1)]!;
  const deflator = fireYear.inflationIndex;
  const investableAtFire = financialNetWorth(fireYear.opening) / deflator;
  const accessibleAtFire = accessibleWealth(fireYear.opening) / deflator;
  const lockedAtFire = lockedWealth(fireYear.opening) / deflator;
  const bridgeCapital = requiredBridgeCapital(retirementSpendingReal, profile.personal.targetFireAge, profile.pension.accessAge);
  const postPensionCapital = requiredPostPensionCapital(retirementSpendingReal, profile.pension.accessAge, profile.personal.endAge);
  const last = years[years.length - 1]!;
  const shortfallYears = years.filter(y => y.shortfall > 0);
  const firstFailure = years.find(y => y.failures.length > 0);
  return {
    fireAge: profile.personal.targetFireAge,
    bridgeYears: Math.max(0, profile.pension.accessAge - profile.personal.targetFireAge),
    retirementSpendingReal, referenceFireNumber: fireNumber,
    investableAssetsAtFireReal: investableAtFire,
    referenceFireRatio: referenceFireRatio(investableAtFire, fireNumber),
    accessibleWealthAtFireReal: accessibleAtFire, lockedWealthAtFireReal: lockedAtFire,
    requiredBridgeCapitalReal: bridgeCapital,
    liquidFireRatio: liquidFireRatio(accessibleAtFire, bridgeCapital),
    requiredPostPensionCapitalReal: postPensionCapital,
    pensionCoverageRatio: pensionCoverageRatio(lockedAtFire, postPensionCapital),
    terminalNetWorthNominal: netWorth(last.closing),
    terminalNetWorthReal: netWorth(last.closing) / last.closingInflationIndex,
    peakNetWorthReal: years.reduce((peak, y) => Math.max(peak, netWorth(y.closing) / y.closingInflationIndex), 0),
    firstFailureAge: firstFailure ? firstFailure.age : null,
    totalShortfallNominal: shortfallYears.reduce((total, y) => total + y.shortfall, 0),
    yearsWithShortfall: shortfallYears.length,
  };
}

export type { RetirementSpendingLevel };
