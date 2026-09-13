import { parseProfile, type Profile } from './contracts.js';

/** Spec section 79. Additional choices are explicit example assumptions, not forecasts. */
export function createExampleProfile(): Profile {
  return parseProfile({
    schemaVersion: '1',
    personal: { currentAge: 31, targetFireAge: 45, endAge: 95, taxRegion: 'scotland', taxYear: '2026/27', targetSuccessProbability: 0.9 },
    income: { salaryAnnual: 55_000, bonusAnnual: 0, otherNonSavingsAnnual: 0, salaryGrowthReal: 0.03,
      retirementEmploymentAnnual: 0, statePensionAnnual: 0, statePensionAge: 68 },
    household: { adults: 1, children: 0 },
    spending: { current: { essentialMonthly: 1300, discretionaryMonthly: 350 },
      retirement: { essentialMonthly: 1300, discretionaryMonthly: 350 }, retirementFloorAnnual: 15_600,
      retirementComfortAnnual: 24_000, currentRentMonthlyIncluded: 0, breakdown: null, phases: [], lifestyleCreepRate: 0,
      scenarioMonthly: { low: 1300, base: 1650, high: 2000 } },
    assets: { cash: 10_000, isa: 50_000, gia: { marketValue: 15_000, costBasis: 15_000, carriedLosses: 0 },
      pension: 25_000, sipp: 0, pensionTaxFreeCashUsed: 0 },
    pension: { method: 'salary_sacrifice', employeeRate: 0.05, employerRate: 0.05, matchUpToRate: 0,
      matchRate: 0, employerNiSharebackRate: 0, salarySacrificeAvailable: true, sacrificeAddedBackForTaper: true,
      accessAge: 57, moneyPurchaseAnnualAllowanceTriggered: false, carryForwardAllowance: 0 },
    isa: { allowanceUsed: 0 }, gia: { dividendYield: 0.02, turnoverRate: 0, gainRealisationRate: 0 },
    liquidity: { emergencyFundMonths: 6, minimumLiquidYears: 2, capitalNeeds: [] },
    portfolios: { isa: { equities: 0.85, bonds: 0.1, cash: 0.05 }, gia: { equities: 0.85, bonds: 0.1, cash: 0.05 },
      pension: { equities: 0.85, bonds: 0.1, cash: 0.05 } },
    market: { assumptionVersion: 'example-v1', equities: { meanNominal: 0.07, volatility: 0.16 },
      bonds: { meanNominal: 0.03, volatility: 0.06 }, cash: { meanNominal: 0.025, volatility: 0 },
      property: { meanNominal: 0.035, volatility: 0.1 }, inflation: { mean: 0.025, volatility: 0 },
      correlation: [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]] },
    simulation: { count: 10_000, seed: 421337, referenceWithdrawalRate: 0.035,
      taxPolicy: 'constant_real', withdrawalOrder: ['cash', 'gia', 'isa', 'pension'] },
    property: null,
  });
}
