/**
 * Minimal chart geometry. Pure functions so the shapes can be asserted in tests rather than
 * eyeballed, and so no charting dependency enters the bundle.
 */

export interface Point { x: number; y: number }
export interface Band { x: number; low: number; high: number }

/** Maps a domain onto a pixel range. A zero-width domain maps everything to the range midpoint. */
export function linearScale(domain: readonly [number, number], range: readonly [number, number]): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (!Number.isFinite(span) || span === 0) return () => (r0 + r1) / 2;
  return value => r0 + ((value - d0) / span) * (r1 - r0);
}

/** The round step a "nice" axis should use across [min, max]. */
export function tickStep(min: number, max: number, target = 5): number {
  const raw = (max - min) / Math.max(1, target - 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  // Snap to the nearest of 1, 2, 5 or 10 in the decade, using geometric midpoints as the cut points.
  const normalised = raw / magnitude;
  return (normalised < 1.4142 ? 1 : normalised < 3.1623 ? 2 : normalised < 7.0711 ? 5 : 10) * magnitude;
}

/** Round, human-readable tick values inside [min, max]; always at least two ticks. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || target < 2) return [min, max];
  if (min === max) return [min];
  const step = tickStep(min, max, target);
  const ticks: number[] = [];
  for (let tick = Math.ceil(min / step) * step; tick <= max + step / 1e6; tick += step) {
    ticks.push(Number(tick.toPrecision(12)));
  }
  return ticks.length >= 2 ? ticks : [min, max];
}

/**
 * An axis whose ends are themselves round numbers, so the top and bottom of the plot are labelled
 * gridlines rather than an unlabelled edge.
 */
export function niceDomain(min: number, max: number, target = 5): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { domain: [min, min === max ? min + 1 : max], ticks: [min] };
  }
  const step = tickStep(min, max, target);
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let tick = low; tick <= high + step / 1e6; tick += step) ticks.push(Number(tick.toPrecision(12)));
  return { domain: [Number(low.toPrecision(12)), Number(high.toPrecision(12))], ticks };
}

const round = (value: number): string => (Math.round(value * 100) / 100).toString();

export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join(' ');
}

/** Closed area between the `high` edge (left to right) and the `low` edge (right to left). */
export function bandPath(bands: readonly Band[]): string {
  if (bands.length === 0) return '';
  const top = bands.map((band, index) => `${index === 0 ? 'M' : 'L'}${round(band.x)} ${round(band.high)}`).join(' ');
  const bottom = [...bands].reverse().map(band => `L${round(band.x)} ${round(band.low)}`).join(' ');
  return `${top} ${bottom} Z`;
}

/** Domain padded to a round number above zero; wealth axes always include zero. */
export function wealthDomain(values: readonly number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];
  const max = Math.max(0, ...finite);
  const min = Math.min(0, ...finite);
  if (max === min) return [min, min + 1];
  return [min, max];
}
