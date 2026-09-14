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
import { createExampleProfile } from '../../domain/fixtures.js';
import {
  applyDrafts, fieldsFor, pruneDrafts, validateCandidate,
  type FieldGroupId, type FieldIssue, type NumberFieldDef, type ValidationState,
} from '../view/fields.js';

export interface ProfileStore {
  base: Profile;
  drafts: Readonly<Record<string, string>>;
  defs: readonly NumberFieldDef[];
  validation: ValidationState;
  /** The validated profile, or null while the form has an error. */
  profile: Profile | null;
  /** The profile a structural edit should be applied to: validated if possible, otherwise the base. */
  editable: Profile;
  errorsFor: (fieldId: string) => readonly string[];
  issuesForGroup: (group: FieldGroupId) => readonly FieldIssue[];
  /** Issues that belong to no single field, such as floor ≤ target ≤ comfort. */
  crossFieldIssues: readonly FieldIssue[];
  setDraft: (fieldId: string, text: string) => void;
  edit: (updater: (profile: Profile) => Profile) => void;
  reset: () => void;
}

export function useProfileStore(): ProfileStore {
  const [base, setBase] = useState<Profile>(createExampleProfile);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const defs = useMemo(() => fieldsFor(base), [base]);
  const validation = useMemo(() => validateCandidate(applyDrafts(base, drafts, defs), defs), [base, drafts, defs]);
  const profile = validation.ok ? validation.profile : null;
  const editable = profile ?? base;

  const byField = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of validation.issues) {
      if (issue.fieldId === null) continue;
      const existing = map.get(issue.fieldId);
      if (existing) existing.push(issue.message);
      else map.set(issue.fieldId, [issue.message]);
    }
    return map;
  }, [validation]);

  const errorsFor = useCallback((fieldId: string) => byField.get(fieldId) ?? [], [byField]);
  const issuesForGroup = useCallback(
    (group: FieldGroupId) => validation.issues.filter(issue => issue.group === group && issue.fieldId === null),
    [validation],
  );
  const crossFieldIssues = useMemo(() => validation.issues.filter(issue => issue.fieldId === null), [validation]);

  const setDraft = useCallback((fieldId: string, text: string) => {
    setDrafts(previous => ({ ...previous, [fieldId]: text }));
  }, []);

  const edit = useCallback((updater: (profile: Profile) => Profile) => {
    const next = updater(editable);
    setBase(next);
    setDrafts(previous => pruneDrafts(next, previous));
  }, [editable]);

  const reset = useCallback(() => {
    setBase(createExampleProfile());
    setDrafts({});
  }, []);

  return {
    base, drafts, defs, validation, profile, editable,
    errorsFor, issuesForGroup, crossFieldIssues, setDraft, edit, reset,
  };
}
