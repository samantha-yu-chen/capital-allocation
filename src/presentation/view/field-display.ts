/**
 * How a numeric input presents itself.
 *
 * `fields.ts` stays the only conversion authority: nothing here writes a stored value, nothing here
 * runs during validation, and every function is a pure text-or-number transform so it can be tested
 * without a browser. What lives here is the part a reader actually sees around the box — the unit,
 * the grouped form the figure settles into when they leave the field, the yearly size of a monthly
 * number, and the arrow-key stepping that `type="text"` does not provide for free.
 */
import type { ControlFieldDef, FieldKind } from './fields.js';
import { money } from './format.js';

/** The unit printed inside the input's frame, beside the digits rather than mixed into them. */
export interface FieldAffix {
  prefix?: string;
  suffix?: string;
}

const AFFIX: Record<FieldKind, FieldAffix> = {
  money: { prefix: '£' },
  monthlyMoney: { prefix: '£', suffix: '/mo' },
  percent: { suffix: '%' },
  multiple: { suffix: '×' },
  age: {},
  integer: {},
  decimal: {},
};

export const fieldAffix = (kind: FieldKind): FieldAffix => AFFIX[kind];

/**
 * The same unit as a word, for the accessible name.
 *
 * The visible adornment is decoration (`aria-hidden`), so without this a screen-reader user would
 * hear "Gross salary" and no unit at all — which is exactly the information the £ was added to give.
 */
const SPOKEN: Record<FieldKind, string> = {
  money: 'in pounds',
  monthlyMoney: 'in pounds per month',
  percent: 'in percent',
  multiple: 'as a multiple',
  age: '',
  integer: '',
  decimal: '',
};

export const spokenUnit = (kind: FieldKind): string => SPOKEN[kind];

/**
 * Which kinds are grouped with thousands separators.
 *
 * Money only. A random seed is an `integer` and grouping it into `20,260,101` would dress an
 * identifier up as a quantity; percentages, ages and multiples never reach four digits.
 */
export const isGrouped = (kind: FieldKind): boolean => kind === 'money' || kind === 'monthlyMoney';

const PLAIN_DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/;

/**
 * The resting form of a draft: `55000` → `55,000`.
 *
 * Display only, and deliberately total — anything that is not a plain decimal comes back untouched,
 * because the authority on a bad draft is `profileSchema`'s message and not a silent rewrite here.
 */
export function groupedText(def: ControlFieldDef, text: string): string {
  if (!isGrouped(def.kind)) return text;
  const trimmed = text.trim();
  if (trimmed === '') return text;
  const match = PLAIN_DECIMAL.exec(trimmed.replace(/,/g, ''));
  if (!match) return text;
  const [, sign = '', whole = '', fraction] = match;
  if (whole === '' && !fraction) return text;
  const grouped = (whole === '' ? '0' : whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}

/**
 * The text an input shows. Focused is the reader's own raw draft; blurred is the grouped form.
 *
 * Reformatting on blur must never be an edit, so this returns a string and the caller renders it.
 * Nothing in this path touches the draft map or the profile.
 */
export const fieldText = (def: ControlFieldDef, value: string, focused: boolean): string =>
  focused ? value : groupedText(def, value);

/** `= £19,800/yr` under a monthly field. Null for every other kind, and for a draft that is not a number. */
export function annualEquivalent(def: ControlFieldDef, stored: number): string | null {
  if (def.kind !== 'monthlyMoney' || !Number.isFinite(stored)) return null;
  return `= ${money(stored * 12)}/yr`;
}

/** Well-formed thousands grouping, the only comma pattern accepted: `1,234`, `1,234.50`, `12,345,678`. */
const GROUPED = /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

/**
 * The field's own unit, typed or pasted back into the field that displays it.
 *
 * `£55,000` copied off a payslip into a box already labelled £ is not a mistake, so the adornment
 * this very field shows is removed before parsing. Any *other* stray character still is a mistake:
 * `£12` in a percent box, or a stray letter anywhere, stays NaN.
 */
function stripUnit(def: ControlFieldDef, text: string): string {
  const { prefix, suffix } = fieldAffix(def.kind);
  let out = text;
  if (prefix !== undefined && out.startsWith(prefix)) out = out.slice(prefix.length).trim();
  if (suffix !== undefined && out.toLowerCase().endsWith(suffix.toLowerCase())) {
    out = out.slice(0, out.length - suffix.length).trim();
  }
  return out;
}

/**
 * Draft text → the number the reader meant, still in *display* units (a percent field yields 90,
 * not 0.9). `fromDisplay` divides by the scale; this is the shared parsing rule underneath it, so
 * the box, the arrow keys and the validator can never disagree about what counts as a number.
 *
 * Grouping is accepted only when it is *correct* grouping: `1,234.50` is 1234.5, while `1,2,3` is
 * somebody's typo and stays NaN rather than being guessed at as 123.
 */
export function parseDisplayText(def: ControlFieldDef, text: string): number {
  const trimmed = stripUnit(def, text.trim());
  if (trimmed === '') return Number.NaN;
  const parsed = Number(GROUPED.test(trimmed) ? trimmed.replace(/,/g, '') : trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Trims the binary-representation noise that stepping by 0.1 introduces. */
const tidy = (value: number): number => Number(value.toPrecision(12));

/**
 * Arrow-key stepping, in display units — `step` is what the old `type="number"` stepped by.
 *
 * Returns null when the draft is not a number, so an unparseable entry is never quietly replaced by
 * a made-up one: the NaN reaches `profileSchema` and the reader sees why it was rejected.
 */
export function stepDraft(def: ControlFieldDef, text: string, direction: 1 | -1): string | null {
  const base = text.trim() === '' ? 0 : parseDisplayText(def, text);
  if (!Number.isFinite(base)) return null;
  const step = def.step > 0 ? def.step : 1;
  return String(tidy(base + direction * step));
}
