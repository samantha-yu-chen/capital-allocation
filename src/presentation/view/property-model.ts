import type { Profile } from '../../domain/contracts.js';
import { runDeterministicProjection, type LedgerOptions } from '../../engine/ledger.js';
import { leverage, mortgageYear, purchaseTax, type Property } from '../../engine/property.js';
import type { PropertyComparison } from '../../engine/property-comparison.js';
import { money, percent } from './format.js';

export function defaultProperty(profile:Profile):Property {return {
  use:'owner_occupied',marketValue:300000,mortgageBalance:240000,mortgageAnnualRate:.05,
  mortgageTermYears:25,mortgageType:'repayment',maintenanceAnnual:1500,insuranceAnnual:300,serviceChargeAnnual:0,
  councilTaxAnnual:1800,rentAnnual:18000,occupancyRate:.95,managementRate:.1,
  purchase:{age:profile.personal.currentAge,price:300000,deposit:60000,transactionCosts:2000},sale:null,rateChanges:[],
  taxLocation:profile.personal.taxRegion==='scotland'?'scotland':'england_ni',buyerStatus:'standard',acquisitionCostBasis:300000,purchaseTaxOverride:0,
};}
export function toggleProperty(profile:Profile,enabled:boolean):Profile{return {...profile,property:enabled?defaultProperty(profile):null};}
export function togglePurchase(profile:Profile,enabled:boolean):Profile {
  if(!profile.property)return profile;
  return {...profile,property:{...profile.property,purchase:enabled?{age:profile.personal.currentAge,price:profile.property.marketValue,
    deposit:Math.max(0,profile.property.marketValue-profile.property.mortgageBalance),transactionCosts:2000}:null}};
}
export function toggleSale(profile:Profile,enabled:boolean):Profile {
  if(!profile.property)return profile;
  return {...profile,property:{...profile.property,sale:enabled?{age:Math.min(profile.personal.endAge-1,(profile.property.purchase?.age??profile.personal.currentAge)+10),sellingCostRate:.02}:null}};
}
export function addRefinance(profile:Profile):Profile {
  if(!profile.property)return profile;
  return {...profile,property:{...profile.property,rateChanges:[...profile.property.rateChanges,
    {age:(profile.property.rateChanges.at(-1)?.age??profile.property.purchase?.age??profile.personal.currentAge)+5,annualRate:.07}]}};
}
export function computeProperty(profile:Profile,options:Partial<LedgerOptions>={}) {
  const p=profile.property;if(!p)return null;
  const projection=runDeterministicProjection(profile,options);
  const age=p.purchase?.age??profile.personal.currentAge;
  const first=projection.years.find(y=>y.age===age)!;
  const value=p.purchase?.price??p.marketValue,debt=p.purchase?p.purchase.price-p.purchase.deposit:p.mortgageBalance;
  const mortgage=mortgageYear(debt,first.mortgageRate,p.mortgageTermYears,p.mortgageType);
  const firstIndex=first.inflationIndex;
  const annual=first.mortgageInterest+first.mortgagePrincipalRequired;
  const coverageNumerator=p.use==='rental'?first.rentalIncome-first.propertyOperatingCosts
    :first.employmentIncome+first.otherIncome+first.statePensionIncome-first.personalCashReduction-first.totalTax-first.spendingRequired-first.propertyOperatingCosts;
  let equityPeak = value-debt, maximumEquityDrawdown = 0;
  for (const year of projection.years) {
    if (year.age < age || (p.sale && year.age >= p.sale.age)) continue;
    const equity = (year.closing.propertyValue-year.closing.mortgageDebt)/year.closingInflationIndex;
    equityPeak = Math.max(equityPeak,equity);
    if (equityPeak > 0) maximumEquityDrawdown = Math.max(maximumEquityDrawdown,(equityPeak-equity)/equityPeak);
  }
  return {projection,first,maximumEquityDrawdown:first.propertyPurchaseShortfall>0?null:maximumEquityDrawdown,initial:leverage(value,debt,profile.market.property.meanNominal),monthlyPayment:mortgage.monthlyPayment,
    purchaseTax:purchaseTax(p,profile.personal.taxRegion),purchaseFunding:(first.propertyPurchaseFunding/firstIndex),
    debtServiceCoverage:annual>0?coverageNumerator/annual:null,
    housingCashOutflow:(first.propertyOperatingCosts+annual)/firstIndex,
    housingEconomicCost:(first.propertyOperatingCosts+first.mortgageInterest)/firstIndex,
    netRentalCashFlow:(first.rentalIncome-first.propertyOperatingCosts-annual)/firstIndex,
    downside:[-.1,-.2,-.3].map(change=>({change,...leverage(value,debt,change)})),
    rates:[.03,.05,.07,.09].map(rate=>{
      const scenario={...profile,property:{...p,mortgageAnnualRate:rate,rateChanges:[]}};
      const result=runDeterministicProjection(scenario,options),year=result.years.find(y=>y.age===age)!;
      return {rate,payment:(year.mortgageInterest+year.mortgagePrincipalRequired)/year.inflationIndex,
        terminal:result.metrics.terminalNetWorthReal,success:result.success,firstFailureAge:result.metrics.firstFailureAge};
    }),
    rows:projection.years.map(y=>({age:y.age,value:y.closing.propertyValue/y.closingInflationIndex,
      debt:y.closing.mortgageDebt/y.closingInflationIndex,equity:(y.closing.propertyValue-y.closing.mortgageDebt)/y.closingInflationIndex,
      rent:y.rentalIncome/y.inflationIndex,interest:y.mortgageInterest/y.inflationIndex,principal:y.mortgagePrincipal/y.inflationIndex,
      costs:y.propertyOperatingCosts/y.inflationIndex,transaction:y.propertyTransactionCashFlow/y.inflationIndex,
      taxRelief:y.rentalFinanceRelief/y.inflationIndex,shortfall:y.shortfall/y.inflationIndex})),
  };
}
export function comparisonRows(result:PropertyComparison){
  const a=result.buy,b=result.rent;
  return [
    {label:'FIRE success',buy:percent(a.successProbability,2),rent:percent(b.successProbability,2)},
    ...(['mean','median','p10','p90'] as const).map(k=>({label:`Terminal net worth — ${k}`,buy:money(a.terminal[k]),rent:money(b.terminal[k])})),
    {label:'Median terminal liquid capital',buy:money(a.liquid.median),rent:money(b.liquid.median)},
    {label:'P10 lifetime minimum liquid capital',buy:money(a.minimumLiquidity.p10),rent:money(b.minimumLiquidity.p10)},
    {label:'P90 maximum net-worth drawdown',buy:percent(a.maximumDrawdown.p90,1),rent:percent(b.maximumDrawdown.p90,1)},
    {label:'P90 maximum mortgage debt',buy:money(a.maximumDebt.p90),rent:money(b.maximumDebt.p90)},
    {label:'Mortgage shortfall probability',buy:percent(a.mortgageFailureProbability,2),rent:percent(b.mortgageFailureProbability,2)},
  ];
}
