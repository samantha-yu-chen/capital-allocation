import type { MarketPath, MarketYear, Portfolio, Profile } from '../domain/contracts.js';

/** Weighted nominal total return for one wrapper in one year. Total return: income plus capital. */
export function portfolioReturn(portfolio: Portfolio, year: MarketYear): number {
  return portfolio.equities * year.equities + portfolio.bonds * year.bonds + portfolio.cash * year.cash;
}

/**
 * Expected-value path: every year takes the configured nominal arithmetic means.
 * `pathIndex` is -1 because this is not a sampled path. Chunk 3 supplies sampled
 * paths through the same interface; a zero-volatility sample must reproduce this one.
 */
export function deterministicPath(years: number, market: Profile['market']): MarketPath {
  if (!Number.isInteger(years) || years < 0) throw new RangeError('years must be a nonnegative integer');
  return {
    pathIndex: -1,
    years: Array.from({ length: years }, (_unused, yearIndex): MarketYear => ({
      yearIndex, equities: market.equities.meanNominal, bonds: market.bonds.meanNominal,
      cash: market.cash.meanNominal, property: market.property.meanNominal, inflation: market.inflation.mean,
    })),
  };
}

/**
 * Cumulative inflation index at the START of each projected year.
 * `index[0] = 1`, so year 0 nominal values equal today's-money inputs, and
 * `index[t] = Π_{j<t} (1 + inflation_j)`. Divide a nominal ledger value by the
 * year's index to present it in today's money.
 */
export function inflationIndices(path: MarketPath): number[] {
  const indices: number[] = [];
  let index = 1;
  for (const year of path.years) { indices.push(index); index *= 1 + year.inflation; }
  return indices;
}
