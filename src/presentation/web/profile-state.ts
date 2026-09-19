/**
 * Profile editing state.
 *
 * `base` is the last structurally committed profile and `drafts` holds in-flight text keyed by
 * field id. The two are folded together and revalidated on every keystroke, so the engines only
 * ever see a profile that `profileSchema` accepted — an unparseable box becomes `NaN` and fails
 * validation instead of silently reusing the previous value.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Profile } from '../../domain/contracts.js';
import {
  applyDrafts, fieldsFor, pruneDrafts, validateCandidate,
  type FieldGroupId, type FieldIssue, type NumberFieldDef, type ValidationState,
} from '../view/fields.js';
import {
  draftsClearedBy, fieldProvenance, resetToStarter, resettableInGroup, type ProvenanceEntry,
} from '../view/provenance.js';
import { issueFields, plainIssues } from '../view/messages.js';
import { DEFAULT_STARTER_ID, starterProfile } from '../../domain/starter-situations.js';
import { starterName, starterProvenanceNote } from '../view/starter-picker.js';

export interface ProfileStore {
  base: Profile;
  drafts: Readonly<Record<string, string>>;
  defs: readonly NumberFieldDef[];
  validation: ValidationState;
  /** The validated profile, or null while the form has an error. */
  profile: Profile | null;
  /** The same issues, in ordinary words. `validation.issues` keeps the schema's own wording. */
  plainIssues: readonly FieldIssue[];
  /** The profile a structural edit should be applied to: validated if possible, otherwise the base. */
  editable: Profile;
  errorsFor: (fieldId: string) => readonly string[];
  issuesForGroup: (group: FieldGroupId) => readonly FieldIssue[];
  /** Issues that belong to no single field, such as floor ≤ target ≤ comfort. */
  crossFieldIssues: readonly FieldIssue[];
  setDraft: (fieldId: string, text: string) => void;
  edit: (updater: (profile: Profile) => Profile) => void;
  /** Whether each registry entry still holds the starter profile's value, and what that value is. */
  provenance: ReadonlyMap<string, ProvenanceEntry>;
  /** The starter situation the form is measured against, and how it is named and explained. */
  starterId: string;
  starterName: string;
  starterNote: string;
  /**
   * Adopt a starter situation: it becomes both the values on the form and the baseline provenance
   * compares against. It runs nothing, and it is reversible — every situation stays choosable.
   */
  chooseStarter: (id: string) => void;
  /** Put one entry back to the starter value. A reset is an edit: the schema judges it as one. */
  resetField: (fieldId: string) => void;
  /** Put every edited entry in one group back, leaving the rest of the form alone. */
  resetGroup: (group: FieldGroupId) => void;
  reset: () => void;
}

export function useProfileStore(): ProfileStore {
  const [starterId, setStarterId] = useState<string>(DEFAULT_STARTER_ID);
  const [base, setBase] = useState<Profile>(() => starterProfile(DEFAULT_STARTER_ID));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /**
   * One starter at a time, so every reset means the same thing. Choosing another is an explicit act
   * that replaces the form and the baseline together — they are never allowed to disagree, because
   * a baseline the values did not come from would mark real defaults as edits.
   */
  const starter = useMemo(() => starterProfile(starterId), [starterId]);

  const defs = useMemo(() => fieldsFor(base), [base]);
  const validation = useMemo(() => validateCandidate(applyDrafts(base, drafts, defs), defs), [base, drafts, defs]);
  const profile = validation.ok ? validation.profile : null;
  const editable = profile ?? base;

  /**
   * What the reader is shown.
   *
   * `profileSchema` is untouched — `validation.issues` still carries its exact wording, and the
   * filter and the run key still read it — but every message that reaches a screen goes through the
   * plain-language map first. A rule nobody has written a rewrite for keeps the schema's own words
   * rather than being given a vague friendly sentence.
   */
  const fields = useMemo(() => issueFields(base), [base]);
  const readable = useMemo(() => plainIssues(validation.issues, fields), [validation, fields]);

  const byField = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of readable) {
      if (issue.fieldId === null) continue;
      const existing = map.get(issue.fieldId);
      if (existing) existing.push(issue.message);
      else map.set(issue.fieldId, [issue.message]);
    }
    return map;
  }, [readable]);

  const errorsFor = useCallback((fieldId: string) => byField.get(fieldId) ?? [], [byField]);
  const issuesForGroup = useCallback(
    (group: FieldGroupId) => readable.filter(issue => issue.group === group && issue.fieldId === null),
    [readable],
  );
  const crossFieldIssues = useMemo(() => readable.filter(issue => issue.fieldId === null), [readable]);

  const setDraft = useCallback((fieldId: string, text: string) => {
    setDrafts(previous => ({ ...previous, [fieldId]: text }));
  }, []);

  const edit = useCallback((updater: (profile: Profile) => Profile) => {
    const next = updater(editable);
    setBase(next);
    setDrafts(previous => pruneDrafts(next, previous));
  }, [editable]);

  /**
   * Provenance describes what is in the boxes, not what last passed validation.
   *
   * So it reads the drafted candidate rather than `editable`: while any field is mid-edit and the
   * profile as a whole is invalid, the other fields must still say whose values they hold, and a
   * box holding an unparseable draft is certainly not holding the default any more. The candidate
   * has the shape of `base` with the drafts written into it, so the registry still resolves.
   */
  const drafted = useMemo(
    () => applyDrafts(base, drafts, defs) as Profile,
    [base, drafts, defs],
  );
  const provenance = useMemo(() => fieldProvenance(drafted, starter), [drafted, starter]);

  /**
   * A reset is an ordinary edit. It writes the starter's value into the profile and drops only the
   * drafts it invalidates — a half-typed number in another box stays exactly where it was, so its
   * validation error is still reported rather than being tidied away by an unrelated click.
   */
  const resetIds = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    const next = resetToStarter(editable, starter, ids);
    setBase(next);
    setDrafts(previous => {
      const cleared = new Set(ids.flatMap(id => draftsClearedBy(id, Object.keys(previous))));
      return pruneDrafts(next, Object.fromEntries(
        Object.entries(previous).filter(([key]) => !cleared.has(key))));
    });
  }, [editable, starter]);

  const resetField = useCallback((fieldId: string) => resetIds([fieldId]), [resetIds]);
  const resetGroup = useCallback(
    (group: FieldGroupId) => resetIds(resettableInGroup(provenance, group)),
    [resetIds, provenance],
  );

  const reset = useCallback(() => {
    setBase(starterProfile(starterId));
    setDrafts({});
  }, [starterId]);

  /**
   * Choosing a situation is a fresh parse, not an assignment: the form and the baseline are two
   * independent copies, so editing the form can never reach into the thing it is compared against.
   * Drafts are dropped because they were text typed against a profile that no longer exists.
   */
  const chooseStarter = useCallback((id: string) => {
    setStarterId(id);
    setBase(starterProfile(id));
    setDrafts({});
  }, []);

  return {
    base, drafts, defs, validation, profile, editable, plainIssues: readable,
    errorsFor, issuesForGroup, crossFieldIssues, setDraft, edit,
    provenance, resetField, resetGroup, reset,
    starterId, starterName: starterName(starterId), starterNote: starterProvenanceNote(starterId),
    chooseStarter,
  };
}
