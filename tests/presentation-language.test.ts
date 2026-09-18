/**
 * UX-3: the plain-language layer.
 *
 * Three things are held down here. Every input a non-specialist is expected to fill in has an
 * explanation in ordinary words. The glossary resolves in both directions, so no term is pointed at
 * without a definition and no definition sits where nobody reaches it. And `profileSchema` produces
 * exactly the issues it produced before — the rewritten sentences are a presentation map laid over
 * the schema's own output, never a change to the schema.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { profileSchema } from '../src/domain/contracts.js';
import {
  choiceFieldsFor, fieldName, fieldsFor, validateCandidate, validateDrafts, writePath,
  type ChoiceFieldDef, type NumberFieldDef,
} from '../src/presentation/view/fields.js';
import {
  GLOSSARY, SCREEN_TERMS, danglingTermIds, glossaryEntry, referencedTermIds, seeAlsoTermIds,
  unreferencedTermIds,
} from '../src/presentation/view/glossary.js';
import { REWRITES, issueFields, plainIssues, plainMessage } from '../src/presentation/view/messages.js';
import { spendingOverrideNote } from '../src/presentation/view/overview-model.js';
import { TABS } from '../src/presentation/view/tabs.js';

const example = createExampleProfile();

/** A property makes the property group's entries exist, so they are covered too. */
const withProperty = (() => {
  const state = validateCandidate(writePath(example, ['property'], {
    use: 'owner_occupied', mortgageType: 'repayment', marketValue: 450_000, mortgageBalance: 220_000,
    mortgageAnnualRate: 0.045, mortgageTermYears: 18, maintenanceAnnual: 2_000, insuranceAnnual: 400,
    serviceChargeAnnual: 0, councilTaxAnnual: 2_100, rentAnnual: 0, occupancyRate: 0, managementRate: 0,
    purchase: null, sale: null, rateChanges: [],
  }), []);
  assert.ok(state.ok, 'the property fixture must parse');
  return state.profile;
})();

const allEntries = (): (NumberFieldDef | ChoiceFieldDef)[] => {
  const byId = new Map<string, NumberFieldDef | ChoiceFieldDef>();
  for (const profile of [example, withProperty]) {
    for (const def of [...fieldsFor(profile), ...choiceFieldsFor(profile)]) byId.set(def.id, def);
  }
  return [...byId.values()];
};

test('every essential and common input is explained in ordinary words', () => {
  const missing = allEntries()
    .filter(def => def.tier !== 'expert')
    .filter(def => def.plainHelp === undefined || def.plainHelp.trim() === '')
    .map(def => def.id);
  assert.deepEqual(missing, [], `these non-expert entries have no plainHelp: ${missing.join(', ')}`);

  // The tier list is what makes that assertion mean something, so pin its size too.
  const tiered = allEntries().filter(def => def.tier !== 'expert');
  assert.ok(tiered.length >= 35, `only ${tiered.length} essential/common entries were checked`);
});

test('a plain label replaces the technical one and keeps the term in parentheses', () => {
  const fire = fieldsFor(example).find(def => def.id === 'personal.targetFireAge');
  assert.ok(fire);
  assert.equal(fieldName(fire), 'Age you want to stop needing a salary (target FIRE age)');
  // An entry with no plain label keeps the short one; nothing is ever blank.
  const salary = fieldsFor(example).find(def => def.id === 'income.salaryAnnual');
  assert.ok(salary);
  assert.equal(fieldName(salary), 'Gross salary');
  for (const def of allEntries()) assert.ok(fieldName(def).length > 0, `${def.id} has no name`);

  // Where a plain label exists it must introduce the technical term once, not drop it.
  const withPlain = allEntries().filter(def => def.plainLabel !== undefined);
  assert.ok(withPlain.length >= 15, `only ${withPlain.length} entries were given a plain label`);
  for (const def of withPlain) assert.notEqual(def.plainLabel, def.label, `${def.id} gained nothing`);
});

test('the glossary resolves in both directions', () => {
  const ids = GLOSSARY.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate glossary id');
  assert.ok(GLOSSARY.length >= 25, `only ${GLOSSARY.length} terms`);
  for (const entry of GLOSSARY) {
    assert.ok(entry.term.trim().length > 0, `${entry.id} has no term`);
    assert.ok(entry.definition.trim().length > 40, `${entry.id}'s definition is too short to be one`);
  }

  const fromRegistry = allEntries().flatMap(def => def.terms ?? []);
  const referenced = referencedTermIds(fromRegistry);
  assert.deepEqual(danglingTermIds(referenced), [], 'a label, help text or screen points at a term that does not exist');
  assert.deepEqual(danglingTermIds(seeAlsoTermIds()), [], 'a glossary cross-reference does not resolve');
  assert.deepEqual(unreferencedTermIds(referenced), [], 'a definition nobody reaches from the app');

  // Every destination names its own result vocabulary; a new tab cannot be added without one.
  for (const tab of TABS) {
    assert.ok(SCREEN_TERMS[tab.id].length > 0, `${tab.id} names no terms`);
    for (const id of SCREEN_TERMS[tab.id]) assert.ok(glossaryEntry(id), `${tab.id} points at ${id}`);
  }
});

/**
 * AC 3: the schema is the untouched authority.
 *
 * The check is the issue list itself — path, code and message — for a set of invalid profiles,
 * pinned here as literals. If a later change edits `profileSchema`'s wording to make a screen read
 * better, this fails, which is the point: the rewrite belongs in the presentation map.
 */
test('profileSchema still produces exactly its own issues', () => {
  const cases: [string, unknown][] = [
    ['floor above target', writePath(example, ['spending', 'retirementFloorAnnual'], 40_000)],
    ['weights', writePath(example, ['portfolios', 'isa', 'cash'], 0.25)],
    ['ages', writePath(example, ['personal', 'targetFireAge'], 30)],
    ['blank', writePath(example, ['personal', 'currentAge'], Number.NaN)],
    ['young', writePath(example, ['personal', 'currentAge'], 12)],
  ];
  const seen = cases.map(([name, candidate]) => {
    const result = profileSchema.safeParse(candidate);
    assert.ok(!result.success, `${name} should not parse`);
    return [name, result.error.issues.map(issue => `${issue.path.map(String).join('.')}|${issue.code}|${issue.message}`)];
  });
  assert.deepEqual(seen, [
    ['floor above target', ['spending|custom|Require floor <= target <= comfort retirement spending']],
    ['weights', ['portfolios.isa|custom|Portfolio weights must sum to 1']],
    ['ages', ['personal|custom|Require currentAge <= targetFireAge < endAge']],
    ['blank', ['personal.currentAge|invalid_type|Invalid input: expected number, received NaN']],
    ['young', ['personal.currentAge|too_small|Too small: expected number to be >=18']],
  ]);
});

test('the five most common invalid states each read as a sentence', () => {
  const fields = issueFields(example);
  const messageFor = (candidate: unknown): string[] => {
    const state = validateCandidate(candidate, fieldsFor(example));
    assert.equal(state.ok, false);
    return plainIssues(state.issues, fields).map(issue => issue.message);
  };

  // 1. floor / target / comfort order
  const floor = messageFor(writePath(example, ['spending', 'retirementFloorAnnual'], 40_000));
  assert.match(floor[0]!, /floor spending should be at most your target/);
  assert.match(floor[0]!, /the least you could live on/);

  // 2. portfolio weights
  const weights = messageFor(writePath(example, ['portfolios', 'isa', 'cash'], 0.25));
  assert.match(weights[0]!, /add up to exactly 100%/);
  // The same rule on a different account reaches the same rewrite via the path pattern.
  assert.deepEqual(messageFor(writePath(example, ['portfolios', 'pension', 'bonds'], 0.9)), weights);

  // 3. ages out of order
  assert.match(messageFor(writePath(example, ['personal', 'targetFireAge'], 30))[0]!,
    /three ages have to run in order/);

  // 4. a blank box, which names the field it belongs to
  const blank = messageFor(writePath(example, ['personal', 'currentAge'], Number.NaN));
  assert.match(blank[0]!, /^Current age needs a number\./);
  assert.match(blank[0]!, /nothing is assumed on your behalf/);

  // 5. breakdown that does not reconcile
  const broken = writePath(example, ['spending', 'breakdown'],
    { sharedMonthly: 100, perAdultMonthly: 0, perChildMonthly: 0 });
  assert.match(messageFor(broken)[0]!, /have to add back up to your current monthly spending/);
});

test('bounds are reported in the units the reader typed, not the stored ones', () => {
  const fields = issueFields(example);
  const only = (drafts: Record<string, string>): string => {
    const state = validateDrafts(example, drafts);
    assert.equal(state.ok, false);
    const messages = plainIssues(state.issues, fields).map(issue => issue.message);
    assert.equal(messages.length, 1, messages.join(' / '));
    return messages[0]!;
  };
  // A rate is stored as a fraction and shown as a percentage; the message must use the percentage.
  assert.equal(only({ 'pension.employeeRate': '140' }), 'Employee contribution cannot be more than 100%.');
  assert.equal(only({ 'assets.cash': '-1' }), 'Cash cannot be negative. Enter 0 if there is none.');
  assert.equal(only({ 'personal.currentAge': '12' }), 'Current age has to be at least 18.');
  assert.equal(only({ 'simulation.count': '1.5' }), 'How many futures to simulate (paths) has to be a whole number.');
  // An empty box is not silently repaired.
  assert.match(only({ 'income.salaryAnnual': '' }), /^Gross salary needs a number\./);
});

test('a rule with no rewrite keeps the schema’s own words rather than a vague sentence', () => {
  const unknown = { fieldId: null, group: null, path: 'nowhere', message: 'Something new the schema now says' };
  assert.equal(plainMessage(unknown), 'Something new the schema now says');
  // And a rewrite is chosen by path as well as message: the same text on another path does not match.
  assert.equal(
    plainMessage({ fieldId: null, group: null, path: 'elsewhere', message: 'Require floor <= target <= comfort retirement spending' }),
    'Require floor <= target <= comfort retirement spending');
  // Every rewrite must actually change the wording it replaces.
  for (const rule of REWRITES) {
    if (typeof rule.plain === 'string' && typeof rule.message === 'string') {
      assert.notEqual(rule.plain, rule.message);
      assert.ok(rule.plain.length > rule.message.length, `${rule.message} was not made plainer`);
    }
  }
});

test('rewriting a message never changes which field or group an issue belongs to', () => {
  const state = validateDrafts(example, { 'personal.currentAge': '', 'portfolios.isa.cash': '25' });
  assert.equal(state.ok, false);
  const rewritten = plainIssues(state.issues, issueFields(example));
  assert.equal(rewritten.length, state.issues.length);
  rewritten.forEach((issue, index) => {
    const original = state.issues[index]!;
    assert.equal(issue.path, original.path);
    assert.equal(issue.fieldId, original.fieldId);
    assert.equal(issue.group, original.group);
    assert.notEqual(issue.message, original.message, `${issue.path} was left in schema words`);
  });
});

test('a spending override says so, and silence means the entered schedule', () => {
  assert.equal(spendingOverrideNote(null), null);
  assert.equal(spendingOverrideNote(undefined), null);
  const note = spendingOverrideNote(500);
  assert.ok(note);
  assert.match(note, /not the amounts entered above/);
  assert.match(note, /£500 a month/);
  assert.match(note, /FIRE & Monte Carlo screen/);
  // Essentials first is why a £500 override can show £6,000 essential and nothing discretionary.
  assert.match(note, /Essentials are covered first/);
});
