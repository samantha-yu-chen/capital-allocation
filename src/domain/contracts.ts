import { z } from 'zod';

/** Money is GBP (not pence). Rates are fractions. No rounding inside engines. */
export const money = z.number().finite().nonnegative();
export const rate = z.number().finite().min(0).max(1);
export const age = z.number().int().min(18).max(120);
export const regionSchema = z.enum(['scotland', 'rest_of_uk']);
export type TaxRegion = z.infer<typeof regionSchema>;
export const contributionMethodSchema = z.enum(['salary_sacrifice', 'net_pay', 'relief_at_source']);
export type ContributionMethod = z.infer<typeof contributionMethodSchema>;
export const portfolioSchema = z.strictObject({ equities: rate, bonds: rate, cash: rate })
  .refine(p => Math.abs(p.equities + p.bonds + p.cash - 1) < 1e-9, 'Portfolio weights must sum to 1');
export type Portfolio = z.infer<typeof portfolioSchema>;
const growth = z.number().finite().gt(-1).max(1);
const spendingLevel = z.strictObject({ essentialMonthly: money, discretionaryMonthly: money });
export const pensionPolicySchema = z.strictObject({
  method: contributionMethodSchema,
  employeeRate: rate, employerRate: rate,
  /** Match = pensionable pay × min(employeeRate, matchUpToRate) × matchRate. Additive to employerRate. */
  matchUpToRate: rate, matchRate: z.number().finite().min(0).max(10),
  employerNiSharebackRate: rate,
  salarySacrificeAvailable: z.boolean(),
  /** Relevant post-8 July 2015 sacrifice is added back to threshold income. */
  sacrificeAddedBackForTaper: z.boolean(),
  accessAge: age, moneyPurchaseAnnualAllowanceTriggered: z.boolean(),
  /** Already verified eligible carry-forward; no automatic historical eligibility inference. */
  carryForwardAllowance: money,
}).refine(p => p.method !== 'salary_sacrifice' || p.salarySacrificeAvailable,
  'Salary sacrifice selected but unavailable');
export type PensionPolicy = z.infer<typeof pensionPolicySchema>;

export const propertySchema = z.strictObject({
  use: z.enum(['owner_occupied', 'rental']), marketValue: money,
  /** Property location is independent of the owner's income-tax residence. */
  taxLocation: z.enum(['scotland', 'england_ni', 'manual']).optional(),
  buyerStatus: z.enum(['standard', 'first_time', 'additional']).optional(),
  purchaseTaxOverride: money.optional(),
  /** Historical allowable acquisition cost for an existing rental; nominal GBP. */
  acquisitionCostBasis: money.optional(),
  mortgageBalance: money, mortgageAnnualRate: rate,
  mortgageTermYears: z.number().int().min(1).max(50), mortgageType: z.enum(['repayment', 'interest_only']),
  maintenanceAnnual: money, insuranceAnnual: money, serviceChargeAnnual: money,
  councilTaxAnnual: money, rentAnnual: money, occupancyRate: rate, managementRate: rate,
  purchase: z.strictObject({ age, price: money, deposit: money, transactionCosts: money }).nullable(),
  sale: z.strictObject({ age, sellingCostRate: rate }).nullable(),
  rateChanges: z.array(z.strictObject({ age, annualRate: z.number().finite().min(0).max(1) })),
}).refine(p => p.purchase === null || p.purchase.deposit <= p.purchase.price, 'Deposit exceeds price');

export const profileSchema = z.strictObject({
  schemaVersion: z.literal('1'),
  personal: z.strictObject({ currentAge: age, targetFireAge: age, endAge: age, taxRegion: regionSchema,
    taxYear: z.literal('2026/27'), targetSuccessProbability: rate }),
  income: z.strictObject({ salaryAnnual: money, bonusAnnual: money, otherNonSavingsAnnual: money,
    salaryGrowthReal: growth, retirementEmploymentAnnual: money,
    statePensionAnnual: money, statePensionAge: age }),
  household: z.strictObject({ adults: z.number().int().min(1).max(20), children: z.number().int().min(0).max(20) }),
  spending: z.strictObject({
    current: spendingLevel, retirement: spendingLevel,
    retirementFloorAnnual: money, retirementComfortAnnual: money,
    /** Totals above are authoritative household totals. Breakdown is optional; never multiply totals by people. */
    breakdown: z.strictObject({ sharedMonthly: money, perAdultMonthly: money, perChildMonthly: money }).nullable(),
    currentRentMonthlyIncluded: money,
    phases: z.array(z.strictObject({ startAge: age, endAge: age, essentialMonthly: money, discretionaryMonthly: money })),
    lifestyleCreepRate: rate,
    scenarioMonthly: z.strictObject({ low: money, base: money, high: money }),
  }),
  assets: z.strictObject({ cash: money, isa: money,
    gia: z.strictObject({ marketValue: money, costBasis: money, carriedLosses: money }),
    pension: money, sipp: money, pensionTaxFreeCashUsed: money }),
  pension: pensionPolicySchema,
  isa: z.strictObject({ allowanceUsed: money }),
  gia: z.strictObject({ dividendYield: rate, turnoverRate: rate, gainRealisationRate: rate }),
  liquidity: z.strictObject({ emergencyFundMonths: z.number().finite().min(0).max(120),
    minimumLiquidYears: z.number().finite().min(0).max(20),
    capitalNeeds: z.array(z.strictObject({ age, amount: money, label: z.string().min(1) })) }),
  portfolios: z.strictObject({ isa: portfolioSchema, gia: portfolioSchema, pension: portfolioSchema }),
  market: z.strictObject({ assumptionVersion: z.string().min(1),
    equities: z.strictObject({ meanNominal: growth, volatility: rate }),
    bonds: z.strictObject({ meanNominal: growth, volatility: rate }),
    cash: z.strictObject({ meanNominal: growth, volatility: rate }),
    property: z.strictObject({ meanNominal: growth, volatility: rate }),
    inflation: z.strictObject({ mean: growth, volatility: rate }),
    /** Variable order: equities, bonds, cash, property, inflation. */
    correlation: z.array(z.array(z.number().finite().min(-1).max(1)).length(5)).length(5),
  }),
  simulation: z.strictObject({ count: z.number().int().min(1).max(1_000_000),
    seed: z.number().int().min(0).max(4_294_967_295), referenceWithdrawalRate: z.number().finite().gt(0).max(1),
    taxPolicy: z.literal('constant_real'), withdrawalOrder: z.array(z.enum(['cash', 'gia', 'isa', 'pension'])).length(4) }),
  property: propertySchema.nullable(),
}).superRefine((p, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (p.personal.currentAge > p.personal.targetFireAge || p.personal.targetFireAge >= p.personal.endAge)
    issue(['personal'], 'Require currentAge <= targetFireAge < endAge');
  if (new Set(p.simulation.withdrawalOrder).size !== 4) issue(['simulation', 'withdrawalOrder'], 'Each account must occur once');
  const property = p.property;
  if (property) {
    const start = property.purchase?.age ?? p.personal.currentAge;
    if (start < p.personal.currentAge || start >= p.personal.endAge)
      issue(['property', 'purchase'], 'Purchase must fall within the projection; use existing ownership for a past purchase');
    if (property.sale && (property.sale.age <= start || property.sale.age >= p.personal.endAge))
      issue(['property', 'sale'], 'Sale must follow ownership and fall before end age');
    if (new Set(property.rateChanges.map(r => r.age)).size !== property.rateChanges.length)
      issue(['property', 'rateChanges'], 'Only one refinance rate per age');
    if (property.rateChanges.some(r => r.age < start))
      issue(['property', 'rateChanges'], 'Refinance cannot precede ownership');
    if (property.use === 'rental' && property.sale && !property.purchase && property.acquisitionCostBasis === undefined)
      issue(['property'], 'An existing rental sale requires its historical acquisition cost basis');
    if (property.use === 'rental' && property.buyerStatus === 'first_time')
      issue(['property'], 'First-time buyer relief requires an owner-occupied home');
    if (property.taxLocation === 'manual' && property.purchaseTaxOverride === undefined)
      issue(['property'], 'Manual location requires an explicit purchase tax amount');
  }
  const s = p.spending;
  const target = 12 * (s.retirement.essentialMonthly + s.retirement.discretionaryMonthly);
  if (s.retirementFloorAnnual > target || target > s.retirementComfortAnnual)
    issue(['spending'], 'Require floor <= target <= comfort retirement spending');
  if (s.currentRentMonthlyIncluded > s.current.essentialMonthly + s.current.discretionaryMonthly)
    issue(['spending', 'currentRentMonthlyIncluded'], 'Included rent exceeds current spending');
  if (s.breakdown) {
    const total = s.breakdown.sharedMonthly + p.household.adults * s.breakdown.perAdultMonthly + p.household.children * s.breakdown.perChildMonthly;
    if (Math.abs(total - s.current.essentialMonthly - s.current.discretionaryMonthly) > 0.005)
      issue(['spending', 'breakdown'], 'Breakdown must reconcile to current monthly total');
  }
  if (!(s.scenarioMonthly.low <= s.scenarioMonthly.base && s.scenarioMonthly.base <= s.scenarioMonthly.high))
    issue(['spending', 'scenarioMonthly'], 'Require low <= base <= high');
  const phases = [...s.phases].sort((a, b) => a.startAge - b.startAge);
  phases.forEach((phase, i) => {
    if (phase.startAge >= phase.endAge || (i > 0 && phase.startAge < phases[i - 1]!.endAge))
      issue(['spending', 'phases'], 'Phases are half-open, nonempty and must not overlap');
  });
  const m = p.market.correlation;
  // Semidefinite Cholesky, allowing zero-volatility/perfectly correlated variables.
  const l = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  let valid = true;
  for (let i = 0; i < 5; i++) {
    if (Math.abs(m[i]![i]! - 1) > 1e-9) valid = false;
    for (let j = 0; j <= i; j++) {
      if (Math.abs(m[i]![j]! - m[j]![i]!) > 1e-9) valid = false;
      let v = m[i]![j]!;
      for (let k = 0; k < j; k++) v -= l[i]![k]! * l[j]![k]!;
      if (i === j) { if (v < -1e-9) valid = false; l[i]![j] = Math.sqrt(Math.max(0, v)); }
      else if (l[j]![j]! > 1e-9) l[i]![j] = v / l[j]![j]!;
      else if (Math.abs(v) > 1e-9) valid = false;
    }
  }
  if (!valid) issue(['market', 'correlation'], 'Correlation must be symmetric, unit-diagonal and positive semidefinite');
});
export type Profile = z.infer<typeof profileSchema>;
export const parseProfile = (input: unknown): Profile => profileSchema.parse(input);

/** Named scenarios and their versioned library live in `./scenarios.ts`; this file owns the profile. */

/** Contract only: chunk 2 implements accounting; chunk 3 implements path sampling. */
export interface AccountBalances { cash: number; isa: number; gia: number; pension: number; sipp: number }
export interface BalanceSheet {
  accounts: AccountBalances; giaCostBasis: number; giaCarriedLosses: number;
  propertyValue: number; mortgageDebt: number; pensionTaxFreeCashUsed: number;
}
export interface MarketYear {
  yearIndex: number; equities: number; bonds: number; cash: number; property: number; inflation: number;
}
export interface MarketPath { pathIndex: number; years: readonly MarketYear[] }
export interface ReturnGenerator {
  readonly version: string;
  generatePath(input: { years: number; seed: number; pathIndex: number; assumptions: Profile['market'] }): MarketPath;
}
export type FailureCode = 'unfunded_essential_spending' | 'pre_pension_liquidity' | 'portfolio_depletion' | 'insolvency' | 'mortgage_shortfall';
export interface FailureEvent { age: number; code: FailureCode; shortfall: number }
export interface LedgerYear {
  yearIndex: number; age: number; phase: 'accumulation' | 'bridge' | 'retirement';
  inflationIndex: number; opening: BalanceSheet; closing: BalanceSheet;
  employmentIncome: number; otherIncome: number; statePensionIncome: number; rentalIncome: number;
  contributions: AccountBalances; withdrawalsGross: AccountBalances; investmentReturn: AccountBalances;
  incomeTax: number; employeeNi: number; capitalGainsTax: number; pensionAllowanceCharge: number;
  spendingRequired: number; spendingFunded: number; propertyOperatingCosts: number;
  mortgageInterest: number; mortgagePrincipal: number; propertyTransactionCashFlow: number;
  failures: FailureEvent[];
}
export interface ProjectionResult { years: LedgerYear[]; failures: FailureEvent[]; success: boolean }
export const simulationMetadataSchema = z.strictObject({ schemaVersion: z.literal('1'), seed: z.number().int().nonnegative(),
  simulationCount: z.number().int().positive(), engineVersion: z.string().min(1),
  assumptionVersion: z.string().min(1), taxConfigVersion: z.string().min(1),
  returnGeneratorVersion: z.string().min(1), profile: profileSchema });
export type SimulationMetadata = z.infer<typeof simulationMetadataSchema>;
export interface Percentiles { p10: number; p25: number; median: number; p75: number; p90: number }
export interface SimulationResult {
  metadata: SimulationMetadata; successProbability: number; bridgeFailureProbability: number;
  depletionProbability: number; terminalWealth: Percentiles & { mean: number; worst: number };
  wealthByAge: { age: number; liquid: Percentiles; pension: Percentiles; propertyEquity: Percentiles; netWorth: Percentiles }[];
}
