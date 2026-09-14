/**
 * FIRE & Monte Carlo: the real stochastic result.
 *
 * Everything on this screen is read from one `MonteCarloResult`. Nothing is estimated, smoothed or
 * substituted while a run is missing — an absent result shows as an absent result.
 */
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { Profile } from '../../domain/contracts.js';
import type { LedgerOptions, MonteCarloResult } from '../../engine/index.js';
import { referenceFireNumber, retirementAnnualReal } from '../../engine/index.js';
import { money, moneyCompact, percent } from '../view/format.js';
import {
  WEALTH_CATEGORIES, diagnosticRows, distributionRows, metadataRows, observedFailureRows,
  sequenceRows, successSplit, wealthSeries, type WealthCategoryId,
} from '../view/monte-carlo-model.js';
import { Banner, BarList, Card, FanChart, Line, Progress, ProportionBar, SelectField, Stat } from './components.js';
import { ProfileForm } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import type { RunState, Transport } from './use-monte-carlo.js';

const SUCCESS_COLOUR = 'var(--color-accent-2-700)';
const FAILURE_COLOUR = 'var(--color-accent-500)';

export interface RunSettings {
  retirementLevel: LedgerOptions['retirementLevel'];
  monthlyHouseholdOverride: number | null;
  fundEmergencyReserve: boolean;
  surplusAllocation: LedgerOptions['surplusAllocation'];
}

function Controls(props: {
  store: ProfileStore;
  settings: RunSettings;
  onSettings: (settings: RunSettings) => void;
  transport: Transport;
  onTransport: (transport: Transport) => void;
  state: RunState;
  onRun: () => void;
  onCancel: () => void;
}): ReactNode {
  const running = props.state.status === 'running';
  const profile = props.store.profile;
  return (
    <Card kicker="Simulation" title="Run the model" elevation="md">
      <ProfileForm store={props.store} groups={['simulation']} />
      <div className="field-grid">
        <SelectField
          label="Retirement spending level"
          value={props.settings.retirementLevel}
          options={[
            { value: 'floor' as const, label: 'Floor' },
            { value: 'target' as const, label: 'Target' },
            { value: 'comfort' as const, label: 'Comfort' },
          ]}
          onChange={value => props.onSettings({ ...props.settings, retirementLevel: value })}
          help="Three independent fixed-spending runs, not a dynamic cut inside a run."
        />
        <SelectField
          label="Surplus allocation"
          value={props.settings.surplusAllocation}
          options={[
            { value: 'isa_then_gia' as const, label: 'ISA then GIA' },
            { value: 'gia_only' as const, label: 'GIA only' },
            { value: 'cash_only' as const, label: 'Cash only' },
          ]}
          onChange={value => props.onSettings({ ...props.settings, surplusAllocation: value })}
          help="A transparent default, not an optimised answer; package 7 owns that decision."
        />
        <div className="field">
          <label htmlFor="household-override">Household spending override (£ / month)</label>
          <input
            id="household-override"
            className="input"
            type="number"
            step={25}
            placeholder="profile schedule"
            value={props.settings.monthlyHouseholdOverride ?? ''}
            aria-describedby="household-override-help"
            onChange={event => props.onSettings({
              ...props.settings,
              monthlyHouseholdOverride: event.target.value.trim() === '' ? null : Number(event.target.value),
            })}
          />
          <p className="field-help" id="household-override-help">
            Replaces the household monthly total in every phase, so spending’s double effect — less surplus and a
            bigger capital requirement — shows up in one run. Blank uses the profile’s own schedule.
          </p>
        </div>
        <div className="field">
          <label htmlFor="concurrency">Workers</label>
          <input
            id="concurrency" className="input" type="number" min={1} max={64} step={1}
            value={props.transport.concurrency}
            aria-describedby="transport-help"
            onChange={event => props.onTransport({ ...props.transport, concurrency: Math.max(1, Math.min(64, Number(event.target.value) || 1)) })}
          />
        </div>
        <div className="field">
          <label htmlFor="batch-size">Batch size</label>
          <input
            id="batch-size" className="input" type="number" min={1} step={10}
            value={props.transport.batchSize}
            aria-describedby="transport-help"
            onChange={event => props.onTransport({ ...props.transport, batchSize: Math.max(1, Number(event.target.value) || 1) })}
          />
          <p className="field-help" id="transport-help">
            Execution granularity only. Results aggregate in absolute path-index order, so neither changes the
            numbers, and changing them does not discard a finished result.
          </p>
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!profile || running} onClick={props.onRun}>
          {running ? 'Running…' : `Run ${(profile?.simulation.count ?? 0).toLocaleString('en-GB')} paths`}
        </button>
        <button type="button" className="btn btn-secondary" disabled={!running} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
      {props.state.status === 'running'
        ? <Progress completed={props.state.completed} total={props.state.total} label="Simulation progress" />
        : null}
      {!profile ? (
        <p className="field-error">The profile is invalid, so nothing can be sent to the engine. Fix the inputs on Overview.</p>
      ) : null}
    </Card>
  );
}

function Headline(props: { result: MonteCarloResult; profile: Profile; seconds: number }): ReactNode {
  const { result } = props;
  const target = props.profile.personal.targetSuccessProbability;
  const meets = result.successProbability >= target;
  const split = successSplit(result);
  return (
    <div className="split">
      <Card kicker={`Monte Carlo — ${result.metadata.simulationCount.toLocaleString('en-GB')} paths`} elevation="lg">
        <div className="stat-hero">{percent(result.successProbability, 2)}</div>
        <span className={meets ? 'tag tag-accent-2' : 'tag tag-accent'}>
          {meets ? 'Meets the target' : 'Below the target'} of {percent(target, 0)}
        </span>
        <p className="card-body">
          The share of sampled paths that funded every required year from today to age {props.profile.personal.endAge},
          including the pre-pension bridge. A sampled model result, not a forecast or a guarantee.
        </p>
        <p className="footnote">Completed in {props.seconds.toFixed(2)} seconds. All requested paths ran; the count is never reduced.</p>
      </Card>
      <div className="stack">
        <Card kicker="Outcome split" title="The only mutually exclusive view">
          <ProportionBar
            caption="Path outcomes"
            segments={[
              { label: 'Succeeded', value: split.success, colour: SUCCESS_COLOUR },
              { label: 'Failed at least once', value: split.failure, colour: FAILURE_COLOUR },
            ]}
          />
        </Card>
        <Card kicker="Observed failure conditions" title="Overlapping — never summed">
          <BarList
            rows={observedFailureRows(result).map(row => ({
              label: row.label, value: row.probability, display: percent(row.probability, 2),
            }))}
            max={1}
          />
          <p className="footnote">
            Each bar is the share of paths on which that ledger failure was recorded. One path can record several,
            so these do not partition the failure probability and must not be added together. Bridge failure and
            depletion are counted on distinct paths, and both are direct ledger events rather than diagnostics.
          </p>
        </Card>
      </div>
    </div>
  );
}

function DistributionCard(props: { title: string; kicker: string; rows: ReturnType<typeof distributionRows>; note: string }): ReactNode {
  return (
    <Card kicker={props.kicker} title={props.title}>
      <dl className="kv">
        {props.rows.map(row => (
          <Line
            key={row.label}
            label={row.label}
            value={money(row.value)}
            strong={row.label === 'Median'}
            {...(row.note ? { title: row.note } : {})}
          />
        ))}
      </dl>
      <p className="footnote">{props.note}</p>
    </Card>
  );
}

function WealthByAge(props: { result: MonteCarloResult; profile: Profile }): ReactNode {
  const [category, setCategory] = useState<WealthCategoryId>('netWorth');
  const series = useMemo(() => wealthSeries(props.result, category), [props.result, category]);
  const definition = WEALTH_CATEGORIES.find(item => item.id === category)!;
  const step = Math.max(1, Math.round(series.length / 14));
  const tableRows = series.filter((_, index) => index % step === 0 || index === series.length - 1);
  return (
    <Card kicker="Wealth by age" title="Real wealth distribution at every age boundary" elevation="sm">
      <div className="row">
        <SelectField
          label="Asset category"
          value={category}
          options={WEALTH_CATEGORIES.map(item => ({ value: item.id, label: item.label }))}
          onChange={setCategory}
          help={definition.description}
        />
      </div>
      <FanChart
        points={series}
        title={`${definition.label} percentiles by age, in today's money`}
        markers={[
          { age: props.profile.personal.targetFireAge, label: 'FIRE' },
          { age: props.profile.pension.accessAge, label: 'pension access' },
        ]}
      />
      <div className="legend">
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--color-accent-300)' }} />P10–P90</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--color-accent-400)' }} />P25–P75</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--color-accent-800)' }} />Median</span>
      </div>
      <p className="footnote">
        The first point is the opening balance at age {series[0]?.age}; every later point is the closing balance at
        that age boundary, deflated to today’s money. These figures are already real — do not deflate them again.
      </p>
      <div className="table-scroll">
        <table className="table">
          <caption>{definition.label} in today’s money. {definition.description}</caption>
          <thead>
            <tr>
              <th scope="col">Age</th>
              <th scope="col" className="numeric">P10</th>
              <th scope="col" className="numeric">P25</th>
              <th scope="col" className="numeric">Median</th>
              <th scope="col" className="numeric">P75</th>
              <th scope="col" className="numeric">P90</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(point => (
              <tr key={point.age}>
                <td>{point.age}</td>
                <td className="numeric">{moneyCompact(point.p10)}</td>
                <td className="numeric">{moneyCompact(point.p25)}</td>
                <td className="numeric">{moneyCompact(point.median)}</td>
                <td className="numeric">{moneyCompact(point.p75)}</td>
                <td className="numeric">{moneyCompact(point.p90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SequenceRisk(props: { result: MonteCarloResult }): ReactNode {
  return (
    <Card kicker="Sequence risk" title="The first years after the FIRE age" elevation="sm">
      <dl className="kv">
        {sequenceRows(props.result).map(row => (
          <div key={row.label}>
            <Line label={row.label} value={row.value} strong />
            <p className="footnote" style={{ margin: '2px 0 0' }}>{row.note}</p>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Diagnostics(props: { result: MonteCarloResult }): ReactNode {
  const rows = diagnosticRows(props.result);
  return (
    <Card kicker="Diagnostic associations" title="Associations, not causes" elevation="sm">
      <p className="card-body">{props.result.diagnostics.interpretation}</p>
      <div className="table-scroll">
        <table className="table">
          <caption>
            Conditional failure rates with and without each condition. These conditions overlap with each other and
            with the failure events above; a difference between the two columns is an association, not proof that the
            condition caused the failure. No “excess spending” or “insufficient saving” decomposition is offered —
            intervention-based sensitivity is work package 9.
          </caption>
          <thead>
            <tr>
              <th scope="col">Condition</th>
              <th scope="col" className="numeric">Paths</th>
              <th scope="col" className="numeric">Share of paths</th>
              <th scope="col" className="numeric">Failure rate when present</th>
              <th scope="col" className="numeric">Failure rate when absent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <th scope="row">
                  {row.label}
                  <span className="footnote" style={{ display: 'block' }}>{row.definition}</span>
                </th>
                <td className="numeric">{row.paths.toLocaleString('en-GB')}</td>
                <td className="numeric">{percent(row.probability, 2)}</td>
                <td className="numeric">{row.failureWhenPresent === null ? 'no paths' : percent(row.failureWhenPresent, 2)}</td>
                <td className="numeric">{row.failureWhenAbsent === null ? 'no paths' : percent(row.failureWhenAbsent, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Metadata(props: { result: MonteCarloResult }): ReactNode {
  return (
    <Card kicker="Reproducibility" title="What produced these numbers" muted>
      <dl className="kv stat-small">
        {metadataRows(props.result).map(row => <Line key={row.label} label={row.label} value={row.value} />)}
      </dl>
      <p className="footnote">
        The same inputs reproduce these results exactly in the tested runtime. Batch size, worker count and
        scheduling do not affect the numbers. The correlation matrix is of Gaussian log-growth shocks, and the
        generator calibrates lognormal gross growth to the configured arithmetic annual means and standard deviations.
      </p>
    </Card>
  );
}

function resultErrorBanner(state: Extract<RunState, { status: 'error' }>): ReactNode {
  if (state.name === 'PensionLimitError') {
    return (
      <Banner tone="error" title="A pension contribution exceeded the available allowance">
        <p style={{ margin: 0 }}>{state.message}</p>
        <p style={{ margin: 0 }}>
          The excess-charge case is deliberately not modelled, so the run stops rather than reporting this as a
          sampled plan failure. Lower the contribution rates or add verified carry-forward allowance.
        </p>
      </Banner>
    );
  }
  return (
    <Banner tone="error" title="The simulation failed">
      <p style={{ margin: 0 }}><b>{state.name}:</b> {state.message}</p>
      <p style={{ margin: 0 }}>No partial result is published: a failed run never becomes a probability.</p>
    </Banner>
  );
}

export function FireScreen(props: {
  store: ProfileStore;
  settings: RunSettings;
  onSettings: (settings: RunSettings) => void;
  transport: Transport;
  onTransport: (transport: Transport) => void;
  ledgerOptions: LedgerOptions;
  state: RunState;
  invalidated: boolean;
  onRun: () => void;
  onCancel: () => void;
}): ReactNode {
  const profile = props.store.profile;
  const reference = useMemo(() => {
    if (!profile) return null;
    const spending = retirementAnnualReal(profile, props.ledgerOptions);
    return { spending, number: referenceFireNumber(spending, profile.simulation.referenceWithdrawalRate) };
  }, [profile, props.ledgerOptions]);

  return (
    <div className="stack">
      {props.invalidated ? (
        <Banner tone="notice" title="Inputs changed, so the previous result was discarded">
          <p style={{ margin: 0 }}>
            A result is only valid for the exact inputs that produced it. The run in flight, if any, was cancelled.
            Run the simulation again to see results for the current profile.
          </p>
        </Banner>
      ) : null}
      {props.state.status === 'cancelled' ? (
        <Banner tone="neutral" title="Run cancelled">
          <p style={{ margin: 0 }}>No partial probability is reported for a cancelled run.</p>
        </Banner>
      ) : null}
      {props.state.status === 'error' ? resultErrorBanner(props.state) : null}

      {reference ? (
        <Card kicker="Reference FIRE number" elevation="sm">
          <div className="row" style={{ gap: 'var(--space-6)', alignItems: 'baseline' }}>
            <div>
              <div className="text-muted stat-small">Target annual spending</div>
              <div className="stat-value">{money(reference.spending)}</div>
            </div>
            <div>
              <div className="text-muted stat-small">Reference withdrawal rate</div>
              <div className="stat-value">{percent(profile!.simulation.referenceWithdrawalRate, 2)}</div>
            </div>
            <div>
              <div className="text-muted stat-small">Reference FIRE number</div>
              <div className="stat-value">{money(reference.number)}</div>
            </div>
          </div>
          <p className="footnote">
            Entered retirement budget ÷ withdrawal rate, before property adjustments. A reference ratio only — the probability below includes housing cash flows and is the safety result.
          </p>
        </Card>
      ) : null}

      <Controls
        store={props.store}
        settings={props.settings}
        onSettings={props.onSettings}
        transport={props.transport}
        onTransport={props.onTransport}
        state={props.state}
        onRun={props.onRun}
        onCancel={props.onCancel}
      />

      {props.state.status === 'done' && profile ? (
        <>
          <Headline result={props.state.result} profile={profile} seconds={props.state.seconds} />
          <div className="grid-3">
            <Stat kicker="Median terminal wealth" value={money(props.state.result.terminalWealth.median)} />
            <Stat kicker="Median opening FIRE capital" value={money(props.state.result.fireCapital.median)} note={`Real investable wealth at age ${profile.personal.targetFireAge}, including pension capital.`} />
            <Stat
              kicker="Bridge to pension access"
              value={`${Math.max(0, profile.pension.accessAge - profile.personal.targetFireAge)} years`}
              note={`From age ${profile.personal.targetFireAge} to ${profile.pension.accessAge}.`}
            />
          </div>
          <div className="grid-2">
            <DistributionCard
              kicker="Terminal wealth"
              title={`Net worth at age ${profile.personal.endAge}`}
              rows={distributionRows(props.state.result.terminalWealth)}
              note="Today’s money. Quantiles interpolate linearly at (n−1)p."
            />
            <DistributionCard
              kicker="Opening FIRE capital"
              title={`Investable wealth at age ${profile.personal.targetFireAge}`}
              rows={distributionRows(props.state.result.fireCapital)}
              note="Real opening investable wealth at the FIRE age, pension capital included."
            />
          </div>
          <WealthByAge result={props.state.result} profile={profile} />
          <SequenceRisk result={props.state.result} />
          <Diagnostics result={props.state.result} />
          <Metadata result={props.state.result} />
        </>
      ) : props.state.status === 'idle' ? (
        <Card kicker="No result yet" title="Nothing is shown until the model has run" muted>
          <p className="card-body" style={{ margin: 0 }}>
            This screen never substitutes an estimate, a cached figure or a reduced-path preview for a real run.
            Press <b>Run</b> above.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
