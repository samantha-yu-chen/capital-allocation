import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import type { Profile, ReturnGenerator } from '../src/domain/contracts.js';
import { ASSETS, monteCarloMetadataSchema, distribution, runMonteCarlo, sequenceObservation, simulateBatch } from '../src/engine/monte-carlo/index.js';
import { runMonteCarloNode } from '../src/engine/monte-carlo/node.js';
import { deterministicPath, runProjection, runDeterministicProjection } from '../src/engine/index.js';
import { strippedProfile, close } from './ledger-helpers.js';
const small = () => { const p = createExampleProfile(); p.simulation.count = 12; return p; };
const zero = (p: Profile) => { ASSETS.forEach(k => { p.market[k].volatility = 0; }); return p; };

test('percentiles interpolate known samples, including one path and observed minimum', () => {
  assert.deepEqual(distribution([40, 0, 20, 10, 30]), { p10:4, p25:10, median:20, p75:30, p90:36, mean:20, worst:0 });
  assert.equal(distribution([7]).median, 7);
  assert.throws(() => distribution([])); assert.throws(() => distribution([Infinity]));
});
test('full results repeat exactly across batches, worker counts and out-of-order completion', async () => {
  const p = small();
  const a = await runMonteCarlo(p, { batchSize: 5 });
  const b = await runMonteCarlo(p, { batchSize: 2, concurrency: 3, executeBatch: async request => {
    await new Promise(resolve => setTimeout(resolve, request.start === 0 ? 20 : 0));
    return simulateBatch(request);
  } });
  const c = await runMonteCarloNode(p, { batchSize: 3, concurrency: 2 });
  assert.deepEqual(a, b); assert.deepEqual(a, c);
});
test('zero-volatility aggregate matches deterministic real wealth at every age and FIRE opening', async () => {
  const p = zero(small()), d = runDeterministicProjection(p), mc = await runMonteCarlo(p);
  assert.equal(mc.terminalWealth.median, d.metrics.terminalNetWorthReal);
  assert.equal(mc.fireCapital.median, d.metrics.investableAssetsAtFireReal);
  assert.equal(mc.wealthByAge[0]!.age, 31); assert.equal(mc.wealthByAge.at(-1)!.age, 95);
  d.years.forEach((y,i) => {
    const row = mc.wealthByAge[i+1]!;
    assert.equal(row.age, y.age+1);
    assert.equal(row.netWorth.median, y.netWorth/y.closingInflationIndex);
    assert.equal(row.liquid.median, y.accessibleWealth/y.closingInflationIndex);
    assert.equal(row.pension.median, (y.closing.accounts.pension+y.closing.accounts.sipp)/y.closingInflationIndex);
  });
});
test('golden C/D/E probabilities count paths once despite repeated overlapping failure events', async () => {
  for (const kind of ['rich','empty','locked']) {
    const p = strippedProfile(p => { p.simulation.count = 16; if(kind==='rich') p.assets.isa=1e9; if(kind==='locked') p.assets.pension=800_000; });
    const result = await runMonteCarlo(p);
    assert.equal(result.successProbability, kind==='rich' ? 1 : 0);
    assert.equal(result.bridgeFailureProbability, kind==='locked' ? 1 : 0);
    assert.equal(result.depletionProbability, kind==='rich' ? 0 : 1);
    assert.equal(result.observedFailureProbabilities.insolvency, 0);
  }
});
test('spending cases reuse paths and retain both surplus and target effects in probability analysis', async () => {
  const p = small(); p.simulation.count = 64;
  const runs = [];
  for (const monthlyHouseholdOverride of Object.values(p.spending.scenarioMonthly)) {
    const ledgerOptions = { monthlyHouseholdOverride };
    runs.push({ mc: await runMonteCarlo(p,{ledgerOptions}), d: runDeterministicProjection(p,ledgerOptions) });
  }
  for(let i=1;i<runs.length;i++) {
    const low=runs[i-1]!, high=runs[i]!;
    assert.ok(low.mc.successProbability>=high.mc.successProbability);
    assert.ok(low.mc.terminalWealth.median>high.mc.terminalWealth.median);
    assert.ok(low.mc.fireCapital.median>high.mc.fireCapital.median);
    assert.ok(low.d.metrics.referenceFireNumber<high.d.metrics.referenceFireNumber);
    close(low.d.years[0]!.investableSurplus-high.d.years[0]!.investableSurplus,4200,.01);
  }
});
test('metadata snapshots profile and resolved options, and survives JSON round-trip', async () => {
  const p = small();
  const result = await runMonteCarlo(p, { ledgerOptions:{retirementLevel:'floor'} });
  monteCarloMetadataSchema.parse(result.metadata);
  p.assets.isa = 0;
  assert.equal(result.metadata.profile.assets.isa, 50_000);
  assert.equal(result.metadata.ledgerOptions.retirementLevel, 'floor');
  assert.equal(result.metadata.profile.simulation.count, 12);
  assert.equal(result.metadata.pathIndices.endExclusive, 12);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  const rerun = await runMonteCarlo(result.metadata.profile, {ledgerOptions: result.metadata.ledgerOptions});
  assert.deepEqual(rerun, result);
});
test('progress is monotonic, exact and cancellation never returns a partial success', async () => {
  const p=small(), values:number[]=[];
  await runMonteCarloNode(p,{batchSize:5,concurrency:2,onProgress:v=>values.push(v.completed)});
  assert.equal(values[0],0); assert.equal(values.at(-1),12);
  assert.deepEqual(values,[...values].sort((a,b)=>a-b));
  const controller=new AbortController();
  await assert.rejects(runMonteCarloNode(p,{batchSize:2,concurrency:2,signal:controller.signal,onProgress:v=>{if(v.completed>=2)controller.abort();}}),{name:'AbortError'});
  await assert.rejects(runMonteCarlo(p,{signal:controller.signal}),{name:'AbortError'});
});
test('custom generator seam propagates inflation year by year and portfolio allocation', async () => {
  const p=small(); p.simulation.count=1;
  const path=deterministicPath(64,p.market);
  const years=path.years.map((y,i)=>({...y,equities: .1,bonds: 0,cash:0,inflation:i%2===0?.1:0}));
  const generator:ReturnGenerator={version:'test-alternating-v1',generatePath:({pathIndex})=>({pathIndex,years})};
  const result=await runMonteCarlo(p,{generator});
  const ledger=runProjection(p,{pathIndex:0,years});
  assert.equal(result.terminalWealth.median,ledger.metrics.terminalNetWorthReal);
  assert.equal(ledger.years[2]!.inflationIndex,1.1);
  p.portfolios.isa={equities:0,bonds:1,cash:0};
  const changed=await runMonteCarlo(p,{generator});
  assert.ok(changed.terminalWealth.median<result.terminalWealth.median);
});
test('sequence risk measures real peak drawdown, recovery and short horizon explicitly', () => {
  const p=zero(strippedProfile(p=>{p.assets.isa=100_000;p.personal.endAge=51;}));
  p.spending.retirement={essentialMonthly:0,discretionaryMonthly:0};p.spending.retirementFloorAnnual=0;
  p.portfolios.isa={equities:1,bonds:0,cash:0};
  const rates=[-.3,0,.5,0,0,0];
  const path={pathIndex:0,years:deterministicPath(6,p.market).years.map((y,i)=>({...y,equities:rates[i]!,inflation:0}))};
  const sequence=sequenceObservation(p,runProjection(p,path),path);
  assert.equal(sequence.drawdownOver20,true);assert.equal(sequence.recoveryYears,2);
  assert.equal(sequence.earlyEquityCrash,true);assert.equal(sequence.highEarlyInflation,false);
  path.years[2]!.equities=0;
  assert.equal(sequenceObservation(p,runProjection(p,path),path).recoveryYears,null);
});
test('sequence liquidity threshold, high inflation association and horizon shorter than five years', async () => {
  const p=zero(strippedProfile(p=>{p.assets.isa=20_000;p.personal.endAge=47;p.simulation.count=1;p.market.inflation.mean=.1;}));
  const r=await runMonteCarlo(p);
  assert.equal(r.sequenceRisk.evaluatedYears,2);
  assert.equal(r.sequenceRisk.belowTwoYearsSpendingProbability,1);
  assert.equal(r.diagnostics.highEarlyInflation.probability,1);
  assert.equal(r.diagnostics.highEarlyInflation.failureProbabilityWhenAbsent,null);
  assert.match(r.diagnostics.interpretation,/not proven causes/);
});
test('validation and worker errors propagate, property works in workers', async () => {
  const p=small();
  await assert.rejects(runMonteCarlo(p,{batchSize:0}));
  await assert.rejects(runMonteCarlo(p,{ledgerOptions:{solverTolerance:NaN}}));
  await assert.rejects(runMonteCarlo(p,{executeBatch:async()=>{throw new Error('transport failed');}}),/transport failed/);
  await assert.rejects(runMonteCarlo(p,{generator:{version:'bad',generatePath:()=>({pathIndex:0,years:[]})}}),/invalid market path/);
  // A validated property is integrated by the same worker ledger.
  p.property={use:'owner_occupied',marketValue:300000,mortgageBalance:240000,mortgageAnnualRate:.04,mortgageTermYears:25,mortgageType:'repayment',maintenanceAnnual:0,insuranceAnnual:0,serviceChargeAnnual:0,councilTaxAnnual:0,rentAnnual:0,occupancyRate:1,managementRate:0,purchase:null,sale:null,rateChanges:[]};
  assert.ok((await runMonteCarloNode(p,{concurrency:1})).wealthByAge[0]!.propertyEquity.median > 0);
});
test('same cumulative market return in different order changes withdrawal outcomes', () => {
  const p=zero(strippedProfile(p=>{p.assets.isa=100_000;p.personal.endAge=49;}));
  p.portfolios.isa={equities:1,bonds:0,cash:0};
  const make=(rates:number[])=>({pathIndex:0,years:deterministicPath(4,p.market).years.map((y,i)=>({...y,equities:rates[i]!,inflation:0}))});
  const early=runProjection(p,make([-.2,-.2,.2,.2]));
  const late=runProjection(p,make([.2,.2,-.2,-.2]));
  assert.ok(early.metrics.terminalNetWorthReal<late.metrics.terminalNetWorthReal);
});
test('floor/comfort runs and caller edits do not mutate the in-flight profile', async () => {
  const p=small();const saved=structuredClone(p);
  const running=runMonteCarlo(p,{batchSize:1,ledgerOptions:{retirementLevel:'floor'}});
  p.simulation.count=1;p.assets.isa=0;
  const floor=await running;
  const comfort=await runMonteCarlo(saved,{ledgerOptions:{retirementLevel:'comfort'}});
  assert.equal(floor.metadata.simulationCount,12);
  assert.equal(floor.metadata.profile.assets.isa,50_000);
  assert.ok(floor.terminalWealth.median>comfort.terminalWealth.median);
});
