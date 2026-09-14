import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { parseProfile, type Profile } from '../src/domain/contracts.js';
import { runDeterministicProjection, runProjection } from '../src/engine/ledger.js';
import { mortgageYear, purchaseTax, leverage, type Property } from '../src/engine/property.js';
import { runMonteCarlo } from '../src/engine/monte-carlo/simulation.js';
import { deterministicPath } from '../src/engine/returns.js';
import { close, ACCOUNTS, totalAccounts } from './ledger-helpers.js';

export function home(): Property { return { use:'owner_occupied', marketValue:300000,mortgageBalance:240000,
  mortgageAnnualRate:.05,mortgageTermYears:25,mortgageType:'repayment',maintenanceAnnual:1500,insuranceAnnual:300,
  serviceChargeAnnual:200,councilTaxAnnual:1800,rentAnnual:18000,occupancyRate:.9,managementRate:.1,
  purchase:null,sale:null,rateChanges:[] }; }
function fixture(): Profile {
  const p=createExampleProfile();p.property=home();p.assets.cash=200000;
  p.market.inflation.mean=0; p.market.inflation.volatility=0;
  return p;
}
test('mortgage golden: monthly repayment, zero rate, interest-only balloon and refinance',()=>{
  const y=mortgageYear(240000,.05,25,'repayment');
  close(y.monthlyPayment,1403.016099619,1e-6);
  close(y.closingDebt,235051.423552,1e-5);
  close(y.interest,11887.616747,1e-5);
  let debt=240000;
  for(let i=0;i<25;i++)debt=mortgageYear(debt,.05,25-i,'repayment').closingDebt;
  close(debt,0,1e-7);
  close(mortgageYear(240000,0,25,'repayment').principal,9600,1e-7);
  close(mortgageYear(240000,.05,25,'interest_only').interest,12000,1e-7);
  close(mortgageYear(240000,.05,1,'interest_only').payment,252000,1e-7);
  close(mortgageYear(240000,.05,0,'interest_only').payment,252000,1e-7);
  assert.ok(mortgageYear(y.closingDebt,.09,24,'repayment').payment>y.payment);
});
test('scenario B: £300k / £60k, 5% appreciation is £15k and 25%; -10% is -50%',()=>{
  const up=leverage(300000,240000,.05),down=leverage(300000,240000,-.1);
  close(up.appreciation,15000);close(up.equityReturn!,.25);close(down.equityReturn!,-.5);
  const p=fixture();p.market.property.meanNominal=.05;
  close(runDeterministicProjection(p).years[0]!.propertyAppreciation,15000);
});
test('purchase taxes distinguish location, buyer relief, supplements and manual amount',()=>{
  const p=home();p.purchase={age:31,price:300000,deposit:60000,transactionCosts:2000};
  close(purchaseTax(p,'scotland'),4600);close(purchaseTax(p,'rest_of_uk'),5000);
  p.buyerStatus='first_time';close(purchaseTax(p,'scotland'),4000);close(purchaseTax(p,'rest_of_uk'),0);
  p.buyerStatus='additional';close(purchaseTax(p,'scotland'),28600);close(purchaseTax(p,'rest_of_uk'),20000);
  p.taxLocation='manual';p.purchaseTaxOverride=1234;close(purchaseTax(p,'scotland'),1234);
});
test('purchase funding and sale reconcile every account and full net worth without principal consumption',()=>{
  const p=fixture();p.property!.purchase={age:32,price:300000,deposit:60000,transactionCosts:2000};
  p.property!.sale={age:40,sellingCostRate:.02};
  const r=runDeterministicProjection(p);
  close(r.years[0]!.closing.propertyValue,0);
  close(r.years[1]!.propertyPurchaseFunding,66600);
  for(const y of r.years){
    for(const a of ACCOUNTS)close(y.closing.accounts[a],y.opening.accounts[a]+y.contributions[a]-y.withdrawalsGross[a]+y.investmentReturn[a],1e-6);
    const flows=y.employmentIncome+y.otherIncome+y.statePensionIncome+y.rentalIncome+y.pensionContributionTotal-y.personalCashReduction-y.totalTax-y.spendingFunded-y.capitalNeedsFunded-y.propertyOperatingCostsFunded-y.mortgageInterestFunded-y.mortgagePrincipal+y.propertyTransactionCashFlow;
    close(totalAccounts(y.closing.accounts),totalAccounts(y.opening.accounts)+flows+totalAccounts(y.investmentReturn),1e-6);
    const openingWorth=totalAccounts(y.opening.accounts)+y.opening.propertyValue-y.opening.mortgageDebt;
    const economic=y.employmentIncome+y.otherIncome+y.statePensionIncome+y.rentalIncome+y.pensionContributionTotal-y.personalCashReduction-y.totalTax-y.spendingFunded-y.capitalNeedsFunded-y.propertyOperatingCostsFunded-y.mortgageInterest-y.propertyAcquisitionCosts-y.propertySaleCosts;
    close(y.netWorth,openingWorth+economic+totalAccounts(y.investmentReturn)+y.propertyAppreciation,1e-6);
  }
  const sold=r.years.find(y=>y.age===40)!;assert.ok(sold.propertyTransactionCashFlow>0);close(sold.closing.propertyValue,0);close(sold.closing.mortgageDebt,0);
});
test('housing rent removed once through current, retirement, phases and sale; rental keeps personal rent',()=>{
  const p=fixture();p.spending.currentRentMonthlyIncluded=700;p.property!.sale={age:50,sellingCostRate:0};
  p.spending.phases=[{startAge:35,endAge:37,essentialMonthly:1000,discretionaryMonthly:500}];
  const plain=structuredClone(p);plain.property=null;
  const a=runDeterministicProjection(p),b=runDeterministicProjection(plain);
  a.years.forEach((y,i)=>close(b.years[i]!.spendingRequired-y.spendingRequired,y.age<50?8400:0,1e-7));
  p.property!.use='rental';p.property!.sale=null;
  close(runDeterministicProjection(p).years[0]!.rentRemoved,0);
});
test('unfunded purchase is atomic and fails without inventing a house or spending deposit',()=>{
  const p=fixture();p.assets.cash=0;p.assets.isa=0;p.assets.gia.marketValue=0;p.assets.gia.costBasis=0;
  p.property!.purchase={age:31,price:300000,deposit:60000,transactionCosts:2000};
  const r=runDeterministicProjection(p);assert.equal(r.success,false);assert.ok(r.metrics.totalShortfallNominal>0);
  assert.ok(r.years.every(y=>y.closing.propertyValue===0&&y.closing.mortgageDebt===0&&y.propertyPurchaseFunding===0));
});
test('unpaid mortgage interest remains debt; equity cannot silently fund the bridge',()=>{
  const p=fixture();p.personal.targetFireAge=p.personal.currentAge;p.assets.cash=0;p.assets.isa=0;p.assets.gia.marketValue=0;
  p.property!.mortgageType='interest_only';p.assets.pension=800000;
  const y=runDeterministicProjection(p).years[0]!;
  assert.ok(y.failures.some(f=>f.code==='mortgage_shortfall'));assert.ok(y.failures.some(f=>f.code==='pre_pension_liquidity'));
  close(y.closing.mortgageDebt,252000);close(y.mortgagePrincipal,0);
});
test('rental occupancy and costs enter joint tax, with restricted finance relief and carried losses',()=>{
  const p=fixture();p.property!.use='rental';p.property!.mortgageType='interest_only';
  const y=runDeterministicProjection(p).years[0]!;
  close(y.rentalIncome,16200);close(y.propertyOperatingCosts,5420);close(y.rentalTaxableProfit,10780);
  close(y.rentalFinanceRelief,2156);close(y.rentalFinanceCostCarry,1220);
  p.property!.rentAnnual=1000;
  const loss=runDeterministicProjection(p).years[0]!;assert.ok(loss.rentalLossCarry>0);close(loss.rentalTaxableProfit,0);close(loss.rentalFinanceRelief,0);
});
test('rental sale uses historical nominal basis and shared annual CGT exemption',()=>{
  const p=fixture();p.property!.use='rental';p.property!.acquisitionCostBasis=200000;p.property!.sale={age:32,sellingCostRate:.02};
  const y=runDeterministicProjection(p).years[1]!;
  close(y.propertyRealisedGain,y.opening.propertyValue*.98-200000,1e-6);assert.ok(y.capitalGainsTax>0);
});
test('property changes FIRE success on zero-volatility stochastic paths and reproduces deterministic ledger',async()=>{
  const p=fixture();p.personal.targetFireAge=31;p.personal.endAge=40;p.assets.cash=100000;p.assets.isa=0;p.assets.gia.marketValue=0;
  p.spending.currentRentMonthlyIncluded=1400;p.property!.mortgageBalance=0;
  p.property!.maintenanceAnnual=0;p.property!.insuranceAnnual=0;p.property!.serviceChargeAnnual=0;p.property!.councilTaxAnnual=0;
  for(const key of ['equities','bonds','cash','property'] as const){p.market[key].volatility=0;p.market[key].meanNominal=0;}
  p.simulation.count=4;
  const no=structuredClone(p);no.property=null;
  assert.equal((await runMonteCarlo(p)).successProbability,1);assert.equal((await runMonteCarlo(no)).successProbability,0);
  assert.deepEqual(runProjection(p,deterministicPath(9,p.market)).years,runDeterministicProjection(p).years);
});
test('property timeline, historical basis and negative rates are validated',()=>{
  const p=fixture();p.property!.mortgageAnnualRate=-.01;assert.throws(()=>parseProfile(p));
  p.property!.mortgageAnnualRate=.05;p.property!.use='rental';p.property!.sale={age:40,sellingCostRate:0};assert.throws(()=>parseProfile(p));
});

test('refinance is applied at the configured boundary using remaining term',()=>{
  const p=fixture();p.property!.rateChanges=[{age:33,annualRate:.09}];
  const y=runDeterministicProjection(p).years[2]!;
  close(y.mortgageRate,.09);close(y.mortgageInterest,mortgageYear(y.opening.mortgageDebt,.09,23,'repayment').interest);
});
test('negative equity sale retains any unfunded residual debt and records mortgage stress',()=>{
  const p=fixture();p.assets.cash=0;p.assets.isa=0;p.assets.gia.marketValue=0;p.personal.targetFireAge=31;
  p.property!.marketValue=100000;p.property!.sale={age:32,sellingCostRate:.02};
  const y=runDeterministicProjection(p).years[1]!;
  close(y.closing.propertyValue,0);assert.ok(y.closing.mortgageDebt>0);assert.ok(y.failures.some(f=>f.code==='mortgage_shortfall'));
});

test('a GIA-funded purchase grosses up disposal tax and consumes the deposit only once',()=>{
  const p=fixture();p.personal.targetFireAge=31;p.personal.endAge=32;p.assets.cash=0;p.assets.isa=0;
  p.assets.gia.marketValue=100000;p.assets.gia.costBasis=0;p.gia.dividendYield=0;p.gia.turnoverRate=0;
  p.property!.purchase={age:31,price:60000,deposit:60000,transactionCosts:0};
  p.property!.maintenanceAnnual=0;p.property!.insuranceAnnual=0;p.property!.councilTaxAnnual=0;p.property!.serviceChargeAnnual=0;
  p.spending.retirement.essentialMonthly=0;p.spending.retirement.discretionaryMonthly=0;p.spending.retirementFloorAnnual=0;
  p.market.cash.meanNominal=0;
  const y=runDeterministicProjection(p).years[0]!;
  // £3k exemption, £37,700 basic band at 18%, remainder at 24%; solve W - CGT(W) = £60k.
  const disposal=(60000-3000*.24-37700*(.24-.18))/.76;
  close(y.giaDisposalProceeds,disposal,1e-6);close(y.propertyPurchaseFunding,60000);
  close(y.capitalGainsTax,disposal-60000,1e-6);close(y.closing.mortgageDebt,0);
  close(y.opening.accounts.gia-y.closing.accounts.gia+y.investmentReturn.gia,disposal,1e-6);
});


test('property operating costs and scheduled debt service enter emergency reserve and liquidity coverage',()=>{
  const p=fixture();p.spending.currentRentMonthlyIncluded=700;
  const y=runDeterministicProjection(p).years[0]!;
  const essentials=y.spendingEssentialRequired+y.propertyOperatingCosts+y.mortgageInterest+y.mortgagePrincipalRequired;
  close(y.emergencyReserveTarget,essentials*p.liquidity.emergencyFundMonths/12);
  close(y.liquidityCoverageYears,y.accessibleWealth/essentials);
});
