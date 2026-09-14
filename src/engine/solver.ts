/**
 * Bounded reverse solvers (spec sections 32, 33 and 60).
 *
 * Every mode searches ONE profile input and scores each candidate with the complete lifetime model
 * — the same ledger, property cash flows, tax rules, allowances, liquidity constraints and Monte
 * Carlo engine the FIRE screen uses. Nothing here optimises a reference ratio, and nothing invents
 * capital: a candidate is a validated `Profile`, so every dependent effect (marginal tax, NI,
 * pension relief, ISA capacity, the emergency reserve, pension access) follows automatically.
 *
 * Conventions that make a returned answer meaningful:
 *
 * - Candidates share the seed, path count and market assumptions of the entered profile, so the
 *   probability difference between two candidates is a difference in the plan, never in the draw.
 *   `assertCommonPaths` enforces this rather than trusting each `apply`.
 * - The searched value is quantised to the mode's `precision` before it is evaluated, so no result
 *   is ever reported at a precision the search did not actually test.
 * - Search precision is not Monte Carlo precision. With a fixed seed the probability is an exact,
 *   reproducible step function of the input, but it still estimates the underlying probability with
 *   a standard error of sqrt(p(1-p)/n); `standardError` carries that, and callers must present it.
 * - The answer is the smallest tested qualifying value, taken over every evaluation. That holds
 *   whether or not the probability turned out to be monotone in the input, and the result records
 *   what monotonicity was actually observed instead of assuming it.
 * - A returned candidate is re-evaluated from scratch against the full model. `confirmed` is false
 *   if that re-evaluation does not clear the target.
 */
import { parseProfile, type Profile } from '../domain/contracts.js';
import { defaultLedgerOptions, runDeterministicProjection, runProjection, type LedgerOptions } from './ledger.js';
import { ParametricReturnGenerator } from './monte-carlo/generator.js';
import { abortIfNeeded, ledgerOptionsSchema, runMonteCarlo } from './monte-carlo/simulation.js';
import type { MonteCarloResult, SimulationProgress } from './monte-carlo/simulation.js';
import { retirementAnnualReal } from './spending.js';

export const SOLVER_VERSION = 'reverse-solver-v1';

export type SolverModeId =
  | 'salary' | 'savings' | 'fire_age' | 'retirement_spending' | 'starting_capital' | 'pension_contribution';

/** Where an extra opening balance is placed. The choice is explicit because it changes the answer. */
export type CapitalDestination = 'cash' | 'isa' | 'gia' | 'pension';

export type SolverUnit = 'money' | 'monthlyMoney' | 'rate' | 'age';

export interface SolverRequest {
  mode: SolverModeId;
  /** Defaults to the profile's own target. */
  targetProbability?: number;
  /** Far end of the search, in the mode's own units. Defaults per mode. */
  bound?: number;
  /** Hard ceiling on full-model evaluations, excluding the confirmation run. */
  maxEvaluations?: number;
  startingCapitalDestination?: CapitalDestination;
  ledgerOptions?: Partial<LedgerOptions>;
}

export interface SolverProgress {
  stage: string;
  evaluationsCompleted: number;
  /** An estimate for the bisection; it never drops below what has already completed. */
  evaluationsPlanned: number;
  paths: SimulationProgress;
}

export type EvaluateProfile = (
  profile: Profile,
  controls: { ledgerOptions: LedgerOptions; signal?: AbortSignal; onProgress?: (progress: SimulationProgress) => void },
) => Promise<MonteCarloResult>;

export interface SolverControls {
  signal?: AbortSignal;
  onProgress?: (progress: SolverProgress) => void;
  /** Transport seam. The browser adapter runs the same engine inside a worker pool. */
  evaluate?: EvaluateProfile;
}

export interface SolverEvaluation {
  /** Distance from the current value, in the helpful direction. Always >= 0. */
  step: number;
  value: number;
  status: 'evaluated' | 'invalid';
  /** Null when the candidate is not a supported, valid profile. */
  probability: number | null;
  meetsTarget: boolean;
  message: string | null;
  medianTerminalWealthReal: number | null;
  bridgeFailureProbability: number | null;
  depletionProbability: number | null;
  medianFireCapitalReal: number | null;
}

export type SolverStatus = 'already_met' | 'solved' | 'infeasible' | 'unsupported';

export interface SolverResult {
  mode: SolverModeId;
  label: string;
  definition: string;
  unit: SolverUnit;
  status: SolverStatus;
  message: string | null;
  targetProbability: number;
  currentValue: number;
  currentProbability: number | null;
  /** The smallest tested value clearing the target, or null when none did. */
  requiredValue: number | null;
  requiredProbability: number | null;
  /** An independent re-run of the returned candidate through the complete model. */
  confirmedProbability: number | null;
  confirmed: boolean;
  /** Largest tested value that did NOT clear the target, below the answer. */
  excludedValue: number | null;
  bound: { value: number; probability: number | null };
  precision: number;
  /** sqrt(p(1-p)/n) at the returned probability: the sampling uncertainty, not the search step. */
  standardError: number | null;
  simulationCount: number;
  monotoneAssumed: boolean;
  /** What the evaluations actually showed. A false value invalidates any "smallest possible" claim. */
  probabilityMonotoneObserved: boolean;
  feasibilityMonotoneObserved: boolean;
  evaluations: SolverEvaluation[];
  /** Extra measured facts about the solved plan, in today's money. */
  derived: { annualInvestableSurplusReal: number | null; retirementSpendingAnnualReal: number | null };
  notes: string[];
  metadata: SolverMetadata;
}

export interface SolverMetadata {
  solverVersion: string;
  engineVersion: string;
  generatorVersion: string;
  seed: number;
  simulationCount: number;
  pathIndices: { start: number; endExclusive: number };
  ledgerOptions: LedgerOptions;
  moneyBasis: 'today';
  startingCapitalDestination: CapitalDestination;
  maxEvaluations: number;
}

interface ResolvedRequest {
  mode: SolverModeId;
  targetProbability: number;
  maxEvaluations: number;
  startingCapitalDestination: CapitalDestination;
  options: LedgerOptions;
}

interface ModeContext { profile: Profile; options: LedgerOptions; current: number; request: ResolvedRequest }

interface ModeDefinition {
  id: SolverModeId;
  label: string;
  unit: SolverUnit;
  /** Search resolution in the mode's units; results are never finer than this. */
  precision: number;
  /** Which way the input must move to help the plan. */
  direction: 'increase' | 'decrease';
  /** True only where a single-signed effect is genuinely expected; still verified, never trusted. */
  monotoneAssumed: boolean;
  /** Ordered coarse grid used when monotonicity is not assumed. */
  scanPoints: number;
  definition: string;
  /** Reason this mode cannot run for this profile/options pair, or null. */
  unsupported(context: Omit<ModeContext, 'current'>): string | null;
  current(context: Omit<ModeContext, 'current'>): number;
  defaultBound(context: ModeContext): number;
  apply(context: ModeContext, value: number): unknown;
}

const round12 = (value: number): number => Number(value.toPrecision(12));

/** Cut a monthly essential/discretionary pair by `cut` per month, discretionary first. */
function cutMonthly(essential: number, discretionary: number, cut: number): { essential: number; discretionary: number } {
  const fromDiscretionary = Math.min(discretionary, Math.max(0, cut));
  const remaining = Math.max(0, cut - fromDiscretionary);
  return {
    essential: Math.max(0, round12(essential - remaining)),
    discretionary: Math.max(0, round12(discretionary - fromDiscretionary)),
  };
}

/** Today's-money investable surplus in the first projected year of the expected-value run. */
function firstYearSurplusReal(profile: Profile, options: LedgerOptions): number {
  const first = runDeterministicProjection(profile, options).years[0];
  if (!first) throw new RangeError('Projection produced no years');
  return first.investableSurplus / first.inflationIndex;
}

const MODES: readonly ModeDefinition[] = [
  {
    id: 'salary', label: 'Required gross salary', unit: 'money', precision: 100,
    direction: 'increase', monotoneAssumed: true, scanPoints: 6,
    definition: 'Gross annual salary in today’s money, with spending, allocation, pension policy and every other input held fixed. Income tax, National Insurance, pension relief and contribution rates all follow the new salary, and the extra net pay reaches the accounts through the plan’s existing surplus allocation. Lifestyle creep, where configured, applies to the larger real salary too.',
    unsupported: () => null,
    current: ({ profile }) => profile.income.salaryAnnual,
    defaultBound: ({ current }) => Math.max(round12(current * 3), current + 200_000, 100_000),
    apply: ({ profile }, value) => ({ ...profile, income: { ...profile.income, salaryAnnual: value } }),
  },
  {
    id: 'savings', label: 'Required annual savings', unit: 'money', precision: 100,
    direction: 'increase', monotoneAssumed: true, scanPoints: 6,
    definition: 'Annual investable surplus during accumulation, in today’s money, funded by spending less while working. Income, tax and retirement spending are unchanged; the working-life budget is cut pound for pound, discretionary first, in the current-spending schedule and in any spending phase that ends at or before the FIRE age. No capital is created: the extra saving is money the household stops spending.',
    unsupported: ({ options }) => options.monthlyHouseholdOverride !== null
      ? 'A household spending override replaces every schedule, so cutting the working-life budget would have no effect. Clear the override to search for required savings.'
      : null,
    current: ({ profile, options }) => firstYearSurplusReal(profile, options),
    defaultBound: ({ profile, current }) =>
      current + 12 * (profile.spending.current.essentialMonthly + profile.spending.current.discretionaryMonthly),
    apply: ({ profile, current }, value) => {
      const monthlyCut = Math.max(0, value - current) / 12;
      const fireAge = profile.personal.targetFireAge;
      const next = structuredClone(profile) as Profile;
      const level = cutMonthly(next.spending.current.essentialMonthly, next.spending.current.discretionaryMonthly, monthlyCut);
      const oldTotal = next.spending.current.essentialMonthly + next.spending.current.discretionaryMonthly;
      const newTotal = level.essential + level.discretionary;
      next.spending.current = { essentialMonthly: level.essential, discretionaryMonthly: level.discretionary };
      next.spending.phases = next.spending.phases.map(phase => phase.endAge <= fireAge
        ? { ...phase, ...renamePhase(cutMonthly(phase.essentialMonthly, phase.discretionaryMonthly, monthlyCut)) }
        : phase);
      // The schema requires both to stay consistent with the reduced working-life budget.
      next.spending.currentRentMonthlyIncluded = Math.min(next.spending.currentRentMonthlyIncluded, newTotal);
      if (next.spending.breakdown) {
        const scale = oldTotal > 0 ? newTotal / oldTotal : 0;
        next.spending.breakdown = {
          sharedMonthly: round12(next.spending.breakdown.sharedMonthly * scale),
          perAdultMonthly: round12(next.spending.breakdown.perAdultMonthly * scale),
          perChildMonthly: round12(next.spending.breakdown.perChildMonthly * scale),
        };
      }
      return next;
    },
  },
  {
    id: 'fire_age', label: 'Earliest qualifying FIRE age', unit: 'age', precision: 1,
    direction: 'increase', monotoneAssumed: false, scanPoints: 0,
    definition: 'The FIRE age itself. Retiring later means more contributing years, fewer funded retirement years and a shorter pre-pension bridge, but it also moves the plan relative to a property purchase, a mortgage term and the pension access age, so the probability is not assumed to rise with every extra year. Every candidate age in range is evaluated in order.',
    unsupported: () => null,
    current: ({ profile }) => profile.personal.targetFireAge,
    defaultBound: ({ profile }) => profile.personal.endAge - 1,
    apply: ({ profile }, value) => ({ ...profile, personal: { ...profile.personal, targetFireAge: Math.round(value) } }),
  },
  {
    id: 'retirement_spending', label: 'Sustainable retirement spending', unit: 'monthlyMoney', precision: 5,
    direction: 'decrease', monotoneAssumed: true, scanPoints: 6,
    definition: 'Household retirement spending per month in today’s money, for the retirement level this run uses. Working-life spending, income and allocation are unchanged, so this is the spending reduction the plan needs from the FIRE age onwards. The reference FIRE number moves with it.',
    unsupported: ({ options }) => options.monthlyHouseholdOverride !== null
      ? 'A household spending override already fixes every year’s budget. Clear the override to search for sustainable retirement spending.'
      : null,
    current: ({ profile, options }) => retirementAnnualReal(profile, options) / 12,
    // Comfort may never fall below the target schedule, which is a separate input.
    defaultBound: ({ profile, options }) => options.retirementLevel === 'comfort'
      ? profile.spending.retirement.essentialMonthly + profile.spending.retirement.discretionaryMonthly
      : 0,
    apply: ({ profile, options }, value) => {
      const next = structuredClone(profile) as Profile;
      const total = round12(value * 12);
      const targetTotal = 12 * (next.spending.retirement.essentialMonthly + next.spending.retirement.discretionaryMonthly);
      if (options.retirementLevel === 'floor') {
        next.spending.retirementFloorAnnual = total;
      } else if (options.retirementLevel === 'comfort') {
        next.spending.retirementComfortAnnual = total;
      } else {
        const level = cutMonthly(next.spending.retirement.essentialMonthly, next.spending.retirement.discretionaryMonthly,
          Math.max(0, (targetTotal - total) / 12));
        next.spending.retirement = { essentialMonthly: level.essential, discretionaryMonthly: level.discretionary };
        // floor <= target <= comfort must survive the reduction.
        next.spending.retirementFloorAnnual = Math.min(next.spending.retirementFloorAnnual, total);
        next.spending.retirementComfortAnnual = Math.max(next.spending.retirementComfortAnnual, total);
      }
      return next;
    },
  },
  {
    id: 'starting_capital', label: 'Required additional starting capital', unit: 'money', precision: 500,
    direction: 'increase', monotoneAssumed: true, scanPoints: 6,
    definition: 'An extra opening balance today, on top of the entered assets. This is an explicit hypothetical injection — the one search that adds money the plan does not already have — so the destination is chosen deliberately: it changes accessibility, tax and therefore the answer. A GIA injection is entered at cost, so it carries no latent gain.',
    unsupported: () => null,
    current: () => 0,
    defaultBound: ({ profile }) => {
      const assets = profile.assets;
      const financial = assets.cash + assets.isa + assets.gia.marketValue + assets.pension + assets.sipp;
      return Math.max(250_000, round12(financial * 5));
    },
    apply: ({ profile, request }, value) => {
      const next = structuredClone(profile) as Profile;
      const destination = request.startingCapitalDestination;
      if (destination === 'cash') next.assets.cash = round12(next.assets.cash + value);
      else if (destination === 'isa') next.assets.isa = round12(next.assets.isa + value);
      else if (destination === 'pension') next.assets.pension = round12(next.assets.pension + value);
      else {
        next.assets.gia.marketValue = round12(next.assets.gia.marketValue + value);
        next.assets.gia.costBasis = round12(next.assets.gia.costBasis + value);
      }
      return next;
    },
  },
  {
    id: 'pension_contribution', label: 'Required employee pension contribution', unit: 'rate', precision: 0.005,
    direction: 'increase', monotoneAssumed: false, scanPoints: 9,
    definition: 'The employee contribution rate, with the employer rate, match and method unchanged. Contributing more shelters income from tax but locks it until the pension access age, so a higher rate can strengthen the retirement years and starve the pre-pension bridge at the same time. Monotonicity is therefore not assumed: a coarse grid is scanned in order before the first qualifying interval is refined. Rates whose contributions exceed the available annual allowance are recorded as invalid candidates, not as plan failures.',
    unsupported: () => null,
    current: ({ profile }) => profile.pension.employeeRate,
    defaultBound: () => 0.6,
    apply: ({ profile }, value) => ({ ...profile, pension: { ...profile.pension, employeeRate: round12(value) } }),
  },
];

/** Phase objects use the same two keys; this keeps the spread readable. */
function renamePhase(level: { essential: number; discretionary: number }): { essentialMonthly: number; discretionaryMonthly: number } {
  return { essentialMonthly: level.essential, discretionaryMonthly: level.discretionary };
}

export const solverMode = (id: SolverModeId): ModeDefinition => {
  const found = MODES.find(mode => mode.id === id);
  if (!found) throw new RangeError(`Unknown solver mode ${id}`);
  return found;
};

export interface SolverModeSummary {
  id: SolverModeId; label: string; unit: SolverUnit; precision: number;
  direction: 'increase' | 'decrease'; monotoneAssumed: boolean; definition: string;
}

export const SOLVER_MODES: readonly SolverModeSummary[] = MODES.map(mode => ({
  id: mode.id, label: mode.label, unit: mode.unit, precision: mode.precision,
  direction: mode.direction, monotoneAssumed: mode.monotoneAssumed, definition: mode.definition,
}));

/** Current value and default search bound, so a screen can show the range before running anything. */
export function solverBounds(profile: Profile, request: SolverRequest): { current: number; bound: number; unsupported: string | null } {
  const resolved = resolveRequest(profile, request);
  const mode = solverMode(request.mode);
  const base = { profile, options: resolved.options, request: resolved };
  const unsupported = mode.unsupported(base);
  if (unsupported) return { current: Number.NaN, bound: Number.NaN, unsupported };
  const current = mode.current(base);
  return { current, bound: request.bound ?? mode.defaultBound({ ...base, current }), unsupported: null };
}

function resolveRequest(profile: Profile, request: SolverRequest): ResolvedRequest {
  const options = ledgerOptionsSchema.parse({ ...defaultLedgerOptions(), ...request.ledgerOptions }) as LedgerOptions;
  if (options.rentInvestment !== null)
    throw new RangeError('Solver candidates must leave rentInvestment null; it belongs to the property comparison');
  const target = request.targetProbability ?? profile.personal.targetSuccessProbability;
  if (!Number.isFinite(target) || target <= 0 || target > 1)
    throw new RangeError('targetProbability must be inside (0, 1]');
  const maxEvaluations = request.maxEvaluations ?? 24;
  if (!Number.isInteger(maxEvaluations) || maxEvaluations < 3) throw new RangeError('maxEvaluations must be an integer >= 3');
  return {
    mode: request.mode, targetProbability: target, maxEvaluations,
    startingCapitalDestination: request.startingCapitalDestination ?? 'gia', options,
  };
}

/** Candidates must differ from the base plan only in the searched input's downstream effects. */
function assertCommonPaths(base: Profile, candidate: Profile): void {
  if (candidate.simulation.seed !== base.simulation.seed || candidate.simulation.count !== base.simulation.count)
    throw new Error('A solver candidate changed the seed or path count; candidates must share the same draws');
  if (JSON.stringify(candidate.market) !== JSON.stringify(base.market))
    throw new Error('A solver candidate changed the market assumptions; candidates must share the same draws');
  if (candidate.personal.currentAge !== base.personal.currentAge || candidate.personal.endAge !== base.personal.endAge)
    throw new Error('A solver candidate changed the projection horizon; candidates must share the same draws');
}

const defaultEvaluate: EvaluateProfile = (profile, controls) => runMonteCarlo(profile, {
  ledgerOptions: controls.ledgerOptions,
  ...(controls.signal ? { signal: controls.signal } : {}),
  ...(controls.onProgress ? { onProgress: controls.onProgress } : {}),
});

const standardErrorOf = (probability: number | null, count: number): number | null =>
  probability === null || count < 1 ? null : Math.sqrt(Math.max(0, probability * (1 - probability)) / count);

/**
 * Solve one searched input against the full-model success probability.
 *
 * Cancellation rejects with `AbortError`; a cancelled search never returns a partial answer.
 */
export async function solveTarget(input: Profile, request: SolverRequest, controls: SolverControls = {}): Promise<SolverResult> {
  const profile = parseProfile(input);
  const resolved = resolveRequest(profile, request);
  const mode = solverMode(request.mode);
  const evaluate = controls.evaluate ?? defaultEvaluate;
  const notes: string[] = [];
  const metadataBase = {
    solverVersion: SOLVER_VERSION, engineVersion: '', generatorVersion: '',
    seed: profile.simulation.seed, simulationCount: profile.simulation.count,
    pathIndices: { start: 0, endExclusive: profile.simulation.count }, ledgerOptions: resolved.options,
    moneyBasis: 'today' as const, startingCapitalDestination: resolved.startingCapitalDestination,
    maxEvaluations: resolved.maxEvaluations,
  };
  const shell = (status: SolverStatus, message: string, current: number, bound: number): SolverResult => ({
    mode: mode.id, label: mode.label, definition: mode.definition, unit: mode.unit, status, message,
    targetProbability: resolved.targetProbability, currentValue: current, currentProbability: null,
    requiredValue: null, requiredProbability: null, confirmedProbability: null, confirmed: false,
    excludedValue: null, bound: { value: bound, probability: null }, precision: mode.precision,
    standardError: null, simulationCount: profile.simulation.count, monotoneAssumed: mode.monotoneAssumed,
    probabilityMonotoneObserved: true, feasibilityMonotoneObserved: true, evaluations: [],
    derived: { annualInvestableSurplusReal: null, retirementSpendingAnnualReal: null }, notes,
    metadata: metadataBase,
  });

  const base = { profile, options: resolved.options, request: resolved };
  const unsupported = mode.unsupported(base);
  if (unsupported) return shell('unsupported', unsupported, Number.NaN, Number.NaN);

  let current: number;
  try { current = mode.current(base); } catch (error) {
    return shell('unsupported', `The entered plan could not be projected: ${message(error)}`, Number.NaN, Number.NaN);
  }
  const context: ModeContext = { ...base, current };
  const bound = request.bound ?? mode.defaultBound(context);
  if (!Number.isFinite(bound)) throw new RangeError('Search bound must be finite');
  const sign = mode.direction === 'increase' ? 1 : -1;
  const maxStep = Math.max(0, (bound - current) * sign);
  const valueAt = (step: number): number => round12(current + sign * step);
  /** The far end actually searched. It shrinks when the model stops supporting larger values. */
  let ceiling = maxStep;

  let completed = 0;
  let planned = Math.min(resolved.maxEvaluations,
    mode.monotoneAssumed
      ? 2 + Math.max(0, Math.ceil(Math.log2(Math.max(1, maxStep / mode.precision))))
      : 2 + Math.max(1, mode.scanPoints > 0 ? mode.scanPoints : Math.ceil(maxStep / mode.precision)));
  const cache = new Map<number, SolverEvaluation>();
  const evaluations: SolverEvaluation[] = [];

  const quantise = (step: number): number =>
    Math.max(0, Math.min(maxStep, round12(Math.round(step / mode.precision) * mode.precision)));

  /**
   * Cheap support probe: does this candidate parse and project at all?
   *
   * It runs the expected-value ledger plus a spread of sampled paths, because the case it mainly
   * catches — a pension annual allowance tapered away by adjusted income — reacts to investment
   * income and so can appear on a strong path and not on the mean one. A handful of projections is
   * thousands of times cheaper than a full simulation, so narrowing an unusable search bound costs
   * almost nothing. It is a probe, never the answer: the full model still confirms the bound, and
   * the search falls back to narrowing by complete simulation if the probe proves optimistic.
   */
  const probeGenerator = new ParametricReturnGenerator();
  const supported = (step: number): { ok: boolean; message: string | null } => {
    try {
      const candidate = parseProfile(mode.apply(context, valueAt(step)));
      assertCommonPaths(profile, candidate);
      runDeterministicProjection(candidate, resolved.options);
      const years = candidate.personal.endAge - candidate.personal.currentAge;
      const total = candidate.simulation.count;
      const stride = Math.max(1, Math.floor(total / 8));
      for (let index = 0; index < total; index += stride) {
        runProjection(candidate, probeGenerator.generatePath({
          years, seed: candidate.simulation.seed, pathIndex: index, assumptions: candidate.market,
        }), resolved.options);
      }
      return { ok: true, message: null };
    } catch (error) { return { ok: false, message: message(error) }; }
  };

  const at = async (rawStep: number, stage: string): Promise<SolverEvaluation> => {
    const step = quantise(rawStep);
    const cached = cache.get(step);
    if (cached) return cached;
    abortIfNeeded(controls.signal);
    const value = valueAt(step);
    let evaluation: SolverEvaluation;
    try {
      const candidate = parseProfile(mode.apply(context, value));
      assertCommonPaths(profile, candidate);
      const result = await evaluate(candidate, {
        ledgerOptions: resolved.options,
        ...(controls.signal ? { signal: controls.signal } : {}),
        ...(controls.onProgress ? {
          onProgress: (paths: SimulationProgress) => controls.onProgress?.({
            stage, evaluationsCompleted: completed, evaluationsPlanned: Math.max(planned, completed + 1), paths,
          }),
        } : {}),
      });
      metadataBase.engineVersion = result.metadata.engineVersion;
      metadataBase.generatorVersion = result.metadata.returnGeneratorVersion;
      evaluation = {
        step, value, status: 'evaluated', probability: result.successProbability,
        meetsTarget: result.successProbability >= resolved.targetProbability, message: null,
        medianTerminalWealthReal: result.terminalWealth.median,
        bridgeFailureProbability: result.bridgeFailureProbability,
        depletionProbability: result.depletionProbability,
        medianFireCapitalReal: result.fireCapital.median,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      evaluation = {
        step, value, status: 'invalid', probability: null, meetsTarget: false, message: message(error),
        medianTerminalWealthReal: null, bridgeFailureProbability: null, depletionProbability: null,
        medianFireCapitalReal: null,
      };
    }
    cache.set(step, evaluation);
    evaluations.push(evaluation);
    completed += 1;
    planned = Math.max(planned, completed);
    controls.onProgress?.({
      stage, evaluationsCompleted: completed, evaluationsPlanned: planned,
      paths: { completed: profile.simulation.count, total: profile.simulation.count },
    });
    return evaluation;
  };

  const label = (value: number) => `${mode.label}: testing ${formatRaw(value, mode.unit)}`;
  const start = await at(0, label(valueAt(0)));
  if (start.status === 'invalid')
    return { ...shell('unsupported', `The entered plan could not be evaluated: ${start.message ?? 'unknown error'}`, current, bound), evaluations };

  async function complete(status: SolverStatus, answer: SolverEvaluation | null, extraNote?: string): Promise<SolverResult> {
    if (extraNote) notes.push(extraNote);
    const ordered = [...evaluations].sort((a, b) => a.step - b.step);
    let probabilityMonotone = true;
    let feasibilityMonotone = true;
    let previous: SolverEvaluation | null = null;
    for (const evaluation of ordered) {
      if (evaluation.status !== 'evaluated') continue;
      if (previous) {
        if (evaluation.probability! < previous.probability! - 1e-12) probabilityMonotone = false;
        if (previous.meetsTarget && !evaluation.meetsTarget) feasibilityMonotone = false;
      }
      previous = evaluation;
    }
    const excluded = answer
      ? ordered.filter(e => e.status === 'evaluated' && !e.meetsTarget && e.step < answer.step).at(-1) ?? null
      : null;
    let confirmedProbability: number | null = null;
    let derived = { annualInvestableSurplusReal: null as number | null, retirementSpendingAnnualReal: null as number | null };
    if (answer && answer.status === 'evaluated') {
      // Independent re-evaluation of the returned candidate through the complete model.
      abortIfNeeded(controls.signal);
      const candidate = parseProfile(mode.apply(context, answer.value));
      const confirmation = await evaluate(candidate, {
        ledgerOptions: resolved.options,
        ...(controls.signal ? { signal: controls.signal } : {}),
        ...(controls.onProgress ? {
          onProgress: (paths: SimulationProgress) => controls.onProgress?.({
            stage: `Confirming ${formatRaw(answer.value, mode.unit)} against the full model`,
            evaluationsCompleted: completed, evaluationsPlanned: planned + 1, paths,
          }),
        } : {}),
      });
      confirmedProbability = confirmation.successProbability;
      derived = {
        annualInvestableSurplusReal: safeSurplus(candidate, resolved.options),
        retirementSpendingAnnualReal: retirementAnnualReal(candidate, resolved.options),
      };
      if (Math.abs(confirmedProbability - (answer.probability ?? 0)) > 1e-12)
        notes.push('The confirmation run did not reproduce the search evaluation exactly; treat the result as unverified.');
    }
    if (!probabilityMonotone)
      notes.push('Success probability did not rise consistently with this input across the tested values. The answer is the smallest value that was tested and cleared the target, not a proven minimum.');
    const boundEvaluation = cache.get(ceiling) ?? null;
    return {
      mode: mode.id, label: mode.label, definition: mode.definition, unit: mode.unit, status,
      message: null, targetProbability: resolved.targetProbability, currentValue: current,
      currentProbability: start.probability,
      requiredValue: answer ? answer.value : null,
      requiredProbability: answer ? answer.probability : null,
      confirmedProbability,
      confirmed: confirmedProbability !== null && confirmedProbability >= resolved.targetProbability,
      excludedValue: excluded ? excluded.value : null,
      bound: { value: valueAt(ceiling), probability: boundEvaluation ? boundEvaluation.probability : null },
      precision: mode.precision,
      standardError: standardErrorOf(answer ? answer.probability : start.probability, profile.simulation.count),
      simulationCount: profile.simulation.count, monotoneAssumed: mode.monotoneAssumed,
      probabilityMonotoneObserved: probabilityMonotone, feasibilityMonotoneObserved: feasibilityMonotone,
      evaluations: ordered, derived, notes, metadata: { ...metadataBase },
    };
  }

  if (start.meetsTarget)
    return complete('already_met', start, 'The entered plan already clears the target, so no change to this input is required.');
  if (maxStep <= 0)
    return complete('infeasible', null, 'The search bound leaves no room to move this input in the helpful direction.');

  let low = 0;
  let high = maxStep;

  if (mode.monotoneAssumed) {
    let boundEvaluation = await at(ceiling, label(valueAt(ceiling)));
    if (boundEvaluation.status === 'invalid') {
      // The model stops supporting this input somewhere below the bound — a pension annual
      // allowance tapered away by a large salary is the usual reason. Find the largest supported
      // value instead of abandoning the search, and say so rather than reporting a bound that was
      // never usable. The free probe narrows first; the full model then has the final word.
      const reason = boundEvaluation.message ?? 'not a supported plan';
      let valid = 0;
      let invalid = ceiling;
      while (invalid - valid > mode.precision) {
        const middle = quantise((valid + invalid) / 2);
        if (middle <= valid || middle >= invalid) break;
        if (supported(middle).ok) valid = middle; else invalid = middle;
      }
      ceiling = valid;
      boundEvaluation = ceiling > 0 ? await at(ceiling, label(valueAt(ceiling))) : boundEvaluation;
      while (ceiling > 0 && boundEvaluation.status === 'invalid' && completed < resolved.maxEvaluations) {
        // The probe was optimistic: a path it did not sample is unsupported. Narrow by complete
        // simulation, which also yields usable probabilities for the values it clears.
        invalid = ceiling;
        valid = 0;
        while (invalid - valid > mode.precision && completed < resolved.maxEvaluations) {
          const middle = quantise((valid + invalid) / 2);
          if (middle <= valid || middle >= invalid) break;
          const evaluation = await at(middle, `${mode.label}: checking whether ${formatRaw(valueAt(middle), mode.unit)} is supported`);
          if (evaluation.status === 'invalid') invalid = middle; else valid = middle;
        }
        if (valid >= ceiling) break;
        ceiling = valid;
        boundEvaluation = ceiling > 0 ? await at(ceiling, label(valueAt(ceiling))) : boundEvaluation;
      }
      notes.push(`Values above ${formatRaw(valueAt(ceiling), mode.unit)} are outside the supported model (${reason}), so the search bound was reduced to the largest supported value. This is a modelling boundary, not a plan failure.`);
      high = ceiling;
      if (ceiling <= 0 || boundEvaluation.status === 'invalid')
        return complete('infeasible', null, 'No supported change to this input could be searched, so no requirement can be reported.');
    }
    if (!boundEvaluation.meetsTarget)
      return complete('infeasible', null, 'Nothing inside the search bound reached the target. Widen the bound or move another input.');
  } else {
    // Success is not assumed to move consistently with this input, so scan an ordered coarse grid
    // and take the FIRST qualifying point. A bound that fails does not end the search: for a
    // non-monotone input a middle value can qualify where both ends do not.
    const points = mode.scanPoints > 0
      ? Array.from({ length: mode.scanPoints }, (_, i) => (maxStep * (i + 1)) / (mode.scanPoints + 1))
      : Array.from({ length: Math.max(0, Math.round(maxStep / mode.precision)) }, (_, i) => (i + 1) * mode.precision);
    const grid = [...points, maxStep];
    let qualified = false;
    for (const point of grid) {
      if (completed >= resolved.maxEvaluations) { notes.push('The evaluation budget ran out during the scan, so higher values were never tested.'); break; }
      const evaluation = await at(point, label(valueAt(point)));
      if (evaluation.meetsTarget) { high = evaluation.step; qualified = true; break; }
      if (evaluation.status === 'evaluated') low = evaluation.step;
    }
    if (!qualified)
      return complete('infeasible', null, 'No tested value reached the target. The evaluation trace below shows the whole scanned range, including values that scored worse than the entered plan.');
    low = Math.min(low, high);
    if (high - low > mode.precision)
      notes.push(`A coarse grid was scanned because success is not assumed to move consistently with this input, so a finer grid could find a qualifying value between ${formatRaw(valueAt(low), mode.unit)} and ${formatRaw(valueAt(high), mode.unit)}.`);
  }

  while (high - low > mode.precision && completed < resolved.maxEvaluations) {
    const middle = (low + high) / 2;
    const evaluation = await at(middle, label(valueAt(middle)));
    if (evaluation.step <= low || evaluation.step >= high) break; // quantisation reached its floor
    if (evaluation.meetsTarget) high = evaluation.step; else low = evaluation.step;
  }
  if (high - low > mode.precision)
    notes.push(`The search stopped at its evaluation budget; the answer is the smallest qualifying value tested, and the requirement is somewhere above ${formatRaw(valueAt(low), mode.unit)}.`);

  const qualifying = evaluations.filter(e => e.status === 'evaluated' && e.meetsTarget).sort((a, b) => a.step - b.step)[0]!;
  return complete('solved', qualifying);
}

function safeSurplus(profile: Profile, options: LedgerOptions): number | null {
  try { return firstYearSurplusReal(profile, options); } catch { return null; }
}

const message = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Engine-side label only; the presentation layer owns real formatting. */
function formatRaw(value: number, unit: SolverUnit): string {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'rate') return `${(value * 100).toFixed(2)}%`;
  if (unit === 'age') return `age ${Math.round(value)}`;
  if (unit === 'monthlyMoney') return `£${Math.round(value).toLocaleString('en-GB')}/month`;
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

export interface SensitivityCase { id: string; label: string; description: string; profile: Profile }

/**
 * Spec section 33's worked sensitivities, computed by re-solving — never by scaling an answer.
 * Each case is a complete alternative plan, solved with the same seed, paths and bound.
 */
export function sensitivityCases(profile: Profile, monthlySpendingStep = 150): SensitivityCase[] {
  const cases: SensitivityCase[] = [];
  const later = structuredClone(profile) as Profile;
  if (later.personal.targetFireAge + 2 < later.personal.endAge) {
    later.personal.targetFireAge += 2;
    cases.push({ id: 'fire_age_plus_2', label: `FIRE age +2 (${later.personal.targetFireAge})`,
      description: 'The same search with the target FIRE age two years later.', profile: parseProfile(later) });
  }
  const leaner = structuredClone(profile) as Profile;
  const retirement = leaner.spending.retirement;
  const cut = Math.min(monthlySpendingStep, retirement.essentialMonthly + retirement.discretionaryMonthly);
  if (cut > 0) {
    const fromDiscretionary = Math.min(retirement.discretionaryMonthly, cut);
    retirement.discretionaryMonthly = round12(retirement.discretionaryMonthly - fromDiscretionary);
    retirement.essentialMonthly = round12(retirement.essentialMonthly - (cut - fromDiscretionary));
    const total = 12 * (retirement.essentialMonthly + retirement.discretionaryMonthly);
    leaner.spending.retirementFloorAnnual = Math.min(leaner.spending.retirementFloorAnnual, total);
    leaner.spending.retirementComfortAnnual = Math.max(leaner.spending.retirementComfortAnnual, total);
    cases.push({ id: 'spending_down', label: `Retirement spending −£${cut}/month`,
      description: 'The same search with a permanently smaller retirement budget.', profile: parseProfile(leaner) });
  }
  const weaker = structuredClone(profile) as Profile;
  if (weaker.market.equities.meanNominal - 0.01 > -1) {
    weaker.market.equities.meanNominal = round12(weaker.market.equities.meanNominal - 0.01);
    weaker.market.assumptionVersion = `${weaker.market.assumptionVersion}+equity-1pp`;
    cases.push({ id: 'returns_down', label: 'Expected equity return −1pp',
      description: 'The same search against a weaker market assumption. These paths are drawn from a different distribution, so this row is a separate model, not a comparison on common paths.',
      profile: parseProfile(weaker) });
  }
  return cases;
}

export interface SolverRun {
  primary: SolverResult;
  sensitivities: { id: string; label: string; description: string; result: SolverResult }[];
}

/** One screen-level run: the primary search, then each section 33 sensitivity re-solved in full. */
export async function runSolver(
  profile: Profile, request: SolverRequest,
  controls: SolverControls & { includeSensitivity?: boolean } = {},
): Promise<SolverRun> {
  const primary = await solveTarget(profile, request, controls);
  const sensitivities: SolverRun['sensitivities'] = [];
  if (controls.includeSensitivity && primary.status !== 'unsupported') {
    for (const item of sensitivityCases(parseProfile(profile))) {
      abortIfNeeded(controls.signal);
      const result = await solveTarget(item.profile, request, controls);
      sensitivities.push({ id: item.id, label: item.label, description: item.description, result });
    }
  }
  return { primary, sensitivities };
}
