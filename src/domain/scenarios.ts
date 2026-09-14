/**
 * Named scenarios and their versioned local library (spec sections 64 and 66).
 *
 * A scenario is a *name*, a validated `Profile` and the run options that belong to the plan rather
 * than to the transport. `profileSchema` remains the only validation authority: a scenario is
 * constructed by parsing, so a scenario can never hold a profile an engine would reject.
 *
 * Two rules make saved data trustworthy:
 *
 * - **Nothing persisted is trusted.** `loadScenarioLibrary` re-parses every stored profile through
 *   the same schema the UI uses. A document from an older schema version is migrated explicitly;
 *   an unknown version, a wrong document kind, a duplicate id or an invalid profile is rejected
 *   with reasons, never silently repaired or partially loaded.
 * - **Scenarios never share structure.** Every constructor and mutator returns freshly parsed,
 *   deep-copied data, so editing one scenario cannot reach into another. `tests/scenario.test.ts`
 *   asserts that rather than relying on it.
 */
import { z } from 'zod';
import { parseProfile, profileSchema, type Profile } from './contracts.js';

/**
 * The plan-level run options a scenario owns. Deliberately a subset of `LedgerOptions`: solver
 * tolerances are numerical transport, and `marginalAction` / `rentInvestment` / `measureAllocation`
 * belong to the marginal and property comparisons and stay at their defaults for scenario runs.
 */
export const scenarioOptionsSchema = z.strictObject({
  retirementLevel: z.enum(['floor', 'target', 'comfort']),
  /** Spec sections 21 and 61: replaces the household monthly total in working AND retirement years. */
  monthlyHouseholdOverride: z.number().finite().nonnegative().nullable(),
  fundEmergencyReserve: z.boolean(),
  surplusAllocation: z.enum(['isa_then_gia', 'gia_only', 'cash_only']),
});
export type ScenarioOptions = z.infer<typeof scenarioOptionsSchema>;

export const defaultScenarioOptions = (): ScenarioOptions => ({
  retirementLevel: 'target', monthlyHouseholdOverride: null,
  fundEmergencyReserve: true, surplusAllocation: 'isa_then_gia',
});

export const SCENARIO_SCHEMA_VERSION = '2';

export const scenarioSchema = z.strictObject({
  schemaVersion: z.literal('2'),
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  /** The preset id this scenario was created from, or `custom`. Free text so the domain stays engine independent. */
  origin: z.string().trim().min(1).max(64),
  note: z.string().max(400),
  options: scenarioOptionsSchema,
  profile: profileSchema,
});
export type Scenario = z.infer<typeof scenarioSchema>;

/** Schema 1 (chunk 1): no options, no origin, no note. Retained only so saved data can be migrated. */
export const scenarioSchemaV1 = z.strictObject({
  schemaVersion: z.literal('1'), id: z.string().min(1),
  name: z.string().trim().min(1).max(120), profile: profileSchema,
});

export const SCENARIO_LIBRARY_KIND = 'capital-allocation/scenario-library';
export const SCENARIO_LIBRARY_VERSION = '2';
export const MAX_SCENARIOS = 40;

export const scenarioLibrarySchema = z.strictObject({
  kind: z.literal(SCENARIO_LIBRARY_KIND),
  version: z.literal(SCENARIO_LIBRARY_VERSION),
  savedAt: z.string().min(1),
  scenarios: z.array(scenarioSchema).max(MAX_SCENARIOS),
}).superRefine((library, ctx) => {
  const ids = new Set<string>(), names = new Set<string>();
  for (const scenario of library.scenarios) {
    if (ids.has(scenario.id)) ctx.addIssue({ code: 'custom', path: ['scenarios'], message: `Duplicate scenario id ${scenario.id}` });
    if (names.has(scenario.name.toLowerCase())) ctx.addIssue({ code: 'custom', path: ['scenarios'], message: `Duplicate scenario name ${scenario.name}` });
    ids.add(scenario.id);
    names.add(scenario.name.toLowerCase());
  }
});
export type ScenarioLibrary = z.infer<typeof scenarioLibrarySchema>;

const libraryV1Schema = z.strictObject({
  kind: z.literal(SCENARIO_LIBRARY_KIND), version: z.literal('1'),
  savedAt: z.string().min(1), scenarios: z.array(scenarioSchemaV1).max(MAX_SCENARIOS),
});

export const emptyLibrary = (savedAt = new Date(0).toISOString()): ScenarioLibrary =>
  ({ kind: SCENARIO_LIBRARY_KIND, version: SCENARIO_LIBRARY_VERSION, savedAt, scenarios: [] });

let counter = 0;
/** Ids only have to be unique inside one library; they are never a security boundary. */
export function scenarioId(name: string): string {
  counter += 1;
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${slug || 'scenario'}-${counter.toString(36)}`;
}

export interface NewScenario {
  name: string; profile: Profile; options?: ScenarioOptions; origin?: string; note?: string; id?: string;
}

/** Parses, so the stored profile is a validated deep copy that shares no structure with the caller's. */
export function createScenario(input: NewScenario): Scenario {
  return scenarioSchema.parse({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: input.id ?? scenarioId(input.name),
    name: input.name,
    origin: input.origin ?? 'custom',
    note: input.note ?? '',
    options: input.options ?? defaultScenarioOptions(),
    profile: parseProfile(input.profile),
  });
}

/** A copy under a new id and name. The duplicate's profile is re-parsed, never aliased. */
export const duplicateScenario = (scenario: Scenario, name: string): Scenario =>
  createScenario({ name, profile: scenario.profile, options: scenario.options, origin: scenario.origin, note: scenario.note });

export const updateScenario = (scenario: Scenario, changes: Partial<NewScenario>): Scenario =>
  createScenario({
    id: scenario.id, name: changes.name ?? scenario.name, profile: changes.profile ?? scenario.profile,
    options: changes.options ?? scenario.options, origin: changes.origin ?? scenario.origin,
    note: changes.note ?? scenario.note,
  });

const unique = (library: ScenarioLibrary, name: string, exceptId?: string): string => {
  const taken = new Set(library.scenarios.filter(s => s.id !== exceptId).map(s => s.name.trim().toLowerCase()));
  const base = name.trim() || 'Scenario';
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
  throw new RangeError('Could not find an unused scenario name');
};

/** Name collisions are resolved by suffixing, so adding a scenario never silently replaces one. */
export function addScenario(library: ScenarioLibrary, input: NewScenario): ScenarioLibrary {
  if (library.scenarios.length >= MAX_SCENARIOS) throw new RangeError(`A library holds at most ${MAX_SCENARIOS} scenarios`);
  const scenario = createScenario({ ...input, name: unique(library, input.name) });
  return scenarioLibrarySchema.parse({ ...library, scenarios: [...library.scenarios, scenario] });
}

export function replaceScenario(library: ScenarioLibrary, id: string, changes: Partial<NewScenario>): ScenarioLibrary {
  const found = library.scenarios.find(s => s.id === id);
  if (!found) throw new RangeError(`Unknown scenario ${id}`);
  const next = updateScenario(found, changes.name === undefined ? changes : { ...changes, name: unique(library, changes.name, id) });
  return scenarioLibrarySchema.parse({ ...library, scenarios: library.scenarios.map(s => s.id === id ? next : s) });
}

export const removeScenario = (library: ScenarioLibrary, id: string): ScenarioLibrary =>
  scenarioLibrarySchema.parse({ ...library, scenarios: library.scenarios.filter(s => s.id !== id) });

export const serialiseLibrary = (library: ScenarioLibrary, savedAt = new Date().toISOString()): string =>
  JSON.stringify(scenarioLibrarySchema.parse({ ...library, savedAt }), null, 2);

export type ScenarioLoad =
  | { ok: true; library: ScenarioLibrary; migratedFrom: string | null }
  | { ok: false; issues: string[] };

const issues = (error: unknown): string[] => error instanceof z.ZodError
  ? error.issues.map(i => `${i.path.join('.') || 'document'}: ${i.message}`)
  : [error instanceof Error ? error.message : String(error)];

/**
 * Validate and, where necessary, migrate a stored library.
 *
 * The document's own `version` selects the migration; a version this build does not know is
 * rejected rather than parsed optimistically, because a newer document can contain fields whose
 * meaning this engine does not implement.
 */
export function loadScenarioLibrary(input: unknown): ScenarioLoad {
  let document = input;
  if (typeof document === 'string') {
    try { document = JSON.parse(document); } catch (error) { return { ok: false, issues: issues(error) }; }
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document))
    return { ok: false, issues: ['A scenario library must be a JSON object'] };
  const record = document as Record<string, unknown>;
  if (record['kind'] !== SCENARIO_LIBRARY_KIND)
    return { ok: false, issues: [`Not a scenario library: expected kind ${SCENARIO_LIBRARY_KIND}`] };
  const version = record['version'];
  if (version === SCENARIO_LIBRARY_VERSION) {
    const parsed = scenarioLibrarySchema.safeParse(record);
    return parsed.success ? { ok: true, library: parsed.data, migratedFrom: null } : { ok: false, issues: issues(parsed.error) };
  }
  if (version === '1') {
    const parsed = libraryV1Schema.safeParse(record);
    if (!parsed.success) return { ok: false, issues: issues(parsed.error) };
    try {
      const migrated = scenarioLibrarySchema.parse({
        kind: SCENARIO_LIBRARY_KIND, version: SCENARIO_LIBRARY_VERSION, savedAt: parsed.data.savedAt,
        scenarios: parsed.data.scenarios.map(s => createScenario({
          id: s.id, name: s.name, profile: s.profile, options: defaultScenarioOptions(),
          origin: 'migrated-v1', note: 'Migrated from schema 1; run options defaulted.',
        })),
      });
      return { ok: true, library: migrated, migratedFrom: '1' };
    } catch (error) { return { ok: false, issues: issues(error) }; }
  }
  return { ok: false, issues: [`Unsupported scenario library version ${JSON.stringify(version)}; this build reads 1 and ${SCENARIO_LIBRARY_VERSION}`] };
}

/** Local persistence seam. The browser adapter wraps `localStorage`; tests use an in-memory store. */
export interface ScenarioStorage {
  read(): string | null;
  write(text: string): void;
  clear(): void;
}

export function memoryScenarioStorage(initial: string | null = null): ScenarioStorage {
  let value = initial;
  return { read: () => value, write: text => { value = text; }, clear: () => { value = null; } };
}

export function saveScenarioLibrary(storage: ScenarioStorage, library: ScenarioLibrary, savedAt?: string): ScenarioLibrary {
  const text = serialiseLibrary(library, savedAt);
  storage.write(text);
  const reloaded = loadScenarioLibrary(text);
  // A save that cannot be read back is a failure, not a silent success.
  if (!reloaded.ok) throw new Error(`Saved library did not round-trip: ${reloaded.issues.join('; ')}`);
  return reloaded.library;
}

export function readScenarioLibrary(storage: ScenarioStorage): ScenarioLoad & { empty: boolean } {
  const text = storage.read();
  if (text === null || text.trim() === '') return { ok: true, library: emptyLibrary(), migratedFrom: null, empty: true };
  return { ...loadScenarioLibrary(text), empty: false };
}
