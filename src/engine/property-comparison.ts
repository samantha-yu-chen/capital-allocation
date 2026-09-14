import { parseProfile, type Profile } from '../domain/contracts.js';
import { runProjection, defaultLedgerOptions, ENGINE_VERSION, type DeterministicProjection, type LedgerOptions } from './ledger.js';
import { ParametricReturnGenerator } from './monte-carlo/generator.js';
import { distribution } from './monte-carlo/statistics.js';
import { abortIfNeeded, ledgerOptionsSchema, type SimulationProgress } from './monte-carlo/simulation.js';
import { accessibleWealth, netWorth } from './accounts.js';

/** Buy comparison is meaningful for a planned purchase with the SAME opening financial assets.
 * The renter invests the avoided deposit and transaction costs at the purchase age, subject to
 * that year's ISA allowance, then GIA. No extra money is credited to either scenario.
 */
export function rentAndInvestProfile(profile: Profile): Profile {
  if (!profile.property?.purchase) throw new RangeError('Rent-and-invest requires a planned purchase; existing ownership has no unspent deposit');
  return parseProfile({ ...structuredClone(profile), property:null });
}
function observation(p: DeterministicProjection) {
  const last=p.years.at(-1)!;
  let peak=netWorth(p.years[0]!.opening), maxDrawdown=0;
  let minLiquid=accessibleWealth(p.years[0]!.opening), maxDebt=p.years[0]!.opening.mortgageDebt;
  for(const y of p.years){
    const wealth=y.netWorth/y.closingInflationIndex;
    peak=Math.max(peak,wealth);
    if(peak>0)maxDrawdown=Math.max(maxDrawdown,(peak-wealth)/peak);
    minLiquid=Math.min(minLiquid,y.accessibleWealth/y.closingInflationIndex);
    maxDebt=Math.max(maxDebt,y.opening.mortgageDebt/y.inflationIndex,
      (y.propertyPurchasePrice-y.propertyPurchaseFunding+y.propertyAcquisitionCosts)/y.inflationIndex,
      y.closing.mortgageDebt/y.closingInflationIndex);
  }
  return {success:p.success,terminal:p.metrics.terminalNetWorthReal,liquid:last.accessibleWealth/last.closingInflationIndex,
    minLiquid,maxDebt,maxDrawdown, mortgageFailure:p.failures.some(f=>f.code==='mortgage_shortfall')};
}
type Observation=ReturnType<typeof observation>;
function summarise(samples:Observation[]){return {
  successProbability:samples.filter(s=>s.success).length/samples.length,
  mortgageFailureProbability:samples.filter(s=>s.mortgageFailure).length/samples.length,
  terminal:distribution(samples.map(s=>s.terminal)), liquid:distribution(samples.map(s=>s.liquid)),
  minimumLiquidity:distribution(samples.map(s=>s.minLiquid)), maximumDebt:distribution(samples.map(s=>s.maxDebt)),
  maximumDrawdown:distribution(samples.map(s=>s.maxDrawdown)),
};}
export type PropertyComparison = Awaited<ReturnType<typeof comparePropertyPlans>>;

/** Exact paired path comparisons. Browser caller runs this entire operation in a worker. */
export async function comparePropertyPlans(input:Profile, controls:{signal?:AbortSignal;onProgress?:(p:SimulationProgress)=>void;ledgerOptions?:Partial<LedgerOptions>}={}){
  const buy=parseProfile(structuredClone(input));
  const rent=rentAndInvestProfile(buy);
  const options=ledgerOptionsSchema.parse({...defaultLedgerOptions(),...controls.ledgerOptions});
  const generator=new ParametricReturnGenerator();
  const a:Observation[]=[],b:Observation[]=[];
  const total=buy.simulation.count;
  for(let i=0;i<total;i++){
    abortIfNeeded(controls.signal);
    const path=generator.generatePath({years:buy.personal.endAge-buy.personal.currentAge,seed:buy.simulation.seed,pathIndex:i,assumptions:buy.market});
    a.push(observation(runProjection(buy,path,options)));
    // Preserve the funding policy, but deploy the renter's unspent purchase budget at that age.
    b.push(observation(runProjection(rent,path,{...options, rentInvestment: {
      age: buy.property!.purchase!.age,
      amount: buy.property!.purchase!.deposit + buy.property!.purchase!.transactionCosts + purchaseTax(buy.property!,buy.personal.taxRegion),
    }})));
    if((i+1)%50===0 || i+1===total){controls.onProgress?.({completed:i+1,total});await new Promise(r=>setTimeout(r,0));}
  }
  abortIfNeeded(controls.signal);
  return {buy:summarise(a),rent:summarise(b),pairedTerminalDifference:distribution(a.map((s,i)=>s.terminal-b[i]!.terminal)),
    metadata:{profile:buy,ledgerOptions:options,engineVersion:ENGINE_VERSION,generatorVersion:generator.version,
      seed:buy.simulation.seed,count:total,pathIndices:{start:0,endExclusive:total},moneyBasis:'today' as const,
      rentInvestment:'At purchase age: release up to avoided deposit and costs from cash, fill remaining ISA allowance then GIA; preserve reserve' as const}};
}
import { purchaseTax } from './property.js';
