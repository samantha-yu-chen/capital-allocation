import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { parseProfile, type AccountBalances, type Profile } from '../src/domain/contracts.js';

export const ACCOUNTS = ['cash', 'isa', 'gia', 'pension', 'sipp'] as const satisfies readonly (keyof AccountBalances)[];

/** Mutate a fresh section 79 fixture, then re-validate it so tests cannot smuggle invalid input in. */
export function profileWith(mutate: (profile: Profile) => void): Profile {
  const profile = createExampleProfile();
  mutate(profile);
  return parseProfile(profile);
}

export const close = (actual: number, expected: number, tolerance = 1e-6, label = ''): void =>
  assert.ok(Math.abs(actual - expected) < tolerance,
    `${label} expected ${expected}, got ${actual} (difference ${actual - expected})`);

export const totalAccounts = (balances: AccountBalances): number =>
  ACCOUNTS.reduce((sum, key) => sum + balances[key], 0);

/** Strip every liquid asset and stop all earned income, leaving only what the test sets. */
export function strippedProfile(mutate: (profile: Profile) => void): Profile {
  return profileWith(profile => {
    profile.personal.currentAge = 45;
    profile.personal.targetFireAge = 45;
    profile.income.salaryAnnual = 0;
    profile.income.bonusAnnual = 0;
    profile.income.otherNonSavingsAnnual = 0;
    profile.income.retirementEmploymentAnnual = 0;
    profile.assets.cash = 0;
    profile.assets.isa = 0;
    profile.assets.gia = { marketValue: 0, costBasis: 0, carriedLosses: 0 };
    profile.assets.pension = 0;
    profile.assets.sipp = 0;
    profile.liquidity.emergencyFundMonths = 0;
    mutate(profile);
  });
}
