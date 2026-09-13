export interface MonotoneSolution { x: number; saturated: boolean; iterations: number }

/**
 * Smallest `x` in `[0, cap]` with `surplus(x) >= 0`, for a nondecreasing `surplus`.
 *
 * Used to gross up a withdrawal for the tax the withdrawal itself creates: net cash released
 * rises monotonically with the gross amount for every rate below 100%. Returns `saturated`
 * when even the full balance cannot reach zero, which the ledger records as a funding failure
 * rather than silently inventing capacity.
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
  if (surplus(0) >= -tolerance) return { x: 0, saturated: false, iterations: 0 };
  if (cap === 0) return { x: 0, saturated: true, iterations: 0 };
  if (surplus(cap) < -tolerance) return { x: cap, saturated: true, iterations: 0 };
  let low = 0;
  let high = cap;
  let iterations = 0;
  while (iterations < maxIterations && high - low > tolerance) {
    const mid = (low + high) / 2;
    if (surplus(mid) >= 0) high = mid; else low = mid;
    iterations += 1;
  }
  // `high` always satisfies the constraint, so the returned amount never under-funds.
  return { x: high, saturated: false, iterations };
}
