/**
 * Validation messages a person can act on.
 *
 * `profileSchema` is the only validation authority and its wording is precise: `Require floor <=
 * target <= comfort retirement spending` is exactly right and exactly useless to the reader this app
 * is for. So the schema is left alone — not one message, path or rule changes — and this module maps
 * what it produced onto a sentence in ordinary words.
 *
 * Three rules keep the mapping honest:
 *
 * 1. **The schema decides; this only re-words.** Nothing here can suppress an issue, soften what
 *    failed, or let an invalid profile through. It turns one string into another string.
 * 2. **A message with no rule keeps the schema's own words.** Falling back to the precise text is
 *    always better than inventing a friendly sentence for a rule nobody wrote a rewrite for, and it
 *    is what makes an un-rewritten message visible rather than silently generic.
 * 3. **Rules are matched in order, most specific first**, keyed on the issue's path *and* message as
 *    the ticket requires, so two rules can share a message and differ by where it came from.
 */
import type { Profile } from '../../domain/contracts.js';
import {
  choiceFieldsFor, fieldsFor, fieldName, type FieldIssue, type FieldKind,
} from './fields.js';

/** What a rewrite knows about the input the issue came from, when the issue names one. */
export interface IssueField {
  name: string;
  kind?: FieldKind;
}

export type IssueFields = ReadonlyMap<string, IssueField>;

interface RewriteContext {
  /** The field's displayed name, or "This value" when the issue belongs to no single input. */
  name: string;
  kind: FieldKind | undefined;
  /** Capture groups when the rule matched by regular expression. */
  match: RegExpMatchArray | null;
  issue: FieldIssue;
}

interface Rewrite {
  /**
   * The issue path this applies to. A `*` stands for exactly one path segment, so `portfolios.*`
   * covers the ISA, GIA and pension portfolios without naming them. Omitted means any path.
   */
  path?: string;
  /** The schema's own message, matched exactly, or a pattern over it. */
  message: string | RegExp;
  plain: string | ((context: RewriteContext) => string);
}

const pathMatches = (pattern: string, path: string): boolean => {
  if (pattern === path) return true;
  if (!pattern.includes('*')) return false;
  const parts = pattern.split('.');
  const actual = path.split('.');
  if (parts.length !== actual.length) return false;
  return parts.every((part, index) => part === '*' || part === actual[index]);
};

/** A bound as the reader sees it, which for a percent field is not the stored number. */
function bound(raw: string, kind: FieldKind | undefined): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  if (kind === 'percent') return `${Number((value * 100).toPrecision(12))}%`;
  if (kind === 'money' || kind === 'monthlyMoney') return `£${value.toLocaleString('en-GB')}`;
  return String(value);
}

const TOO_SMALL = /^Too small: expected number to be >(=?)(.+)$/;
const TOO_BIG = /^Too big: expected number to be <(=?)(.+)$/;

/**
 * The rewrites, specific first.
 *
 * The five states the ticket calls out — spending order, portfolio weights, ages out of order, a
 * blank box, and a breakdown that does not reconcile — are the first five entries, in that order.
 */
export const REWRITES: readonly Rewrite[] = [
  {
    path: 'spending',
    message: 'Require floor <= target <= comfort retirement spending',
    plain:
      'Your floor spending should be at most your target, and comfort at least your target — floor is '
      + 'the least you could live on, comfort is the most you’d like. Change whichever of the three is '
      + 'out of line.',
  },
  {
    path: 'portfolios.*',
    message: 'Portfolio weights must sum to 1',
    plain:
      'The shares held in this account have to add up to exactly 100%. Every pound is in one of '
      + 'equities, bonds or cash, so the three figures are a split of the whole, not three separate '
      + 'amounts.',
  },
  {
    path: 'personal',
    message: 'Require currentAge <= targetFireAge < endAge',
    plain:
      'These three ages have to run in order: your age now, then the age you stop relying on a salary, '
      + 'then the age the projection stops. The last one has to be later than the middle one, not equal '
      + 'to it.',
  },
  {
    message: 'Invalid input: expected number, received NaN',
    plain: context =>
      `${context.name} needs a number. The box is empty or holds something that is not one, and nothing `
      + 'is assumed on your behalf — the model waits rather than quietly using the previous value.',
  },
  {
    path: 'spending.breakdown',
    message: 'Breakdown must reconcile to current monthly total',
    plain:
      'The shared, per-adult and per-child amounts have to add back up to your current monthly spending. '
      + 'The household total is the figure the model uses; the breakdown only explains how it divides up.',
  },

  // — the rest of the schema's cross-field rules —
  {
    path: 'spending.scenarioMonthly',
    message: 'Require low <= base <= high',
    plain: 'The low, base and high spending cases have to be in that order, lowest first.',
  },
  {
    path: 'spending.currentRentMonthlyIncluded',
    message: 'Included rent exceeds current spending',
    plain:
      'The rent inside your spending cannot be more than your whole monthly spending. Enter only the rent '
      + 'part of the totals you gave above.',
  },
  {
    path: 'spending.phases',
    message: 'Phases are half-open, nonempty and must not overlap',
    plain:
      'Each spending phase needs an end age later than its start age, and two phases cannot cover the '
      + 'same year. A phase runs from its start age up to, but not including, its end age.',
  },
  {
    path: 'market.correlation',
    message: 'Correlation must be symmetric, unit-diagonal and positive semidefinite',
    plain:
      'These figures do not describe a set of markets that could actually exist together. Usually one '
      + 'value is too strong: if two things both move closely with a third, they cannot move opposite '
      + 'ways to each other. Move the largest numbers back towards zero.',
  },
  {
    path: 'simulation.withdrawalOrder',
    message: 'Each account must occur once',
    plain: 'The withdrawal order has to list each of the four accounts exactly once.',
  },
  {
    path: 'pension',
    message: 'Salary sacrifice selected but unavailable',
    plain:
      'Salary sacrifice is chosen as the contribution method but marked as not offered by your employer. '
      + 'Either tick that it is available or pick another method.',
  },
  {
    path: 'property.purchase',
    message: 'Purchase must fall within the projection; use existing ownership for a past purchase',
    plain:
      'The purchase age has to fall between your age now and the end of the projection. For a home you '
      + 'already own, untick "plan a purchase" and enter its value and mortgage instead.',
  },
  {
    path: 'property.sale',
    message: 'Sale must follow ownership and fall before end age',
    plain: 'The sale has to happen after you own the property and before the projection ends.',
  },
  {
    path: 'property.rateChanges',
    message: 'Only one refinance rate per age',
    plain: 'Two refinances cannot fall at the same age. Give each one its own year.',
  },
  {
    path: 'property.rateChanges',
    message: 'Refinance cannot precede ownership',
    plain: 'A refinance cannot happen before you own the property.',
  },
  {
    path: 'property',
    message: 'An existing rental sale requires its historical acquisition cost basis',
    plain:
      'To work out the tax on selling a rental you already own, the model needs what you originally paid '
      + 'for it. Enter the acquisition cost basis.',
  },
  {
    path: 'property',
    message: 'First-time buyer relief requires an owner-occupied home',
    plain: 'First-time buyer relief only applies to a home you will live in, not to a rental.',
  },
  {
    path: 'property',
    message: 'Manual location requires an explicit purchase tax amount',
    plain:
      'You chose to enter the purchase tax yourself, so the model needs the amount. There is no default '
      + 'for it, because it depends on rules this app does not hold.',
  },
  {
    path: 'property',
    message: 'Deposit exceeds price',
    plain: 'The deposit cannot be more than the purchase price.',
  },

  // — generic numeric bounds, which read very differently depending on the kind of input —
  {
    message: TOO_SMALL,
    plain: context => {
      const limit = bound(context.match?.[2] ?? '', context.kind);
      const inclusive = context.match?.[1] === '=';
      if ((context.kind === 'money' || context.kind === 'monthlyMoney') && Number(context.match?.[2]) === 0) {
        return `${context.name} cannot be negative. Enter 0 if there is none.`;
      }
      if (context.kind === 'age') return `${context.name} has to be at least ${limit}.`;
      return inclusive
        ? `${context.name} cannot be below ${limit}.`
        : `${context.name} has to be more than ${limit}.`;
    },
  },
  {
    message: TOO_BIG,
    plain: context => {
      const limit = bound(context.match?.[2] ?? '', context.kind);
      const inclusive = context.match?.[1] === '=';
      if (context.kind === 'percent' && Number(context.match?.[2]) === 1) {
        return `${context.name} cannot be more than 100%.`;
      }
      return inclusive
        ? `${context.name} cannot be more than ${limit}.`
        : `${context.name} has to be less than ${limit}.`;
    },
  },
  {
    message: 'Invalid input: expected int, received number',
    plain: context => `${context.name} has to be a whole number.`,
  },
];

/** The name and kind of every input an issue could be filed against. */
export function issueFields(profile: Profile): IssueFields {
  const map = new Map<string, IssueField>();
  for (const def of fieldsFor(profile)) map.set(def.id, { name: fieldName(def), kind: def.kind });
  for (const def of choiceFieldsFor(profile)) map.set(def.id, { name: fieldName(def) });
  return map;
}

/**
 * One issue, in plain words — or the schema's own words when no rule covers it.
 *
 * The field's name is looked up by the issue's path rather than by `fieldId`, because an issue can
 * sit on a path the registry knows (`personal.currentAge`) while `fieldId` is null for a rule that
 * spans fields. When neither resolves, the sentence opens with "This value", which is accurate for a
 * cross-field rule and never wrong.
 */
export function plainMessage(issue: FieldIssue, fields: IssueFields = new Map()): string {
  const field = fields.get(issue.path) ?? (issue.fieldId ? fields.get(issue.fieldId) : undefined);
  for (const rule of REWRITES) {
    if (rule.path !== undefined && !pathMatches(rule.path, issue.path)) continue;
    const match = typeof rule.message === 'string'
      ? (rule.message === issue.message ? null : undefined)
      : (issue.message.match(rule.message) ?? undefined);
    if (match === undefined) continue;
    if (typeof rule.plain === 'string') return rule.plain;
    return rule.plain({ name: field?.name ?? 'This value', kind: field?.kind, match, issue });
  }
  return issue.message;
}

/** The same issues with their messages rewritten. Paths, fields and groups are untouched. */
export function plainIssues(issues: readonly FieldIssue[], fields: IssueFields): FieldIssue[] {
  return issues.map(issue => ({ ...issue, message: plainMessage(issue, fields) }));
}
