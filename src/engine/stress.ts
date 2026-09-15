/** Synthetic deterministic stresses. These are assumptions, never historical backtests. */
import { parseProfile, type MarketPath, type Profile } from '../domain/contracts.js';
import { defaultLedgerOptions, runProjection, type LedgerOptions } from './ledger.js';
import { deterministicPath } from './returns.js';
import { sequenceObservation } from './monte-carlo/simulation.js';

export const STRESS_VERSION = 'synthetic-stress-v1';
export const STRESSES = ['crash_2000_style', 'crash_2008_style', 'high_inflation', 'lost_decade', 'mortgage_shock', 'property_crash', 'job_loss'] as const;
export type StressId = typeof STRESSES[number];
export const STRESS_ASSUMPTIONS: Record<StressId, string> = {
  crash_2000_style: 'Synthetic 2000-style: equity returns −15%, −20%, −25% over three years; other years/assets use entered nominal means.',
  crash_2008_style: 'Synthetic 2008-style: one equity return of −40%; other years/assets use entered nominal means.',
  high_inflation: 'Inflation 8% for ten years; nominal asset returns stay at entered means. Salary and tax thresholds retain the model’s inflation indexing.',
  lost_decade: 'Equity nominal returns 0% for ten years; other assets and inflation use entered means.',
  mortgage_shock: 'Mortgage rate 9% for three years, recast over the remaining term; contractual rate schedule resumes afterwards. No lender fees.',
  property_crash: 'One property return of −30%; no automatic sale or equity release.',
  job_loss: 'Salary, bonus, pensionable pay and any retirement employment are zero for one year, then resume the entered trajectory. Other income remains; no benefits or severance.',
};
export function stressPath(profile: Profile, id: StressId, startAge: number): MarketPath {
  if (!STRESSES.includes(id) || !Number.isInteger(startAge) || startAge < profile.personal.currentAge || startAge >= profile.personal.endAge) throw new RangeError('Stress must start within the projection');
  const start = startAge - profile.personal.currentAge;
  const path = deterministicPath(profile.personal.endAge - profile.personal.currentAge, profile.market);
  return { ...path, years: path.years.map((year, i) => {
    const offset = i - start;
    if (offset < 0) return year;
    if (id === 'crash_2000_style' && offset < 3) return { ...year, equities: [-.15, -.2, -.25][offset]! };
    if (id === 'crash_2008_style' && offset === 0) return { ...year, equities: -.4 };
    if (id === 'high_inflation' && offset < 10) return { ...year, inflation: .08 };
    if (id === 'lost_decade' && offset < 10) return { ...year, equities: 0 };
    if (id === 'mortgage_shock' && offset < 3) return { ...year, mortgageAnnualRate: .09 };
    if (id === 'property_crash' && offset === 0) return { ...year, property: -.3 };
    if (id === 'job_loss' && offset === 0) return { ...year, employmentMultiplier: 0 };
    return year;
  }) };
}
export function runStress(input: Profile, id: StressId, startAge: number, overrides: Partial<LedgerOptions> = {}) {
  const profile = parseProfile(input);
  const options = { ...defaultLedgerOptions(), ...overrides };
  if (options.rentInvestment || options.marginalAction) throw new RangeError('Ordinary stresses require null comparison actions');
  if ((id === 'mortgage_shock' || id === 'property_crash') && !profile.property) throw new RangeError('Configure a property to test this stress');
  const path = stressPath(profile, id, startAge);
  const projection = runProjection(profile, path, options);
  return { id, startAge, assumptions: STRESS_ASSUMPTIONS[id], version: STRESS_VERSION, path, projection,
    diagnostics: sequenceObservation(profile, projection, path) };
}
export type StressResult = ReturnType<typeof runStress>;
