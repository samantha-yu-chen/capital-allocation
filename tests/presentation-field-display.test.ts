/**
 * UX-8: money and percent inputs that read like money and percent.
 *
 * Two contracts are load-bearing here and both are tested rather than described. The first is that
 * display is display: grouping a figure on blur is a pure function of the text, so it cannot become
 * an edit. The second is the NaN-on-invalid rule from work package 4 — a draft that is not a number
 * must still reach `profileSchema` as NaN, and the new comma tolerance must not turn a typo into a
 * plausible-looking number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { getTaxConfig } from '../src/domain/tax/index.js';
import { calculatePensionRelief, taxInputFromProfile } from '../src/domain/tax/index.js';
import {
  applyDrafts, fieldsFor, fromDisplay, toDisplay, validateDrafts, type ControlFieldDef,
} from '../src/presentation/view/fields.js';
import {
  annualEquivalent, fieldAffix, fieldText, groupedText, isGrouped, spokenUnit, stepDraft,
} from '../src/presentation/view/field-display.js';
import {
  PENSION_RELIEF_SURFACES, PERSONAL_NET_COST_LABEL, TAX_AND_NI_LABEL, TAX_RELIEF_LABEL,
  pensionReliefLines,
} from '../src/presentation/view/pension-relief.js';

const example = createExampleProfile();
const defs = fieldsFor(example);
const defFor = (id: string): ControlFieldDef => {
  const found = defs.find(def => def.id === id);
  assert.ok(found, `missing field ${id}`);
  return found;
};

const salary = defFor('income.salaryAnnual');
const monthly = defFor('spending.current.essentialMonthly');
const rate = defFor('personal.targetSuccessProbability');
const seed = defFor('simulation.seed');
const age = defFor('personal.currentAge');

test('each kind carries its own unit, on screen and in the accessible name', () => {
  assert.deepEqual(fieldAffix('money'), { prefix: '£' });
  assert.deepEqual(fieldAffix('monthlyMoney'), { prefix: '£', suffix: '/mo' });
  assert.deepEqual(fieldAffix('percent'), { suffix: '%' });
  assert.deepEqual(fieldAffix('multiple'), { suffix: '×' });
  // An age, a path count and a correlation are bare numbers; inventing a unit for them would lie.
  for (const kind of ['age', 'integer', 'decimal'] as const) {
    assert.deepEqual(fieldAffix(kind), {});
    assert.equal(spokenUnit(kind), '');
  }
  // The visible adornment is aria-hidden, so the unit has to survive as a word somewhere.
  assert.equal(spokenUnit('money'), 'in pounds');
  assert.equal(spokenUnit('monthlyMoney'), 'in pounds per month');
  assert.equal(spokenUnit('percent'), 'in percent');
});

test('thousands separators appear on money and nowhere a separator would mislead', () => {
  assert.equal(groupedText(salary, '55000'), '55,000');
  assert.equal(groupedText(salary, '1234567'), '1,234,567');
  assert.equal(groupedText(salary, '999'), '999');
  assert.equal(groupedText(salary, '1234.5'), '1,234.5');
  assert.equal(groupedText(salary, '-1234'), '-1,234');
  assert.equal(groupedText(monthly, '1650'), '1,650');
  // Already grouped text is stable, so blurring twice cannot double up the commas.
  assert.equal(groupedText(salary, '55,000'), '55,000');
  assert.equal(groupedText(salary, groupedText(salary, '1234567')), '1,234,567');

  // A random seed is an identifier, not a quantity: 20,260,101 would dress it up as one.
  assert.equal(isGrouped('integer'), false);
  assert.equal(groupedText(seed, '20260101'), '20260101');
  assert.equal(groupedText(rate, '90'), '90');
  assert.equal(groupedText(age, '1000'), '1000');
});

test('a draft the parser refuses is handed back untouched for the schema to reject', () => {
  for (const bad of ['', '  ', 'abc', '1e5', '12/3', '-', '.', '1.2.3', '12%', '$12']) {
    assert.equal(groupedText(salary, bad), bad, `groupedText rewrote ${JSON.stringify(bad)}`);
  }
  // The one that matters, and the one Chrome caught: regrouping "1,2,3" into "123" would show the
  // reader a plausible figure while the schema was rejecting their draft as NaN.
  assert.equal(groupedText(salary, '1,2,3'), '1,2,3');
  assert.ok(Number.isNaN(fromDisplay(salary, groupedText(salary, '1,2,3'))));
  // What the parser does accept is regrouped, including the field's own unit typed back into it.
  assert.equal(groupedText(salary, '.5'), '0.5');
  assert.equal(groupedText(salary, '£55000'), '55,000');
  assert.equal(groupedText(monthly, '£1650/mo'), '1,650');
  // Whatever comes back still means the same number, or is still refused. Nothing in between.
  for (const text of ['55000', '1,234.50', '£55,000', '.5', '1,2,3', 'abc', '1e5']) {
    const shown = groupedText(salary, text);
    assert.equal(String(fromDisplay(salary, shown)), String(fromDisplay(salary, text)),
      `grouping changed what ${JSON.stringify(text)} means`);
  }
});

test('focused shows the reader’s own keystrokes; blurred shows the grouped figure', () => {
  assert.equal(fieldText(salary, '55000', true), '55000');
  assert.equal(fieldText(salary, '55000', false), '55,000');
  // Half-typed text must survive focus: grouping "5500" into "5,500" mid-keystroke moves the caret.
  assert.equal(fieldText(salary, '5500', true), '5500');
  // Blur is the only thing that changes, and it changes a string — never a stored value.
  assert.equal(fieldText(rate, '92.5', false), '92.5');
});

test('blur formatting cannot be an edit: the draft map and the profile are untouched', () => {
  const drafts = { [salary.id]: '55000' };
  const before = JSON.stringify(drafts);
  const profileBefore = JSON.stringify(example);
  // Everything the blurred field does, twice, the way a reader tabbing through a form would.
  for (const focused of [true, false, true, false]) fieldText(salary, drafts[salary.id]!, focused);
  assert.equal(JSON.stringify(drafts), before, 'rendering changed the drafts');
  assert.equal(JSON.stringify(example), profileBefore, 'rendering changed the profile');
  // And the grouped text the reader is left looking at still means the number they typed.
  assert.equal(fromDisplay(salary, fieldText(salary, drafts[salary.id]!, false)), 55_000);
  const applied = applyDrafts(example, { [salary.id]: fieldText(salary, '55000', false) }, defs);
  assert.deepEqual(applied, applyDrafts(example, { [salary.id]: '55000' }, defs));
});

test('fromDisplay accepts correct grouping and still refuses a typo', () => {
  assert.equal(fromDisplay(salary, '1,234.50'), 1234.5);
  assert.equal(fromDisplay(salary, '1,234'), 1234);
  assert.equal(fromDisplay(salary, '12,345,678'), 12_345_678);
  assert.equal(fromDisplay(salary, '-1,234'), -1234);
  // Grouping has to be *correct* grouping. "1,2,3" is somebody's typo, and guessing 123 from it is
  // exactly the silent fallback work package 4 forbids.
  assert.ok(Number.isNaN(fromDisplay(salary, '1,2,3')));
  assert.ok(Number.isNaN(fromDisplay(salary, '1,23')));
  assert.ok(Number.isNaN(fromDisplay(salary, ',234')));
  assert.ok(Number.isNaN(fromDisplay(salary, '1,234,')));
  // The unchanged half of the contract.
  assert.ok(Number.isNaN(fromDisplay(salary, '')));
  assert.ok(Number.isNaN(fromDisplay(salary, '   ')));
  assert.ok(Number.isNaN(fromDisplay(salary, 'abc')));
});

test('a field’s own unit typed back into it is not a mistake; any other unit is', () => {
  // The box already shows £, so a reader pasting "£55,000" off a payslip meant 55000.
  assert.equal(fromDisplay(salary, '£55,000'), 55_000);
  assert.equal(fromDisplay(salary, '£12'), 12);
  assert.equal(fromDisplay(monthly, '£1,650/mo'), 1650);
  assert.equal(fromDisplay(rate, '92.5%'), 0.925);
  // But only its own unit. A pound sign in a percent box is a real mistake and stays NaN.
  assert.ok(Number.isNaN(fromDisplay(rate, '£12')));
  assert.ok(Number.isNaN(fromDisplay(salary, '12%')));
  assert.ok(Number.isNaN(fromDisplay(salary, '$12')));
  assert.ok(Number.isNaN(fromDisplay(salary, '£')));
});

test('the display corpus round-trips through the conversion authority', () => {
  const corpus: [ControlFieldDef, string, number][] = [
    [salary, '55000', 55_000], [salary, '1,234.50', 1234.5], [salary, '£55,000', 55_000],
    [monthly, '1650', 1650], [monthly, '£1,650/mo', 1650],
    [rate, '90', 0.9], [rate, '92.5%', 0.925],
    [seed, '20260101', 20_260_101], [age, '36', 36],
  ];
  for (const [def, text, expected] of corpus) {
    const parsed = fromDisplay(def, text);
    assert.equal(parsed, expected, `${def.id} parsed ${text}`);
    // toDisplay is the edit-box form: raw digits, no separators, so a focused field stays typeable.
    const shown = toDisplay(def, parsed);
    assert.ok(!shown.includes(','), `${def.id} put a separator in the editable value`);
    assert.equal(fromDisplay(def, shown), parsed, `${def.id} did not round-trip`);
    assert.equal(toDisplay(def, fromDisplay(def, shown)), shown, `${def.id} is not stable`);
    // And the resting form the reader sees means the same number.
    assert.equal(fromDisplay(def, groupedText(def, shown)), parsed, `${def.id} lost meaning when grouped`);
  }
});

test('an invalid draft still reaches profileSchema as NaN', () => {
  const state = validateDrafts(example, { [salary.id]: '1,2,3' });
  assert.equal(state.ok, false);
  assert.ok(state.issues.some(issue => issue.fieldId === salary.id), 'the salary field was not blamed');
  // The previous value must not have been silently kept.
  const candidate = applyDrafts(example, { [salary.id]: '1,2,3' }, defs) as { income: { salaryAnnual: number } };
  assert.ok(Number.isNaN(candidate.income.salaryAnnual));
});

test('a monthly field says what it costs a year, from the stored value', () => {
  assert.equal(annualEquivalent(monthly, 1650), '= £19,800/yr');
  assert.equal(annualEquivalent(monthly, 0), '= £0/yr');
  // Only monthly kinds: an annual salary does not need telling it is annual.
  assert.equal(annualEquivalent(salary, 55_000), null);
  assert.equal(annualEquivalent(rate, 0.9), null);
  assert.equal(annualEquivalent(age, 36), null);
  // A half-typed draft has no annual size, and must not print "= £NaN/yr".
  assert.equal(annualEquivalent(monthly, Number.NaN), null);
  // It is the stored value × 12, via the registry's own conversion, on the real profile.
  const stored = example.spending.current.essentialMonthly;
  assert.equal(annualEquivalent(monthly, fromDisplay(monthly, toDisplay(monthly, stored))),
    annualEquivalent(monthly, stored));
});

test('arrow keys step in display units, and refuse to invent a number', () => {
  assert.equal(salary.step, 500);
  assert.equal(stepDraft(salary, '55000', 1), '55500');
  assert.equal(stepDraft(salary, '55,000', -1), '54500');
  assert.equal(stepDraft(rate, '90', 1), '91');
  assert.equal(stepDraft(age, '36', -1), '35');
  // From empty, stepping starts at one step, the way type="number" did.
  assert.equal(stepDraft(salary, '', 1), '500');
  // Binary noise never reaches the box.
  const equities = defFor('market.equities.meanNominal');
  assert.equal(stepDraft(equities, '7', 1), String(7 + equities.step));
  // An unparseable draft is left exactly as it is: the NaN goes to the schema, not to a guess.
  assert.equal(stepDraft(salary, 'abc', 1), null);
  assert.equal(stepDraft(salary, '1,2,3', 1), null);
});

test('the two pension-relief figures cannot be given the same name', () => {
  const relief = calculatePensionRelief(taxInputFromProfile(example), getTaxConfig('rest_of_uk', '2026/27')).relief;
  const lines = pensionReliefLines(relief);
  assert.deepEqual(lines.map(l => l.id), ['taxRelief', 'taxAndNi', 'personalNetCost']);
  assert.deepEqual(lines.map(l => l.label), [TAX_RELIEF_LABEL, TAX_AND_NI_LABEL, PERSONAL_NET_COST_LABEL]);
  // Three distinct names, and none of them a prefix of another, so no screen can shorten one into
  // the other and still look right.
  const labels = lines.map(l => l.label);
  assert.equal(new Set(labels).size, 3);
  for (const a of labels) for (const b of labels) if (a !== b) assert.ok(!a.includes(b) && !b.includes(a));

  // The arithmetic the names are about: NI is outside the tax relief and inside the other two.
  assert.equal(lines[0]!.amount, relief.totalTaxRelief);
  assert.equal(lines[1]!.amount, relief.totalTaxRelief + relief.employeeNiSaved);
  assert.equal(lines[2]!.amount, relief.personalNetCost);
  assert.ok(lines[0]!.meaning.includes('National Insurance is not in this figure'));
  assert.ok(lines[1]!.meaning.includes('National Insurance'));

  // Salary sacrifice is where they come apart; net pay is where they coincide. Both must be named
  // the same way, so a reader comparing methods is comparing like with like.
  const forMethod = (method: 'salary_sacrifice' | 'net_pay') => {
    const input = taxInputFromProfile(example);
    input.policy = { ...input.policy, method };
    return pensionReliefLines(calculatePensionRelief(input, getTaxConfig('rest_of_uk', '2026/27')).relief);
  };
  const sacrifice = forMethod('salary_sacrifice');
  assert.ok(sacrifice[1]!.amount > sacrifice[0]!.amount, 'sacrifice must save NI on top of tax');
  assert.equal(forMethod('net_pay')[1]!.amount, forMethod('net_pay')[0]!.amount);
});

/**
 * The audit that keeps working. A list checked once rots, so the surfaces are derived from the
 * sources: anything reading `totalTaxRelief` or `personalNetCost` for display must go through the
 * naming module, and anything rendering a `NumberField` must go through the shared component.
 */
test('every surface naming a relief figure goes through the naming authority', () => {
  const roots = ['src/presentation/web', 'src/presentation/cli', 'src/presentation/view'];
  const found: string[] = [];
  for (const root of roots) {
    for (const name of readdirSync(root)) {
      if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
      const path = join(root, name);
      if (path.endsWith('pension-relief.ts')) continue;
      const source = readFileSync(path, 'utf8');
      const raw = source.includes('totalTaxRelief') || source.includes('personalNetCost')
        || source.includes('employeeNiSaved');
      const named = source.includes('pensionReliefLines');
      if (!raw && !named) continue;
      found.push(path);
      // Reading the raw field is allowed only through the module that names it. A screen that
      // prints `relief.totalTaxRelief` beside the word "relief" is exactly the A.2 note 1 mistake.
      assert.ok(named, `${path} surfaces a pension-relief figure without the shared naming`);
    }
  }
  assert.deepEqual(found.sort(), [...PENSION_RELIEF_SURFACES].sort());
});

/**
 * The numeric inputs that are deliberately not `NumberField`s, each for a stated reason. Naming them
 * is what makes the next one an argument rather than a slip: a money or percent box hand-rolled past
 * the unit, the grouping and the NaN contract fails this test.
 *
 * - `profile-form.tsx` — the correlation matrix: a bare decimal in [-1, 1] with no unit, no
 *   separator and its own min/max.
 * - `screen-fire.tsx` — the spending override (blank is a third state, so `type="number"` is what
 *   guarantees blank-or-a-number reaches the run) plus the two worker-transport integers, which
 *   clamp into a supported range rather than rejecting.
 */
const HAND_ROLLED_INPUTS = { 'profile-form.tsx': 1, 'screen-fire.tsx': 3 } as const;

test('no screen builds its own numeric input instead of the shared one', () => {
  const root = 'src/presentation/web';
  for (const name of readdirSync(root)) {
    if (!name.endsWith('.tsx') || name === 'components.tsx') continue;
    const source = readFileSync(join(root, name), 'utf8');
    // Numeric by type, or numeric by keyboard — a money box written as text with a decimal keypad
    // is the same duplication wearing a different attribute.
    const raw = (source.match(/type="number"/g)?.length ?? 0)
      + (source.match(/inputMode="decimal"/g)?.length ?? 0);
    const expected = HAND_ROLLED_INPUTS[name as keyof typeof HAND_ROLLED_INPUTS] ?? 0;
    assert.equal(raw, expected, `${name} hand-rolls ${raw} numeric <input> element(s), expected ${expected}`);
  }
});

test('the unit is printed by the shared frame, never spelled into a label', () => {
  const root = 'src/presentation/web';
  for (const name of readdirSync(root)) {
    if (!name.endsWith('.tsx') || name === 'components.tsx') continue;
    const source = readFileSync(join(root, name), 'utf8');
    // No screen re-decides where the £ goes, or re-derives the grouped or annual form.
    for (const helper of ['fieldAffix', 'fieldText', 'groupedText', 'stepDraft']) {
      assert.ok(!source.includes(helper), `${name} re-implements the input's ${helper} presentation`);
    }
    // And the unit is no longer a parenthesis in the label text.
    assert.ok(!/>[^<>]*\(£[^<>]*\)/.test(source), `${name} still spells a unit into a label`);
  }
});
