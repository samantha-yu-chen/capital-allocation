import { runMonteCarlo } from '../src/engine/monte-carlo/simulation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultProperty,computeProperty,comparisonRows,toggleProperty,togglePurchase,toggleSale,addRefinance } from '../src/presentation/view/property-model.js';
import { fieldsFor,validateDrafts } from '../src/presentation/view/fields.js';
import { comparePropertyPlans,rentAndInvestProfile } from '../src/engine/property-comparison.js';
import { runDeterministicProjection } from '../src/engine/ledger.js';
import { close } from './ledger-helpers.js';

test('property inputs use the field registry, prune optional transactions and reject invalid drafts',()=>{
  let p=toggleProperty(createExampleProfile(),true);
  p=toggleSale(addRefinance(p),true);
  const fields=fieldsFor(p);
  for(const key of ['property.purchase.deposit','property.sale.age','property.rateChanges.0.annualRate'])assert.ok(fields.some(f=>f.id===key));
  assert.equal(validateDrafts(p,{'property.purchase.deposit':'500000'}).ok,false);
  assert.equal(validateDrafts(p,{'property.mortgageAnnualRate':'abc'}).ok,false);
  p=togglePurchase(p,false);assert.ok(!fieldsFor(p).some(f=>f.id==='property.purchase.deposit'));
});
test('property view uses real ledger numbers and all four full-plan mortgage scenarios',()=>{
  const p=createExampleProfile();p.property=defaultProperty(p);p.assets.cash=100000;
  const m=computeProperty(p)!;
  close(m.initial.equity,60000);close(m.initial.ltv!,.8);close(m.purchaseFunding,66600);
  assert.deepEqual(m.rates.map(r=>r.rate),[.03,.05,.07,.09]);
  assert.ok(m.rates[0]!.payment<m.rates[3]!.payment);
  const falling=structuredClone(p);falling.market.property.meanNominal=-.1;
  assert.ok(computeProperty(falling)!.maximumEquityDrawdown!>0);
  close(m.housingCashOutflow-m.housingEconomicCost,m.first.mortgagePrincipalRequired);
  const y=m.projection.years[10]!;close(m.rows[10]!.equity,(y.closing.propertyValue-y.closing.mortgageDebt)/y.closingInflationIndex);
});
test('paired rent/buy plans retain matching inputs, include deposit opportunity cost and replay exactly',async()=>{
  const p=createExampleProfile();p.personal.endAge=47;p.property=defaultProperty(p);p.assets.cash=100000;p.simulation.count=4;
  const copy=structuredClone(p),rent=rentAndInvestProfile(p);
  assert.deepEqual(rent.assets,p.assets);assert.deepEqual(rent.market,p.market);
  const a=await comparePropertyPlans(p),b=await comparePropertyPlans(p);
  assert.deepEqual(a,b);assert.deepEqual(p,copy);assert.equal(a.metadata.count,4);
  const ordinary=await runMonteCarlo(p);
  close(a.buy.successProbability,ordinary.successProbability);
  assert.deepEqual(a.buy.terminal,ordinary.terminalWealth);
  close(a.buy.maximumDebt.p90,240000);
  assert.ok(a.buy.maximumDebt.p90>0);close(a.rent.maximumDebt.p90,0);
  assert.ok(comparisonRows(a).some(r=>r.label==='FIRE success'));
  const base=runDeterministicProjection(rent,{rentInvestment:{age:31,amount:66600}}).years[0]!;
  assert.ok(base.allocatedToIsa+base.allocatedToGia>66600);
});
test('paired comparison reports progress, cancels without partial results, and rejects existing ownership',async()=>{
  const p=createExampleProfile();p.property=defaultProperty(p);p.simulation.count=100;
  const c=new AbortController();let progress=0;
  await assert.rejects(comparePropertyPlans(p,{signal:c.signal,onProgress:v=>{progress=v.completed;c.abort();}}),{name:'AbortError'});
  assert.equal(progress,50);
  p.property.purchase=null;await assert.rejects(comparePropertyPlans(p),/planned purchase/);
});
