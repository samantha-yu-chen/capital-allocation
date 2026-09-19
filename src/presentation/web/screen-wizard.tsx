import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { LedgerOptions } from '../../engine/index.js';
import { money, percent } from '../view/format.js';
import { WIZARD_STEPS, wizardResult, wizardStepIssues } from '../view/wizard-model.js';
import { twoNumbersStoryFor } from '../view/two-numbers.js';
import { Banner, Card, Progress, Stat } from './components.js';
import { TwoNumbers } from './two-numbers.js';
import { ProfileChoiceFields, ProfileFields } from './profile-form.js';
import { StarterPicker } from './starter-picker.js';
import type { ProfileStore } from './profile-state.js';
import type { RunState } from './use-monte-carlo.js';

function StepRail(props: { current: number; onStep: (index: number) => void }): ReactNode {
  return (
    <ol className="wizard-steps" aria-label="Start here steps">
      {WIZARD_STEPS.map((step, index) => (
        <li key={step.id} className={index === props.current ? 'is-current' : index < props.current ? 'is-complete' : ''}>
          <button type="button" onClick={() => props.onStep(index)} aria-current={index === props.current ? 'step' : undefined}>
            <span className="wizard-step-number">{index < props.current ? '✓' : index + 1}</span>
            <span><b>{step.title}</b><small>{step.prompt}</small></span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function ResultStep(props: {
  store: ProfileStore; options: LedgerOptions; state: RunState; onRun: () => void; onCancel: () => void;
  onOpenFire: () => void;
}): ReactNode {
  const summary = useMemo(
    () => props.store.profile ? wizardResult(props.store.profile, props.options) : null,
    [props.store.profile, props.options],
  );
  const running = props.state.status === 'running';
  if (!summary) return (
    <Banner tone="error" title="Some answers still need attention">
      <p style={{ margin: 0 }}>Go back to the highlighted step and fix the field message before viewing a result.</p>
    </Banner>
  );
  return (
    <div className="stack">
      <div className="grid-2">
        <Stat kicker="Reference FIRE number" value={money(summary.referenceFireNumber)}
          note="Retirement spending ÷ the reference withdrawal rate." />
        <Stat kicker={`Projected wealth at FIRE age ${props.store.profile!.personal.targetFireAge}`}
          value={money(summary.investableAssetsAtFire)}
          note="One deterministic path using the configured average returns. It is not a probability or forecast." />
      </div>
      <Card kicker="Two numbers, one answer" elevation="sm">
        <TwoNumbers story={twoNumbersStoryFor(props.store.profile!)} />
      </Card>
      <Banner tone={summary.deterministicSuccess ? 'neutral' : 'notice'}
        title={summary.deterministicSuccess ? 'The single reference path funds every year' : 'The single reference path has a shortfall'}>
        <p style={{ margin: 0 }}>
          {summary.deterministicSuccess
            ? 'This is a useful first check, but one smooth path cannot tell you whether the plan is safe.'
            : `Its first funding failure is at age ${summary.firstFailureAge ?? 'unknown'}. A market simulation tests many possible paths.`}
        </p>
      </Banner>
      <Card title={`Now test the plan across ${summary.pathCount.toLocaleString('en-GB')} possible futures`}
        elevation="md" className="wizard-run-card">
        <p className="card-body">
          This is the real safety test. It runs exactly {summary.pathCount.toLocaleString('en-GB')} paths with the same
          profile used by the FIRE &amp; Monte Carlo tab. It starts only when you press the button.
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={running} onClick={props.onRun}>
            {running ? 'Running…' : `Run ${summary.pathCount.toLocaleString('en-GB')} paths`}
          </button>
          {running ? <button type="button" className="btn btn-secondary" onClick={props.onCancel}>Cancel</button> : null}
          {props.state.status === 'done'
            ? <button type="button" className="btn btn-secondary" onClick={props.onOpenFire}>See the full FIRE result</button>
            : null}
        </div>
        {props.state.status === 'running'
          ? <Progress completed={props.state.completed} total={props.state.total} label="Simulation progress" />
          : null}
        {props.state.status === 'cancelled'
          ? <Banner tone="neutral" title="Run cancelled"><p style={{ margin: 0 }}>No partial probability is published.</p></Banner>
          : null}
        {props.state.status === 'error'
          ? <Banner tone="error" title="The simulation failed"><p style={{ margin: 0 }}>{props.state.message}</p></Banner>
          : null}
        {props.state.status === 'done' ? (
          <div className="wizard-probability" role="status">
            <span>Your plan succeeded in</span>
            <strong>{percent(props.state.result.successProbability, 2)}</strong>
            <span>of the {props.state.result.metadata.simulationCount.toLocaleString('en-GB')} simulated futures.</span>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function WizardScreen(props: {
  store: ProfileStore; options: LedgerOptions; state: RunState;
  onRun: () => void; onCancel: () => void; onDismiss: () => void; onOpenFire: () => void;
}): ReactNode {
  const [current, setCurrent] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const step = WIZARD_STEPS[current]!;
  const issues = wizardStepIssues(step.id, props.store.plainIssues);
  const next = () => {
    if (issues.length) { setAttempted(true); return; }
    setAttempted(false);
    setCurrent(index => Math.min(WIZARD_STEPS.length - 1, index + 1));
  };
  const go = (index: number) => {
    if (index > current) {
      const blocked = WIZARD_STEPS.slice(current, index).findIndex(candidate =>
        wizardStepIssues(candidate.id, props.store.plainIssues).length > 0);
      if (blocked >= 0) {
        setCurrent(current + blocked);
        setAttempted(true);
        return;
      }
    }
    setAttempted(false);
    setCurrent(index);
  };
  const copyCurrentSpending = () => props.store.edit(profile => ({
    ...profile,
    spending: { ...profile.spending, retirement: { ...profile.spending.current } },
  }));
  return (
    <section className="wizard-shell" aria-labelledby="wizard-title">
      <div className="wizard-intro">
        <div>
          <p className="wizard-overline">A first personal result in five steps</p>
          <h2 id="wizard-title">Build the outline of your plan</h2>
          <p>Pick a starting situation if one looks like yours, then use the figures you know. Everything else keeps the visible starter default and remains editable in Overview.</p>
        </div>
        <button type="button" className="link-button" onClick={props.onDismiss}>Dismiss start here</button>
      </div>
      <div className="wizard-layout">
        <StepRail current={current} onStep={go} />
        <Card className="wizard-stage" elevation="md">
          <div className="wizard-stage-heading">
            <span>Step {current + 1} of {WIZARD_STEPS.length}</span>
            <h3>{step.title}</h3>
            <p>{step.prompt}</p>
          </div>
          {attempted && issues.length ? (
            <Banner tone="error" title="Fix this step before continuing">
              <ul>{issues.map(issue => <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>)}</ul>
            </Banner>
          ) : null}
          {step.id === 'about' ? <>
            <StarterPicker chosenId={props.store.starterId} onChoose={props.store.chooseStarter} />
            <p className="wizard-note">{props.store.starterNote}</p>
            <ProfileFields store={props.store} ids={step.fieldIds.filter(id => id !== 'personal.taxRegion')} />
            <ProfileChoiceFields store={props.store} ids={['personal.taxRegion']} />
          </> : null}
          {step.id === 'income' ? <>
            <ProfileFields store={props.store} ids={step.fieldIds} />
            <p className="wizard-note">Your employer contribution is money your employer adds. If they match what you pay, enter the rate they actually add here.</p>
          </> : null}
          {step.id === 'spending' ? <>
            <ProfileFields store={props.store} ids={step.fieldIds} />
            <button type="button" className="btn btn-secondary" onClick={copyCurrentSpending}>Use my current spending for retirement</button>
          </> : null}
          {step.id === 'assets' ? <ProfileFields store={props.store} ids={step.fieldIds} /> : null}
          {step.id === 'result' ? <ResultStep store={props.store} options={props.options} state={props.state}
            onRun={props.onRun} onCancel={props.onCancel} onOpenFire={props.onOpenFire} /> : null}
          <div className="wizard-actions">
            <button type="button" className="btn btn-secondary" disabled={current === 0}
              onClick={() => go(Math.max(0, current - 1))}>Back</button>
            {current < WIZARD_STEPS.length - 1
              ? <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
              : null}
          </div>
        </Card>
      </div>
    </section>
  );
}
