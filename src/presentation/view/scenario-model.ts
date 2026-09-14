/**
 * Scenario Comparison view model.
 *
 * Everything the screen renders is computed here, from results the engine produced. Nothing in this
 * file simulates, re-derives a probability or invents a comparison: it validates the controls,
 * states what a run will cost before it starts, and turns `ScenarioCell`s into rows.
 *
 * Three rules it exists to enforce:
 *
 * - The cost of a batch is announced in complete lifetime projections *before* it runs, and the
 *   path count is never quietly lowered. Choosing a preview is a separate, explicit act and every
 *   preview result is labelled as one.
 * - A comparison is only presented as a comparison when the cells actually share the draws. Cells
 *   the engine reported as unsupported keep their reason and show no figures.
 * - A difference smaller than the paired sampling uncertainty is not presented as a finding.
 */
import type { Profile } from '../../domain/contracts.js';
import type { Scenario, ScenarioOptions } from '../../domain/scenarios.js';
import type { LedgerOptions } from '../../engine/ledger.js';
import type {
  CapitalStrategyId, ScenarioBatchRequest, ScenarioBatchResult, ScenarioCase, ScenarioCell,
  ScenarioProgress, StrategyContext,
} from '../../engine/scenario.js';
import {
  CAPITAL_STRATEGIES, CAPITAL_STRATEGY_DEFINITIONS, SCENARIO_PRESET_DEFINITIONS,
  buildIncomeCases, buildLibraryCases, buildScenarioMatrix, buildSpendingCases, capitalStrategy,
} from '../../engine/scenario.js';
import { defaultProperty } from './property-model.js';
import {
  SCENARIO_FIRE_FROM_FIELD, SCENARIO_FIRE_TO_FIELD, SCENARIO_PREVIEW_FIELD,
  SCENARIO_SALARY_DEFAULTS, SCENARIO_SALARY_FIELDS, fromDisplay,
} from './fields.js';
import { count, money, percent, ratio } from './format.js';
import { probabilityWithUncertainty } from './solver-model.js';

export type ComparisonView = 'matrix' | 'spending' | 'income' | 'library';

export const COMPARISON_VIEWS: readonly { value: ComparisonView; label: string }[] = [
  { value: 'matrix', label: 'Required matrix (salary × spending × strategy)' },
  { value: 'spending', label: 'Spending sensitivity (section 61)' },
  { value: 'income', label: 'Income uplift bands (section 62)' },
  { value: 'library', label: 'Saved named scenarios' },
];

export const STRATEGY_OPTIONS = CAPITAL_STRATEGY_DEFINITIONS.map(s => ({ value: s.id, label: s.label }));
export const PRESET_OPTIONS = SCENARIO_PRESET_DEFINITIONS.map(p => ({ value: p.id, label: p.label, description: p.description }));
export const strategyLabel = (id: CapitalStrategyId): string => capitalStrategy(id).label;

export interface ScenarioSettings {
  view: ComparisonView;
  strategy: CapitalStrategyId;
  previewEnabled: boolean;
  fireAgeEnabled: boolean;
}

export const defaultScenarioSettings = (): ScenarioSettings =>
  ({ view: 'matrix', strategy: 'balanced', previewEnabled: false, fireAgeEnabled: false });

/** The purchase the property strategies model: the entered one, or the shared default to edit. */
export const scenarioPropertyPlan = (profile: Profile): StrategyContext['property'] =>
  profile.property ?? defaultProperty(profile);

export const defaultFireRange = (profile: Profile): { fromAge: number; toAge: number } => ({
  fromAge: Math.max(profile.personal.currentAge, profile.personal.targetFireAge - 2),
  toAge: Math.min(profile.personal.endAge - 1, profile.personal.targetFireAge + 3),
});

export const DEFAULT_PREVIEW_PATHS = 1000;

const draftValue = (drafts: Readonly<Record<string, string>>, id: string, fallback: number, kind: { id: string; kind: string; step: number; label: string }): number =>
  drafts[id] === undefined ? fallback : fromDisplay(kind as Parameters<typeof fromDisplay>[0], drafts[id]!);

export interface ScenarioIssue { id: string | null; message: string }

export interface ScenarioPlanModel {
  cases: ScenarioCase[];
  request: ScenarioBatchRequest;
  issues: ScenarioIssue[];
  /** Complete lifetime projections this run will perform. */
  projections: number;
  simulations: number;
  announcement: string;
  salaries: number[];
  spending: number[];
  previewPaths: number | null;
}

/**
 * Validate the controls and build the batch.
 *
 * An unparseable control is an issue, never a silently reused previous value, and the run button
 * stays disabled while any issue stands.
 */
export function scenarioPlan(
  profile: Profile, ledgerOptions: LedgerOptions, settings: ScenarioSettings,
  drafts: Readonly<Record<string, string>>, options: ScenarioOptions, scenarios: readonly Scenario[],
): ScenarioPlanModel {
  const issues: ScenarioIssue[] = [];
  const salaries = SCENARIO_SALARY_FIELDS.map((field, index) => draftValue(drafts, field.id, SCENARIO_SALARY_DEFAULTS[index]!, field));
  salaries.forEach((salary, index) => {
    if (!Number.isFinite(salary) || salary < 0)
      issues.push({ id: SCENARIO_SALARY_FIELDS[index]!.id, message: 'Enter a salary of zero or more.' });
  });
  const spending = [profile.spending.scenarioMonthly.low, profile.spending.scenarioMonthly.base, profile.spending.scenarioMonthly.high];

  const range = defaultFireRange(profile);
  const fromAge = draftValue(drafts, SCENARIO_FIRE_FROM_FIELD.id, range.fromAge, SCENARIO_FIRE_FROM_FIELD);
  const toAge = draftValue(drafts, SCENARIO_FIRE_TO_FIELD.id, range.toAge, SCENARIO_FIRE_TO_FIELD);
  const fireAgeSearch = settings.fireAgeEnabled ? { fromAge, toAge } : null;
  if (fireAgeSearch) {
    if (!Number.isInteger(fromAge) || fromAge < profile.personal.currentAge)
      issues.push({ id: SCENARIO_FIRE_FROM_FIELD.id, message: 'The first candidate age must be a whole age at or after the current age.' });
    if (!Number.isInteger(toAge) || toAge >= profile.personal.endAge || toAge < fromAge)
      issues.push({ id: SCENARIO_FIRE_TO_FIELD.id, message: 'The last candidate age must be a whole age at or after the first and before the end age.' });
  }

  const previewPaths = settings.previewEnabled
    ? draftValue(drafts, SCENARIO_PREVIEW_FIELD.id, DEFAULT_PREVIEW_PATHS, SCENARIO_PREVIEW_FIELD) : null;
  if (previewPaths !== null && (!Number.isInteger(previewPaths) || previewPaths < 1))
    issues.push({ id: SCENARIO_PREVIEW_FIELD.id, message: 'A preview needs a whole number of paths, at least one.' });

  const context: StrategyContext = { property: scenarioPropertyPlan(profile), salaryAxis: salaries.filter(Number.isFinite) };
  const valid = issues.length === 0;
  const cases = !valid ? [] :
    settings.view === 'matrix' ? buildScenarioMatrix(profile, { salaries, monthlySpending: spending, strategies: [...CAPITAL_STRATEGIES], context, options })
    : settings.view === 'spending' ? buildSpendingCases(profile, spending, settings.strategy, context, options)
    : settings.view === 'income' ? buildIncomeCases(profile, salaries, options.monthlyHouseholdOverride, settings.strategy, context, options)
    : buildLibraryCases(scenarios.map(s => ({ id: s.id, name: s.name, profile: s.profile, options: s.options })));
  if (valid && settings.view === 'library' && scenarios.length === 0)
    issues.push({ id: null, message: 'Save at least one named scenario before comparing saved scenarios.' });

  const runnable = cases.filter(c => c.status === 'planned').length;
  const paths = previewPaths ?? profile.simulation.count;
  const agesPerCell = fireAgeSearch ? Math.max(0, fireAgeSearch.toAge - fireAgeSearch.fromAge + 1) : 0;
  const simulations = runnable * (1 + agesPerCell);
  const projections = simulations * paths;
  const request: ScenarioBatchRequest = {
    cases, previewPaths, fireAgeSearch,
    ledgerOptions: { solverTolerance: ledgerOptions.solverTolerance, solverMaxIterations: ledgerOptions.solverMaxIterations },
  };
  const previewNote = previewPaths === null
    ? `The entered path count of ${count(profile.simulation.count)} is used in full; it is never reduced to finish sooner.`
    : `PREVIEW: you asked for ${count(previewPaths)} paths instead of the entered ${count(profile.simulation.count)}. Its numbers are labelled a preview and must not be read as a full-count result.`;
  return {
    cases, request, issues, projections, simulations, salaries, spending, previewPaths,
    announcement: `${count(runnable)} scenario${runnable === 1 ? '' : 's'} × ${count(1 + agesPerCell)} complete simulation${agesPerCell ? 's each' : ''} = ${count(simulations)} simulations, or ${count(projections)} lifetime projections. ${previewNote}`,
  };
}

export function scenarioProgressLine(progress: ScenarioProgress | null): string {
  if (!progress) return 'Starting…';
  return `${progress.stage} — ${count(progress.casesCompleted)} of ${count(progress.casesPlanned)} scenarios complete`;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface ScenarioRow {
  id: string;
  label: string;
  status: ScenarioCell['status'];
  reason: string | null;
  note: string;
  salary: string;
  spending: string;
  strategy: string;
  probability: string;
  fireAge: string;
  takeHome: string;
  marginalRate: string;
  pensionContribution: string;
  isaContribution: string;
  totalInvested: string;
  liquidAtFire: string;
  pensionAtFire: string;
  netWorthAtFire: string;
  terminalMedian: string;
  terminalP10: string;
  surplus: string;
  capitalTarget: string;
  preview: boolean;
  fromCache: boolean;
}

const dash = '—';

export function scenarioRows(result: ScenarioBatchResult): ScenarioRow[] {
  return result.cells.map((cell): ScenarioRow => {
    const d = cell.deterministic, s = cell.simulation;
    return {
      id: cell.id, label: cell.label, status: cell.status, reason: cell.reason, note: cell.note,
      salary: cell.axes.salary === null ? dash : money(cell.axes.salary),
      spending: cell.axes.monthlySpending === null ? 'Entered schedule' : `${money(cell.axes.monthlySpending)}/mo`,
      strategy: cell.axes.strategy === null ? dash : strategyLabel(cell.axes.strategy),
      probability: s ? probabilityWithUncertainty(s.probability, s.standardError) : dash,
      fireAge: cell.fireAge
        ? cell.fireAge.earliestQualifyingAge === null
          ? `None in ${cell.fireAge.fromAge}–${cell.fireAge.toAge}`
          : String(cell.fireAge.earliestQualifyingAge)
        : s ? `At ${s.fireAge}` : dash,
      takeHome: d ? money(d.takeHome) : dash,
      marginalRate: d && Number.isFinite(d.marginalRate) ? percent(d.marginalRate, 1) : dash,
      pensionContribution: d ? money(d.pensionTotal) : dash,
      isaContribution: d ? money(d.isaContribution) : dash,
      totalInvested: d ? money(d.totalInvested) : dash,
      liquidAtFire: s ? money(s.liquidAtFire) : dash,
      pensionAtFire: s ? money(s.pensionAtFire) : dash,
      netWorthAtFire: s ? money(s.netWorthAtFire) : dash,
      terminalMedian: s ? money(s.terminalMedian) : dash,
      terminalP10: s ? money(s.terminalP10) : dash,
      surplus: d ? money(d.investableSurplus) : dash,
      capitalTarget: d ? money(d.referenceFireNumber) : dash,
      preview: result.metadata.preview,
      fromCache: cell.fromCache,
    };
  });
}

export interface SpendingEffectRow {
  label: string;
  monthly: string;
  /** The surplus half of the effect: what the plan can invest this year. */
  surplus: string;
  totalInvested: string;
  /** The capital-target half: the retirement budget and the capital it implies. */
  retirementSpending: string;
  capitalTarget: string;
  probability: string;
  fireAge: string;
}

/** Spec section 61: both halves of the spending effect, side by side, from the same run. */
export function spendingEffectRows(result: ScenarioBatchResult): SpendingEffectRow[] {
  return result.cells.filter(cell => cell.axes.monthlySpending !== null && cell.deterministic).map(cell => {
    const d = cell.deterministic!;
    return {
      label: cell.label, monthly: `${money(cell.axes.monthlySpending!)}/mo`,
      surplus: money(d.investableSurplus), totalInvested: money(d.totalInvested),
      retirementSpending: money(d.retirementSpendingReal), capitalTarget: money(d.referenceFireNumber),
      probability: cell.simulation ? probabilityWithUncertainty(cell.simulation.probability, cell.simulation.standardError) : dash,
      fireAge: cell.fireAge ? (cell.fireAge.earliestQualifyingAge === null ? `None in ${cell.fireAge.fromAge}–${cell.fireAge.toAge}` : String(cell.fireAge.earliestQualifyingAge)) : dash,
    };
  });
}

const evaluated = (result: ScenarioBatchResult): ScenarioCell[] => result.cells.filter(c => c.status === 'evaluated' && c.simulation);

/**
 * What the comparison supports saying.
 *
 * A lead is only claimed when it clears the combined sampling uncertainty of the two cells; within
 * that band the comparison reports a tie, because a difference smaller than the sampling error is
 * not a finding.
 */
export function scenarioConclusion(result: ScenarioBatchResult, target: number): string {
  const cells = evaluated(result);
  if (!cells.length) return 'No scenario in this batch could be evaluated. Each row states why.';
  const sorted = [...cells].sort((a, b) => b.simulation!.probability - a.simulation!.probability);
  const best = sorted[0]!;
  const error = (cell: ScenarioCell) => 1.96 * cell.simulation!.standardError;
  const tied = sorted.filter(cell =>
    best.simulation!.probability - cell.simulation!.probability <= error(best) + error(cell) + 1e-12);
  const preview = result.metadata.preview
    ? ` These are PREVIEW figures at ${count(result.metadata.simulationCount)} of ${count(result.metadata.enteredSimulationCount)} paths, not a full-count result.`
    : '';
  const clears = best.simulation!.probability >= target
    ? `It clears the ${percent(target, 0)} target.`
    : `It still falls short of the ${percent(target, 0)} target.`;
  const lead = tied.length > 1
    ? `${tied.map(c => c.label).join(', ')} lead within paired sampling uncertainty, so this batch does not separate them.`
    : `${best.label} leads at ${probabilityWithUncertainty(best.simulation!.probability, best.simulation!.standardError)}. ${clears}`;
  const unsupported = result.metadata.unsupported
    ? ` ${count(result.metadata.unsupported)} scenario${result.metadata.unsupported === 1 ? '' : 's'} could not be modelled and ${result.metadata.unsupported === 1 ? 'states its reason' : 'state their reasons'} instead of a figure.`
    : '';
  return `${lead}${unsupported}${preview}`;
}

/** Spec section 63: does spending or income dominate wrapper choice on these paths? */
export function dominanceNote(result: ScenarioBatchResult): string | null {
  const cells = evaluated(result).filter(c => c.axes.salary !== null && c.axes.monthlySpending !== null && c.axes.strategy !== null);
  if (cells.length < 4) return null;
  const spread = (key: (cell: ScenarioCell) => string): number => {
    const groups = new Map<string, number[]>();
    for (const cell of cells) {
      const bucket = groups.get(key(cell)) ?? [];
      bucket.push(cell.simulation!.probability);
      groups.set(key(cell), bucket);
    }
    const means = [...groups.values()].map(values => values.reduce((a, b) => a + b, 0) / values.length);
    return Math.max(...means) - Math.min(...means);
  };
  const salary = spread(c => String(c.axes.salary));
  const spending = spread(c => String(c.axes.monthlySpending));
  const strategy = spread(c => String(c.axes.strategy));
  const ordered = [['income', salary], ['spending', spending], ['capital strategy', strategy]] as const;
  const ranked = [...ordered].sort((a, b) => b[1] - a[1]);
  return `Averaged across this matrix, ${ranked[0]![0]} moves FIRE success most (${percent(ranked[0]![1], 1)} between its best and worst band), then ${ranked[1]![0]} (${percent(ranked[1]![1], 1)}) and ${ranked[2]![0]} (${percent(ranked[2]![1], 1)}). These are averages over the other axes on one set of common paths, not an attribution of a single plan's gap — that is package 9.`;
}

export interface ScenarioSummary { label: string; value: string; note: string }

export function scenarioSummary(result: ScenarioBatchResult): ScenarioSummary[] {
  const cells = evaluated(result);
  const best = cells.length ? cells.reduce((a, b) => b.simulation!.probability > a.simulation!.probability ? b : a) : null;
  return [
    { label: 'Scenarios evaluated', value: count(result.metadata.evaluated),
      note: result.metadata.unsupported ? `${count(result.metadata.unsupported)} unsupported, each with its reason` : 'All requested scenarios ran' },
    { label: 'Paths per scenario', value: count(result.metadata.simulationCount),
      note: result.metadata.preview ? `PREVIEW of the entered ${count(result.metadata.enteredSimulationCount)}` : 'The entered count, in full' },
    { label: 'Best tested success', value: best ? percent(best.simulation!.probability, 2) : dash, note: best ? best.label : 'Nothing evaluated' },
    { label: 'Shared seed', value: String(result.metadata.seed), note: 'Every scenario reuses the same absolute path indices' },
  ];
}

/** Matrix pivot: one row per salary and spending case, one column per strategy. */
export interface MatrixGrid {
  strategies: { id: CapitalStrategyId; label: string }[];
  rows: { salary: string; spending: string; cells: { id: string; probability: string; netWorth: string; status: ScenarioCell['status'] }[] }[];
}

export function matrixGrid(result: ScenarioBatchResult): MatrixGrid | null {
  const cells = result.cells.filter(c => c.group === 'matrix');
  if (!cells.length) return null;
  const strategies = [...new Set(cells.map(c => c.axes.strategy!))].map(id => ({ id, label: strategyLabel(id) }));
  const keys = [...new Set(cells.map(c => `${c.axes.salary}|${c.axes.monthlySpending}`))];
  return {
    strategies,
    rows: keys.map(key => {
      const [salary, spending] = key.split('|').map(Number) as [number, number];
      return {
        salary: money(salary), spending: `${money(spending)}/mo`,
        cells: strategies.map(strategy => {
          const cell = cells.find(c => c.axes.salary === salary && c.axes.monthlySpending === spending && c.axes.strategy === strategy.id)!;
          return {
            id: cell.id, status: cell.status,
            probability: cell.simulation ? percent(cell.simulation.probability, 1) : dash,
            netWorth: cell.simulation ? money(cell.simulation.netWorthAtFire) : dash,
          };
        }),
      };
    }),
  };
}

export interface LibraryRow {
  id: string; name: string; origin: string; note: string;
  salary: string; spending: string; fireAge: string; pension: string; paths: string;
}

export function libraryRows(scenarios: readonly Scenario[]): LibraryRow[] {
  return scenarios.map(scenario => ({
    id: scenario.id, name: scenario.name, origin: scenario.origin, note: scenario.note,
    salary: money(scenario.profile.income.salaryAnnual),
    spending: scenario.options.monthlyHouseholdOverride === null
      ? 'Entered schedule' : `${money(scenario.options.monthlyHouseholdOverride)}/mo`,
    fireAge: String(scenario.profile.personal.targetFireAge),
    pension: `${percent(scenario.profile.pension.employeeRate, 2)} employee`,
    paths: `${count(scenario.profile.simulation.count)} paths, seed ${scenario.profile.simulation.seed}`,
  }));
}

export const scenarioBasis: readonly string[] = [
  'Every scenario runs the complete lifetime ledger — the same tax rules, allowances, contribution methods, property cash flows, spending policy, liquidity constraints and Monte Carlo engine as the FIRE screen. Nothing here scales or interpolates a result.',
  'Common random numbers (spec section 65): all scenarios reuse the entered seed and the same absolute path indices, so a difference between two cells is a difference in the plan, not in the draw. A saved scenario that changes the seed, horizon or market assumptions is reported as incomparable rather than compared.',
  'Money is in today’s terms. Take-home, tax, contributions and surplus are the first projected year; liquid, pension and net wealth are medians at that plan’s own target FIRE age; terminal wealth is at the end age. ± is a 95% Monte Carlo sampling interval, and a lead inside it is reported as a tie rather than as a finding.',
  'Spending cases change both sides of the problem at once: a higher case lowers this year’s investable surplus AND raises the retirement budget and the capital the plan must reach. Both columns come from the same run.',
  'Strategy definitions are explicit transforms of the entered plan. ISA Heavy contributes only what still earns the employer match on offer. Pension Tax-Band Optimised raises the workplace contribution by the smallest amount that vacates the top tax band the plan occupies, then caps it at what the annual allowance supports in later years. Balanced keeps the contractual policy. Property buys the configured purchase inside the same model.',
  'Unsupported is not failure: a strategy this profile cannot express, or a contribution beyond the available annual allowance, states its reason and shows no figures. A cancelled run publishes nothing at all — no partial matrix.',
  'A preview is only produced when you ask for one, is labelled a preview everywhere it appears, and is cached separately so it can never stand in for a full-count result.',
];

export const scenarioCostWarning = (plan: ScenarioPlanModel, profile: Profile): string | null =>
  plan.simulations >= 20 && plan.previewPaths === null && profile.simulation.count >= 5000
    ? `This is ${count(plan.simulations)} complete simulations at ${count(profile.simulation.count)} paths and can take several minutes. Lower the path count explicitly, or choose a labelled preview, if that is too long.`
    : null;

export const cacheNote = (result: ScenarioBatchResult): string =>
  result.metadata.cacheHits > 0
    ? `${count(result.metadata.cacheHits)} of ${count(result.cells.length)} scenarios reused an identical cached result. A cached cell is keyed on the whole profile, every run option and the engine, tax and generator versions, so it can only be reused for exactly the same inputs.`
    : 'Every scenario in this batch was computed from scratch.';

export const liquidityRatio = (cell: ScenarioCell): string =>
  cell.simulation && cell.deterministic && cell.deterministic.retirementSpendingReal > 0
    ? ratio(cell.simulation.liquidAtFire / cell.deterministic.retirementSpendingReal)
    : dash;
