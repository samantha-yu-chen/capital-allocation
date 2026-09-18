import test from 'node:test';
import assert from 'node:assert/strict';
import { profileSchema } from '../src/domain/contracts.js';
import { createStarterProfile } from '../src/presentation/view/starter-profile.js';
import { choiceFieldsFor, fieldsFor } from '../src/presentation/view/fields.js';
import { defaultLedgerOptions } from '../src/engine/index.js';
import { runKey } from '../src/presentation/view/run-key.js';
import {
  WIZARD_FIELD_IDS, WIZARD_STEPS, wizardResult, wizardStepIssues, wizardTierCoverage,
} from '../src/presentation/view/wizard-model.js';
import { plainIssues, issueFields } from '../src/presentation/view/messages.js';
import { validateDrafts } from '../src/presentation/view/fields.js';

test('the wizard covers every essential field and adds only requested common fields', () => {
  const profile = createStarterProfile();
  const entries = [...fieldsFor(profile), ...choiceFieldsFor(profile)];
  assert.deepEqual(wizardTierCoverage(entries), { unsupported: [], missingEssential: [] });
  assert.equal(new Set(WIZARD_FIELD_IDS).size, WIZARD_FIELD_IDS.length, 'a field appears in only one step');
  assert.deepEqual(
    entries.filter(entry => entry.tier === 'common' && WIZARD_FIELD_IDS.includes(entry.id)).map(entry => entry.id).sort(),
    ['assets.gia.marketValue', 'income.bonusAnnual', 'spending.currentRentMonthlyIncluded'],
  );
});

test('a profile changed only through wizard fields still passes the one profile schema', () => {
  const profile = createStarterProfile();
  const edited = structuredClone(profile);
  edited.personal.currentAge = 35;
  edited.personal.targetFireAge = 52;
  edited.personal.taxRegion = 'rest_of_uk';
  edited.income.salaryAnnual = 72_000;
  edited.income.bonusAnnual = 3_000;
  edited.spending.current.essentialMonthly = 1_400;
  edited.spending.current.discretionaryMonthly = 300;
  edited.spending.retirement.essentialMonthly = 1_400;
  edited.spending.retirement.discretionaryMonthly = 300;
  edited.spending.currentRentMonthlyIncluded = 800;
  edited.assets.cash = 18_000;
  edited.assets.isa = 65_000;
  edited.assets.pension = 42_000;
  edited.assets.gia.marketValue = 12_000;
  edited.pension.employeeRate = 0.06;
  edited.pension.employerRate = 0.05;
  assert.deepEqual(profileSchema.parse(edited), edited);
});

test('the age error belongs to About you and keeps the plain message', () => {
  const profile = createStarterProfile();
  const validation = validateDrafts(profile, { 'personal.targetFireAge': '20' });
  assert.equal(validation.ok, false);
  const readable = plainIssues(validation.issues, issueFields(profile));
  const issues = wizardStepIssues('about', readable);
  assert.ok(issues.length > 0);
  assert.ok(issues.some(issue => /three ages have to run in order/i.test(issue.message)));
  assert.deepEqual(wizardStepIssues('income', readable), []);
});

test('step 5 is the existing deterministic projection and exact FIRE run key', () => {
  const profile = createStarterProfile();
  const options = defaultLedgerOptions();
  const result = wizardResult(profile, options);
  assert.equal(result.referenceFireNumber, 565_714.2857142857);
  assert.equal(result.investableAssetsAtFire, 755_016.7645730472);
  assert.equal(result.pathCount, 10_000);
  assert.equal(result.runKey, runKey(profile, options));
  assert.equal(WIZARD_STEPS.at(-1)?.fieldIds.length, 0, 'the result step cannot invent an input');
});
