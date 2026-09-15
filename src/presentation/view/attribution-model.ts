import type { Profile } from '../../domain/contracts.js';
import { buildAnalysisCases, type AnalysisCell, type AttributionResult, type AttributionProgress } from '../../engine/attribution.js';
import type { LedgerOptions } from '../../engine/ledger.js';
import { money, moneySigned, percent, percentagePoints, sampledProbability, count, years } from './format.js';

export function attributionPlan(profile: Profile, options: LedgerOptions, draft: string) {
  const age = draft.trim() === '' ? NaN : Number(draft);
  const valid = Number.isInteger(age) && age >= profile.personal.currentAge && age < profile.personal.endAge;
  const cells = buildAnalysisCases(profile,options);
  return { valid, request: {stressAge:age,ledgerOptions:options},
    issue: valid ? null : 'Enter a whole stress age within the projection.',
    announcement: `Up to ${count(cells.length)} complete simulations, each at all ${count(profile.simulation.count)} entered paths, plus seven deterministic stresses. This can take several minutes. One worker pool serves the batch; cancellation publishes no partial analysis.` };
}
export function probabilityError(cell: AnalysisCell): number {
  const r=cell.result; return r ? Math.sqrt(r.successProbability*(1-r.successProbability)/r.metadata.simulationCount) : NaN;
}
/** Sum of marginal SEs bounds the paired difference SE without assuming independence. */
export function effect(base: AnalysisCell, candidate: AnalysisCell) {
  if(!base.result||!candidate.result)return null;
  const delta=candidate.result.successProbability-base.result.successProbability;
  const error=probabilityError(base)+probabilityError(candidate);
  return {delta,error,material:Math.abs(delta)>1.96*error};
}
export function attributionRows(result: AttributionResult, sensitivity=false) {
  const base=result.cells[0]!;
  return result.cells.filter(c=>sensitivity?c.group==='sensitivity':c.group!=='sensitivity').map(c=>{
    const r=c.result,e=effect(base,c);
    const at=r?.wealthByAge.find(y=>y.age===c.profile.personal.targetFireAge);
    return {id:c.id,label:c.label,reason:c.reason,group:c.group,
      probability:r?`${percent(r.successProbability,2)} ± ${percent(probabilityError(c),2)} SE`:'Unsupported',
      delta:e?`${e.delta>0?'+':''}${percentagePoints(e.delta)}; SE ≤ ${percentagePoints(e.error)}`:'—',
      evidence:e?(c.id==='baseline'?'Reference':e.material?'Exceeds 95% sampling bound':'Within sampling uncertainty'):'Unsupported',
      width:e?Math.min(100,Math.abs(e.delta)*100):0,negative:e?e.delta<0:false,
      terminal:r?money(r.terminalWealth.median):'—',downside:r?money(r.terminalWealth.p10):'—',
      liquid:at?money(at.liquid.median):'—',pension:at?money(at.pension.median):'—',property:at?money(at.propertyEquity.median):'—',
      age:String(c.profile.personal.targetFireAge),spending:c.options.monthlyHouseholdOverride===null?'Entered schedule':`${money(c.options.monthlyHouseholdOverride)}/mo`,
      bridge:r?sampledProbability(r.bridgeFailureProbability,r.metadata.simulationCount):'—',
    };
  });
}
export function attributionConclusion(result: AttributionResult): string {
  const base=result.cells[0]!;
  const tested=result.cells.filter(c=>['income','expenses','allocation'].includes(c.group)&&c.result).map(c=>({c,e:effect(base,c)!})).sort((a,b)=>b.e.delta-a.e.delta);
  const first=tested[0];
  if(!first || !first.e.material || tested.slice(1).some(x=>first.e.delta-x.e.delta<=1.96*(probabilityError(first.c)+probabilityError(x.c))))
    return 'The tested income, expenses and allocation changes do not establish a single largest improvement beyond sampling uncertainty. These are specific changes of different sizes, not universal rankings.';
  return `${first.c.group === 'expenses' ? 'Lower expenses' : first.c.group === 'income' ? 'More income' : 'Allocation'} has the largest tested improvement among income, expenses and allocation: ${first.c.label} (${percentagePoints(first.e.delta)}). This ranks these specific changes, not all possible plans.`;
}
export const attributionCaveats = [
  'Each row changes the entered plan once and reruns the complete lifetime model. Effects interact: income changes tax and contributions, spending changes both saving and required capital, and allocation changes bridge liquidity. Do not add these effects or interpret them as shares of a causal decomposition.',
  'All comparisons use the same seed, absolute path indices and underlying Gaussian shocks. Return sensitivities change the distribution’s moments while preserving correlation. SE describes sampling only; the displayed difference SE bound is the sum of both marginal SEs and is conservative. Findings require exceeding 1.96 times that bound.',
  'The objective here is full-plan funding success. Median terminal net worth, downside and accessible capital are different objectives; unsold property equity cannot fund spending. A larger deposit uses existing assets and a shorter mortgage term raises required payments.',
  'Pension withdrawal tax cases add a hypothetical 5pp or 10pp charge on the taxable withdrawal only, on top of the configured tax calculation. They are assumption tests, not enacted tax changes or flat tax replacements. Volatility and FIRE age need not have a universally monotone effect.',
];
export function stressRows(result: AttributionResult) {
  return result.stresses.map(s=>{
    const r=s.result,y=r?.projection;return {id:s.id,title:s.id.replaceAll('_',' '),reason:s.reason,assumptions:r?.assumptions??'',
      outcome:y?(y.success?'Funds the full horizon':'Funding failure'):'Unsupported',
      terminal:y?money(y.metrics.terminalNetWorthReal):'—',delta:y?moneySigned(y.metrics.terminalNetWorthReal-result.deterministic.metrics.terminalNetWorthReal):'—',
      failures:y?y.failures.map(f=>`Age ${f.age}: ${f.code}; ${money(f.shortfall/y.years.find(row=>row.age===f.age)!.inflationIndex)} real shortfall`):[],
      diagnostic:r?`First-five-FIRE-year >20% drawdown: ${r.diagnostics.drawdownOver20?'yes':'no'}; liquid assets below two years’ spending: ${r.diagnostics.belowTwoYearsSpending?'yes':'no'}; observed recovery: ${years(r.diagnostics.recoveryYears)}. Diagnostic flags are not causes.`:'',
    };
  });
}
export function attributionDiagnostics(result: AttributionResult) {
  const r=result.cells[0]!.result!;
  const n=r.metadata.simulationCount;
  return {failures:Object.entries(r.observedFailureProbabilities).map(([label,p])=>({label,value:sampledProbability(p,n)})),
    sequence:`First five FIRE years: >20% financial drawdown ${sampledProbability(r.sequenceRisk.drawdownOver20Probability,n)}; accessible capital below two years’ spending ${sampledProbability(r.sequenceRisk.belowTwoYearsSpendingProbability,n)}. Median recovery ${years(r.sequenceRisk.medianRecoveryYears)}, conditional on ${count(r.sequenceRisk.recoveredPaths)} recovered paths; ${count(r.sequenceRisk.unrecoveredPaths)} unrecovered.`,
    diagnostics:Object.entries({earlyEquityCrash:r.diagnostics.earlyEquityCrash,highEarlyInflation:r.diagnostics.highEarlyInflation}).map(([label,d])=>({label,text:`Present in ${sampledProbability(d.probability,n)} of paths; failure when present ${d.failureProbabilityWhenPresent===null?'no observations':sampledProbability(d.failureProbabilityWhenPresent,d.paths)}, when absent ${d.failureProbabilityWhenAbsent===null?'no observations':sampledProbability(d.failureProbabilityWhenAbsent,n-d.paths)}.`})),
    interpretation:r.diagnostics.interpretation};
}
export function attributionProgress(p: AttributionProgress|null): string {return p?`${p.casesCompleted}/${p.casesPlanned} cases · ${p.stage} · ${count(p.paths.completed)}/${count(p.paths.total)} paths`:'Starting analysis…';}
