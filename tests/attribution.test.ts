import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultLedgerOptions, runDeterministicProjection, runProjection } from '../src/engine/ledger.js';
import { deterministicPath } from '../src/engine/returns.js';
import { STRESSES, stressPath, runStress } from '../src/engine/stress.js';
import { analysisCellKey, assertSensitivityPaths, buildAnalysisCases, runAttribution } from '../src/engine/attribution.js';
import { runMonteCarlo } from '../src/engine/monte-carlo/simulation.js';
import { ParametricReturnGenerator } from '../src/engine/monte-carlo/generator.js';
import { ACCOUNTS, close, totalAccounts } from './ledger-helpers.js';
const home = () => ({ use:'owner_occupied' as const, marketValue:300000,mortgageBalance:240000,mortgageAnnualRate:.05,mortgageTermYears:25,mortgageType:'repayment' as const,maintenanceAnnual:1500,insuranceAnnual:300,serviceChargeAnnual:200,councilTaxAnnual:1800,rentAnnual:0,occupancyRate:1,managementRate:0,purchase:null,sale:null,rateChanges:[] });

test('all seven shocks land only in their specified annual intervals', () => {
 const p=createExampleProfile(); const base=deterministicPath(64,p.market);
 for(const id of STRESSES){
  const path=stressPath(p,id,35); const duration=id==='crash_2000_style'||id==='mortgage_shock'?3:id==='high_inflation'||id==='lost_decade'?10:1;
  path.years.forEach((y,i)=>{if(i<4||i>=4+duration)assert.deepEqual(y,base.years[i]);else assert.notDeepEqual(y,base.years[i]);});
 }
 assert.equal(stressPath(p,'crash_2008_style',35).years[4]!.equities,-.4);
 assert.throws(()=>stressPath(p,'job_loss',95),/within/);
});
test('stress job loss changes income and contributions once and preserves fixed spending',()=>{
 const p=createExampleProfile();const base=runDeterministicProjection(p);const r=runStress(p,'job_loss',33).projection;
 r.years.forEach((y,i)=>{assert.equal(y.salaryNominal,i===2?0:base.years[i]!.salaryNominal);assert.equal(y.spendingRequired,base.years[i]!.spendingRequired);});
 assert.equal(r.years[2]!.pensionContributionTotal,0); assert.equal(r.years[3]!.pensionContributionTotal,base.years[3]!.pensionContributionTotal);
});
test('bridge funding failure survives a later return and locked pension cannot fund stress',()=>{
 const p=createExampleProfile();p.personal.targetFireAge=p.personal.currentAge;p.assets.cash=0;p.assets.isa=20000;p.assets.gia.marketValue=0;p.assets.gia.costBasis=0;p.assets.pension=1e6;
 const path=stressPath(p,'crash_2008_style',31);const years=path.years.map((y,i)=>i===1?{...y,equities:5}:y);
 const r=runProjection(p,{...path,years});assert.equal(r.success,false);assert.ok(r.failures.some(f=>f.code==='pre_pension_liquidity'));assert.ok(r.years.some(y=>y.lockedWealth>100000));
});
test('mortgage and property shocks affect actual debt service and equity with full reconciliation',()=>{
 const p=createExampleProfile();p.property=home();p.assets.cash=200000;const base=runDeterministicProjection(p);
 const mortgage=runStress(p,'mortgage_shock',33).projection;const crash=runStress(p,'property_crash',33).projection;
 assert.ok(mortgage.years[2]!.mortgageInterest>base.years[2]!.mortgageInterest);
 assert.equal(mortgage.years[5]!.mortgageRate,.05);
 close(crash.years[2]!.closing.propertyValue,crash.years[2]!.opening.propertyValue*.7);
 for(const r of [mortgage,crash])for(const y of r.years){
  for(const a of ACCOUNTS)close(y.closing.accounts[a],y.opening.accounts[a]+y.contributions[a]-y.withdrawalsGross[a]+y.investmentReturn[a],1e-5);
  const flows=y.employmentIncome+y.otherIncome+y.statePensionIncome+y.rentalIncome+y.pensionContributionTotal-y.personalCashReduction-y.totalTax-y.spendingFunded-y.capitalNeedsFunded-y.propertyOperatingCostsFunded-y.mortgageInterestFunded-y.mortgagePrincipal+y.propertyTransactionCashFlow;
  close(totalAccounts(y.closing.accounts),totalAccounts(y.opening.accounts)+flows+totalAccounts(y.investmentReturn),1e-5);
  const economic=y.employmentIncome+y.otherIncome+y.statePensionIncome+y.rentalIncome+y.pensionContributionTotal-y.personalCashReduction-y.totalTax-y.spendingFunded-y.capitalNeedsFunded-y.propertyOperatingCostsFunded-y.mortgageInterest-y.propertyAcquisitionCosts-y.propertySaleCosts;
  close(y.netWorth,totalAccounts(y.opening.accounts)+y.opening.propertyValue-y.opening.mortgageDebt+economic+totalAccounts(y.investmentReturn)+y.propertyAppreciation,1e-5);
 }
});
test('withdrawal tax sensitivity is paid in the funding solver and reconciles',()=>{
 const p=createExampleProfile();p.personal.currentAge=60;p.personal.targetFireAge=60;p.personal.endAge=65;p.assets.cash=0;p.assets.isa=0;p.assets.gia.marketValue=0;p.assets.gia.costBasis=0;p.assets.pension=500000;
 const a=runDeterministicProjection(p),b=runDeterministicProjection(p,{pensionWithdrawalSurtaxRate:.1});
 assert.ok(b.years[0]!.withdrawalsGross.pension>a.years[0]!.withdrawalsGross.pension);
 for(const y of b.years){close(y.pensionWithdrawalSurtax,y.pensionWithdrawalTaxable*.1);close(y.totalTax,y.incomeTax+y.employeeNi+y.capitalGainsTax);for(const k of ACCOUNTS)close(y.closing.accounts[k],y.opening.accounts[k]+y.contributions[k]-y.withdrawalsGross[k]+y.investmentReturn[k],1e-5);}
});
test('every sensitivity axis varies in the declared direction without altering seed/count',()=>{
 const p=createExampleProfile();p.property=home(); const cases=buildAnalysisCases(p);const get=(id:string)=>cases.find(c=>c.id===id)!;
 for(const [id,read] of [
  ['equity-return',(c:typeof cases[number])=>c.profile.market.equities.meanNominal],['equity-volatility',c=>c.profile.market.equities.volatility],['inflation',c=>c.profile.market.inflation.mean],['salary-growth',c=>c.profile.income.salaryGrowthReal],['fire-age',c=>c.profile.personal.targetFireAge],['mortgage-rate',c=>c.profile.property!.mortgageAnnualRate],['property-growth',c=>c.profile.market.property.meanNominal],['spending',c=>c.options.monthlyHouseholdOverride!],
 ] as [string,(c:typeof cases[number])=>number][]){assert.ok(read(get(id+'-low'))<read(get(id+'-high')),id);}
 assert.equal(get('pension-tax-0.05').options.pensionWithdrawalSurtaxRate,.05);assert.equal(get('pension-tax-0.1').options.pensionWithdrawalSurtaxRate,.1);
 for(const c of cases){assert.equal(c.profile.simulation.count,10000);assert.equal(c.profile.simulation.seed,p.simulation.seed);assert.equal(c.options.rentInvestment,null);assert.equal(c.options.marginalAction,null);}
});
test('moment sensitivity preserves the same underlying Gaussian shocks',()=>{
 const p=createExampleProfile();const candidate=structuredClone(p);candidate.market.equities.meanNominal+=.02;
 const generator=new ParametricReturnGenerator();const args={years:4,seed:p.simulation.seed,pathIndex:17};
 const a=generator.generatePath({...args,assumptions:p.market}),b=generator.generatePath({...args,assumptions:candidate.market});
 const normal=(r:number,m:number,v:number)=>{const sigma=Math.sqrt(Math.log1p((v/(1+m))**2));return (Math.log1p(r)-Math.log1p(m)+sigma*sigma/2)/sigma;};
 a.years.forEach((y,i)=>{close(normal(y.equities,.07,.16),normal(b.years[i]!.equities,.09,.16));assert.equal(y.bonds,b.years[i]!.bonds);});
 candidate.simulation.seed++;assert.throws(()=>assertSensitivityPaths(p,candidate));
});
test('full analysis replays direct Monte Carlo exactly; cache keys cover every option and full profile',async()=>{
 const p=createExampleProfile();p.simulation.count=6;const cache=new Map();const r=await runAttribution(p,{stressAge:45},{cache});
 for(const c of r.cells){if(c.result){assert.deepEqual(c.result,await runMonteCarlo(c.profile,{ledgerOptions:c.options}));assert.equal(c.result.metadata.simulationCount,6);}}
 const replay=await runAttribution(p,{stressAge:45},{cache,evaluate:async()=>{throw Error('cache miss');}});assert.ok(replay.cells.filter(c=>c.result).every(c=>c.fromCache));
 const o=defaultLedgerOptions(),key=analysisCellKey(p,o);
 for(const k of Object.keys(o) as (keyof typeof o)[]){assert.notEqual(analysisCellKey(p,{...o,[k]:o[k]===null?{}:typeof o[k]==='number'?Number(o[k])+1:typeof o[k]==='boolean'?!o[k]:'changed'}),key,k);}
 const changed=structuredClone(p);changed.market.equities.volatility+=.01;assert.notEqual(analysisCellKey(changed,o),key);
 assert.ok(key.includes('generatorVersion')&&key.includes('simulationVersion')&&key.includes('taxConfigVersion')&&key.includes('engineVersion'));
});
test('cancellation after real progress publishes no result or cache entries',async()=>{
 const p=createExampleProfile();p.simulation.count=12;const controller=new AbortController(),cache=new Map();let progress=false;
 await assert.rejects(runAttribution(p,{stressAge:45},{cache,signal:controller.signal,evaluate:(p,c)=>runMonteCarlo(p,{...c,batchSize:2}),onProgress:r=>{if(r.paths.completed>0){progress=true;controller.abort();}}}),{name:'AbortError'});
 assert.ok(progress);assert.equal(cache.size,0);
});
