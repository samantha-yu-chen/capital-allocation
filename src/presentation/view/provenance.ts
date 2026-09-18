/**
 * Which values are the app's and which are the reader's.
 *
 * The complaint this answers is a plain one: every box on the form shows a number, and nothing says
 * whether that number is a curated default or something you typed. So each registry entry is
 * compared against the same entry in the starter profile (`starter-profile.ts`) and reported as
 * `default` or `edited`.
 *
 * Two rules keep the comparison honest:
 *
 * 1. **Stored values, never display strings.** A percent field shows `0.07` as `7`; so does
 *    `0.07000000000000001`. Comparing what is on screen would call a real edit a default. Numbers
 *    are compared with `Object.is`, and structures with a key-ordered serialisation.
 * 2. **No default is invented.** A field the starter has no value for — a phase row, a property the
 *    starter does not include — has nothing to be equal to, so it reads as `edited` and offers no
 *    reset. Resetting to a made-up number would be worse than offering nothing.
 *
 * This module is pure data work: it reads two profiles and returns descriptions. Applying a reset
 * produces a new profile which the caller feeds through the normal draft/validation machinery, so
 * `profileSchema` judges a reset exactly as it judges anything typed.
 */
import type { Profile } from '../../domain/contracts.js';
import {
  fieldsFor, choiceFieldsFor, toDisplay, writePath,
  type ChoiceFieldDef, type FieldGroupId, type NumberFieldDef,
} from './fields.js';

export type Provenance = 'default' | 'edited';

/** A registry entry addressed by its dot-joined profile path, numeric or otherwise. */
export interface ProvenanceEntry {
  id: string;
  label: string;
  group: FieldGroupId;
  state: Provenance;
  /** The starter's value as this control would show it, or null when the starter has none. */
  defaultDisplay: string | null;
  /** True when a reset has a value to restore. */
  resettable: boolean;
  /** One sentence for a tooltip and for assistive technology. */
  note: string;
  /** The reset control's accessible name; meaningful only when `resettable`. */
  resetLabel: string;
}

/** The value a path holds, or `MISSING` when the profile has no such path at all. */
const MISSING = Symbol('missing');

function valueAt(profile: Profile, path: readonly (string | number)[]): unknown | typeof MISSING {
  let node: unknown = profile;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return MISSING;
    if (!(key in (node as Record<string | number, unknown>))) return MISSING;
    node = (node as Record<string | number, unknown>)[key];
  }
  return node;
}

/** Key-ordered so that two structurally equal objects serialise identically. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

function sameValue(mine: unknown, theirs: unknown): boolean {
  if (typeof mine === 'number' && typeof theirs === 'number') return Object.is(mine, theirs);
  if (mine === null || typeof mine !== 'object') return mine === theirs;
  if (theirs === null || typeof theirs !== 'object') return false;
  return stable(mine) === stable(theirs);
}

const pathOf = (id: string): readonly (string | number)[] =>
  id.split('.').map(part => /^\d+$/.test(part) ? Number(part) : part);

/**
 * Every registry entry's provenance, keyed by field id.
 *
 * The entries come from the working profile: a row the reader added exists here and is `edited`,
 * and a row only the starter has is simply absent, because there is no control to mark.
 */
export function provenance(profile: Profile, starter: Profile): Map<string, Provenance> {
  const map = new Map<string, Provenance>();
  for (const def of fieldsFor(profile)) map.set(def.id, stateOf(profile, starter, def.path));
  for (const def of choiceFieldsFor(profile)) map.set(def.id, stateOf(profile, starter, pathOf(def.id)));
  return map;
}

function stateOf(profile: Profile, starter: Profile, path: readonly (string | number)[]): Provenance {
  const theirs = valueAt(starter, path);
  if (theirs === MISSING) return 'edited';
  const mine = valueAt(profile, path);
  if (mine === MISSING) return 'edited';
  return sameValue(mine, theirs) ? 'default' : 'edited';
}

/** How a choice control's stored value reads to a person: an option's label, or yes/no. */
function choiceDisplay(def: ChoiceFieldDef, value: unknown): string {
  if (def.control === 'checkbox') return value === null || value === false ? 'off' : 'on';
  if (def.control === 'editor') {
    if (Array.isArray(value)) return value.length === 0 ? 'nothing set' : `${value.length} entered`;
    return 'as supplied';
  }
  if (typeof value === 'string') {
    const option = def.options?.find(item => item.value === value);
    return option ? option.label : value;
  }
  return String(value);
}

const UNIT_SUFFIX: Record<NumberFieldDef['kind'], string> = {
  money: '', monthlyMoney: ' a month', percent: '%', age: '', integer: '', decimal: '', multiple: '×',
};

function numberDisplay(def: NumberFieldDef, value: unknown): string | null {
  if (typeof value !== 'number') return null;
  const shown = toDisplay(def, value);
  if (shown === '') return null;
  if (def.kind === 'money' || def.kind === 'monthlyMoney') return `£${shown}${UNIT_SUFFIX[def.kind]}`;
  if (def.kind === 'age') return `age ${shown}`;
  return `${shown}${UNIT_SUFFIX[def.kind]}`;
}

function describe(
  id: string, label: string, group: FieldGroupId, state: Provenance,
  defaultDisplay: string | null, derivedFrom: string | undefined,
): ProvenanceEntry {
  const origin = derivedFrom === undefined ? '' : ` The default is ${derivedFrom}.`;
  const resettable = defaultDisplay !== null;
  const note = !resettable
    ? `${label} is yours: the starter profile has no value for it, so there is nothing to reset it to.`
    : state === 'edited'
      ? `${label} is yours. The starter profile’s value is ${defaultDisplay}.${origin}`
      : `${label} is the starter profile’s value, ${defaultDisplay}, not something you entered.${origin}`;
  return {
    id, label, group, state, defaultDisplay, resettable, note,
    resetLabel: resettable ? `Reset ${label} to the default ${defaultDisplay}` : `${label} has no default`,
  };
}

/** The described form of `provenance`, with the wording each control shows. */
export function fieldProvenance(profile: Profile, starter: Profile): Map<string, ProvenanceEntry> {
  const map = new Map<string, ProvenanceEntry>();
  for (const def of fieldsFor(profile)) {
    const theirs = valueAt(starter, def.path);
    map.set(def.id, describe(def.id, def.label, def.group, stateOf(profile, starter, def.path),
      theirs === MISSING ? null : numberDisplay(def, theirs), def.derivedFrom));
  }
  for (const def of choiceFieldsFor(profile)) {
    const path = pathOf(def.id);
    const theirs = valueAt(starter, path);
    map.set(def.id, describe(def.id, def.label, def.group, stateOf(profile, starter, path),
      theirs === MISSING ? null : choiceDisplay(def, theirs), def.derivedFrom));
  }
  return map;
}

/** Entries that differ from the starter, in registry order. */
export function editedEntries(entries: ReadonlyMap<string, ProvenanceEntry>): ProvenanceEntry[] {
  return [...entries.values()].filter(entry => entry.state === 'edited');
}

/** Ids in one group that differ from the starter and have a default to go back to. */
export function resettableInGroup(entries: ReadonlyMap<string, ProvenanceEntry>, group: FieldGroupId): string[] {
  return editedEntries(entries).filter(entry => entry.group === group && entry.resettable).map(entry => entry.id);
}

/**
 * The profile with the named entries put back to their starter values.
 *
 * An id with no starter value is skipped rather than guessed at. Writing a whole subtree (a
 * property, a phase list, the correlation matrix) is one write, so resetting a composite editor
 * restores it in full. The result is a candidate like any other: the caller must revalidate it.
 */
export function resetToStarter(profile: Profile, starter: Profile, ids: readonly string[]): Profile {
  const numeric = new Map(fieldsFor(profile).map(def => [def.id, def.path] as const));
  let next = profile;
  for (const id of ids) {
    const path = numeric.get(id) ?? pathOf(id);
    const value = valueAt(starter, path);
    if (value === MISSING) continue;
    next = writePath(next, path, structuredClone(value));
  }
  return next;
}

/** The ids a reset of `id` invalidates: itself and anything stored beneath it. */
export function draftsClearedBy(id: string, draftIds: Iterable<string>): string[] {
  return [...draftIds].filter(draft => draft === id || draft.startsWith(`${id}.`));
}

/** A one-line summary for the form: how much of what is on screen is the reader's own. */
export function provenanceSummary(entries: ReadonlyMap<string, ProvenanceEntry>): string {
  const edited = editedEntries(entries).length;
  const total = entries.size;
  if (edited === 0) return `Every one of these ${total} values is still the starter profile’s.`;
  return `${edited} of ${total} values ${edited === 1 ? 'is' : 'are'} yours; the rest are the starter profile’s.`;
}
