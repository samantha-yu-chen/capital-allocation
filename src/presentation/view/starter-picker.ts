/**
 * UX-9: the reader-facing side of the starter situations.
 *
 * `src/domain/starter-situations.ts` owns the profiles. This module owns what a reader is told about
 * them, in one place, for the same reason `two-numbers.ts` and `pension-relief.ts` exist: a sentence
 * that must be true on every surface has to have exactly one author.
 *
 * Two things it guarantees:
 *
 * - **Every card carries the caveat.** `STARTER_ILLUSTRATION_CAVEAT` is built into `starterCards`,
 *   not passed in by a screen, so a screen cannot render a card without it. The audit test asserts
 *   the string on every card and that every file rendering a card is in `STARTER_PICKER_SURFACES`.
 * - **The facts on a card are the profile's own values.** Nothing here restates a figure as a
 *   literal: every fact is read off the parsed profile and formatted through `format.ts`, so a card
 *   cannot drift away from the situation it describes.
 *
 * It computes nothing. There is no projection, no probability and no ranking: the cards are
 * deliberately not ordered by how well each plan does, because that would turn a set of
 * illustrations into a leaderboard.
 */
import type { Profile } from '../../domain/contracts.js';
import {
  DEFAULT_STARTER_ID, STARTER_SITUATIONS, starterProfile, starterSituation,
  type StarterSituation,
} from '../../domain/starter-situations.js';
import { money, percent } from './format.js';

/**
 * The sentence every card carries. One string, asserted by the audit, so no screen can soften it
 * into "a suggested plan" or drop it to save space.
 */
export const STARTER_ILLUSTRATION_CAVEAT =
  'An illustration, not advice and not a benchmark: it is a set of plausible figures to start editing, '
  + 'not a claim about what someone in this situation has or should do.';

/** What choosing one actually does, said before the reader clicks rather than after. */
export const STARTER_CHOICE_EFFECT =
  'Choosing a situation replaces every value on the form and runs nothing. It becomes the “default” '
  + 'that every edited marker and every reset is then measured against, and you can choose a different '
  + 'one — or the worked example — at any time.';

export interface StarterFact {
  label: string;
  value: string;
  /**
   * The registry inputs this figure is read from, in the order a reader would edit them (UX-11).
   *
   * A fact is not a decoration: every one of these twelve is produced by something the reader can
   * change, and until UX-11 no card said where. The list is honest about arity — "Household" is two
   * inputs, "Cash, ISA and GIA" is three — and honest about absence: a fact with no single input
   * behind it carries an empty list and is rendered as text rather than as a link that goes nowhere.
   *
   * The ids are resolved against the *reader's* profile, not the card's, because that is where a
   * jump lands. `fieldTarget` returns null for an id the current profile has no input for.
   */
  fieldIds: readonly string[];
}

/**
 * Where a fact's inputs live, given the situation it describes.
 *
 * Property is the one that depends on shape rather than on values: a situation with no property
 * points at the switch that adds one, one that already owns points at its value and debt, and one
 * that plans a purchase points at the purchase. Stating it this way means the card cannot promise a
 * field the profile does not have.
 */
const propertyFieldIds = (profile: Profile): readonly string[] => {
  if (profile.property === null) return ['property'];
  if (profile.property.purchase === null) return ['property.marketValue', 'property.mortgageBalance'];
  return ['property.purchase.price', 'property.purchase.deposit'];
};

export interface StarterCard {
  id: string;
  name: string;
  who: string;
  /** Always `STARTER_ILLUSTRATION_CAVEAT`. Carried per card so a renderer cannot omit it. */
  caveat: string;
  /** The handful of figures that identify the situation, read off its own profile. */
  facts: readonly StarterFact[];
  /** Why each figure is what it is. */
  reasoning: readonly string[];
}

const region = (profile: Profile): string =>
  profile.personal.taxRegion === 'scotland' ? 'Scotland' : 'Rest of the UK';

const household = (profile: Profile): string => {
  const { adults, children } = profile.household;
  const people = `${adults} adult${adults === 1 ? '' : 's'}`;
  return children === 0 ? people : `${people}, ${children} child${children === 1 ? '' : 'ren'}`;
};

const monthly = (level: Profile['spending']['current']): string =>
  `${money(level.essentialMonthly + level.discretionaryMonthly)}/mo`;

const employerContribution = (profile: Profile): string => {
  const { employerRate, matchUpToRate, matchRate } = profile.pension;
  const base = percent(employerRate, 1);
  if (matchUpToRate === 0 || matchRate === 0) return employerRate === 0 ? 'None' : base;
  return `${base} plus a match up to ${percent(matchUpToRate, 1)}`;
};

const METHOD_LABEL: Record<Profile['pension']['method'], string> = {
  salary_sacrifice: 'salary sacrifice', net_pay: 'net pay', relief_at_source: 'relief at source',
};

const propertyFact = (profile: Profile): string =>
  profile.property === null
    ? 'None in the plan'
    : `${money(profile.property.marketValue)} home, ${money(profile.property.mortgageBalance)} mortgage`;

/** The figures that identify a situation. Read off the profile, never restated as literals. */
export function starterFacts(profile: Profile): readonly StarterFact[] {
  return [
    { label: 'Age now', value: String(profile.personal.currentAge), fieldIds: ['personal.currentAge'] },
    { label: 'Target FIRE age', value: String(profile.personal.targetFireAge), fieldIds: ['personal.targetFireAge'] },
    { label: 'Household', value: household(profile), fieldIds: ['household.adults', 'household.children'] },
    { label: 'Tax region', value: region(profile), fieldIds: ['personal.taxRegion'] },
    { label: 'Gross salary', value: money(profile.income.salaryAnnual), fieldIds: ['income.salaryAnnual'] },
    {
      label: 'Spending now', value: monthly(profile.spending.current),
      fieldIds: ['spending.current.essentialMonthly', 'spending.current.discretionaryMonthly'],
    },
    {
      label: 'Retirement spending', value: monthly(profile.spending.retirement),
      fieldIds: ['spending.retirement.essentialMonthly', 'spending.retirement.discretionaryMonthly'],
    },
    {
      label: 'Cash, ISA and GIA',
      value: money(profile.assets.cash + profile.assets.isa + profile.assets.gia.marketValue),
      fieldIds: ['assets.cash', 'assets.isa', 'assets.gia.marketValue'],
    },
    {
      label: 'Pension and SIPP', value: money(profile.assets.pension + profile.assets.sipp),
      fieldIds: ['assets.pension', 'assets.sipp'],
    },
    {
      label: 'You pay in', value: `${percent(profile.pension.employeeRate, 1)} by ${METHOD_LABEL[profile.pension.method]}`,
      fieldIds: ['pension.employeeRate', 'pension.method'],
    },
    {
      label: 'Employer pays in', value: employerContribution(profile),
      fieldIds: ['pension.employerRate', 'pension.matchUpToRate', 'pension.matchRate'],
    },
    { label: 'Property', value: propertyFact(profile), fieldIds: propertyFieldIds(profile) },
  ];
}

/**
 * The departures from a situation that a reader most often wants next (UX-11).
 *
 * The reader's own report was the contractor situation with one adult and a family to plan for, and
 * nothing on screen said where the adult count lived. These four are the common cases — who is in
 * the household, what comes in, what goes out, and when you want to stop — offered where the choice
 * was made rather than left for the reader to hunt for on a form of ninety inputs.
 *
 * Each jump names more than one input where more than one is involved: it opens the first and says
 * how many others sit beside it, instead of pretending that "your spending" is one box.
 */
export interface StarterJump {
  id: string;
  /** Completes the sentence "Change …". */
  label: string;
  fieldIds: readonly string[];
}

export const STARTER_NEXT_PROMPT =
  'Not quite you? A situation is a starting point, so these are the four things most often changed straight '
  + 'after choosing one. Each opens the form at that input, with enough detail showing for it to be visible.';

export const STARTER_NEXT_JUMPS: readonly StarterJump[] = [
  { id: 'household', label: 'your household', fieldIds: ['household.adults', 'household.children'] },
  { id: 'salary', label: 'your salary', fieldIds: ['income.salaryAnnual'] },
  {
    id: 'spending', label: 'your spending',
    fieldIds: ['spending.current.essentialMonthly', 'spending.current.discretionaryMonthly',
      'spending.retirement.essentialMonthly', 'spending.retirement.discretionaryMonthly'],
  },
  { id: 'fire-age', label: 'the age you want to stop', fieldIds: ['personal.targetFireAge'] },
];

/** What a fact link does, said once, on the card that offers them. */
export const STARTER_FACT_LINK_NOTE =
  'Every figure on the situation you are using is a link to the input that produces it: choosing one takes you '
  + 'to that box on the form and focuses it. Nothing runs, and nothing is changed for you.';

/** How a jump describes itself to a screen reader, including what else it opens beside the first box. */
export function jumpDescription(label: string, fieldCount: number): string {
  const rest = fieldCount - 1;
  if (rest <= 0) return `Change ${label} on the profile form`;
  return `Change ${label} on the profile form: ${fieldCount} inputs, starting with the first`;
}

const card = (situation: StarterSituation): StarterCard => ({
  id: situation.id,
  name: situation.name,
  who: situation.who,
  caveat: STARTER_ILLUSTRATION_CAVEAT,
  facts: starterFacts(starterProfile(situation.id)),
  reasoning: situation.reasoning,
});

/**
 * Every situation as a card, in the order the library declares them — which is the worked example
 * first and then roughly by age, not by outcome.
 */
export const starterCards = (): readonly StarterCard[] => STARTER_SITUATIONS.map(card);

export const starterCard = (id: string): StarterCard => card(starterSituation(id));

/** The name of the situation the form is currently measured against. */
export const starterName = (id: string): string => starterSituation(id).name;

/**
 * The sentence that says what "default" means on this form right now.
 *
 * `provenance.ts` says "the starter profile" without naming it, which is correct wherever it is
 * used and useless on its own once there is more than one. This names the chosen one, and it is the
 * only place that wording is written.
 */
export const starterProvenanceNote = (id: string): string =>
  id === DEFAULT_STARTER_ID
    ? `“Default” here means the situation the app opens with, ${starterName(id)}. Choose another under Start here and every marker is measured against that one instead.`
    : `“Default” here means the starter situation you chose, ${starterName(id)}. Every edited marker and every reset on this form is measured against it.`;

/**
 * Every file that puts a starter card in front of a reader. The audit test derives its own list
 * from the sources and compares, so a seventh surface without the caveat fails the suite.
 */
export const STARTER_PICKER_SURFACES: readonly string[] = [
  'src/presentation/web/starter-picker.tsx',
];
