/**
 * Monte Carlo display model.
 *
 * Every figure comes straight from `MonteCarloResult`; nothing is re-derived. The wording carried
 * alongside each number is part of the contract with chunk 3: observed failure codes overlap and
 * must not be summed, recovery is conditional on an observed recovery, the locked series mirrors a
 * ledger metric rather than a legal access claim, and the diagnostics are associations.
 */
import type { FailureCode, Percentiles } from '../../domain/contracts.js';
import type { Distribution, MonteCarloResult } from '../../engine/index.js';

export type WealthCategoryId = 'netWorth' | 'liquid' | 'pension' | 'locked' | 'propertyEquity';

export interface WealthCategory {
  id: WealthCategoryId;
  label: string;
  description: string;
}

export const WEALTH_CATEGORIES: readonly WealthCategory[] = [
  { id: 'netWorth', label: 'Net worth', description: 'Liquid plus pension plus property equity, in today’s money.' },
  { id: 'liquid', label: 'Liquid (cash + ISA + GIA)', description: 'The capital that can fund spending before pension access.' },
  { id: 'pension', label: 'Pension (workplace + SIPP)', description: 'Both pension balances together.' },
  { id: 'locked', label: 'Pension-category metric', description: 'Mirrors the ledger’s pension-category figure at every age. After the access age it no longer implies the pension is inaccessible.' },
  { id: 'propertyEquity', label: 'Property equity', description: 'Property value less mortgage debt. Excluded from liquid capital until an explicit sale.' },
];

export interface WealthPoint extends Percentiles {
  age: number;
}

/**
 * Age labelling follows chunk 3 exactly: the first entry is the opening balance at the current age,
 * and each later entry is the closing balance at that age boundary, deflated to today's money.
 */
export function wealthSeries(result: MonteCarloResult, category: WealthCategoryId): WealthPoint[] {
  return result.wealthByAge.map(entry => {
    const source: Percentiles = entry[category];
    return {
      age: entry.age,
      p10: source.p10, p25: source.p25, median: source.median, p75: source.p75, p90: source.p90,
    };
  });
}

/**
 * Spec section 16's presentation labels for a success probability.
 *
 * These are *labels for a band*, not thresholds the engine acts on: the user's own target
 * (`personal.targetSuccessProbability`) remains the only figure any solver, curve or constraint
 * compares against. The band exists so a bare percentage is not read without context, and it never
 * replaces the number or its sampling interval.
 */
export type ConfidenceBandId = 'fragile' | 'moderate' | 'strong' | 'high_confidence' | 'very_conservative';

export interface ConfidenceBand { id: ConfidenceBandId; label: string; from: number; to: number | null }

export const CONFIDENCE_BANDS: readonly ConfidenceBand[] = [
  { id: 'fragile', label: 'Fragile', from: 0, to: 0.7 },
  { id: 'moderate', label: 'Moderate', from: 0.7, to: 0.8 },
  { id: 'strong', label: 'Strong', from: 0.8, to: 0.9 },
  { id: 'high_confidence', label: 'High confidence', from: 0.9, to: 0.95 },
  { id: 'very_conservative', label: 'Very conservative', from: 0.95, to: null },
];

/** Half-open bands: a probability on a boundary belongs to the higher band, and 100% is the top one. */
export function confidenceBand(probability: number): ConfidenceBand {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1)
    throw new RangeError('A success probability must be a fraction between 0 and 1');
  return CONFIDENCE_BANDS.find(band => probability >= band.from && (band.to === null || probability < band.to))
    ?? CONFIDENCE_BANDS[CONFIDENCE_BANDS.length - 1]!;
}

export const FAILURE_LABELS: Record<FailureCode, string> = {
  pre_pension_liquidity: 'Pre-pension liquidity (bridge) failure',
  portfolio_depletion: 'Portfolio depletion',
  unfunded_essential_spending: 'Unfunded essential spending',
  insolvency: 'Insolvency',
  mortgage_shortfall: 'Mortgage shortfall',
};

export interface FailureRow {
  code: FailureCode;
  label: string;
  probability: number;
}

/**
 * Observed failure conditions, most frequent first. A path can record several, so these are not a
 * partition of the failure probability and must never be added together.
 */
export function observedFailureRows(result: MonteCarloResult): FailureRow[] {
  return (Object.entries(result.observedFailureProbabilities) as [FailureCode, number][])
    .map(([code, probability]) => ({ code, label: FAILURE_LABELS[code], probability }))
    .sort((a, b) => b.probability - a.probability || a.label.localeCompare(b.label));
}

export interface StatRow {
  label: string;
  value: number;
  note?: string;
}

/** The percentile set required of every distribution, in reading order. */
export function distributionRows(distribution: Distribution): StatRow[] {
  return [
    { label: 'Mean', value: distribution.mean },
    { label: 'P10', value: distribution.p10 },
    { label: 'P25', value: distribution.p25 },
    { label: 'Median', value: distribution.median },
    { label: 'P75', value: distribution.p75 },
    { label: 'P90', value: distribution.p90 },
    { label: 'Worst observed', value: distribution.worst, note: 'The sample minimum across the run, not a guaranteed downside bound.' },
  ];
}

export interface SequenceRow {
  label: string;
  value: string;
  note: string;
}

export function sequenceRows(result: MonteCarloResult): SequenceRow[] {
  const risk = result.sequenceRisk;
  const recovery = risk.medianRecoveryYears;
  return [
    {
      label: 'Window evaluated',
      value: `${risk.evaluatedYears} ${risk.evaluatedYears === 1 ? 'year' : 'years'} from the FIRE age`,
      note: 'Shorter horizons report the years actually evaluated rather than assuming five.',
    },
    {
      label: 'Real drawdown over 20%',
      value: `${(risk.drawdownOver20Probability * 100).toFixed(2)}% of paths`,
      note: 'Real financial portfolio value more than 20% below its running peak, measured from the opening FIRE balance. It includes spending, tax and contribution effects, not only market returns.',
    },
    {
      label: 'Liquidity under two years of spending',
      value: `${(risk.belowTwoYearsSpendingProbability * 100).toFixed(2)}% of paths`,
      note: 'Opening or closing cash + ISA + GIA below twice that year’s total required real spending. Pension balances are not counted, even after the access age.',
    },
    {
      label: 'Median recovery time',
      value: recovery === null ? 'No recoveries observed' : `${recovery} ${recovery === 1 ? 'year' : 'years'}`,
      note: `Conditional on an observed recovery to the pre-drawdown real peak, followed to the end age. ${risk.recoveredPaths.toLocaleString('en-GB')} recovered, ${risk.unrecoveredPaths.toLocaleString('en-GB')} still censored at the end age.`,
    },
  ];
}

export interface DiagnosticRow {
  label: string;
  definition: string;
  paths: number;
  probability: number;
  failureWhenPresent: number | null;
  failureWhenAbsent: number | null;
}

/** Associations between a condition and failure. Never a causal decomposition. */
export function diagnosticRows(result: MonteCarloResult): DiagnosticRow[] {
  const { earlyEquityCrash, highEarlyInflation } = result.diagnostics;
  return [
    {
      label: 'Early equity crash',
      definition: 'Any annual equity return below −20% inside the evaluated window after the FIRE age.',
      paths: earlyEquityCrash.paths,
      probability: earlyEquityCrash.probability,
      failureWhenPresent: earlyEquityCrash.failureProbabilityWhenPresent,
      failureWhenAbsent: earlyEquityCrash.failureProbabilityWhenAbsent,
    },
    {
      label: 'High early inflation',
      definition: 'Geometric annual inflation above 5% over the evaluated window.',
      paths: highEarlyInflation.paths,
      probability: highEarlyInflation.probability,
      failureWhenPresent: highEarlyInflation.failureProbabilityWhenPresent,
      failureWhenAbsent: highEarlyInflation.failureProbabilityWhenAbsent,
    },
  ];
}

export interface MetadataRow {
  label: string;
  value: string;
}

/** The reproducibility record. Anything missing here cannot be replayed. */
export function metadataRows(result: MonteCarloResult): MetadataRow[] {
  const meta = result.metadata;
  return [
    { label: 'Paths completed', value: meta.simulationCount.toLocaleString('en-GB') },
    { label: 'Path index range', value: `[${meta.pathIndices.start}, ${meta.pathIndices.endExclusive})` },
    { label: 'Seed', value: String(meta.seed) },
    { label: 'Ledger engine', value: meta.engineVersion },
    { label: 'Simulation engine', value: meta.simulationVersion },
    { label: 'Return generator', value: meta.returnGeneratorVersion },
    { label: 'Market assumptions', value: meta.assumptionVersion },
    { label: 'Tax configuration', value: meta.taxConfigVersion },
    { label: 'Tax policy', value: meta.taxPolicy },
    { label: 'Money basis', value: `${meta.moneyBasis} (today’s money; outputs are not deflated again)` },
    { label: 'Age timing', value: meta.ageTiming },
    { label: 'Percentile method', value: meta.percentileMethod },
    { label: 'Retirement spending level', value: meta.ledgerOptions.retirementLevel },
    {
      label: 'Household spending override',
      value: meta.ledgerOptions.monthlyHouseholdOverride === null
        ? 'none (profile schedule)'
        : `£${meta.ledgerOptions.monthlyHouseholdOverride.toLocaleString('en-GB')}/month`,
    },
    { label: 'Surplus allocation', value: meta.ledgerOptions.surplusAllocation },
    { label: 'Emergency reserve funded first', value: meta.ledgerOptions.fundEmergencyReserve ? 'yes' : 'no' },
    { label: 'Solver tolerance', value: `${meta.ledgerOptions.solverTolerance} over ${meta.ledgerOptions.solverMaxIterations} iterations` },
    { label: 'Event order', value: meta.eventOrder.join(' → ') },
  ];
}

/**
 * The only mutually exclusive split available: a path either succeeded or it did not. The observed
 * failure codes are reported separately because they overlap.
 */
export function successSplit(result: MonteCarloResult): { success: number; failure: number } {
  return { success: result.successProbability, failure: 1 - result.successProbability };
}
