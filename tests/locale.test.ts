import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOCALE, isLocale, message, readLocale } from '../src/presentation/i18n/locale.js';
import { en } from '../src/presentation/i18n/en.js';
import { zhTW } from '../src/presentation/i18n/zh-TW.js';

test('locale defaults to English without storage, with invalid storage or denied storage', () => {
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.equal(readLocale(undefined), 'en');
  assert.equal(readLocale({ getItem: () => 'fr' }), 'en');
  assert.equal(readLocale({ getItem: () => { throw new Error('denied'); } }), 'en');
  assert.equal(readLocale({ getItem: () => 'zh-TW' }), 'zh-TW');
  assert.equal(readLocale({ getItem: () => 'en' }), 'en');
  assert.equal(isLocale('zh-CN'), false);
});

test('both locale catalogs cover the shell and all eight destinations', () => {
  assert.deepEqual(Object.keys(zhTW).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.equal(message('en', key), en[key]);
    assert.equal(message('zh-TW', key), zhTW[key]);
    assert.ok(zhTW[key].length > 0);
  }
  assert.equal(message('zh-TW', 'overview'), '總覽');
});

import { translateText } from '../src/presentation/i18n/locale.js';
import { NUMBER_FIELDS, CHOICE_FIELDS, FIELD_GROUPS, fieldName } from '../src/presentation/view/fields.js';

test('every static profile field and group has a translated display label and explanation', () => {
  for (const def of [...NUMBER_FIELDS, ...CHOICE_FIELDS, ...FIELD_GROUPS]) {
    const label = fieldName(def);
    if (!['ISA', 'SIPP'].includes(label)) assert.notEqual(translateText('zh-TW', label), label, label);
    for (const key of ['help', 'plainHelp', 'derivedFrom', 'note'] as const) {
      const copy = key in def ? (def as unknown as Record<string, string | undefined>)[key] : undefined;
      if (copy) assert.notEqual(translateText('zh-TW', copy), copy, copy);
    }
  }
});

test('translation preserves English, unknown user text, numeric values and variable field indices', () => {
  assert.equal(translateText('en', 'Gross salary'), 'Gross salary');
  assert.equal(translateText('zh-TW', 'My plan: rent until 2045'), 'My plan: rent until 2045');
  assert.equal(translateText('zh-TW', '£55,000'), '£55,000');
  assert.equal(translateText('zh-TW', 'Phase 12 essential'), '第 12 階段必要支出');
  assert.equal(translateText('zh-TW', 'Refinance 2 rate'), '第 2 次轉貸利率');
  assert.equal(translateText('zh-TW', 'equities / inflation log-shock correlation'), '股票／通膨對數衝擊相關性');
});

import { GLOSSARY } from '../src/presentation/view/glossary.js';
import { glossaryZhTW } from '../src/presentation/i18n/glossary-zh-TW.js';
import { localizeGlossaryEntry } from '../src/presentation/i18n/glossary.js';

test('the complete glossary translates definitions while preserving IDs and cross-references', () => {
  assert.deepEqual(Object.keys(glossaryZhTW).sort(), GLOSSARY.map(entry => entry.id).sort());
  for (const entry of GLOSSARY) {
    const localized = localizeGlossaryEntry('zh-TW', entry);
    assert.equal(localized.id, entry.id);
    assert.equal(localized.seeAlso, entry.seeAlso);
    assert.notEqual(localized.definition, entry.definition);
    assert.equal(localizeGlossaryEntry('en', entry), entry);
  }
});

import { starterCards, STARTER_CHOICE_EFFECT, STARTER_FACT_LINK_NOTE, STARTER_NEXT_PROMPT, starterProvenanceNote } from '../src/presentation/view/starter-picker.js';
import { WIZARD_STEPS } from '../src/presentation/view/wizard-model.js';
import { twoNumbersStory } from '../src/presentation/view/two-numbers.js';
import { CONFIDENCE_BANDS, FAILURE_LABELS, WEALTH_CATEGORIES } from '../src/presentation/view/monte-carlo-model.js';
import { REWRITES, plainMessage } from '../src/presentation/view/messages.js';

const assertTranslated = (copy: string) => {
  assert.notEqual(translateText('zh-TW', copy), copy, copy);
  assert.equal(translateText('en', copy), copy);
};

test('every starter card and wizard step translates authored copy without changing its numeric facts', () => {
  for (const copy of [STARTER_CHOICE_EFFECT, STARTER_FACT_LINK_NOTE, STARTER_NEXT_PROMPT]) assertTranslated(copy);
  for (const card of starterCards()) {
    for (const copy of [card.name, card.who, card.caveat, ...card.reasoning, starterProvenanceNote(card.id)]) assertTranslated(copy);
    for (const fact of card.facts) {
      assertTranslated(fact.label);
      const translated = translateText('zh-TW', fact.value);
      assert.deepEqual(translated.match(/\d+(?:[,.]\d+)*/g), fact.value.match(/\d+(?:[,.]\d+)*/g), fact.value);
    }
  }
  for (const step of WIZARD_STEPS) { assertTranslated(step.title); assertTranslated(step.prompt); }
});

test('the reference FIRE explanation preserves its configured rate, path count and probability authority', () => {
  for (const input of [{ withdrawalRate: .035, pathCount: 10000 }, { withdrawalRate: .0425, pathCount: 12345 }]) {
    const story = twoNumbersStory(input);
    for (const copy of [story.question, story.landmark.title, story.landmark.sentence, story.verdict.title, story.verdict.sentence, story.caveat]) assertTranslated(copy);
    assert.match(translateText('zh-TW', story.verdict.sentence), /判斷是否達到目標/);
    assert.deepEqual(translateText('zh-TW', story.caveat).match(/\d+(?:[,.]\d+)*/g), story.caveat.match(/\d+(?:[,.]\d+)*/g));
  }
});

test('FIRE result categories, observed failures and confidence bands have translated labels', () => {
  for (const category of WEALTH_CATEGORIES) { assertTranslated(category.label); assertTranslated(category.description); }
  for (const band of CONFIDENCE_BANDS) assertTranslated(band.label);
  for (const label of Object.values(FAILURE_LABELS)) assertTranslated(label);
});

test('validation translation preserves bounds and does not alter the validation issue', () => {
  for (const rule of REWRITES) if (typeof rule.plain === 'string') assertTranslated(rule.plain);
  const issue = { path: 'income.salaryAnnual', fieldId: 'income.salaryAnnual', group: 'income' as const, message: 'Too small: expected number to be >=0' };
  const before = structuredClone(issue);
  const copy = plainMessage(issue, new Map([['income.salaryAnnual', { name: 'Gross salary', kind: 'money' as const }]]));
  assert.equal(translateText('zh-TW', copy), '稅前年薪不能為負數。若沒有此項，請填 0。');
  assert.deepEqual(issue, before);
  assert.equal(translateText('zh-TW', '  Run cancelled '), '  已取消執行 ');
});

import { fieldProvenance, provenanceSummary } from '../src/presentation/view/provenance.js';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { fieldTarget, fieldArrivalNote, tierRaiseNote } from '../src/presentation/view/field-navigation.js';

test('provenance and field navigation retain default numbers and translate the display setting explanation', () => {
  const starter = createExampleProfile();
  const edited = structuredClone(starter);
  edited.income.salaryAnnual += 1000;
  const entries = fieldProvenance(edited, starter);
  assertTranslated(provenanceSummary(entries));
  const entry = entries.get('income.salaryAnnual')!;
  assertTranslated(entry.note);assertTranslated(entry.resetLabel);
  assert.deepEqual(translateText('zh-TW', entry.note).match(/\d+(?:[,.]\d+)*/g), entry.note.match(/\d+(?:[,.]\d+)*/g));
  const target = fieldTarget(edited, 'household.adults')!;
  assertTranslated(fieldArrivalNote(target));
  const note = translateText('zh-TW', tierRaiseNote(target, 'common'));
  assert.match(note, /必要與常用項目/);assert.match(note, /計畫內容未改變/);
});
