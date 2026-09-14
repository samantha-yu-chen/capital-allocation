/**
 * Shared presentation pieces, built from the Organic component classes.
 *
 * Charts follow the mark spec used across the app: thin marks, a 2px surface gap between adjacent
 * fills, recessive grid and axis lines, text in text tokens rather than series colours, and a table
 * of the same numbers always rendered next to the picture so identity is never colour-alone.
 */
import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import type { NumberFieldDef } from '../view/fields.js';
import { moneyCompact } from '../view/format.js';
import { bandPath, linearScale, linePath, niceDomain, niceTicks } from '../view/chart.js';

export function Card(props: {
  kicker?: string; title?: string; elevation?: 'sm' | 'md' | 'lg'; muted?: boolean;
  className?: string; children: ReactNode;
}): ReactNode {
  const classes = ['card'];
  if (props.elevation) classes.push(`elev-${props.elevation}`);
  if (props.muted) classes.push('muted-card');
  if (props.className) classes.push(props.className);
  return (
    <section className={classes.join(' ')}>
      {props.kicker ? <div className="card-kicker">{props.kicker}</div> : null}
      {props.title ? <h3 className="card-title">{props.title}</h3> : null}
      {props.children}
    </section>
  );
}

export function Line(props: { label: ReactNode; value: ReactNode; strong?: boolean; title?: string }): ReactNode {
  return (
    <div className={props.strong ? 'line line-total' : 'line'} title={props.title}>
      <dt className={props.strong ? undefined : 'text-muted'}>{props.label}</dt>
      <dd>{props.strong ? <b>{props.value}</b> : props.value}</dd>
    </div>
  );
}

export function Stat(props: { kicker: string; value: ReactNode; note?: ReactNode }): ReactNode {
  return (
    <div className="card">
      <div className="card-kicker">{props.kicker}</div>
      <div className="stat-value">{props.value}</div>
      {props.note ? <p className="card-body stat-small">{props.note}</p> : null}
    </div>
  );
}

export function Banner(props: { tone: 'error' | 'notice' | 'neutral'; title: string; children?: ReactNode }): ReactNode {
  return (
    <div className={`banner banner-${props.tone}`} role={props.tone === 'error' ? 'alert' : 'status'}>
      <h3>{props.title}</h3>
      {props.children}
    </div>
  );
}

const UNIT: Record<NumberFieldDef['kind'], string> = {
  money: '£', monthlyMoney: '£ / month', percent: '%', age: 'age', integer: '', decimal: '', multiple: '×',
};

export function NumberField(props: {
  def: NumberFieldDef; value: string; errors: readonly string[];
  onChange: (text: string) => void; compact?: boolean;
}): ReactNode {
  const { def } = props;
  const helpId = `${def.id}-help`;
  const errorId = `${def.id}-error`;
  const described = [def.help ? helpId : null, props.errors.length ? errorId : null].filter(Boolean).join(' ');
  const unit = UNIT[def.kind];
  return (
    <div className="field">
      <label htmlFor={def.id}>{def.label}{unit && unit !== 'age' ? <span className="unit"> ({unit})</span> : null}</label>
      <input
        id={def.id}
        className="input"
        type="number"
        inputMode="decimal"
        step={def.step}
        value={props.value}
        aria-invalid={props.errors.length > 0}
        {...(described ? { 'aria-describedby': described } : {})}
        onChange={event => props.onChange(event.target.value)}
      />
      {def.help && !props.compact ? <p className="field-help" id={helpId}>{def.help}</p> : null}
      {props.errors.length ? <p className="field-error" id={errorId}>{props.errors.join(' ')}</p> : null}
    </div>
  );
}

export function SelectField<T extends string>(props: {
  label: string; value: T; options: readonly { value: T; label: string }[];
  onChange: (value: T) => void; help?: string;
}): ReactNode {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <select
        id={id}
        className="input"
        value={props.value}
        {...(props.help ? { 'aria-describedby': `${id}-help` } : {})}
        onChange={event => props.onChange(event.target.value as T)}
      >
        {props.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {props.help ? <p className="field-help" id={`${id}-help`}>{props.help}</p> : null}
    </div>
  );
}

export function CheckboxField(props: {
  label: string; checked: boolean; onChange: (checked: boolean) => void; help?: string;
}): ReactNode {
  const id = useId();
  return (
    <div className="field">
      <label className="radio" htmlFor={id} style={{ fontSize: 14 }}>
        <input
          id={id}
          type="checkbox"
          checked={props.checked}
          style={{ position: 'static', opacity: 1, width: 16, height: 16 }}
          {...(props.help ? { 'aria-describedby': `${id}-help` } : {})}
          onChange={event => props.onChange(event.target.checked)}
        />
        {props.label}
      </label>
      {props.help ? <p className="field-help" id={`${id}-help`}>{props.help}</p> : null}
    </div>
  );
}

export interface Segment { label: string; value: number; colour: string }

/** Only ever used for a genuine partition of 100%. Overlapping measures use `BarList`. */
export function ProportionBar(props: { segments: readonly Segment[]; caption: string }): ReactNode {
  const total = props.segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  return (
    <div className="stack-tight">
      <div className="proportion" role="img" aria-label={`${props.caption}: ${props.segments.map(s => `${s.label} ${(s.value * 100).toFixed(2)}%`).join(', ')}`}>
        {props.segments.filter(segment => segment.value > 0).map(segment => (
          <div
            key={segment.label}
            className="proportion-segment"
            style={{ flexGrow: segment.value / total, background: segment.colour }}
          />
        ))}
      </div>
      <div className="legend">
        {props.segments.map(segment => (
          <span className="legend-item" key={segment.label}>
            <span className="legend-swatch" style={{ background: segment.colour }} />
            {segment.label} {(segment.value * 100).toFixed(2)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Magnitude comparison in one hue. Each row carries its own value label. */
export function BarList(props: { rows: readonly { label: string; value: number; display: string }[]; max?: number }): ReactNode {
  const max = props.max ?? Math.max(1e-9, ...props.rows.map(row => row.value));
  return (
    <div className="stack-tight">
      {props.rows.map(row => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <b>{row.display}</b>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(1, row.value / max)) * 100}%`, background: 'var(--color-accent-500)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Progress(props: { completed: number; total: number; label: string }): ReactNode {
  const fraction = props.total > 0 ? Math.min(1, props.completed / props.total) : 0;
  return (
    <div className="stack-tight">
      <div
        className="progress-track"
        role="progressbar"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={props.total}
        aria-valuenow={props.completed}
      >
        <div className="progress-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <p className="stat-small text-muted" aria-live="polite">
        {props.completed.toLocaleString('en-GB')} of {props.total.toLocaleString('en-GB')} paths complete
      </p>
    </div>
  );
}

export interface FanPoint { age: number; p10: number; p25: number; median: number; p75: number; p90: number }

/**
 * Percentile fan over age. One hue, light to dark by narrowing interval, which is the sequential
 * encoding for magnitude — never a categorical palette. The table beside it carries the numbers.
 */
export function FanChart(props: {
  points: readonly FanPoint[]; markers: readonly { age: number; label: string }[]; title: string;
}): ReactNode {
  const width = 760;
  const height = 300;
  const padding = { top: 16, right: 16, bottom: 34, left: 64 };
  const points = props.points;
  if (points.length < 2) return <p className="text-muted">Not enough age boundaries to draw a distribution.</p>;
  const ages = points.map(point => point.age);
  const highest = Math.max(...points.map(point => point.p90));
  const lowest = Math.min(0, ...points.map(point => point.p10));
  const x = linearScale([Math.min(...ages), Math.max(...ages)], [padding.left, width - padding.right]);
  const vertical = niceDomain(lowest, highest, 5);
  const y = linearScale(vertical.domain, [height - padding.bottom, padding.top]);
  const ticks = vertical.ticks;
  const ageTicks = niceTicks(Math.min(...ages), Math.max(...ages), 8).filter(age => age >= ages[0]! && age <= ages[ages.length - 1]!);
  const outer = bandPath(points.map(point => ({ x: x(point.age), low: y(point.p10), high: y(point.p90) })));
  const inner = bandPath(points.map(point => ({ x: x(point.age), low: y(point.p25), high: y(point.p75) })));
  const median = linePath(points.map(point => ({ x: x(point.age), y: y(point.median) })));
  const last = points[points.length - 1]!;
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${props.title}. Median at age ${last.age} is ${moneyCompact(last.median)}, with a P10 to P90 range of ${moneyCompact(last.p10)} to ${moneyCompact(last.p90)}.`}
    >
      {ticks.map(tick => (
        <g key={tick}>
          <line className="chart-grid" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
          <text className="chart-label" x={padding.left - 8} y={y(tick) + 3} textAnchor="end">{moneyCompact(tick)}</text>
        </g>
      ))}
      <path className="chart-band-outer" d={outer} />
      <path className="chart-band-inner" d={inner} />
      <path className="chart-median" d={median} />
      {props.markers.filter(marker => marker.age >= ages[0]! && marker.age <= ages[ages.length - 1]!).map(marker => (
        <g key={marker.label}>
          <line className="chart-grid" x1={x(marker.age)} x2={x(marker.age)} y1={padding.top} y2={height - padding.bottom} />
          <text className="chart-label" x={x(marker.age) + 4} y={padding.top + 10}>{marker.label}</text>
        </g>
      ))}
      <line className="chart-axis" x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} />
      <line className="chart-axis" x1={padding.left} x2={width - padding.right} y1={y(Math.max(0, lowest))} y2={y(Math.max(0, lowest))} />
      {ageTicks.map(age => (
        <text className="chart-label" key={age} x={x(age)} y={height - padding.bottom + 16} textAnchor="middle">{age}</text>
      ))}
      <text className="chart-label" x={width / 2} y={height - 4} textAnchor="middle">Age boundary</text>
    </svg>
  );
}

/** Expandable table row; the toggle is a real button so it is reachable and announced. */
export function ExpandableRow(props: {
  cells: ReactNode[]; detail: ReactNode; label: string; failed: boolean; columns: number;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <tr data-failed={props.failed}>
        {props.cells.map((cell, index) => (
          <td key={index} className={index === 0 ? undefined : 'numeric'}>
            {index === 0
              ? <button type="button" className="row-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
                  {cell}
                </button>
              : cell}
          </td>
        ))}
      </tr>
      {open ? (
        <tr id={id}>
          <td colSpan={props.columns}>
            <div className="stack-tight">
              <b className="stat-small">{props.label}</b>
              <div className="detail-grid">{props.detail}</div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
