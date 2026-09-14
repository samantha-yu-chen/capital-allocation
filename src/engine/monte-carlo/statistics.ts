import type { Percentiles } from '../../domain/contracts.js';
export interface Distribution extends Percentiles { mean: number; worst: number }
/** Linear interpolation at (n-1)p; an observed minimum is not a worst-case bound. */
export function distribution(values: readonly number[]): Distribution {
  if (!values.length || values.some(v => !Number.isFinite(v))) throw new RangeError('Expected finite, nonempty sample');
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
  };
  return { p10: q(.1), p25: q(.25), median: q(.5), p75: q(.75), p90: q(.9),
    mean: values.reduce((sum, v) => sum + v / values.length, 0), worst: sorted[0]! };
}
