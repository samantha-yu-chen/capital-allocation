/**
 * FIRE Age Curve (spec section 17).
 *
 * Every candidate age is a complete simulation at the configured path count, so the screen says how
 * much work a run is before starting it, reports progress in both dimensions while it runs, and
 * shows nothing at all until a full curve exists. No age is interpolated and no probability is
 * carried over from a previous set of inputs.
 */
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { LedgerOptions } from '../../engine/ledger.js';
import type { FireAgeCurveProgress, FireAgeCurveResult } from '../../engine/fire-curve.js';
import { fireAgeCurveBrowser } from '../../engine/analysis-browser.js';
import { count, money, percent } from '../view/format.js';
import { toDisplay, type ControlFieldDef } from '../view/fields.js';
import {
  CURVE_FROM_FIELD, CURVE_TO_FIELD, curveGeometry, curveHeadline, curveNotes, curveRows, type CurvePlan,
} from '../view/solver-model.js';
import { twoNumbersStoryFor, type TwoNumbersStory } from '../view/two-numbers.js';
import { Banner, Card, NumberField, Progress, Stat } from './components.js';
import { TwoNumbers } from './two-numbers.js';
import { ProfileFields } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import type { AnalysisRunner } from './use-analysis.js';

function CurveChart({ result }: { result: FireAgeCurveResult }): ReactNode {
  const geometry = useMemo(() => curveGeometry(result), [result]);
  if (!geometry) return <p className="text-muted">No candidate age could be simulated, so there is no curve to draw.</p>;
  const { axis, width, height } = geometry;
  const earliest = result.earliestQualifyingAge;
  return (
    <svg
      className="chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img"
      aria-label={`Success probability by FIRE age, from age ${geometry.points[0]!.age} to ${geometry.points[geometry.points.length - 1]!.age}. ${
        earliest === null ? 'No age reaches the target.' : `Age ${earliest} is the earliest reaching the ${percent(result.targetProbability, 0)} target.`}`}
    >
      {geometry.probabilityTicks.map(tick => (
        <g key={tick.label}>
          <line className="chart-grid" x1={axis.left} x2={width - axis.right} y1={tick.y} y2={tick.y} />
          <text className="chart-label" x={axis.left - 8} y={tick.y + 3} textAnchor="end">{tick.label}</text>
        </g>
      ))}
      <line
        x1={axis.left} x2={width - axis.right} y1={geometry.targetY} y2={geometry.targetY}
        stroke="var(--color-accent-500)" strokeWidth={1.5} strokeDasharray="4 4"
      />
      <text className="chart-label" x={width - axis.right} y={geometry.targetY - 6} textAnchor="end">
        target {percent(result.targetProbability, 0)}
      </text>
      <path className="chart-median" d={geometry.pathD} fill="none" />
      {geometry.points.map(point => (
        <circle
          key={point.age} cx={point.x} cy={point.y} r={point.qualifying ? 5.5 : 3}
          fill={point.qualifying ? 'var(--color-accent-2-700)' : 'var(--color-accent-600)'}
        >
          <title>{`Age ${point.age}: ${percent(point.probability, 2)}`}</title>
        </circle>
      ))}
      <line className="chart-axis" x1={axis.left} x2={axis.left} y1={axis.top} y2={height - axis.bottom} />
      <line className="chart-axis" x1={axis.left} x2={width - axis.right} y1={height - axis.bottom} y2={height - axis.bottom} />
      {geometry.ageTicks.map(tick => (
        <text className="chart-label" key={tick.age} x={tick.x} y={height - axis.bottom + 16} textAnchor="middle">{tick.age}</text>
      ))}
      <text className="chart-label" x={width / 2} y={height - 4} textAnchor="middle">Candidate FIRE age</text>
    </svg>
  );
}

function progressLine(progress: FireAgeCurveProgress | null): string {
  if (!progress) return 'Starting…';
  return `Age ${progress.age}: ${progress.agesCompleted} of ${progress.agesTotal} ages complete`;
}

export function CurveScreen({ store, ledgerOptions, drafts, onDraft, plan, runner }: {
  store: ProfileStore;
  ledgerOptions: LedgerOptions;
  drafts: Readonly<Record<string, string>>;
  onDraft: (id: string, text: string) => void;
  plan: CurvePlan | null;
  runner: AnalysisRunner<FireAgeCurveResult, FireAgeCurveProgress>;
}): ReactNode {
  const profile = store.profile;
  const running = runner.state.status === 'running';
  const blocked = !profile || !plan || plan.issues.length > 0;

  const control = (def: ControlFieldDef, fallback: number): ReactNode => (
    <NumberField
      def={def}
      value={drafts[def.id] ?? toDisplay(def, fallback)}
      errors={(plan?.issues ?? []).filter(issue => issue.id === def.id).map(issue => issue.message)}
      onChange={text => onDraft(def.id, text)}
    />
  );

  return (
    <div className="stack">
      {runner.invalidated ? (
        <Banner tone="notice" title="Inputs changed, so the previous curve was discarded">
          <p style={{ margin: 0 }}>
            Each point is only valid for the exact inputs that produced it. Any run in flight was cancelled. Recompute
            the curve to see results for the current profile.
          </p>
        </Banner>
      ) : null}
      {runner.state.status === 'cancelled' ? (
        <Banner tone="neutral" title="Run cancelled">
          <p style={{ margin: 0 }}>No partial curve is published: the ages that had finished are discarded with the rest.</p>
        </Banner>
      ) : null}
      {runner.state.status === 'error' ? (
        <Banner tone="error" title="The curve could not be computed">
          <p style={{ margin: 0 }}><b>{runner.state.name}:</b> {runner.state.message}</p>
        </Banner>
      ) : null}
      {!profile ? <Banner tone="error" title="The profile is invalid, so nothing can be sent to the engine" /> : null}

      <Card kicker="Candidate ages" title="Run the whole model at every FIRE age" elevation="md">
        <p className="card-body" style={{ marginTop: 0 }}>
          Instead of one FIRE age, each candidate age is simulated in full on the same seed and the same path indices,
          and the earliest age clearing your target probability is read off the result. Moving the FIRE age changes
          when salary and pension contributions stop, which years use the retirement budget and how long the
          pre-pension bridge runs — the ledger handles all of it.
        </p>
        <div className="field-grid">
          {control(CURVE_FROM_FIELD, store.editable.personal.currentAge)}
          {control(CURVE_TO_FIELD, Math.min(store.editable.personal.endAge - 1, store.editable.personal.currentAge + 20))}
        </div>
        <ProfileFields store={store} ids={['personal.targetSuccessProbability', 'simulation.count']} />
        {plan && plan.issues.length === 0 ? (
          <p className="footnote" style={{ margin: 0 }}>
            This run is <b>{count(plan.ages.length)}</b> complete simulations — {count(plan.plannedProjections)} lifetime
            projections at the configured path count. The count is never reduced to make the curve finish sooner; lower
            the path count above if you want a faster, less precise curve.
          </p>
        ) : null}
        <div className="row">
          <button
            type="button" className="btn btn-primary" disabled={blocked || running}
            onClick={() => {
              if (!profile || !plan) return;
              runner.run(controls => fireAgeCurveBrowser(profile, plan.request, { ...controls, ledgerOptions }));
            }}
          >
            {running ? 'Computing…' : `Compute ${count(plan?.ages.length ?? 0)} ages`}
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
                label={`Simulation progress for age ${runner.state.progress.age}`}
              />
            ) : null}
          </div>
        ) : null}
      </Card>

      {runner.state.status === 'done' ? (
        <CurveResult result={runner.state.result} seconds={runner.state.seconds} story={twoNumbersStoryFor(profile!)} />
      ) : runner.state.status === 'idle' ? (
        <Card kicker="No curve yet" title="Nothing is shown until every candidate age has run" muted>
          <p className="card-body" style={{ margin: 0 }}>
            An age with no simulation behind it has no probability, so none is drawn. Press <b>Compute</b> above.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function CurveResult({ result, seconds, story }: {
  result: FireAgeCurveResult; seconds: number; story: TwoNumbersStory;
}): ReactNode {
  const headline = curveHeadline(result);
  const rows = curveRows(result);
  const notes = curveNotes(result);
  return (
    <>
      <div className="split">
        <Card kicker={headline.kicker} elevation="lg">
          <div className="stat-hero">{headline.value}</div>
          <span className={headline.tone === 'good' ? 'tag tag-accent-2' : 'tag tag-accent'}>
            {headline.tone === 'good' ? 'Clears the target' : 'No age clears the target'}
          </span>
          <p className="card-body">{headline.note}</p>
          <p className="footnote">
            Completed in {seconds.toFixed(2)} seconds. The ± figure is Monte Carlo sampling uncertainty at 95%, not a
            range of outcomes and not a bound on the model’s assumptions.
          </p>
        </Card>
        <div className="stack">
          <Stat
            kicker="Probability at your target FIRE age"
            value={result.probabilityAtTargetAge === null ? 'not in range' : percent(result.probabilityAtTargetAge, 2)}
            note={`Age ${result.targetFireAge}, the FIRE age entered on the profile.`}
          />
          <Stat
            kicker="Reference FIRE number"
            value={money(result.referenceFireNumber)}
            note={<>
              {money(result.retirementSpendingAnnualReal)} of retirement spending ÷ the reference withdrawal rate.
              <TwoNumbers story={story} variant="note" />
            </>}
          />
        </div>
      </div>

      <Card kicker="Probability by FIRE age" title="Every candidate age, simulated in full" elevation="sm">
        <CurveChart result={result} />
        <p className="footnote">
          The dashed line is the target probability and the filled point is the earliest age reaching it. Points are
          joined only to make the shape readable; ages between whole years were never simulated.
        </p>
        {notes.map(note => <p className="footnote" key={note}><b>Note.</b> {note}</p>)}
        <div className="table-scroll">
          <table className="table">
            <caption>Success probability by FIRE age, on common market paths. Money is today’s money.</caption>
            <thead>
              <tr>
                <th scope="col">FIRE age</th>
                <th scope="col" className="numeric">Success probability</th>
                <th scope="col" className="numeric">Sampling ±95%</th>
                <th scope="col" className="numeric">Bridge years</th>
                <th scope="col" className="numeric">Median capital at FIRE</th>
                <th scope="col" className="numeric">Median terminal wealth</th>
                <th scope="col">Against target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.age} data-failed={row.verdict === 'Below the target'}>
                  <th scope="row">{row.age}</th>
                  <td className="numeric">{row.probability}</td>
                  <td className="numeric">{row.interval}</td>
                  <td className="numeric">{row.bridgeYears}</td>
                  <td className="numeric">{row.fireCapital}</td>
                  <td className="numeric">{row.terminal}</td>
                  <td>{row.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card kicker="Reproducibility" title="What produced this curve" muted>
        <p className="footnote" style={{ marginTop: 0 }}>
          Every age used seed {result.metadata.seed} and path indices {result.metadata.pathIndices.start}–
          {result.metadata.pathIndices.endExclusive - 1}, so differences between ages are differences in the plan, not
          in the draw.
        </p>
        <details>
          <summary>Curve metadata</summary>
          <pre style={{ overflowX: 'auto', maxWidth: '100%' }}>{JSON.stringify(result.metadata, null, 2)}</pre>
        </details>
      </Card>
    </>
  );
}
