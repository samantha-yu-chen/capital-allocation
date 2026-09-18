/**
 * UX-7: one story for the two success numbers.
 *
 * The wording tests pin the two things that make the story honest — the withdrawal rate and the path
 * count are the reader's own, and the arbitration clause is in both variants. The audit test is the
 * part that keeps working after this package: it fails when a screen shows the reference FIRE number
 * without rendering the shared component, including a screen nobody has written yet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createExampleProfile } from '../src/domain/fixtures.js';
import {
  AUTHORITY_CLAUSE, REFERENCE_FIRE_SURFACES, twoNumbersStory, twoNumbersStoryFor,
} from '../src/presentation/view/two-numbers.js';

const WEB = 'src/presentation/web';

test('the two-numbers story quotes the reader’s own withdrawal rate, not a hard-coded 4%', () => {
  const story = twoNumbersStory({ withdrawalRate: 0.035, pathCount: 2_500 });
  assert.match(story.landmark.sentence, /÷ 3\.50%/);
  assert.ok(!story.landmark.sentence.includes('4%'), 'the default rate must not leak into a 3.5% plan');
  assert.ok(!story.caveat.includes('4.00%'));
  assert.match(story.caveat, /^3\.50% arithmetic/);
  // The path count is the reader's too, grouped the way every other count on screen is.
  assert.match(story.verdict.sentence, /2,500 times/);
  assert.match(story.caveat, /2,500 simulated futures/);

  const other = twoNumbersStory({ withdrawalRate: 0.0425, pathCount: 10_000 });
  assert.match(other.landmark.sentence, /÷ 4\.25%/);
  assert.match(other.verdict.sentence, /10,000 times/);
});

test('both variants of the story say which number the target is judged against', () => {
  const story = twoNumbersStory({ withdrawalRate: 0.04, pathCount: 10_000 });
  assert.equal(story.authority, 'success-probability');
  // The full story and the one-line caveat make the same arbitration, so a surface with room for
  // only the short form still tells the reader which figure decides.
  assert.ok(story.verdict.sentence.includes(AUTHORITY_CLAUSE));
  assert.ok(story.caveat.includes(AUTHORITY_CLAUSE));
  // The landmark is named as a landmark and never as a result.
  assert.match(story.landmark.sentence, /simple arithmetic/);
  assert.match(story.caveat, /not the safety result/);
  assert.ok(!story.landmark.sentence.includes(AUTHORITY_CLAUSE));
  assert.deepEqual([...story.glossary], ['withdrawal-rate', 'success-probability']);
});

test('the story reads the rate and the count off the profile, and refuses nonsense', () => {
  const profile = createExampleProfile();
  const story = twoNumbersStoryFor(profile);
  assert.ok(story.landmark.sentence.includes(`÷ ${(profile.simulation.referenceWithdrawalRate * 100).toFixed(2)}%`));
  assert.ok(story.verdict.sentence.includes(`${profile.simulation.count.toLocaleString('en-GB')} times`));

  assert.throws(() => twoNumbersStory({ withdrawalRate: 0, pathCount: 10 }), RangeError);
  assert.throws(() => twoNumbersStory({ withdrawalRate: Number.NaN, pathCount: 10 }), RangeError);
  assert.throws(() => twoNumbersStory({ withdrawalRate: 1, pathCount: 10 }), RangeError);
  assert.throws(() => twoNumbersStory({ withdrawalRate: 0.04, pathCount: 0 }), RangeError);
  assert.throws(() => twoNumbersStory({ withdrawalRate: 0.04, pathCount: 1.5 }), RangeError);
});

test('every screen showing the reference FIRE number renders the shared explanation', () => {
  // What counts as a surface: a screen that renders the engine's reference figure, or that prints
  // its name for the reader. Detection is on the source rather than on a hand-kept list, so a new
  // screen cannot join the app without joining this audit.
  const showsReference = readdirSync(WEB)
    .filter(name => name.endsWith('.tsx'))
    .map(name => ({ file: `${WEB}/${name}`, source: readFileSync(join(WEB, name), 'utf8') }))
    .filter(entry => entry.source.includes('referenceFireNumber') || entry.source.includes('Reference FIRE'));

  assert.deepEqual(
    showsReference.map(entry => entry.file).sort(),
    REFERENCE_FIRE_SURFACES.map(surface => surface.file).sort(),
    'a screen showing the reference FIRE number must be listed in REFERENCE_FIRE_SURFACES',
  );
  assert.equal(REFERENCE_FIRE_SURFACES.length, 5);

  for (const entry of showsReference) {
    assert.ok(entry.source.includes('<TwoNumbers'), `${entry.file} shows the reference number without the shared explanation`);
    assert.ok(
      entry.source.includes("from './two-numbers.js'"),
      `${entry.file} must render the one shared component, not its own copy of the wording`,
    );
  }
});

test('the surface registry describes screens that exist and label the figure as it says', () => {
  const ids = REFERENCE_FIRE_SURFACES.map(surface => surface.id);
  assert.deepEqual(ids, [...new Set(ids)], 'surface ids identify a screen, so they are unique');
  for (const surface of REFERENCE_FIRE_SURFACES) {
    const source = readFileSync(surface.file, 'utf8');
    assert.ok(source.includes(surface.label), `${surface.file} no longer calls the figure “${surface.label}”`);
  }
});
