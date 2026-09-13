import { regionSchema, type TaxRegion } from '../../domain/contracts.js';

export interface TaxBand { readonly name: string; readonly upper: number | null; readonly rate: number }
export interface TaxConfig {
  readonly version: string; readonly taxYear: '2026/27'; readonly region: TaxRegion;
  readonly effectiveFrom: string; readonly effectiveTo: string; readonly verifiedOn: string;
  readonly personalAllowance: number; readonly taperThreshold: number; readonly taperReductionRate: number;
  readonly nonSavingsBands: readonly TaxBand[]; readonly ukBands: readonly TaxBand[];
  readonly savings: { readonly startingRateLimit: number; readonly basicAllowance: number; readonly higherAllowance: number };
  readonly dividends: { readonly allowance: number; readonly rates: readonly [number, number, number] };
  readonly ni: { readonly primaryThreshold: number; readonly upperEarningsLimit: number; readonly mainRate: number;
    readonly upperRate: number; readonly secondaryThreshold: number; readonly employerRate: number };
  readonly pension: { readonly annualAllowance: number; readonly thresholdIncomeLimit: number;
    readonly adjustedIncomeLimit: number; readonly minimumAnnualAllowance: number; readonly taperReductionRate: number;
    readonly moneyPurchaseAllowance: number; readonly reliefAtSourceRate: number; readonly nonEarnerGrossLimit: number;
    readonly memberReliefAgeLimit: number; readonly lumpSumAllowance: number; readonly taxFreeFraction: number };
  readonly isaAllowance: number;
  readonly cgt: { readonly annualExemptAmount: number; readonly basicRate: number; readonly higherRate: number };
  readonly sources: readonly string[];
}
const ukBands: readonly TaxBand[] = [
  { name: 'basic', upper: 37_700, rate: 0.2 },
  { name: 'higher', upper: 125_140, rate: 0.4 },
  { name: 'additional', upper: null, rate: 0.45 },
];
const scottishBands: readonly TaxBand[] = [
  { name: 'starter', upper: 3_967, rate: 0.19 },
  { name: 'basic', upper: 16_956, rate: 0.2 },
  { name: 'intermediate', upper: 31_092, rate: 0.21 },
  { name: 'higher', upper: 62_430, rate: 0.42 },
  { name: 'advanced', upper: 125_140, rate: 0.45 },
  { name: 'top', upper: null, rate: 0.48 },
];
const sources = [
  'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027',
  'https://www.gov.uk/income-tax-rates',
  'https://www.gov.uk/scottish-income-tax',
  'https://www.gov.uk/tax-on-dividends',
  'https://www.gov.uk/apply-tax-free-interest-on-savings',
  'https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief',
  'https://www.gov.uk/government/publications/rates-and-allowances-pension-schemes/pension-schemes-rates',
  'https://www.gov.uk/guidance/pension-schemes-work-out-your-tapered-annual-allowance',
  'https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm044100',
  'https://www.gov.uk/individual-savings-accounts/how-isas-work',
  'https://www.gov.uk/capital-gains-tax/rates',
  'https://www.gov.uk/capital-gains-tax/losses',
];
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
function createConfig(region: TaxRegion): TaxConfig {
  return deepFreeze({
    version: `uk-2026-27-${region}-v1`, taxYear: '2026/27', region,
    effectiveFrom: '2026-04-06', effectiveTo: '2027-04-05', verifiedOn: '2026-09-13',
    personalAllowance: 12_570, taperThreshold: 100_000, taperReductionRate: 0.5,
    nonSavingsBands: region === 'scotland' ? scottishBands : ukBands, ukBands,
    savings: { startingRateLimit: 5_000, basicAllowance: 1_000, higherAllowance: 500 },
    dividends: { allowance: 500, rates: [0.1075, 0.3575, 0.3935] },
    ni: { primaryThreshold: 12_570, upperEarningsLimit: 50_270, mainRate: 0.08, upperRate: 0.02,
      secondaryThreshold: 5_000, employerRate: 0.15 },
    pension: { annualAllowance: 60_000, thresholdIncomeLimit: 200_000, adjustedIncomeLimit: 260_000,
      minimumAnnualAllowance: 10_000, taperReductionRate: 0.5, moneyPurchaseAllowance: 10_000,
      reliefAtSourceRate: 0.2, nonEarnerGrossLimit: 3_600, memberReliefAgeLimit: 75,
      lumpSumAllowance: 268_275, taxFreeFraction: 0.25 },
    isaAllowance: 20_000, cgt: { annualExemptAmount: 3_000, basicRate: 0.18, higherRate: 0.24 }, sources,
  });
}
const configs = { scotland: createConfig('scotland'), rest_of_uk: createConfig('rest_of_uk') };
export function getTaxConfig(region: TaxRegion, taxYear: string): TaxConfig {
  regionSchema.parse(region);
  if (taxYear !== '2026/27') throw new RangeError(`Unsupported tax year: ${taxYear}. Available: 2026/27`);
  return configs[region];
}

/** Explicit constant-real projection policy. Scale every monetary threshold, never rates. */
export function scaleTaxConfig(config: TaxConfig, inflationIndex: number): TaxConfig {
  if (!Number.isFinite(inflationIndex) || inflationIndex <= 0) throw new RangeError('inflationIndex must be positive');
  const x = inflationIndex;
  const bands = (b: readonly TaxBand[]) => b.map(v => ({ ...v, upper: v.upper === null ? null : v.upper * x }));
  return deepFreeze({ ...config, personalAllowance: config.personalAllowance * x, taperThreshold: config.taperThreshold * x,
    nonSavingsBands: bands(config.nonSavingsBands), ukBands: bands(config.ukBands),
    savings: { startingRateLimit: config.savings.startingRateLimit * x, basicAllowance: config.savings.basicAllowance * x,
      higherAllowance: config.savings.higherAllowance * x },
    dividends: { ...config.dividends, allowance: config.dividends.allowance * x },
    ni: { ...config.ni, primaryThreshold: config.ni.primaryThreshold * x, upperEarningsLimit: config.ni.upperEarningsLimit * x,
      secondaryThreshold: config.ni.secondaryThreshold * x },
    pension: { ...config.pension, annualAllowance: config.pension.annualAllowance * x,
      thresholdIncomeLimit: config.pension.thresholdIncomeLimit * x, adjustedIncomeLimit: config.pension.adjustedIncomeLimit * x,
      minimumAnnualAllowance: config.pension.minimumAnnualAllowance * x, moneyPurchaseAllowance: config.pension.moneyPurchaseAllowance * x,
      nonEarnerGrossLimit: config.pension.nonEarnerGrossLimit * x, lumpSumAllowance: config.pension.lumpSumAllowance * x },
    isaAllowance: config.isaAllowance * x, cgt: { ...config.cgt, annualExemptAmount: config.cgt.annualExemptAmount * x },
  });
}
