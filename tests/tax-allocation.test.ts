import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateIncomeTax, getTaxConfig } from '../src/domain/tax/index.js';

// Independent, deliberately slow oracle for the PA optimiser. No production
// tax-band helper or config values are imported into the arithmetic below.
function integrate(x: number, limits: number[], rates: number[]): number {
  let result = 0;
  for (let i = 0; i < rates.length; i++) {
    const lower = i === 0 ? 0 : limits[i - 1]!;
    result += Math.max(0, Math.min(x, limits[i] ?? Infinity) - lower) * rates[i]!;
  }
  return result;
}
function reference(n: number, s: number, d: number, scotland: boolean, ras: number) {
  const taxableTotal = n + s + d;
  const basic = 37_700 + ras, additional = 125_140 + ras;
  const psa = taxableTotal > additional ? 0 : taxableTotal > basic ? 500 : 1000;
  const zeroInterest = Math.min(s, Math.max(0, 5000 - n) + psa);
  const normal = (x: number) => integrate(x, [basic, additional], [0.2, 0.4, 0.45]);
  const dividend = (x: number) => integrate(x, [basic, additional], [0.1075, 0.3575, 0.3935]);
  const nonSavingsTax = scotland ? integrate(n, [3967, 16_956 + ras, 31_092 + ras, 62_430 + ras, 125_140 + ras],
    [0.19, 0.2, 0.21, 0.42, 0.45, 0.48]) : normal(n);
  return nonSavingsTax + normal(n + s) - normal(n + zeroInterest)
    + dividend(taxableTotal) - dividend(n + s + Math.min(d, 500));
}
test('PA vertex search is no worse than independent dense allocations across mixed-income cases', () => {
  const cases = [[10_000, 10_000, 10_000], [50_000, 2000, 10_000], [13_000, 6000, 100],
    [5000, 50_000, 20_000], [1000, 10_000, 60_000], [43_662, 1000, 500], [99_500, 1500, 4000],
    [16_537, 10_000, 7000], [29_526, 500, 6000], [100, 200, 300], [125_000, 10_000, 15_000],
    [37_000, 14_000, 270], [12_571, 1500, 750], [75_000, 4000, 30_000]];
  for (const region of ['scotland', 'rest_of_uk'] as const) for (const ras of [0, 5000]) {
    for (const [n, s, d] of cases as [number, number, number][]) {
      const r = calculateIncomeTax({ nonSavingsIncome: n, savingsInterest: s, dividends: d, reliefAtSourceGross: ras }, getTaxConfig(region, '2026/27'));
      const allocation = r.allowanceAllocation;
      const pa = Math.min(n + s + d, Math.max(0, 12_570 - Math.max(0, n + s + d - ras - 100_000) / 2));
      assert.ok(Math.abs(allocation.nonSavings + allocation.savings + allocation.dividends - pa) < 1e-7);
      const selected = reference(n - allocation.nonSavings, s - allocation.savings, d - allocation.dividends, region === 'scotland', ras);
      assert.ok(Math.abs(selected - r.totalIncomeTax) < 1e-7);
      // Grid is an upper bound on the true optimum, with no shared vertex algorithm.
      for (let i = 0; i <= 100; i++) {
        const an = Math.min(n, pa) * i / 100;
        for (let j = 0; j <= 100; j++) {
          const as = Math.min(s, pa - an) * j / 100;
          const ad = pa - an - as;
          if (ad > d) continue;
          const candidate = reference(n - an, s - as, d - ad, region === 'scotland', ras);
          assert.ok(r.totalIncomeTax <= candidate + 1e-7, `Suboptimal allocation: ${JSON.stringify({ region, n, s, d, ras, candidate, r })}`);
        }
      }
    }
  }
});
test('income tax is continuous at ordinary boundaries where allowances do not jump', () => {
  for (const region of ['scotland', 'rest_of_uk'] as const) {
    const c = getTaxConfig(region, '2026/27');
    for (const n of [12_570, 16_537, 29_526, 43_662, 50_270, 75_000, 100_000, 125_140]) {
      const left = calculateIncomeTax({ nonSavingsIncome: n - 0.01 }, c).totalIncomeTax;
      const right = calculateIncomeTax({ nonSavingsIncome: n + 0.01 }, c).totalIncomeTax;
      assert.ok(right >= left && right - left <= 0.02);
    }
  }
});
