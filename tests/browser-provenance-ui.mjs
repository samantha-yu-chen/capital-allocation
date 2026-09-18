/** Manual Chrome/CDP acceptance test for UX-2 (value provenance and reset).
 *
 * Start `npm run dev -- --port 5176 --strictPort` and a dedicated headless Chrome with
 * --remote-debugging-port=9226 --user-data-dir=/tmp/capital-ux2-chrome, then run with Node 24:
 * node tests/browser-provenance-ui.mjs. Override APP_PORT / CDP_PORT to use another pair.
 * Outputs JSON and PNGs into /tmp.
 *
 * What it proves:
 *  - nothing is marked "edited" on an untouched profile;
 *  - editing a money field, a percent field and a select each raises that field's marker, and
 *    resetting it restores the starter value and clears the marker (AC 2);
 *  - a reset while another field holds an invalid draft still reports that field's issue, and
 *    the reset does not make the invalid profile look runnable (AC 3);
 *  - a group reset restores only its own group;
 *  - the marker survives the tier filter, and mobile width has no horizontal overflow.
 *
 * Do not edit application source while this runs: Vite reloads reset in-memory profiles.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const appPort = process.env.APP_PORT ?? '5176';
const cdpPort = process.env.CDP_PORT ?? '9226';
const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r); let id = 0; const pending = new Map(); const errors = [];
let finished = false;
ws.onclose = () => { if (!finished) { console.error('CDP CONNECTION CLOSED'); process.exit(1); } };
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); };
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expression) => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = async (expr, limit = 30000) => { const start = Date.now(); while (Date.now() - start < limit) { const r = await ev(expr); if (r) return r; await new Promise(r => setTimeout(r, 120)); } throw Error('Timeout: ' + expr); };
const nav = async (path) => { await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}` + path }); await wait('document.readyState === "complete"'); };
const settle = () => new Promise(r => setTimeout(r, 220));
const shot = async (name) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };

const sel = fieldId => '#' + fieldId.replaceAll('.', '\\.');
const write = async (selector, value) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});const proto=e.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement;Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
const set = (fieldId, value) => write(sel(fieldId), value);
const value = fieldId => ev(`document.querySelector(${JSON.stringify(sel(fieldId))}).value`);

/** Every control currently showing the "edited" marker, named by its label. */
const editedLabels = () => ev(`[...document.querySelectorAll('.provenance .tag')].map(t=>{
  const field=t.closest('.field');
  const label=field?field.querySelector('label'):t.closest('h4');
  return (label?label.textContent:'?').replace(/\\s+/g,' ').trim();
})`);
const editedCount = () => ev(`document.querySelectorAll('.provenance .tag').length`);
/** The field's own marker, if it has one, plus the reset control's accessible name. */
const markOf = fieldId => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel(fieldId))});
  const field=e&&e.closest('.field');const mark=field&&field.querySelector('.provenance');
  return {edited:!!mark,reset:mark&&mark.querySelector('button')?mark.querySelector('button').getAttribute('aria-label'):null,
    note:mark?mark.textContent.replace(/\\s+/g,' ').trim():null};})()`);
/** The marker beside a registry-described select, which has a generated id. */
const markOfLabel = label => ev(`(()=>{const l=[...document.querySelectorAll('.field > .field-label-row > label, .field > label')].find(e=>e.textContent.replace(/\\s+/g,' ').trim().startsWith(${JSON.stringify(label)}));
  const field=l&&l.closest('.field');const mark=field&&field.querySelector('.provenance');
  return {found:!!l,edited:!!mark,reset:mark&&mark.querySelector('button')?mark.querySelector('button').getAttribute('aria-label'):null};})()`);
const clickReset = async fieldId => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel(fieldId))});const b=e.closest('.field').querySelector('.provenance button');if(!b)throw Error('No reset for '+${JSON.stringify(fieldId)});b.click();})()`); await settle(); };
const clickResetLabel = async label => { await ev(`(()=>{const l=[...document.querySelectorAll('.field > .field-label-row > label, .field > label')].find(e=>e.textContent.replace(/\\s+/g,' ').trim().startsWith(${JSON.stringify(label)}));const b=l.closest('.field').querySelector('.provenance button');if(!b)throw Error('No reset for '+${JSON.stringify(label)});b.click();})()`); await settle(); };
const selectValueOf = label => ev(`(()=>{const l=[...document.querySelectorAll('.field > .field-label-row > label, .field > label')].find(e=>e.textContent.replace(/\\s+/g,' ').trim().startsWith(${JSON.stringify(label)}));const s=l.closest('.field').querySelector('select');return s?s.value:null})()`);
const setSelect = async (label, v) => { await ev(`(()=>{const l=[...document.querySelectorAll('.field > .field-label-row > label, .field > label')].find(e=>e.textContent.replace(/\\s+/g,' ').trim().startsWith(${JSON.stringify(label)}));const s=l.closest('.field').querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(v)});s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
const groupResetButtons = () => ev(`[...document.querySelectorAll('details.group button')].map(b=>b.textContent.replace(/\\s+/g,' ').trim()).filter(t=>t.startsWith('Reset '))`);
const clickGroupReset = async prefix => { await ev(`(()=>{const b=[...document.querySelectorAll('details.group button')].find(e=>e.textContent.replace(/\\s+/g,' ').trim().startsWith(${JSON.stringify(prefix)}));if(!b)throw Error('No group reset '+${JSON.stringify(prefix)});b.click();})()`); await settle(); };
const summary = () => ev(`(()=>{const p=[...document.querySelectorAll('.field-help')].find(e=>/values (is|are) yours|values is still the starter/.test(e.textContent));return p?p.textContent.replace(/\\s+/g,' ').trim():null})()`);
const netWorth = () => ev(`(()=>{const d=[...document.querySelectorAll('.line')].find(e=>e.textContent.includes('Net worth'));return d?d.querySelector('dd').textContent.trim():null})()`);
const blocked = () => ev(`document.body.innerText.includes('Fix the inputs before the model can run')`);
const filter = async (label) => { await ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!l)throw Error('Missing filter '+${JSON.stringify(label)});l.querySelector('input').click();})()`); await settle(); };

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
const results = {};

await nav('/');
await ev('document.getElementById("tab-overview").click()');
await settle();
await wait('!!document.getElementById("personal.currentAge")');
await ev(`document.querySelectorAll('details.group').forEach(e=>e.open=true)`);
await settle();

// 1. An untouched profile claims nothing as the reader's.
results.untouchedEdited = await editedCount();
results.untouchedSummary = await summary();
results.untouchedGroupResets = await groupResetButtons();
results.baselineNetWorth = await netWorth();
results.baselineSalary = await value('income.salaryAnnual');
await shot('ux2-untouched-desktop');

// 2. A money field: edit, marker, reset, marker gone.
await set('income.salaryAnnual', '61000');
results.moneyEdited = await markOf('income.salaryAnnual');
results.moneyEditedLabels = await editedLabels();
results.moneySummary = await summary();
await shot('ux2-money-edited-desktop');
await clickReset('income.salaryAnnual');
results.moneyAfterReset = { mark: await markOf('income.salaryAnnual'), value: await value('income.salaryAnnual') };

// 3. A percent field: the display is ×100, the stored value is a fraction.
await set('pension.employeeRate', '12');
results.percentEdited = await markOf('pension.employeeRate');
await clickReset('pension.employeeRate');
results.percentAfterReset = { mark: await markOf('pension.employeeRate'), value: await value('pension.employeeRate') };

// 4. A select: tax region is a registry-described choice, not a numeric field.
results.regionBefore = await selectValueOf('Tax region');
await setSelect('Tax region', 'rest_of_uk');
results.selectEdited = await markOfLabel('Tax region');
await shot('ux2-select-edited-desktop');
await clickResetLabel('Tax region');
results.selectAfterReset = { mark: await markOfLabel('Tax region'), value: await selectValueOf('Tax region') };

// 5. A reset while another field holds an invalid draft: the issue must survive it.
await set('income.salaryAnnual', '61000');
await set('assets.cash', '25000');
await set('personal.currentAge', '');            // an empty box is NaN, so the schema rejects it
await wait(`document.body.innerText.includes('Fix the inputs before the model can run')`);
results.invalidBefore = {
  blocked: await blocked(),
  ageError: await ev(`(()=>{const e=document.getElementById('personal.currentAge-error');return e?e.textContent.trim():null})()`),
};
await clickReset('income.salaryAnnual');
results.invalidAfterReset = {
  blocked: await blocked(),
  ageError: await ev(`(()=>{const e=document.getElementById('personal.currentAge-error');return e?e.textContent.trim():null})()`),
  ageBox: await value('personal.currentAge'),
  salary: await value('income.salaryAnnual'),
  salaryMark: await markOf('income.salaryAnnual'),
  cashMark: await markOf('assets.cash'),
};
await shot('ux2-reset-with-invalid-draft-desktop');
// Repair the age and confirm the model runs again with the reset value in place.
await set('personal.currentAge', '31');
await wait(`!document.body.innerText.includes('Fix the inputs before the model can run')`);
results.repaired = { salary: await value('income.salaryAnnual'), netWorth: await netWorth(), edited: await editedLabels() };

// 6. A group reset restores its own group and leaves the others alone.
await set('income.salaryAnnual', '61000');
await set('income.bonusAnnual', '5000');
results.beforeGroupReset = { edited: await editedLabels(), buttons: await groupResetButtons() };
await clickGroupReset('Reset income');
results.afterGroupReset = {
  edited: await editedLabels(),
  salary: await value('income.salaryAnnual'),
  bonus: await value('income.bonusAnnual'),
  cash: await value('assets.cash'),
};
await shot('ux2-group-reset-desktop');
await clickGroupReset('Reset assets');
results.afterSecondGroupReset = { edited: await editedLabels(), netWorth: await netWorth(), summary: await summary() };

// 7. The marker is not a tier: it survives filtering, and an edited hidden field keeps its value.
// Market assumptions are expert tier, so the filter has to be widened before the field exists.
await filter('Everything');
await ev(`document.querySelectorAll('details.group').forEach(e=>e.open=true)`);
await settle();
await set('market.equities.meanNominal', '8');
await filter('Essential only');
results.filteredEdited = await editedLabels();
await filter('Everything');
await ev(`document.querySelectorAll('details.group').forEach(e=>e.open=true)`);
await settle();
results.afterFilter = { equities: await value('market.equities.meanNominal'), mark: await markOf('market.equities.meanNominal') };
await clickReset('market.equities.meanNominal');
results.equitiesAfterReset = { value: await value('market.equities.meanNominal'), mark: await markOf('market.equities.meanNominal') };

// 8. The whole-profile reset agrees with the per-field one: nothing is left claimed.
await set('assets.isa', '90000');
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Reset everything to the starter profile'));if(!b)throw Error('No global reset');b.click();})()`);
await settle();
await ev(`document.querySelectorAll('details.group').forEach(e=>e.open=true)`);
await settle();
results.afterGlobalReset = {
  edited: await editedLabels(), isa: await value('assets.isa'),
  netWorth: await netWorth(), summary: await summary(),
};

// 9. Mobile: the marker and its reset must not push the page sideways.
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev(`window.scrollTo(0,0)`);
await settle();
await set('income.salaryAnnual', '61000');
await set('assets.cash', '25000');
results.mobileOverflow = await ev('document.documentElement.scrollWidth-innerWidth');
results.mobileEdited = await editedLabels();
await shot('ux2-mobile-edited');
await clickReset('income.salaryAnnual');
results.mobileAfterReset = await editedLabels();
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });

console.log('untouched edited markers:', results.untouchedEdited, '| summary:', results.untouchedSummary);
console.log('money :', JSON.stringify(results.moneyEdited), '->', JSON.stringify(results.moneyAfterReset));
console.log('percent:', JSON.stringify(results.percentEdited), '->', JSON.stringify(results.percentAfterReset));
console.log('select :', JSON.stringify(results.selectEdited), '->', JSON.stringify(results.selectAfterReset));
console.log('reset with an invalid draft:', JSON.stringify(results.invalidAfterReset, null, 1));
console.log('group reset:', JSON.stringify(results.afterGroupReset));
console.log('mobile overflow:', results.mobileOverflow);

// 1. Nothing is claimed before the reader touches anything.
assert.equal(results.untouchedEdited, 0, 'an untouched profile must show no edited marker');
assert.match(results.untouchedSummary ?? '', /^Every one of these \d+ values is still the starter profile’s\. /);
assert.deepEqual(results.untouchedGroupResets, [], 'no group offers a reset when nothing is edited');

// 2/3/4. Money, percent and select each mark, and each goes back. (AC 2)
assert.equal(results.moneyEdited.edited, true);
assert.equal(results.moneyEdited.reset, 'Reset Gross salary to the default £55000');
assert.deepEqual(results.moneyEditedLabels, ['Gross salary (£)']);
assert.match(results.moneySummary ?? '', /^1 of \d+ values is yours/);
assert.equal(results.moneyAfterReset.mark.edited, false);
assert.equal(results.moneyAfterReset.value, results.baselineSalary);

assert.equal(results.percentEdited.edited, true);
assert.equal(results.percentEdited.reset, 'Reset Employee contribution to the default 5%');
assert.equal(results.percentAfterReset.mark.edited, false);
assert.equal(results.percentAfterReset.value, '5');

assert.equal(results.regionBefore, 'scotland');
assert.equal(results.selectEdited.found, true);
assert.equal(results.selectEdited.edited, true);
assert.equal(results.selectEdited.reset, 'Reset Tax region to the default Scotland');
assert.equal(results.selectAfterReset.mark.edited, false);
assert.equal(results.selectAfterReset.value, 'scotland');

// 5. A reset never tidies away another field's error. (AC 3)
assert.equal(results.invalidBefore.blocked, true);
assert.ok(results.invalidBefore.ageError, 'the emptied age must report an issue');
assert.equal(results.invalidAfterReset.blocked, true, 'the reset must not make an invalid profile look runnable');
assert.equal(results.invalidAfterReset.ageError, results.invalidBefore.ageError, 'the other field keeps its own message');
assert.equal(results.invalidAfterReset.ageBox, '', 'the invalid draft is still on screen, untouched');
assert.equal(results.invalidAfterReset.salary, results.baselineSalary, 'the reset itself landed');
assert.equal(results.invalidAfterReset.salaryMark.edited, false);
assert.equal(results.invalidAfterReset.cashMark.edited, true, 'an unrelated edit is untouched by the reset');
assert.equal(results.repaired.salary, results.baselineSalary);
assert.deepEqual(results.repaired.edited, ['Cash (£)']);

// 6. A group reset is a group's worth of resets, no more.
assert.deepEqual(results.beforeGroupReset.edited.sort(), ['Bonus (£)', 'Cash (£)', 'Gross salary (£)']);
assert.ok(results.beforeGroupReset.buttons.some(t => /^Reset income \(2 values\) to the default$/.test(t)),
  `income offered: ${results.beforeGroupReset.buttons.join(' | ')}`);
assert.deepEqual(results.afterGroupReset.edited, ['Cash (£)'], 'only the income group went back');
assert.equal(results.afterGroupReset.salary, results.baselineSalary);
assert.equal(results.afterGroupReset.bonus, '0');
assert.equal(results.afterGroupReset.cash, '25000');
assert.deepEqual(results.afterSecondGroupReset.edited, []);
assert.equal(results.afterSecondGroupReset.netWorth, results.baselineNetWorth,
  'resetting every edit reproduces the starter’s own figures');

// 7. Provenance is independent of the tier filter.
assert.deepEqual(results.filteredEdited, [], 'a hidden field shows no marker, because it shows nothing');
assert.equal(results.afterFilter.equities, '8', 'the hidden edit survived the filter');
assert.equal(results.afterFilter.mark.edited, true);
assert.equal(results.equitiesAfterReset.value, '7');
assert.equal(results.equitiesAfterReset.mark.edited, false);

// 8. One idea of "the default" across the whole screen.
assert.deepEqual(results.afterGlobalReset.edited, []);
assert.equal(results.afterGlobalReset.isa, '50000');
assert.equal(results.afterGlobalReset.netWorth, results.baselineNetWorth);
assert.match(results.afterGlobalReset.summary ?? '', /^Every one of these \d+ values is still the starter profile’s\. /);

// 9. Mobile.
assert.equal(results.mobileOverflow, 0, `mobile overflowed by ${results.mobileOverflow}px`);
assert.deepEqual(results.mobileEdited.sort(), ['Cash (£)', 'Gross salary (£)']);
assert.deepEqual(results.mobileAfterReset, ['Cash (£)']);

assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux2-ui-results.json', JSON.stringify({ ...results, errors }, null, 2));
console.log('UX-2 browser acceptance: PASS');
finished = true; ws.close();
