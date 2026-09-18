/**
 * Reverse Solver (spec sections 32, 33 and 60).
 *
 * Each mode searches one input and scores every candidate with the complete model, so the screen's
 * job is to make the cost, the definition and the uncertainty of that search visible: what the
 * searched input means, how many complete simulations a run will take, what was actually tested,
 * and how much of the headline is search precision versus Monte Carlo sampling.
 */
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { LedgerOptions } from '../../engine/ledger.js';
import type { CapitalDestination, SolverModeId, SolverProgress, SolverRun } from '../../engine/solver.js';
import { runSolverBrowser } from '../../engine/analysis-browser.js';
import { runKey, stableStringify } from '../view/run-key.js';
import { count, percent } from '../view/format.js';
import { toDisplay, type ControlFieldDef } from '../view/fields.js';
import {
  CAPITAL_DESTINATIONS, SOLVER_BUDGET_FIELD, SOLVER_QUESTIONS, SOLVER_QUESTION_STEM, SOLVER_TARGET_FIELD,
  evaluationRows, sensitivityRows, solverAnswer, solverBoundField, solverDetailRows, solverHeadline,
  solverNotes, solverPlan, solverQuestion,
} from '../view/solver-model.js';
import { Banner, Card, CheckboxField, NumberField, Progress, SelectField } from './components.js';
import { QuestionPicker } from './question-picker.js';
import { ProfileFields } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import { useAnalysis } from './use-analysis.js';

function progressLine(progress: SolverProgress | null): string {
  if (!progress) return 'Starting…';
  return `${progress.stage} — ${progress.evaluationsCompleted} of about ${progress.evaluationsPlanned} complete simulations`;
}

export function SolverScreen({ store, ledgerOptions, mode, onMode }: {
  store: ProfileStore; ledgerOptions: LedgerOptions;
  /** Owned by `App`, so the Overview card can pre-select a question without running anything. */
  mode: SolverModeId; onMode: (mode: SolverModeId) => void;
}): ReactNode {
  const [destination, setDestination] = useState<CapitalDestination>('gia');
  const [includeSensitivity, setIncludeSensitivity] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const profile = store.profile;
  const plan = useMemo(
    () => profile ? solverPlan(profile, ledgerOptions, { mode, destination, includeSensitivity, drafts }) : null,
    [profile, ledgerOptions, mode, destination, includeSensitivity, drafts],
  );
  const key = useMemo(
    () => profile ? `${runKey(profile, ledgerOptions)}|${stableStringify({ request: plan?.request ?? null, includeSensitivity })}` : null,
    [profile, ledgerOptions, plan, includeSensitivity],
  );
  const runner = useAnalysis<SolverRun, SolverProgress>(key);
  const running = runner.state.status === 'running';
  const boundField = plan ? solverBoundField(plan.mode) : null;
  const blocked = !profile || !plan || plan.issues.length > 0 || plan.unsupported !== null;

  const control = (def: ControlFieldDef, fallback: number): ReactNode => (
    <NumberField
      def={def}
      value={drafts[def.id] ?? (Number.isFinite(fallback) ? toDisplay(def, fallback) : '')}
      errors={(plan?.issues ?? []).filter(issue => issue.id === def.id).map(issue => issue.message)}
      onChange={text => setDrafts(previous => ({ ...previous, [def.id]: text }))}
    />
  );

  return (
    <div className="stack">
      {runner.invalidated ? (
        <Banner tone="notice" title="Inputs changed, so the previous answer was discarded">
          <p style={{ margin: 0 }}>
            A solved value only holds for the exact plan it was solved against. Any search in flight was cancelled;
            run the search again for the current profile.
          </p>
        </Banner>
      ) : null}
      {runner.state.status === 'cancelled' ? (
        <Banner tone="neutral" title="Search cancelled">
          <p style={{ margin: 0 }}>No partial answer is published: a half-finished search is not a requirement.</p>
        </Banner>
      ) : null}
      {runner.state.status === 'error' ? (
        <Banner tone="error" title="The search failed">
          <p style={{ margin: 0 }}><b>{runner.state.name}:</b> {runner.state.message}</p>
        </Banner>
      ) : null}
      {!profile ? <Banner tone="error" title="The profile is invalid, so nothing can be sent to the engine" /> : null}

      {/* The question stem is the heading here; a card title above it would only say it twice. */}
      <Card kicker="Your question" elevation="md">
        <QuestionPicker
          stem={`${SOLVER_QUESTION_STEM} need to be?`}
          choices={SOLVER_QUESTIONS}
          value={mode}
          onChange={onMode}
        >
          <p className="question-chosen">
            Searching for your <b>{solverQuestion(mode).subject}</b>. One input moves; everything else stays
            exactly as entered.
          </p>
        </QuestionPicker>
        {mode === 'starting_capital' ? (
          <div className="field-grid">
            <SelectField
              label="Where the extra capital goes" value={destination} options={CAPITAL_DESTINATIONS}
              onChange={setDestination}
              help="Accessibility and tax differ by destination, so this choice changes the answer."
            />
          </div>
        ) : null}
        {/* The plain sentence above is the ladder, not a replacement: the mode's precise definition
            stays on screen, because what a search holds fixed is what makes its answer meaningful. */}
        {plan ? (
          <p className="footnote question-definition">
            <b>Exactly what moves:</b> {plan.mode.definition}
          </p>
        ) : null}
        <ProfileFields store={store} ids={['personal.targetFireAge', 'simulation.count']} />
        <div className="field-grid">
          {control(SOLVER_TARGET_FIELD, store.editable.personal.targetSuccessProbability)}
          {boundField && plan ? control(boundField, plan.boundValue) : null}
          {control(SOLVER_BUDGET_FIELD, 24)}
        </div>
        <CheckboxField
          label="Also solve the section 33 sensitivity cases"
          checked={includeSensitivity}
          onChange={setIncludeSensitivity}
          help="FIRE age +2, retirement spending −£150/month and equity returns −1pp, each re-solved in full. It roughly quadruples the work."
        />
        {plan?.unsupported ? (
          <Banner tone="notice" title="This search does not apply to the current settings">
            <p style={{ margin: 0 }}>{plan.unsupported}</p>
          </Banner>
        ) : null}
        {plan && plan.issues.length === 0 && plan.unsupported === null ? (
          <p className="footnote" style={{ margin: 0 }}>
            Up to <b>{count(plan.plannedSimulations)}</b> complete simulations
            ({count(plan.plannedProjections)} lifetime projections) across {count(plan.searches)}{' '}
            {plan.searches === 1 ? 'search' : 'searches'}. Every candidate runs the configured path count; nothing is
            sampled down to make the search finish sooner.
          </p>
        ) : null}
        <div className="row">
          <button
            type="button" className="btn btn-primary" disabled={blocked || running}
            onClick={() => {
              if (!profile || !plan) return;
              runner.run(controls => runSolverBrowser(profile, plan.request, { ...controls, includeSensitivity, ledgerOptions }));
            }}
          >
            {running ? 'Solving…' : `Work out my ${solverQuestion(mode).subject}`}
          </button>
          <button type="button" className="btn btn-secondary" disabled={!running} onClick={runner.cancel}>Cancel</button>
        </div>
        {runner.state.status === 'running' ? (
          <div className="stack-tight">
            <p className="stat-small" role="status">{progressLine(runner.state.progress)}</p>
            {runner.state.progress ? (
              <Progress
                completed={runner.state.progress.paths.completed}
                total={runner.state.progress.paths.total}
                label="Progress of the simulation in flight"
              />
            ) : null}
          </div>
        ) : null}
      </Card>

      {runner.state.status === 'done' ? (
        <SolverResultView run={runner.state.result} seconds={runner.state.seconds} sensitivity={includeSensitivity} />
      ) : runner.state.status === 'idle' ? (
        <Card kicker="No answer yet" title="Nothing is shown until a search has finished" muted>
          <p className="card-body" style={{ margin: 0 }}>
            A requirement is only meaningful once a candidate has been confirmed against the complete model, so no
            estimate stands in for one. Nothing runs until you ask it to: press{' '}
            <b>Work out my {solverQuestion(mode).subject}</b> above.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function SolverResultView({ run, seconds, sensitivity }: { run: SolverRun; seconds: number; sensitivity: boolean }): ReactNode {
  const result = run.primary;
  const headline = solverHeadline(result);
  const answer = solverAnswer(result);
  const notes = solverNotes(result);
  return (
    <>
      {/* The answer in ordinary words first; the engine's own labels and figures stay below it. */}
      <Card className="answer-card" kicker="Your answer" elevation="lg">
        <p className="answer-sentence" data-answer-status={answer.status}>{answer.sentence}</p>
      </Card>

      <Card kicker={headline.kicker} elevation="lg">
        <div className="stat-hero">{headline.value}</div>
        <span className={headline.tone === 'good' ? 'tag tag-accent-2' : headline.tone === 'bad' ? 'tag tag-accent' : 'tag tag-neutral'}>
          {result.status === 'solved' ? 'Confirmed against the full model'
            : result.status === 'already_met' ? 'No change needed'
            : result.status === 'infeasible' ? 'Not reachable inside the bound' : 'Not applicable'}
        </span>
        <p className="card-body">{headline.note}</p>
        <p className="footnote">
          Completed in {seconds.toFixed(2)} seconds over {count(result.evaluations.length)} searched candidates at{' '}
          {count(result.simulationCount)} paths each. Search precision and sampling uncertainty are different things:
          the value is exact for this seed and path set to the nearest search step, while the probability beside it
          carries a 95% sampling interval of about ± {percent(1.96 * (result.standardError ?? 0), 2)}.
        </p>
      </Card>

      {notes.map(note => (
        <Banner tone="notice" title="How to read this answer" key={note}><p style={{ margin: 0 }}>{note}</p></Banner>
      ))}

      <Card kicker="The search" title="What was asked and what was found">
        <dl className="kv">
          {solverDetailRows(result).map(row => (
            <div key={row.label}>
              <div className="line">
                <dt className="text-muted">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
              <p className="footnote" style={{ margin: '2px 0 0' }}>{row.note}</p>
            </div>
          ))}
        </dl>
      </Card>

      <Card kicker="Sensitivity" title="Each row is its own completed search">
        {sensitivity ? (
          <>
            <div className="table-scroll">
              <table className="table">
                <caption>
                  Spec section 33’s sensitivity block. Every value below was produced by re-running the whole search on
                  a different plan — none of them is the headline scaled or interpolated.
                </caption>
                <thead><tr><th scope="col">Case</th><th scope="col">Result</th><th scope="col">What changed</th></tr></thead>
                <tbody>
                  {sensitivityRows(run).map(row => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                      <td className="stat-small">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="footnote">
              The FIRE-age and spending cases run on the same seed and paths as the headline. The weaker-returns case
              changes the market assumption itself, so its paths are drawn from a different distribution and it is a
              separate model rather than a common-path comparison.
            </p>
          </>
        ) : (
          <p className="card-body" style={{ margin: 0 }}>
            Sensitivity cases were switched off for this run, so none are shown. Turn them on above and solve again —
            they are computed, never canned.
          </p>
        )}
      </Card>

      <Card kicker="Evaluation trace" title="Every candidate that was actually simulated" elevation="sm">
        <div className="table-scroll">
          <table className="table">
            <caption>
              In search order. Invalid candidates are plans the model does not support — a tapered pension allowance,
              for example — and are recorded as such rather than counted as plans that failed to fund themselves.
            </caption>
            <thead><tr><th scope="col">Candidate</th><th scope="col" className="numeric">Success probability</th><th scope="col">Verdict</th></tr></thead>
            <tbody>
              {evaluationRows(result).map(row => (
                <tr key={`${row.value}-${row.verdict}`} data-failed={row.invalid}>
                  <th scope="row">{row.value}</th>
                  <td className="numeric">{row.probability}</td>
                  <td>{row.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card kicker="Reproducibility" title="What produced this answer" muted>
        <p className="footnote" style={{ marginTop: 0 }}>
          Every candidate used seed {result.metadata.seed} and path indices {result.metadata.pathIndices.start}–
          {result.metadata.pathIndices.endExclusive - 1}, so the difference between two candidates is the plan and
          nothing else.
        </p>
        <details>
          <summary>Search metadata</summary>
          <pre style={{ overflowX: 'auto', maxWidth: '100%' }}>{JSON.stringify(result.metadata, null, 2)}</pre>
        </details>
      </Card>
    </>
  );
}
