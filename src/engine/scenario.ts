/**
 * Scenario strategies and the batched scenario comparison (spec sections 61–66 and 81).
 *
 * A scenario is a validated `Profile` plus its plan-level run options. Every strategy here is a
 * *transform of the profile*, never a shortcut around the model: once a strategy has produced a
 * candidate, that candidate runs through the same complete lifetime ledger, tax rules, allowances,
 * property cash flows and Monte Carlo engine as the entered plan. Nothing in this file estimates a
 * probability, scales a result or blends two runs.
 *
 * Conventions that make a comparison meaningful:
 *
 * - **Common random numbers (section 65).** Every candidate keeps the entered seed, path count,
 *   horizon and market assumptions, so a difference between two cells is a difference in the plan
 *   and not in the draw. `assertCommonPaths` checks the candidate profile before it runs and
 *   `assertScenarioPaths` checks the returned metadata and absolute path indices afterwards. A
 *   scenario that genuinely changes the draw is reported as incomparable, not quietly compared.
 * - **Full count.** The path count is never reduced to finish sooner. A caller may ask for a
 *   reduced-count *preview*, which is an explicit request: it changes the cache key, every cell
 *   records it, and `metadata.preview` is true so presentation can label it. A preview is never
 *   substituted for a full-count result.
 * - **Unsupported is not failure.** A strategy that cannot be expressed for this profile (no
 *   property to buy, a contribution beyond the annual allowance, a FIRE age already at the current
 *   age) is reported as unsupported with its reason. It is not reported as a plan that failed.
 * - **Cache keys are complete.** `scenarioCellKey` covers the whole validated profile (which
 *   carries the seed and path count), every resolved ledger option, and the engine, simulation,
 *   generator and tax-configuration versions.
 */
import { parseProfile, type Profile } from '../domain/contracts.js';
import { defaultScenarioOptions, type ScenarioOptions } from '../domain/scenarios.js';
import { stableStringify } from '../domain/stable-json.js';
import { calculateNetIncome, getTaxConfig, PensionLimitError, taxInputFromProfile } from '../domain/tax/index.js';
import {
  ENGINE_VERSION, defaultLedgerOptions, marginalIncrement, runDeterministicProjection, runProjection,
  type LedgerOptions, type LedgerYearDetail,
} from './ledger.js';
import type { Property } from './property.js';
import { ParametricReturnGenerator } from './monte-carlo/generator.js';
import {
  SIMULATION_VERSION, abortIfNeeded, ledgerOptionsSchema, runMonteCarlo,
  type MonteCarloResult, type SimulationProgress,
} from './monte-carlo/simulation.js';
import { assertCommonPaths, type EvaluateProfile } from './solver.js';
import { fireAgeCurve, type FireAgeCurveResult } from './fire-curve.js';

export const SCENARIO_VERSION = 'scenario-matrix-v1';

/** Raised when a strategy cannot be expressed for a profile. Never a modelling failure. */
export class UnsupportedScenarioError extends Error {
  constructor(message: string) { super(message); this.name = 'UnsupportedScenarioError'; }
}

export interface ScenarioPlan { profile: Profile; options: ScenarioOptions }

/** Inputs a strategy may need that do not live on the profile it transforms. */
export interface StrategyContext {
  /** The purchase the Property strategies model. Supplied by the caller; nothing is invented here. */
  property: Property | null;
  /** Section 62's uplift bands, used by the Income Growth preset. */
  salaryAxis: readonly number[];
}

export const defaultStrategyContext = (): StrategyContext => ({ property: null, salaryAxis: [] });

// ---------------------------------------------------------------------------
// Profile transforms
// ---------------------------------------------------------------------------

const withSalary = (profile: Profile, salary: number): Profile =>
  parseProfile({ ...profile, income: { ...profile.income, salaryAnnual: salary } });

const withEmployeeRate = (profile: Profile, rate: number): Profile =>
  parseProfile({ ...profile, pension: { ...profile.pension, employeeRate: rate } });

/** True when the profile already owns the single modelled property outright of any planned purchase. */
export const ownsExistingProperty = (profile: Profile): boolean =>
  profile.property !== null && profile.property.purchase === null;

/**
 * Drop a *planned* purchase for the non-property strategies.
 *
 * A property the plan already owns is a fact of its balance sheet, so it stays: removing it would
 * compare against a household that does not exist. Only an unexecuted purchase is removed.
 */
const withoutPlannedPurchase = (profile: Profile): Profile =>
  profile.property === null || ownsExistingProperty(profile) ? profile : parseProfile({ ...profile, property: null });

function withProperty(profile: Profile, property: Property | null): Profile {
  if (property === null) {
    if (ownsExistingProperty(profile))
      throw new UnsupportedScenarioError('This plan already owns a property, so a no-property scenario would delete an asset it actually holds.');
    return parseProfile({ ...profile, property: null });
  }
  if (ownsExistingProperty(profile))
    throw new UnsupportedScenarioError('This plan already owns the single property V0.3 models; there is no additional purchase to compare.');
  if (property.purchase === null)
    throw new UnsupportedScenarioError('The property strategy needs a planned purchase; an existing holding has no unspent deposit.');
  return parseProfile({ ...profile, property });
}

/**
 * The employee contribution that removes the top tax band the plan currently occupies.
 *
 * Measured with the real annual tax API — including the personal-allowance taper, the Scottish
 * band set and the relief-at-source band extension — by asking which non-savings band the last
 * taxed slice falls in. The answer is the *smallest* extra contribution that drops that band, found
 * by bisection inside the range the annual allowance and relevant earnings actually support. When
 * no extra contribution can drop a band, the contractual rate is returned with the reason.
 */
export function bandOptimisedContribution(profile: Profile): { rate: number; reason: string } {
  const config = getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear);
  const base = taxInputFromProfile(profile);
  const pay = profile.income.salaryAnnual;
  const current = profile.pension.employeeRate;
  const rateFor = (extra: number) => Math.min(1, current + extra / pay);
  const bandIndex = (extra: number): number => {
    const settled = calculateNetIncome({ ...base, policy: { ...profile.pension, employeeRate: rateFor(extra) } }, config);
    const last = settled.tax.nonSavingsSlices.at(-1);
    return last ? config.nonSavingsBands.findIndex(band => band.name === last.band) : -1;
  };
  const feasible = (extra: number): boolean => {
    try { bandIndex(extra); return true; } catch (error) {
      if (error instanceof PensionLimitError) return false;
      throw error;
    }
  };
  if (pay <= 0) return { rate: current, reason: 'No pensionable pay, so no band can be optimised.' };
  if (!feasible(0)) return { rate: current, reason: 'The entered contribution already exceeds an allowance, so no optimisation is offered.' };
  const startBand = bandIndex(0);
  if (startBand <= 0) return { rate: current, reason: 'Taxable income is already inside the lowest non-savings band.' };

  // The feasible contributions form an interval [0, headroom]: contributions rise monotonically
  // toward the allowance and earnings limits, so bisection finds its end exactly.
  let feasibleLow = 0, feasibleHigh = pay * (1 - current);
  if (!feasible(feasibleHigh)) {
    for (let i = 0; i < 48; i++) {
      const mid = (feasibleLow + feasibleHigh) / 2;
      if (feasible(mid)) feasibleLow = mid; else feasibleHigh = mid;
    }
    feasibleHigh = feasibleLow;
  }
  if (feasibleHigh <= 0 || bandIndex(feasibleHigh) >= startBand)
    return { rate: current, reason: `No contribution the annual allowance supports leaves the ${config.nonSavingsBands[startBand]!.name} band.` };

  // Band occupancy is non-increasing in the contribution, so the smallest qualifying amount bisects.
  let low = 0, high = feasibleHigh;
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (bandIndex(mid) < startBand) high = mid; else low = mid;
  }
  // Round the rate up so the stored six-decimal rate still clears the boundary it was solved for.
  const solved = Math.min(1, Math.ceil(rateFor(high) * 1e6) / 1e6);
  const extra = (solved - current) * pay;
  if (!feasible(extra) || bandIndex(extra) >= startBand)
    return { rate: current, reason: `Rounding the solved contribution to a storable rate did not clear the ${config.nonSavingsBands[startBand]!.name} band.` };
  return {
    rate: solved,
    reason: `Employee contribution raised to ${(solved * 100).toFixed(2)}% of pensionable pay, the smallest contribution that leaves the ${config.nonSavingsBands[startBand]!.name} band.`,
  };
}

/**
 * Whether a contribution rate is supportable for the whole projection, not just the first year.
 *
 * Real salary growth and investment income move the tapered annual allowance, so a rate that fits
 * today can exceed the allowance a decade later. This is the solver's probe: the expected-value
 * ledger plus a spread of sampled paths, which is thousands of times cheaper than a simulation and
 * catches the case that actually bites. It is a probe, never a guarantee — a path outside it that
 * still breaches the allowance is reported as an unsupported cell rather than as a failed plan.
 */
function lifetimeSupportsRate(profile: Profile, rate: number, options: LedgerOptions): boolean {
  const candidate = withEmployeeRate(profile, rate);
  const years = candidate.personal.endAge - candidate.personal.currentAge;
  const total = candidate.simulation.count;
  const stride = Math.max(1, Math.floor(total / 4));
  try {
    runDeterministicProjection(candidate, options);
    for (let pathIndex = 0; pathIndex < total; pathIndex += stride) {
      runProjection(candidate, probeGenerator.generatePath({
        years, seed: candidate.simulation.seed, pathIndex, assumptions: candidate.market,
      }), options);
    }
    return true;
  } catch (error) {
    if (error instanceof PensionLimitError) return false;
    throw error;
  }
}

const probeGenerator = new ParametricReturnGenerator();

/** The largest employee rate at or below `wanted` the allowance supports across the projection. */
function feasibleEmployeeRate(profile: Profile, wanted: number, options: LedgerOptions): { rate: number; limited: boolean } {
  const capped = Math.max(0, Math.min(1, wanted));
  if (capped <= profile.pension.employeeRate) return { rate: capped, limited: false };
  if (lifetimeSupportsRate(profile, capped, options)) return { rate: capped, limited: false };
  let low = profile.pension.employeeRate, high = capped;
  if (!lifetimeSupportsRate(profile, low, options)) return { rate: low, limited: true };
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (lifetimeSupportsRate(profile, mid, options)) low = mid; else high = mid;
  }
  return { rate: Math.floor(low * 1e6) / 1e6, limited: true };
}

const ledgerOptionsFor = (options: ScenarioOptions): LedgerOptions => ({ ...defaultLedgerOptions(), ...options });

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

export const CAPITAL_STRATEGIES = ['isa_heavy', 'pension_band_optimised', 'balanced', 'property'] as const;
export type CapitalStrategyId = typeof CAPITAL_STRATEGIES[number];

export interface StrategyOutcome extends ScenarioPlan { note: string }

export interface CapitalStrategy {
  id: CapitalStrategyId;
  label: string;
  description: string;
  apply(plan: ScenarioPlan, context: StrategyContext): StrategyOutcome;
}

const isaHeavyRate = (profile: Profile): number => Math.min(profile.pension.employeeRate, profile.pension.matchUpToRate);

export const CAPITAL_STRATEGY_DEFINITIONS: readonly CapitalStrategy[] = [
  {
    id: 'isa_heavy', label: 'ISA Heavy',
    description: 'Contributes only what still earns the employer match already on offer, and directs the remaining surplus to the ISA allowance and then the GIA.',
    apply(plan) {
      const rate = isaHeavyRate(plan.profile);
      return {
        profile: withEmployeeRate(withoutPlannedPurchase(plan.profile), rate),
        options: { ...plan.options, surplusAllocation: 'isa_then_gia' },
        note: `Employee pension contribution set to ${(rate * 100).toFixed(2)}% — the match-preserving minimum for the entered policy. Surplus fills the ISA allowance first.`,
      };
    },
  },
  {
    id: 'pension_band_optimised', label: 'Pension Tax-Band Optimised',
    description: 'Raises the workplace contribution by the smallest amount that removes the top tax band the plan currently occupies, within the available annual allowance.',
    apply(plan) {
      const solved = bandOptimisedContribution(plan.profile);
      const supported = feasibleEmployeeRate(plan.profile, solved.rate, ledgerOptionsFor(plan.options));
      return {
        profile: withEmployeeRate(withoutPlannedPurchase(plan.profile), supported.rate),
        options: { ...plan.options, surplusAllocation: 'isa_then_gia' },
        note: supported.limited
          ? `${solved.reason} Held at ${(supported.rate * 100).toFixed(2)}% because a later projected year would exceed the available annual allowance, so the band is not fully vacated.`
          : solved.reason,
      };
    },
  },
  {
    id: 'balanced', label: 'Balanced',
    description: 'The entered contractual pension policy, with surplus filling the ISA allowance and then the GIA. This is the matrix reference point.',
    apply(plan) {
      return {
        profile: withoutPlannedPurchase(plan.profile),
        options: { ...plan.options, surplusAllocation: 'isa_then_gia' },
        note: `Contractual employee contribution of ${(plan.profile.pension.employeeRate * 100).toFixed(2)}% retained.`,
      };
    },
  },
  {
    id: 'property', label: 'Property',
    description: 'Buys the configured property inside the same lifetime model, with its deposit, purchase tax, mortgage, running costs and rent replacement.',
    apply(plan, context) {
      if (!context.property)
        throw new UnsupportedScenarioError('The property strategy needs a configured purchase; enter one on the Property & Leverage screen or in the scenario controls.');
      return {
        profile: withProperty(plan.profile, context.property),
        options: { ...plan.options, surplusAllocation: 'isa_then_gia' },
        note: `Buys at age ${context.property.purchase!.age} for £${context.property.purchase!.price.toLocaleString('en-GB')} with a £${context.property.purchase!.deposit.toLocaleString('en-GB')} deposit.`,
      };
    },
  },
];

export const capitalStrategy = (id: CapitalStrategyId): CapitalStrategy => {
  const found = CAPITAL_STRATEGY_DEFINITIONS.find(s => s.id === id);
  if (!found) throw new RangeError(`Unknown capital strategy ${id}`);
  return found;
};

/** Spec section 64's named scenarios. Each is an explicit, documented transform of the entered plan. */
export const SCENARIO_PRESETS = [
  'baseline', 'isa_heavy', 'pension_heavy', 'income_growth',
  'property_heavy', 'no_property', 'aggressive_fire', 'conservative_fire',
] as const;
export type ScenarioPresetId = typeof SCENARIO_PRESETS[number];

export interface ScenarioPreset {
  id: ScenarioPresetId;
  label: string;
  description: string;
  apply(plan: ScenarioPlan, context: StrategyContext): StrategyOutcome;
}

const FIRE_SHIFT_YEARS = 3;

export const SCENARIO_PRESET_DEFINITIONS: readonly ScenarioPreset[] = [
  {
    id: 'baseline', label: 'Baseline', description: 'The entered plan, unchanged.',
    apply: plan => ({ ...plan, note: 'The entered plan, unchanged.' }),
  },
  {
    id: 'isa_heavy', label: 'ISA Heavy',
    description: 'Only the match-preserving pension contribution; the rest of the surplus goes to the ISA allowance then the GIA.',
    apply(plan) {
      const rate = isaHeavyRate(plan.profile);
      return { profile: withEmployeeRate(plan.profile, rate), options: { ...plan.options, surplusAllocation: 'isa_then_gia' },
        note: `Employee pension contribution set to ${(rate * 100).toFixed(2)}%.` };
    },
  },
  {
    id: 'pension_heavy', label: 'Pension Heavy',
    description: 'Adds ten percentage points to the employee contribution, capped at what the annual allowance and relevant earnings support.',
    apply(plan) {
      const wanted = plan.profile.pension.employeeRate + 0.10;
      const { rate, limited } = feasibleEmployeeRate(plan.profile, wanted, ledgerOptionsFor(plan.options));
      if (rate <= plan.profile.pension.employeeRate)
        throw new UnsupportedScenarioError('No additional workplace contribution is supported by the available annual allowance or relevant earnings.');
      return { profile: withEmployeeRate(plan.profile, rate), options: plan.options,
        note: limited
          ? `Employee contribution raised to ${(rate * 100).toFixed(2)}%, limited by the annual allowance or relevant earnings in a later projected year.`
          : `Employee contribution raised to ${(rate * 100).toFixed(2)}%.` };
    },
  },
  {
    id: 'income_growth', label: 'Income Growth',
    description: 'Moves gross salary to the next band on the configured income-uplift axis (spec section 62).',
    apply(plan, context) {
      const next = [...context.salaryAxis].sort((a, b) => a - b).find(value => value > plan.profile.income.salaryAnnual);
      if (next === undefined)
        throw new UnsupportedScenarioError('Salary is already at or above the top of the configured income-uplift axis.');
      return { profile: withSalary(plan.profile, next), options: plan.options,
        note: `Gross salary raised to £${next.toLocaleString('en-GB')}, the next configured uplift band.` };
    },
  },
  {
    id: 'property_heavy', label: 'Property Heavy',
    description: 'Buys the configured property inside the same lifetime model.',
    apply(plan, context) {
      if (!context.property) throw new UnsupportedScenarioError('No property purchase is configured to compare.');
      return { profile: withProperty(plan.profile, context.property), options: plan.options,
        note: `Buys at age ${context.property.purchase!.age} for £${context.property.purchase!.price.toLocaleString('en-GB')}.` };
    },
  },
  {
    id: 'no_property', label: 'No Property',
    description: 'Removes the planned purchase and keeps the capital invested in financial assets.',
    apply(plan) {
      if (plan.profile.property === null) throw new UnsupportedScenarioError('The entered plan already has no property.');
      return { profile: withProperty(plan.profile, null), options: plan.options, note: 'Planned purchase removed.' };
    },
  },
  {
    id: 'aggressive_fire', label: 'Aggressive FIRE',
    description: `Brings the target FIRE age forward ${FIRE_SHIFT_YEARS} years.`,
    apply(plan) {
      const age = plan.profile.personal.targetFireAge - FIRE_SHIFT_YEARS;
      if (age < plan.profile.personal.currentAge)
        throw new UnsupportedScenarioError('A FIRE age three years earlier would fall before the current age.');
      return { profile: parseProfile({ ...plan.profile, personal: { ...plan.profile.personal, targetFireAge: age } }),
        options: plan.options, note: `Target FIRE age moved to ${age}.` };
    },
  },
  {
    id: 'conservative_fire', label: 'Conservative FIRE',
    description: `Delays the target FIRE age by ${FIRE_SHIFT_YEARS} years.`,
    apply(plan) {
      const age = plan.profile.personal.targetFireAge + FIRE_SHIFT_YEARS;
      if (age >= plan.profile.personal.endAge)
        throw new UnsupportedScenarioError('A FIRE age three years later would fall at or after the end age.');
      return { profile: parseProfile({ ...plan.profile, personal: { ...plan.profile.personal, targetFireAge: age } }),
        options: plan.options, note: `Target FIRE age moved to ${age}.` };
    },
  },
];

export const scenarioPreset = (id: ScenarioPresetId): ScenarioPreset => {
  const found = SCENARIO_PRESET_DEFINITIONS.find(p => p.id === id);
  if (!found) throw new RangeError(`Unknown scenario preset ${id}`);
  return found;
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export type ScenarioGroup = 'matrix' | 'library' | 'spending' | 'income';

export interface ScenarioAxes {
  salary: number | null;
  monthlySpending: number | null;
  strategy: CapitalStrategyId | null;
}

export type ScenarioCase =
  | { id: string; label: string; group: ScenarioGroup; axes: ScenarioAxes; status: 'planned'; note: string; plan: ScenarioPlan }
  | { id: string; label: string; group: ScenarioGroup; axes: ScenarioAxes; status: 'unsupported'; note: string; reason: string };

const emptyAxes = (): ScenarioAxes => ({ salary: null, monthlySpending: null, strategy: null });

const message = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Builds one case, converting an unsupported strategy into a reported reason rather than a throw. */
export function scenarioCase(
  id: string, label: string, group: ScenarioGroup, axes: ScenarioAxes,
  build: () => StrategyOutcome,
): ScenarioCase {
  try {
    const outcome = build();
    // Validating here means an invalid candidate can never reach an engine, even transiently.
    return { id, label, group, axes, status: 'planned', note: outcome.note,
      plan: { profile: parseProfile(outcome.profile), options: outcome.options } };
  } catch (error) {
    return { id, label, group, axes, status: 'unsupported', note: '', reason: message(error) };
  }
}

export interface MatrixRequest {
  /** Section 63: gross salary bands. */
  salaries: readonly number[];
  /** Section 63: household monthly spending cases. */
  monthlySpending: readonly number[];
  strategies: readonly CapitalStrategyId[];
  context: StrategyContext;
  /** Plan-level options every cell starts from. */
  options?: ScenarioOptions;
}

const spendingLabel = (monthly: number): string => `£${Math.round(monthly).toLocaleString('en-GB')}/mo`;
const salaryLabel = (salary: number): string => `£${Math.round(salary / 1000)}k`;

/** The complete salary × spending × strategy matrix, in a stable order. */
export function buildScenarioMatrix(profile: Profile, request: MatrixRequest): ScenarioCase[] {
  const baseOptions = request.options ?? defaultScenarioOptions();
  const cases: ScenarioCase[] = [];
  for (const salary of request.salaries) {
    for (const monthly of request.monthlySpending) {
      for (const id of request.strategies) {
        const strategy = capitalStrategy(id);
        cases.push(scenarioCase(
          `matrix:${salary}:${monthly}:${id}`,
          `${salaryLabel(salary)} · ${spendingLabel(monthly)} · ${strategy.label}`,
          'matrix', { salary, monthlySpending: monthly, strategy: id },
          () => strategy.apply({
            profile: withSalary(profile, salary),
            options: { ...baseOptions, monthlyHouseholdOverride: monthly },
          }, request.context),
        ));
      }
    }
  }
  return cases;
}

/** Section 61's spending cases at the entered salary and strategy. */
export function buildSpendingCases(
  profile: Profile, monthlySpending: readonly number[], strategy: CapitalStrategyId,
  context: StrategyContext, options: ScenarioOptions = defaultScenarioOptions(),
): ScenarioCase[] {
  const definition = capitalStrategy(strategy);
  return monthlySpending.map(monthly => scenarioCase(
    `spending:${monthly}:${strategy}`, spendingLabel(monthly), 'spending',
    { salary: profile.income.salaryAnnual, monthlySpending: monthly, strategy },
    () => definition.apply({ profile, options: { ...options, monthlyHouseholdOverride: monthly } }, context),
  ));
}

/** Section 62's income uplift bands at one spending case and strategy. */
export function buildIncomeCases(
  profile: Profile, salaries: readonly number[], monthly: number | null, strategy: CapitalStrategyId,
  context: StrategyContext, options: ScenarioOptions = defaultScenarioOptions(),
): ScenarioCase[] {
  const definition = capitalStrategy(strategy);
  return salaries.map(salary => scenarioCase(
    `income:${salary}:${monthly}:${strategy}`, salaryLabel(salary), 'income',
    { salary, monthlySpending: monthly, strategy },
    () => definition.apply({ profile: withSalary(profile, salary), options: { ...options, monthlyHouseholdOverride: monthly } }, context),
  ));
}

/** Saved named scenarios, each carrying its own profile and options. */
export function buildLibraryCases(scenarios: readonly { id: string; name: string; profile: Profile; options: ScenarioOptions }[]): ScenarioCase[] {
  return scenarios.map(scenario => scenarioCase(
    `library:${scenario.id}`, scenario.name, 'library',
    { ...emptyAxes(), salary: scenario.profile.income.salaryAnnual, monthlySpending: scenario.options.monthlyHouseholdOverride },
    () => ({ profile: scenario.profile, options: scenario.options, note: '' }),
  ));
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

export interface EngineVersions {
  engineVersion: string; simulationVersion: string; generatorVersion: string; taxConfigVersion: string; scenarioVersion: string;
}

export const engineVersions = (profile: Profile): EngineVersions => ({
  engineVersion: ENGINE_VERSION, simulationVersion: SIMULATION_VERSION,
  generatorVersion: new ParametricReturnGenerator().version,
  taxConfigVersion: getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear).version,
  scenarioVersion: SCENARIO_VERSION,
});

/**
 * The complete identity of a cell's result.
 *
 * The profile carries the seed, path count, market assumptions and every modelled input; the
 * resolved `LedgerOptions` carry every run option including the ones this screen never changes;
 * and the versions make a rebuilt engine, a new tax configuration or a new return generator produce
 * a different key rather than silently reusing an old number.
 */
export const scenarioCellKey = (profile: Profile, options: LedgerOptions, fireAgeSearch: FireAgeSearch | null = null): string =>
  stableStringify({ profile, options, versions: engineVersions(profile), fireAgeSearch });

export interface FireAgeSearch { fromAge: number; toAge: number }

export interface ScenarioDeterministic {
  age: number;
  grossIncome: number;
  takeHome: number;
  incomeTax: number;
  employeeNi: number;
  totalTax: number;
  /** Combined income tax and employee NI on the next £1,000 of gross salary. */
  marginalRate: number;
  marginalTax: number;
  marginalIncrement: number;
  pensionMember: number;
  pensionEmployer: number;
  pensionTotal: number;
  isaContribution: number;
  giaContribution: number;
  cashReserveContribution: number;
  /** Pension (member and employer) plus everything the surplus allocated this year. */
  totalInvested: number;
  investableSurplus: number;
  spendingTotal: number;
  /** Section 61's capital-target side of the spending effect. */
  retirementSpendingReal: number;
  referenceFireNumber: number;
}

export interface ScenarioSimulation {
  probability: number;
  standardError: number;
  bridgeFailureProbability: number;
  depletionProbability: number;
  terminalMean: number;
  terminalMedian: number;
  terminalP10: number;
  terminalWorst: number;
  /** Medians at the plan's own target FIRE age, in today's money. */
  fireAge: number;
  liquidAtFire: number;
  pensionAtFire: number;
  propertyEquityAtFire: number;
  netWorthAtFire: number;
  fireCapitalMedian: number;
  simulationCount: number;
}

export interface ScenarioFireAge {
  earliestQualifyingAge: number | null;
  probabilityAtTargetAge: number | null;
  fromAge: number;
  toAge: number;
  monotone: boolean;
}

export interface ScenarioCell {
  id: string;
  label: string;
  group: ScenarioGroup;
  axes: ScenarioAxes;
  status: 'evaluated' | 'unsupported';
  reason: string | null;
  note: string;
  key: string | null;
  fromCache: boolean;
  plan: { salaryAnnual: number; employeeRate: number; hasProperty: boolean; options: ScenarioOptions } | null;
  deterministic: ScenarioDeterministic | null;
  simulation: ScenarioSimulation | null;
  fireAge: ScenarioFireAge | null;
}

export interface ScenarioBatchRequest {
  cases: readonly ScenarioCase[];
  /** Explicitly requested reduced path count. Null means the entered full count. */
  previewPaths?: number | null;
  /** Optional per-cell earliest-qualifying-age search. Each age is another complete simulation. */
  fireAgeSearch?: FireAgeSearch | null;
  /** Transport-level ledger options. `marginalAction` and `rentInvestment` must stay null. */
  ledgerOptions?: Partial<LedgerOptions>;
}

export interface ScenarioProgress {
  stage: string;
  casesCompleted: number;
  casesPlanned: number;
  paths: SimulationProgress;
}

export interface ScenarioCache {
  get(key: string): ScenarioCell | undefined;
  set(key: string, cell: ScenarioCell): void;
}

export const memoryScenarioCache = (): ScenarioCache & { size: () => number } => {
  const store = new Map<string, ScenarioCell>();
  return { get: key => store.get(key), set: (key, cell) => { store.set(key, cell); }, size: () => store.size };
};

export interface ScenarioControls {
  signal?: AbortSignal;
  onProgress?: (progress: ScenarioProgress) => void;
  evaluate?: EvaluateProfile;
  cache?: ScenarioCache;
}

export interface ScenarioBatchResult {
  cells: ScenarioCell[];
  metadata: {
    scenarioVersion: string;
    versions: EngineVersions;
    seed: number;
    /** The count every evaluated cell actually ran. */
    simulationCount: number;
    /** The entered profile's own count, for comparison with a preview. */
    enteredSimulationCount: number;
    preview: boolean;
    pathIndices: { start: number; endExclusive: number } | null;
    fireAgeSearch: FireAgeSearch | null;
    baseOptions: LedgerOptions;
    moneyBasis: 'today';
    evaluated: number;
    unsupported: number;
    cacheHits: number;
  };
}

/** Two cells may only be compared when their metadata proves they ran the same draws. */
export function assertScenarioPaths(base: MonteCarloResult, candidate: MonteCarloResult): void {
  const a = base.metadata, b = candidate.metadata;
  if (a.seed !== b.seed || a.simulationCount !== b.simulationCount ||
      a.returnGeneratorVersion !== b.returnGeneratorVersion || a.engineVersion !== b.engineVersion ||
      JSON.stringify(a.pathIndices) !== JSON.stringify(b.pathIndices) ||
      JSON.stringify(a.profile.market) !== JSON.stringify(b.profile.market) ||
      a.profile.personal.currentAge !== b.profile.personal.currentAge ||
      a.profile.personal.endAge !== b.profile.personal.endAge)
    throw new Error('Scenario cells must share the seed, path indices, horizon and market assumptions.');
}

function deterministicSummary(profile: Profile, options: LedgerOptions): ScenarioDeterministic {
  const projection = runDeterministicProjection(profile, options);
  const year: LedgerYearDetail = projection.years[0]!;
  const index = year.inflationIndex;
  const real = (value: number) => value / index;
  const increment = 1000;
  let marginal: { rate: number; total: number } = { rate: Number.NaN, total: Number.NaN };
  try { marginal = marginalIncrement(profile, year, options, increment); } catch { /* reported as NaN */ }
  const activeIncome = year.employmentIncome + year.otherIncome + year.statePensionIncome + year.rentalIncome;
  return {
    age: year.age,
    grossIncome: real(year.grossIncome),
    takeHome: real(activeIncome - year.personalCashReduction - year.totalTax),
    incomeTax: real(year.incomeTax), employeeNi: real(year.employeeNi), totalTax: real(year.totalTax),
    marginalRate: marginal.rate, marginalTax: real(marginal.total), marginalIncrement: increment,
    pensionMember: real(year.pensionContributionMember),
    pensionEmployer: real(year.pensionContributionEmployer),
    pensionTotal: real(year.pensionContributionTotal),
    isaContribution: real(year.allocatedToIsa),
    giaContribution: real(year.allocatedToGia),
    cashReserveContribution: real(year.allocatedToCashReserve),
    totalInvested: real(year.pensionContributionTotal + year.allocatedToIsa + year.allocatedToGia + year.allocatedToCashReserve),
    investableSurplus: real(year.investableSurplus),
    spendingTotal: real(year.spendingRequired),
    retirementSpendingReal: projection.metrics.retirementSpendingReal,
    referenceFireNumber: projection.metrics.referenceFireNumber,
  };
}

function simulationSummary(profile: Profile, result: MonteCarloResult): ScenarioSimulation {
  const index = Math.max(0, Math.min(result.wealthByAge.length - 1, profile.personal.targetFireAge - profile.personal.currentAge));
  const at = result.wealthByAge[index]!;
  const n = result.metadata.simulationCount;
  return {
    probability: result.successProbability,
    standardError: Math.sqrt(Math.max(0, result.successProbability * (1 - result.successProbability)) / n),
    bridgeFailureProbability: result.bridgeFailureProbability,
    depletionProbability: result.depletionProbability,
    terminalMean: result.terminalWealth.mean, terminalMedian: result.terminalWealth.median,
    terminalP10: result.terminalWealth.p10, terminalWorst: result.terminalWealth.worst,
    fireAge: at.age, liquidAtFire: at.liquid.median, pensionAtFire: at.pension.median,
    propertyEquityAtFire: at.propertyEquity.median, netWorthAtFire: at.netWorth.median,
    fireCapitalMedian: result.fireCapital.median, simulationCount: n,
  };
}

const fireAgeSummary = (curve: FireAgeCurveResult, search: FireAgeSearch): ScenarioFireAge => ({
  earliestQualifyingAge: curve.earliestQualifyingAge, probabilityAtTargetAge: curve.probabilityAtTargetAge,
  fromAge: search.fromAge, toAge: search.toAge, monotone: curve.monotone,
});

/**
 * Run a batch of scenario cells on common market paths.
 *
 * Cancellation rejects: no partial matrix is returned, and no cell already computed is published on
 * its own. An unsupported strategy or an incomparable saved scenario is a reported cell, not a
 * rejection — the rest of the batch still runs.
 */
export async function runScenarioBatch(
  input: Profile, request: ScenarioBatchRequest, controls: ScenarioControls = {},
): Promise<ScenarioBatchResult> {
  const base = parseProfile(input);
  const baseOptions = ledgerOptionsSchema.parse({ ...defaultLedgerOptions(), ...request.ledgerOptions }) as LedgerOptions;
  if (baseOptions.rentInvestment !== null || baseOptions.marginalAction !== null)
    throw new RangeError('Scenario runs require rentInvestment and marginalAction null; they belong to the property and marginal comparisons.');
  const preview = request.previewPaths ?? null;
  if (preview !== null && (!Number.isInteger(preview) || preview < 1))
    throw new RangeError('previewPaths must be a positive integer when supplied');
  const search = request.fireAgeSearch ?? null;
  if (search && (!Number.isInteger(search.fromAge) || !Number.isInteger(search.toAge) || search.toAge < search.fromAge))
    throw new RangeError('The FIRE age search range must be whole ages with toAge >= fromAge');
  const evaluate = controls.evaluate ?? ((profile, inner) => runMonteCarlo(profile, {
    ledgerOptions: inner.ledgerOptions,
    ...(inner.signal ? { signal: inner.signal } : {}),
    ...(inner.onProgress ? { onProgress: inner.onProgress } : {}),
  }));

  const planned = request.cases.filter(c => c.status === 'planned').length;
  const cells: ScenarioCell[] = [];
  let completed = 0, cacheHits = 0;
  let reference: MonteCarloResult | null = null;
  let pathIndices: { start: number; endExclusive: number } | null = null;
  let simulationCount = preview ?? base.simulation.count;

  for (const item of request.cases) {
    abortIfNeeded(controls.signal);
    if (item.status === 'unsupported') {
      cells.push({ id: item.id, label: item.label, group: item.group, axes: item.axes, status: 'unsupported',
        reason: item.reason, note: item.note, key: null, fromCache: false, plan: null,
        deterministic: null, simulation: null, fireAge: null });
      continue;
    }
    const profile = preview === null ? item.plan.profile
      : parseProfile({ ...item.plan.profile, simulation: { ...item.plan.profile.simulation, count: preview } });
    const options = ledgerOptionsSchema.parse({ ...baseOptions, ...item.plan.options }) as LedgerOptions;
    const key = scenarioCellKey(profile, options, search);
    const unsupported = (reason: string): void => {
      cells.push({ id: item.id, label: item.label, group: item.group, axes: item.axes, status: 'unsupported',
        reason, note: item.note, key, fromCache: false, plan: null, deterministic: null, simulation: null, fireAge: null });
    };

    const cached = controls.cache?.get(key);
    if (cached) {
      cacheHits += 1;
      completed += 1;
      cells.push({ ...cached, id: item.id, label: item.label, group: item.group, axes: item.axes, note: item.note, fromCache: true });
      controls.onProgress?.({ stage: item.label, casesCompleted: completed, casesPlanned: planned,
        paths: { completed: profile.simulation.count, total: profile.simulation.count } });
      continue;
    }

    // Common random numbers: a candidate that changes the draw is incomparable, not comparable-ish.
    try { assertCommonPaths(base, preview === null ? profile : { ...profile, simulation: { ...profile.simulation, count: base.simulation.count } }); }
    catch (error) { unsupported(message(error)); continue; }

    let deterministic: ScenarioDeterministic;
    try { deterministic = deterministicSummary(profile, options); }
    catch (error) { unsupported(message(error)); continue; }

    let result: MonteCarloResult;
    try {
      result = await evaluate(profile, {
        ledgerOptions: options,
        ...(controls.signal ? { signal: controls.signal } : {}),
        ...(controls.onProgress ? {
          onProgress: (paths: SimulationProgress) =>
            controls.onProgress?.({ stage: item.label, casesCompleted: completed, casesPlanned: planned, paths }),
        } : {}),
      });
    } catch (error) {
      abortIfNeeded(controls.signal);
      if (error instanceof PensionLimitError || error instanceof UnsupportedScenarioError) { unsupported(message(error)); continue; }
      throw error;
    }
    abortIfNeeded(controls.signal);
    if (reference) assertScenarioPaths(reference, result); else reference = result;
    pathIndices ??= result.metadata.pathIndices;
    simulationCount = result.metadata.simulationCount;

    let fireAge: ScenarioFireAge | null = null;
    if (search) {
      const curve = await fireAgeCurve(profile, { fromAge: search.fromAge, toAge: search.toAge, ledgerOptions: options }, {
        evaluate,
        ...(controls.signal ? { signal: controls.signal } : {}),
        ...(controls.onProgress ? {
          onProgress: progress => controls.onProgress?.({
            stage: `${item.label}: FIRE age ${progress.age}`, casesCompleted: completed, casesPlanned: planned, paths: progress.paths,
          }),
        } : {}),
      });
      fireAge = fireAgeSummary(curve, search);
    }
    abortIfNeeded(controls.signal);

    const cell: ScenarioCell = {
      id: item.id, label: item.label, group: item.group, axes: item.axes, status: 'evaluated', reason: null,
      note: item.note, key, fromCache: false,
      plan: { salaryAnnual: profile.income.salaryAnnual, employeeRate: profile.pension.employeeRate,
        hasProperty: profile.property !== null, options: item.plan.options },
      deterministic, simulation: simulationSummary(profile, result), fireAge,
    };
    controls.cache?.set(key, cell);
    cells.push(cell);
    completed += 1;
    controls.onProgress?.({ stage: item.label, casesCompleted: completed, casesPlanned: planned,
      paths: { completed: profile.simulation.count, total: profile.simulation.count } });
  }
  abortIfNeeded(controls.signal);

  return {
    cells,
    metadata: {
      scenarioVersion: SCENARIO_VERSION, versions: engineVersions(base), seed: base.simulation.seed,
      simulationCount, enteredSimulationCount: base.simulation.count, preview: preview !== null,
      pathIndices, fireAgeSearch: search, baseOptions, moneyBasis: 'today',
      evaluated: cells.filter(c => c.status === 'evaluated').length,
      unsupported: cells.filter(c => c.status === 'unsupported').length,
      cacheHits,
    },
  };
}
