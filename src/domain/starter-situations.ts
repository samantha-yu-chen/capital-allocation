/**
 * Starter situations: labelled, reversible places to begin.
 *
 * UX-9's finding is that a blank-slate reader does not know plausible values, and the one profile
 * the app used to open with — the specification's worked example — fits exactly one person. So this
 * module holds a small, curated set of *whole situations*, each a validated `Profile` plus the run
 * options that belong to the plan.
 *
 * Four rules make them safe to ship:
 *
 * - **A situation is an illustration, never a recommendation.** Nothing here is a benchmark, a
 *   forecast, or "what someone like you should do". Every entry records *why* its figures are what
 *   they are (`reasoning`), so a reader can disagree with the reasoning rather than with a number
 *   that arrived from nowhere.
 * - **Nothing is trusted until it is parsed.** Every situation is built through `parseProfile`, so
 *   `profileSchema` remains the only validation authority and a situation can never hold a profile
 *   an engine would reject. `starterProfile` re-parses on every call, so two callers never share
 *   structure.
 * - **A situation changes your circumstances, not the model.** `market`, `simulation` and
 *   `portfolios` are copied verbatim from the worked example in every entry: the same seed, the same
 *   path count, the same return assumptions, the same withdrawal order, the same asset mix.
 *   Choosing a situation must never quietly change what the engine does, how many paths it runs, or
 *   what it implies about how to invest.
 * - **Every situation funds itself on the reference path.** A starting point whose own deterministic
 *   ledger already fails at its target spending would teach the reader nothing except that the app
 *   is broken, so the suite runs each one and asserts there are no failure records.
 *
 * The entries deliberately vary tax region, contribution method, household size, property ownership
 * and whether an employer contributes at all, because those are the structural choices a reader
 * cannot guess their way into from a single example.
 */
import { parseProfile, type Profile } from './contracts.js';
import { createExampleProfile } from './fixtures.js';
import { defaultScenarioOptions, type ScenarioOptions } from './scenarios.js';

export type StarterSituationId =
  | 'worked-example'
  | 'renting-late-20s'
  | 'higher-salary-renting-30s'
  | 'contractor-no-employer-pension'
  | 'family-40s-mid-mortgage'
  | 'fifties-pension-heavy';

export interface StarterSituation {
  id: StarterSituationId;
  /** The name a saved library entry takes. Short enough to be a card heading. */
  name: string;
  /** Who the situation is drawn for, in one sentence, in ordinary words. */
  who: string;
  /**
   * Why each figure is what it is. Every line is a modelling decision a reader is entitled to
   * disagree with; none of them is a recommendation.
   */
  reasoning: readonly string[];
  /** The plan-level run options the situation starts with. */
  options: ScenarioOptions;
  /** Builds the unvalidated profile. Callers go through `starterProfile`, which parses it. */
  build: () => unknown;
}

/**
 * What every situation shares with the worked example, read from it rather than restated so the two
 * cannot drift apart: the market model, the simulation settings and the portfolio weights.
 */
const shared = (): Pick<Profile, 'market' | 'simulation' | 'portfolios'> => {
  const example = createExampleProfile();
  return { market: example.market, simulation: example.simulation, portfolios: example.portfolios };
};

/** Wrapper settings every situation starts from: a full ISA allowance and an untouched GIA. */
const wrappers = () => ({
  isa: { allowanceUsed: 0 },
  gia: { dividendYield: 0.02, turnoverRate: 0, gainRealisationRate: 0 },
});

/**
 * Zero everywhere. A state pension is a real entitlement, but crediting one the reader has not
 * checked would flatter every plan. It is an input for them to add, not a default.
 */
const statePension = { statePensionAnnual: 0, statePensionAge: 68 };

const situations: readonly StarterSituation[] = [
  {
    id: 'worked-example',
    name: 'The worked example',
    who: 'Where the app opens: one earner in their early thirties in Scotland, saving steadily, no property in the plan.',
    reasoning: [
      'This is the specification’s own worked example (section 79), unchanged. It is here so that choosing a situation stays reversible: you can always come back to the figures the app started with.',
      'Every “edited” marker and every reset on the form is measured against whichever situation you chose. This entry is what that comparison means before you choose anything.',
    ],
    options: defaultScenarioOptions(),
    build: createExampleProfile,
  },
  {
    id: 'renting-late-20s',
    name: 'Renting, late 20s, starting out',
    who: 'A single renter around 28 on an ordinary graduate salary, with a little saved and a workplace pension that has only just started.',
    reasoning: [
      'Salary £32,000 with 2% real growth: ordinary early-career pay with ordinary early-career progression, rather than the steeper 3% the worked example assumes.',
      'Rent is £850 of the £1,700 monthly spend and is recorded in “rent included in current spending”, so the property comparison can remove it honestly instead of guessing at it.',
      'Assets are deliberately small — £4,000 cash, £3,000 ISA, £6,000 pension — because the point of this situation is what thirty years of contributions do, not what an inheritance does.',
      'Auto-enrolment minimums (5% employee, 3% employer) by salary sacrifice, because that is what an untouched workplace scheme usually looks like.',
      'A target FIRE age of 53. The reference path stops funding this plan below 47, and 53 leaves it about as much room as the worked example leaves itself — a starting point that only just works, or that cannot fail, would both be misleading.',
      'Retirement spending of £1,250 a month assumes the rent is replaced by something cheaper, not that housing becomes free.',
    ],
    options: defaultScenarioOptions(),
    build: () => ({
      schemaVersion: '1',
      ...shared(),
      ...wrappers(),
      personal: { currentAge: 28, targetFireAge: 53, endAge: 95, taxRegion: 'rest_of_uk', taxYear: '2026/27', targetSuccessProbability: 0.9 },
      income: { salaryAnnual: 32_000, bonusAnnual: 0, otherNonSavingsAnnual: 0, salaryGrowthReal: 0.02,
        retirementEmploymentAnnual: 0, ...statePension },
      household: { adults: 1, children: 0 },
      spending: { current: { essentialMonthly: 1_350, discretionaryMonthly: 350 },
        retirement: { essentialMonthly: 950, discretionaryMonthly: 300 }, retirementFloorAnnual: 12_000,
        retirementComfortAnnual: 21_000, currentRentMonthlyIncluded: 850, breakdown: null, phases: [],
        lifestyleCreepRate: 0, scenarioMonthly: { low: 1_500, base: 1_700, high: 1_950 } },
      assets: { cash: 4_000, isa: 3_000, gia: { marketValue: 0, costBasis: 0, carriedLosses: 0 },
        pension: 6_000, sipp: 0, pensionTaxFreeCashUsed: 0 },
      pension: { method: 'salary_sacrifice', employeeRate: 0.05, employerRate: 0.03, matchUpToRate: 0,
        matchRate: 0, employerNiSharebackRate: 0, salarySacrificeAvailable: true, sacrificeAddedBackForTaper: true,
        accessAge: 57, moneyPurchaseAnnualAllowanceTriggered: false, carryForwardAllowance: 0 },
      liquidity: { emergencyFundMonths: 6, minimumLiquidYears: 2, capitalNeeds: [] },
      property: null,
    }),
  },
  {
    id: 'higher-salary-renting-30s',
    name: 'Higher salary, renting, 30s',
    who: 'A single renter in their mid-thirties earning above £100,000, where each extra pound of pay is taxed far harder than the headline rate suggests.',
    reasoning: [
      'Salary £112,000 puts the plan inside the band where the personal allowance is withdrawn at 50p for every extra pound, so the effective marginal rate is around 60%. That is why this situation exists: the Marginal Allocation screen says something surprising and true here.',
      'A 12% employee contribution by salary sacrifice is high for a default, and is what makes the allowance withdrawal visible rather than theoretical — the plan sits partly inside the band and partly out of it.',
      '“Sacrifice added back for the taper” is true, matching the post-2015 rule the tax engine implements.',
      'Rent of £1,750 inside a £3,000 monthly spend: a higher salary in a high-rent city, not a higher salary with the worked example’s costs.',
      'Retirement spending of £2,400 a month is well below the current £3,000, because the rent is the largest single line and this plan does not carry it forever.',
      'The GIA holds a real gain on its cost basis, so capital-gains tax appears in the withdrawal ordering rather than being a rounding error.',
    ],
    options: defaultScenarioOptions(),
    build: () => ({
      schemaVersion: '1',
      ...shared(),
      ...wrappers(),
      personal: { currentAge: 36, targetFireAge: 47, endAge: 95, taxRegion: 'rest_of_uk', taxYear: '2026/27', targetSuccessProbability: 0.9 },
      income: { salaryAnnual: 112_000, bonusAnnual: 0, otherNonSavingsAnnual: 0, salaryGrowthReal: 0.015,
        retirementEmploymentAnnual: 0, ...statePension },
      household: { adults: 1, children: 0 },
      spending: { current: { essentialMonthly: 2_350, discretionaryMonthly: 650 },
        retirement: { essentialMonthly: 1_800, discretionaryMonthly: 600 }, retirementFloorAnnual: 24_000,
        retirementComfortAnnual: 36_000, currentRentMonthlyIncluded: 1_750, breakdown: null, phases: [],
        lifestyleCreepRate: 0, scenarioMonthly: { low: 2_700, base: 3_000, high: 3_400 } },
      assets: { cash: 25_000, isa: 85_000, gia: { marketValue: 35_000, costBasis: 22_000, carriedLosses: 0 },
        pension: 95_000, sipp: 0, pensionTaxFreeCashUsed: 0 },
      pension: { method: 'salary_sacrifice', employeeRate: 0.12, employerRate: 0.05, matchUpToRate: 0,
        matchRate: 0, employerNiSharebackRate: 0, salarySacrificeAvailable: true, sacrificeAddedBackForTaper: true,
        accessAge: 57, moneyPurchaseAnnualAllowanceTriggered: false, carryForwardAllowance: 0 },
      liquidity: { emergencyFundMonths: 6, minimumLiquidYears: 2, capitalNeeds: [] },
      property: null,
    }),
  },
  {
    id: 'contractor-no-employer-pension',
    name: 'Contractor, no employer pension',
    who: 'Someone contracting or self-employed in their late thirties: no employer contribution, no sick pay, and a pension only they pay into.',
    reasoning: [
      'Employer rate 0% and no match. This is the structural point of the situation: a reader with no employer contribution is not a reader with a smaller one, and the Marginal Allocation answer changes because of it.',
      'Contributions are relief at source into a SIPP, not salary sacrifice, and “salary sacrifice available” is false — there is no employer to sacrifice to. The tax engine treats the two differently and so must the starting point.',
      'A 12% self-funded contribution, higher than an auto-enrolment minimum, because nobody else is adding anything.',
      'Cash of £35,000 and a twelve-month emergency fund rather than six: a contract ending is an income gap, and the liquidity constraint should say so rather than let the plan look safer than it is.',
      'Salary growth of 1% real: a day rate does not receive an annual review. It is recorded as PAYE salary because that is what this model taxes — the dividend and corporation-tax route a limited company might use is not modelled, and pretending otherwise would be worse than saying so.',
      'The existing pension is £70,000 of SIPP and £0 of workplace pension, which is what the account split actually looks like for someone who has never been auto-enrolled.',
    ],
    options: defaultScenarioOptions(),
    build: () => ({
      schemaVersion: '1',
      ...shared(),
      ...wrappers(),
      personal: { currentAge: 38, targetFireAge: 51, endAge: 95, taxRegion: 'rest_of_uk', taxYear: '2026/27', targetSuccessProbability: 0.9 },
      income: { salaryAnnual: 82_000, bonusAnnual: 0, otherNonSavingsAnnual: 0, salaryGrowthReal: 0.01,
        retirementEmploymentAnnual: 0, ...statePension },
      household: { adults: 1, children: 0 },
      spending: { current: { essentialMonthly: 1_900, discretionaryMonthly: 500 },
        retirement: { essentialMonthly: 1_500, discretionaryMonthly: 450 }, retirementFloorAnnual: 19_000,
        retirementComfortAnnual: 30_000, currentRentMonthlyIncluded: 1_150, breakdown: null, phases: [],
        lifestyleCreepRate: 0, scenarioMonthly: { low: 2_150, base: 2_400, high: 2_750 } },
      assets: { cash: 35_000, isa: 60_000, gia: { marketValue: 15_000, costBasis: 15_000, carriedLosses: 0 },
        pension: 0, sipp: 70_000, pensionTaxFreeCashUsed: 0 },
      pension: { method: 'relief_at_source', employeeRate: 0.12, employerRate: 0, matchUpToRate: 0,
        matchRate: 0, employerNiSharebackRate: 0, salarySacrificeAvailable: false, sacrificeAddedBackForTaper: false,
        accessAge: 57, moneyPurchaseAnnualAllowanceTriggered: false, carryForwardAllowance: 0 },
      liquidity: { emergencyFundMonths: 12, minimumLiquidYears: 2, capitalNeeds: [] },
      property: null,
    }),
  },
  {
    id: 'family-40s-mid-mortgage',
    name: 'Family, 40s, mid-mortgage',
    who: 'Two adults and two children in their forties, part-way through a repayment mortgage on the home they live in.',
    reasoning: [
      'The only situation here that owns property. The house is already owned, so `purchase` is null: a purchase inside the projection would charge stamp duty and a deposit the reader has already paid.',
      'A £320,000 home with £145,000 left on a repayment mortgage at 4.3% over 14 years — roughly the middle of a term taken out in the 2010s.',
      'Monthly spending excludes the mortgage. The ledger charges interest and principal as their own lines (ADR 002), so putting the payment in “essential spending” would count it twice.',
      'Council tax £2,100, maintenance £1,800 and insurance £450 are the running costs of owning that are not the mortgage, and they continue after it is repaid.',
      'Two adults and two children changes nothing arithmetically — the monthly totals are authoritative household totals and are never multiplied by people — but it is what the reader recognises, and the optional breakdown is theirs to fill in.',
      'Pension 6% employee and 5% employer with a 1:1 match on the first 5%, the commonest shape of a real workplace scheme, so the “free money” boundary the marginal engine finds here is a real one.',
      'A target FIRE age of 61: on one earner’s £74,000 with a mortgage and two children the reference path does not fund 56 at all, and making the number optimistic so the card looks encouraging is the opposite of the point.',
      'Children are given no end age. Costs that stop when they leave home belong in the spending phase editor, which is exactly the sort of thing a reader should add on top of a starting point.',
    ],
    options: defaultScenarioOptions(),
    build: () => ({
      schemaVersion: '1',
      ...shared(),
      ...wrappers(),
      personal: { currentAge: 43, targetFireAge: 61, endAge: 95, taxRegion: 'rest_of_uk', taxYear: '2026/27', targetSuccessProbability: 0.9 },
      income: { salaryAnnual: 74_000, bonusAnnual: 3_000, otherNonSavingsAnnual: 0, salaryGrowthReal: 0.015,
        retirementEmploymentAnnual: 0, ...statePension },
      household: { adults: 2, children: 2 },
      spending: { current: { essentialMonthly: 2_100, discretionaryMonthly: 500 },
        retirement: { essentialMonthly: 1_850, discretionaryMonthly: 550 }, retirementFloorAnnual: 23_000,
        retirementComfortAnnual: 36_000, currentRentMonthlyIncluded: 0, breakdown: null, phases: [],
        lifestyleCreepRate: 0, scenarioMonthly: { low: 2_350, base: 2_600, high: 2_950 } },
      assets: { cash: 20_000, isa: 45_000, gia: { marketValue: 12_000, costBasis: 10_000, carriedLosses: 0 },
        pension: 135_000, sipp: 0, pensionTaxFreeCashUsed: 0 },
      pension: { method: 'salary_sacrifice', employeeRate: 0.06, employerRate: 0.05, matchUpToRate: 0.05,
        matchRate: 1, employerNiSharebackRate: 0, salarySacrificeAvailable: true, sacrificeAddedBackForTaper: true,
        accessAge: 57, moneyPurchaseAnnualAllowanceTriggered: false, carryForwardAllowance: 0 },
      liquidity: { emergencyFundMonths: 6, minimumLiquidYears: 2, capitalNeeds: [] },
      property: {
        use: 'owner_occupied', marketValue: 320_000, taxLocation: 'england_ni', buyerStatus: 'standard',
        mortgageBalance: 145_000, mortgageAnnualRate: 0.043, mortgageTermYears: 14, mortgageType: 'repayment',
        maintenanceAnnual: 1_800, insuranceAnnual: 450, serviceChargeAnnual: 0, councilTaxAnnual: 2_100,
        rentAnnual: 0, occupancyRate: 0, managementRate: 0, purchase: null, sale: null, rateChanges: [],
      },
    }),
  },
  {
    id: 'fifties-pension-heavy',
    name: '50s, pension-heavy, FIRE soon',
    who: 'Someone in their mid-fifties with most of their wealth locked in a pension, close enough to stopping work that the order things can be spent in matters.',
    reasoning: [
      '£430,000 of pension against £160,000 outside it. That ratio is the situation: the Attribution and Reverse Solver screens behave completely differently when the money is mostly inaccessible.',
      'A target FIRE age of 59 against a pension access age of 57 means there is no bridge to fund — deliberately, so this entry is a starting point that works and the reader can shorten it themselves and watch a bridge failure appear.',
      'A 15% employee contribution is what late catch-up saving looks like, and at £88,000 it stays inside the annual allowance with no taper and no charge.',
      'Retirement spending of £2,300 a month is slightly below the current £2,500: the commute is gone, the rest is not.',
      'The GIA holds a £34,000 gain on a £26,000 cost basis, so capital-gains tax is real in the withdrawal ordering rather than a footnote.',
      'Scotland, unlike the other situations drawn for this ticket, because the Scottish bands bite hardest at around this income and a reader in Scotland should be able to start from something that looks like theirs.',
    ],
    options: defaultScenarioOptions(),
    build: () => ({
      schemaVersion: '1',
      ...shared(),
      ...wrappers(),
      personal: { currentAge: 54, targetFireAge: 59, endAge: 95, taxRegion: 'scotland', taxYear: '2026/27', targetSuccessProbability: 0.9 },
      income: { salaryAnnual: 88_000, bonusAnnual: 0, otherNonSavingsAnnual: 0, salaryGrowthReal: 0.01,
        retirementEmploymentAnnual: 0, ...statePension },
      household: { adults: 1, children: 0 },
      spending: { current: { essentialMonthly: 1_900, discretionaryMonthly: 600 },
        retirement: { essentialMonthly: 1_750, discretionaryMonthly: 550 }, retirementFloorAnnual: 22_000,
        retirementComfortAnnual: 34_000, currentRentMonthlyIncluded: 0, breakdown: null, phases: [],
        lifestyleCreepRate: 0, scenarioMonthly: { low: 2_250, base: 2_500, high: 2_850 } },
      assets: { cash: 30_000, isa: 70_000, gia: { marketValue: 60_000, costBasis: 26_000, carriedLosses: 0 },
        pension: 430_000, sipp: 0, pensionTaxFreeCashUsed: 0 },
      pension: { method: 'salary_sacrifice', employeeRate: 0.15, employerRate: 0.08, matchUpToRate: 0,
        matchRate: 0, employerNiSharebackRate: 0, salarySacrificeAvailable: true, sacrificeAddedBackForTaper: true,
        accessAge: 57, moneyPurchaseAnnualAllowanceTriggered: false, carryForwardAllowance: 0 },
      liquidity: { emergencyFundMonths: 6, minimumLiquidYears: 2, capitalNeeds: [] },
      property: null,
    }),
  },
];

export const STARTER_SITUATIONS: readonly StarterSituation[] = situations;

/** The situation the app opens with. Unchanged behaviour: it is the specification's worked example. */
export const DEFAULT_STARTER_ID: StarterSituationId = 'worked-example';

export function starterSituation(id: string): StarterSituation {
  const found = STARTER_SITUATIONS.find(situation => situation.id === id);
  if (!found) throw new RangeError(`Unknown starter situation ${id}`);
  return found;
}

/**
 * A fresh, validated profile for one situation.
 *
 * Parsed on every call, so no two callers share structure and no situation can hand out a profile
 * `profileSchema` would reject.
 */
export const starterProfile = (id: string): Profile => parseProfile(starterSituation(id).build());
