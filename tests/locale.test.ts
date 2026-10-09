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


import { MODEL_SECTIONS, tabSections } from '../src/presentation/view/learn.js';
import { learnZhTW, localizeLearnSection, localizeLearnTabSection } from '../src/presentation/i18n/learn-zh-TW.js';
import { overviewZhTW, overviewExtraZhTW } from '../src/presentation/i18n/overview-zh-TW.js';

test('Learn translates every model and screen section while preserving IDs, sources and term relationships', () => {
  const sections = [...MODEL_SECTIONS, ...tabSections()];
  assert.deepEqual(Object.keys(learnZhTW).sort(), sections.map(section => section.id).sort());
  for (const section of sections) {
    const before = structuredClone(section);
    assert.equal(localizeLearnSection('en', section), section);
    const translated = localizeLearnSection('zh-TW', section);
    assert.notEqual(translated.title, section.title);
    assert.equal(translated.paragraphs.length, section.paragraphs.length, section.id);
    for (const paragraph of translated.paragraphs) assert.match(paragraph, /[\u3400-\u9fff]/);
    assert.equal(translated.id, section.id);
    assert.deepEqual(translated.sources, section.sources);
    assert.deepEqual(translated.terms, section.terms);
    assert.deepEqual(section, before);
  }
  for (const section of tabSections()) {
    const translated = localizeLearnTabSection('zh-TW', section);
    assert.notEqual(translated.question, section.question);
    assert.equal(translated.tab, section.tab);
  }
});

test('Overview catalog translates authored copy and keeps numeric facts in ledger templates', () => {
  for (const copy of [...Object.keys(overviewZhTW), ...Object.keys(overviewExtraZhTW)]) assertTranslated(copy);
  const samples = [
    'Showing ages 35–55 of 35–95. Amounts in today’s money.',
    'Age 51 detail (nominal)',
    '10,000 paths, seed 2026, v0.3',
    '21 ages × 10,000 paths, seed 2026, v0.3',
    'The earliest age that meets your 95% target is 52.',
    'At your target of 50, this plan succeeds in 68.98% of simulated futures (“target”).',
  ];
  for (const copy of samples) {
    assertTranslated(copy);
    assert.doesNotMatch(translateText('zh-TW', copy), /against a|Pension input exceeds/);
    assert.deepEqual(translateText('zh-TW', copy).match(/\d+(?:[,.]\d+)*/g), copy.match(/\d+(?:[,.]\d+)*/g), copy);
  }
});


import { curveZhTW } from '../src/presentation/i18n/curve-zh-TW.js';
import { solverZhTW } from '../src/presentation/i18n/solver-zh-TW.js';
import { solveTarget, SOLVER_MODES, sensitivityCases } from '../src/engine/solver.js';
import { defaultLedgerOptions } from '../src/engine/ledger.js';
import { fireAgeCurve } from '../src/engine/fire-curve.js';
import { profileWith } from './ledger-helpers.js';
import { solverAnswer, solverHeadline, solverDetailRows, solverNotes, evaluationRows, curveHeadline, curveRows,
  curvePlan, solverPlan, SOLVER_QUESTIONS, solverBoundField, CURVE_FROM_FIELD, CURVE_TO_FIELD,
  SOLVER_TARGET_FIELD, SOLVER_BUDGET_FIELD } from '../src/presentation/view/solver-model.js';

test('curve and solver controls, definitions and static display catalogs are translated', () => {
  for (const copy of [...Object.keys(curveZhTW), ...Object.keys(solverZhTW)]) assertTranslated(copy);
  for (const mode of SOLVER_MODES) {
    assertTranslated(mode.label); assertTranslated(mode.definition);
    const field = solverBoundField(mode);assertTranslated(field.label);assertTranslated(field.help!);
  }
  for (const field of [CURVE_FROM_FIELD, CURVE_TO_FIELD, SOLVER_TARGET_FIELD, SOLVER_BUDGET_FIELD]) {
    assertTranslated(field.label);assertTranslated(field.help!);
  }
  for (const question of SOLVER_QUESTIONS) { assertTranslated(question.subject);assertTranslated(question.plain); }
  const profile = createExampleProfile();
  for (const item of sensitivityCases(profile)) { assertTranslated(item.label);assertTranslated(item.description); }
  const options = defaultLedgerOptions();
  for (const issues of [curvePlan(profile, options, { 'curve.fromAge': '0', 'curve.toAge': '999' }).issues,
    curvePlan(profile, options, { 'curve.fromAge': '30', 'curve.toAge': '94' }).issues,
    solverPlan(profile, options, { mode: 'salary', destination: 'gia', includeSensitivity: false,
      drafts: { 'solver.target': '0', 'solver.maxEvaluations': '2', 'solver.bound': '0' } }).issues]) {
    for (const issue of issues) assertTranslated(issue.message);
  }
});

test('real solver statuses and curve results translate without mutating result data or losing numeric facts', async () => {
  const profile = profileWith(p => { p.personal.endAge = 75; p.simulation.count = 24; });
  const results = await Promise.all([
    solveTarget(profile, { mode: 'salary', maxEvaluations: 16 }),
    solveTarget(profile, { mode: 'salary', targetProbability: .5 }),
    solveTarget(profile, { mode: 'salary', targetProbability: 1, bound: 58000 }),
    solveTarget(profile, { mode: 'salary', maxEvaluations: 3 }),
    solveTarget(profile, { mode: 'savings', ledgerOptions: { ...defaultLedgerOptions(), monthlyHouseholdOverride: 1500 } }),
  ]);
  assert.deepEqual(results.map(result => solverAnswer(result).status), ['achieved', 'already_met', 'infeasible', 'budget_exhausted', 'unsupported']);
  for (const result of results) {
    const before = structuredClone(result);
    const headline = solverHeadline(result), answer = solverAnswer(result);
    const copies = [headline.kicker, headline.note, answer.sentence, answer.honesty, ...solverNotes(result),
      ...solverDetailRows(result).flatMap(row => [row.label, row.note]), ...evaluationRows(result).map(row => row.verdict)];
    for (const copy of copies) if (copy) {
      assertTranslated(copy);
      const translated = translateText('zh-TW', copy);
      assert.deepEqual(translated.match(/\d+(?:[,.]\d+)*/g), copy.match(/\d+(?:[,.]\d+)*/g), copy);
      assert.doesNotMatch(translated, /we confirmed|the search|cleared your|does not have|was the far end|against a|re-checked against|Pension input exceeds/);
    }
    assert.deepEqual(result, before);
  }
  for (const targetProbability of [.5, 1]) {
    const curve = await fireAgeCurve(profile, { fromAge: 48, toAge: 50, targetProbability });
    const headline = curveHeadline(curve);assertTranslated(headline.kicker);assertTranslated(headline.note);
    for (const row of curveRows(curve)) assertTranslated(row.verdict);
  }
});


import { readFileSync } from 'node:fs';
test('curve and solver screens have translations for every direct authored text and shared display prop', () => {
  for (const file of ['screen-curve.tsx', 'screen-solver.tsx']) {
    const source = readFileSync(`src/presentation/web/${file}`, 'utf8');
    for (const match of source.matchAll(/(?:text\(|(?:title|kicker|label|help)=)"([^"\n]+)"/g)) {
      const copy = match[1]!;
      if (!/[A-Za-z]/.test(copy)) continue;
      assertTranslated(copy);
    }
  }
});


test('curve and solver dynamic announcements and accessible chart descriptions retain their numeric tokens', () => {
  for (const copy of [
    'Age 45: 2 of 3 ages complete', 'Compute 21 ages', 'Simulation progress for age 45',
    'Success probability by FIRE age, from age 45 to 47. No age reaches the target.',
    'Success probability by FIRE age, from age 45 to 51. Age 50 is the earliest reaching the 90% target.',
    'This run is 21 complete simulations — 210,000 lifetime projections at the configured path count. The count is never reduced to make the curve finish sooner; lower the path count above if you want a faster, less precise curve.',
    'Required gross salary: testing £88,400 — 17 of about 18 complete simulations',
    'Required gross salary: checking whether £255,000 is supported',
    'Confirming £87,600 against the full model',
    'Up to 19 complete simulations (190,000 lifetime projections) across 1 search. Every candidate runs the configured path count; nothing is sampled down to make the search finish sooner.',
    'Reaches 90.02% ± 0.59% against a 90% target, re-checked against the complete model. Today’s money; searched to the nearest £100.',
    'PensionLimitError: Age 36: Pension input exceeds available allowance by £98.14; excess-charge modelling is not supported',
    'FIRE age +2 (47)', 'Retirement spending −£150/month', '£1,200/month',
  ]) {
    assertTranslated(copy);
    assert.doesNotMatch(translateText('zh-TW', copy), /against a|Pension input exceeds/);
    assert.deepEqual(translateText('zh-TW', copy).match(/\d+(?:[,.]\d+)*/g),copy.match(/\d+(?:[,.]\d+)*/g),copy);
  }
});
