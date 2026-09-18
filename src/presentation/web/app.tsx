import { AttributionScreen } from './screen-attribution.js';
import { MarginalScreen } from './screen-marginal.js';
import { PropertyScreen } from './screen-property.js';
/**
 * Application shell: the eight reference destinations, the shared profile state, and the simulation
 * runner that the FIRE screen drives.
 *
 * The navigation is a real tablist: arrow keys move between tabs, Home and End jump to the ends, and
 * the panel is labelled by its tab.
 */
import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { defaultLedgerOptions, type LedgerOptions } from '../../engine/index.js';
import { TABS, tabById, type TabId } from '../view/tabs.js';
import { runKey } from '../view/run-key.js';
import { money, percent } from '../view/format.js';
import { useProfileStore } from './profile-state.js';
import { useMonteCarlo, type Transport } from './use-monte-carlo.js';
import { OverviewScreen } from './screen-overview.js';
import { FireScreen, type RunSettings } from './screen-fire.js';
import { PlannedScreen } from './screen-planned.js';
import { CurveScreen } from './screen-curve.js';
import { SolverScreen } from './screen-solver.js';
import { ScenariosScreen } from './screen-scenarios.js';
import { GlossaryBar } from './glossary-ui.js';
import { WizardScreen } from './screen-wizard.js';

const WIZARD_DISMISSED_KEY = 'capital-allocation:start-here-dismissed:v1';

const initiallyShowWizard = (): boolean => {
  try { return typeof localStorage === 'undefined' || localStorage.getItem(WIZARD_DISMISSED_KEY) !== 'true'; }
  catch { return true; }
};

const defaultConcurrency = (): number =>
  Math.min(4, Math.max(1, typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency || 1));

function Navigation(props: { active: TabId; onSelect: (tab: TabId) => void }): ReactNode {
  const refs = useRef(new Map<TabId, HTMLButtonElement>());
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex(tab => tab.id === props.active);
    const last = TABS.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[next]!;
    props.onSelect(target.id);
    refs.current.get(target.id)?.focus();
  };
  return (
    <div className="nav-list" role="tablist" aria-label="Analysis screens" aria-orientation="vertical" onKeyDown={onKeyDown}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          className="nav-item"
          aria-selected={tab.id === props.active}
          aria-controls={`panel-${tab.id}`}
          tabIndex={tab.id === props.active ? 0 : -1}
          ref={element => { if (element) refs.current.set(tab.id, element); else refs.current.delete(tab.id); }}
          onClick={() => props.onSelect(tab.id)}
        >
          {tab.label}
          {tab.status === 'planned' ? <span className="nav-item-flag">pkg {tab.package}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function App(): ReactNode {
  const [active, setActive] = useState<TabId>('overview');
  const [wizardOpen, setWizardOpen] = useState(initiallyShowWizard);
  const store = useProfileStore();
  const [settings, setSettings] = useState<RunSettings>({
    retirementLevel: 'target',
    monthlyHouseholdOverride: null,
    fundEmergencyReserve: true,
    surplusAllocation: 'isa_then_gia',
  });
  const [transport, setTransport] = useState<Transport>({ concurrency: defaultConcurrency(), batchSize: 100 });

  const ledgerOptions = useMemo<LedgerOptions>(() => ({
    ...defaultLedgerOptions(),
    retirementLevel: settings.retirementLevel,
    monthlyHouseholdOverride: settings.monthlyHouseholdOverride,
    fundEmergencyReserve: settings.fundEmergencyReserve,
    surplusAllocation: settings.surplusAllocation,
  }), [settings]);

  // Null while the profile is invalid, which also discards any published result.
  const key = useMemo(
    () => store.profile ? runKey(store.profile, ledgerOptions) : null,
    [store.profile, ledgerOptions],
  );
  const runner = useMonteCarlo(key);
  const profile = store.profile;
  const onRun = useCallback(() => {
    if (profile) runner.run(profile, ledgerOptions, transport);
  }, [profile, ledgerOptions, transport, runner]);

  const tab = tabById(active);
  const shown = store.editable;
  const probability = runner.state.status === 'done' ? runner.state.result.successProbability : null;
  const selectTab = (id: TabId) => { setActive(id); setWizardOpen(false); };
  const dismissWizard = () => {
    try { localStorage.setItem(WIZARD_DISMISSED_KEY, 'true'); } catch { /* storage is optional */ }
    setWizardOpen(false);
    setActive('overview');
  };
  const openFire = () => { setWizardOpen(false); setActive('fire'); };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="sidebar">
        <div>
          <h1 className="brand-title">Freedom Capital</h1>
          <div className="text-muted brand-sub">Lifetime allocation &amp; FIRE model</div>
        </div>
        <button type="button" className="start-here-button" aria-current={wizardOpen ? 'page' : undefined}
          onClick={() => setWizardOpen(true)}>
          <span>Start here</span><small>Build your first result</small>
        </button>
        <Navigation active={active} onSelect={selectTab} />
        <p className="sidebar-note">
          Illustrative decision-support model, not regulated financial advice. It uses the configured UK/Scotland
          tax rules for {shown.personal.taxYear} and a parametric Monte Carlo market model. Sampled results are
          not forecasts.
        </p>
        {/* Spec §36: V0.3 may hold the tax structure constant, but must disclose that it does. */}
        <p className="sidebar-note">
          Those tax rules are held constant in real terms for the whole projection — bands, allowances and
          thresholds move with inflation and never otherwise change. Real tax law will change over a lifetime,
          and that risk is not modelled.
        </p>
      </header>

      <main className="main" id="main">
        <div className="page-header">
          <div>
            <h2>{wizardOpen ? 'Start here' : tab.label}</h2>
            <p className="text-muted">{wizardOpen ? 'A guided path from the figures you know to your first personal result.' : tab.summary}</p>
          </div>
          <div className="tag-row">
            <span className="tag tag-neutral">Age {shown.personal.currentAge}</span>
            <span className="tag tag-neutral">Salary {money(shown.income.salaryAnnual)}</span>
            <span className="tag tag-accent-2">FIRE at {shown.personal.targetFireAge}</span>
            <span className="tag tag-outline">Target {percent(shown.personal.targetSuccessProbability, 0)} success</span>
            {probability !== null ? (
              <span className={probability >= shown.personal.targetSuccessProbability ? 'tag tag-accent-2' : 'tag tag-accent'}>
                Current {percent(probability, 2)}
              </span>
            ) : null}
            {!store.profile ? <span className="tag tag-accent">Inputs invalid</span> : null}
          </div>
        </div>

        {/* One place, so no destination can quietly go without an explanation of its own words. */}
        {wizardOpen ? null : <GlossaryBar tab={active} />}

        {wizardOpen ? (
          <WizardScreen store={store} options={ledgerOptions} state={runner.state} onRun={onRun}
            onCancel={runner.cancel} onDismiss={dismissWizard} onOpenFire={openFire} />
        ) : <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} tabIndex={-1}>
          {active === 'attribution' ? <AttributionScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'marginal' ? <MarginalScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'property' ? <PropertyScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'overview' ? <OverviewScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'curve' ? <CurveScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'solver' ? <SolverScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'scenarios' ? <ScenariosScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'fire' ? (
            <FireScreen
              store={store}
              settings={settings}
              onSettings={setSettings}
              transport={transport}
              onTransport={setTransport}
              ledgerOptions={ledgerOptions}
              state={runner.state}
              invalidated={runner.invalidated}
              onRun={onRun}
              onCancel={runner.cancel}
            />
          ) : null}
          {tab.status === 'planned' ? <PlannedScreen tab={tab} /> : null}
        </div>}
      </main>
    </div>
  );
}
