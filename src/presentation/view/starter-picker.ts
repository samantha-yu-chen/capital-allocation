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
}

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
    { label: 'Age now', value: String(profile.personal.currentAge) },
    { label: 'Target FIRE age', value: String(profile.personal.targetFireAge) },
    { label: 'Household', value: household(profile) },
    { label: 'Tax region', value: region(profile) },
    { label: 'Gross salary', value: money(profile.income.salaryAnnual) },
    { label: 'Spending now', value: monthly(profile.spending.current) },
    { label: 'Retirement spending', value: monthly(profile.spending.retirement) },
    { label: 'Cash, ISA and GIA', value: money(profile.assets.cash + profile.assets.isa + profile.assets.gia.marketValue) },
    { label: 'Pension and SIPP', value: money(profile.assets.pension + profile.assets.sipp) },
    { label: 'You pay in', value: `${percent(profile.pension.employeeRate, 1)} by ${METHOD_LABEL[profile.pension.method]}` },
    { label: 'Employer pays in', value: employerContribution(profile) },
    { label: 'Property', value: propertyFact(profile) },
  ];
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
    ? `“Default” here means ${starterName(id)}, the situation the app opens with. Choose another under Start here and every marker is measured against that one instead.`
    : `“Default” here means the starter situation you chose, ${starterName(id)}. Every edited marker and every reset on this form is measured against it.`;

/**
 * Every file that puts a starter card in front of a reader. The audit test derives its own list
 * from the sources and compares, so a seventh surface without the caveat fails the suite.
 */
export const STARTER_PICKER_SURFACES: readonly string[] = [
  'src/presentation/web/starter-picker.tsx',
];
