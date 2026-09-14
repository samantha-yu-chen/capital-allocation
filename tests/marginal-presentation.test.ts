import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultLedgerOptions } from '../src/engine/ledger.js';
import { compareMarginal } from '../src/engine/marginal.js';
import { marginalPlan, marginalRows, marginalConclusion } from '../src/presentation/view/marginal-model.js';
import { MARGINAL_AMOUNT_FIELD, MARGINAL_DEBT_FIELD } from '../src/presentation/view/fields.js';
import { stableStringify } from '../src/presentation/view/run-key.js';

test('marginal controls reject invalid drafts and announce full path work without changing count',()=>{
  const p=createExampleProfile(),options=defaultLedgerOptions();
  const valid=marginalPlan(p,options,{},'gross_earnings');assert.match(valid.announcement,/70,000/);assert.equal(valid.request.amount,1000);
  for(const text of ['','abc','-1','Infinity'])assert.ok(marginalPlan(p,options,{[MARGINAL_AMOUNT_FIELD.id]:text},'gross_earnings').issues.length);
  assert.ok(marginalPlan(p,options,{[MARGINAL_DEBT_FIELD.id]:'-1'},'gross_earnings').issues.length);
  assert.notEqual(stableStringify(valid.request),stableStringify(marginalPlan(p,options,{},'after_tax_cash').request));
  assert.equal(p.simulation.count,10000);
});
test('six rows preserve infeasible reasons, uncertainty, target ages and constrained no-recommendation',async()=>{
  const p=createExampleProfile();p.simulation.count=8;
  const r=await compareMarginal(p,{amount:1000,basis:'gross_earnings',maximumDebt:0});
  const rows=marginalRows(r);assert.equal(rows.length,6);assert.match(marginalConclusion(r),/No destination/);
  assert.ok(rows.filter(row=>!row.reason).every(row=>row.probability.includes('±')&&row.delta.includes('±')&&row.targets.length===3));
  assert.match(rows.find(row=>row.destination==='mortgage')!.reason!,/existing/);
});
