import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultLedgerOptions } from '../src/engine/ledger.js';
import { runAttribution } from '../src/engine/attribution.js';
import { attributionPlan, attributionRows, effect, attributionConclusion, stressRows, attributionDiagnostics } from '../src/presentation/view/attribution-model.js';
import { money, percent, sampledProbability } from '../src/presentation/view/format.js';

test('invalid stress drafts block execution and full-count work is announced',()=>{
 const p=createExampleProfile(),o=defaultLedgerOptions();for(const draft of ['', 'x', '30','95','45.5'])assert.equal(attributionPlan(p,o,draft).valid,false);
 const plan=attributionPlan(p,o,'45');assert.equal(plan.valid,true);assert.match(plan.announcement,/10,000/);assert.match(plan.announcement,/several minutes/);
});
test('every attribution and stress figure traces to retained engine output',async()=>{
 const p=createExampleProfile();p.simulation.count=8;const r=await runAttribution(p,{stressAge:45});
 for(const row of [...attributionRows(r),...attributionRows(r,true)]){
  const cell=r.cells.find(c=>c.id===row.id)!;
  if(!cell.result){assert.equal(row.probability,'Unsupported');assert.ok(row.reason);continue;}
  assert.ok(row.probability.startsWith(percent(cell.result.successProbability,2)));
  assert.equal(row.terminal,money(cell.result.terminalWealth.median));assert.equal(row.downside,money(cell.result.terminalWealth.p10));
  const at=cell.result.wealthByAge.find(y=>y.age===cell.profile.personal.targetFireAge)!;
  assert.equal(row.liquid,money(at.liquid.median));assert.equal(row.pension,money(at.pension.median));assert.equal(row.property,money(at.propertyEquity.median));
  assert.equal(row.bridge,sampledProbability(cell.result.bridgeFailureProbability,cell.result.metadata.simulationCount));
  assert.equal(effect(r.cells[0]!,cell)!.delta,cell.result.successProbability-r.cells[0]!.result!.successProbability);
 }
 for(const row of stressRows(r)){const stress=r.stresses.find(s=>s.id===row.id)!;if(stress.result){assert.equal(row.terminal,money(stress.result.projection.metrics.terminalNetWorthReal));assert.equal(row.failures.length,stress.result.projection.failures.length);}}
 const d=attributionDiagnostics(r);assert.equal(d.failures.length,5);
 const failures=r.cells[0]!.result!.observedFailureProbabilities;
 for(const row of d.failures)assert.equal(row.value,sampledProbability(failures[row.label as keyof typeof failures],p.simulation.count));
});
test('equal or sampling-noisy effects do not become findings',async()=>{
 const p=createExampleProfile();p.simulation.count=4;const r=await runAttribution(p,{stressAge:45});
 for(const c of r.cells)if(c.result)c.result.successProbability=.5;
 assert.match(attributionConclusion(r),/do not establish/);
 assert.ok(attributionRows(r).filter(row=>!row.reason&&row.id!=='baseline').every(row=>row.evidence==='Within sampling uncertainty'));
});
