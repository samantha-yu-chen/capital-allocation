/**
 * UX-11: "take me to the input behind this figure".
 *
 * Up to now the field registry could say what an input is, what tier it sits at and which group owns
 * it, but nothing could answer the reader's actual question after choosing a starter situation —
 * *where do I change this?* A card advertised twelve figures and none of them said where they came
 * from, which is a dead end, not a shortcut.
 *
 * This module is the React-free half of the answer. It resolves a registry id to a target (its name,
 * its group, the destination whose form holds that group, and its tier), works out the smallest
 * change to the tier filter that would put the target on screen, and authors the sentence the reader
 * is shown when that filter moves. It holds no state, touches no profile and starts nothing: the
 * component layer does the scrolling and the focusing, and that is all it does.
 *
 * Two rules it exists to keep:
 *
 * - **A link that cannot land is not offered.** `fieldTarget` returns null for an id the current
 *   profile has no input for (property fields on a profile with no property), so a caller renders
 *   plain text rather than a button that would do nothing.
 * - **The filter never moves silently.** Raising the reader's chosen depth is display-only and
 *   therefore safe (UX-1), but it is still their setting. `tierRaiseNote` is the sentence that says
 *   what moved and why, and a surface that raises the filter without showing it fails the audit.
 */
import type { Profile } from '../../domain/contracts.js';
import {
  FIELD_GROUPS, TIER_MODES, choiceFieldsFor, fieldName, fieldsFor, tierInMode,
  type FieldGroupId, type FieldTier, type TierMode,
} from './fields.js';
import type { TabId } from './tabs.js';

/**
 * Which destination's form holds each registry group.
 *
 * The Overview form renders every group except the property one, which the Property & Leverage
 * screen owns. A jump has to know, or it lands on a screen where the input is not rendered at all.
 */
export const GROUP_SCREEN: Record<FieldGroupId, TabId> = {
  personal: 'overview', income: 'overview', household: 'overview', spending: 'overview',
  assets: 'overview', pension: 'overview', wrappers: 'overview', liquidity: 'overview',
  portfolios: 'overview', market: 'overview', simulation: 'overview',
  property: 'property',
};

export interface FieldTarget {
  /** The registry id, which is also the DOM id of the control that edits it. */
  id: string;
  /** What the control is called on screen, through `fieldName` like every other reader-facing name. */
  name: string;
  group: FieldGroupId;
  groupLabel: string;
  tier: FieldTier;
  screen: TabId;
}

const groupLabel = (group: FieldGroupId): string =>
  FIELD_GROUPS.find(entry => entry.id === group)?.label ?? group;

/** Every registry entry this profile actually renders an input for, numeric and choice alike. */
export function navigableFields(profile: Profile): Map<string, FieldTarget> {
  const targets = new Map<string, FieldTarget>();
  const add = (def: { id: string; label: string; plainLabel?: string; group: FieldGroupId; tier: FieldTier }) => {
    targets.set(def.id, {
      id: def.id, name: fieldName(def), group: def.group, groupLabel: groupLabel(def.group),
      tier: def.tier, screen: GROUP_SCREEN[def.group],
    });
  };
  for (const def of fieldsFor(profile)) add(def);
  for (const def of choiceFieldsFor(profile)) add(def);
  return targets;
}

/**
 * The target behind one id, or null when this profile has no such input.
 *
 * Null is the honest answer rather than a failure: a fact about a property is a fact about a profile
 * that has one, and a reader whose profile does not is better served by plain text than by a button
 * that would scroll to nothing.
 */
export const fieldTarget = (profile: Profile, id: string): FieldTarget | null =>
  navigableFields(profile).get(id) ?? null;

/** The first of these ids this profile can actually show, so a fact falls back rather than breaking. */
export function firstFieldTarget(profile: Profile, ids: readonly string[]): FieldTarget | null {
  const targets = navigableFields(profile);
  for (const id of ids) {
    const target = targets.get(id);
    if (target) return target;
  }
  return null;
}

/** The shallowest depth that reveals a tier at all. */
export const modeShowing = (tier: FieldTier): TierMode =>
  tier === 'expert' ? 'all' : tier === 'common' ? 'common' : 'essential';

/**
 * The depth a form must move to for this tier to be on screen, or null when it already is.
 *
 * It only ever widens: a reader who is looking at everything is not narrowed to "essential + common"
 * because the field they asked for happens to be essential.
 */
export const raiseModeFor = (tier: FieldTier, current: TierMode): TierMode | null =>
  tierInMode(tier, current) ? null : modeShowing(tier);

const modeLabel = (mode: TierMode): string =>
  TIER_MODES.find(option => option.mode === mode)?.label ?? mode;

/**
 * What the reader is told when their chosen depth moved under them.
 *
 * Filtering is display-only — no value, no validation and no run key moves with it (UX-1) — so
 * raising it is safe. It is still their setting, so it is never changed without saying so.
 */
export const tierRaiseNote = (target: FieldTarget, to: TierMode): string =>
  `Detail raised to “${modeLabel(to)}” so that “${target.name}” is on screen. `
  + 'Nothing about your plan changed: which inputs are shown is a display setting, and you can set it back above.';

/** Where a jump landed, said plainly, so the reader knows the form moved on purpose. */
export const fieldArrivalNote = (target: FieldTarget): string =>
  `“${target.name}” is under ${target.groupLabel}, and it is now focused.`;

/** A request to put one registry input in front of the reader. The counter makes a repeat a new request. */
export interface FieldFocusRequest {
  fieldId: string;
  /** Strictly increasing, so asking for the same field twice is two requests rather than one. */
  sequence: number;
}

export const nextFocusRequest = (previous: FieldFocusRequest | null, fieldId: string): FieldFocusRequest =>
  ({ fieldId, sequence: (previous?.sequence ?? 0) + 1 });
