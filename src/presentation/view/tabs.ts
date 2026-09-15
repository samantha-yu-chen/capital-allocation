/**
 * The eight reference destinations (work packages doc, "Authority and baseline").
 *
 * Every tab stays reachable from chunk 4 onwards. Tabs whose engine is not implemented yet say so
 * and name the owning package; they never render a placeholder number that could be mistaken for a
 * result.
 */
export type TabId =
  | 'overview' | 'fire' | 'curve' | 'marginal' | 'solver' | 'scenarios' | 'property' | 'attribution';

export interface TabDefinition {
  id: TabId;
  label: string;
  /** `built` means the screen runs the real engines. `planned` means no engine exists yet. */
  status: 'built' | 'planned';
  /** Work package that owns the screen. */
  package: number;
  summary: string;
  /** What already exists underneath a planned screen, so the gap is concrete. */
  groundwork: string;
}

export const TABS: readonly TabDefinition[] = [
  {
    id: 'overview', label: 'Overview', status: 'built', package: 4,
    summary: 'Current position, this year’s cash flow, the reference FIRE target and the full annual ledger.',
    groundwork: '',
  },
  {
    id: 'fire', label: 'FIRE & Monte Carlo', status: 'built', package: 4,
    summary: 'Success probability, failure analysis, wealth percentiles by age and sequence-risk diagnostics.',
    groundwork: '',
  },
  {
    id: 'curve', label: 'FIRE Age Curve', status: 'built', package: 6,
    summary: 'Success probability at every candidate FIRE age, and the earliest age clearing the target.',
    groundwork: '',
  },
  {
    id: 'marginal', label: 'Marginal Allocation', status: 'built', package: 7,
    summary: 'Where the next increment of capital does the most good, on an after-tax, constraint-aware basis.',
    groundwork: '',
  },
  {
    id: 'solver', label: 'Reverse Solver', status: 'built', package: 6,
    summary: 'Required savings, gross salary, FIRE age, spending reduction, starting capital or pension contribution to hit the target probability.',
    groundwork: '',
  },
  {
    id: 'scenarios', label: 'Scenario Comparison', status: 'built', package: 8,
    summary: 'Named saved alternatives, the required salary × spending × strategy matrix, and spending and income sensitivity on common market paths.',
    groundwork: '',
  },
  {
    id: 'property', label: 'Property & Leverage', status: 'built', package: 5,
    summary: 'Buying, owning or renting inside the same lifetime model, with leverage and rate scenarios.',
    groundwork: '',
  },
  {
    id: 'attribution', label: 'Where It Comes From', status: 'built', package: 9,
    summary: 'Which lever moves the outcome most, plus sensitivity and deterministic stress paths.',
    groundwork: '',
  },
];

export const tabById = (id: TabId): TabDefinition => {
  const found = TABS.find(tab => tab.id === id);
  if (!found) throw new RangeError(`Unknown tab ${id}`);
  return found;
};

export const isTabId = (value: string): value is TabId => TABS.some(tab => tab.id === value);
