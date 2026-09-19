/**
 * UX-11: the way from a figure to the input that produces it.
 *
 * The reader's report was concrete: after choosing the contractor situation there was no way to find
 * the household size, because `household.adults` sat behind the expert filter while the card that
 * advertised it was the entry-level surface. Three things have to stay true for that not to come
 * back, and each is a test here:
 *
 * 1. Every fact on a card, and every "change this next" jump, names registry ids that actually
 *    resolve — for every situation, not only for the one the app opens with. A dangling id is a
 *    button that scrolls to nothing.
 * 2. A jump lands on the screen whose form holds that group, and at a depth that shows it. The two
 *    are separate failures and both are silent, so both are asserted.
 * 3. Raising the reader's chosen depth is announced. Filtering is display-only (UX-1) so raising it
 *    is safe, but it is still their setting and it must never move without a sentence saying so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Profile } from '../src/domain/contracts.js';
import { STARTER_SITUATIONS, starterProfile } from '../src/domain/starter-situations.js';
import { createStarterProfile } from '../src/presentation/view/starter-profile.js';
import {
  DEFAULT_TIER_MODE, FIELD_GROUPS, choiceFieldsFor, fieldVisibility, fieldsFor, isGridField,
  type FieldGroupId, type TierMode,
} from '../src/presentation/view/fields.js';
import { TABS } from '../src/presentation/view/tabs.js';
import {
  GROUP_SCREEN, fieldArrivalNote, fieldTarget, firstFieldTarget, modeShowing, navigableFields,
  nextFocusRequest, raiseModeFor, tierRaiseNote,
} from '../src/presentation/view/field-navigation.js';
import {
  STARTER_FACT_LINK_NOTE, STARTER_NEXT_JUMPS, STARTER_NEXT_PROMPT, jumpDescription, starterCards,
  starterFacts,
} from '../src/presentation/view/starter-picker.js';

const WEB = 'src/presentation/web';
const example = createStarterProfile();
const situationProfiles = (): readonly { id: string; profile: Profile }[] =>
  STARTER_SITUATIONS.map(situation => ({ id: situation.id, profile: starterProfile(situation.id) }));

// ---------------------------------------------------------------------------
// The registry is the only map, and every group has a screen
// ---------------------------------------------------------------------------

test('every registry entry is navigable, and an entry this profile lacks is refused rather than faked', () => {
  const entries = [...fieldsFor(example), ...choiceFieldsFor(example)];
  const targets = navigableFields(example);
  assert.equal(targets.size, entries.length, 'a navigable target for every entry and nothing else');
  for (const entry of entries) {
    const target = targets.get(entry.id);
    assert.ok(target, `${entry.id} has no target`);
    assert.equal(target.group, entry.group);
    assert.equal(target.tier, entry.tier);
    assert.ok(target.name.trim().length > 0, `${entry.id} has no reader-facing name`);
  }
  // The plain name wins over the internal label wherever one exists, like everything else on screen.
  assert.equal(targets.get('personal.targetFireAge')!.name,
    'Age you want to stop needing a salary (target FIRE age)');
  assert.equal(targets.get('household.adults')!.name, 'Adults');

  // The worked example has no property, so its property inputs genuinely do not exist. Null is the
  // answer, not a target that would navigate to a box that is not rendered.
  assert.equal(example.property, null);
  assert.equal(fieldTarget(example, 'property.marketValue'), null);
  assert.equal(fieldTarget(example, 'no.such.field'), null);
  assert.ok(fieldTarget(example, 'property'), 'the switch that adds one is always there');

  // A fact falls through its list rather than breaking on the first id this profile lacks.
  assert.equal(firstFieldTarget(example, ['property.marketValue', 'income.salaryAnnual'])?.id,
    'income.salaryAnnual');
  assert.equal(firstFieldTarget(example, ['nope.one', 'nope.two']), null);
});

test('every field group names the destination whose form renders it', () => {
  const tabIds = new Set(TABS.map(tab => tab.id));
  assert.deepEqual(Object.keys(GROUP_SCREEN).sort(), FIELD_GROUPS.map(group => group.id).sort(),
    'a new group without a screen is a jump that lands nowhere');
  for (const [group, screen] of Object.entries(GROUP_SCREEN)) {
    assert.ok(tabIds.has(screen), `${group} points at ${screen}, which is not a destination`);
  }
  // The Overview form renders every group except the property one; Property & Leverage owns that.
  assert.equal(GROUP_SCREEN.property, 'property');
  assert.equal(GROUP_SCREEN.household, 'overview');
  assert.equal(fieldTarget(example, 'household.adults')!.screen, 'overview');
});

// ---------------------------------------------------------------------------
// The re-tiering, asserted rather than assumed
// ---------------------------------------------------------------------------

test('household size is a common input, so the default depth already shows it', () => {
  const numbers = fieldsFor(example);
  const choices = choiceFieldsFor(example);
  const visible = (mode: TierMode) => fieldVisibility(mode, numbers, choices);
  for (const id of ['household.adults', 'household.children']) {
    assert.equal(fieldTarget(example, id)!.tier, 'common',
      `${id} is advertised on every starter card; hiding it behind the expert filter is the dead end UX-11 fixes`);
    assert.equal(visible(DEFAULT_TIER_MODE).shows(id), true, `${id} is hidden at the depth the form opens on`);
    assert.equal(visible('essential').shows(id), false, 'it is still not one of the essentials');
  }
  assert.equal(visible(DEFAULT_TIER_MODE).showsGroup('household'), true);
  // Re-tiering changes visibility and nothing else: the values, and therefore the plan, are the same.
  assert.equal(example.household.adults, createStarterProfile().household.adults);
  assert.ok(visible(DEFAULT_TIER_MODE).inputCount <= 40,
    'the default view must stay a readable form (UX-1 AC 2)');
  const gridFields = numbers.filter(isGridField).length + choices.filter(def => def.control !== 'editor').length;
  assert.equal(visible('all').inputCount, gridFields, 'Everything still hides nothing');
});

// ---------------------------------------------------------------------------
// Widening the filter: minimal, one-directional, and never silent
// ---------------------------------------------------------------------------

test('a jump widens the reader’s depth by the least that works, and never narrows it', () => {
  assert.equal(modeShowing('essential'), 'essential');
  assert.equal(modeShowing('common'), 'common');
  assert.equal(modeShowing('expert'), 'all');

  assert.equal(raiseModeFor('essential', 'essential'), null, 'already visible: nothing moves');
  assert.equal(raiseModeFor('common', 'essential'), 'common');
  assert.equal(raiseModeFor('expert', 'essential'), 'all');
  assert.equal(raiseModeFor('expert', 'common'), 'all');
  assert.equal(raiseModeFor('common', 'common'), null);
  // A reader looking at everything is not narrowed because the field they asked for is essential.
  assert.equal(raiseModeFor('essential', 'all'), null);
  assert.equal(raiseModeFor('common', 'all'), null);
});

test('moving the filter is announced, and says the plan did not move with it', () => {
  const target = fieldTarget(example, 'household.adults')!;
  const note = tierRaiseNote(target, 'common');
  assert.ok(note.includes(target.name), 'the reader is told which field the depth was raised for');
  assert.ok(note.includes('Essential + common'), 'and what the setting now is, in the words the control uses');
  assert.match(note, /Nothing about your plan changed/);
  assert.match(note, /display setting/);
  assert.ok(!note.includes('£'), 'a notice about a display setting carries no figure');

  const arrival = fieldArrivalNote(target);
  assert.ok(arrival.includes(target.name));
  assert.ok(arrival.includes(target.groupLabel), 'and where to look for it next time');

  // Asking twice is two requests, so a second click on the same fact still moves the form.
  const first = nextFocusRequest(null, 'household.adults');
  const second = nextFocusRequest(first, 'household.adults');
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.notDeepEqual(first, second);
});

// ---------------------------------------------------------------------------
// Every fact and every jump resolves — for every situation, not just the default
// ---------------------------------------------------------------------------

test('every starter fact names the inputs it is read from, and all of them resolve', () => {
  for (const { id, profile } of situationProfiles()) {
    const targets = navigableFields(profile);
    const facts = starterFacts(profile);
    assert.equal(facts.length, 12, `${id} must still identify itself with the same twelve figures`);
    for (const fact of facts) {
      assert.ok(fact.fieldIds.length > 0, `${id}: "${fact.label}" points at no input at all`);
      for (const fieldId of fact.fieldIds) {
        assert.ok(targets.has(fieldId), `${id}: "${fact.label}" points at ${fieldId}, which this profile has no input for`);
      }
    }
  }

  // The arity is honest: a figure made of three inputs says three, and one made of one says one.
  const facts = starterFacts(example);
  const ids = (label: string) => facts.find(fact => fact.label === label)!.fieldIds;
  assert.deepEqual(ids('Gross salary'), ['income.salaryAnnual']);
  assert.deepEqual(ids('Household'), ['household.adults', 'household.children']);
  assert.deepEqual(ids('Cash, ISA and GIA'), ['assets.cash', 'assets.isa', 'assets.gia.marketValue']);
  // Property depends on the shape of the profile, not on its values.
  assert.deepEqual(ids('Property'), ['property'], 'a profile with no property points at the switch that adds one');
  assert.deepEqual(starterFacts(starterProfile('family-40s-mid-mortgage')).find(f => f.label === 'Property')!.fieldIds,
    ['property.marketValue', 'property.mortgageBalance']);

  // Cards are built from the facts, so the ids reach a renderer rather than stopping at the model.
  for (const card of starterCards()) {
    for (const fact of card.facts) assert.ok(Array.isArray(fact.fieldIds), `${card.id}.${fact.label} lost its ids`);
  }
});

test('the “not quite you?” jumps resolve for every situation and need no expert filter', () => {
  assert.ok(STARTER_NEXT_JUMPS.length >= 3 && STARTER_NEXT_JUMPS.length <= 6,
    'a short labelled set, not a second form');
  assert.deepEqual(STARTER_NEXT_JUMPS.map(jump => jump.id),
    [...new Set(STARTER_NEXT_JUMPS.map(jump => jump.id))]);
  assert.match(STARTER_NEXT_PROMPT, /Not quite you\?/);
  assert.ok(!/you should|we recommend|the best/i.test(STARTER_NEXT_PROMPT),
    'the app explains and simulates; it does not advise (plan part D)');
  assert.match(STARTER_FACT_LINK_NOTE, /Nothing runs/);

  const covered = new Set(STARTER_NEXT_JUMPS.flatMap(jump => jump.fieldIds));
  for (const id of ['household.adults', 'income.salaryAnnual', 'personal.targetFireAge'])
    assert.ok(covered.has(id), `${id} is one of the four departures the ticket names`);

  for (const { id, profile } of situationProfiles()) {
    const targets = navigableFields(profile);
    for (const jump of STARTER_NEXT_JUMPS) {
      const landing = firstFieldTarget(profile, jump.fieldIds);
      assert.ok(landing, `${id}: "${jump.label}" resolves to no input`);
      for (const fieldId of jump.fieldIds) {
        const target = targets.get(fieldId);
        assert.ok(target, `${id}: "${jump.label}" points at ${fieldId}, which does not exist`);
        // A departure a reader makes straight after choosing must not be an expert input. If one
        // ever has to be, the honest fix is to re-tier it, not to raise the filter for it silently.
        assert.notEqual(target.tier, 'expert', `${fieldId} is expert, so "${jump.label}" would hide the filter change`);
      }
    }
  }

  assert.equal(jumpDescription('your salary', 1), 'Change your salary on the profile form');
  assert.match(jumpDescription('your spending', 4), /4 inputs/);
});

// ---------------------------------------------------------------------------
// The audit: one surface may move the filter, and it must say so
// ---------------------------------------------------------------------------

test('the form that raises the reader’s depth is the one that announces it', () => {
  const sources = readdirSync(WEB)
    .filter(name => name.endsWith('.tsx'))
    .map(name => ({ file: `${WEB}/${name}`, source: readFileSync(join(WEB, name), 'utf8') }));

  const raisers = sources.filter(entry => entry.source.includes('raiseModeFor'));
  assert.deepEqual(raisers.map(entry => entry.file), [`${WEB}/profile-form.tsx`],
    'only the profile form may move the tier filter; a second one would move it under different rules');
  for (const entry of raisers)
    assert.ok(entry.source.includes('tierRaiseNote'), `${entry.file} raises the filter without saying so`);

  // A screen that navigates must go through the shell, which knows which destination owns the group.
  for (const entry of sources) {
    if (!entry.source.includes('setActive(target.screen)')) continue;
    assert.ok(entry.source.includes('fieldTarget('), `${entry.file} navigates without resolving the target first`);
  }
  // A jump is a jump: no picker surface may start a run to serve one.
  const picker = readFileSync(`${WEB}/starter-picker.tsx`, 'utf8');
  for (const forbidden of ['runner.run(', 'runMonteCarlo', 'onRun'])
    assert.ok(!picker.includes(forbidden), `the picker must not run anything (${forbidden})`);
});

test('a group that is not rendered by a form is left to the screen that renders it', () => {
  // Overview renders every group except property; the two lists together must cover the registry,
  // or an input exists that no jump can reach.
  const overview: readonly FieldGroupId[] = FIELD_GROUPS
    .map(group => group.id).filter(group => GROUP_SCREEN[group] === 'overview');
  const property: readonly FieldGroupId[] = FIELD_GROUPS
    .map(group => group.id).filter(group => GROUP_SCREEN[group] === 'property');
  assert.deepEqual([...overview, ...property].sort(), FIELD_GROUPS.map(group => group.id).sort());

  const overviewSource = readFileSync(`${WEB}/screen-overview.tsx`, 'utf8');
  for (const group of overview) assert.ok(overviewSource.includes(`'${group}'`), `Overview does not render ${group}`);
  const propertySource = readFileSync(`${WEB}/screen-property.tsx`, 'utf8');
  for (const group of property) assert.ok(propertySource.includes(`'${group}'`), `Property does not render ${group}`);
});
