import type { Profile } from '../domain/contracts.js';

/** Spec section 25. `target` is the modelled plan; floor/comfort are alternative deterministic runs, not dynamic in-run cuts. */
export type RetirementSpendingLevel = 'floor' | 'target' | 'comfort';

export interface SpendingOptions {
  retirementLevel: RetirementSpendingLevel;
  /**
   * Replaces the HOUSEHOLD monthly spending total in every phase (spec section 21's
   * 1300/1650/2000 cases, and section 61's spending sensitivity). Applied to both working
   * and retirement years so spending's double effect - surplus and capital requirement -
   * is visible in one run. `null` uses the profile's own schedule.
   */
  monthlyHouseholdOverride: number | null;
}

export interface SpendingYear {
  source: 'phase' | 'current' | 'retirement';
  essentialReal: number; discretionaryReal: number; totalReal: number;
  essentialNominal: number; discretionaryNominal: number; totalNominal: number;
  lifestyleCreepReal: number;
}

/** Retirement levels give an annual TOTAL; essential is preserved up to the target's essential figure. */
export function splitRetirement(profile: Profile, level: RetirementSpendingLevel): { essential: number; discretionary: number } {
  const r = profile.spending.retirement;
  const targetEssential = 12 * r.essentialMonthly;
  const total = level === 'target' ? targetEssential + 12 * r.discretionaryMonthly
    : level === 'floor' ? profile.spending.retirementFloorAnnual : profile.spending.retirementComfortAnnual;
  const essential = Math.min(total, targetEssential);
  return { essential, discretionary: total - essential };
}

/**
 * Today's-money spending for one projected year, plus its nominal equivalent.
 *
 * Phase overrides win; otherwise working years use current spending (plus lifestyle creep on
 * real salary growth, spec section 29) and non-working years use the selected retirement level.
 */
export function spendingForYear(
  profile: Profile,
  args: { age: number; inflationIndex: number; realSalaryGrowthMultiple: number },
  options: SpendingOptions,
): SpendingYear {
  const phase = profile.spending.phases.find(p => args.age >= p.startAge && args.age < p.endAge);
  let source: SpendingYear['source'];
  let essentialReal: number;
  let discretionaryReal: number;
  let lifestyleCreepReal = 0;
  if (phase) {
    source = 'phase';
    essentialReal = 12 * phase.essentialMonthly;
    discretionaryReal = 12 * phase.discretionaryMonthly;
  } else if (args.age < profile.personal.targetFireAge) {
    source = 'current';
    essentialReal = 12 * profile.spending.current.essentialMonthly;
    discretionaryReal = 12 * profile.spending.current.discretionaryMonthly;
    const realSalaryGrowth = profile.income.salaryAnnual * (args.realSalaryGrowthMultiple - 1);
    lifestyleCreepReal = profile.spending.lifestyleCreepRate * Math.max(0, realSalaryGrowth);
    discretionaryReal += lifestyleCreepReal;
  } else {
    source = 'retirement';
    const split = splitRetirement(profile, options.retirementLevel);
    essentialReal = split.essential;
    discretionaryReal = split.discretionary;
  }
  if (options.monthlyHouseholdOverride !== null) {
    const total = 12 * options.monthlyHouseholdOverride;
    const essential = Math.min(total, essentialReal);
    essentialReal = essential;
    discretionaryReal = total - essential;
    lifestyleCreepReal = 0;
  }
  const totalReal = essentialReal + discretionaryReal;
  const x = args.inflationIndex;
  return {
    source, essentialReal, discretionaryReal, totalReal, lifestyleCreepReal,
    essentialNominal: essentialReal * x, discretionaryNominal: discretionaryReal * x, totalNominal: totalReal * x,
  };
}

/** Annual retirement spending in today's money, honouring the level and any household override. */
export function retirementAnnualReal(profile: Profile, options: SpendingOptions): number {
  if (options.monthlyHouseholdOverride !== null) return 12 * options.monthlyHouseholdOverride;
  const split = splitRetirement(profile, options.retirementLevel);
  return split.essential + split.discretionary;
}

/** Spec section 41: emergency reserve expressed against essential spending. */
export const emergencyReserveTarget = (profile: Profile, annualEssentialNominal: number): number =>
  annualEssentialNominal * profile.liquidity.emergencyFundMonths / 12;

/** Known near-term capital needs falling in this projected year, converted to nominal. */
export function capitalNeedsForAge(profile: Profile, age: number, inflationIndex: number): number {
  return profile.liquidity.capitalNeeds
    .filter(need => need.age === age)
    .reduce((total, need) => total + need.amount * inflationIndex, 0);
}
