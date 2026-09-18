import type { Profile } from '../../domain/contracts.js';
import type { LedgerOptions } from '../../engine/index.js';
import { computeOverview } from './overview-model.js';
import { runKey } from './run-key.js';
import type { FieldIssue, FieldTier } from './fields.js';

export type WizardStepId = 'about' | 'income' | 'spending' | 'assets' | 'result';

export interface WizardStep {
  id: WizardStepId;
  title: string;
  prompt: string;
  fieldIds: readonly string[];
}

export const WIZARD_STEPS: readonly WizardStep[] = [
  {
    id: 'about', title: 'About you', prompt: 'Set the dates and tax region that shape the plan.',
    fieldIds: ['personal.currentAge', 'personal.targetFireAge', 'personal.taxRegion'],
  },
  {
    id: 'income', title: 'Income', prompt: 'Add the pay and pension contributions you can rely on.',
    fieldIds: ['income.salaryAnnual', 'income.bonusAnnual', 'pension.employeeRate', 'pension.employerRate'],
  },
  {
    id: 'spending', title: 'Spending', prompt: 'Separate the bills you must pay from the life you choose.',
    fieldIds: [
      'spending.current.essentialMonthly', 'spending.current.discretionaryMonthly',
      'spending.retirement.essentialMonthly', 'spending.retirement.discretionaryMonthly',
      'spending.currentRentMonthlyIncluded',
    ],
  },
  {
    id: 'assets', title: 'What you have', prompt: 'Add the accounts that will fund the plan.',
    fieldIds: ['assets.cash', 'assets.isa', 'assets.pension', 'assets.gia.marketValue'],
  },
  {
    id: 'result', title: 'See your result', prompt: 'Start with transparent arithmetic, then test the plan properly.',
    fieldIds: [],
  },
] as const;

export const WIZARD_FIELD_IDS: readonly string[] = WIZARD_STEPS.flatMap(step => step.fieldIds);

const GROUP_FOR_STEP: Readonly<Record<Exclude<WizardStepId, 'result'>, readonly string[]>> = {
  about: ['personal'],
  income: ['income', 'pension'],
  spending: ['spending'],
  assets: ['assets'],
};

/** Plain issues owned by one step. A cross-field issue follows the step that contains its group. */
export function wizardStepIssues(step: WizardStepId, issues: readonly FieldIssue[]): readonly FieldIssue[] {
  if (step === 'result') return issues;
  const fields = new Set(WIZARD_STEPS.find(item => item.id === step)?.fieldIds ?? []);
  const groups = new Set(GROUP_FOR_STEP[step]);
  return issues.filter(issue => issue.fieldId ? fields.has(issue.fieldId) : groups.has(issue.group ?? ''));
}

export interface WizardResult {
  referenceFireNumber: number;
  investableAssetsAtFire: number;
  deterministicSuccess: boolean;
  firstFailureAge: number | null;
  runKey: string;
  pathCount: number;
}

/** Step 5 reads the existing deterministic view model; it contains no second calculation. */
export function wizardResult(profile: Profile, options: LedgerOptions): WizardResult {
  const overview = computeOverview(profile, options);
  return {
    referenceFireNumber: overview.reference.referenceFireNumber,
    investableAssetsAtFire: overview.reference.investableAssetsAtFireReal,
    deterministicSuccess: overview.success,
    firstFailureAge: overview.metrics.firstFailureAge,
    runKey: runKey(profile, options),
    pathCount: profile.simulation.count,
  };
}

/** UX-1's recorded exception: requested optional fields may be common; every essential field appears. */
export function wizardTierCoverage(
  entries: readonly { id: string; tier: FieldTier }[],
): { unsupported: readonly string[]; missingEssential: readonly string[] } {
  const byId = new Map(entries.map(entry => [entry.id, entry.tier]));
  return {
    unsupported: WIZARD_FIELD_IDS.filter(id => !['essential', 'common'].includes(byId.get(id) ?? '')),
    missingEssential: entries.filter(entry => entry.tier === 'essential' && !WIZARD_FIELD_IDS.includes(entry.id))
      .map(entry => entry.id),
  };
}
