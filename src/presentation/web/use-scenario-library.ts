/**
 * The saved scenario library, held in the browser's local storage.
 *
 * Storage is a seam (`ScenarioStorage`), so the same load/migrate/reject logic runs under Node in
 * tests. Nothing read back from storage is trusted: `loadScenarioLibrary` re-validates every
 * profile, migrates an older document explicitly and reports what it rejected. A library that
 * fails to load leaves the in-memory library empty and says so; it is never silently replaced.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile } from '../../domain/contracts.js';
import {
  addScenario, emptyLibrary, loadScenarioLibrary, removeScenario, replaceScenario,
  saveScenarioLibrary, serialiseLibrary,
  type NewScenario, type ScenarioLibrary, type ScenarioStorage,
} from '../../domain/scenarios.js';

export const SCENARIO_STORAGE_KEY = 'capital-allocation.scenarios';

/** A storage that cannot be reached (private mode, disabled storage) behaves as an empty one. */
export function browserScenarioStorage(key = SCENARIO_STORAGE_KEY): ScenarioStorage {
  const store = (): Storage | null => {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
  };
  return {
    read: () => { try { return store()?.getItem(key) ?? null; } catch { return null; } },
    write: text => { try { store()?.setItem(key, text); } catch { /* reported by the caller's reload */ } },
    clear: () => { try { store()?.removeItem(key); } catch { /* ignored */ } },
  };
}

export type LibraryStatus =
  | { kind: 'idle' }
  | { kind: 'loaded'; scenarios: number; migratedFrom: string | null; savedAt: string }
  | { kind: 'saved'; scenarios: number; savedAt: string }
  | { kind: 'rejected'; issues: readonly string[] };

export interface ScenarioLibraryStore {
  library: ScenarioLibrary;
  status: LibraryStatus;
  add: (input: NewScenario) => void;
  update: (id: string, changes: Partial<NewScenario>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  /** Replace the whole library from pasted JSON, validating and migrating it first. */
  importText: (text: string) => void;
  exportText: () => string;
  reload: () => void;
  forget: () => void;
}

export function useScenarioLibrary(storage: ScenarioStorage = browserScenarioStorage()): ScenarioLibraryStore {
  const [library, setLibrary] = useState<ScenarioLibrary>(() => emptyLibrary());
  const [status, setStatus] = useState<LibraryStatus>({ kind: 'idle' });
  const store = useRef(storage);

  const persist = useCallback((next: ScenarioLibrary) => {
    try {
      const saved = saveScenarioLibrary(store.current, next);
      setLibrary(saved);
      setStatus({ kind: 'saved', scenarios: saved.scenarios.length, savedAt: saved.savedAt });
    } catch (error) {
      setStatus({ kind: 'rejected', issues: [error instanceof Error ? error.message : String(error)] });
    }
  }, []);

  const reload = useCallback(() => {
    const text = store.current.read();
    if (text === null || text.trim() === '') {
      setLibrary(emptyLibrary());
      setStatus({ kind: 'idle' });
      return;
    }
    const result = loadScenarioLibrary(text);
    if (!result.ok) {
      setLibrary(emptyLibrary());
      setStatus({ kind: 'rejected', issues: result.issues });
      return;
    }
    setLibrary(result.library);
    setStatus({ kind: 'loaded', scenarios: result.library.scenarios.length, migratedFrom: result.migratedFrom, savedAt: result.library.savedAt });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const mutate = useCallback((change: (current: ScenarioLibrary) => ScenarioLibrary) => {
    setLibrary(current => {
      let next: ScenarioLibrary;
      try { next = change(current); } catch (error) {
        setStatus({ kind: 'rejected', issues: [error instanceof Error ? error.message : String(error)] });
        return current;
      }
      persist(next);
      return next;
    });
  }, [persist]);

  return {
    library, status,
    add: useCallback((input: NewScenario) => mutate(current => addScenario(current, input)), [mutate]),
    update: useCallback((id, changes) => mutate(current => replaceScenario(current, id, changes)), [mutate]),
    remove: useCallback(id => mutate(current => removeScenario(current, id)), [mutate]),
    duplicate: useCallback(id => mutate(current => {
      const found = current.scenarios.find(s => s.id === id);
      if (!found) throw new RangeError(`Unknown scenario ${id}`);
      return addScenario(current, { name: `${found.name} copy`, profile: found.profile as Profile,
        options: found.options, origin: found.origin, note: found.note });
    }), [mutate]),
    importText: useCallback((text: string) => {
      const result = loadScenarioLibrary(text);
      if (!result.ok) { setStatus({ kind: 'rejected', issues: result.issues }); return; }
      persist(result.library);
    }, [persist]),
    exportText: useCallback(() => serialiseLibrary(library), [library]),
    reload,
    forget: useCallback(() => { store.current.clear(); setLibrary(emptyLibrary()); setStatus({ kind: 'idle' }); }, []),
  };
}
