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
  /**
   * The name a reader who is not a finance person recognises, with the technical term kept once in
   * parentheses so an advanced reader can still map it back to the spec. When it is present it
   * *replaces* `label` on screen rather than sitting beside it: showing both says the same thing
   * twice. `label` stays the short internal name the handoffs and harnesses refer to.
   */
  plainLabel?: string;
  /**
   * What this input means, in ordinary words. Rendered before `help`, which explains the modelling
   * convention rather than the concept — plain sentence first, precise sentence second.
   */
  plainHelp?: string;
  /** Glossary terms this entry's wording relies on (`glossary.ts` ids). */
  terms?: readonly string[];
}

export interface NumberFieldDef extends ControlFieldDef {
  group: FieldGroupId;
  /** Dot-joined path into `Profile`; it is also this field's id. */
  path: readonly (string | number)[];
  tier: FieldTier;
}

/** What a control is called on screen. Everything user-facing goes through this, never `label`. */
export const fieldName = (def: { label: string; plainLabel?: string }): string => def.plainLabel ?? def.label;

const id = (path: readonly (string | number)[]): string => path.join('.');

/** The optional half of a registry entry, passed by name so a long tail of `undefined` never appears. */
interface FieldExtra {
  help?: string;
  derivedFrom?: string;
  plainLabel?: string;
  plainHelp?: string;
  terms?: readonly string[];
}

function field(
  path: readonly (string | number)[], label: string, group: FieldGroupId, kind: FieldKind,
  step: number, tier: FieldTier, extra: FieldExtra = {},
): NumberFieldDef {
  return { id: id(path), label, group, path, kind, step, tier, ...extra };
}

const ASSET_HELP = 'Balance today, in today’s money.';

/** Scalar numeric fields. Array-backed fields are generated per profile by `arrayFields`. */
export const NUMBER_FIELDS: readonly NumberFieldDef[] = [
  field(['personal', 'currentAge'], 'Current age', 'personal', 'age', 1, 'essential', {
    plainHelp: 'How old you are now. Everything in the projection is counted forward from here.',
  }),
  field(['personal', 'targetFireAge'], 'Target FIRE age', 'personal', 'age', 1, 'essential', {
    plainLabel: 'Age you want to stop needing a salary (target FIRE age)',
    plainHelp: 'The age from which the plan stops assuming you earn and starts paying for your life out of what you have saved. If you are not sure, leave it and see what the model says.',
    help: 'Retirement starts here; it must be at or after the current age and before the end age.',
    terms: ['fire', 'bridge-period'],
  }),
  field(['personal', 'endAge'], 'Simulation end age', 'personal', 'age', 1, 'common', {
    plainLabel: 'Age the projection stops (end age)',
    plainHelp: 'How far ahead to model. Your money has to last to this age for a run to count as a success, so setting it later is a stricter test, not an optimistic one.',
  }),
  field(['personal', 'targetSuccessProbability'], 'Target success probability', 'personal', 'percent', 1, 'common', {
    plainLabel: 'How often the plan must work (target success probability)',
    plainHelp: 'The bar you want to clear: 90% means you are content with a plan that paid for your life in nine of every ten simulated futures. It is your own standard, and changing it does not change any result — only whether the result passes.',
    help: 'The bar the plan is judged against. It does not change the simulation.',
    terms: ['success-probability', 'monte-carlo'],
  }),

  field(['income', 'salaryAnnual'], 'Gross salary', 'income', 'money', 500, 'essential', {
    plainHelp: 'Your pay for a year before tax, National Insurance and pension contributions come out — the figure on your contract, not what lands in your bank.',
  }),
  field(['income', 'bonusAnnual'], 'Bonus', 'income', 'money', 500, 'common', {
    plainHelp: 'A typical year’s bonus before tax. Leave it at zero if you do not get one, or if it is too unpredictable to plan around.',
    help: 'Taxed as employment income; not pensionable by default.',
  }),
  field(['income', 'otherNonSavingsAnnual'], 'Other non-savings income', 'income', 'money', 250, 'common', {
    plainLabel: 'Other earned or taxed income (non-savings income)',
    plainHelp: 'Anything else taxed like a wage rather than as interest or dividends: freelance work, a second job, a private pension already in payment.',
  }),
  field(['income', 'salaryGrowthReal'], 'Real salary growth', 'income', 'percent', 0.1, 'common', {
    plainLabel: 'Pay rises above inflation (real salary growth)',
    plainHelp: 'How much your pay grows each year over and above rising prices. 1% means you get a little better off every year; 0% means your pay keeps pace with prices and no more.',
    help: 'Above inflation. Nominal salary compounds this and inflation together.',
    terms: ['todays-money'],
  }),
  field(['income', 'retirementEmploymentAnnual'], 'Post-FIRE employment income', 'income', 'money', 250, 'expert', {
    plainLabel: 'Work income after you stop full-time work (post-FIRE employment income)',
    plainHelp: 'Any pay you still expect after your FIRE age — part-time or occasional work.',
    help: 'Paid from the FIRE age onwards. Not pensionable.',
    terms: ['fire'],
  }),
  field(['income', 'statePensionAnnual'], 'State pension', 'income', 'money', 250, 'common', {
    plainHelp: 'The yearly state pension you expect, in today’s money. Your forecast on gov.uk is the figure to use; the model does not estimate it for you.',
    terms: ['state-pension', 'todays-money'],
  }),
  field(['income', 'statePensionAge'], 'State pension age', 'income', 'age', 1, 'common', {
    plainHelp: 'The age the state pension starts being paid to you. It is set by your date of birth, not chosen.',
    help: 'National Insurance also moves to category C from this age.',
    terms: ['state-pension'],
  }),

  field(['household', 'adults'], 'Adults', 'household', 'integer', 1, 'expert', {
    plainHelp: 'How many adults the spending totals cover. It is used only to divide a breakdown back up; it never multiplies your totals.',
  }),
  field(['household', 'children'], 'Children', 'household', 'integer', 1, 'expert', {
    plainHelp: 'How many children the spending totals cover, used the same way as the adult count.',
  }),

  field(['spending', 'current', 'essentialMonthly'], 'Current essential', 'spending', 'monthlyMoney', 25, 'essential', {
    plainLabel: 'What you must spend each month now',
    plainHelp: 'Rent or mortgage, bills, food, transport, insurance — the things you would still be paying in a bad year. This is the figure a run has to fund every year to count as a success.',
  }),
  field(['spending', 'current', 'discretionaryMonthly'], 'Current discretionary', 'spending', 'monthlyMoney', 25, 'essential', {
    plainLabel: 'What you choose to spend each month now',
    plainHelp: 'Holidays, eating out, hobbies, gifts — everything above the essentials. Keeping it separate lets the model ask what happens if only the essentials are covered.',
  }),
  field(['spending', 'retirement', 'essentialMonthly'], 'Retirement essential', 'spending', 'monthlyMoney', 25, 'essential', {
    plainLabel: 'What you must spend each month once you stop working',
    plainHelp: 'The same essentials, as you expect them to look after you stop working — commuting may go, health costs may come.',
    derivedFrom: 'the same as current essential spending, on the assumption that retirement costs what today costs',
  }),
  field(['spending', 'retirement', 'discretionaryMonthly'], 'Retirement discretionary', 'spending', 'monthlyMoney', 25, 'essential', {
    plainLabel: 'What you choose to spend each month once you stop working',
    plainHelp: 'The life you want to be able to afford then, above the essentials. This plus the essentials is the target the plan is built to fund.',
    derivedFrom: 'the same as current discretionary spending, on the assumption that retirement costs what today costs',
  }),
  field(['spending', 'retirementFloorAnnual'], 'Retirement floor (annual)', 'spending', 'money', 250, 'expert', {
    plainLabel: 'The least you could live on for a year (floor)',
    plainHelp: 'A separate, leaner run of the whole plan: what happens if you had to cut back to this. It is not a cut the model applies part-way through a bad year — spending is fixed inside a run.',
    help: 'The “floor” run. Must be at or below the target total.',
    derivedFrom: 'twelve months of the starter’s current essential spending, with no discretionary spending at all',
  }),
  field(['spending', 'retirementComfortAnnual'], 'Retirement comfort (annual)', 'spending', 'money', 250, 'expert', {
    plainLabel: 'A comfortable year’s spending (comfort)',
    plainHelp: 'The more generous version of the same plan, run separately so you can see what the extra costs in success probability.',
    help: 'The “comfort” run. Must be at or above the target total.',
    derivedFrom: 'twelve months of the starter’s high spending case',
    terms: ['success-probability'],
  }),
  field(['spending', 'currentRentMonthlyIncluded'], 'Rent already inside current spending', 'spending', 'monthlyMoney', 25, 'common', {
    plainHelp: 'How much of the monthly spending you entered above is rent. The model needs it separately so that buying a home removes the rent instead of charging you for both.',
    help: 'Included rent component in your spending schedules. Removed once during owner occupation; restored on sale.',
  }),
  field(['spending', 'lifestyleCreepRate'], 'Lifestyle creep on real pay rises', 'spending', 'percent', 1, 'common', {
    plainLabel: 'How much of a pay rise you spend (lifestyle creep)',
    plainHelp: 'When your pay goes up faster than prices, this is the share of the extra that becomes spending rather than saving. 0% means every real pay rise is saved; 100% means none of it is.',
    help: 'Share of each real salary increase that becomes discretionary spending.',
  }),
  field(['spending', 'scenarioMonthly', 'low'], 'Low spending case', 'spending', 'monthlyMoney', 25, 'expert', {
    plainHelp: 'The leanest of three monthly spending levels the scenario grid compares.',
    derivedFrom: 'the starter’s current essential spending on its own',
  }),
  field(['spending', 'scenarioMonthly', 'base'], 'Base spending case', 'spending', 'monthlyMoney', 25, 'expert', {
    plainHelp: 'The middle spending level in the scenario grid.',
    derivedFrom: 'the starter’s current essential and discretionary spending added together',
  }),
  field(['spending', 'scenarioMonthly', 'high'], 'High spending case', 'spending', 'monthlyMoney', 25, 'expert', {
    plainHelp: 'The most generous spending level in the scenario grid.',
  }),

  field(['assets', 'cash'], 'Cash', 'assets', 'money', 500, 'essential', {
    plainHelp: 'Money in current and savings accounts today. It is the account bills are actually settled from.',
    help: ASSET_HELP,
    terms: ['emergency-fund'],
  }),
  field(['assets', 'isa'], 'ISA', 'assets', 'money', 500, 'essential', {
    plainLabel: 'ISA savings and investments',
    plainHelp: 'What you hold in ISAs today. Nothing inside an ISA is taxed, and you can take it out at any age, which makes it the first place retirement spending is drawn from before a pension unlocks.',
    help: ASSET_HELP,
    terms: ['isa', 'bridge-period'],
  }),
  field(['assets', 'gia', 'marketValue'], 'GIA market value', 'assets', 'money', 500, 'common', {
    plainLabel: 'Investments outside an ISA or pension (GIA) — value today',
    plainHelp: 'Investments held in an ordinary account, with no tax shelter around them. What they are worth today.',
    help: ASSET_HELP,
    terms: ['gia', 'isa'],
  }),
  field(['assets', 'gia', 'costBasis'], 'GIA cost basis', 'assets', 'money', 500, 'expert', {
    plainLabel: 'What those investments originally cost (cost basis)',
    plainHelp: 'What you paid for them. Tax on selling is charged on the difference between what you get and what you paid, so the model cannot work out the bill without it.',
    help: 'May legitimately exceed market value.',
    derivedFrom: 'the GIA market value, which assumes the holding shows neither a gain nor a loss yet',
    terms: ['cost-basis', 'gia'],
  }),
  field(['assets', 'gia', 'carriedLosses'], 'GIA carried losses', 'assets', 'money', 100, 'expert', {
    plainHelp: 'Losses you have already reported and can set against future gains.',
    terms: ['cost-basis'],
  }),
  field(['assets', 'pension'], 'Workplace pension', 'assets', 'money', 500, 'essential', {
    plainHelp: 'The total in pensions arranged through an employer, now. You cannot touch it before the pension access age, so it does nothing for the years before that.',
    help: ASSET_HELP,
    terms: ['bridge-period', 'drawdown'],
  }),
  field(['assets', 'sipp'], 'SIPP', 'assets', 'money', 500, 'common', {
    plainLabel: 'Personal pension you run yourself (SIPP)',
    plainHelp: 'Pension money in a plan you opened rather than your employer. The same access rules apply as to a workplace pension.',
    help: 'Tracked separately from the workplace pension.',
    terms: ['sipp'],
  }),
  field(['assets', 'pensionTaxFreeCashUsed'], 'Lifetime lump sum already taken', 'assets', 'money', 500, 'expert', {
    plainHelp: 'Tax-free pension cash you have already taken, which counts against the lifetime limit on it.',
    terms: ['drawdown'],
  }),

  field(['pension', 'employeeRate'], 'Employee contribution', 'pension', 'percent', 0.5, 'essential', {
    plainHelp: 'The share of your pay you put into your pension each month. It is taken before or after tax depending on the method below, and it is the figure an employer match is measured against.',
    terms: ['annual-allowance'],
  }),
  field(['pension', 'employerRate'], 'Employer contribution', 'pension', 'percent', 0.5, 'essential', {
    plainHelp: 'The share of your pay your employer puts in regardless of what you do. Any match is added on top of this.',
  }),
  field(['pension', 'matchUpToRate'], 'Employer matches up to', 'pension', 'percent', 0.5, 'common', {
    plainHelp: 'Many employers add extra if you do — but only up to a limit. This is that limit, as a share of your pay. Contributing above it does not earn more match.',
    help: 'Match = pensionable pay × min(employee rate, this) × match multiple. Added on top of the employer rate.',
  }),
  field(['pension', 'matchRate'], 'Match multiple', 'pension', 'multiple', 0.25, 'common', {
    plainLabel: 'How much the employer adds per £1 (match multiple)',
    plainHelp: '1 means they put in a pound for every pound of yours they match; 0.5 means fifty pence.',
    help: '1 means pound for pound.',
  }),
  field(['pension', 'employerNiSharebackRate'], 'Employer NI shareback', 'pension', 'percent', 1, 'expert', {
    plainLabel: 'Share of the employer’s NI saving passed on (NI shareback)',
    plainHelp: 'Under salary sacrifice the employer saves National Insurance too. Some pass part of that saving into your pension; this is how much of it, if your employer does.',
    help: 'Share of the employer’s NI saving added to the pension under salary sacrifice.',
    terms: ['salary-sacrifice'],
  }),
  field(['pension', 'accessAge'], 'Pension access age', 'pension', 'age', 1, 'common', {
    plainHelp: 'The earliest age you can take money out of a pension. Before it, pension wealth cannot pay for anything, however large it is — that is what makes the years between stopping work and this age the hard part of an early plan.',
    help: 'Nothing in the pension can fund spending before this age.',
    terms: ['bridge-period', 'accessible-wealth'],
  }),
  field(['pension', 'carryForwardAllowance'], 'Verified carry-forward allowance', 'pension', 'money', 1000, 'expert', {
    plainHelp: 'Unused pension allowance from earlier years that you have already checked you are entitled to. The model never infers it, because the record it would need is not here.',
    help: 'Entered explicitly; no historical eligibility is inferred.',
    terms: ['annual-allowance'],
  }),

  field(['isa', 'allowanceUsed'], 'ISA allowance already used this year', 'wrappers', 'money', 500, 'expert', {
    plainHelp: 'How much of this tax year’s ISA limit you have already paid in, so the model does not assume the whole allowance is still free.',
    terms: ['isa'],
  }),
  field(['gia', 'dividendYield'], 'GIA dividend yield', 'wrappers', 'percent', 0.1, 'expert', {
    plainHelp: 'The share of the holding paid out as dividends each year. Outside a tax shelter those are taxed in the year they are paid, whether or not you spend them.',
    help: 'Taxed each year and added to the GIA cost basis as accumulated units.',
    terms: ['gia', 'cost-basis'],
  }),
  field(['gia', 'turnoverRate'], 'GIA turnover', 'wrappers', 'percent', 1, 'expert', {
    plainHelp: 'How much of the holding is sold and bought back each year — by a fund manager rebalancing, or by you. Selling is what turns a paper gain into a taxable one.',
    help: 'Share of the holding sold and rebought each year.',
    terms: ['gia', 'cost-basis'],
  }),
  field(['gia', 'gainRealisationRate'], 'Share of turnover gain realised', 'wrappers', 'percent', 1, 'expert', {
    plainHelp: 'Of what gets sold, how much of the gain actually counts as realised for tax.',
    terms: ['cost-basis'],
  }),

  field(['liquidity', 'emergencyFundMonths'], 'Emergency reserve (months of essentials)', 'liquidity', 'decimal', 1, 'common', {
    plainHelp: 'How many months of essential spending to keep in cash for the unexpected. Six means the plan tries to hold six months of essentials before investing the rest.',
    terms: ['emergency-fund'],
  }),
  field(['liquidity', 'minimumLiquidYears'], 'Minimum liquid years', 'liquidity', 'decimal', 0.5, 'expert', {
    plainHelp: 'How many years of spending you want reachable without touching a pension. It is reported as a check each year, not enforced.',
    help: 'Reported as a coverage check each year; it does not force a reallocation.',
    terms: ['accessible-wealth'],
  }),

  field(['portfolios', 'isa', 'equities'], 'ISA equities', 'portfolios', 'percent', 1, 'expert', {
    plainHelp: 'The share of your ISA held in shares. The three ISA figures are one split and must add to 100%.',
    terms: ['equities', 'isa'],
  }),
  field(['portfolios', 'isa', 'bonds'], 'ISA bonds', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'isa', 'cash'], 'ISA cash', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'gia', 'equities'], 'GIA equities', 'portfolios', 'percent', 1, 'expert', {
    plainHelp: 'The share of your ordinary investment account held in shares.',
    terms: ['equities', 'gia'],
  }),
  field(['portfolios', 'gia', 'bonds'], 'GIA bonds', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'gia', 'cash'], 'GIA cash', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'pension', 'equities'], 'Pension equities', 'portfolios', 'percent', 1, 'expert', {
    plainHelp: 'The share of your pensions held in shares.',
    terms: ['equities'],
  }),
  field(['portfolios', 'pension', 'bonds'], 'Pension bonds', 'portfolios', 'percent', 1, 'expert'),
  field(['portfolios', 'pension', 'cash'], 'Pension cash', 'portfolios', 'percent', 1, 'expert'),

  field(['market', 'equities', 'meanNominal'], 'Equities mean return', 'market', 'percent', 0.1, 'expert', {
    plainHelp: 'The average yearly return you assume for shares, before inflation is taken off. It is an assumption you are making, not a forecast the app is offering.',
    terms: ['equities'],
  }),
  field(['market', 'equities', 'volatility'], 'Equities volatility', 'market', 'percent', 0.1, 'expert', {
    plainHelp: 'How far share returns swing around that average from year to year. It is what makes the range of outcomes wide.',
    terms: ['volatility'],
  }),
  field(['market', 'bonds', 'meanNominal'], 'Bonds mean return', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'bonds', 'volatility'], 'Bonds volatility', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'cash', 'meanNominal'], 'Cash mean return', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'cash', 'volatility'], 'Cash volatility', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'property', 'meanNominal'], 'Property mean return', 'market', 'percent', 0.1, 'expert', {
    help: 'Annual value growth while the property is owned.',
  }),
  field(['market', 'property', 'volatility'], 'Property volatility', 'market', 'percent', 0.1, 'expert'),
  field(['market', 'inflation', 'mean'], 'Inflation mean', 'market', 'percent', 0.1, 'expert', {
    plainHelp: 'The average yearly rise in prices you assume. Every result is converted back into today’s money using each future’s own inflation.',
    terms: ['inflation-index', 'todays-money'],
  }),
  field(['market', 'inflation', 'volatility'], 'Inflation volatility', 'market', 'percent', 0.1, 'expert'),

  field(['simulation', 'count'], 'Simulation paths', 'simulation', 'integer', 1000, 'expert', {
    plainLabel: 'How many futures to simulate (paths)',
    plainHelp: 'Each path is one complete run of your whole life under one randomly drawn sequence of markets. More paths means a more precise probability and a longer wait.',
    help: 'The default is 10,000. The count is never reduced to fit a time budget.',
    terms: ['monte-carlo', 'standard-error'],
  }),
  field(['simulation', 'seed'], 'Random seed', 'simulation', 'integer', 1, 'expert', {
    plainHelp: 'The starting point for the randomness. The same seed gives the same set of futures every time, which is what makes two plans comparable rather than merely different.',
    help: 'Path streams depend on the seed and path index only, never on scenario decisions.',
    terms: ['monte-carlo'],
  }),
  field(['simulation', 'referenceWithdrawalRate'], 'Reference withdrawal rate', 'simulation', 'percent', 0.1, 'expert', {
    plainLabel: 'Rate behind the rule-of-thumb FIRE number (reference withdrawal rate)',
    plainHelp: 'Used for one piece of arithmetic only — yearly spending divided by this rate — as a landmark. It says nothing about tax or bad market years, and your plan is judged on the success probability instead.',
    help: 'Used only for the reference FIRE number. It is not the safety result.',
    terms: ['withdrawal-rate', 'success-probability'],
  }),
];

export const MARKET_VARIABLES = ['equities', 'bonds', 'cash', 'property', 'inflation'] as const;
export type MarketVariable = typeof MARKET_VARIABLES[number];

/** Fields whose path contains an array index, so they depend on the profile's current shape. */
export function arrayFields(profile: Profile): NumberFieldDef[] {
  const defs: NumberFieldDef[] = [];
  if (profile.property) {
    defs.push(
      field(['property', 'marketValue'], 'Existing property value', 'property', 'money', 1000, 'common', {
        plainHelp: 'What the property would sell for today.',
      }),
      field(['property', 'mortgageBalance'], 'Existing mortgage balance', 'property', 'money', 1000, 'common', {
        plainHelp: 'How much is still owed on the mortgage today.',
      }),
      field(['property', 'mortgageAnnualRate'], 'Mortgage annual rate', 'property', 'percent', 0.1, 'common', {
        plainHelp: 'The interest rate you pay now. Add a refinance below if you expect it to change.',
      }),
      field(['property', 'mortgageTermYears'], 'Remaining mortgage term (years)', 'property', 'integer', 1, 'common', {
        plainHelp: 'How many years are left until the mortgage is paid off.',
      }),
      field(['property', 'maintenanceAnnual'], 'Annual maintenance', 'property', 'money', 100, 'expert', {
        plainHelp: 'What upkeep costs you in a typical year.',
      }),
      field(['property', 'insuranceAnnual'], 'Annual insurance', 'property', 'money', 50, 'expert'),
      field(['property', 'serviceChargeAnnual'], 'Annual service charge', 'property', 'money', 100, 'expert'),
      field(['property', 'councilTaxAnnual'], 'Annual council tax paid by owner', 'property', 'money', 100, 'expert'),
      field(['property', 'rentAnnual'], 'Annual gross rent at full occupancy', 'property', 'money', 500, 'expert', {
        plainHelp: 'The rent a full year would bring in before costs and before any empty months.',
      }),
      field(['property', 'occupancyRate'], 'Rental occupancy', 'property', 'percent', 1, 'expert', {
        plainHelp: 'The share of the year you expect it to be let.',
      }),
      field(['property', 'managementRate'], 'Rental management fee', 'property', 'percent', 1, 'expert'),
      field(['property', 'acquisitionCostBasis'], 'Existing rental acquisition cost basis', 'property', 'money', 1000, 'expert', {
        plainHelp: 'What you originally paid for it, which is what a gain on selling is measured against.',
        terms: ['cost-basis'],
      }),
      field(['property', 'purchaseTaxOverride'], 'Manual purchase tax', 'property', 'money', 100, 'expert'),
    );
    if (profile.property.purchase) defs.push(
      field(['property', 'purchase', 'age'], 'Purchase age', 'property', 'age', 1, 'expert', { derivedFrom: 'your current age' }),
      field(['property', 'purchase', 'price'], 'Purchase price', 'property', 'money', 1000, 'expert', { derivedFrom: 'the property value entered above' }),
      field(['property', 'purchase', 'deposit'], 'Purchase deposit', 'property', 'money', 1000, 'expert', { derivedFrom: 'the property value less the mortgage balance entered above' }),
      field(['property', 'purchase', 'transactionCosts'], 'Legal and other purchase costs (excluding tax)', 'property', 'money', 100, 'expert'),
    );
    if (profile.property.sale) defs.push(
      field(['property', 'sale', 'age'], 'Sale age', 'property', 'age', 1, 'expert', { derivedFrom: 'ten years after the purchase' }),
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
      field(['spending', 'breakdown', 'sharedMonthly'], 'Shared monthly', 'spending', 'monthlyMoney', 25, 'expert', {
        plainHelp: 'Spending the whole household shares, such as rent and heating.',
      }),
      field(['spending', 'breakdown', 'perAdultMonthly'], 'Per adult monthly', 'spending', 'monthlyMoney', 25, 'expert'),
      field(['spending', 'breakdown', 'perChildMonthly'], 'Per child monthly', 'spending', 'monthlyMoney', 25, 'expert'),
    );
  }
  for (let row = 0; row < 5; row++) {
    for (let column = row + 1; column < 5; column++) {
      defs.push(field(['market', 'correlation', row, column],
        `${MARKET_VARIABLES[row]} / ${MARKET_VARIABLES[column]} log-shock correlation`, 'market', 'decimal', 0.05, 'expert',
        { terms: ['correlation'] }));
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
  /** As on `ControlFieldDef`: the plain name, the plain explanation, and the terms they lean on. */
  plainLabel?: string;
  plainHelp?: string;
  terms?: readonly string[];
}

const choice = (
  id: string, label: string, group: FieldGroupId, control: ChoiceControl, tier: FieldTier,
  extra: {
    options?: readonly ChoiceOption[]; help?: string; derivedFrom?: string;
    plainLabel?: string; plainHelp?: string; terms?: readonly string[];
  } = {},
): ChoiceFieldDef => ({ id, label, group, control, tier, ...extra });

/** Controls that exist on every profile. Property controls are added by `choiceFieldsFor`. */
export const CHOICE_FIELDS: readonly ChoiceFieldDef[] = [
  choice('personal.taxRegion', 'Tax region', 'personal', 'select', 'essential', {
    plainHelp: 'Where you pay income tax. Scotland has its own rates and bands, so the answer changes your tax bill and every figure downstream of it.',
    options: [{ value: 'scotland', label: 'Scotland' }, { value: 'rest_of_uk', label: 'Rest of UK' }],
  }),
  choice('personal.taxYear', 'Tax year', 'personal', 'text', 'expert', {
    plainHelp: 'The tax rules the model uses. Only one year is configured, and it is held constant in real terms for the whole projection.',
    help: 'The only configured year. An unsupported year fails rather than silently falling back.',
  }),

  choice('pension.method', 'Contribution method', 'pension', 'select', 'common', {
    plainLabel: 'How your pension contributions are taken',
    plainHelp: 'Salary sacrifice gives up gross pay and saves National Insurance as well as income tax. Net pay takes the contribution before income tax is worked out. Relief at source takes it from your pay after tax and the provider claims basic-rate relief back. Your payslip or HR will say which.',
    terms: ['salary-sacrifice'],
    options: [
      { value: 'salary_sacrifice', label: 'Salary sacrifice' },
      { value: 'net_pay', label: 'Net pay' },
      { value: 'relief_at_source', label: 'Relief at source' },
    ],
  }),
  choice('pension.salarySacrificeAvailable', 'Salary sacrifice available', 'pension', 'checkbox', 'common', {
    plainLabel: 'My employer offers salary sacrifice',
    plainHelp: 'Only tick this if your employer actually runs a sacrifice scheme. It is their arrangement, not something you can choose alone.',
    terms: ['salary-sacrifice'],
  }),
  choice('pension.sacrificeAddedBackForTaper', 'Sacrifice added back for the allowance taper', 'pension', 'checkbox', 'expert', {
    plainHelp: 'For high earners, whether sacrificed pay still counts as income when the pension allowance is tapered. It depends on when the arrangement started.',
    help: 'Post-8 July 2015 sacrifice is added back to threshold income.',
    terms: ['taper', 'annual-allowance'],
  }),
  choice('pension.moneyPurchaseAnnualAllowanceTriggered', 'Money purchase annual allowance triggered', 'pension', 'checkbox', 'expert', {
    plainLabel: 'I have already taken flexible pension income (MPAA triggered)',
    plainHelp: 'Taking taxable income flexibly from a pension permanently cuts how much you may pay in each year. Tick it if that has already happened.',
    terms: ['mpaa', 'annual-allowance'],
  }),

  choice('spending.breakdown', 'Break the current total down by household member', 'spending', 'checkbox', 'expert', {
    plainHelp: 'Optional. Splits your monthly total into shared, per-adult and per-child parts. The total stays the figure the model uses, so the parts have to add back up to it.',
    help: 'Optional. The household totals stay authoritative; the breakdown must reconcile to them.',
  }),
  choice('spending.phases', 'Spending phases', 'spending', 'editor', 'expert', {
    plainHelp: 'For years that cost differently from the rest — school fees until a certain age, or more travel in the first decade after stopping work. A phase overrides the normal schedule for the ages it covers.',
    derivedFrom: 'no phases at all; a phase you add starts at your FIRE age, runs ten years and copies your retirement spending',
  }),

  choice('liquidity.capitalNeeds', 'Known capital needs', 'liquidity', 'editor', 'expert', {
    plainLabel: 'Big one-off costs you already know about',
    plainHelp: 'A new roof, a car, a wedding: a single amount due at a particular age. Living costs come first if both cannot be paid in the same year.',
    derivedFrom: 'no capital needs at all; one you add falls at your current age',
  }),

  choice('market.assumptionVersion', 'Assumption version', 'market', 'text', 'expert', {
    plainHelp: 'A label for this set of market assumptions, so a result can be traced back to what produced it.',
    help: 'Recorded in the reproducibility metadata of every run.',
  }),
  choice('market.correlation', 'Correlation of Gaussian log-growth shocks', 'market', 'editor', 'expert', {
    plainLabel: 'How the markets move together (correlation)',
    plainHelp: 'Whether shares, bonds, cash, property and inflation tend to rise and fall together. It matters because things that fall together protect you less than their separate swings suggest.',
    terms: ['correlation', 'volatility'],
  }),

  choice('simulation.withdrawalOrder', 'Withdrawal order', 'simulation', 'editor', 'expert', {
    plainLabel: 'Which account to spend from first (withdrawal order)',
    plainHelp: 'When spending exceeds income, the model empties accounts in this order. It is fixed for the whole projection and applied every year.',
    terms: ['isa', 'gia', 'drawdown'],
  }),
];

/** Property controls only exist once a property does, mirroring `arrayFields`. */
export function choiceFieldsFor(profile: Profile): ChoiceFieldDef[] {
  const defs = [...CHOICE_FIELDS,
    choice('property', 'Include a property', 'property', 'checkbox', 'common', {
      plainLabel: 'Include a home or rental property in the plan',
      plainHelp: 'Turn this on to model a property you own or plan to buy, with its mortgage and running costs. The figures it starts with are an illustration and are meant to be replaced with yours.',
      derivedFrom: 'no property; turning it on seeds an illustrative purchase at your current age, which you are expected to replace with your own figures',
    })];
  if (!profile.property) return defs;
  defs.push(
    choice('property.use', 'Property use', 'property', 'select', 'common', {
      plainLabel: 'Do you live in it, or let it out?',
      plainHelp: 'Living in it removes the rent from your spending. Letting it out brings in rental income, which is taxed.',
      options: [{ value: 'owner_occupied', label: 'Owner occupied' }, { value: 'rental', label: 'Rental' }],
    }),
    choice('property.mortgageType', 'Mortgage type', 'property', 'select', 'common', {
      plainHelp: 'A repayment mortgage clears itself over the term. An interest-only one leaves the whole balance owed at the end, and the model makes you face that bill.',
      options: [
        { value: 'repayment', label: 'Repayment' },
        { value: 'interest_only', label: 'Interest only (balloon at term)' },
      ],
    }),
    choice('property.taxLocation', 'Property tax location', 'property', 'select', 'expert', {
      plainHelp: 'Purchase tax depends on where the property is, not on where you pay income tax.',
      derivedFrom: 'the tax region you chose for yourself',
      options: [
        { value: 'scotland', label: 'Scotland (LBTT)' },
        { value: 'england_ni', label: 'England / Northern Ireland (SDLT)' },
        { value: 'manual', label: 'Wales / special case: enter tax manually' },
      ],
    }),
    choice('property.buyerStatus', 'Buyer status', 'property', 'select', 'expert', {
      plainHelp: 'Whether this is your only home, your first, or an extra one. Each is taxed differently on purchase, and the choice is yours to assert — the app cannot check it.',
      options: [
        { value: 'standard', label: 'Standard / replacement main home' },
        { value: 'first_time', label: 'Eligible first-time owner occupier' },
        { value: 'additional', label: 'Additional dwelling' },
      ],
    }),
    choice('property.purchase', 'Plan a purchase (otherwise already owned)', 'property', 'checkbox', 'expert', {
      plainHelp: 'Tick this to buy at a future age. Leave it clear for a property you already own, and enter its value and mortgage instead.',
      derivedFrom: 'a purchase at your current age, priced at the property value, with the equity in it as the deposit',
    }),
    choice('property.sale', 'Schedule a sale to release equity', 'property', 'checkbox', 'expert', {
      plainHelp: 'Sell at a chosen age and turn the equity into money you can spend. Nothing is sold automatically to rescue a plan.',
      derivedFrom: 'a sale ten years after the purchase, or ten years from now for a property you already own',
    }),
    choice('property.rateChanges', 'Refinance rates', 'property', 'editor', 'expert', {
      plainLabel: 'Mortgage rate changes you expect (refinancing)',
      plainHelp: 'A new interest rate from a given age, for when a fixed deal ends. One entry per age.',
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
