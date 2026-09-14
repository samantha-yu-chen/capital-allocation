import { z } from 'zod';
import { parseProfile, type Profile } from '../domain/contracts.js';
import { getTaxConfig, PensionLimitError } from '../domain/tax/index.js';
import { defaultLedgerOptions, runDeterministicProjection, type LedgerOptions } from './ledger.js';
import { marginalActionSchema, MarginalInfeasibleError, type MarginalDestination } from './marginal-funding.js';
import { allocationAges } from './allocation-metrics.js';
import { abortIfNeeded, ledgerOptionsSchema, runMonteCarlo, type MonteCarloResult } from './monte-carlo/simulation.js';
import { distribution } from './monte-carlo/statistics.js';
import type { EvaluateProfile, SolverProgress } from './solver.js';

export const DESTINATIONS: readonly MarginalDestination[] = ['pension', 'isa', 'gia', 'cash', 'mortgage', 'deposit'];
export const marginalRequestSchema = marginalActionSchema.omit({ destination: true }).extend({ maximumDebt: z.number().finite().nonnegative() });
export type MarginalRequest = z.infer<typeof marginalRequestSchema> & { ledgerOptions?: Partial<LedgerOptions> };
export type MarginalProgress = SolverProgress;
type Samples = NonNullable<MonteCarloResult['allocationSamples']>;
export function standardError(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a,b) => a+b, 0) / values.length;
  return Math.sqrt(values.reduce((sum,x) => sum + (x-mean)**2, 0) / (values.length-1) / values.length);
}
export function assertMarginalPaths(base: MonteCarloResult, candidate: MonteCarloResult): void {
  const a = base.metadata, b = candidate.metadata;
  if (a.seed !== b.seed || a.simulationCount !== b.simulationCount || a.returnGeneratorVersion !== b.returnGeneratorVersion ||
      JSON.stringify(a.pathIndices) !== JSON.stringify(b.pathIndices) ||
      JSON.stringify(a.profile.market) !== JSON.stringify(b.profile.market) ||
      base.allocationSamples?.length !== candidate.allocationSamples?.length ||
      candidate.allocationSamples?.some((s,i) => s.pathIndex !== base.allocationSamples![i]!.pathIndex))
    throw new Error('Marginal candidates must share the seed, market assumptions and absolute path indices.');
}
function summarize(result: MonteCarloResult, ages: number[]) {
  const samples = result.allocationSamples!;
  if (samples?.length !== result.metadata.simulationCount) throw new Error('Allocation audit samples missing');
  const at = (fn: (s: Samples[number]) => number) => distribution(samples.map(fn));
  return { probability: result.successProbability,
    standardError: Math.sqrt(result.successProbability * (1-result.successProbability) / samples.length),
    score: at(s => s.score), terminal: result.terminalWealth,
    lifetimeTax: at(s => s.tax), maxDebt: at(s => s.maxDebt),
    minimumReserve: at(s => s.minimumReserve), minimumLiquidity: at(s => s.minimumLiquidity),
    targets: ages.map((age,i) => ({ age, debt: at(s => s.debt[i]!), usable: at(s => s.usable[i]!), accessible: at(s => s.accessible[i]!), netWorth: at(s => s.netWorth[i]!) })),
  };
}
export type MarginalSummary = ReturnType<typeof summarize>;
export interface MarginalCandidate {
  destination: MarginalDestination; status: 'evaluated' | 'infeasible'; reason: string | null;
  summary: MarginalSummary | null; funding: ReturnType<typeof runDeterministicProjection>['years'][number]['marginalFunding'];
  constraints: string[]; rank: number | null;
  classification: 'Dominant' | 'Near equivalent' | 'Assumption sensitive' | 'Inferior' | 'Infeasible';
  delta: { probability: number; probabilitySE: number; score: number; scoreSE: number; terminal: number; downside: number; tax: number; debt: number } | null;
}
export interface MarginalResult {
  baseline: MarginalSummary; candidates: MarginalCandidate[]; ages: number[];
  boundaries: ReturnType<typeof taxBoundaries>;
  metadata: { seed: number; pathIndices: { start: number; endExclusive: number }; simulationCount: number;
    request: MarginalRequest; options: LedgerOptions; engineVersion: string; moneyBasis: 'today' };
}
/** Taxable-income bands and adjusted-net-income taper boundaries retain their actual bases.
 * They are deliberately not mislabelled as gross salary thresholds.
 */
export function taxBoundaries(profile: Profile) {
  const c = getTaxConfig(profile.personal.taxRegion, profile.personal.taxYear);
  return [
    ...c.nonSavingsBands.flatMap(b => b.upper === null ? [] : [{ label: `${b.name} band ceiling`, basis: 'Taxable non-savings income', amount: b.upper }]),
    { label: 'Personal allowance taper starts', basis: 'Adjusted net income', amount: c.taperThreshold },
    { label: 'Personal allowance fully tapered', basis: 'Adjusted net income', amount: c.taperThreshold + c.personalAllowance / c.taperReductionRate },
    { label: 'NI primary threshold', basis: 'Employment after sacrifice', amount: c.ni.primaryThreshold },
    { label: 'NI upper earnings limit', basis: 'Employment after sacrifice', amount: c.ni.upperEarningsLimit },
    { label: 'Pension taper threshold test', basis: 'Threshold income', amount: c.pension.thresholdIncomeLimit },
    { label: 'Pension taper adjusted test', basis: 'Adjusted income', amount: c.pension.adjustedIncomeLimit },
  ];
}
export async function compareMarginal(input: Profile, request: MarginalRequest, controls: {
  evaluate?: EvaluateProfile; signal?: AbortSignal; onProgress?: (progress: MarginalProgress) => void;
} = {}): Promise<MarginalResult> {
  const profile = parseProfile(input);
  const { ledgerOptions, ...raw } = request;
  const parsed = marginalRequestSchema.parse(raw);
  const options = ledgerOptionsSchema.parse({ ...defaultLedgerOptions(), ...ledgerOptions, measureAllocation: true });
  if (options.rentInvestment || options.marginalAction) throw new RangeError('Marginal comparison requires rentInvestment and incoming marginalAction null.');
  const ages = allocationAges(profile), evaluate = controls.evaluate ?? runMonteCarlo;
  let completed = 0;
  const run = async (destination: MarginalDestination | null) => {
    abortIfNeeded(controls.signal);
    const candidateOptions: LedgerOptions = { ...options, marginalAction: destination ? { amount: parsed.amount, basis: parsed.basis, destination } : null };
    // Gives immediate eligibility reasons; every supported candidate still runs every full path.
    const projection = runDeterministicProjection(profile, candidateOptions);
    const result = await evaluate(profile, { ledgerOptions: candidateOptions,
      ...(controls.signal ? { signal: controls.signal } : {}),
      onProgress: paths => controls.onProgress?.({ stage: destination ?? 'baseline', evaluationsCompleted: completed, evaluationsPlanned: 7, paths }),
    });
    abortIfNeeded(controls.signal);
    completed++;
    return { result, funding: projection.years[0]!.marginalFunding };
  };
  const { result: baselineResult } = await run(null);
  const baseline = summarize(baselineResult, ages);
  const candidates: MarginalCandidate[] = [];
  const sampled = new Map<MarginalDestination, Samples>();
  for (const destination of DESTINATIONS) {
    abortIfNeeded(controls.signal);
    try {
      const { result, funding } = await run(destination);
      assertMarginalPaths(baselineResult, result);
      const summary = summarize(result, ages), samples = result.allocationSamples!;
      sampled.set(destination, samples);
      const differences = samples.map((s,i) => s.score - baselineResult.allocationSamples![i]!.score);
      const probabilities = samples.map((s,i) => Number(s.success) - Number(baselineResult.allocationSamples![i]!.success));
      const constraints: string[] = [];
      if (summary.probability - 1.96 * summary.standardError < profile.personal.targetSuccessProbability)
        constraints.push('FIRE target not cleared by the 95% sampling lower bound.');
      if (summary.minimumLiquidity.worst < profile.liquidity.minimumLiquidYears)
        constraints.push('Minimum liquid-years threshold breached on at least one sampled path.');
      if (summary.minimumReserve.worst < -1e-6) constraints.push('Emergency cash reserve breached on at least one sampled path.');
      if (summary.maxDebt.worst > parsed.maximumDebt + 1e-6) constraints.push('Maximum acceptable real debt exceeded on at least one sampled path.');
      candidates.push({ destination, status: 'evaluated', reason: null, summary, funding, constraints, rank: null,
        classification: 'Assumption sensitive', delta: { probability: summary.probability - baseline.probability,
          probabilitySE: standardError(probabilities), score: summary.score.mean - baseline.score.mean, scoreSE: standardError(differences),
          terminal: summary.terminal.median - baseline.terminal.median, downside: summary.terminal.p10 - baseline.terminal.p10,
          tax: summary.lifetimeTax.mean - baseline.lifetimeTax.mean, debt: summary.maxDebt.mean - baseline.maxDebt.mean } });
    } catch (error) {
      abortIfNeeded(controls.signal);
      if (!(error instanceof MarginalInfeasibleError) && !(error instanceof PensionLimitError) && !(error instanceof z.ZodError)) throw error;
      candidates.push({ destination, status: 'infeasible', reason: error.message, summary: null, funding: null,
        constraints: [], rank: null, classification: 'Infeasible', delta: null });
    }
  }
  const feasible = candidates.filter(c => c.summary && c.constraints.length === 0).sort((a,b) => b.summary!.score.mean-a.summary!.score.mean);
  // Rank only constrained candidates. Differences within paired sampling uncertainty share a rank.
  let rank = 0;
  for (const [i,c] of feasible.entries()) {
    const previous = feasible[i-1];
    const gapSE = previous ? standardError(sampled.get(c.destination)!.map((s,j) => s.score-sampled.get(previous.destination)![j]!.score)) : 0;
    if (!previous || previous.summary!.score.mean-c.summary!.score.mean > 1.96*gapSE) rank = i+1;
    c.rank = rank;
  }
  const evaluated = candidates.filter(c => c.summary);
  for (const c of evaluated) {
    let near = false, dominates = 0;
    for (const other of evaluated.filter(o => o !== c)) {
      const a = c.summary!, b = other.summary!;
      const se = standardError(sampled.get(c.destination)!.map((s,i) => s.score - sampled.get(other.destination)![i]!.score));
      const probabilityError = Math.max(a.standardError, b.standardError,
        standardError(sampled.get(c.destination)!.map((s,i) => Number(s.success)-Number(sampled.get(other.destination)![i]!.success))));
      near ||= Math.abs(a.score.mean-b.score.mean) <= 1.96*se + 1e-6 && Math.abs(a.probability-b.probability) <= 1.96*probabilityError;
      const better = b.score.mean-a.score.mean > 1.96*se && b.probability-a.probability > 1.96*probabilityError &&
        b.terminal.p10 >= a.terminal.p10 && b.targets.every((t,i) => t.accessible.median >= a.targets[i]!.accessible.median) && b.maxDebt.mean <= a.maxDebt.mean;
      if (better && other.constraints.length === 0) { c.classification = 'Inferior'; break; }
      const wins = a.score.mean-b.score.mean > 1.96*se && a.probability-b.probability > 1.96*probabilityError &&
        a.terminal.p10 >= b.terminal.p10 && a.targets.every((t,i) => t.accessible.median >= b.targets[i]!.accessible.median) && a.maxDebt.mean <= b.maxDebt.mean;
      if (wins) dominates++;
    }
    if (c.classification !== 'Inferior') c.classification = dominates === evaluated.length-1 && c.constraints.length === 0 ? 'Dominant' : near ? 'Near equivalent' : 'Assumption sensitive';
  }
  abortIfNeeded(controls.signal);
  return { baseline, candidates, ages, boundaries: taxBoundaries(profile), metadata: {
    seed: profile.simulation.seed, pathIndices: baselineResult.metadata.pathIndices, simulationCount: profile.simulation.count,
    request, options, engineVersion: baselineResult.metadata.engineVersion, moneyBasis: 'today',
  } };
}
