/**
 * What a pension contribution gives back, named precisely.
 *
 * A.2 note 1 of the improvement plan: `calculatePensionRelief` returns `totalTaxRelief` *excluding*
 * the employee-NI saving, while `personalNetCost` *includes* it. Both are right; they answer
 * different questions. Calling either of them "the tax relief" makes one of them a lie, so this is
 * the only place either figure is given a name, and the names say which question they answer:
 *
 * - **tax relief** — income tax only. Income tax you did not pay, plus what the provider claims
 *   back for you. It is the figure people mean by "40% relief", and it does not include NI.
 * - **tax and National Insurance you no longer pay** — income tax *and* the employee NI a salary
 *   sacrifice avoids. Strictly larger than the tax relief whenever sacrifice saves NI.
 * - **what it actually costs you** — the drop in your take-home pay, which is the contribution minus
 *   the line above. This is `personalNetCost`, and it is the only one of the three a reader can
 *   check against their own payslip.
 *
 * Nothing here computes: every number arrives from `calculatePensionRelief`.
 */
import { money } from './format.js';

/** The shape `calculatePensionRelief` returns under `relief`, narrowed to what is surfaced. */
export interface PensionReliefFigures {
  incomeTaxSaved: number;
  employeeNiSaved: number;
  providerTaxRelief: number;
  totalTaxRelief: number;
  personalNetCost: number;
}

/** A named figure. `label` is the short name; `meaning` is the sentence that stops it being confused. */
export interface PensionReliefLine {
  id: PensionReliefLineId;
  label: string;
  meaning: string;
  amount: number;
  formatted: string;
}

export type PensionReliefLineId = 'taxRelief' | 'taxAndNi' | 'personalNetCost';

/**
 * The name that must never be reused for the other figure.
 *
 * Exported as constants so a screen cannot relabel one as the other without a test noticing: the
 * audit asserts the two labels are different strings and that neither contains the other.
 */
export const TAX_RELIEF_LABEL = 'Tax relief';
export const TAX_AND_NI_LABEL = 'Tax and National Insurance you no longer pay';
export const PERSONAL_NET_COST_LABEL = 'What it actually costs you';

/**
 * The three figures, each with the sentence that distinguishes it.
 *
 * `taxAndNi` is derived here rather than read from the engine because the engine does not return it
 * as a field: it is `incomeTaxSaved + providerTaxRelief + employeeNiSaved`, which is exactly
 * `contribution − personalNetCost`. Deriving it in one place is what keeps a screen from inventing
 * its own sum and calling it relief.
 */
export function pensionReliefLines(relief: PensionReliefFigures): readonly PensionReliefLine[] {
  const taxAndNi = relief.totalTaxRelief + relief.employeeNiSaved;
  const line = (id: PensionReliefLineId, label: string, meaning: string, amount: number): PensionReliefLine =>
    ({ id, label, meaning, amount, formatted: money(amount) });
  return [
    line('taxRelief', TAX_RELIEF_LABEL,
      `Income tax only: ${money(relief.incomeTaxSaved)} of income tax you did not pay, plus `
      + `${money(relief.providerTaxRelief)} the provider claimed back. National Insurance is not in this figure.`,
      relief.totalTaxRelief),
    line('taxAndNi', TAX_AND_NI_LABEL,
      `The tax relief above plus ${money(relief.employeeNiSaved)} of employee National Insurance. `
      + 'A salary sacrifice saves NI as well as income tax, so this is the larger number of the two.',
      taxAndNi),
    line('personalNetCost', PERSONAL_NET_COST_LABEL,
      'How much smaller your take-home pay is: the contribution you made, less the tax and National '
      + 'Insurance you no longer pay.',
      relief.personalNetCost),
  ];
}

/** Every surface that names either figure. The audit test derives its own list and compares. */
export const PENSION_RELIEF_SURFACES = ['src/presentation/cli/tax-example.ts'] as const;
