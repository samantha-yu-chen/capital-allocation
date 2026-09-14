/**
 * The editable profile surface, described as data.
 *
 * Every input the screens render is one entry here, addressed by its path into the shared
 * `Profile` contract. Nothing in this file knows about React, and nothing here re-implements a
 * validation rule: the single authority is `profileSchema`. A draft that cannot be turned into a
 * number becomes `NaN`, so the schema rejects it rather than the UI quietly keeping the previous
 * value — "invalid input cannot silently enter the engine" (work package 4).
 */
import { profileSchema, type Profile } from '../../domain/contracts.js';

export type FieldGroupId =
  | 'personal' | 'income' | 'household' | 'spending' | 'assets' | 'pension'
  | 'wrappers' | 'liquidity' | 'portfolios' | 'market' | 'simulation' | 'property';

export interface FieldGroup {
  id: FieldGroupId;
  label: string;
  note?: string;
}

export const FIELD_GROUPS: readonly FieldGroup[] = [
  { id: 'personal', label: 'Personal & target', note: 'Ages are half-open year boundaries: year t covers [age, age+1). End age is the boundary after the last funded year.' },
  { id: 'income', label: 'Income', note: 'Salary growth is real (above inflation). Amounts are today’s money.' },
  { id: 'household', label: 'Household' },
  { id: 'spending', label: 'Spending', note: 'Household totals are authoritative. Today’s money throughout; the ledger inflates them per path.' },
  { id: 'assets', label: 'Assets' },
  { id: 'pension', label: 'Pension policy' },
  { id: 'wrappers', label: 'ISA & GIA behaviour' },
  { id: 'liquidity', label: 'Liquidity & known capital needs' },
  { id: 'portfolios', label: 'Portfolios by wrapper', note: 'Each wrapper’s weights must sum to 100%.' },
  { id: 'market', label: 'Market assumptions', note: 'Means and volatilities are arithmetic annual nominal figures. The matrix is the correlation of Gaussian log-growth shocks, not of arithmetic returns.' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'property', label: 'Property inputs', note: 'One residential property. Amounts are today’s GBP; existing rental acquisition basis is historical nominal GBP. Included rent is removed from each spending schedule only while owner-occupied. Enter other household spending without mortgage or the property costs entered here.' },
];

/** How a stored value is shown and typed back. `percent` stores a fraction and shows ×100. */
export type FieldKind = 'money' | 'monthlyMoney' | 'percent' | 'age' | 'integer' | 'decimal' | 'multiple';

/**
 * A numeric input's presentation metadata. Profile fields extend it with a path into the shared
 * contract; screen-level controls that are not part of the profile (search bounds, an age range)
 * use it directly, so `NumberField` has exactly one input shape to render.
 */
export interface ControlFieldDef {
  /** Doubles as the DOM id and the draft key. */
  id: string;
  label: string;
  kind: FieldKind;
  step: number;
  help?: string;
}

export interface NumberFieldDef extends ControlFieldDef {
  group: FieldGroupId;
  /** Dot-joined path into `Profile`; it is also this field's id. */
  path: readonly (string | number)[];
}

const id = (path: readonly (string | number)[]): string => path.join('.');

function field(
  path: readonly (string | number)[], label: string, group: FieldGroupId, kind: FieldKind,
  step: number, help?: string,
): NumberFieldDef {
  return help === undefined
    ? { id: id(path), label, group, path, kind, step }
    : { id: id(path), label, group, path, kind, step, help };
}

const ASSET_HELP = 'Balance today, in today’s money.';

/** Scalar numeric fields. Array-backed fields are generated per profile by `arrayFields`. */
export const NUMBER_FIELDS: readonly NumberFieldDef[] = [
  field(['personal', 'currentAge'], 'Current age', 'personal', 'age', 1),
  field(['personal', 'targetFireAge'], 'Target FIRE age', 'personal', 'age', 1, 'Retirement starts here; it must be at or after the current age and before the end age.'),
  field(['personal', 'endAge'], 'Simulation end age', 'personal', 'age', 1),
  field(['personal', 'targetSuccessProbability'], 'Target success probability', 'personal', 'percent', 1, 'The bar the plan is judged against. It does not change the simulation.'),

  field(['income', 'salaryAnnual'], 'Gross salary', 'income', 'money', 500),
  field(['income', 'bonusAnnual'], 'Bonus', 'income', 'money', 500, 'Taxed as employment income; not pensionable by default.'),
  field(['income', 'otherNonSavingsAnnual'], 'Other non-savings income', 'income', 'money', 250),
  field(['income', 'salaryGrowthReal'], 'Real salary growth', 'income', 'percent', 0.1, 'Above inflation. Nominal salary compounds this and inflation together.'),
  field(['income', 'retirementEmploymentAnnual'], 'Post-FIRE employment income', 'income', 'money', 250, 'Paid from the FIRE age onwards. Not pensionable.'),
  field(['income', 'statePensionAnnual'], 'State pension', 'income', 'money', 250),
  field(['income', 'statePensionAge'], 'State pension age', 'income', 'age', 1, 'National Insurance also moves to category C from this age.'),

  field(['household', 'adults'], 'Adults', 'household', 'integer', 1),
  field(['household', 'children'], 'Children', 'household', 'integer', 1),

  field(['spending', 'current', 'essentialMonthly'], 'Current essential', 'spending', 'monthlyMoney', 25),
  field(['spending', 'current', 'discretionaryMonthly'], 'Current discretionary', 'spending', 'monthlyMoney', 25),
  field(['spending', 'retirement', 'essentialMonthly'], 'Retirement essential', 'spending', 'monthlyMoney', 25),
  field(['spending', 'retirement', 'discretionaryMonthly'], 'Retirement discretionary', 'spending', 'monthlyMoney', 25),
  field(['spending', 'retirementFloorAnnual'], 'Retirement floor (annual)', 'spending', 'money', 250, 'The “floor” run. Must be at or below the target total.'),
  field(['spending', 'retirementComfortAnnual'], 'Retirement comfort (annual)', 'spending', 'money', 250, 'The “comfort” run. Must be at or above the target total.'),
  field(['spending', 'currentRentMonthlyIncluded'], 'Rent already inside current spending', 'spending', 'monthlyMoney', 25, 'Included rent component in your spending schedules. Removed once during owner occupation; restored on sale.'),
  field(['spending', 'lifestyleCreepRate'], 'Lifestyle creep on real pay rises', 'spending', 'percent', 1, 'Share of each real salary increase that becomes discretionary spending.'),
  field(['spending', 'scenarioMonthly', 'low'], 'Low spending case', 'spending', 'monthlyMoney', 25),
  field(['spending', 'scenarioMonthly', 'base'], 'Base spending case', 'spending', 'monthlyMoney', 25),
  field(['spending', 'scenarioMonthly', 'high'], 'High spending case', 'spending', 'monthlyMoney', 25),

  field(['assets', 'cash'], 'Cash', 'assets', 'money', 500, ASSET_HELP),
  field(['assets', 'isa'], 'ISA', 'assets', 'money', 500, ASSET_HELP),
  field(['assets', 'gia', 'marketValue'], 'GIA market value', 'assets', 'money', 500, ASSET_HELP),
  field(['assets', 'gia', 'costBasis'], 'GIA cost basis', 'assets', 'money', 500, 'May legitimately exceed market value.'),
  field(['assets', 'gia', 'carriedLosses'], 'GIA carried losses', 'assets', 'money', 100),
  field(['assets', 'pension'], 'Workplace pension', 'assets', 'money', 500, ASSET_HELP),
  field(['assets', 'sipp'], 'SIPP', 'assets', 'money', 500, 'Tracked separately from the workplace pension.'),
  field(['assets', 'pensionTaxFreeCashUsed'], 'Lifetime lump sum already taken', 'assets', 'money', 500),

  field(['pension', 'employeeRate'], 'Employee contribution', 'pension', 'percent', 0.5),
  field(['pension', 'employerRate'], 'Employer contribution', 'pension', 'percent', 0.5),
  field(['pension', 'matchUpToRate'], 'Employer matches up to', 'pension', 'percent', 0.5, 'Match = pensionable pay × min(employee rate, this) × match multiple. Added on top of the employer rate.'),
  field(['pension', 'matchRate'], 'Match multiple', 'pension', 'multiple', 0.25, '1 means pound for pound.'),
  field(['pension', 'employerNiSharebackRate'], 'Employer NI shareback', 'pension', 'percent', 1, 'Share of the employer’s NI saving added to the pension under salary sacrifice.'),
  field(['pension', 'accessAge'], 'Pension access age', 'pension', 'age', 1, 'Nothing in the pension can fund spending before this age.'),
  field(['pension', 'carryForwardAllowance'], 'Verified carry-forward allowance', 'pension', 'money', 1000, 'Entered explicitly; no historical eligibility is inferred.'),

  field(['isa', 'allowanceUsed'], 'ISA allowance already used this year', 'wrappers', 'money', 500),
  field(['gia', 'dividendYield'], 'GIA dividend yield', 'wrappers', 'percent', 0.1, 'Taxed each year and added to the GIA cost basis as accumulated units.'),
  field(['gia', 'turnoverRate'], 'GIA turnover', 'wrappers', 'percent', 1, 'Share of the holding sold and rebought each year.'),
  field(['gia', 'gainRealisationRate'], 'Share of turnover gain realised', 'wrappers', 'percent', 1),

  field(['liquidity', 'emergencyFundMonths'], 'Emergency reserve (months of essentials)', 'liquidity', 'decimal', 1),
  field(['liquidity', 'minimumLiquidYears'], 'Minimum liquid years', 'liquidity', 'decimal', 0.5, 'Reported as a coverage check each year; it does not force a reallocation.'),

  field(['portfolios', 'isa', 'equities'], 'ISA equities', 'portfolios', 'percent', 1),
  field(['portfolios', 'isa', 'bonds'], 'ISA bonds', 'portfolios', 'percent', 1),
  field(['portfolios', 'isa', 'cash'], 'ISA cash', 'portfolios', 'percent', 1),
  field(['portfolios', 'gia', 'equities'], 'GIA equities', 'portfolios', 'percent', 1),
  field(['portfolios', 'gia', 'bonds'], 'GIA bonds', 'portfolios', 'percent', 1),
  field(['portfolios', 'gia', 'cash'], 'GIA cash', 'portfolios', 'percent', 1),
  field(['portfolios', 'pension', 'equities'], 'Pension equities', 'portfolios', 'percent', 1),
  field(['portfolios', 'pension', 'bonds'], 'Pension bonds', 'portfolios', 'percent', 1),
  field(['portfolios', 'pension', 'cash'], 'Pension cash', 'portfolios', 'percent', 1),

  field(['market', 'equities', 'meanNominal'], 'Equities mean return', 'market', 'percent', 0.1),
  field(['market', 'equities', 'volatility'], 'Equities volatility', 'market', 'percent', 0.1),
  field(['market', 'bonds', 'meanNominal'], 'Bonds mean return', 'market', 'percent', 0.1),
  field(['market', 'bonds', 'volatility'], 'Bonds volatility', 'market', 'percent', 0.1),
  field(['market', 'cash', 'meanNominal'], 'Cash mean return', 'market', 'percent', 0.1),
  field(['market', 'cash', 'volatility'], 'Cash volatility', 'market', 'percent', 0.1),
  field(['market', 'property', 'meanNominal'], 'Property mean return', 'market', 'percent', 0.1, 'Annual value growth while the property is owned.'),
  field(['market', 'property', 'volatility'], 'Property volatility', 'market', 'percent', 0.1),
  field(['market', 'inflation', 'mean'], 'Inflation mean', 'market', 'percent', 0.1),
  field(['market', 'inflation', 'volatility'], 'Inflation volatility', 'market', 'percent', 0.1),

  field(['simulation', 'count'], 'Simulation paths', 'simulation', 'integer', 1000, 'The default is 10,000. The count is never reduced to fit a time budget.'),
  field(['simulation', 'seed'], 'Random seed', 'simulation', 'integer', 1, 'Path streams depend on the seed and path index only, never on scenario decisions.'),
  field(['simulation', 'referenceWithdrawalRate'], 'Reference withdrawal rate', 'simulation', 'percent', 0.1, 'Used only for the reference FIRE number. It is not the safety result.'),
];

export const MARKET_VARIABLES = ['equities', 'bonds', 'cash', 'property', 'inflation'] as const;
export type MarketVariable = typeof MARKET_VARIABLES[number];

/** Fields whose path contains an array index, so they depend on the profile's current shape. */
export function arrayFields(profile: Profile): NumberFieldDef[] {
  const defs: NumberFieldDef[] = [];
  if (profile.property) {
    defs.push(
      field(['property', 'marketValue'], 'Existing property value', 'property', 'money', 1000),
      field(['property', 'mortgageBalance'], 'Existing mortgage balance', 'property', 'money', 1000),
      field(['property', 'mortgageAnnualRate'], 'Mortgage annual rate', 'property', 'percent', 0.1),
      field(['property', 'mortgageTermYears'], 'Remaining mortgage term (years)', 'property', 'integer', 1),
      field(['property', 'maintenanceAnnual'], 'Annual maintenance', 'property', 'money', 100),
      field(['property', 'insuranceAnnual'], 'Annual insurance', 'property', 'money', 50),
      field(['property', 'serviceChargeAnnual'], 'Annual service charge', 'property', 'money', 100),
      field(['property', 'councilTaxAnnual'], 'Annual council tax paid by owner', 'property', 'money', 100),
      field(['property', 'rentAnnual'], 'Annual gross rent at full occupancy', 'property', 'money', 500),
      field(['property', 'occupancyRate'], 'Rental occupancy', 'property', 'percent', 1),
      field(['property', 'managementRate'], 'Rental management fee', 'property', 'percent', 1),
      field(['property', 'acquisitionCostBasis'], 'Existing rental acquisition cost basis', 'property', 'money', 1000),
      field(['property', 'purchaseTaxOverride'], 'Manual purchase tax', 'property', 'money', 100),
    );
    if (profile.property.purchase) defs.push(
      field(['property', 'purchase', 'age'], 'Purchase age', 'property', 'age', 1),
      field(['property', 'purchase', 'price'], 'Purchase price', 'property', 'money', 1000),
      field(['property', 'purchase', 'deposit'], 'Purchase deposit', 'property', 'money', 1000),
      field(['property', 'purchase', 'transactionCosts'], 'Legal and other purchase costs (excluding tax)', 'property', 'money', 100),
    );
    if (profile.property.sale) defs.push(
      field(['property', 'sale', 'age'], 'Sale age', 'property', 'age', 1),
      field(['property', 'sale', 'sellingCostRate'], 'Selling costs', 'property', 'percent', 0.1),
    );
    profile.property.rateChanges.forEach((_, i) => defs.push(
      field(['property', 'rateChanges', i, 'age'], `Refinance ${i + 1} age`, 'property', 'age', 1),
      field(['property', 'rateChanges', i, 'annualRate'], `Refinance ${i + 1} rate`, 'property', 'percent', .1),
    ));
  }

  profile.spending.phases.forEach((_, i) => {
    defs.push(
      field(['spending', 'phases', i, 'startAge'], `Phase ${i + 1} start age`, 'spending', 'age', 1),
      field(['spending', 'phases', i, 'endAge'], `Phase ${i + 1} end age`, 'spending', 'age', 1),
      field(['spending', 'phases', i, 'essentialMonthly'], `Phase ${i + 1} essential`, 'spending', 'monthlyMoney', 25),
      field(['spending', 'phases', i, 'discretionaryMonthly'], `Phase ${i + 1} discretionary`, 'spending', 'monthlyMoney', 25),
    );
  });
  profile.liquidity.capitalNeeds.forEach((_, i) => {
    defs.push(
      field(['liquidity', 'capitalNeeds', i, 'age'], `Capital need ${i + 1} age`, 'liquidity', 'age', 1),
      field(['liquidity', 'capitalNeeds', i, 'amount'], `Capital need ${i + 1} amount`, 'liquidity', 'money', 500),
    );
  });
  if (profile.spending.breakdown) {
    defs.push(
      field(['spending', 'breakdown', 'sharedMonthly'], 'Shared monthly', 'spending', 'monthlyMoney', 25),
      field(['spending', 'breakdown', 'perAdultMonthly'], 'Per adult monthly', 'spending', 'monthlyMoney', 25),
      field(['spending', 'breakdown', 'perChildMonthly'], 'Per child monthly', 'spending', 'monthlyMoney', 25),
    );
  }
  for (let row = 0; row < 5; row++) {
    for (let column = row + 1; column < 5; column++) {
      defs.push(field(['market', 'correlation', row, column],
        `${MARKET_VARIABLES[row]} / ${MARKET_VARIABLES[column]} log-shock correlation`, 'market', 'decimal', 0.05));
    }
  }
  return defs.filter(def => {
    if (def.group !== 'property' || !profile.property) return true;
    const key = def.path[1];
    if (key === 'marketValue' || key === 'mortgageBalance') return profile.property.purchase === null;
    if (key === 'acquisitionCostBasis') return profile.property.use === 'rental' && profile.property.purchase === null;
    if (key === 'purchaseTaxOverride') return profile.property.taxLocation === 'manual';
    if (key === 'rentAnnual' || key === 'occupancyRate' || key === 'managementRate') return profile.property.use === 'rental';
    return true;
  });
}

/** Every field applicable to this profile, scalar and array-backed. */
export function fieldsFor(profile: Profile): NumberFieldDef[] {
  return [...NUMBER_FIELDS, ...arrayFields(profile)];
}

export function readPath(root: unknown, path: readonly (string | number)[]): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string | number, unknown>)[key];
  }
  return node;
}

/** Structural clone then single-key write; callers never mutate the profile they were given. */
export function writePath<T>(root: T, path: readonly (string | number)[], value: unknown): T {
  if (path.length === 0) throw new RangeError('Empty path');
  const clone = structuredClone(root);
  let node = clone as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  node[path[path.length - 1]!] = value;
  return clone;
}

const displayScale = (kind: FieldKind): number => kind === 'percent' ? 100 : 1;

/** Trims the binary-representation noise that ×100 introduces (0.85 → 85, not 85.00000000000001). */
const tidy = (value: number): number => Number.isFinite(value) ? Number(value.toPrecision(12)) : value;

export function toDisplay(def: ControlFieldDef, stored: number): string {
  if (!Number.isFinite(stored)) return '';
  return String(tidy(stored * displayScale(def.kind)));
}

/** An unparseable draft becomes NaN so `profileSchema` rejects it; it never falls back to the old value. */
export function fromDisplay(def: ControlFieldDef, text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return Number.NaN;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return tidy(parsed / displayScale(def.kind));
}

export function fieldValue(profile: Profile, def: NumberFieldDef): number {
  const raw = readPath(profile, def.path);
  return typeof raw === 'number' ? raw : Number.NaN;
}

/** The text shown in a field: the in-flight draft if there is one, otherwise the stored value. */
export function displayValue(profile: Profile, def: NumberFieldDef, drafts: Readonly<Record<string, string>>): string {
  const draft = drafts[def.id];
  return draft === undefined ? toDisplay(def, fieldValue(profile, def)) : draft;
}

/**
 * Fold the in-flight drafts into a candidate profile.
 *
 * The correlation matrix is symmetric by contract, so editing the upper triangle writes the mirror
 * cell too; otherwise the schema would reject every keystroke as asymmetric.
 */
export function applyDrafts(
  base: Profile, drafts: Readonly<Record<string, string>>, defs: readonly NumberFieldDef[],
): unknown {
  let candidate: unknown = structuredClone(base) as unknown;
  const byId = new Map(defs.map(def => [def.id, def]));
  for (const [key, text] of Object.entries(drafts)) {
    const def = byId.get(key);
    if (!def) continue;
    const value = fromDisplay(def, text);
    candidate = writePath(candidate, def.path, value);
    if (def.path[0] === 'market' && def.path[1] === 'correlation') {
      candidate = writePath(candidate, ['market', 'correlation', def.path[3] as number, def.path[2] as number], value);
    }
  }
  return candidate;
}

export interface FieldIssue {
  /** The field this belongs to, or null for a cross-field rule (for example floor ≤ target ≤ comfort). */
  fieldId: string | null;
  group: FieldGroupId | null;
  path: string;
  message: string;
}

export type ValidationState =
  | { ok: true; profile: Profile; issues: readonly FieldIssue[] }
  | { ok: false; issues: readonly FieldIssue[] };

const GROUP_BY_ROOT: Record<string, FieldGroupId> = {
  property: 'property', personal: 'personal', income: 'income', household: 'household', spending: 'spending',
  assets: 'assets', pension: 'pension', isa: 'wrappers', gia: 'wrappers',
  liquidity: 'liquidity', portfolios: 'portfolios', market: 'market', simulation: 'simulation',
};

/** `profileSchema` is the only authority; this just files each issue against a field and a group. */
export function validateCandidate(candidate: unknown, defs: readonly NumberFieldDef[]): ValidationState {
  const result = profileSchema.safeParse(candidate);
  if (result.success) return { ok: true, profile: result.data, issues: [] };
  const ids = new Set(defs.map(def => def.id));
  const issues = result.error.issues.map((issue): FieldIssue => {
    const path = issue.path.map(String).join('.');
    const root = issue.path.length > 0 ? String(issue.path[0]) : '';
    return {
      fieldId: ids.has(path) ? path : null,
      group: GROUP_BY_ROOT[root] ?? null,
      path,
      message: issue.message,
    };
  });
  return { ok: false, issues };
}

/** Convenience: draft → candidate → validated, in one call. */
export function validateDrafts(base: Profile, drafts: Readonly<Record<string, string>>): ValidationState {
  const defs = fieldsFor(base);
  return validateCandidate(applyDrafts(base, drafts, defs), defs);
}

/** Drop drafts whose path no longer resolves, so removing a list row cannot strand a stale entry. */
export function pruneDrafts(base: Profile, drafts: Readonly<Record<string, string>>): Record<string, string> {
  const ids = new Set(fieldsFor(base).map(def => def.id));
  return Object.fromEntries(Object.entries(drafts).filter(([key]) => ids.has(key)));
}
