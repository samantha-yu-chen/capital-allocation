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
  for (const file of ['screen-curve.tsx', 'screen-solver.tsx', 'screen-marginal.tsx', 'screen-property.tsx', 'screen-attribution.tsx', 'screen-scenarios.tsx']) {
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


import { marginalZhTW, marginalBasisZhTW } from '../src/presentation/i18n/marginal-zh-TW.js';
import { propertyZhTW } from '../src/presentation/i18n/property-zh-TW.js';
import { compareMarginal, taxBoundaries } from '../src/engine/marginal.js';
import { marginalBasis, marginalRows, marginalConclusion, marginalPlan } from '../src/presentation/view/marginal-model.js';
import { comparisonRows, defaultProperty } from '../src/presentation/view/property-model.js';
import { comparePropertyPlans } from '../src/engine/property-comparison.js';

test('allocation and property catalogs cover authored explanations, tax bases and invalid controls', () => {
  for (const copy of [...Object.keys(marginalZhTW), ...Object.keys(marginalBasisZhTW), ...Object.keys(propertyZhTW)]) {
    if (['isa','gia'].includes(copy)) continue;
    assertTranslated(copy);
  }
  for (const copy of marginalBasis) assertTranslated(copy);
  for (const region of ['scotland', 'rest_of_uk'] as const) {
    const profile = createExampleProfile();profile.personal.taxRegion = region;
    for (const boundary of taxBoundaries(profile)) { assertTranslated(boundary.label);assertTranslated(boundary.basis); }
  }
  const profile = createExampleProfile();
  for (const value of ['', 'abc', '-1', 'Infinity']) {
    const plan = marginalPlan(profile, defaultLedgerOptions(), { 'marginal.amount': value }, 'gross_earnings');
    for (const issue of plan.issues) assertTranslated(issue);
  }
  for (const copy of [
    'Compare 10,000 matching paths', '2,500 / 10,000 path pairs', 'Failure at age 65',
    'Rank 2', 'cash: 3 of up to 7 plans complete',
    'Destination cash £0; pension added £1,000.',
    'Incremental income tax £-400; employee NI £-20; employer pension £100; provider relief £0.',
    'higher taxable band crossed at £62,430 (£62,000 → £63,000 on that tax basis).',
    'Pension / ISA has the highest tested constrained mean usable wealth. Shared ranks indicate near-equivalence within paired sampling uncertainty, not a universal wrapper ordering. Read the tradeoffs before acting.',
  ]) {
    assertTranslated(copy);
    assert.deepEqual(translateText('zh-TW',copy).match(/\d+(?:[,.]\d+)*/g),copy.match(/\d+(?:[,.]\d+)*/g),copy);
  }
});

test('actual allocation and property outputs translate display copy and preserve all result data', async () => {
  const profile = createExampleProfile();profile.simulation.count = 8;
  for (const basis of ['gross_earnings','after_tax_cash'] as const) {
    const result = await compareMarginal(profile, { amount:1000,basis,maximumDebt:0 });
    const before = structuredClone(result);
    assertTranslated(marginalConclusion(result));
    for (const row of marginalRows(result)) {
      if (!['ISA','GIA'].includes(row.label)) assertTranslated(row.label);
      for (const copy of [row.rank,row.classification,...row.constraints,...row.funding,...(row.reason?[row.reason]:[])]) {
        assertTranslated(copy);
        assert.doesNotMatch(translateText('zh-TW',copy),/crossed at|taxable band|pension added|requires an existing|requires a configured/);
        assert.deepEqual(translateText('zh-TW',copy).match(/\d+(?:[,.]\d+)*/g),copy.match(/\d+(?:[,.]\d+)*/g),copy);
      }
    }
    assert.deepEqual(result,before);
  }
  profile.property = defaultProperty(profile);
  const comparison = await comparePropertyPlans(profile);
  const before = structuredClone(comparison);
  for (const row of comparisonRows(comparison)) assertTranslated(row.label);
  assert.deepEqual(comparison,before);
});


import { attributionZhTW, attributionCaveatsZhTW } from '../src/presentation/i18n/attribution-zh-TW.js';
import { buildAnalysisCases, runAttribution } from '../src/engine/attribution.js';
import { STRESSES, STRESS_ASSUMPTIONS } from '../src/engine/stress.js';
import { attributionPlan, attributionRows, attributionConclusion, attributionCaveats, attributionDiagnostics, stressRows } from '../src/presentation/view/attribution-model.js';

test('attribution catalogs cover every case and stress, retaining assumptions and numeric shocks', () => {
  for (const copy of [...Object.keys(attributionZhTW), ...Object.keys(attributionCaveatsZhTW),...attributionCaveats]) assertTranslated(copy);
  const profile = createExampleProfile();profile.property = defaultProperty(profile);
  for (const item of buildAnalysisCases(profile)) assertTranslated(item.label);
  for (const id of STRESSES) {
    assertTranslated(id.replaceAll('_',' '));assertTranslated(STRESS_ASSUMPTIONS[id]);
    assert.deepEqual(translateText('zh-TW',STRESS_ASSUMPTIONS[id]).match(/\d+(?:[,.]\d+)*/g),STRESS_ASSUMPTIONS[id].match(/\d+(?:[,.]\d+)*/g));
  }
  const plan = attributionPlan(profile,defaultLedgerOptions(),'0');assertTranslated(plan.issue!);assertTranslated(plan.announcement);
  for (const copy of [
    '2/28 cases · Equity nominal mean +2pp · 5,000/10,000 paths',
    'More income has the largest tested improvement among income, expenses and allocation: Gross salary +£10,000/year (12.3 pp). This ranks these specific changes, not all possible plans.',
    'Age 65: mortgage_shortfall; £1,200 real shortfall',
  ]) { assertTranslated(copy);assert.deepEqual(translateText('zh-TW',copy).match(/\d+(?:[,.]\d+)*/g),copy.match(/\d+(?:[,.]\d+)*/g),copy); }
});

test('real attribution and stress display output translates without altering results, flags or path data', async () => {
  const profile = createExampleProfile();profile.simulation.count = 8;
  for (const property of [null,defaultProperty(profile)]) {
    profile.property = property;
    const result = await runAttribution(profile,{stressAge:profile.personal.targetFireAge});
    const before = structuredClone(result), diagnostics = attributionDiagnostics(result);
    const copies = [attributionConclusion(result),diagnostics.sequence,diagnostics.interpretation,
      ...diagnostics.failures.map(item=>item.label), ...diagnostics.diagnostics.flatMap(item=>[item.label,item.text]),
      ...[...attributionRows(result),...attributionRows(result,true)].flatMap(row=>[row.label,row.evidence,...(row.reason?[row.reason]:[])]),
      ...stressRows(result).flatMap(row=>[row.title,row.outcome,row.assumptions,row.diagnostic,...row.failures,...(row.reason?[row.reason]:[])])];
    for (const copy of copies) if (copy) {
      assertTranslated(copy);
      const translated = translateText('zh-TW',copy);
      assert.deepEqual(translated.match(/\d+(?:[,.]\d+)*/g),copy.match(/\d+(?:[,.]\d+)*/g),copy);
      assert.doesNotMatch(translated,/First five FIRE|when present|when absent|real shortfall|nominal means|Configure a property|recovered paths|observed recovery/);
    }
    assert.match(translateText('zh-TW',diagnostics.interpretation),/FIRE 後最初五年/);
    assert.deepEqual(result,before);
  }
});

test('scenario controls and dynamic costs retain all numeric values in Chinese', () => {
  for (const copy of [
    'Required matrix (salary × spending × strategy)',
    'Save, duplicate and edit alternatives',
    'Enter a salary of zero or more.',
    '36 scenarios × up to 1 complete simulation = 36 simulations, or 360,000 lifetime projections. The entered path count of 10,000 is used in full; it is never reduced to finish sooner.',
    'PREVIEW: you asked for 1,000 paths instead of the entered 10,000. Its numbers are labelled a preview and must not be read as a full-count result.',
    '£70k · £2,000/mo · Balanced',
    '1 of 2 scenarios reused an identical cached result. A cached cell is keyed on the whole profile, every run option and the engine, tax and generator versions, so it can only be reused for exactly the same inputs.',
    'Contractual employee contribution of 5.00% retained.',
    '£87,600 (already met)',
    'None in 45–48',
    'Cash leads at 68.98% ± 0.46% SE. It still falls short of the 90% target.',
    'Cash, Baseline lead within paired sampling uncertainty, so this batch does not separate them.',
  ]) {
    assertTranslated(copy);
    assert.deepEqual(translateText('zh-TW',copy).match(/\d+(?:[,.]\d+)*/g),copy.match(/\d+(?:[,.]\d+)*/g),copy);
  }
  assert.match(translateText('zh-TW','Cash leads at 68.98% ± 0.46% SE. It still falls short of the 90% target.'),/^Cash /);
});

import { localizeScenarioResult, localizeScenarioProgress } from '../src/presentation/i18n/scenario-result.js';
import { buildScenarioMatrix, buildIncomeCases, buildSpendingCases, buildLibraryCases, runScenarioBatch, CAPITAL_STRATEGIES } from '../src/engine/scenario.js';
import { scenarioRows, scenarioConclusion, dominanceNote, scenarioBasis } from '../src/presentation/view/scenario-model.js';
import { createScenario } from '../src/domain/scenarios.js';

test('actual scenario results localize generated labels while keeping user names and numbers intact', async () => {
  const profile=createExampleProfile();profile.simulation.count=4;
  const context={property:defaultProperty(profile),salaryAxis:[55_000,75_000,90_000]};
  const batches=[
    buildScenarioMatrix(profile,{salaries:[55_000,75_000],monthlySpending:[1300,2000],strategies:[...CAPITAL_STRATEGIES],context}),
    buildIncomeCases(profile,[55_000,75_000],null,'balanced',context),
    buildSpendingCases(profile,[1300,2000],'balanced',context),
    buildLibraryCases(['Cash','Baseline','ISA Heavy'].map(name=>createScenario({name,profile,note:'Balanced'}))),
  ];
  for(const cases of batches){
    const result=await runScenarioBatch(profile,{cases}),before=structuredClone(result);
    const display=localizeScenarioResult('zh-TW',result);
    assert.equal(localizeScenarioResult('en',result),result);
    for(let i=0;i<result.cells.length;i++){
      const original=result.cells[i]!,translated=display.cells[i]!;
      assert.deepEqual({...translated,label:original.label,note:original.note},original);
      if(original.group==='library') assert.equal(translated.label,original.label);
      else if(/[A-Za-z]{3}/.test(original.label)) assertTranslated(original.label);
    }
    for(const row of scenarioRows(display)){
      if(row.note) assert.doesNotMatch(row.note,/Contractual employee|Employee contribution|Buys at age|band\./);
      for(const copy of [row.fireAge,...row.requiredSalaryNotes]) if(/[A-Za-z]{3}/.test(copy)) assertTranslated(copy);
    }
    const conclusion=scenarioConclusion(display,.9);
    assertTranslated(conclusion);
    assert.deepEqual(translateText('zh-TW',conclusion).match(/\d+(?:[,.]\d+)*/g),conclusion.match(/\d+(?:[,.]\d+)*/g));
    const dominance=dominanceNote(result);if(dominance)assertTranslated(dominance);
    assert.deepEqual(result,before);
    const item=cases[0]!;
    const progress=localizeScenarioProgress('zh-TW',{stage:`${item.label}: FIRE age 45`,casesCompleted:1,casesPlanned:cases.length,paths:{completed:1,total:4}},cases);
    assert.match(progress,/FIRE 年齡 45/);
    if(item.group==='library') assert.ok(progress.startsWith(item.label));
  }
  for(const paragraph of scenarioBasis)assertTranslated(paragraph);
});

import { localizeLibraryRows } from '../src/presentation/i18n/scenario-result.js';
test('library localization preserves custom names and notes, translates app-owned migration notes',()=>{
  const profile=createExampleProfile();
  const scenarios=[createScenario({name:'Cash',profile,note:'Balanced',origin:'custom'}),
    createScenario({name:'Baseline',profile,note:'Migrated from schema 1; run options defaulted.',origin:'migrated-v1'})];
  const before=structuredClone(scenarios),rows=localizeLibraryRows('zh-TW',scenarios);
  assert.equal(rows[0]!.name,'Cash');assert.equal(rows[0]!.note,'Balanced');
  assert.equal(rows[1]!.name,'Baseline');assert.match(rows[1]!.note,/已從 schema 1 轉換/);
  assert.deepEqual(scenarios,before);
});

import { progressCountLine } from '../src/presentation/view/progress.js';
test('progress counts use the correct unit and import diagnostics translate without losing locations',()=>{
  assert.equal(progressCountLine(42,60,'scenarios'),'42 of 60 scenarios complete');
  assert.equal(translateText('zh-TW',progressCountLine(42,60,'scenarios')),'已完成 42／60 個情境');
  assert.equal(translateText('zh-TW',progressCountLine(1100,10000)),'已完成 1,100／10,000 條路徑');
  for(const copy of ['Age boundary','scenarios.0: Unrecognized key: "unknown"',"Expected property name or '}' in JSON at position 1 (line 1 column 2)"]){
    assertTranslated(copy);
    assert.deepEqual(translateText('zh-TW',copy).match(/\d+(?:[,.]\d+)*/g),copy.match(/\d+(?:[,.]\d+)*/g));
  }
});

import * as ts from 'typescript';
import { readdirSync } from 'node:fs';
test('every rendered screen has catalog coverage for authored static text and shared display props',()=>{
  const intentional=new Set(['English','Language / 語言','pkg','expm1(ρ·σᵢ·σⱼ) / √(expm1(σᵢ²)·expm1(σⱼ²))']);
  const directory='src/presentation/web/';
  for(const file of readdirSync(directory).filter(file=>file.endsWith('.tsx')&&file!=='screen-planned.tsx')){
    const source=ts.createSourceFile(file,readFileSync(directory+file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const check=(copy:string)=>{if(/[A-Za-z]{3}/.test(copy)&&!intentional.has(copy))assertTranslated(copy);};
    const visit=(node:ts.Node):void=>{
      if(ts.isJsxText(node)&&node.text.trim())check(node.text.trim().replace(/\s+/g,' '));
      if(ts.isJsxAttribute(node)&&['title','kicker','label','help','placeholder','aria-label','caption'].includes(node.name.getText(source))&&node.initializer&&ts.isStringLiteral(node.initializer))check(node.initializer.text);
      if(ts.isCallExpression(node)&&node.expression.getText(source)==='text'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text);
      ts.forEachChild(node,visit);
    };visit(source);
  }
});
