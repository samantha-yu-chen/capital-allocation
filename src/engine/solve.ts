export interface MonotoneSolution { x: number; saturated: boolean; iterations: number }

/**
 * Smallest `x` in `[0, cap]` with `surplus(x) >= 0`, for a nondecreasing `surplus`.
 *
 * Used to gross up a withdrawal for the tax the withdrawal itself creates: net cash released
 * rises monotonically with the gross amount for every rate below 100%. Returns `saturated`
 * when even the full balance cannot reach zero, which the ledger records as a funding failure
 * rather than silently inventing capacity.
 *
 * The returned `x` always satisfies the constraint, so a solution never UNDER-funds; it may
 * over-fund by at most `tolerance` (in the currency units of `surplus`).
 *
 * Net cash is piecewise linear in the withdrawal - marginal income-tax, CGT and tax-free-cash
 * rates are constant between band boundaries - so this alternates a false-position step with a
 * bisection step. False position lands on the root immediately inside a single linear segment,
 * while the interleaved bisection keeps a valid bracket and bounds the worst case at roughly
 * twice plain bisection.
 */
export function solveMonotone(
  surplus: (x: number) => number,
  cap: number,
  tolerance = 1e-6,
  maxIterations = 60,
): MonotoneSolution {
  if (!Number.isFinite(cap) || cap < 0) throw new RangeError('cap must be finite and nonnegative');
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new RangeError('tolerance must be positive');
  if (!Number.isInteger(maxIterations) || maxIterations < 1) throw new RangeError('maxIterations must be a positive integer');

  const atZero = surplus(0);
  if (atZero >= -tolerance) return { x: 0, saturated: false, iterations: 0 };
  if (cap === 0) return { x: 0, saturated: true, iterations: 0 };
  const atCap = surplus(cap);
  if (atCap < -tolerance) return { x: cap, saturated: true, iterations: 0 };
  // The full balance is within tolerance of exactly enough.
  if (atCap < 0) return { x: cap, saturated: false, iterations: 0 };

  let low = 0;
  let lowValue = atZero;
  let high = cap;
  let highValue = atCap;
  let iterations = 0;
  while (iterations < maxIterations && highValue > tolerance && high - low > tolerance) {
    const span = highValue - lowValue;
    // Even iterations try false position; odd iterations bisect to guarantee bracket shrinkage.
    let mid = iterations % 2 === 0 && span > 0
      ? low + (high - low) * (-lowValue) / span
      : (low + high) / 2;
    if (!(mid > low && mid < high)) mid = (low + high) / 2;
    const value = surplus(mid);
    iterations += 1;
    if (value >= 0) { high = mid; highValue = value; } else { low = mid; lowValue = value; }
  }
  // `high` always satisfies the constraint, so the returned amount never under-funds.
  return { x: high, saturated: false, iterations };
}
