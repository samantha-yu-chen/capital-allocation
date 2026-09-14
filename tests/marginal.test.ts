import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { calculateNetIncome, getTaxConfig, taxInputFromProfile } from '../src/domain/tax/index.js';
import { marginalFunding } from '../src/engine/marginal-funding.js';
import { compareMarginal, assertMarginalPaths, standardError, taxBoundaries } from '../src/engine/marginal.js';
import { runDeterministicProjection } from '../src/engine/ledger.js';
import { runMonteCarlo } from '../src/engine/monte-carlo/simulation.js';
import { usableWealth } from '../src/engine/allocation-metrics.js';
import { openingBalanceSheet } from '../src/engine/accounts.js';
import { ACCOUNTS, close, totalAccounts } from './ledger-helpers.js';
import type { Property } from '../src/engine/property.js';
const config = getTaxConfig('rest_of_uk','2026/27');
function fixture() {
  const p = createExampleProfile(); p.personal.taxRegion = 'rest_of_uk';
  p.pension.employeeRate=0; p.pension.employerRate=0; p.income.salaryAnnual=50000;
  p.simulation.count=12; return p;
}
function home(): Property { return {use:'owner_occupied',marketValue:300000,mortgageBalance:240000,mortgageAnnualRate:.05,
  mortgageTermYears:25,mortgageType:'repayment',maintenanceAnnual:1500,insuranceAnnual:300,serviceChargeAnnual:200,councilTaxAnnual:1800,
  rentAnnual:0,occupancyRate:1,managementRate:0,purchase:null,sale:null,rateChanges:[]}; }

test('gross bonus crosses UK tax and NI boundary: exact two-slice tax, not one marginal rate',()=>{
  const p=fixture();
  const f=marginalFunding({amount:1000,basis:'gross_earnings',destination:'isa'},taxInputFromProfile(p),config);
  // £270 at 20% + £730 at 40%; NI £270 at 8% + £730 at 2%.
  close(f.incomeTax,346);close(f.employeeNi,36.2);close(f.allocation,617.8);
  assert.ok(f.boundaryCrossings.some(b=>b.label==='basic taxable band'));
  assert.ok(f.boundaryCrossings.some(b=>b.label==='NI upper earnings limit'));
});
test('existing cash is already taxed; no NI or employer funding; RAS recycles full claimed relief',()=>{
  const p=fixture();p.income.salaryAnnual=60000;
  const cash=marginalFunding({amount:1000,basis:'after_tax_cash',destination:'isa'},taxInputFromProfile(p),config);
  close(cash.allocation,1000);close(cash.incomeTax,0);close(cash.employeeNi,0);
  const pension=marginalFunding({amount:1000,basis:'after_tax_cash',destination:'pension'},taxInputFromProfile(p),config);
  close(pension.ras,1000/.6);close(pension.providerRelief,1000/3);close(pension.incomeTax,-1000/3);
  close(pension.employerAdded,0);close(pension.employeeNi,0);close(pension.netCashChange,-1000);
});
test('gross sacrifice funds the entire bonus plus exact employer NI shareback and remaining match',()=>{
  const p=fixture();p.pension.employerNiSharebackRate=1;p.pension.matchUpToRate=.05;p.pension.matchRate=1;
  const f=marginalFunding({amount:1000,basis:'gross_earnings',destination:'pension'},taxInputFromProfile(p),config);
  close(f.workplace,1000);close(f.pensionAdded,2150);close(f.employeeNi,0);close(f.incomeTax,0);close(f.netCashChange,0);
});
test('net-pay gross-funded pension pays incremental NI, RAS and sacrifice retain distinct treatment',()=>{
  const p=fixture();p.income.salaryAnnual=60000;p.pension.method='net_pay';
  const f=marginalFunding({amount:1000,basis:'gross_earnings',destination:'pension'},taxInputFromProfile(p),config);
  close(f.employeeNi,20);close(f.workplace,1000-20/.6);close(f.incomeTax,20/.6*.4);close(f.netCashChange,0);
  p.pension.method='relief_at_source';
  const ras=marginalFunding({amount:1000,basis:'gross_earnings',destination:'pension'},taxInputFromProfile(p),config);
  close(ras.pensionAdded,f.pensionAdded);close(ras.providerRelief,ras.pensionAdded*.2);
});
test('pension boundary contribution restores allowance using exact tapered liability',()=>{
  const p=fixture();p.income.salaryAnnual=101000;
  const f=marginalFunding({amount:400,basis:'after_tax_cash',destination:'pension'},taxInputFromProfile(p),config);
  close(f.ras,1000);close(f.incomeTax,-400);close(f.providerRelief,200);close(f.netCashChange,-400);
  assert.ok(f.boundaryCrossings.some(b=>b.label==='Personal allowance taper'));
});
test('member age, earnings, MPAA and annual allowance reject the whole increment rather than cap it',()=>{
  const p=fixture();p.pension.moneyPurchaseAnnualAllowanceTriggered=true;
  assert.throws(()=>marginalFunding({amount:15000,basis:'gross_earnings',destination:'pension'},taxInputFromProfile(p),config),/allowance/);
  p.pension.moneyPurchaseAnnualAllowanceTriggered=false;p.personal.currentAge=75;
  assert.throws(()=>marginalFunding({amount:1000,basis:'after_tax_cash',destination:'pension'},taxInputFromProfile(p),config),/eligibility/);
  p.personal.currentAge=45;p.income.salaryAnnual=0;
  assert.throws(()=>marginalFunding({amount:4000,basis:'after_tax_cash',destination:'pension'},taxInputFromProfile(p),config),/eligibility/);
});
test('ISA capacity and available cash are explicit infeasibility, without overflow',async()=>{
  const p=fixture();p.isa.allowanceUsed=19900;
  const r=await compareMarginal(p,{amount:1000,basis:'after_tax_cash',maximumDebt:0});
  const isa=r.candidates.find(c=>c.destination==='isa')!;assert.equal(isa.status,'infeasible');assert.match(isa.reason!,/ISA/);
  const over=await compareMarginal(p,{amount:10001,basis:'after_tax_cash',maximumDebt:0});
  assert.ok(over.candidates.every(c=>c.status==='infeasible'));
});
test('all candidate accounts and aggregate identities reconcile over the entire horizon',()=>{
  for(const destination of ['pension','isa','gia','cash','mortgage','deposit'] as const) {
    const p=fixture();p.assets.cash=200000;
    if(destination==='mortgage'||destination==='deposit')p.property=home();
    if(destination==='deposit')p.property!.purchase={age:33,price:300000,deposit:60000,transactionCosts:2000};
    const r=runDeterministicProjection(p,{marginalAction:{amount:1000,basis:'after_tax_cash',destination}});
    for(const y of r.years){
      for(const a of ACCOUNTS)close(y.closing.accounts[a],y.opening.accounts[a]+y.contributions[a]-y.withdrawalsGross[a]+y.investmentReturn[a],1e-6);
      const flows=y.employmentIncome+y.otherIncome+y.statePensionIncome+y.rentalIncome+y.pensionContributionTotal-y.personalCashReduction-y.totalTax-y.spendingFunded-y.capitalNeedsFunded-y.propertyOperatingCostsFunded-y.mortgageInterestFunded-y.mortgagePrincipal+y.propertyTransactionCashFlow;
      close(totalAccounts(y.closing.accounts),totalAccounts(y.opening.accounts)+flows+totalAccounts(y.investmentReturn),1e-6);
      const economic=y.employmentIncome+y.otherIncome+y.statePensionIncome+y.rentalIncome+y.pensionContributionTotal-y.personalCashReduction-y.totalTax-y.spendingFunded-y.capitalNeedsFunded-y.propertyOperatingCostsFunded-y.mortgageInterest-y.propertyAcquisitionCosts-y.propertySaleCosts;
      close(y.netWorth,totalAccounts(y.opening.accounts)+y.opening.propertyValue-y.opening.mortgageDebt+economic+totalAccounts(y.investmentReturn)+y.propertyAppreciation,1e-6);
    }
  }
});
test('after-tax transfers create no capital, gross increments occur only once',()=>{
  const p=fixture();const base=runDeterministicProjection(p,{surplusAllocation:'cash_only'});
  const action=runDeterministicProjection(p,{surplusAllocation:'cash_only',marginalAction:{amount:1000,basis:'after_tax_cash',destination:'isa'}});
  const a=action.years[0]!,b=base.years[0]!;
  close(a.contributions.isa-b.contributions.isa,1000);close(a.withdrawalsGross.cash-b.withdrawalsGross.cash,1000);
  const gross=runDeterministicProjection(p,{marginalAction:{amount:1000,basis:'gross_earnings',destination:'cash'}});
  close(gross.years[0]!.employmentIncome-base.years[0]!.employmentIncome,1000);
  assert.ok(gross.years.slice(1).every(y=>y.marginalFunding===null));
});
test('locked pension cannot fund the future bridge while cash can',async()=>{
  const p=fixture();p.personal.currentAge=44;p.personal.targetFireAge=45;p.personal.endAge=58;p.income.salaryAnnual=20000;
  p.assets={cash:13000,isa:0,gia:{marketValue:0,costBasis:0,carriedLosses:0},pension:100000,sipp:0,pensionTaxFreeCashUsed:0};
  p.spending.current={essentialMonthly:100,discretionaryMonthly:0};p.spending.retirement={essentialMonthly:100,discretionaryMonthly:0};
  p.spending.retirementFloorAnnual=1200;p.spending.retirementComfortAnnual=1200;
  p.liquidity.emergencyFundMonths=0;p.liquidity.minimumLiquidYears=0;
  for(const asset of ['equities','bonds','cash','property'] as const){p.market[asset].meanNominal=0;p.market[asset].volatility=0;}
  p.market.inflation.mean=0;p.market.inflation.volatility=0;
  // Working income is saved; allocate nearly all accumulated cash to pension before the bridge.
  p.income.salaryAnnual=2000;p.assets.cash=14000;
  const r=await compareMarginal(p,{amount:2000,basis:'after_tax_cash',maximumDebt:0,ledgerOptions:{surplusAllocation:'cash_only'}});
  const pension=r.candidates.find(c=>c.destination==='pension')!,cash=r.candidates.find(c=>c.destination==='cash')!;
  assert.equal(pension.status,'evaluated');assert.equal(pension.summary!.probability,0);assert.equal(cash.summary!.probability,1);
  assert.ok(pension.summary!.targets[0]!.accessible.median<cash.summary!.targets[0]!.accessible.median);
});
test('common-path full-count replay equals direct Monte Carlo and catches mismatched indices',async()=>{
  const p=fixture(),snapshot=structuredClone(p),request={amount:1000,basis:'gross_earnings' as const,maximumDebt:0};
  const a=await compareMarginal(p,request),b=await compareMarginal(p,request);
  assert.deepEqual(a,b);assert.deepEqual(p,snapshot);assert.equal(a.metadata.simulationCount,12);assert.deepEqual(a.metadata.pathIndices,{start:0,endExclusive:12});
  const direct=await runMonteCarlo(p,{ledgerOptions:{measureAllocation:true,marginalAction:{amount:1000,basis:'gross_earnings',destination:'isa'}}});
  assert.equal(a.candidates.find(c=>c.destination==='isa')!.summary!.probability,direct.successProbability);
  const broken=structuredClone(direct);broken.allocationSamples![0]!.pathIndex=2;
  assert.throws(()=>assertMarginalPaths(direct,broken),/absolute path/);
});
test('real cancellation rejects after progress and publishes no partial ranking',async()=>{
  const p=fixture();p.simulation.count=120;
  const controller=new AbortController();let progressed=false;
  await assert.rejects(compareMarginal(p,{amount:1000,basis:'gross_earnings',maximumDebt:0},{signal:controller.signal,onProgress:p=>{
    if(p.paths.completed>0){progressed=true;controller.abort();}
  }}),{name:'AbortError'});assert.ok(progressed);
});
test('deposit and mortgage candidates change actual debt and interest, with full lifetime results',async()=>{
  const p=fixture();p.assets.cash=200000;p.property=home();
  const base=runDeterministicProjection(p);
  const over=runDeterministicProjection(p,{marginalAction:{amount:10000,basis:'after_tax_cash',destination:'mortgage'}});
  assert.ok(over.years[0]!.mortgageInterest<base.years[0]!.mortgageInterest);
  assert.ok(over.years[0]!.closing.mortgageDebt<base.years[0]!.closing.mortgageDebt);
  const r=await compareMarginal(p,{amount:10000,basis:'after_tax_cash',maximumDebt:240000});
  assert.equal(r.candidates.find(c=>c.destination==='mortgage')!.status,'evaluated');
  assert.equal(r.candidates.find(c=>c.destination==='deposit')!.status,'infeasible');
  p.property.purchase={age:33,price:300000,deposit:60000,transactionCosts:2000};
  const purchaseBase=runDeterministicProjection(p);
  const deposit=runDeterministicProjection(p,{marginalAction:{amount:10000,basis:'after_tax_cash',destination:'deposit'}});
  const y=deposit.years[2]!,b=purchaseBase.years[2]!;
  close(y.propertyPurchaseFunding-b.propertyPurchaseFunding,10000*y.inflationIndex);
  assert.ok(y.closing.mortgageDebt<b.closing.mortgageDebt);
  const buy=await compareMarginal(p,{amount:10000,basis:'after_tax_cash',maximumDebt:240000});
  assert.equal(buy.candidates.find(c=>c.destination==='deposit')!.status,'evaluated');
});
test('taxed usable valuation uses real GIA basis, pension access and remaining lump sum',()=>{
  const p=fixture();p.assets={cash:0,isa:0,gia:{marketValue:100000,costBasis:0,carriedLosses:0},pension:100000,sipp:0,pensionTaxFreeCashUsed:config.pension.lumpSumAllowance};
  const sheet=openingBalanceSheet(p);
  // GIA £97k taxable gains; £37,700 at 18%, balance 24%.
  close(usableWealth(p,sheet,45,1),100000-37700*.18-(97000-37700)*.24);
  const unlocked=usableWealth(p,sheet,57,1);assert.ok(unlocked>100000);assert.ok(unlocked<180000);
  sheet.giaCostBasis=100000;close(usableWealth(p,sheet,45,1),100000);
});
test('thresholds are config-derived and paired sampling errors have independent expected values',()=>{
  const p=fixture();assert.equal(taxBoundaries(p)[0]!.amount,config.nonSavingsBands[0]!.upper);
  close(standardError([1,-1,1,-1]),Math.sqrt(1/3));
  const input=taxInputFromProfile(p);assert.equal(calculateNetIncome(input,config).ni.employee,2994.4);
});

test('rental finance reduction participates in incremental settled income',()=>{
  const p=fixture();p.income.salaryAnnual=0;p.income.otherNonSavingsAnnual=13000;
  const f=marginalFunding({amount:1000,basis:'gross_earnings',destination:'cash'},taxInputFromProfile(p),config,{costs:10000,profit:13000});
  // Basic income tax on the extra £1k is exactly offset by the uncapped finance credit; below NI threshold.
  close(f.incomeTax,0);close(f.employeeNi,0);close(f.allocation,1000);
});
test('rental overpayment reduces eligible finance costs with the actual recast interest',()=>{
  const p=fixture();p.assets.cash=200000;p.property=home();p.property.use='rental';p.property.rentAnnual=20000;
  const r=runDeterministicProjection(p,{marginalAction:{amount:10000,basis:'after_tax_cash',destination:'mortgage'}});
  close(r.years[0]!.rentalFinanceRelief,r.years[0]!.mortgageInterest*.2);
});
test('ranked wealth is constrained and equivalent identical wrappers never become a firm recommendation',async()=>{
  const p=fixture();p.personal.targetSuccessProbability=0;p.liquidity.emergencyFundMonths=0;p.liquidity.minimumLiquidYears=0;
  p.assets.isa=10000000;p.assets.cash=100000;p.isa.allowanceUsed=0;
  p.gia.dividendYield=0;p.gia.turnoverRate=0;
  for(const asset of ['equities','bonds','cash','property'] as const){p.market[asset].meanNominal=0;p.market[asset].volatility=0;}
  p.market.inflation.mean=0;p.market.inflation.volatility=0;
  const r=await compareMarginal(p,{amount:1000,basis:'after_tax_cash',maximumDebt:0});
  const isa=r.candidates.find(c=>c.destination==='isa')!,gia=r.candidates.find(c=>c.destination==='gia')!;
  assert.notEqual(isa.rank,null);assert.equal(isa.rank,gia.rank);assert.equal(isa.classification,'Near equivalent');
});

test('property capacity and emergency reserve reject an increment without silent partial deployment',()=>{
  const p=fixture();p.property=home();p.assets.cash=300000;
  assert.throws(()=>runDeterministicProjection(p,{marginalAction:{amount:250000,basis:'after_tax_cash',destination:'mortgage'}}),/remaining mortgage/);
  p.property.purchase={age:31,price:300000,deposit:60000,transactionCosts:2000};
  assert.throws(()=>runDeterministicProjection(p,{marginalAction:{amount:250000,basis:'after_tax_cash',destination:'deposit'}}),/deposit capacity/);
  p.property=null;p.assets.cash=10000;p.income.salaryAnnual=0;p.personal.targetFireAge=p.personal.currentAge;
  assert.throws(()=>runDeterministicProjection(p,{marginalAction:{amount:9000,basis:'after_tax_cash',destination:'isa'}}),/reserve/);
});


test('zero essential spending yields a finite liquidity margin rather than invalid infinite statistics',async()=>{
  const p=fixture();p.spending.current={essentialMonthly:0,discretionaryMonthly:0};
  p.spending.retirement={essentialMonthly:0,discretionaryMonthly:0};p.spending.retirementFloorAnnual=0;
  p.spending.retirementComfortAnnual=0;p.simulation.count=2;
  const r=await compareMarginal(p,{amount:1000,basis:'gross_earnings',maximumDebt:0});
  assert.ok(Number.isFinite(r.baseline.minimumLiquidityMargin.mean));
  assert.ok(r.candidates.filter(c=>c.summary).every(c=>Number.isFinite(c.summary!.minimumLiquidityMargin.mean)));
});
test('reproducibility metadata snapshots inputs even when caller edits the request during execution',async()=>{
  const p=fixture();p.simulation.count=2;const original=structuredClone(p);
  const request={amount:1000,basis:'gross_earnings' as const,maximumDebt:0};let edited=false;
  const r=await compareMarginal(p,request,{onProgress:()=>{if(!edited){edited=true;request.amount=2000;p.income.salaryAnnual=1;}}});
  assert.equal(r.metadata.request.amount,1000);assert.deepEqual(r.metadata.profile,original);
  assert.ok(r.metadata.generatorVersion);assert.ok(r.metadata.taxConfigVersion);
});


test('voluntary mortgage principal is not a recurring emergency-reserve expense',()=>{
  const p=fixture();p.property=home();p.assets.cash=200000;
  const y=runDeterministicProjection(p,{marginalAction:{amount:10000,basis:'after_tax_cash',destination:'mortgage'}}).years[0]!;
  close(y.mortgageOverpayment,10000);
  const recurring=y.spendingEssentialRequired+y.propertyOperatingCosts+y.mortgageInterest+y.mortgagePrincipalRequired-10000;
  close(y.emergencyReserveTarget,recurring*p.liquidity.emergencyFundMonths/12);
});
