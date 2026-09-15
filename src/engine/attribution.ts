import { parseProfile, type Profile } from '../domain/contracts.js';
import { stableStringify } from '../domain/stable-json.js';
import { PensionLimitError } from '../domain/tax/index.js';
import { defaultLedgerOptions, runDeterministicProjection, type LedgerOptions } from './ledger.js';
import { abortIfNeeded, ledgerOptionsSchema, runMonteCarlo, type MonteCarloResult } from './monte-carlo/simulation.js';
import { assertCommonPaths, type EvaluateProfile } from './solver.js';
import { assertScenarioPaths, bandOptimisedContribution, engineVersions, type ScenarioProgress } from './scenario.js';
import { STRESSES, STRESS_ASSUMPTIONS, STRESS_VERSION, runStress, type StressResult } from './stress.js';

export const ATTRIBUTION_VERSION = 'attribution-sensitivity-v1';
export interface AttributionRequest { stressAge: number; ledgerOptions?: Partial<LedgerOptions> }
export type AnalysisGroup = 'baseline' | 'income' | 'expenses' | 'allocation' | 'timing' | 'risk' | 'property' | 'sensitivity';
export interface AnalysisCase { id: string; label: string; group: AnalysisGroup; profile: Profile; options: LedgerOptions; reason: string | null }
export interface AnalysisCell extends AnalysisCase { result: MonteCarloResult | null; key: string; fromCache: boolean }
export interface AttributionResult {
  cells: AnalysisCell[];
  stresses: { id: string; reason: string | null; result: StressResult | null }[];
  deterministic: ReturnType<typeof runDeterministicProjection>;
  metadata: { version: string; stressVersion: string; versions: ReturnType<typeof engineVersions>; profile: Profile; request: AttributionRequest; options: LedgerOptions };
}
export type AttributionProgress = ScenarioProgress;
export const analysisCellKey = (profile: Profile, options: LedgerOptions): string => stableStringify({
  profile, options, versions: engineVersions(profile), version: ATTRIBUTION_VERSION, stressVersion: STRESS_VERSION,
});
export type AnalysisCache = Map<string, MonteCarloResult>;

/** Fixed pre-run cuts: discretionary first; never cut the retirement floor or adapt within a run. */
export function reduceSpending(profile: Profile, monthly: number): Profile {
  const p = parseProfile(profile);
  const cut = (s: {essentialMonthly: number; discretionaryMonthly: number}) => {
    if (s.discretionaryMonthly < monthly) throw new RangeError('The fixed cut exceeds discretionary spending in a phase');
    s.discretionaryMonthly -= monthly;
  };
  cut(p.spending.current); cut(p.spending.retirement); p.spending.phases.forEach(cut);
  p.spending.breakdown = null;
  return parseProfile(p);
}
export function buildAnalysisCases(input: Profile, overrides: Partial<LedgerOptions> = {}): AnalysisCase[] {
  const base = parseProfile(input);
  const options = ledgerOptionsSchema.parse({ ...defaultLedgerOptions(), ...overrides });
  if (options.marginalAction || options.rentInvestment || options.measureAllocation) throw new RangeError('Attribution requires ordinary runs with null actions and measureAllocation false');
  const cases: AnalysisCase[] = [];
  const add = (id: string, label: string, group: AnalysisGroup, change: (p: Profile, o: LedgerOptions) => void) => {
    let p = parseProfile(base); const o = structuredClone(options); let reason: string | null = null;
    try { change(p, o); p = parseProfile(p); ledgerOptionsSchema.parse(o); }
    catch (e) { reason = e instanceof Error ? e.message : String(e); }
    cases.push({ id, label, group, profile: p, options: o, reason });
  };
  add('baseline', 'Entered plan', 'baseline', () => {});
  add('income', 'Gross salary +£10,000/year', 'income', p => { p.income.salaryAnnual += 10000; });
  add('expenses', 'Fixed spending −£3,000/year in all phases', 'expenses', (p, o) => {
    if (o.monthlyHouseholdOverride !== null) {
      if (12 * (o.monthlyHouseholdOverride - 250) < p.spending.retirementFloorAnnual) throw new RangeError('Cut would breach the retirement floor');
      o.monthlyHouseholdOverride -= 250;
    } else Object.assign(p, reduceSpending(p, 250));
  });
  add('pension', 'Pension contribution to leave the top occupied tax band', 'allocation', p => { p.pension.employeeRate = bandOptimisedContribution(p).rate; });
  add('isa', 'Route future surplus to ISA, then GIA', 'allocation', (_p, o) => { o.surplusAllocation = 'isa_then_gia'; });
  add('gia', 'Route future surplus to GIA', 'allocation', (_p, o) => { o.surplusAllocation = 'gia_only'; });
  add('timing', 'FIRE two years later', 'timing', p => { p.personal.targetFireAge += 2; });
  add('risk', 'Shift 10pp of bonds/cash to equities in every wrapper', 'risk', p => {
    for (const portfolio of Object.values(p.portfolios)) {
      if (portfolio.bonds + portfolio.cash < .1 - 1e-9) throw new RangeError('A wrapper has less than 10pp available outside equities');
      const bonds = Math.min(.1, portfolio.bonds); portfolio.bonds -= bonds; portfolio.cash -= .1 - bonds; portfolio.equities += .1;
    }
  });
  add('property', 'Larger deposit (£10,000) or mortgage term five years shorter', 'property', p => {
    if (!p.property) throw new RangeError('Configure a property first; no property is invented');
    if (p.property.purchase) p.property.purchase.deposit += 10000;
    else p.property.mortgageTermYears -= 5;
  });
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'low' : 'high';
    add(`equity-return-${side}`, `Equity nominal mean ${sign < 0 ? '−' : '+'}2pp`, 'sensitivity', p => { p.market.equities.meanNominal += sign * .02; });
    add(`equity-volatility-${side}`, `Equity volatility ${sign < 0 ? '−' : '+'}5pp`, 'sensitivity', p => { p.market.equities.volatility += sign * .05; });
    add(`inflation-${side}`, `Inflation mean ${sign < 0 ? '−' : '+'}1pp`, 'sensitivity', p => { p.market.inflation.mean += sign * .01; });
    add(`salary-growth-${side}`, `Real salary growth ${sign < 0 ? '−' : '+'}1pp`, 'sensitivity', p => { p.income.salaryGrowthReal += sign * .01; });
    add(`fire-age-${side}`, `FIRE age ${sign < 0 ? '−' : '+'}2 years`, 'sensitivity', p => { p.personal.targetFireAge += sign * 2; });
    add(`mortgage-rate-${side}`, `Mortgage rates ${sign < 0 ? '−' : '+'}2pp (including refinances)`, 'sensitivity', p => {
      if (!p.property) throw new RangeError('Configure a property first');
      p.property.mortgageAnnualRate += sign * .02;
      p.property.rateChanges.forEach(r => { r.annualRate += sign * .02; });
    });
    add(`property-growth-${side}`, `Property nominal growth ${sign < 0 ? '−' : '+'}2pp`, 'sensitivity', p => {
      if (!p.property) throw new RangeError('Configure a property first');
      p.market.property.meanNominal += sign * .02;
    });
  }
  for (const side of ['low', 'base', 'high'] as const) add(`spending-${side}`, `Household spending: ${side} configured case`, 'sensitivity', (p,o) => { o.monthlyHouseholdOverride = p.spending.scenarioMonthly[side]; });
  for (const extra of [.05, .1]) add(`pension-tax-${extra}`, `Additional tax on taxable pension withdrawals: +${extra * 100}pp`, 'sensitivity', (_p,o) => { o.pensionWithdrawalSurtaxRate += extra; });
  return cases;
}

/** Market sensitivities change moments, not the seed, normal draws or correlation matrix.
 * Existing strict assertions still apply to every other input. Never normalise the correlation.
 */
export function assertSensitivityPaths(base: Profile, candidate: Profile, a?: MonteCarloResult, b?: MonteCarloResult): void {
  if (stableStringify(base.market.correlation) !== stableStringify(candidate.market.correlation)) throw new Error('Sensitivity must preserve correlation and normal draws');
  assertCommonPaths(base, { ...candidate, market: base.market });
  if (a && b) {
    if (stableStringify(b.metadata.profile) !== stableStringify(candidate) || stableStringify(a.metadata.profile) !== stableStringify(base)) throw new Error('Evaluator returned a different profile');
    assertScenarioPaths(a, { ...b, metadata: { ...b.metadata, profile: { ...b.metadata.profile, market: a.metadata.profile.market } } });
  }
}

/** All-or-nothing publication and cache commit. Each candidate runs the full entered count. */
export async function runAttribution(input: Profile, request: AttributionRequest, controls: {
  signal?: AbortSignal; onProgress?: (progress: AttributionProgress) => void; evaluate?: EvaluateProfile; cache?: AnalysisCache;
} = {}): Promise<AttributionResult> {
  const profile = parseProfile(input); const snapshot = structuredClone(request);
  const cases = buildAnalysisCases(profile, snapshot.ledgerOptions);
  const options = cases[0]!.options;
  if (!Number.isInteger(snapshot.stressAge) || snapshot.stressAge < profile.personal.currentAge || snapshot.stressAge >= profile.personal.endAge) throw new RangeError('Stress age must fall within the projection');
  const evaluate: EvaluateProfile = controls.evaluate ?? ((p,c) => runMonteCarlo(p,c));
  const cells: AnalysisCell[] = []; const pending = new Map<string, MonteCarloResult>();
  let reference: MonteCarloResult | null = null;
  const progress = (stage: string, completed: number, total: number) => controls.onProgress?.({stage, casesCompleted: cells.length, casesPlanned: cases.length, paths: {completed,total}});
  for (const item of cases) {
    abortIfNeeded(controls.signal);
    const key = analysisCellKey(item.profile, item.options);
    if (item.reason) { cells.push({...item,key,result:null,fromCache:false}); continue; }
    assertSensitivityPaths(profile, item.profile);
    let result = pending.get(key) ?? controls.cache?.get(key); const fromCache = !!result;
    try {
      result ??= await evaluate(item.profile, {ledgerOptions:item.options,
        ...(controls.signal ? {signal:controls.signal} : {}), onProgress: p => progress(item.label,p.completed,p.total)});
    } catch (e) {
      abortIfNeeded(controls.signal);
      if (e instanceof PensionLimitError || (e instanceof Error && e.name === 'PensionLimitError')) {
        if (!reference) throw e;
        cells.push({...item,key,result:null,fromCache:false,reason:e.message}); continue;
      }
      throw e;
    }
    abortIfNeeded(controls.signal);
    if (stableStringify(result.metadata.ledgerOptions) !== stableStringify(item.options)) throw new Error('Evaluator changed ledger options');
    if (!reference) reference = result;
    assertSensitivityPaths(profile,item.profile,reference,result);
    if (result.metadata.pathIndices.start !== 0 || result.metadata.pathIndices.endExclusive !== profile.simulation.count || result.metadata.simulationCount !== profile.simulation.count || result.metadata.seed !== profile.simulation.seed) throw new Error('Analysis did not run the full matching path range');
    pending.set(key,result); cells.push({...item,key,result,fromCache}); progress(item.label,profile.simulation.count,profile.simulation.count);
  }
  const stresses: AttributionResult['stresses'] = [];
  for (const id of STRESSES) {
    abortIfNeeded(controls.signal);
    if ((id === 'mortgage_shock' || id === 'property_crash') && !profile.property) {
      stresses.push({id,reason:`Configure a property first. ${STRESS_ASSUMPTIONS[id]}`,result:null}); continue;
    }
    try { stresses.push({id,reason:null,result:runStress(profile,id,snapshot.stressAge,options)}); }
    catch (e) { if (e instanceof PensionLimitError) stresses.push({id,reason:e.message,result:null}); else throw e; }
  }
  const deterministic = runDeterministicProjection(profile,options);
  abortIfNeeded(controls.signal);
  for (const [key,result] of pending) controls.cache?.set(key,structuredClone(result));
  return {cells,stresses,deterministic,metadata:{version:ATTRIBUTION_VERSION,stressVersion:STRESS_VERSION,versions:engineVersions(profile),profile,request:snapshot,options}};
}
