import { z } from 'zod';
import { money } from '../contracts.js';
import type { TaxBand, TaxConfig } from '../../config/tax/uk-2026-27.js';

export const incomeTaxInputSchema = z.strictObject({
  /** Income AFTER salary sacrifice/net-pay deductions; pension income is non-savings. */
  nonSavingsIncome: money, savingsInterest: money.default(0), dividends: money.default(0),
  /** Gross eligible RAS contributions, NOT the net payment. Does not reduce taxable income. */
  reliefAtSourceGross: money.default(0),
});
export type IncomeTaxInput = z.input<typeof incomeTaxInputSchema>;
export interface TaxSlice { band: string; taxable: number; rate: number; tax: number }
export interface IncomeTaxResult {
  adjustedNetIncome: number; personalAllowance: number;
  allowanceAllocation: { nonSavings: number; savings: number; dividends: number };
  taxableNonSavings: number; taxableSavings: number; taxableDividends: number; totalTaxableIncome: number;
  savingsStartingRateUsed: number; personalSavingsAllowance: number; dividendAllowanceUsed: number;
  nonSavingsTax: number; savingsTax: number; dividendTax: number; totalIncomeTax: number;
  nonSavingsSlices: TaxSlice[]; savingsSlices: TaxSlice[]; dividendSlices: TaxSlice[];
  basicRateBand: number; remainingBasicRateBandForGains: number;
}
export function calculatePersonalAllowance(adjustedNetIncome: number, config: TaxConfig): number {
  money.parse(adjustedNetIncome);
  return Math.max(0, config.personalAllowance - Math.max(0, adjustedNetIncome - config.taperThreshold) * config.taperReductionRate);
}
/** Tax the slice [offset, offset + amount], retaining zero-rated allowance band occupancy elsewhere. */
export function taxSlices(amount: number, offset: number, bands: readonly TaxBand[]): TaxSlice[] {
  let lower = 0;
  return bands.map(b => {
    const upper = b.upper ?? Infinity;
    const taxable = Math.max(0, Math.min(offset + amount, upper) - Math.max(offset, lower));
    lower = upper;
    return { band: b.name, taxable, rate: b.rate, tax: taxable * b.rate };
  }).filter(s => s.taxable > 0);
}
const sum = (slices: TaxSlice[]) => slices.reduce((total, s) => total + s.tax, 0);
/** RAS extends the Scottish BASIC band, not its 19% starter band; subsequent boundaries move with it. */
export function extendedBands(bands: readonly TaxBand[], gross: number): TaxBand[] {
  return bands.map(b => ({ ...b, upper: b.upper === null ? null : b.upper + (b.name === 'starter' ? 0 : gross) }));
}

export function calculateIncomeTax(input: IncomeTaxInput, config: TaxConfig): IncomeTaxResult {
  const p = incomeTaxInputSchema.parse(input);
  const n = p.nonSavingsIncome, s = p.savingsInterest, d = p.dividends;
  const adjustedNetIncome = Math.max(0, n + s + d - p.reliefAtSourceGross);
  const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, config);
  const usedPa = Math.min(personalAllowance, n + s + d);
  const total = n + s + d - usedPa;
  const nb = extendedBands(config.nonSavingsBands, p.reliefAtSourceGross);
  const ub = extendedBands(config.ukBands, p.reliefAtSourceGross);
  const db = ub.map((b, i) => ({ ...b, rate: config.dividends.rates[i]! }));
  const basic = ub[0]!.upper!, higher = ub[1]!.upper!;
  const psa = total > higher ? 0 : total > basic ? config.savings.higherAllowance : config.savings.basicAllowance;
  const start = config.savings.startingRateLimit, da = config.dividends.allowance;
  function evaluate(tn: number, ts: number, td: number): IncomeTaxResult {
    const savingsStartingRateUsed = Math.min(ts, Math.max(0, start - tn));
    const savingsZero = Math.min(ts, savingsStartingRateUsed + psa);
    const dividendAllowanceUsed = Math.min(td, da);
    const nonSavingsSlices = taxSlices(tn, 0, nb);
    const savingsSlices = taxSlices(ts - savingsZero, tn + savingsZero, ub);
    const dividendSlices = taxSlices(td - dividendAllowanceUsed, tn + ts + dividendAllowanceUsed, db);
    const nonSavingsTax = sum(nonSavingsSlices), savingsTax = sum(savingsSlices), dividendTax = sum(dividendSlices);
    return { adjustedNetIncome, personalAllowance,
      allowanceAllocation: { nonSavings: n - tn, savings: s - ts, dividends: d - td },
      taxableNonSavings: tn, taxableSavings: ts, taxableDividends: td, totalTaxableIncome: total,
      savingsStartingRateUsed, personalSavingsAllowance: psa, dividendAllowanceUsed,
      nonSavingsTax, savingsTax, dividendTax, totalIncomeTax: nonSavingsTax + savingsTax + dividendTax,
      nonSavingsSlices, savingsSlices, dividendSlices, basicRateBand: basic, remainingBasicRateBandForGains: Math.max(0, basic - total) };
  }
  const tnDefault = Math.max(0, n - usedPa);
  const tsDefault = Math.max(0, s - Math.max(0, usedPa - n));
  let best = evaluate(tnDefault, tsDefault, Math.max(0, total - tnDefault - tsDefault));
  if (usedPa === 0 || total === 0 || [n, s, d].filter(v => v > 0).length === 1) return best;

  // Minimise tax over the PA allocation polygon. Each piece is linear in taxable
  // non-savings N and cumulative non-savings+savings Q. Enumerate intersections
  // of N=constant, Q=constant, Q-N=constant at every rate/allowance/domain boundary.
  // This avoids a penny-by-penny search and the incorrect 'always NS first' rule.
  const ns = new Set([0, n, Math.max(0, n - usedPa), start, basic - psa, higher - psa,
    ...nb.flatMap(b => b.upper === null ? [] : [b.upper])]);
  const qs = new Set([0, total, total - d, total - da, basic, higher, basic - da, higher - da, start + psa]);
  const ss = new Set([0, s, Math.max(0, s - usedPa), psa]);
  const consider = (tn: number, q: number) => {
    const ts = q - tn, td = total - q;
    if (tn < -1e-7 || tn > n + 1e-7 || ts < -1e-7 || ts > s + 1e-7 || td < -1e-7 || td > d + 1e-7) return;
    const result = evaluate(Math.max(0, Math.min(n, tn)), Math.max(0, Math.min(s, ts)), Math.max(0, Math.min(d, td)));
    if (result.totalIncomeTax < best.totalIncomeTax - 1e-8) best = result;
  };
  for (const tn of ns) { for (const q of qs) consider(tn, q); for (const ts of ss) consider(tn, tn + ts); }
  for (const q of qs) for (const ts of ss) consider(q - ts, q);
  return best;
}

export function calculateDividendTax(input: IncomeTaxInput, config: TaxConfig) {
  const result = calculateIncomeTax(input, config);
  return { tax: result.dividendTax, allowanceUsed: result.dividendAllowanceUsed, slices: result.dividendSlices };
}

/** Effective forward change, including taper and allowance cliffs. Not just the headline tax band. */
export function calculateMarginalIncomeTax(input: IncomeTaxInput, config: TaxConfig, increment = 1): number {
  if (!Number.isFinite(increment) || increment <= 0) throw new RangeError('increment must be positive');
  const p = incomeTaxInputSchema.parse(input);
  return (calculateIncomeTax({ ...p, nonSavingsIncome: p.nonSavingsIncome + increment }, config).totalIncomeTax
    - calculateIncomeTax(p, config).totalIncomeTax) / increment;
}
