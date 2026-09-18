/**
 * UX-2: value provenance and reset.
 *
 * The claims under test are the ones a reader relies on: an untouched profile shows no "edited"
 * marker anywhere, the marker follows the stored value rather than the text on screen, a reset
 * restores exactly the starter's value, and a reset is an edit like any other — the schema judges
 * it, and it never tidies away someone else's error.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { defaultLedgerOptions } from '../src/engine/index.js';
import {
  applyDrafts, choiceFieldsFor, fieldVisibility, fieldsFor, toDisplay, validateCandidate,
  validateDrafts, writePath,
} from '../src/presentation/view/fields.js';
import {
  draftsClearedBy, editedEntries, fieldProvenance, provenance, provenanceSummary,
  resetToStarter, resettableInGroup,
} from '../src/presentation/view/provenance.js';
import { createStarterProfile } from '../src/presentation/view/starter-profile.js';
import { runKey } from '../src/presentation/view/run-key.js';

const starter = createStarterProfile();
const defs = fieldsFor(starter);
const defFor = (id: string) => {
  const found = defs.find(def => def.id === id);
  assert.ok(found, `missing field ${id}`);
  return found;
};

/** AC 4: the engines' fixture and the UI's default must be one profile, not two that resemble each other. */
test('the starter profile is byte-identical to the specification’s example profile', () => {
  assert.equal(JSON.stringify(createStarterProfile()), JSON.stringify(createExampleProfile()));
  // And it is a fresh object each time, so a reset cannot be poisoned by an earlier edit.
  const first = createStarterProfile();
  first.income.salaryAnnual = 1;
  assert.equal(createStarterProfile().income.salaryAnnual, 55_000);
  // The run key is the engines' identity for a profile; a starter that drifted would change it.
  assert.equal(runKey(createStarterProfile(), defaultLedgerOptions()), runKey(createExampleProfile(), defaultLedgerOptions()));
});

test('an untouched profile is entirely default, and every registry entry is described', () => {
  const map = provenance(starter, starter);
  const ids = [...fieldsFor(starter).map(def => def.id), ...choiceFieldsFor(starter).map(def => def.id)];
  assert.equal(map.size, ids.length);
  for (const id of ids) assert.equal(map.get(id), 'default', `${id} is not default on an untouched profile`);
  assert.match(provenanceSummary(fieldProvenance(starter, starter)), /^Every one of these \d+ values is still the starter/);
});

test('provenance follows scalar, array-backed and percent values', () => {
  // Scalar money.
  const salary = writePath(starter, ['income', 'salaryAnnual'], 61_000);
  assert.equal(provenance(salary, starter).get('income.salaryAnnual'), 'edited');
  assert.equal(provenance(salary, starter).get('income.bonusAnnual'), 'default');

  // Percent: stored as a fraction, shown ×100.
  const growth = writePath(starter, ['income', 'salaryGrowthReal'], 0.04);
  assert.equal(provenance(growth, starter).get('income.salaryGrowthReal'), 'edited');

  // Array-backed: a correlation cell, and the matrix that owns it.
  const correlated = writePath(
    writePath(starter, ['market', 'correlation', 0, 1], 0.2), ['market', 'correlation', 1, 0], 0.2);
  const correlatedState = provenance(correlated, starter);
  assert.equal(correlatedState.get('market.correlation.0.1'), 'edited');
  assert.equal(correlatedState.get('market.correlation'), 'edited', 'the editor that owns the cell is edited too');
  assert.equal(correlatedState.get('market.correlation.2.3'), 'default');

  // A row the starter does not have is the reader's own, and has no default to go back to.
  const phased = writePath(starter, ['spending', 'phases'],
    [{ startAge: 45, endAge: 55, essentialMonthly: 1400, discretionaryMonthly: 400 }]);
  const phasedEntries = fieldProvenance(phased, starter);
  assert.equal(phasedEntries.get('spending.phases')?.state, 'edited');
  assert.equal(phasedEntries.get('spending.phases')?.resettable, true, 'the list itself resets to the empty list');
  const row = phasedEntries.get('spending.phases.0.startAge');
  assert.ok(row, 'the added row must be described');
  assert.equal(row.state, 'edited');
  assert.equal(row.resettable, false, 'a row the starter never had has no default value');
  assert.equal(row.defaultDisplay, null);
  assert.match(row.note, /nothing to reset it to/);
});

/** AC 1: display rounding must not decide provenance. */
test('provenance compares stored values, not the strings on screen', () => {
  const equities = defFor('market.equities.meanNominal');
  const noisy = writePath(starter, ['market', 'equities', 'meanNominal'], 0.070000000000001);
  // The two values are indistinguishable on screen …
  assert.equal(toDisplay(equities, 0.070000000000001), toDisplay(equities, 0.07));
  // … and still report as an edit, because the engine would see a different number.
  assert.equal(provenance(noisy, starter).get('market.equities.meanNominal'), 'edited');

  // The reverse: typing the value that is already there must not manufacture an edit.
  const retyped = validateDrafts(starter, { 'portfolios.isa.equities': '85', 'income.salaryGrowthReal': '3' });
  assert.ok(retyped.ok, 'retyping the displayed values must stay valid');
  const state = provenance(retyped.profile, starter);
  assert.equal(state.get('portfolios.isa.equities'), 'default');
  assert.equal(state.get('income.salaryGrowthReal'), 'default');
});

test('choice controls report provenance and read their default in words', () => {
  const entries = fieldProvenance(starter, starter);
  assert.equal(entries.get('personal.taxRegion')?.defaultDisplay, 'Scotland');
  assert.equal(entries.get('pension.salarySacrificeAvailable')?.defaultDisplay, 'on');
  assert.equal(entries.get('spending.phases')?.defaultDisplay, 'nothing set');
  assert.equal(entries.get('property')?.defaultDisplay, 'off');

  const rest = writePath(starter, ['personal', 'taxRegion'], 'rest_of_uk');
  const changed = fieldProvenance(rest, starter).get('personal.taxRegion');
  assert.ok(changed);
  assert.equal(changed.state, 'edited');
  assert.match(changed.note, /The starter profile’s value is Scotland\./);
  assert.equal(changed.resetLabel, 'Reset Tax region to the default Scotland');

  // A derived default says where it came from, so "default" is not mistaken for "arbitrary".
  const retirement = entries.get('spending.retirement.essentialMonthly');
  assert.ok(retirement);
  assert.match(retirement.note, /the same as current essential spending/);
  assert.equal(defFor('spending.retirement.essentialMonthly').derivedFrom !== undefined, true);
});

/** The derivation notes are claims about the starter; a drifting fixture must fail here. */
test('every recorded derivation is true of the starter profile', () => {
  const s = starter;
  assert.equal(s.spending.retirement.essentialMonthly, s.spending.current.essentialMonthly);
  assert.equal(s.spending.retirement.discretionaryMonthly, s.spending.current.discretionaryMonthly);
  assert.equal(s.spending.retirementFloorAnnual, s.spending.current.essentialMonthly * 12);
  assert.equal(s.spending.retirementComfortAnnual, s.spending.scenarioMonthly.high * 12);
  assert.equal(s.spending.scenarioMonthly.low, s.spending.current.essentialMonthly);
  assert.equal(s.spending.scenarioMonthly.base, s.spending.current.essentialMonthly + s.spending.current.discretionaryMonthly);
  assert.equal(s.assets.gia.costBasis, s.assets.gia.marketValue);
  assert.deepEqual(s.spending.phases, []);
  assert.deepEqual(s.liquidity.capitalNeeds, []);
  assert.equal(s.property, null);
});

/** AC 2's view-model half: a reset restores the starter value exactly and the marker goes back. */
test('resetting restores the starter value and clears the marker', () => {
  const edited = writePath(writePath(starter, ['income', 'salaryAnnual'], 61_000),
    ['pension', 'employeeRate'], 0.12);
  const before = provenance(edited, starter);
  assert.equal(before.get('income.salaryAnnual'), 'edited');
  assert.equal(before.get('pension.employeeRate'), 'edited');

  const restored = resetToStarter(edited, starter, ['income.salaryAnnual']);
  assert.equal(restored.income.salaryAnnual, starter.income.salaryAnnual);
  const after = provenance(restored, starter);
  assert.equal(after.get('income.salaryAnnual'), 'default');
  assert.equal(after.get('pension.employeeRate'), 'edited', 'a reset touches only what it was asked to');

  // Resetting everything reproduces the starter exactly, by the engines' own identity for a profile.
  const all = resetToStarter(edited, starter, [...before.keys()]);
  assert.equal(runKey(all, defaultLedgerOptions()), runKey(starter, defaultLedgerOptions()));
  assert.equal(JSON.stringify(all), JSON.stringify(starter));
});

test('a group reset restores that group and nothing else', () => {
  const edited = writePath(writePath(writePath(starter,
    ['assets', 'cash'], 25_000), ['assets', 'isa'], 60_000), ['income', 'salaryAnnual'], 61_000);
  const entries = fieldProvenance(edited, starter);
  assert.deepEqual(resettableInGroup(entries, 'assets').sort(), ['assets.cash', 'assets.isa']);

  const restored = resetToStarter(edited, starter, resettableInGroup(entries, 'assets'));
  assert.equal(restored.assets.cash, starter.assets.cash);
  assert.equal(restored.assets.isa, starter.assets.isa);
  assert.equal(restored.income.salaryAnnual, 61_000, 'another group must be untouched');
  assert.equal(editedEntries(fieldProvenance(restored, starter)).length, 1);

  // A structural entry resets as a whole: turning a property on and resetting it removes it again.
  const withProperty = validateCandidate(writePath(starter, ['property'], {
    use: 'owner_occupied', mortgageType: 'repayment', marketValue: 450_000, mortgageBalance: 220_000,
    mortgageAnnualRate: 0.045, mortgageTermYears: 18, maintenanceAnnual: 2_000, insuranceAnnual: 400,
    serviceChargeAnnual: 0, councilTaxAnnual: 2_100, rentAnnual: 0, occupancyRate: 0, managementRate: 0,
    purchase: null, sale: null, rateChanges: [],
  }), defs);
  assert.ok(withProperty.ok);
  const propertyEntries = fieldProvenance(withProperty.profile, starter);
  assert.equal(propertyEntries.get('property')?.state, 'edited');
  assert.equal(propertyEntries.get('property.marketValue')?.resettable, false,
    'the starter has no property, so its fields have no default');
  const withoutProperty = resetToStarter(withProperty.profile, starter, resettableInGroup(propertyEntries, 'property'));
  assert.equal(withoutProperty.property, null);
});

/** AC 3: a reset goes through the schema like anything else, and hides nobody else's error. */
test('a reset is validated, and leaves another field’s invalid draft reporting', () => {
  const edited = writePath(starter, ['income', 'salaryAnnual'], 61_000);
  // Someone is mid-way through typing an impossible age while they click reset on the salary.
  const drafts = { 'personal.currentAge': '-4' };
  const broken = validateDrafts(edited, drafts);
  assert.equal(broken.ok, false);

  const restored = resetToStarter(edited, starter, ['income.salaryAnnual']);
  const afterReset = validateDrafts(restored, drafts);
  assert.equal(afterReset.ok, false, 'the reset must not make the profile look valid');
  assert.deepEqual(afterReset.issues.map(issue => issue.fieldId), broken.issues.map(issue => issue.fieldId));
  assert.ok(afterReset.issues.some(issue => issue.fieldId === 'personal.currentAge'));

  // The reset itself did land, and the schema accepts the profile once the bad draft goes.
  const clean = validateCandidate(applyDrafts(restored, {}, fieldsFor(restored)), fieldsFor(restored));
  assert.ok(clean.ok);
  assert.equal(clean.profile.income.salaryAnnual, starter.income.salaryAnnual);

  // A reset that would itself break a cross-field rule is reported, not silently applied elsewhere.
  const floorRaised = writePath(writePath(writePath(starter,
    ['spending', 'retirement', 'essentialMonthly'], 2_000), ['spending', 'retirementFloorAnnual'], 26_000),
    ['spending', 'retirementComfortAnnual'], 30_000);
  assert.ok(validateCandidate(floorRaised, defs).ok, 'the raised retirement spending is a valid starting point');
  const floorReset = resetToStarter(floorRaised, starter, ['spending.retirement.essentialMonthly']);
  const floorState = validateCandidate(floorReset, defs);
  assert.equal(floorState.ok, false, 'floor 26,000 above a restored target must fail validation');
  assert.ok(floorState.issues.some(issue => /floor/i.test(issue.message)));
});

test('a reset clears only the drafts it invalidates, and an error stays unfilterable', () => {
  const draftIds = ['property.marketValue', 'property.mortgageBalance', 'income.salaryAnnual'];
  assert.deepEqual(draftsClearedBy('property', draftIds), ['property.marketValue', 'property.mortgageBalance']);
  assert.deepEqual(draftsClearedBy('income.salaryAnnual', draftIds), ['income.salaryAnnual']);
  assert.deepEqual(draftsClearedBy('income', draftIds), ['income.salaryAnnual']);

  // A reset that introduces an issue in an expert field still shows that field at the shallowest depth.
  const raised = writePath(writePath(writePath(starter,
    ['spending', 'retirement', 'essentialMonthly'], 2_000), ['spending', 'retirementFloorAnnual'], 26_000),
    ['spending', 'retirementComfortAnnual'], 30_000);
  const reset = resetToStarter(raised, starter, ['spending.retirement.essentialMonthly']);
  const state = validateCandidate(reset, defs);
  assert.equal(state.ok, false);
  const visibility = fieldVisibility('essential', defs, choiceFieldsFor(reset), state.issues);
  assert.ok(visibility.showsGroup('spending'), 'the group carrying the new issue must be visible');
});

test('the summary counts what is the reader’s own', () => {
  const edited = writePath(starter, ['income', 'salaryAnnual'], 61_000);
  const summary = provenanceSummary(fieldProvenance(edited, starter));
  assert.match(summary, /^1 of \d+ values is yours/);
  const two = provenanceSummary(fieldProvenance(writePath(edited, ['assets', 'cash'], 1), starter));
  assert.match(two, /^2 of \d+ values are yours/);
});
