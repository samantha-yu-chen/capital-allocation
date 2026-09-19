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
import {
  defaultLedgerOptions, type LedgerOptions, type FireAgeCurveProgress, type FireAgeCurveResult,
} from '../../engine/index.js';
import type { SolverModeId } from '../../engine/solver.js';
import { TABS, tabById, type TabId } from '../view/tabs.js';
import { fieldTarget, nextFocusRequest, type FieldFocusRequest } from '../view/field-navigation.js';
import { runKey, stableStringify } from '../view/run-key.js';
import { curvePlan } from '../view/solver-model.js';
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
import { LearnPanel } from './learn-panel.js';
import { WizardScreen } from './screen-wizard.js';
import { useAnalysis } from './use-analysis.js';

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
  // The explanation is a destination in the shell, not a screen: it holds no state of its own, and
  // `active` keeps pointing at the screen the reader came from so the panel can open that section
  // and the way back can name it.
  const [learnOpen, setLearnOpen] = useState(false);
  const store = useProfileStore();
  const [settings, setSettings] = useState<RunSettings>({
    retirementLevel: 'target',
    monthlyHouseholdOverride: null,
    fundEmergencyReserve: true,
    surplusAllocation: 'isa_then_gia',
  });
  const [transport, setTransport] = useState<Transport>({ concurrency: defaultConcurrency(), batchSize: 100 });
  const [curveDrafts, setCurveDrafts] = useState<Record<string, string>>({});
  // Navigation owns which question the Reverse Solver is asking, so the Overview card can pre-select
  // one. It selects and nothing more: a solve is many complete simulations and stays explicit.
  const [solverMode, setSolverMode] = useState<SolverModeId>('salary');
  // UX-11: which input a reader has asked to be taken to. Navigation owns it for the same reason it
  // owns the solver question — the request comes from one surface and is served by another — and it
  // is a request, never an edit: nothing about the profile or any run moves with it.
  const [fieldFocus, setFieldFocus] = useState<FieldFocusRequest | null>(null);

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
  const currentCurvePlan = useMemo(
    () => profile ? curvePlan(profile, ledgerOptions, curveDrafts) : null,
    [profile, ledgerOptions, curveDrafts],
  );
  const curveKey = useMemo(
    () => key ? `${key}|${stableStringify(currentCurvePlan?.request ?? null)}` : null,
    [key, currentCurvePlan],
  );
  const curveRunner = useAnalysis<FireAgeCurveResult, FireAgeCurveProgress>(curveKey);
  const onRun = useCallback(() => {
    if (profile) runner.run(profile, ledgerOptions, transport);
  }, [profile, ledgerOptions, transport, runner]);

  const tab = tabById(active);
  const shown = store.editable;
  const probability = runner.state.status === 'done' ? runner.state.result.successProbability : null;
  const selectTab = (id: TabId) => { setActive(id); setWizardOpen(false); setLearnOpen(false); };
  const dismissWizard = () => {
    try { localStorage.setItem(WIZARD_DISMISSED_KEY, 'true'); } catch { /* storage is optional */ }
    setWizardOpen(false);
    setActive('overview');
  };
  const openFire = () => { setWizardOpen(false); setLearnOpen(false); setActive('fire'); };
  const openCurve = () => { setWizardOpen(false); setLearnOpen(false); setActive('curve'); };
  const openSolverQuestion = (question: SolverModeId) => {
    setWizardOpen(false);
    setLearnOpen(false);
    setSolverMode(question);
    setActive('solver');
  };
  const openLearn = () => { setWizardOpen(false); setLearnOpen(true); };
  /**
   * Take the reader to one registry input: the destination whose form holds its group, then the
   * form widens its own filter far enough to show it, scrolls to it and focuses it.
   *
   * An id this profile has no input for is declined here rather than navigated to and then lost.
   */
  const openField = (fieldId: string) => {
    const target = fieldTarget(store.base, fieldId);
    if (!target) return;
    setWizardOpen(false);
    setLearnOpen(false);
    setActive(target.screen);
    setFieldFocus(previous => nextFocusRequest(previous, fieldId));
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="sidebar">
        <div>
          <h1 className="brand-title">Freedom Capital</h1>
          <div className="text-muted brand-sub">Lifetime allocation &amp; FIRE model</div>
        </div>
        <button type="button" className="start-here-button" aria-current={wizardOpen ? 'page' : undefined}
          onClick={() => { setLearnOpen(false); setWizardOpen(true); }}>
          <span>Start here</span><small>Build your first result</small>
        </button>
        <Navigation active={active} onSelect={selectTab} />
        {/* Beneath the eight destinations, because it explains them rather than competing with them. */}
        <button type="button" className="learn-button" aria-current={learnOpen ? 'page' : undefined}
          data-testid="open-learn" onClick={openLearn}>
          <span>How this works</span><small>The model in plain language</small>
        </button>
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
            <h2>{learnOpen ? 'How this works' : wizardOpen ? 'Start here' : tab.label}</h2>
            <p className="text-muted">{
              learnOpen ? 'What the model does with your numbers, and what its results do and do not mean.'
                : wizardOpen ? 'A guided path from the figures you know to your first personal result.'
                  : tab.summary
            }</p>
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
        {wizardOpen || learnOpen ? null : <GlossaryBar tab={active} />}

        {learnOpen ? (
          <LearnPanel tab={active} onClose={() => setLearnOpen(false)} />
        ) : wizardOpen ? (
          <WizardScreen store={store} options={ledgerOptions} state={runner.state} onRun={onRun}
            onCancel={runner.cancel} onDismiss={dismissWizard} onOpenFire={openFire}
            onOpenField={openField} />
        ) : <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} tabIndex={-1}>
          {active === 'attribution' ? <AttributionScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'marginal' ? <MarginalScreen store={store} ledgerOptions={ledgerOptions} /> : null}
          {active === 'property' ? <PropertyScreen store={store} ledgerOptions={ledgerOptions} focus={fieldFocus} /> : null}
          {active === 'overview' ? (
            <OverviewScreen store={store} ledgerOptions={ledgerOptions} currentRunKey={key}
              currentCurveKey={curveKey}
              monteCarloState={runner.state} curveState={curveRunner.state} onRun={onRun}
              onOpenFire={openFire} onOpenCurve={openCurve}
              onOpenSolverQuestion={openSolverQuestion} focus={fieldFocus} />
          ) : null}
          {active === 'curve' ? (
            <CurveScreen store={store} ledgerOptions={ledgerOptions} drafts={curveDrafts}
              onDraft={(id, text) => setCurveDrafts(previous => ({ ...previous, [id]: text }))}
              plan={currentCurvePlan} runner={curveRunner} />
          ) : null}
          {active === 'solver' ? (
            <SolverScreen store={store} ledgerOptions={ledgerOptions} mode={solverMode} onMode={setSolverMode} />
          ) : null}
          {active === 'scenarios' ? <ScenariosScreen store={store} ledgerOptions={ledgerOptions} onOpenField={openField} /> : null}
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
