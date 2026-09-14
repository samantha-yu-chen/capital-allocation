import type { MarketPath, Profile, ReturnGenerator } from '../../domain/contracts.js';

export const ASSETS = ['equities', 'bonds', 'cash', 'property', 'inflation'] as const;

/** Correlations apply to Gaussian log-growth shocks, not arithmetic returns. */
export function cholesky(matrix: readonly (readonly number[])[]): number[][] {
  if (matrix.length !== 5 || matrix.some(row => row.length !== 5)) throw new RangeError('Correlation must be 5 by 5');
  const l = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j <= i; j++) {
      const entry = matrix[i]![j]!;
      if (!Number.isFinite(entry) || Math.abs(entry) > 1 || Math.abs(entry - matrix[j]![i]!) > 1e-9 ||
          (i === j && Math.abs(entry - 1) > 1e-9)) throw new RangeError('Invalid correlation matrix');
      let v = entry;
      for (let k = 0; k < j; k++) v -= l[i]![k]! * l[j]![k]!;
      if (i === j) {
        if (v < -1e-9) throw new RangeError('Correlation must be positive semidefinite');
        l[i]![j] = Math.sqrt(Math.max(0, v));
      } else if (l[j]![j]! > 1e-9) l[i]![j] = v / l[j]![j]!;
      else if (Math.abs(v) > 1e-9) throw new RangeError('Correlation must be positive semidefinite');
    }
  }
  return l;
}

function uint32(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`${name} must be uint32`);
}

/** Mulberry32 stream keyed only by seed and absolute path index. Always consume 5 shocks/year. */
function random(seed: number, pathIndex: number): () => number {
  let x = (seed ^ Math.imul(pathIndex + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  let state = (x ^ (x >>> 16)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ParametricReturnGenerator implements ReturnGenerator {
  readonly version = 'lognormal-mulberry32-boxmuller-v1';
  generatePath(input: { years: number; seed: number; pathIndex: number; assumptions: Profile['market'] }): MarketPath {
    const { years, seed, pathIndex, assumptions } = input;
    uint32(seed, 'seed'); uint32(pathIndex, 'pathIndex');
    if (!Number.isInteger(years) || years < 0) throw new RangeError('years must be a nonnegative integer');
    const l = cholesky(assumptions.correlation);
    const parameters = ASSETS.map(key => {
      const a = assumptions[key];
      const mean = 'mean' in a ? a.mean : a.meanNominal;
      if (!Number.isFinite(mean) || mean <= -1 || !Number.isFinite(a.volatility) || a.volatility < 0)
        throw new RangeError('Invalid market moments');
      const sigma = Math.sqrt(Math.log1p((a.volatility / (1 + mean)) ** 2));
      return { mean, sigma, mu: Math.log1p(mean) - sigma * sigma / 2 };
    });
    const rng = random(seed, pathIndex);
    return { pathIndex, years: Array.from({ length: years }, (_, yearIndex) => {
      const z = ASSETS.map(() => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()));
      const r = parameters.map((p, i) => {
        const shock = l[i]!.reduce((sum, weight, j) => sum + weight * z[j]!, 0);
        const value = p.sigma === 0 ? p.mean : Math.expm1(p.mu + p.sigma * shock);
        if (!Number.isFinite(value) || value <= -1) throw new RangeError('Sample outside numeric range');
        return value;
      });
      return { yearIndex, equities: r[0]!, bonds: r[1]!, cash: r[2]!, property: r[3]!, inflation: r[4]! };
    }) };
  }
}
