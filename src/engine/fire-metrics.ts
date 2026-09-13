/**
 * Deterministic reference arithmetic only (spec sections 18, 19, 76).
 *
 * These are transparent reference ratios, NOT a measure of FIRE safety. Spec section 6 is
 * explicit that the deterministic projection must not be presented as the success probability;
 * the Monte Carlo result (chunk 3) is authoritative.
 */

/** Spec section 18: annual retirement spending / safe withdrawal rate. */
export function referenceFireNumber(annualRetirementSpending: number, withdrawalRate: number): number {
  if (!Number.isFinite(annualRetirementSpending) || annualRetirementSpending < 0)
    throw new RangeError('annualRetirementSpending must be finite and nonnegative');
  if (!Number.isFinite(withdrawalRate) || withdrawalRate <= 0) throw new RangeError('withdrawalRate must be positive');
  return annualRetirementSpending / withdrawalRate;
}

const ratio = (numerator: number, denominator: number): number => denominator <= 0 ? Infinity : numerator / denominator;

/** Spec section 76: investable (financial) assets against the reference FIRE number. */
export const referenceFireRatio = (investableAssets: number, fireNumber: number): number =>
  ratio(investableAssets, fireNumber);

/**
 * Spec section 13: undiscounted real capital needed to spend across the bridge.
 * Deliberately ignores returns - it is a coverage reference, not a sustainability claim.
 */
export function requiredBridgeCapital(annualRetirementSpending: number, fireAge: number, pensionAccessAge: number): number {
  return annualRetirementSpending * Math.max(0, pensionAccessAge - fireAge);
}

/** Spec section 76: accessible (Freedom) capital against the pre-pension requirement. */
export const liquidFireRatio = (accessibleCapital: number, bridgeCapitalRequired: number): number =>
  ratio(accessibleCapital, bridgeCapitalRequired);

/** Undiscounted real capital needed from pension access to the terminal age. */
export function requiredPostPensionCapital(annualRetirementSpending: number, pensionAccessAge: number, endAge: number): number {
  return annualRetirementSpending * Math.max(0, endAge - pensionAccessAge);
}

/** Spec section 76: retirement (locked) capital against the post-pension requirement. */
export const pensionCoverageRatio = (retirementCapital: number, postPensionCapitalRequired: number): number =>
  ratio(retirementCapital, postPensionCapitalRequired);

/** Spec section 41: accessible liquid assets divided by annual essential spending. */
export const liquidityCoverageYears = (liquidAssets: number, annualEssentialSpending: number): number =>
  ratio(liquidAssets, annualEssentialSpending);
