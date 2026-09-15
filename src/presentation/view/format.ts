/**
 * Display formatting only. Never used inside engines: every value arriving here is already
 * final, and rounding happens at the last possible moment (ADR 002).
 */

const gbp = (maximumFractionDigits: number) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: maximumFractionDigits, maximumFractionDigits,
});
const whole = gbp(0);
const pence = gbp(2);
const plain = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** Rounded to the pound: the scale this model works at. */
export const money = (value: number): string => Number.isFinite(value) ? whole.format(value) : '—';
/** Pence precision, for reconciliation and audit views. */
export const moneyExact = (value: number): string => Number.isFinite(value) ? pence.format(value) : '—';

/** Short axis/label form: £1.2m, £565k, £980. Never used for a figure the user must reconcile. */
export function moneyCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${sign}£${(magnitude / 1_000_000).toFixed(magnitude >= 10_000_000 ? 0 : 1)}m`;
  if (magnitude >= 1_000) return `${sign}£${(magnitude / 1_000).toFixed(magnitude >= 100_000 ? 0 : 0)}k`;
  return `${sign}£${Math.round(magnitude)}`;
}

/** `fraction` is a rate (0.0398), not a percentage. */
export function percent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Coverage ratios are Infinity when nothing is required; that is meaningful, not an error. */
export function ratio(value: number, digits = 2): string {
  if (Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return 'no requirement';
  return `${value.toFixed(digits)}×`;
}

export const count = (value: number): string => Number.isFinite(value) ? plain.format(value) : '—';

export function years(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)} ${Math.abs(value) === 1 ? 'year' : 'years'}`;
}

/** Signed money, used where a negative surplus must stay visibly negative rather than clamped. */
export function moneySigned(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value > 0 ? `+${money(value)}` : money(value);
}

/** A probability difference expressed in percentage points. */
export const percentagePoints = (fraction: number, digits = 2): string => Number.isFinite(fraction) ? `${(fraction * 100).toFixed(digits)} pp` : '—';

/** Binomial sampling SE, separate from model uncertainty. */
export const sampledProbability = (p: number, n: number): string => `${percent(p, 2)} ± ${percent(Math.sqrt(p * (1 - p) / n), 2)} SE`;
