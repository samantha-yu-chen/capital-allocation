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
