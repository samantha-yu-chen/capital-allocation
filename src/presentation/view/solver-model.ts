/**
 * View models for the Reverse Solver and the FIRE Age Curve.
 *
 * React renders what these functions return and nothing else: every number, label and caveat below
 * is derived from a real engine result or from validated screen controls. Two rules shape the
 * presentation:
 *
 * - A search answer is quantised to the mode's precision, so it is never shown more finely than it
 *   was tested; the Monte Carlo probability beside it carries its own, larger sampling uncertainty,
 *   and the two are always labelled separately.
 * - Work is announced before it is done. A solve is many complete simulations, so the screens state
 *   how many projections a run will cost rather than discovering it halfway through.
 */
import type { Profile } from '../../domain/contracts.js';
import type { LedgerOptions } from '../../engine/ledger.js';
import type { FireAgeCurveRequest, FireAgeCurveResult } from '../../engine/fire-curve.js';
import {
  SOLVER_MODES, solverBounds, type CapitalDestination, type SolverModeId, type SolverModeSummary,
  type SolverRequest, type SolverResult, type SolverRun, type SolverUnit,
} from '../../engine/solver.js';
import { linearScale, linePath, niceTicks } from './chart.js';
import { count, money, percent } from './format.js';
import type { ControlFieldDef, FieldKind } from './fields.js';

export type { SolverModeSummary };

export const SOLVER_MODE_OPTIONS: readonly { value: SolverModeId; label: string }[] =
  SOLVER_MODES.map(mode => ({ value: mode.id, label: mode.label }));

export const CAPITAL_DESTINATIONS: readonly { value: CapitalDestination; label: string }[] = [
  { value: 'gia', label: 'General investment account (entered at cost)' },
  { value: 'isa', label: 'ISA balance' },
  { value: 'cash', label: 'Cash' },
  { value: 'pension', label: 'Pension (locked until the access age)' },
];

export const solverModeSummary = (id: SolverModeId): SolverModeSummary => {
  const found = SOLVER_MODES.find(mode => mode.id === id);
  if (!found) throw new RangeError(`Unknown solver mode ${id}`);
  return found;
};

const UNIT_KIND: Record<SolverUnit, FieldKind> = {
  money: 'money', monthlyMoney: 'monthlyMoney', rate: 'percent', age: 'age',
};

const UNIT_STEP: Record<SolverUnit, number> = { money: 1000, monthlyMoney: 25, rate: 1, age: 1 };

/** The bound field changes units with the mode, so it is built rather than listed. */
export function solverBoundField(mode: SolverModeSummary): ControlFieldDef {
  return {
    id: 'solver.bound', label: `Search bound — ${mode.direction === 'increase' ? 'highest' : 'lowest'} value to test`,
    kind: UNIT_KIND[mode.unit], step: UNIT_STEP[mode.unit],
    help: 'The far end of the bounded search. If nothing up to this value clears the target, the answer is reported as not reachable inside the bound rather than extrapolated.',
  };
}

export const SOLVER_TARGET_FIELD: ControlFieldDef = {
  id: 'solver.target', label: 'Target success probability', kind: 'percent', step: 1,
  help: 'The bar each candidate plan must clear. Defaults to the profile’s own target.',
};

export const SOLVER_BUDGET_FIELD: ControlFieldDef = {
  id: 'solver.maxEvaluations', label: 'Evaluation budget', kind: 'integer', step: 1,
  help: 'Maximum number of complete simulations the search may run, excluding the confirmation run. A budget that runs out is reported, never hidden.',
};

export const CURVE_FROM_FIELD: ControlFieldDef = {
  id: 'curve.fromAge', label: 'First candidate FIRE age', kind: 'age', step: 1,
  help: 'Every whole age from here upwards is simulated in full.',
};

export const CURVE_TO_FIELD: ControlFieldDef = {
  id: 'curve.toAge', label: 'Last candidate FIRE age', kind: 'age', step: 1,
  help: 'Must be below the simulation end age. A wider range is a proportionally longer run.',
};

export interface ControlIssue { id: string; message: string }

/** Reads one control draft, falling back to the engine's own default when the box is empty. */
export function readControl(def: ControlFieldDef, drafts: Readonly<Record<string, string>>, fallback: number): number {
  const text = drafts[def.id];
  if (text === undefined || text.trim() === '') return fallback;
  const parsed = Number(text.trim());
  if (!Number.isFinite(parsed)) return Number.NaN;
  return def.kind === 'percent' ? parsed / 100 : parsed;
}

export interface SolverFormState {
  mode: SolverModeId;
  destination: CapitalDestination;
  includeSensitivity: boolean;
  drafts: Readonly<Record<string, string>>;
}

export interface SolverPlan {
  mode: SolverModeSummary;
  request: SolverRequest;
  currentValue: number;
  boundValue: number;
  unsupported: string | null;
  issues: ControlIssue[];
  /** Upper bound on complete simulations, including confirmation and any sensitivity solves. */
  plannedSimulations: number;
  plannedProjections: number;
  searches: number;
}

/** Everything the Reverse Solver screen needs before it runs anything, derived from real bounds. */
export function solverPlan(profile: Profile, ledgerOptions: LedgerOptions, state: SolverFormState): SolverPlan {
  const mode = solverModeSummary(state.mode);
  const issues: ControlIssue[] = [];
  const target = readControl(SOLVER_TARGET_FIELD, state.drafts, profile.personal.targetSuccessProbability);
  if (!Number.isFinite(target) || target <= 0 || target > 1)
    issues.push({ id: SOLVER_TARGET_FIELD.id, message: 'Enter a target above 0% and at most 100%.' });
  const budget = readControl(SOLVER_BUDGET_FIELD, state.drafts, 24);
  if (!Number.isInteger(budget) || budget < 3 || budget > 200)
    issues.push({ id: SOLVER_BUDGET_FIELD.id, message: 'Enter a whole evaluation budget between 3 and 200.' });

  const baseRequest: SolverRequest = {
    mode: state.mode, startingCapitalDestination: state.destination, ledgerOptions,
    ...(Number.isFinite(target) && target > 0 && target <= 1 ? { targetProbability: target } : {}),
  };
  let probe: { current: number; bound: number; unsupported: string | null };
  try { probe = solverBounds(profile, baseRequest); } catch (error) {
    probe = { current: Number.NaN, bound: Number.NaN, unsupported: error instanceof Error ? error.message : String(error) };
  }
  const boundField = solverBoundField(mode);
  const bound = readControl(boundField, state.drafts, probe.bound);
  if (probe.unsupported === null) {
    if (!Number.isFinite(bound)) issues.push({ id: boundField.id, message: 'Enter a numeric search bound.' });
    else if (mode.direction === 'increase' && bound < probe.current)
      issues.push({ id: boundField.id, message: 'This search raises the input, so the bound must be at or above the current value.' });
    else if (mode.direction === 'decrease' && bound > probe.current)
      issues.push({ id: boundField.id, message: 'This search lowers the input, so the bound must be at or below the current value.' });
  }

  const span = Math.abs(bound - probe.current);
  const steps = Number.isFinite(span) ? Math.max(1, span / mode.precision) : 1;
  const searchCost = Math.min(Number.isInteger(budget) ? budget : 24,
    mode.monotoneAssumed ? 2 + Math.ceil(Math.log2(steps)) : 2 + Math.ceil(Math.min(steps, 9)));
  const searches = state.includeSensitivity ? 4 : 1;
  const plannedSimulations = (searchCost + 1) * searches;
  return {
    mode, currentValue: probe.current, boundValue: bound, unsupported: probe.unsupported, issues,
    request: {
      ...baseRequest,
      ...(Number.isFinite(bound) ? { bound } : {}),
      ...(Number.isInteger(budget) ? { maxEvaluations: budget } : {}),
    },
    plannedSimulations, plannedProjections: plannedSimulations * profile.simulation.count, searches,
  };
}

export interface CurvePlan {
  request: FireAgeCurveRequest;
  ages: number[];
  issues: ControlIssue[];
  plannedProjections: number;
}

export function curvePlan(profile: Profile, ledgerOptions: LedgerOptions, drafts: Readonly<Record<string, string>>): CurvePlan {
  const issues: ControlIssue[] = [];
  const first = readControl(CURVE_FROM_FIELD, drafts, profile.personal.currentAge);
  const last = readControl(CURVE_TO_FIELD, drafts, Math.min(profile.personal.endAge - 1, profile.personal.currentAge + 20));
  if (!Number.isInteger(first) || first < profile.personal.currentAge || first >= profile.personal.endAge)
    issues.push({ id: CURVE_FROM_FIELD.id, message: `Enter a whole age between ${profile.personal.currentAge} and ${profile.personal.endAge - 1}.` });
  if (!Number.isInteger(last) || last < first || last >= profile.personal.endAge)
    issues.push({ id: CURVE_TO_FIELD.id, message: `Enter a whole age between the first candidate age and ${profile.personal.endAge - 1}.` });
  else if (last - first > 60) issues.push({ id: CURVE_TO_FIELD.id, message: 'Limit the range to 61 candidate ages.' });
  const ages = issues.length === 0 ? Array.from({ length: last - first + 1 }, (_, index) => first + index) : [];
  return {
    request: { fromAge: first, toAge: last, targetProbability: profile.personal.targetSuccessProbability, ledgerOptions },
    ages, issues, plannedProjections: ages.length * profile.simulation.count,
  };
}

export function formatSolverValue(value: number | null, unit: SolverUnit): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (unit === 'age') return `age ${Math.round(value)}`;
  if (unit === 'rate') return percent(value, 2);
  if (unit === 'monthlyMoney') return `${money(value)} / month`;
  return money(value);
}

/** 95% interval half-width from the sampling standard error. Never a bound on the model itself. */
export const confidenceHalfWidth = (standardError: number | null): number | null =>
  standardError === null ? null : 1.96 * standardError;

export function probabilityWithUncertainty(probability: number | null, standardError: number | null): string {
  if (probability === null) return '—';
  const half = confidenceHalfWidth(standardError);
  return half === null ? percent(probability, 2) : `${percent(probability, 2)} ± ${percent(half, 2)}`;
}

export interface Headline { kicker: string; value: string; note: string; tone: 'good' | 'bad' | 'neutral' }

export function solverHeadline(result: SolverResult): Headline {
  const unit = result.unit;
  const target = percent(result.targetProbability, 0);
  if (result.status === 'unsupported')
    return { kicker: 'This search does not apply to the current settings', value: '—', note: result.message ?? '', tone: 'neutral' };
  if (result.status === 'already_met')
    return {
      kicker: 'Already met', value: formatSolverValue(result.currentValue, unit), tone: 'good',
      note: `The entered plan already reaches ${probabilityWithUncertainty(result.currentProbability, result.standardError)} against a ${target} target, so no change to this input is required. The search stopped at the current value rather than reporting a smaller one.`,
    };
  if (result.status === 'infeasible')
    return {
      kicker: 'Not reachable inside the search bound', value: formatSolverValue(result.bound.value, unit), tone: 'bad',
      note: `Even at ${formatSolverValue(result.bound.value, unit)} the plan reaches only ${percent(result.bound.probability ?? Number.NaN, 2)} against a ${target} target. This input alone cannot close the gap inside the bound; widen the bound or move another input.`,
    };
  return {
    kicker: result.label, value: formatSolverValue(result.requiredValue, unit), tone: 'good',
    note: `Reaches ${probabilityWithUncertainty(result.requiredProbability, result.standardError)} against a ${target} target, re-checked against the complete model. Today’s money; searched to the nearest ${formatSolverValue(result.precision, unit === 'age' ? 'age' : unit)}.`,
  };
}

export interface Row { label: string; value: string; note: string }

export function solverDetailRows(result: SolverResult): Row[] {
  const unit = result.unit;
  const rows: Row[] = [
    { label: 'Current value', value: formatSolverValue(result.currentValue, unit), note: 'The entered plan, unchanged.' },
    {
      label: 'Probability of the entered plan',
      value: probabilityWithUncertainty(result.currentProbability, result.standardError),
      note: `Full-model success across ${count(result.simulationCount)} paths.`,
    },
  ];
  if (result.requiredValue !== null) {
    rows.push({ label: 'Required value', value: formatSolverValue(result.requiredValue, unit), note: 'Smallest change tested that cleared the target.' });
    rows.push({
      label: 'Confirmed on re-evaluation',
      value: result.confirmed ? probabilityWithUncertainty(result.confirmedProbability, result.standardError) : 'not confirmed',
      note: 'The returned plan was rebuilt and run again through the complete model, not read back from the search.',
    });
    if (result.excludedValue !== null) rows.push({
      label: 'Largest tested value that failed',
      value: formatSolverValue(result.excludedValue, unit),
      note: result.probabilityMonotoneObserved
        ? 'The requirement lies above this value and at or below the answer.'
        : 'Success did not move consistently with this input, so untested values below the answer may also qualify.',
    });
  }
  rows.push({ label: 'Search bound', value: formatSolverValue(result.bound.value, unit),
    note: result.bound.probability === null ? 'Not evaluated.' : `Reaches ${percent(result.bound.probability, 2)}.` });
  rows.push({ label: 'Search precision', value: formatSolverValue(result.precision, unit === 'age' ? 'age' : unit),
    note: 'Exact for this seed and path set. Sampling uncertainty is separate and larger.' });
  rows.push({ label: 'Full simulations run', value: count(result.evaluations.length + (result.confirmedProbability === null ? 0 : 1)),
    note: `Each one is a complete ${count(result.simulationCount)}-path lifetime model.` });
  if (result.derived.annualInvestableSurplusReal !== null) rows.push({
    label: 'First-year investable surplus of the solved plan',
    value: money(result.derived.annualInvestableSurplusReal),
    note: 'Measured from the expected-value ledger of the returned plan, in today’s money.',
  });
  if (result.derived.retirementSpendingAnnualReal !== null) rows.push({
    label: 'Retirement spending of the solved plan',
    value: money(result.derived.retirementSpendingAnnualReal),
    note: 'Annual household total in today’s money, at the retirement level this run uses.',
  });
  return rows;
}

export interface EvaluationRow { value: string; probability: string; verdict: string; invalid: boolean }

/** Every full-model evaluation the search performed, in search order, including invalid candidates. */
export function evaluationRows(result: SolverResult): EvaluationRow[] {
  return result.evaluations.map(evaluation => ({
    value: formatSolverValue(evaluation.value, result.unit),
    probability: evaluation.probability === null ? '—' : percent(evaluation.probability, 2),
    verdict: evaluation.status === 'invalid'
      ? `Not a valid plan: ${evaluation.message ?? 'rejected'}`
      : evaluation.meetsTarget ? 'Clears the target' : 'Below the target',
    invalid: evaluation.status === 'invalid',
  }));
}

/** Spec section 33's sensitivity block: each row is its own completed search, never a scaled answer. */
export function sensitivityRows(run: SolverRun): Row[] {
  const unit = run.primary.unit;
  const rows: Row[] = [{
    label: 'Current value', value: formatSolverValue(run.primary.currentValue, unit),
    note: 'The entered plan, for comparison.',
  }];
  for (const item of run.sensitivities) {
    const result = item.result;
    rows.push({
      label: item.label,
      value: result.status === 'solved' ? formatSolverValue(result.requiredValue, unit)
        : result.status === 'already_met' ? `already met at ${formatSolverValue(result.currentValue, unit)}`
        : result.status === 'infeasible' ? `not reachable below ${formatSolverValue(result.bound.value, unit)}`
        : 'not applicable',
      note: item.description,
    });
  }
  return rows;
}

export function solverNotes(result: SolverResult): string[] {
  const notes = [...result.notes];
  if (!result.monotoneAssumed)
    notes.push('This input is not assumed to help monotonically, so a coarse grid was scanned in order before the first qualifying interval was refined.');
  if (!result.feasibilityMonotoneObserved)
    notes.push('A larger change scored worse than a smaller one somewhere in the tested range. Read the evaluation trace rather than the headline alone.');
  return notes;
}

export interface CurvePoint { x: number; y: number; age: number; probability: number; qualifying: boolean }

export interface CurveGeometry {
  width: number; height: number;
  pathD: string;
  points: CurvePoint[];
  targetY: number;
  ageTicks: { x: number; age: number }[];
  probabilityTicks: { y: number; label: string }[];
  axis: { left: number; right: number; top: number; bottom: number };
}

/** Pure geometry so the shape can be asserted in tests instead of eyeballed in a browser. */
export function curveGeometry(result: FireAgeCurveResult): CurveGeometry | null {
  const usable = result.points.filter(point => point.probability !== null);
  if (usable.length < 1) return null;
  const width = 760, height = 300;
  const axis = { left: 56, right: 16, top: 16, bottom: 34 };
  const ages = usable.map(point => point.age);
  const lowAge = Math.min(...ages), highAge = Math.max(...ages);
  const x = linearScale([lowAge, highAge], [axis.left, width - axis.right]);
  const y = linearScale([0, 1], [height - axis.bottom, axis.top]);
  const points = usable.map(point => ({
    x: x(point.age), y: y(point.probability!), age: point.age, probability: point.probability!,
    qualifying: result.earliestQualifyingAge !== null && point.age === result.earliestQualifyingAge,
  }));
  return {
    width, height, axis, pathD: linePath(points.map(point => ({ x: point.x, y: point.y }))), points,
    targetY: y(result.targetProbability),
    ageTicks: niceTicks(lowAge, highAge, 9).filter(age => age >= lowAge && age <= highAge)
      .map(age => ({ x: x(age), age })),
    probabilityTicks: [0, 0.25, 0.5, 0.75, 1].map(value => ({ y: y(value), label: percent(value, 0) })),
  };
}

export interface CurveRow {
  age: number; probability: string; interval: string; verdict: string;
  bridgeYears: string; terminal: string; fireCapital: string;
}

export function curveRows(result: FireAgeCurveResult): CurveRow[] {
  return result.points.map(point => ({
    age: point.age,
    probability: point.probability === null ? '—' : percent(point.probability, 2),
    interval: point.standardError === null ? '—' : `± ${percent(1.96 * point.standardError, 2)}`,
    verdict: point.status === 'invalid' ? `Not simulated: ${point.message ?? 'invalid'}`
      : point.meetsTarget ? 'Clears the target' : 'Below the target',
    bridgeYears: `${point.bridgeYears}`,
    terminal: point.medianTerminalWealthReal === null ? '—' : money(point.medianTerminalWealthReal),
    fireCapital: point.medianFireCapitalReal === null ? '—' : money(point.medianFireCapitalReal),
  }));
}

export function curveHeadline(result: FireAgeCurveResult): Headline {
  const target = percent(result.targetProbability, 0);
  const range = result.points.length
    ? `${result.points[0]!.age} to ${result.points[result.points.length - 1]!.age}`
    : 'the requested range';
  if (result.earliestQualifyingAge === null)
    return {
      kicker: 'No candidate age reached the target', value: '—', tone: 'bad',
      note: `No FIRE age from ${range} reached ${target} success. Extending the range, spending less or saving more are all separate searches on the Reverse Solver.`,
    };
  const point = result.points.find(item => item.age === result.earliestQualifyingAge)!;
  return {
    kicker: 'Earliest FIRE age reaching the target', value: `Age ${point.age}`, tone: 'good',
    note: `Reaching ${probabilityWithUncertainty(point.probability, point.standardError)} against a ${target} target, with a ${point.bridgeYears}-year pre-pension bridge. Every age from ${range} was simulated in full on the same paths.`,
  };
}

export function curveNotes(result: FireAgeCurveResult): string[] {
  const notes: string[] = [];
  if (!result.monotone)
    notes.push('Success probability did not rise with every extra year of work on this curve. Retiring later interacts with a property purchase, a mortgage term and the pension access age, so read the whole curve rather than the earliest qualifying age alone.');
  if (result.points.some(point => point.status === 'invalid'))
    notes.push('Some candidate ages could not be simulated; they are listed with the reason and left out of the curve rather than interpolated.');
  return notes;
}

// ── UX-6: the same six searches, asked as a question ────────────────────────────────────────────

/**
 * The Reverse Solver answers "what would I have to change?", but its controls are named after the
 * engine's modes. The picker below re-labels those six modes as answers to one spoken question; it
 * changes no bound, no request and no search behaviour, only the words the reader chooses between.
 */
export const SOLVER_QUESTION_STEM = 'To hit my goal, what would my …';

export interface SolverQuestionOption {
  value: SolverModeId;
  /** Completes the stem: "To hit my goal, what would my gross salary need to be?" */
  subject: string;
  /** One plain sentence on what moves and what stays fixed, for the reader choosing. */
  plain: string;
}

export const SOLVER_QUESTIONS: readonly SolverQuestionOption[] = [
  {
    value: 'salary', subject: 'gross salary',
    plain: 'What you would have to earn, before tax, with your spending and everything else unchanged.',
  },
  {
    value: 'savings', subject: 'annual savings',
    plain: 'How much you would have to put away each working year, funded by spending less while you work.',
  },
  {
    value: 'fire_age', subject: 'FIRE age',
    plain: 'How long you would have to keep working, with pay, saving and spending unchanged.',
  },
  {
    value: 'retirement_spending', subject: 'retirement spending',
    plain: 'What you would have to live on each month once you stop working, with working-life spending unchanged.',
  },
  {
    value: 'starting_capital', subject: 'extra starting capital',
    plain: 'How much you would have to hold today on top of your current assets — a windfall, not a plan.',
  },
  {
    value: 'pension_contribution', subject: 'pension contribution',
    plain: 'What share of your pay would have to go into the pension, which shelters tax but locks the money up.',
  },
];

export const solverQuestion = (id: SolverModeId): SolverQuestionOption => {
  const found = SOLVER_QUESTIONS.find(option => option.value === id);
  if (!found) throw new RangeError(`Unknown solver mode ${id}`);
  return found;
};

/** The reader-facing outcome. `budget_exhausted` is a `solved` search that ran out of evaluations. */
export type SolverAnswerStatus = 'achieved' | 'already_met' | 'budget_exhausted' | 'infeasible' | 'unsupported';

export interface SolverAnswerModel {
  status: SolverAnswerStatus;
  /** The whole answer in ordinary words, honesty clause included. */
  sentence: string;
  /** That honesty clause alone: the confirmed bracket, or the bound that was not cleared. */
  honesty: string;
  /** The answer itself, formatted, or null when there is no value to give. */
  value: string | null;
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * A search whose bracket is still wider than its own precision after using every evaluation it was
 * allowed has not finished narrowing. Both facts are read off the result rather than off the
 * engine's prose, so this state cannot drift if a note is reworded.
 */
function budgetExhausted(result: SolverResult): boolean {
  if (result.status !== 'solved' || result.requiredValue === null || result.excludedValue === null) return false;
  const bracket = Math.abs(result.requiredValue - result.excludedValue);
  return result.evaluations.length >= result.metadata.maxEvaluations
    && bracket > result.precision * (1 + 1e-9);
}

/**
 * Every solver outcome as one plain sentence a non-financial reader can act on.
 *
 * The sentence never rounds away what the search did and did not establish: an achieved answer
 * carries the confirmed bracket, an unfinished one carries the range the requirement still lies in,
 * and an unreachable one carries the bound it failed at. Nothing here re-derives a probability.
 */
export function solverAnswer(result: SolverResult): SolverAnswerModel {
  const unit = result.unit;
  const subject = solverQuestion(result.mode).subject;
  const target = percent(result.targetProbability, 0);
  const value = (raw: number | null) => formatSolverValue(raw, unit);

  if (result.status === 'unsupported') {
    const honesty = result.message
      ?? 'This search does not apply to the settings this run used, so no value was searched for.';
    return {
      status: 'unsupported', tone: 'neutral', value: null, honesty,
      sentence: `This question cannot be answered for your current settings. ${honesty}`,
    };
  }

  if (result.status === 'already_met') {
    const honesty = `the search stopped at your current ${subject} rather than looking for a smaller one, `
      + 'so this is not the least you could get away with';
    return {
      status: 'already_met', tone: 'good', value: value(result.currentValue), honesty,
      sentence: `Your ${subject} does not have to change: at ${value(result.currentValue)} this plan already `
        + `reaches ${probabilityWithUncertainty(result.currentProbability, result.standardError)} against your `
        + `${target} target (${honesty}).`,
    };
  }

  if (result.status === 'infeasible') {
    const reached = result.bound.probability === null
      ? 'was never reached'
      : `reaches only ${percent(result.bound.probability, 2)}`;
    const honesty = `${value(result.bound.value)} was the far end of the search and it ${reached}, short of `
      + `your ${target} target; nothing beyond that bound was tested, so widen it or change something else too`;
    return {
      status: 'infeasible', tone: 'bad', value: null, honesty,
      sentence: `Changing your ${subject} on its own would not be enough (${honesty}).`,
    };
  }

  const answer = value(result.requiredValue);
  const confirmation = result.confirmed
    ? `we confirmed ${answer} clears your ${target} target`
    : `${answer} cleared your ${target} target during the search, but the re-run did not reproduce it, so treat it as unverified`;
  if (budgetExhausted(result)) {
    const honesty = `${confirmation}, but the search ran out of evaluations before it could narrow that down: `
      + `the least that would do is somewhere above ${value(result.excludedValue)} and at or below ${answer}`;
    return {
      status: 'budget_exhausted', tone: 'good', value: answer, honesty,
      sentence: `Your ${subject} would have to be about ${answer} (${honesty}). Raise the evaluation budget to close the gap.`,
    };
  }
  const honesty = result.excludedValue === null
    ? `${confirmation}; nothing below it was tested, so the true requirement may be lower`
    : `${confirmation} and that ${value(result.excludedValue)} does not`;
  return {
    status: 'achieved', tone: 'good', value: answer, honesty,
    sentence: `You would need a ${subject} of about ${answer} (${honesty}).`,
  };
}
