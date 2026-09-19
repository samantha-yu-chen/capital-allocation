/**
 * UX-9: starter situations ("people like me").
 *
 * The acceptance criteria are all "prove it rather than trust it", so each is a test:
 *
 * 1. Every situation parses under `profileSchema` and runs the deterministic ledger at its own
 *    target with no failure records.
 * 2. Choosing one never mutates another, and never mutates a library entry — the same independence
 *    pattern `tests/scenario.test.ts` uses for saved scenarios.
 * 3. Provenance compares against the *chosen* starter, not against the worked example.
 * 4. Every card carries the illustration caveat, and the audit derives its surface list from the
 *    sources so a new screen cannot render a card without it.
 *
 * Plus the guard the working agreement demands: a starter is allowed to change your circumstances
 * and nothing else. No seed, path count, market assumption or portfolio weight may differ from the
 * worked example's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseProfile, profileSchema, type Profile } from '../src/domain/contracts.js';
import { createExampleProfile } from '../src/domain/fixtures.js';
import {
  DEFAULT_STARTER_ID, STARTER_SITUATIONS, starterProfile, starterSituation,
} from '../src/domain/starter-situations.js';
import {
  addScenario, createScenario, emptyLibrary, replaceScenario, type ScenarioLibrary,
} from '../src/domain/scenarios.js';
import { defaultLedgerOptions, runDeterministicProjection, type LedgerOptions } from '../src/engine/ledger.js';
import { fieldProvenance } from '../src/presentation/view/provenance.js';
import { createStarterProfile } from '../src/presentation/view/starter-profile.js';
import {
  STARTER_CHOICE_EFFECT, STARTER_ILLUSTRATION_CAVEAT, STARTER_PICKER_SURFACES,
  starterCard, starterCards, starterProvenanceNote,
} from '../src/presentation/view/starter-picker.js';

const WEB = 'src/presentation/web';

const optionsFor = (id: string): LedgerOptions => {
  const situation = starterSituation(id);
  return {
    ...defaultLedgerOptions(),
    retirementLevel: situation.options.retirementLevel,
    monthlyHouseholdOverride: situation.options.monthlyHouseholdOverride,
    fundEmergencyReserve: situation.options.fundEmergencyReserve,
    surplusAllocation: situation.options.surplusAllocation,
  };
};

// ---------------------------------------------------------------------------
// AC 1 — every starter is a real, validated, fundable plan
// ---------------------------------------------------------------------------

test('the library is a curated handful with unique ids and names', () => {
  assert.ok(STARTER_SITUATIONS.length >= 4 && STARTER_SITUATIONS.length <= 6,
    'UX-9 asks for four to six; more than that is a list to scroll, not a set to choose from');
  const ids = STARTER_SITUATIONS.map(s => s.id);
  const names = STARTER_SITUATIONS.map(s => s.name.toLowerCase());
  assert.deepEqual(ids, [...new Set(ids)]);
  assert.deepEqual(names, [...new Set(names)], 'a library refuses duplicate names, so two starters cannot share one');
  assert.ok(ids.includes(DEFAULT_STARTER_ID), 'the situation the app opens with has to be choosable again');
  assert.throws(() => starterSituation('no-such-situation'), RangeError);
  for (const situation of STARTER_SITUATIONS) {
    assert.ok(situation.who.trim().length > 20, `${situation.id} must say who it is for`);
    assert.ok(situation.reasoning.length >= 2, `${situation.id} must record why its figures are what they are`);
  }
});

test('every starter situation parses under the one validation authority', () => {
  for (const situation of STARTER_SITUATIONS) {
    const parsed = profileSchema.parse(situation.build());
    // `starterProfile` must be that same parse, not a second, looser path into the engines.
    assert.deepEqual(starterProfile(situation.id), parsed);
  }
  // The opening default is still byte-identical to the specification's worked example, so the
  // engines' fixture and the UI's default cannot drift apart.
  assert.equal(JSON.stringify(starterProfile(DEFAULT_STARTER_ID)), JSON.stringify(createExampleProfile()));
  assert.equal(JSON.stringify(createStarterProfile()), JSON.stringify(createExampleProfile()));
});

test('every starter funds its own target on the reference path, with no failure records', () => {
  for (const situation of STARTER_SITUATIONS) {
    const profile = starterProfile(situation.id);
    const projection = runDeterministicProjection(profile, optionsFor(situation.id));
    assert.equal(projection.failures.length, 0,
      `${situation.id} fails its own target at age ${projection.failures[0]?.age} (${projection.failures[0]?.code})`);
    assert.equal(projection.success, true, `${situation.id} must succeed at the level it starts on`);
    assert.equal(projection.years.length, profile.personal.endAge - profile.personal.currentAge);
  }
});

test('a starter changes your circumstances, never the model behind them', () => {
  const example = createExampleProfile();
  for (const situation of STARTER_SITUATIONS) {
    const profile = starterProfile(situation.id);
    // The seed, the path count, the withdrawal order and the reference rate are run settings, not
    // circumstances. A starter that moved one would change what a comparison means.
    assert.deepEqual(profile.simulation, example.simulation, `${situation.id} moved a simulation setting`);
    assert.deepEqual(profile.market, example.market, `${situation.id} moved a market assumption`);
    // An age-varying asset mix would be investment advice this model does not give.
    assert.deepEqual(profile.portfolios, example.portfolios, `${situation.id} moved a portfolio weight`);
    assert.equal(profile.personal.taxYear, example.personal.taxYear);
  }
});

test('the set covers the structural choices a reader cannot guess at', () => {
  const profiles = STARTER_SITUATIONS.map(s => starterProfile(s.id));
  const distinct = <T>(pick: (p: Profile) => T): number => new Set(profiles.map(pick)).size;
  assert.ok(distinct(p => p.personal.taxRegion) === 2, 'both tax regions must be reachable from a card');
  assert.ok(distinct(p => p.pension.method) >= 2, 'salary sacrifice is not the only contribution method');
  assert.ok(profiles.some(p => p.pension.employerRate === 0), 'someone with no employer contribution must be covered');
  assert.ok(profiles.some(p => p.property !== null), 'someone who owns their home must be covered');
  assert.ok(profiles.some(p => p.property === null), 'so must someone who does not');
  assert.ok(profiles.some(p => p.household.children > 0), 'a household with children must be covered');
  assert.ok(profiles.some(p => p.spending.currentRentMonthlyIncluded > 0), 'a renter must be covered');
});

// ---------------------------------------------------------------------------
// AC 2 — choosing one cannot reach into anything else
// ---------------------------------------------------------------------------

test('choosing a starter mutates neither another starter nor a saved library entry', () => {
  // Two calls for the same situation are two independent parses.
  const first = starterProfile('renting-late-20s');
  const second = starterProfile('renting-late-20s');
  assert.notEqual(first, second);
  first.income.salaryAnnual = 999_999;
  first.assets.cash = 123;
  assert.equal(second.income.salaryAnnual, starterProfile('renting-late-20s').income.salaryAnnual);
  assert.notEqual(second.income.salaryAnnual, 999_999);

  // A situation cannot leak into its neighbours either, however a caller abuses what it handed back.
  const other = starterProfile('fifties-pension-heavy');
  assert.notEqual(other.income.salaryAnnual, 999_999);

  // The scenario-independence pattern, applied to a library built entirely out of starters.
  let library: ScenarioLibrary = emptyLibrary();
  for (const situation of STARTER_SITUATIONS)
    library = addScenario(library, { name: situation.name, profile: starterProfile(situation.id),
      options: situation.options, origin: `starter:${situation.id}`, note: situation.who });
  assert.equal(library.scenarios.length, STARTER_SITUATIONS.length);

  const before = library.scenarios.map(s => s.profile.income.salaryAnnual);
  const target = library.scenarios[1]!;
  const edited = replaceScenario(library, target.id, {
    profile: parseProfile({ ...target.profile, income: { ...target.profile.income, salaryAnnual: 500_000 } }),
  });
  assert.equal(edited.scenarios[1]!.profile.income.salaryAnnual, 500_000);
  assert.deepEqual(library.scenarios.map(s => s.profile.income.salaryAnnual), before,
    'editing one entry must not reach into the library it came from');
  assert.deepEqual(
    edited.scenarios.filter((_, index) => index !== 1).map(s => s.profile.income.salaryAnnual),
    before.filter((_, index) => index !== 1),
    'editing one entry must not reach into its neighbours');

  // And the source situation is untouched by everything above.
  assert.notEqual(starterProfile(STARTER_SITUATIONS[1]!.id).income.salaryAnnual, 500_000);

  // A scenario built from a starter never adopts the caller's object by reference.
  const held = createScenario({ name: 'Held', profile: first });
  first.assets.isa = 77_777;
  assert.notEqual(held.profile.assets.isa, 77_777);
});

// ---------------------------------------------------------------------------
// AC 3 — provenance measures against the chosen starter
// ---------------------------------------------------------------------------

test('provenance compares against the chosen starter, not against the worked example', () => {
  const chosenId = 'family-40s-mid-mortgage';
  const chosen = starterProfile(chosenId);
  const example = createExampleProfile();
  assert.notEqual(chosen.income.salaryAnnual, example.income.salaryAnnual,
    'this test is only meaningful while the two differ');

  // Immediately after choosing, the form holds the situation's own values and nothing is the
  // reader's. Against the old baseline, most of the same form would read as edited.
  const afterChoosing = fieldProvenance(chosen, chosen);
  assert.equal([...afterChoosing.values()].filter(entry => entry.state === 'edited').length, 0);
  const againstExample = fieldProvenance(chosen, example);
  assert.ok([...againstExample.values()].filter(entry => entry.state === 'edited').length > 5,
    'the chosen starter must not be judged against the profile it replaced');

  // One edit, and it is the only thing the form calls the reader's — described with the chosen
  // starter's own value to go back to.
  const edited = parseProfile({ ...chosen, income: { ...chosen.income, salaryAnnual: 91_000 } });
  const entries = fieldProvenance(edited, chosen);
  const salary = entries.get('income.salaryAnnual')!;
  assert.equal(salary.state, 'edited');
  assert.equal(salary.resettable, true);
  // `toDisplay` is the editable form, so provenance quotes it ungrouped — the same string the box
  // hands back when it is focused.
  assert.equal(salary.defaultDisplay, '£74000');
  assert.ok(salary.note.includes('£74000'));
  assert.ok(!salary.note.includes('£55000'), 'the replaced worked example must not be quoted as the default');
  assert.deepEqual(
    [...entries.values()].filter(entry => entry.state === 'edited').map(entry => entry.id),
    ['income.salaryAnnual'],
  );

  // A starter that adds structure the previous one lacked is described honestly: the property
  // fields belong to this starter, so they are its defaults and are resettable to them.
  assert.equal(entries.get('property.marketValue')?.state, 'default');
  assert.equal(entries.get('property.marketValue')?.defaultDisplay, '£320000');
});

test('the note on the form names which starter “default” currently means', () => {
  const note = starterProvenanceNote('fifties-pension-heavy');
  assert.ok(note.includes(starterSituation('fifties-pension-heavy').name));
  assert.match(note, /measured against it/);
  // The opening default gets its own wording, because "the one you chose" would be untrue.
  const opening = starterProvenanceNote(DEFAULT_STARTER_ID);
  assert.ok(opening.includes(starterSituation(DEFAULT_STARTER_ID).name));
  assert.match(opening, /the app opens with/);
});

// ---------------------------------------------------------------------------
// AC 4 — the caveat, and the audit that keeps it on every card
// ---------------------------------------------------------------------------

test('every card carries the illustration caveat and the figures of its own profile', () => {
  const cards = starterCards();
  assert.equal(cards.length, STARTER_SITUATIONS.length);
  assert.match(STARTER_ILLUSTRATION_CAVEAT, /not advice and not a benchmark/);
  assert.match(STARTER_CHOICE_EFFECT, /runs nothing/);

  for (const card of cards) {
    assert.equal(card.caveat, STARTER_ILLUSTRATION_CAVEAT, `${card.id} must carry the caveat verbatim`);
    assert.ok(card.facts.length >= 8, `${card.id} must identify itself with real figures`);
    assert.deepEqual(card.facts.map(f => f.label), [...new Set(card.facts.map(f => f.label))]);
    for (const fact of card.facts) assert.ok(fact.value.trim().length > 0, `${card.id}.${fact.label} is blank`);
    // Nothing on a card may be presented as a result: no probability, no projected wealth.
    const text = [card.who, ...card.reasoning, ...card.facts.map(f => `${f.label} ${f.value}`)].join(' ');
    assert.ok(!/success probability|probability of success/i.test(text),
      `${card.id} must not put a safety result on a card that ran nothing`);
  }

  // Facts are read off the profile, so they move when the profile does rather than being restated.
  const family = starterCard('family-40s-mid-mortgage');
  const profile = starterProfile('family-40s-mid-mortgage');
  assert.equal(family.facts.find(f => f.label === 'Gross salary')?.value, '£74,000');
  assert.equal(family.facts.find(f => f.label === 'Age now')?.value, String(profile.personal.currentAge));
  assert.match(family.facts.find(f => f.label === 'Property')?.value ?? '', /£320,000 home/);
  assert.equal(family.facts.find(f => f.label === 'Household')?.value, '2 adults, 2 children');
  assert.equal(starterCard('renting-late-20s').facts.find(f => f.label === 'Property')?.value, 'None in the plan');
  assert.equal(starterCard('contractor-no-employer-pension').facts.find(f => f.label === 'Employer pays in')?.value, 'None');
  assert.match(starterCard('contractor-no-employer-pension').facts.find(f => f.label === 'You pay in')?.value ?? '',
    /relief at source/);
});

test('every screen that renders a starter card renders the one component that carries the caveat', () => {
  const sources = readdirSync(WEB)
    .filter(name => name.endsWith('.tsx'))
    .map(name => ({ file: `${WEB}/${name}`, source: readFileSync(join(WEB, name), 'utf8') }));

  // Detection is on the sources, not on a hand-kept list, so a screen that starts building cards
  // has to join this audit or fail it.
  const buildsCards = sources.filter(entry =>
    entry.source.includes('starterCards') || entry.source.includes('starterCard('));
  assert.deepEqual(buildsCards.map(entry => entry.file).sort(), [...STARTER_PICKER_SURFACES].sort(),
    'a screen building starter cards must be listed in STARTER_PICKER_SURFACES');
  for (const entry of buildsCards)
    assert.ok(entry.source.includes('card.caveat'), `${entry.file} renders a card without its caveat`);

  // A screen may quote the caveat on its own (the Overview reset does), but only the constant —
  // never a reworded copy that could soften it while the original stays in the module.
  for (const entry of sources) {
    if (!entry.source.includes('STARTER_ILLUSTRATION_CAVEAT')) continue;
    assert.ok(entry.source.includes('{STARTER_ILLUSTRATION_CAVEAT}') || entry.source.includes('card.caveat'),
      `${entry.file} imports the caveat without rendering it`);
  }
  assert.ok(sources.some(entry => entry.source.includes('{STARTER_ILLUSTRATION_CAVEAT}')),
    'the caveat must also reach a reader who never opens the picker');

  // Every other screen reaches the situations through <StarterPicker>, never by rebuilding a card
  // or naming a situation of its own. Naming one in a screen is how a hard-coded figure gets in.
  const reachesSituations = (source: string): boolean =>
    source.includes('STARTER_SITUATIONS') || source.includes('starterProfile(')
    || source.includes('starterSituation(') || source.includes('chooseStarter')
    || STARTER_SITUATIONS.some(situation => source.includes(`'${situation.id}'`));
  for (const entry of sources) {
    if (STARTER_PICKER_SURFACES.includes(entry.file)) continue;
    if (!reachesSituations(entry.source)) continue;
    assert.ok(entry.source.includes('<StarterPicker'),
      `${entry.file} reaches a starter situation without going through the shared picker`);
  }
});

test('the picker surfaces exist and choosing on one of them runs nothing', () => {
  for (const file of STARTER_PICKER_SURFACES) {
    const source = readFileSync(file, 'utf8');
    assert.ok(source.includes('onChoose'), `${file} must offer the choice it is listed for`);
    // A picker that started a simulation would spend a 10,000-path run on a browsing reader.
    for (const forbidden of ['runner.run(', 'runMonteCarlo', 'onRun'])
      assert.ok(!source.includes(forbidden), `${file} must not run anything when a card is chosen`);
  }
});

// ---------------------------------------------------------------------------
// UX-11 — a card that says where its figures live
// ---------------------------------------------------------------------------

test('only the situation in use turns its facts into links, and it resolves them against the reader’s profile', () => {
  const source = readFileSync(`${WEB}/starter-picker.tsx`, 'utf8');

  // A fact on a card you have not chosen describes a profile you are not holding. Sending the
  // reader to a box with a different number in it would be a lie, so the link is gated on `chosen`.
  assert.ok(source.includes('linkable={chosen}'),
    'every card linking its facts would navigate to values the form does not hold');
  // And it is resolved against the profile the reader has, not against the card, because that is
  // where the jump lands: `props.profile`, threaded in by the screen.
  assert.ok(source.includes('firstFieldTarget(props.profile'),
    'a fact link must resolve against the profile the form holds');
  assert.ok(source.includes('profile: Profile'), 'the picker takes the reader’s profile as a prop');

  // A jump is navigation, not a run — the UX-9 rule, restated for the thing UX-11 added.
  for (const forbidden of ['runner.run(', 'runMonteCarlo', 'onRun'])
    assert.ok(!source.includes(forbidden), `a fact link must not start anything (${forbidden})`);

  // Every screen that renders the picker has to hand it both, or the links silently disappear.
  for (const file of readdirSync(WEB).filter(name => name.endsWith('.tsx'))) {
    const screen = readFileSync(join(WEB, file), 'utf8');
    if (!screen.includes('<StarterPicker')) continue;
    assert.ok(screen.includes('profile={store.base}') || screen.includes('profile={props.store.base}'),
      `${WEB}/${file} renders the picker without the profile its links resolve against`);
    assert.ok(screen.includes('onOpenField'), `${WEB}/${file} renders a picker that cannot navigate`);
  }
});
