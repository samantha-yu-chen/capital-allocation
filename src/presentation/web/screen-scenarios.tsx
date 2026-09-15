/**
 * Scenario Comparison (spec sections 61–66, 81; reference UI tab 6).
 *
 * The screen has two jobs. It manages *named scenarios* — created, renamed, duplicated, deleted and
 * saved to a versioned local library that is re-validated on every load — and it runs *comparisons*
 * on common random numbers: the required salary × spending × strategy matrix, the section 61
 * spending cases, the section 62 income bands, or the saved scenarios themselves.
 *
 * No calculation happens here. The view model validates the controls and formats results; the
 * engine runs every plan through the complete lifetime model inside a coordinator worker, so the
 * UI thread does no ledger work and a cancelled run publishes nothing at all.
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { LedgerOptions } from '../../engine/ledger.js';
import type { ScenarioBatchResult, ScenarioProgress } from '../../engine/scenario.js';
import { runScenariosBrowser } from '../../engine/analysis-browser.js';
import type { ScenarioOptions } from '../../domain/scenarios.js';
import {
  SCENARIO_FIRE_FROM_FIELD, SCENARIO_FIRE_TO_FIELD, SCENARIO_PREVIEW_FIELD,
  SCENARIO_SALARY_DEFAULTS, SCENARIO_SALARY_FIELDS, toDisplay, type ControlFieldDef,
} from '../view/fields.js';
import {
  COMPARISON_VIEWS, DEFAULT_PREVIEW_PATHS, PRESET_OPTIONS, STRATEGY_OPTIONS, cacheNote,
  defaultFireRange, defaultScenarioSettings, dominanceNote, libraryRows, matrixGrid,
  scenarioBasis, scenarioConclusion, scenarioCostWarning, scenarioPlan, scenarioProgressLine,
  scenarioPropertyPlan, scenarioRows, scenarioSummary, spendingEffectRows,
  type ComparisonView, type ScenarioSettings,
} from '../view/scenario-model.js';
import { SCENARIO_PRESET_DEFINITIONS, capitalStrategy, type CapitalStrategyId } from '../../engine/scenario.js';
import { stableStringify } from '../view/run-key.js';
import { Banner, Card, CheckboxField, NumberField, Progress, SelectField, Stat } from './components.js';
import { ProfileFields } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import { useAnalysis } from './use-analysis.js';
import { useScenarioLibrary } from './use-scenario-library.js';

const scenarioOptionsFrom = (options: LedgerOptions): ScenarioOptions => ({
  retirementLevel: options.retirementLevel, monthlyHouseholdOverride: options.monthlyHouseholdOverride,
  fundEmergencyReserve: options.fundEmergencyReserve, surplusAllocation: options.surplusAllocation,
});

export function ScenariosScreen({ store, ledgerOptions }: { store: ProfileStore; ledgerOptions: LedgerOptions }): ReactNode {
  const [settings, setSettings] = useState<ScenarioSettings>(defaultScenarioSettings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [name, setName] = useState('Baseline');
  const [transfer, setTransfer] = useState('');
  const library = useScenarioLibrary();
  const profile = store.profile;
  const options = useMemo(() => scenarioOptionsFrom(ledgerOptions), [ledgerOptions]);

  const plan = useMemo(
    () => profile ? scenarioPlan(profile, ledgerOptions, settings, drafts, options, library.library.scenarios) : null,
    [profile, ledgerOptions, settings, drafts, options, library.library.scenarios],
  );
  const key = useMemo(
    () => profile ? stableStringify({ profile, options, settings, cases: plan?.cases.map(c => c.id) ?? [],
      preview: plan?.previewPaths ?? null, search: plan?.request.fireAgeSearch ?? null,
      salarySearch: plan?.request.salarySearch ?? null,
      plans: plan?.cases.map(c => c.status === 'planned' ? c.plan : c.reason) ?? [] }) : null,
    [profile, options, settings, plan],
  );
  const runner = useAnalysis<ScenarioBatchResult, ScenarioProgress>(key);
  const running = runner.state.status === 'running';
  const blocked = !profile || !plan || plan.issues.length > 0;
  const errorsFor = (id: string) => (plan?.issues ?? []).filter(issue => issue.id === id).map(issue => issue.message);
  const control = (def: ControlFieldDef, fallback: number): ReactNode => (
    <NumberField key={def.id} def={def} compact
      value={drafts[def.id] ?? toDisplay(def, fallback)}
      errors={errorsFor(def.id)}
      onChange={text => setDrafts(previous => ({ ...previous, [def.id]: text }))} />
  );
  const range = profile ? defaultFireRange(profile) : { fromAge: 0, toAge: 0 };

  return (
    <div className="stack">
      {runner.invalidated ? (
        <Banner tone="notice" title="Inputs changed, so the previous comparison was discarded">
          <p style={{ margin: 0 }}>A comparison only holds for the exact plans it ran. Any run in flight was cancelled; run it again.</p>
        </Banner>
      ) : null}
      {runner.state.status === 'cancelled' ? (
        <Banner tone="neutral" title="Run cancelled">No partial matrix is published. Nothing already computed is shown on its own.</Banner>
      ) : null}
      {runner.state.status === 'error' ? (
        <Banner tone="error" title="Comparison could not be computed">{runner.state.name}: {runner.state.message}</Banner>
      ) : null}
      {!profile ? <Banner tone="error" title="Invalid profile; no comparison can run" /> : null}

      <LibraryCard store={store} library={library} options={options} name={name} onName={setName}
        transfer={transfer} onTransfer={setTransfer} />

      <Card kicker="Comparison" title="Compare plans on the same market paths" elevation="md">
        <p className="footnote">
          All scenarios reuse the entered seed and the same absolute path indices (spec section 65), so a difference
          between two rows is a difference in the plan, not in the draw.
        </p>
        <div className="field-grid">
          <SelectField label="What to compare" value={settings.view}
            options={COMPARISON_VIEWS} onChange={(view: ComparisonView) => setSettings(s => ({ ...s, view }))} />
          {settings.view === 'matrix' ? null : settings.view === 'library' ? null : (
            <SelectField label="Capital strategy" value={settings.strategy} options={STRATEGY_OPTIONS}
              help={capitalStrategy(settings.strategy).description}
              onChange={(strategy: CapitalStrategyId) => setSettings(s => ({ ...s, strategy }))} />
          )}
        </div>
        {settings.view === 'library' ? null : (
          <>
            <h4 className="card-title" style={{ fontSize: 15 }}>Income uplift bands (section 62)</h4>
            <div className="field-grid">
              {SCENARIO_SALARY_FIELDS.map((def, index) => control(def, SCENARIO_SALARY_DEFAULTS[index]!))}
            </div>
            <h4 className="card-title" style={{ fontSize: 15 }}>Spending cases (section 61)</h4>
            <p className="footnote">
              Each case replaces the household monthly total in working <em>and</em> retirement years, so its effect on the
              investable surplus and on the capital the plan must reach are both visible in one run.
            </p>
            <ProfileFields store={store} ids={['spending.scenarioMonthly.low', 'spending.scenarioMonthly.base', 'spending.scenarioMonthly.high']} />
          </>
        )}
        <h4 className="card-title" style={{ fontSize: 15 }}>Run settings</h4>
        <ProfileFields store={store} ids={['simulation.count', 'simulation.seed', 'personal.targetSuccessProbability']} />
        <div className="field-grid">
          <CheckboxField label="Search the earliest qualifying FIRE age" checked={settings.fireAgeEnabled}
            help="Off by default: each candidate age is another complete simulation for every scenario."
            onChange={fireAgeEnabled => setSettings(s => ({ ...s, fireAgeEnabled }))} />
          {settings.fireAgeEnabled ? control(SCENARIO_FIRE_FROM_FIELD, range.fromAge) : null}
          {settings.fireAgeEnabled ? control(SCENARIO_FIRE_TO_FIELD, range.toAge) : null}
          <CheckboxField label="Solve the required gross salary per scenario (section 61)" checked={settings.salaryEnabled}
            help="Off by default: each scenario runs its own bounded salary search against the complete model, up to 25 more complete simulations."
            onChange={salaryEnabled => setSettings(s => ({ ...s, salaryEnabled }))} />
          <CheckboxField label="Run a reduced-path preview instead" checked={settings.previewEnabled}
            help="A preview is labelled a preview everywhere it appears and is never presented as a full-count result."
            onChange={previewEnabled => setSettings(s => ({ ...s, previewEnabled }))} />
          {settings.previewEnabled ? control(SCENARIO_PREVIEW_FIELD, DEFAULT_PREVIEW_PATHS) : null}
        </div>
        {plan?.issues.filter(issue => issue.id === null).map(issue => (
          <p className="field-error" role="alert" key={issue.message}>{issue.message}</p>
        ))}
        <p className="footnote" data-testid="scenario-announcement">{plan?.announcement}</p>
        {plan && profile && scenarioCostWarning(plan, profile) ? (
          <Banner tone="notice" title="This run is expensive">{scenarioCostWarning(plan, profile)}</Banner>
        ) : null}
        <div className="row">
          <button className="btn btn-primary" type="button" disabled={blocked || running}
            onClick={() => { if (profile && plan) runner.run(controls => runScenariosBrowser(profile, plan.request, controls)); }}>
            {running ? 'Comparing…' : 'Run comparison'}
          </button>
          <button className="btn btn-secondary" type="button" disabled={!running} onClick={runner.cancel}>Cancel</button>
        </div>
        {runner.state.status === 'running' ? (
          <div role="status">
            <p>{scenarioProgressLine(runner.state.progress)}</p>
            {runner.state.progress ? (
              <>
                <Progress completed={runner.state.progress.casesCompleted} total={runner.state.progress.casesPlanned} label="Scenario progress" />
                <Progress completed={runner.state.progress.paths.completed} total={runner.state.progress.paths.total} label="Path progress in the current scenario" />
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      {runner.state.status === 'done'
        ? <ScenarioResult result={runner.state.result} target={store.editable.personal.targetSuccessProbability} />
        : null}

      <Card kicker="Comparison basis" title="What these numbers mean" muted>
        {scenarioBasis.map(paragraph => <p className="footnote" key={paragraph}>{paragraph}</p>)}
      </Card>
    </div>
  );
}

function LibraryCard(props: {
  store: ProfileStore; library: ReturnType<typeof useScenarioLibrary>; options: ScenarioOptions;
  name: string; onName: (value: string) => void; transfer: string; onTransfer: (value: string) => void;
}): ReactNode {
  const { store, library, options } = props;
  const [presetError, setPresetError] = useState<string | null>(null);
  const rows = libraryRows(library.library.scenarios);
  const profile = store.profile;
  const status = library.status;
  return (
    <Card kicker="Named scenarios" title="Save, duplicate and edit alternatives" elevation="sm">
      <p className="footnote">
        A scenario stores a validated profile and its plan options. Saved data is versioned and re-validated on every
        load: an older document is migrated explicitly and anything the profile schema rejects is refused, with reasons,
        rather than partially loaded.
      </p>
      {status.kind === 'rejected' ? (
        <Banner tone="error" title="Saved scenarios could not be loaded">
          {status.issues.map(issue => <p className="footnote" key={issue}>{issue}</p>)}
        </Banner>
      ) : null}
      {status.kind === 'loaded' && status.migratedFrom !== null ? (
        <Banner tone="notice" title={`Migrated ${status.scenarios} scenario(s) from schema ${status.migratedFrom}`}>
          Run options were defaulted because schema {status.migratedFrom} did not store them. Save again to keep the migrated form.
        </Banner>
      ) : null}
      <div className="field-grid">
        <div className="field">
          <label htmlFor="scenario.name">Scenario name</label>
          <input className="input" id="scenario.name" type="text" value={props.name}
            onChange={event => props.onName(event.target.value)} />
        </div>
      </div>
      <div className="row">
        <button className="btn btn-primary" type="button" disabled={!profile}
          onClick={() => { if (profile) library.add({ name: props.name.trim() || 'Scenario', profile, options, origin: 'custom' }); }}>
          Save current profile as a scenario
        </button>
        <button className="btn btn-secondary" type="button" onClick={library.reload}>Reload saved scenarios</button>
        <button className="btn btn-secondary" type="button" onClick={library.forget}>Forget saved scenarios</button>
      </div>
      <p className="footnote">
        {status.kind === 'saved' ? `Saved ${status.scenarios} scenario(s) at ${status.savedAt}.`
          : status.kind === 'loaded' ? `Loaded ${status.scenarios} scenario(s) saved at ${status.savedAt}.`
          : status.kind === 'rejected' ? 'Nothing is loaded; the stored document was refused.'
          : 'No scenarios are saved in this browser yet.'}
      </p>
      <h4 className="card-title" style={{ fontSize: 15 }}>Create from a preset</h4>
      <p className="footnote">Each preset is an explicit transform of the current profile, not a stored example result.</p>
      <div className="row">
        {PRESET_OPTIONS.map(preset => (
          <button className="btn btn-secondary" type="button" key={preset.value} title={preset.description} disabled={!profile}
            onClick={() => {
              if (!profile) return;
              const definition = SCENARIO_PRESET_DEFINITIONS.find(d => d.id === preset.value)!;
              try {
                const outcome = definition.apply({ profile, options },
                  { property: scenarioPropertyPlan(profile), salaryAxis: SCENARIO_SALARY_DEFAULTS });
                library.add({ name: preset.label, profile: outcome.profile, options: outcome.options,
                  origin: preset.value, note: outcome.note });
                setPresetError(null);
              } catch (error) {
                // An unsupported preset states why; it never creates a scenario that misrepresents the plan.
                setPresetError(`${preset.label}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}>
            {preset.label}
          </button>
        ))}
      </div>
      {presetError ? <p className="field-error" role="alert">{presetError}</p> : null}
      {rows.length ? (
        <div className="table-scroll">
          <table className="table" data-testid="scenario-library">
            <caption>Saved scenarios in this browser</caption>
            <thead><tr><th>Name</th><th>Salary</th><th>Spending</th><th>FIRE age</th><th>Pension</th><th>Reproducibility</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <th>{row.name}<br /><span className="footnote">{row.origin}{row.note ? ` · ${row.note}` : ''}</span></th>
                  <td>{row.salary}</td><td>{row.spending}</td><td>{row.fireAge}</td><td>{row.pension}</td><td>{row.paths}</td>
                  <td>
                    <div className="row">
                      <button className="btn btn-secondary" type="button" onClick={() => {
                        const found = library.library.scenarios.find(s => s.id === row.id);
                        if (found) store.edit(() => found.profile);
                      }}>Load</button>
                      <button className="btn btn-secondary" type="button" onClick={() => library.duplicate(row.id)}>Duplicate</button>
                      <button className="btn btn-secondary" type="button" disabled={!profile} onClick={() => {
                        if (profile) library.update(row.id, { name: props.name.trim() || row.name, profile, options });
                      }}>Replace with current</button>
                      <button className="btn btn-secondary" type="button" onClick={() => library.remove(row.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <details>
        <summary>Export or import the versioned library</summary>
        <div className="field">
          <label htmlFor="scenario.transfer">Library JSON</label>
          <textarea className="input" id="scenario.transfer" rows={6} value={props.transfer}
            onChange={event => props.onTransfer(event.target.value)} />
        </div>
        <div className="row">
          <button className="btn btn-secondary" type="button" onClick={() => props.onTransfer(library.exportText())}>Export to the box</button>
          <button className="btn btn-secondary" type="button" onClick={() => library.importText(props.transfer)}>Import from the box</button>
        </div>
        <p className="footnote">Imported text is validated and migrated exactly like stored data; an invalid document is refused with reasons.</p>
      </details>
    </Card>
  );
}

function ScenarioResult({ result, target }: { result: ScenarioBatchResult; target: number }): ReactNode {
  const rows = scenarioRows(result);
  const grid = matrixGrid(result);
  const spending = spendingEffectRows(result);
  const dominance = dominanceNote(result);
  return (
    <div className="stack" data-testid="scenario-result">
      {result.metadata.preview ? (
        <Banner tone="notice" title={`PREVIEW — ${result.metadata.simulationCount} of ${result.metadata.enteredSimulationCount} paths`}>
          You explicitly asked for a reduced-path preview. These figures carry preview sampling error and are not a
          full-count result; run without the preview before acting on them.
        </Banner>
      ) : null}
      <Card kicker="Completed comparison" title="What these scenarios support saying" elevation="lg">
        <p>{scenarioConclusion(result, target)}</p>
        {dominance ? <p className="footnote">{dominance}</p> : null}
        <p className="footnote">{cacheNote(result)}</p>
        <div className="split">
          {scenarioSummary(result).map(item => <Stat key={item.label} kicker={item.label} value={item.value} note={item.note} />)}
        </div>
      </Card>

      {spending.length > 1 ? (
        <Card kicker="Spending sensitivity" title="Both effects of a spending case" elevation="sm">
          <p className="footnote">
            A higher case lowers what the plan can invest this year and raises the retirement budget and the capital it
            implies. Both columns come from the same run.
          </p>
          <div className="table-scroll">
            <table className="table" data-testid="spending-effects">
              <thead><tr><th>Case</th><th>Investable surplus</th><th>Total invested</th><th>Retirement budget</th><th>Reference FIRE number</th><th>FIRE success</th><th>Earliest qualifying age</th><th>Required salary</th></tr></thead>
              <tbody>
                {spending.map(row => (
                  <tr key={row.label}>
                    <th>{row.monthly}</th><td>{row.surplus}</td><td>{row.totalInvested}</td>
                    <td>{row.retirementSpending}</td><td>{row.capitalTarget}</td><td>{row.probability}</td><td>{row.fireAge}</td>
                    <td data-testid="spending-required-salary">
                      {row.requiredSalary}
                      {row.requiredSalaryNotes.map(note => <span className="footnote" key={note}><br />{note}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {grid ? (
        <Card kicker="Required matrix" title="FIRE success by salary, spending and strategy" elevation="sm">
          <p className="footnote">Percentages are FIRE success; the second line is median net worth at that plan’s target FIRE age, in today’s money.</p>
          <div className="table-scroll">
            <table className="table" data-testid="scenario-matrix">
              <thead><tr><th>Salary</th><th>Spending</th>{grid.strategies.map(s => <th key={s.id}>{s.label}</th>)}</tr></thead>
              <tbody>
                {grid.rows.map(row => (
                  <tr key={`${row.salary}${row.spending}`}>
                    <th>{row.salary}</th><td>{row.spending}</td>
                    {row.cells.map(cell => (
                      <td key={cell.id}>{cell.status === 'evaluated' ? <>{cell.probability}<br />{cell.netWorth}</> : 'Unsupported'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card kicker="Every scenario" title="Take-home, contributions, wealth and outcome" elevation="sm">
        <div className="table-scroll">
          <table className="table" data-testid="scenario-rows">
            <thead>
              <tr>
                <th>Scenario</th><th>FIRE success</th><th>FIRE age</th><th>Required salary</th><th>Take-home</th><th>Marginal rate</th>
                <th>Pension contribution</th><th>ISA contribution</th><th>Total invested</th>
                <th>Liquid @ FIRE</th><th>Pension @ FIRE</th><th>Net worth @ FIRE</th><th>Median terminal</th><th>P10 terminal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <th>{row.label}{row.note ? <><br /><span className="footnote">{row.note}</span></> : null}
                    {row.status === 'unsupported' ? <><br /><span className="footnote">Unsupported: {row.reason}</span></> : null}</th>
                  <td>{row.probability}</td><td>{row.fireAge}</td><td>{row.requiredSalary}</td><td>{row.takeHome}</td><td>{row.marginalRate}</td>
                  <td>{row.pensionContribution}</td><td>{row.isaContribution}</td><td>{row.totalInvested}</td>
                  <td>{row.liquidAtFire}</td><td>{row.pensionAtFire}</td><td>{row.netWorthAtFire}</td>
                  <td>{row.terminalMedian}</td><td>{row.terminalP10}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>Reproducibility metadata</summary>
          <pre style={{ overflowX: 'auto', maxWidth: '100%' }}>{JSON.stringify(result.metadata, null, 2)}</pre>
        </details>
      </Card>
    </div>
  );
}
