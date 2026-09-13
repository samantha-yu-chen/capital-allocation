import { z } from 'zod';
import { money } from '../contracts.js';
import type { TaxConfig } from '../../config/tax/uk-2026-27.js';

const gainsSchema = z.strictObject({ realisedGains: money, currentYearLosses: money.default(0),
  carriedLosses: money.default(0),
  /** From calculateIncomeTax: nil-rate savings/dividends still occupy the basic band. */
  remainingBasicRateBand: money,
});
export function calculateCapitalGainsTax(input: z.input<typeof gainsSchema>, config: TaxConfig) {
  const p = gainsSchema.parse(input), c = config.cgt;
  const currentLossUsed = Math.min(p.realisedGains, p.currentYearLosses);
  const netGains = p.realisedGains - currentLossUsed;
  const exemptionUsed = Math.min(netGains, c.annualExemptAmount);
  const broughtForwardLossUsed = Math.min(p.carriedLosses, netGains - exemptionUsed);
  const taxableGains = netGains - exemptionUsed - broughtForwardLossUsed;
  const basicRateGains = Math.min(taxableGains, p.remainingBasicRateBand);
  const higherRateGains = taxableGains - basicRateGains;
  return { taxableGains, basicRateGains, higherRateGains, exemptionUsed, currentLossUsed, broughtForwardLossUsed,
    carriedLossesRemaining: p.carriedLosses - broughtForwardLossUsed + p.currentYearLosses - currentLossUsed,
    tax: basicRateGains * c.basicRate + higherRateGains * c.higherRate };
}
/** Aggregate pool primitive for modelling disposals; does not implement share-matching transaction rules. */
export function realiseGiaDisposal(marketValue: number, costBasis: number, proceeds: number) {
  money.parse(marketValue); money.parse(costBasis); money.parse(proceeds);
  if (proceeds > marketValue) throw new RangeError('Disposal exceeds GIA market value');
  if (marketValue === 0 && costBasis > 0) throw new RangeError('Zero-valued pool requires an explicit loss/write-off event');
  const basisDisposed = marketValue === 0 ? 0 : costBasis * proceeds / marketValue;
  const gain = proceeds - basisDisposed;
  return { proceeds, basisDisposed, realisedGain: Math.max(0, gain), realisedLoss: Math.max(0, -gain),
    remainingValue: marketValue - proceeds, remainingCostBasis: costBasis - basisDisposed };
}
export function assessIsaContribution(requested: number, allowanceUsed: number, config: TaxConfig) {
  money.parse(requested); money.parse(allowanceUsed);
  const remaining = Math.max(0, config.isaAllowance - allowanceUsed);
  return { remaining, permitted: Math.min(requested, remaining), excess: Math.max(0, requested - remaining),
    existingExcess: Math.max(0, allowanceUsed - config.isaAllowance) };
}
