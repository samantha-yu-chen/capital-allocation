import { z } from 'zod';
import { money } from '../contracts.js';
import type { TaxConfig } from '../../config/tax/uk-2026-27.js';

const niInput = z.strictObject({ earnings: money, category: z.enum(['A', 'C']).default('A') });
/** Annualised Class 1: category A or state-pension-age category C. Not a payslip calculator. */
export function calculateNationalInsurance(input: z.input<typeof niInput>, config: TaxConfig) {
  const { earnings, category } = niInput.parse(input), c = config.ni;
  const mainEarnings = Math.max(0, Math.min(earnings, c.upperEarningsLimit) - c.primaryThreshold);
  const upperEarnings = Math.max(0, earnings - c.upperEarningsLimit);
  return { employee: category === 'C' ? 0 : mainEarnings * c.mainRate + upperEarnings * c.upperRate,
    employer: Math.max(0, earnings - c.secondaryThreshold) * c.employerRate, mainEarnings, upperEarnings };
}
