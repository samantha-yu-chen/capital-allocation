import { z } from 'zod';
import { parseProfile, simulationMetadataSchema } from '../../domain/contracts.js';
import type { FailureCode, MarketPath, Profile, ReturnGenerator, SimulationResult } from '../../domain/contracts.js';
import { accessibleWealth, financialNetWorth, netWorth, propertyEquity } from '../accounts.js';
import { defaultLedgerOptions, runProjection } from '../ledger.js';
import type { DeterministicProjection, LedgerOptions, ProjectionAssumptions } from '../ledger.js';
import { ParametricReturnGenerator } from './generator.js';
import { distribution } from './statistics.js';
import type { Distribution } from './statistics.js';

export const SIMULATION_VERSION = 'monte-carlo-v1';
export const ledgerOptionsSchema = z.strictObject({
  retirementLevel: z.enum(['floor', 'target', 'comfort']), monthlyHouseholdOverride: z.number().finite().nonnegative().nullable(),
  rentInvestment: z.strictObject({age:z.number().int().min(18).max(120),amount:z.number().finite().nonnegative()}).nullable(),
  fundEmergencyReserve: z.boolean(), surplusAllocation: z.enum(['isa_then_gia', 'gia_only', 'cash_only']),
  solverTolerance: z.number().finite().positive(), solverMaxIterations: z.number().int().positive(),
});
export const monteCarloMetadataSchema = simulationMetadataSchema.extend({
  simulationVersion: z.literal('monte-carlo-v1'), ledgerOptions: ledgerOptionsSchema,
  taxPolicy: z.literal('constant_real'), eventOrder: z.array(z.string()),
  pathIndices: z.strictObject({ start: z.number().int().nonnegative(), endExclusive: z.number().int().positive() }),
  moneyBasis: z.literal('today'), ageTiming: z.literal('opening-current-then-closing-boundaries'),
  percentileMethod: z.literal('linear-(n-1)p'),
});
const FAILURE_CODES: FailureCode[] = ['unfunded_essential_spending', 'pre_pension_liquidity', 'portfolio_depletion', 'insolvency', 'mortgage_shortfall'];
export interface SequenceObservation {
  drawdownOver20: boolean; belowTwoYearsSpending: boolean;
  /** Years from first >20% peak drawdown to first recovery of that real peak; null means censored/not triggered. */
  recoveryYears: number | null;
  earlyEquityCrash: boolean; highEarlyInflation: boolean;
}
export interface PathSample {
  pathIndex: number; success: boolean; failures: FailureCode[];
  /** Opening current age, then closing age+1; liquid, pension (including SIPP), property equity, net worth, locked. */
  wealth: number[][]; terminal: number; fireCapital: number;
  sequence: SequenceObservation;
}
export interface SimulationRequest { profile: Profile; ledgerOptions: LedgerOptions; start: number; count: number }
export interface SimulationBatch { samples: PathSample[]; assumptions: ProjectionAssumptions; generatorVersion: string }
export interface SimulationProgress { completed: number; total: number }
export interface SimulationControls {
  batchSize?: number; concurrency?: number; signal?: AbortSignal;
  onProgress?: (progress: SimulationProgress) => void;
  ledgerOptions?: Partial<LedgerOptions>; generator?: ReturnGenerator;
  /** Executor owns transport; default stays local and yields between batches. */
  executeBatch?: (request: SimulationRequest, signal?: AbortSignal) => Promise<SimulationBatch>;
}
export interface MonteCarloResult extends SimulationResult {
  metadata: SimulationResult['metadata'] & {
    simulationVersion: string; ledgerOptions: LedgerOptions; taxPolicy: Profile['simulation']['taxPolicy'];
    eventOrder: readonly string[]; pathIndices: { start: number; endExclusive: number };
    moneyBasis: 'today'; ageTiming: 'opening-current-then-closing-boundaries';
    percentileMethod: 'linear-(n-1)p';
  };
  fireCapital: Distribution;
  wealthByAge: (SimulationResult['wealthByAge'][number] & { locked: Distribution })[];
  observedFailureProbabilities: Record<FailureCode, number>;
  sequenceRisk: {
    evaluatedYears: number; drawdownOver20Probability: number; belowTwoYearsSpendingProbability: number;
    medianRecoveryYears: number | null; recoveredPaths: number; unrecoveredPaths: number;
  };
  diagnostics: { interpretation: string; earlyEquityCrash: Diagnostic; highEarlyInflation: Diagnostic };
}
interface Diagnostic { paths: number; probability: number; failureProbabilityWhenPresent: number | null; failureProbabilityWhenAbsent: number | null }
export function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Simulation cancelled', 'AbortError');
}

/** Path-level diagnostics are associations, never causal attribution. */
export function sequenceObservation(profile: Profile, projection: DeterministicProjection, path: MarketPath): SequenceObservation {
  const first = profile.personal.targetFireAge - profile.personal.currentAge;
  const window = projection.years.slice(first, first + 5);
  let peak = financialNetWorth(window[0]!.opening) / window[0]!.inflationIndex;
  let trigger: { index: number; peak: number } | null = null;
  let below = false;
  window.forEach((year, i) => {
    const openingLiquid = accessibleWealth(year.opening) / year.inflationIndex;
    const closingLiquid = year.accessibleWealth / year.closingInflationIndex;
    const spending = (year.spendingRequired + year.propertyOperatingCosts + year.mortgageInterest + year.mortgagePrincipalRequired) / year.inflationIndex;
    below ||= Math.min(openingLiquid, closingLiquid) < 2 * spending;
    const wealth = financialNetWorth(year.closing) / year.closingInflationIndex;
    if (peak > 0 && wealth < .8 * peak && trigger === null) trigger = { index: first + i, peak };
    peak = Math.max(peak, wealth);
  });
  let recoveryYears: number | null = null;
  // Follow a first-five-year trigger until terminal age, retaining censored paths separately.
  if (trigger !== null) {
    const event = trigger as { index: number; peak: number };
    for (let i = event.index + 1; i < projection.years.length; i++) {
      const year = projection.years[i]!;
      if (financialNetWorth(year.closing) / year.closingInflationIndex >= event.peak) {
        recoveryYears = i - event.index; break;
      }
    }
  }
  const markets = path.years.slice(first, first + window.length);
  const inflation = Math.expm1(markets.reduce((sum, y) => sum + Math.log1p(y.inflation), 0) / markets.length);
  return { drawdownOver20: trigger !== null, belowTwoYearsSpending: below, recoveryYears,
    earlyEquityCrash: markets.some(y => y.equities < -.2), highEarlyInflation: inflation > .05 };
}

export function sampleProjection(profile: Profile, path: MarketPath, result: DeterministicProjection): PathSample {
  const opening = result.years[0]!.opening;
  const wealth = [[accessibleWealth(opening), opening.accounts.pension + opening.accounts.sipp,
    propertyEquity(opening), netWorth(opening), opening.accounts.pension + opening.accounts.sipp]];
  for (const year of result.years) {
    const d = year.closingInflationIndex;
    wealth.push([year.accessibleWealth / d, (year.closing.accounts.pension + year.closing.accounts.sipp) / d,
      propertyEquity(year.closing) / d, year.netWorth / d, year.lockedWealth / d]);
  }
  if (wealth.some(row => row.some(value => !Number.isFinite(value)))) throw new RangeError('Nonfinite projection output');
  return { pathIndex: path.pathIndex, success: result.success, failures: [...new Set(result.failures.map(f => f.code))],
    wealth, terminal: result.metrics.terminalNetWorthReal, fireCapital: result.metrics.investableAssetsAtFireReal,
    sequence: sequenceObservation(profile, result, path) };
}

export function simulateBatch(request: SimulationRequest, generator: ReturnGenerator = new ParametricReturnGenerator()): SimulationBatch {
  const { profile, ledgerOptions, start, count } = request;
  if (!Number.isInteger(start) || start < 0 || !Number.isInteger(count) || count < 1 || start + count > profile.simulation.count)
    throw new RangeError('Invalid batch range');
  const samples: PathSample[] = [];
  let assumptions: ProjectionAssumptions | undefined;
  for (let pathIndex = start; pathIndex < start + count; pathIndex++) {
    const path = generator.generatePath({ years: profile.personal.endAge - profile.personal.currentAge,
      seed: profile.simulation.seed, pathIndex, assumptions: profile.market });
    if (path.pathIndex !== pathIndex || path.years.length !== profile.personal.endAge - profile.personal.currentAge ||
        path.years.some((y, i) => y.yearIndex !== i || [y.equities, y.bonds, y.cash, y.property, y.inflation].some(v => !Number.isFinite(v) || v <= -1)))
      throw new RangeError('Generator returned an invalid market path');
    const result = runProjection(profile, path, ledgerOptions);
    assumptions = result.assumptions;
    samples.push(sampleProjection(profile, path, result));
  }
  return { samples, assumptions: assumptions!, generatorVersion: generator.version };
}

function aggregate(profile: Profile, samples: PathSample[], batch: SimulationBatch): MonteCarloResult {
  const n = samples.length;
  const probability = (predicate: (s: PathSample) => boolean) => samples.filter(predicate).length / n;
  const failures = Object.fromEntries(FAILURE_CODES.map(code => [code, probability(s => s.failures.includes(code))])) as Record<FailureCode, number>;
  const diagnostic = (key: 'earlyEquityCrash' | 'highEarlyInflation'): Diagnostic => {
    const present = samples.filter(s => s.sequence[key]);
    const absent = samples.filter(s => !s.sequence[key]);
    return { paths: present.length, probability: present.length / n,
      failureProbabilityWhenPresent: present.length ? present.filter(s => !s.success).length / present.length : null,
      failureProbabilityWhenAbsent: absent.length ? absent.filter(s => !s.success).length / absent.length : null };
  };
  const recoveries = samples.flatMap(s => s.sequence.recoveryYears === null ? [] : [s.sequence.recoveryYears]);
  const a = batch.assumptions;
  return {
    metadata: { ...simulationMetadataSchema.parse({ schemaVersion: '1', seed: profile.simulation.seed, simulationCount: n,
      engineVersion: a.engineVersion, assumptionVersion: a.marketAssumptionVersion, taxConfigVersion: a.taxConfigVersion,
      returnGeneratorVersion: batch.generatorVersion, profile }), simulationVersion: SIMULATION_VERSION,
      ledgerOptions: a.options, taxPolicy: a.taxPolicy, eventOrder: a.eventOrder,
      pathIndices: { start: 0, endExclusive: n }, moneyBasis: 'today', ageTiming: 'opening-current-then-closing-boundaries', percentileMethod: 'linear-(n-1)p' },
    successProbability: probability(s => s.success), bridgeFailureProbability: failures.pre_pension_liquidity,
    depletionProbability: failures.portfolio_depletion, observedFailureProbabilities: failures,
    terminalWealth: distribution(samples.map(s => s.terminal)), fireCapital: distribution(samples.map(s => s.fireCapital)),
    wealthByAge: samples[0]!.wealth.map((_, i) => {
      const at = (category: number) => distribution(samples.map(s => s.wealth[i]![category]!));
      return { age: profile.personal.currentAge + i, liquid: at(0), pension: at(1), propertyEquity: at(2), netWorth: at(3), locked: at(4) };
    }),
    sequenceRisk: { evaluatedYears: Math.min(5, profile.personal.endAge - profile.personal.targetFireAge),
      drawdownOver20Probability: probability(s => s.sequence.drawdownOver20),
      belowTwoYearsSpendingProbability: probability(s => s.sequence.belowTwoYearsSpending),
      medianRecoveryYears: recoveries.length ? distribution(recoveries).median : null,
      recoveredPaths: recoveries.length, unrecoveredPaths: samples.filter(s => s.sequence.drawdownOver20 && s.sequence.recoveryYears === null).length },
    diagnostics: { interpretation: 'Associations only; overlapping factors are not proven causes. Crash: any equity return below -20% in first five FIRE years. High inflation: geometric annual inflation above 5% over that window.',
      earlyEquityCrash: diagnostic('earlyEquityCrash'), highEarlyInflation: diagnostic('highEarlyInflation') },
  };
}

/** Full-count results only. Cancellation/errors reject; partial runs never masquerade as completed simulations. */
export async function runMonteCarlo(input: Profile, controls: SimulationControls = {}): Promise<MonteCarloResult> {
  const profile = parseProfile(input); // validated deep snapshot, immune to caller edits while running
  const ledgerOptions = ledgerOptionsSchema.parse({ ...defaultLedgerOptions(), ...controls.ledgerOptions });
  const batchSize = controls.batchSize ?? 100, concurrency = controls.concurrency ?? 1;
  if (!Number.isInteger(batchSize) || batchSize < 1 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64)
    throw new RangeError('Invalid batch size or concurrency (1–64)');
  if (controls.executeBatch && controls.generator) throw new Error('Custom generators belong inside the batch executor');
  const total = profile.simulation.count, samples = new Array<PathSample>(total);
  let next = 0, completed = 0, reference: SimulationBatch | undefined;
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  controls.signal?.addEventListener('abort', forwardAbort, { once: true });
  const signal = controller.signal;
  const execute = controls.executeBatch ?? (async (request: SimulationRequest) => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    abortIfNeeded(signal);
    return simulateBatch(request, controls.generator);
  });
  try {
    abortIfNeeded(controls.signal);
    controls.onProgress?.({ completed: 0, total });
    const runners = Array.from({ length: Math.min(concurrency, Math.ceil(total / batchSize)) }, async () => {
      while (next < total) {
        abortIfNeeded(signal);
        const start = next, count = Math.min(batchSize, total - start); next += count;
        const batch = await execute({ profile, ledgerOptions, start, count }, signal);
        abortIfNeeded(signal);
        if (batch.samples.length !== count || batch.samples.some((s, i) => s.pathIndex !== start + i)) throw new Error('Executor returned mismatched paths');
        if (reference && (reference.generatorVersion !== batch.generatorVersion ||
          JSON.stringify({ ...reference.assumptions, pathIndex: 0 }) !== JSON.stringify({ ...batch.assumptions, pathIndex: 0 })))
          throw new Error('Executor assumptions changed between batches');
        reference ??= batch;
        batch.samples.forEach(s => { samples[s.pathIndex] = s; });
        completed += count;
        controls.onProgress?.({ completed, total });
      }
    });
    await Promise.all(runners.map(p => p.catch(error => { controller.abort(); throw error; })));
    abortIfNeeded(signal);
    return aggregate(profile, samples, reference!);
  } finally {
    controller.abort();
    controls.signal?.removeEventListener('abort', forwardAbort);
  }
}
