/**
 * FIRE probability curve (spec section 17).
 *
 * Every candidate FIRE age is run through the complete lifetime model on the SAME seed and path
 * indices, so the curve's shape is the plan changing, never the draw changing. Moving the FIRE age
 * changes which years use the working budget, when salary and pension contributions stop, how long
 * the pre-pension bridge runs and how many retirement years must be funded — all of which the
 * ledger already handles. Nothing is interpolated: an age that is not evaluated has no probability,
 * and an age the schema rejects is recorded as invalid rather than skipped silently.
 */
import { parseProfile, type Profile } from '../domain/contracts.js';
import { defaultLedgerOptions, type LedgerOptions } from './ledger.js';
import { abortIfNeeded, ledgerOptionsSchema, runMonteCarlo } from './monte-carlo/simulation.js';
import type { SimulationProgress } from './monte-carlo/simulation.js';
import { referenceFireNumber } from './fire-metrics.js';
import { retirementAnnualReal } from './spending.js';
import type { EvaluateProfile } from './solver.js';

export const FIRE_CURVE_VERSION = 'fire-age-curve-v1';

export interface FireAgeCurveRequest {
  /** Defaults to the current age. */
  fromAge?: number;
  /** Defaults to 20 years after `fromAge`, capped at `endAge - 1`. */
  toAge?: number;
  targetProbability?: number;
  ledgerOptions?: Partial<LedgerOptions>;
}

export interface FireAgeCurveProgress {
  agesCompleted: number;
  agesTotal: number;
  age: number;
  paths: SimulationProgress;
}

export interface FireAgeCurveControls {
  signal?: AbortSignal;
  onProgress?: (progress: FireAgeCurveProgress) => void;
  evaluate?: EvaluateProfile;
}

export interface FireAgePoint {
  age: number;
  status: 'evaluated' | 'invalid';
  message: string | null;
  probability: number | null;
  meetsTarget: boolean;
  /** sqrt(p(1-p)/n): sampling uncertainty at this age, not a bound. */
  standardError: number | null;
  bridgeFailureProbability: number | null;
  depletionProbability: number | null;
  medianTerminalWealthReal: number | null;
  medianFireCapitalReal: number | null;
  medianLiquidAtFireReal: number | null;
  bridgeYears: number;
}

export interface FireAgeCurveResult {
  points: FireAgePoint[];
  targetProbability: number;
  /** The lowest evaluated age clearing the target, or null when none did. */
  earliestQualifyingAge: number | null;
  targetFireAge: number;
  probabilityAtTargetAge: number | null;
  /** False when a later FIRE age scored worse than an earlier one somewhere on the curve. */
  monotone: boolean;
  retirementSpendingAnnualReal: number;
  referenceFireNumber: number;
  metadata: {
    curveVersion: string; engineVersion: string; generatorVersion: string;
    seed: number; simulationCount: number; pathIndices: { start: number; endExclusive: number };
    ledgerOptions: LedgerOptions; moneyBasis: 'today';
  };
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Full-count evaluation of every candidate FIRE age. Cancellation rejects; no partial curve is returned. */
export async function fireAgeCurve(
  input: Profile, request: FireAgeCurveRequest = {}, controls: FireAgeCurveControls = {},
): Promise<FireAgeCurveResult> {
  const profile = parseProfile(input);
  const options = ledgerOptionsSchema.parse({ ...defaultLedgerOptions(), ...request.ledgerOptions }) as LedgerOptions;
  if (options.rentInvestment !== null)
    throw new RangeError('Curve candidates must leave rentInvestment null; it belongs to the property comparison');
  const target = request.targetProbability ?? profile.personal.targetSuccessProbability;
  if (!Number.isFinite(target) || target <= 0 || target > 1) throw new RangeError('targetProbability must be inside (0, 1]');

  const first = Math.max(profile.personal.currentAge, Math.round(request.fromAge ?? profile.personal.currentAge));
  const last = Math.min(profile.personal.endAge - 1, Math.round(request.toAge ?? first + 20));
  if (last < first) throw new RangeError('The age range is empty; require currentAge <= fromAge <= toAge < endAge');
  if (last - first > 60) throw new RangeError('The age range exceeds 61 candidate ages');
  const ages = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const evaluate = controls.evaluate ?? ((candidate, inner) => runMonteCarlo(candidate, {
    ledgerOptions: inner.ledgerOptions,
    ...(inner.signal ? { signal: inner.signal } : {}),
    ...(inner.onProgress ? { onProgress: inner.onProgress } : {}),
  }));

  const points: FireAgePoint[] = [];
  let engineVersion = '';
  let generatorVersion = '';
  let completed = 0;
  for (const age of ages) {
    abortIfNeeded(controls.signal);
    const bridgeYears = Math.max(0, profile.pension.accessAge - age);
    try {
      const candidate = parseProfile({ ...profile, personal: { ...profile.personal, targetFireAge: age } });
      const result = await evaluate(candidate, {
        ledgerOptions: options,
        ...(controls.signal ? { signal: controls.signal } : {}),
        ...(controls.onProgress ? {
          onProgress: (paths: SimulationProgress) =>
            controls.onProgress?.({ agesCompleted: completed, agesTotal: ages.length, age, paths }),
        } : {}),
      });
      engineVersion = result.metadata.engineVersion;
      generatorVersion = result.metadata.returnGeneratorVersion;
      const atFire = result.wealthByAge.find(entry => entry.age === age) ?? null;
      points.push({
        age, status: 'evaluated', message: null, probability: result.successProbability,
        meetsTarget: result.successProbability >= target,
        standardError: Math.sqrt(Math.max(0, result.successProbability * (1 - result.successProbability)) / result.metadata.simulationCount),
        bridgeFailureProbability: result.bridgeFailureProbability,
        depletionProbability: result.depletionProbability,
        medianTerminalWealthReal: result.terminalWealth.median,
        medianFireCapitalReal: result.fireCapital.median,
        medianLiquidAtFireReal: atFire ? atFire.liquid.median : null,
        bridgeYears,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      points.push({
        age, status: 'invalid', message: errorMessage(error), probability: null, meetsTarget: false,
        standardError: null, bridgeFailureProbability: null, depletionProbability: null,
        medianTerminalWealthReal: null, medianFireCapitalReal: null, medianLiquidAtFireReal: null, bridgeYears,
      });
    }
    completed += 1;
    controls.onProgress?.({ agesCompleted: completed, agesTotal: ages.length, age,
      paths: { completed: profile.simulation.count, total: profile.simulation.count } });
  }
  abortIfNeeded(controls.signal);

  let monotone = true;
  let previous: number | null = null;
  for (const point of points) {
    if (point.probability === null) continue;
    if (previous !== null && point.probability < previous - 1e-12) monotone = false;
    previous = point.probability;
  }
  const spending = retirementAnnualReal(profile, options);
  return {
    points, targetProbability: target,
    earliestQualifyingAge: points.find(point => point.meetsTarget)?.age ?? null,
    targetFireAge: profile.personal.targetFireAge,
    probabilityAtTargetAge: points.find(point => point.age === profile.personal.targetFireAge)?.probability ?? null,
    monotone, retirementSpendingAnnualReal: spending,
    referenceFireNumber: referenceFireNumber(spending, profile.simulation.referenceWithdrawalRate),
    metadata: {
      curveVersion: FIRE_CURVE_VERSION, engineVersion, generatorVersion,
      seed: profile.simulation.seed, simulationCount: profile.simulation.count,
      pathIndices: { start: 0, endExclusive: profile.simulation.count }, ledgerOptions: options, moneyBasis: 'today',
    },
  };
}
