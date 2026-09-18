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
 * How much weight an input carries for a reader who is not a finance professional.
 *
 * `essential` is the handful of personal numbers nobody can leave at a default without the answer
 * becoming somebody else's. `common` is what a reasonably engaged person knows about their own
 * situation. `expert` is everything with a defensible default — modelling assumptions, tax edge
 * cases, and the machinery of the simulation itself. The tier is presentation only: it decides
 * what is on screen, never what reaches an engine.
 */
export type FieldTier = 'essential' | 'common' | 'expert';

/** The reader's chosen depth. `common` means "essential and common", `all` means everything. */
export type TierMode = 'essential' | 'common' | 'all';

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
  /**
   * Where this input's starting value comes from, when it is worked out from another answer rather
   * than simply chosen. Read by the provenance layer, which tells the reader what a default means
   * before they decide whether to change it.
   */
  derivedFrom?: string;
}

export interface NumberFieldDef extends ControlFieldDef {
  group: FieldGroupId;
  /** Dot-joined path into `Profile`; it is also this field's id. */
  path: readonly (string | number)[];
  tier: FieldTier;
}

const id = (path: readonly (string | number)[]): string => path.join('.');

function field(
  path: readonly (string | number)[], label: string, group: FieldGroupId, kind: FieldKind,
  step: number, tier: FieldTier, help?: string, derivedFrom?: string,
): NumberFieldDef {
  return {
    id: id(path), label, group, path, kind, step, tier,
    ...(help === undefined ? {} : { help }),
    ...(derivedFrom === undefined ? {} : { derivedFrom }),
  };
}

const ASSET_HELP = 'Balance today, in today’s money.';

/** Scalar numeric fields. Array-backed fields are generated per profile by `arrayFields`. */
export const NUMBER_FIELDS: readonly NumberFieldDef[] = [
  field(['personal', 'currentAge'], 'Current age', 'personal', 'age', 1, 'essential'),
  field(['personal', 'targetFireAge'], 'Target FIRE age', 'personal', 'age', 1, 'essential', 'Retirement starts here; it must be at or after the current age and before the end age.'),
  field(['personal', 'endAge'], 'Simulation end age', 'personal', 'age', 1, 'common'),
  field(['personal', 'targetSuccessProbability'], 'Target success probability', 'personal', 'percent', 1, 'common', 'The bar the plan is judged against. It does not change the simulation.'),

  field(['income', 'salaryAnnual'], 'Gross salary', 'income', 'money', 500, 'essential'),
  field(['income', 'bonusAnnual'], 'Bonus', 'income', 'money', 500, 'common', 'Taxed as employment income; not pensionable by default.'),
  field(['income', 'otherNonSavingsAnnual'], 'Other non-savings income', 'income', 'money', 250, 'common'),
  field(['income', 'salaryGrowthReal'], 'Real salary growth', 'income', 'percent', 0.1, 'common', 'Above inflation. Nominal salary compounds this and inflation together.'),
  field(['income', 'retirementEmploymentAnnual'], 'Post-FIRE employment income', 'income', 'money', 250, 'expert', 'Paid from the FIRE age onwards. Not pensionable.'),
  field(['income', 'statePensionAnnual'], 'State pension', 'income', 'money', 250, 'common'),
  field(['income', 'statePensionAge'], 'State pension age', 'income', 'age', 1, 'common', 'National Insurance also moves to category C from this age.'),

  field(['household', 'adults'], 'Adults', 'household', 'integer', 1, 'expert'),
  field(['household', 'children'], 'Children', 'household', 'integer', 1, 'expert'),

  field(['spending', 'current', 'essentialMonthly'], 'Current essential', 'spending', 'monthlyMoney', 25, 'essential'),
  field(['spending', 'current', 'discretionaryMonthly'], 'Current discretionary', 'spending', 'monthlyMoney', 25, 'essential'),
  field(['spending', 'retirement', 'essentialMonthly'], 'Retirement essential', 'spending', 'monthlyMoney', 25, 'essential',
    undefined, 'the same as current essential spending, on the assumption that retirement costs what today costs'),
  field(['spending', 'retirement', 'discretionaryMonthly'], 'Retirement discretionary', 'spending', 'monthlyMoney', 25, 'essential',
    undefined, 'the same as current discretionary spending, on the assumption that retirement costs what today costs'),
  field(['spending', 'retirementFloorAnnual'], 'Retirement floor (annual)', 'spending', 'money', 250, 'expert', 'The “floor” run. Must be at or below the target total.',
    'twelve months of the starter’s current essential spending, with no discretionary spending at all'),
  field(['spending', 'retirementComfortAnnual'], 'Retirement comfort (annual)', 'spending', 'money', 250, 'expert', 'The “comfort” run. Must be at or above the target total.',
    'twelve months of the starter’s high spending case'),
  field(['spending', 'currentRentMonthlyIncluded'], 'Rent already inside current spending', 'spending', 'monthlyMoney', 25, 'common', 'Included rent component in your spending schedules. Removed once during owner occupation; restored on sale.'),
  field(['spending', 'lifestyleCreepRate'], 'Lifestyle creep on real pay rises', 'spending', 'percent', 1, 'common', 'Share of each real salary increase that becomes discretionary spending.'),
  field(['spending', 'scenarioMonthly', 'low'], 'Low spending case', 'spending', 'monthlyMoney', 25, 'expert',
    undefined, 'the starter’s current essential spending on its own'),
  field(['spending', 'scenarioMonthly', 'base'], 'Base spending case', 'spending', 'monthlyMoney', 25, 'expert',
    undefined, 'the starter’s current essential and discretionary spending added together'),
  field(['spending', 'scenarioMonthly', 'high'], 'High spending case', 'spending', 'monthlyMoney', 25, 'expert'),

  field(['assets', 'cash'], 'Cash', 'assets', 'money', 500, 'essential', ASSET_HELP),
  field(['assets', 'isa'], 'ISA', 'assets', 'money', 500, 'essential', ASSET_HELP),
  field(['assets', 'gia', 'marketValue'], 'GIA market value', 'assets', 'money', 500, 'common', ASSET_HELP),
  field(['assets', 'gia', 'costBasis'], 'GIA cost basis', 'assets', 'money', 500, 'expert', 'May legitimately exceed market value.',
    'the GIA market value, which assumes the holding shows neither a gain nor a loss yet'),
  field(['assets', 'gia', 'carriedLosses'], 'GIA carried losses', 'assets', 'money', 100, 'expert'),
  field(['assets', 'pension'], 'Workplace pension', 'assets', 'money', 500, 'essential', ASSET_HELP),
  field(['assets', 'sipp'], 'SIPP', 'assets', 'money', 500, 'common', 'Tracked separately from the workplace pension.'),
  field(['assets', 'pensionTaxFreeCashUsed'], 'Lifetime lump sum already taken', 'assets', 'money', 500, 'expert'),

  field(['pension', 'employeeRate'], 'Employee contribution', 'pension', 'percent', 0.5, 'essential'),
  field(['pension', 'employerRate'], 'Employer contribution', 'pension', 'percent', 0.5, 'essential'),
  field(['pension', 'matchUpToRate'], 'Employer matches up to', 'pension', 'percent', 0.5, 'common', 'Match = pensionable pay × min(employee rate, this) × match multiple. Added on top of the employer rate.'),
  field(['pension', 'matchRate'], 'Match multiple', 'pension', 'multiple', 0.25, 'common', '1 means pound for pound.'),
  field(['pension', 'employerNiSharebackRate'], 'Employer NI shareback', 'pension', 'percent', 1, 'expert', 'Share of the employer’s NI saving added to the pension under salary sacrifice.'),
  field(['pension', 'accessAge'], 'Pension access age', 'pension', 'age', 1, 'common', 'Nothing in the pension can fund spending before this age.'),
  field(['pension', 'carryForwardAllowance'], 'Verified carry-forward allowance', 'pension', 'money', 1000, 'expert', 'Entered explicitly; no historical eligibility is inferred.'),

  field(['isa', 'allowanceUsed'], 'ISA allowance already used this year', 'wrappers', 'money', 500, 'expert'),
  field(['gia', 'dividendYield'], 'GIA dividend yield', 'wrappers', 'percent', 0.1, 'expert', 'Taxed each year and added to the GIA cost basis as accumulated units.'),
  field(['gia', 'turnoverRate'], 'GIA turnover', 'wrappers', 'percent', 1, 'expert', 'Share of the holding sold and rebought each year.'),
  field(['gia', 'gainRealisationRate'], 'Share of turnover gain realised', 'wrappers', 'percent', 1, 'expert'),

  field(['liquidity', 'emergencyFundMonths'], 'Emergency reserve (months of essentials)', 'liquidity', 'decimal', 1, 'common'),
  field(['liquidity', 'minimumLiquidYears'], 'Minimum liquid years', 'liquidity', 'decimal', 0.5, 'expert', 'Reported as a coverage check each year; it does not force a reallocation.'),

  field(['portfolios', 'isa', 'equities'], 'ISA equities', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'isa', 'bonds'], 'ISA bonds', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'isa', 'cash'], 'ISA cash', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'gia', 'equities'], 'GIA equities', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'gia', 'bonds'], 'GIA bonds', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'gia', 'cash'], 'GIA cash', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'pension', 'equities'], 'Pension equities', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'pension', 'bonds'], 'Pension bonds', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'pension', 'cash'], 'Pension cash', 'portfolios', 'percent', 1, 'expert'),

  field(['market', 'equities', 'meanNominal'], 'Equities mean return', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'equities', 'volatility'], 'Equities volatility', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'bonds', 'meanNominal'], 'Bonds mean return', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'bonds', 'volatility'], 'Bonds volatility', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'cash', 'meanNominal'], 'Cash mean return', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'cash', 'volatility'], 'Cash volatility', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'property', 'meanNominal'], 'Property mean return', 'market', 'percent', 0.1, 'expert', 'Annual value growth while the property is owned.'),
  field(['market', 'property', 'volatility'], 'Property volatility', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'inflation', 'mean'], 'Inflation mean', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'inflation', 'volatility'], 'Inflation volatility', 'market', 'percent', 0.1, 'expert'),

  field(['simulation', 'count'], 'Simulation paths', 'simulation', 'integer', 1000, 'expert', 'The default is 10,000. The count is never reduced to fit a time budget.'),
  field(['simulation', 'seed'], 'Random seed', 'simulation', 'integer', 1, 'expert', 'Path streams depend on the seed and path index only, never on scenario decisions.'),
  field(['simulation', 'referenceWithdrawalRate'], 'Reference withdrawal rate', 'simulation', 'percent', 0.1, 'expert', 'Used only for the reference FIRE number. It is not the safety result.'),
];

export const MARKET_VARIABLES = ['equities', 'bonds', 'cash', 'property', 'inflation'] as const;
export type MarketVariable = typeof MARKET_VARIABLES[number];

/** Fields whose path contains an array index, so they depend on the profile's current shape. */
export function arrayFields(profile: Profile): NumberFieldDef[] {
  const defs: NumberFieldDef[] = [];
  if (profile.property) {
    defs.push(
      field(['property', 'marketValue'], 'Existing property value', 'property', 'money', 1000, 'common'),
      field(['property', 'mortgageBalance'], 'Existing mortgage balance', 'property', 'money', 1000, 'common'),
      field(['property', 'mortgageAnnualRate'], 'Mortgage annual rate', 'property', 'percent', 0.1, 'common'),
      field(['property', 'mortgageTermYears'], 'Remaining mortgage term (years)', 'property', 'integer', 1, 'common'),
      field(['property', 'maintenanceAnnual'], 'Annual maintenance', 'property', 'money', 100, 'expert'),
      field(['property', 'insuranceAnnual'], 'Annual insurance', 'property', 'money', 50, 'expert'),
      field(['property', 'serviceChargeAnnual'], 'Annual service charge', 'property', 'money', 100, 'expert'),
      field(['property', 'councilTaxAnnual'], 'Annual council tax paid by owner', 'property', 'money', 100, 'expert'),
      field(['property', 'rentAnnual'], 'Annual gross rent at full occupancy', 'property', 'money', 500, 'expert'),
      field(['property', 'occupancyRate'], 'Rental occupancy', 'property', 'percent', 1, 'expert'),
      field(['property', 'managementRate'], 'Rental management fee', 'property', 'percent', 1, 'expert'),
      field(['property', 'acquisitionCostBasis'], 'Existing rental acquisition cost basis', 'property', 'money', 1000, 'expert'),
      field(['property', 'purchaseTaxOverride'], 'Manual purchase tax', 'property', 'money', 100, 'expert'),
    );
    if (profile.property.purchase) defs.push(
      field(['property', 'purchase', 'age'], 'Purchase age', 'property', 'age', 1, 'expert', undefined, 'your current age'),
      field(['property', 'purchase', 'price'], 'Purchase price', 'property', 'money', 1000, 'expert', undefined, 'the property value entered above'),
      field(['property', 'purchase', 'deposit'], 'Purchase deposit', 'property', 'money', 1000, 'expert', undefined, 'the property value less the mortgage balance entered above'),
      field(['property', 'purchase', 'transactionCosts'], 'Legal and other purchase costs (excluding tax)', 'property', 'money', 100, 'expert'),
    );
    if (profile.property.sale) defs.push(
      field(['property', 'sale', 'age'], 'Sale age', 'property', 'age', 1, 'expert', undefined, 'ten years after the purchase'),
      field(['property', 'sale', 'sellingCostRate'], 'Selling costs', 'property', 'percent', 0.1, 'expert'),
    );
    profile.property.rateChanges.forEach((_, i) => defs.push(
      field(['property', 'rateChanges', i, 'age'], `Refinance ${i + 1} age`, 'property', 'age', 1, 'expert'),
      field(['property', 'rateChanges', i, 'annualRate'], `Refinance ${i + 1} rate`, 'property', 'percent', .1, 'expert'),
    ));
  }

  profile.spending.phases.forEach((_, i) => {
    defs.push(
      field(['spending', 'phases', i, 'startAge'], `Phase ${i + 1} start age`, 'spending', 'age', 1, 'expert'),
      field(['spending', 'phases', i, 'endAge'], `Phase ${i + 1} end age`, 'spending', 'age', 1, 'expert'),
      field(['spending', 'phases', i, 'essentialMonthly'], `Phase ${i + 1} essential`, 'spending', 'monthlyMoney', 25, 'expert'),
      field(['spending', 'phases', i, 'discretionaryMonthly'], `Phase ${i + 1} discretionary`, 'spending', 'monthlyMoney', 25, 'expert'),
    );
  });
  profile.liquidity.capitalNeeds.forEach((_, i) => {
    defs.push(
      field(['liquidity', 'capitalNeeds', i, 'age'], `Capital need ${i + 1} age`, 'liquidity', 'age', 1, 'expert'),
      field(['liquidity', 'capitalNeeds', i, 'amount'], `Capital need ${i + 1} amount`, 'liquidity', 'money', 500, 'expert'),
    );
  });
  if (profile.spending.breakdown) {
    defs.push(
      field(['spending', 'breakdown', 'sharedMonthly'], 'Shared monthly', 'spending', 'monthlyMoney', 25, 'expert'),
      field(['spending', 'breakdown', 'perAdultMonthly'], 'Per adult monthly', 'spending', 'monthlyMoney', 25, 'expert'),
      field(['spending', 'breakdown', 'perChildMonthly'], 'Per child monthly', 'spending', 'monthlyMoney', 25, 'expert'),
    );
  }
  for (let row = 0; row < 5; row++) {
    for (let column = row + 1; column < 5; column++) {
      defs.push(field(['market', 'correlation', row, column],
        `${MARKET_VARIABLES[row]} / ${MARKET_VARIABLES[column]} log-shock correlation`, 'market', 'decimal', 0.05, 'expert'));
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

/**
 * The non-numeric inputs, described as data alongside the numeric ones.
 *
 * `select` and `checkbox` entries own their options here rather than inline in the form, so a tier
 * covers the whole editable surface. `text` is a free-text or read-only box. `editor` is a bespoke
 * composite (the correlation matrix, the phase list) whose own numeric fields are registered above
 * but which the form renders as one unit; registering the unit gives it a tier and a handle for
 * the "an error is never filtered away" rule.
 */
export type ChoiceControl = 'select' | 'checkbox' | 'text' | 'editor';

export interface ChoiceOption { value: string; label: string }

export interface ChoiceFieldDef {
  /** The dot-joined profile path the control writes, so an issue path can be matched against it. */
  id: string;
  label: string;
  group: FieldGroupId;
  control: ChoiceControl;
  tier: FieldTier;
  options?: readonly ChoiceOption[];
  help?: string;
  /** As on `ControlFieldDef`: where this control's starting state comes from, when it is worked out. */
  derivedFrom?: string;
}

const choice = (
  id: string, label: string, group: FieldGroupId, control: ChoiceControl, tier: FieldTier,
  extra: { options?: readonly ChoiceOption[]; help?: string; derivedFrom?: string } = {},
): ChoiceFieldDef => ({ id, label, group, control, tier, ...extra });

/** Controls that exist on every profile. Property controls are added by `choiceFieldsFor`. */
export const CHOICE_FIELDS: readonly ChoiceFieldDef[] = [
  choice('personal.taxRegion', 'Tax region', 'personal', 'select', 'essential', {
    options: [{ value: 'scotland', label: 'Scotland' }, { value: 'rest_of_uk', label: 'Rest of UK' }],
  }),
  choice('personal.taxYear', 'Tax year', 'personal', 'text', 'expert', {
    help: 'The only configured year. An unsupported year fails rather than silently falling back.',
  }),

  choice('pension.method', 'Contribution method', 'pension', 'select', 'common', {
    options: [
      { value: 'salary_sacrifice', label: 'Salary sacrifice' },
      { value: 'net_pay', label: 'Net pay' },
      { value: 'relief_at_source', label: 'Relief at source' },
    ],
  }),
  choice('pension.salarySacrificeAvailable', 'Salary sacrifice available', 'pension', 'checkbox', 'common'),
  choice('pension.sacrificeAddedBackForTaper', 'Sacrifice added back for the allowance taper', 'pension', 'checkbox', 'expert', {
    help: 'Post-8 July 2015 sacrifice is added back to threshold income.',
  }),
  choice('pension.moneyPurchaseAnnualAllowanceTriggered', 'Money purchase annual allowance triggered', 'pension', 'checkbox', 'expert'),

  choice('spending.breakdown', 'Break the current total down by household member', 'spending', 'checkbox', 'expert', {
    help: 'Optional. The household totals stay authoritative; the breakdown must reconcile to them.',
  }),
  choice('spending.phases', 'Spending phases', 'spending', 'editor', 'expert', {
    derivedFrom: 'no phases at all; a phase you add starts at your FIRE age, runs ten years and copies your retirement spending',
  }),

  choice('liquidity.capitalNeeds', 'Known capital needs', 'liquidity', 'editor', 'expert', {
    derivedFrom: 'no capital needs at all; one you add falls at your current age',
  }),

  choice('market.assumptionVersion', 'Assumption version', 'market', 'text', 'expert', {
    help: 'Recorded in the reproducibility metadata of every run.',
  }),
  choice('market.correlation', 'Correlation of Gaussian log-growth shocks', 'market', 'editor', 'expert'),

  choice('simulation.withdrawalOrder', 'Withdrawal order', 'simulation', 'editor', 'expert'),
];

/** Property controls only exist once a property does, mirroring `arrayFields`. */
export function choiceFieldsFor(profile: Profile): ChoiceFieldDef[] {
  const defs = [...CHOICE_FIELDS,
    choice('property', 'Include a property', 'property', 'checkbox', 'common', {
      derivedFrom: 'no property; turning it on seeds an illustrative purchase at your current age, which you are expected to replace with your own figures',
    })];
  if (!profile.property) return defs;
  defs.push(
    choice('property.use', 'Property use', 'property', 'select', 'common', {
      options: [{ value: 'owner_occupied', label: 'Owner occupied' }, { value: 'rental', label: 'Rental' }],
    }),
    choice('property.mortgageType', 'Mortgage type', 'property', 'select', 'common', {
      options: [
        { value: 'repayment', label: 'Repayment' },
        { value: 'interest_only', label: 'Interest only (balloon at term)' },
      ],
    }),
    choice('property.taxLocation', 'Property tax location', 'property', 'select', 'expert', {
      derivedFrom: 'the tax region you chose for yourself',
      options: [
        { value: 'scotland', label: 'Scotland (LBTT)' },
        { value: 'england_ni', label: 'England / Northern Ireland (SDLT)' },
        { value: 'manual', label: 'Wales / special case: enter tax manually' },
      ],
    }),
    choice('property.buyerStatus', 'Buyer status', 'property', 'select', 'expert', {
      options: [
        { value: 'standard', label: 'Standard / replacement main home' },
        { value: 'first_time', label: 'Eligible first-time owner occupier' },
        { value: 'additional', label: 'Additional dwelling' },
      ],
    }),
    choice('property.purchase', 'Plan a purchase (otherwise already owned)', 'property', 'checkbox', 'expert', {
      derivedFrom: 'a purchase at your current age, priced at the property value, with the equity in it as the deposit',
    }),
    choice('property.sale', 'Schedule a sale to release equity', 'property', 'checkbox', 'expert', {
      derivedFrom: 'a sale ten years after the purchase, or ten years from now for a property you already own',
    }),
    choice('property.rateChanges', 'Refinance rates', 'property', 'editor', 'expert', {
      derivedFrom: 'no refinancing; one you add falls five years after the last rate you set',
    }),
  );
  return defs;
}

/** Numeric fields owned by a composite editor rather than laid out in the plain field grid. */
const EDITOR_OWNED = new Set(['correlation', 'phases', 'capitalNeeds', 'breakdown', 'rateChanges']);

export const isGridField = (def: NumberFieldDef): boolean =>
  !def.path.some(part => typeof part === 'string' && EDITOR_OWNED.has(part));

const TIER_DEPTH: Record<FieldTier, number> = { essential: 0, common: 1, expert: 2 };
const MODE_DEPTH: Record<TierMode, number> = { essential: 0, common: 1, all: 2 };

export const tierInMode = (tier: FieldTier, mode: TierMode): boolean => TIER_DEPTH[tier] <= MODE_DEPTH[mode];

export const TIER_MODES: readonly { mode: TierMode; label: string }[] = [
  { mode: 'essential', label: 'Essential only' },
  { mode: 'common', label: 'Essential + common' },
  { mode: 'all', label: 'Everything' },
];

export const DEFAULT_TIER_MODE: TierMode = 'common';

/**
 * Registry ids an issue belongs to.
 *
 * An issue at `market.correlation.0.1` belongs both to that cell and to the matrix that owns it, so
 * matching on "the id, or the id followed by a dot" reaches the composite editor as well as the
 * individual field. This is what makes validation unfilterable: a forced id is shown whatever the
 * tier says.
 */
export function forcedFieldIds(issues: readonly FieldIssue[], ids: Iterable<string>): Set<string> {
  const forced = new Set<string>();
  for (const candidate of ids) {
    if (issues.some(issue => issue.path === candidate || issue.path.startsWith(`${candidate}.`))) {
      forced.add(candidate);
    }
  }
  return forced;
}

export interface Visibility {
  mode: TierMode;
  /** True when this registry entry must be rendered. */
  shows: (fieldId: string) => boolean;
  /** True when the group has anything to render, including a cross-field issue of its own. */
  showsGroup: (group: FieldGroupId) => boolean;
  /** Entries shown because of an issue rather than because of the tier. */
  forced: ReadonlySet<string>;
  /** Visible inputs: numeric grid fields plus selects, checkboxes and text boxes. */
  inputCount: number;
}

/**
 * Which registry entries a given depth shows. Display only: it reads the profile's validation
 * issues and the tiers, and never touches the profile, the drafts or the run key.
 */
export function fieldVisibility(
  mode: TierMode,
  numbers: readonly NumberFieldDef[],
  choices: readonly ChoiceFieldDef[],
  issues: readonly FieldIssue[] = [],
): Visibility {
  const entries = [
    ...numbers.map(def => ({ id: def.id, group: def.group, tier: def.tier, counts: isGridField(def) })),
    ...choices.map(def => ({ id: def.id, group: def.group, tier: def.tier, counts: def.control !== 'editor' })),
  ];
  const forced = forcedFieldIds(issues, entries.map(entry => entry.id));
  const shown = entries.filter(entry => forced.has(entry.id) || tierInMode(entry.tier, mode));
  const shownIds = new Set(shown.map(entry => entry.id));
  const groups = new Set<FieldGroupId>(shown.map(entry => entry.group));
  for (const issue of issues) if (issue.group !== null) groups.add(issue.group);
  return {
    mode,
    shows: (fieldId: string) => shownIds.has(fieldId),
    showsGroup: (group: FieldGroupId) => groups.has(group),
    forced,
    inputCount: shown.filter(entry => entry.counts).length,
  };
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

export const MARGINAL_AMOUNT_FIELD: ControlFieldDef = {
  id: 'marginal.amount', label: 'One-off increment', kind: 'money', step: 100,
  help: 'Applied once in the current model year; existing after-tax cash is transferred, not added.',
};
/** Spec section 62's income-uplift bands. The spending cases are profile fields already. */
export const SCENARIO_SALARY_FIELDS: readonly ControlFieldDef[] = [55_000, 65_000, 75_000, 90_000, 120_000]
  .map((_, index): ControlFieldDef => ({
    id: `scenario.salary${index + 1}`, label: `Salary band ${index + 1}`, kind: 'money', step: 1000,
    ...(index === 0 ? { help: 'The five gross salaries the matrix compares. Every band runs the complete model at the entered seed and path count.' } : {}),
  }));
export const SCENARIO_SALARY_DEFAULTS: readonly number[] = [55_000, 65_000, 75_000, 90_000, 120_000];

export const SCENARIO_PREVIEW_FIELD: ControlFieldDef = {
  id: 'scenario.previewPaths', label: 'Preview paths', kind: 'integer', step: 100,
  help: 'Only used when you explicitly ask for a preview. A preview is labelled as one and is never presented as a full-count result.',
};
export const SCENARIO_FIRE_FROM_FIELD: ControlFieldDef = {
  id: 'scenario.fireFromAge', label: 'FIRE age search from', kind: 'age', step: 1,
  help: 'Every whole age in the range is another complete simulation for every cell.',
};
export const SCENARIO_FIRE_TO_FIELD: ControlFieldDef = {
  id: 'scenario.fireToAge', label: 'FIRE age search to', kind: 'age', step: 1,
};

export const MARGINAL_DEBT_FIELD: ControlFieldDef = {
  id: 'marginal.maximumDebt', label: 'Maximum acceptable debt, today', kind: 'money', step: 1000,
  help: 'A hard ceiling across every sampled path. Enter the debt exposure you accept.',
};

export const STRESS_AGE_FIELD: ControlFieldDef = {
  id: 'attribution.stressAge', label: 'Stress start age', kind: 'age', step: 1,
  help: 'Each shock starts in [age, age + 1). Multi-year stresses stop at the horizon. Choose a working age to test lost salary.',
};
