/** Manual Chrome/CDP acceptance test for UX-9 (starter situations, "people like me").
 *
 * Start `npm run dev -- --port 5176 --strictPort` and a dedicated headless Chrome with
 * --remote-debugging-port=9226 --user-data-dir=/tmp/capital-ux9-chrome, then run with Node 24:
 * node tests/browser-starter-ui.mjs. Override APP_PORT / CDP_PORT to use another pair.
 * Outputs JSON and PNGs into /tmp.
 *
 * What it proves in a real browser:
 *  - the picker is on wizard step 1 and on the Scenario screen, every card carries the illustration
 *    caveat, and no card shows a probability or a projected figure (AC 4);
 *  - choosing a situation rewrites the whole form, marks nothing as the reader's, and names itself
 *    as what "default" now means (AC 3);
 *  - an edit after choosing offers the CHOSEN starter's value to reset to, never the profile it
 *    replaced, and the global reset lands back on the chosen starter (AC 3);
 *  - structure the previous situation lacked — the family's property — arrives as a default, not as
 *    an edit;
 *  - choosing runs nothing: no progress bar, no published probability;
 *  - choosing on the Scenario screen saves a named library entry and leaves the existing ones alone
 *    (AC 2);
 *  - all eight tabs stay reachable, mobile width does not overflow, and the page throws nothing.
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
const settle = () => new Promise(r => setTimeout(r, 250));
const shot = async (name) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };

const sel = fieldId => '#' + fieldId.replaceAll('.', '\\.');
const value = fieldId => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel(fieldId))});return e?e.value:null})()`);
const write = async (fieldId, v) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel(fieldId))});if(!e)throw Error('Missing input '+${JSON.stringify(fieldId)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(v))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
const tab = async (tabId) => { await ev(`document.getElementById("tab-${tabId}").click()`); await settle(); };
const openWizard = async () => { await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start here')).click()`); await settle(); };
const openGroups = () => ev(`document.querySelectorAll('details.group').forEach(e=>e.open=true)`);

/** Every starter card on screen, with the caveat it carries and the facts it lists. */
const cards = () => ev(`[...document.querySelectorAll('[data-testid="starter-picker"] [data-starter]')].map(li=>({
  id: li.getAttribute('data-starter'),
  name: li.querySelector('h4').textContent.trim(),
  caveat: li.querySelector('[data-testid="starter-caveat"]') ? li.querySelector('[data-testid="starter-caveat"]').textContent.replace(/\\s+/g,' ').trim() : null,
  facts: [...li.querySelectorAll('.starter-facts dt')].length,
  chosen: li.classList.contains('is-chosen'),
  pressed: li.querySelector('button').getAttribute('aria-pressed'),
  text: li.innerText.replace(/\\s+/g,' ').trim(),
}))`);
const choose = async (starterId) => { await ev(`document.querySelector('[data-testid="starter-choose-${starterId}"]').click()`); await settle(); };
const editedCount = () => ev(`document.querySelectorAll('.provenance .tag').length`);
const editedLabels = () => ev(`[...document.querySelectorAll('.provenance .tag')].map(t=>{const f=t.closest('.field');const l=f?f.querySelector('label'):null;return (l?l.textContent:'?').replace(/\\s+/g,' ').trim();})`);
const markOf = fieldId => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel(fieldId))});const f=e&&e.closest('.field');const m=f&&f.querySelector('.provenance');
  return {present:!!e,edited:!!m,reset:m&&m.querySelector('button')?m.querySelector('button').getAttribute('aria-label'):null,note:m?m.textContent.replace(/\\s+/g,' ').trim():null};})()`);
const summary = () => ev(`(()=>{const p=[...document.querySelectorAll('.field-help')].find(e=>/values (is|are) yours|values is still the starter/.test(e.textContent));return p?p.textContent.replace(/\\s+/g,' ').trim():null})()`);
const starterFootnote = () => ev(`(()=>{const p=[...document.querySelectorAll('.footnote')].find(e=>/“Default” here means/.test(e.textContent));return p?p.textContent.replace(/\\s+/g,' ').trim():null})()`);
const wizardNote = () => ev(`(()=>{const p=[...document.querySelectorAll('.wizard-note')].find(e=>/“Default” here means/.test(e.textContent));return p?p.textContent.replace(/\\s+/g,' ').trim():null})()`);
const globalReset = async () => { await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Reset everything to the starter profile'));if(!b)throw Error('No global reset');b.click();})()`); await settle(); };
const libraryRows = () => ev(`[...document.querySelectorAll('[data-testid="scenario-library"] tbody tr')].map(tr=>({
  name: tr.querySelector('th').innerText.replace(/\\s+/g,' ').trim(),
  salary: tr.children[1].textContent.trim(),
}))`);
const runningSigns = () => ev(`({
  progress: document.querySelectorAll('.progress, progress, [role="progressbar"]').length,
  running: [...document.querySelectorAll('button')].filter(b=>/Running…|Comparing…/.test(b.textContent)).length,
  probability: document.querySelectorAll('.wizard-probability').length,
})`);
const overflow = () => ev(`Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`);

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
const results = {};

// Start from a browser that has never dismissed the wizard.
await nav('/');
await ev(`try{localStorage.clear()}catch(e){}`);
await nav('/');
await wait('!!document.querySelector(\'[data-testid="starter-picker"]\')');

// 1. The picker is on wizard step 1, with every card carrying the caveat.
results.wizardCards = await cards();
results.wizardNoteBefore = await wizardNote();
results.baselineAge = await value('personal.currentAge');
results.baselineFireAge = await value('personal.targetFireAge');
await shot('ux9-wizard-picker-desktop');

// 2. Choosing rewrites the form and runs nothing.
await choose('family-40s-mid-mortgage');
results.afterChoose = {
  age: await value('personal.currentAge'),
  fireAge: await value('personal.targetFireAge'),
  note: await wizardNote(),
  cards: (await cards()).map(c => ({ id: c.id, chosen: c.chosen, pressed: c.pressed })),
  running: await runningSigns(),
};
await shot('ux9-wizard-chosen-desktop');

// 3. On the form: nothing is the reader's, and the note names the situation.
await tab('overview');
await wait('!!document.getElementById("income.salaryAnnual")');
await openGroups();
await settle();
results.chosenForm = {
  salary: await value('income.salaryAnnual'),
  pension: await value('assets.pension'),
  edited: await editedCount(),
  summary: await summary(),
  footnote: await starterFootnote(),
};
await shot('ux9-overview-chosen-desktop');

// 4. An edit offers the chosen starter's value back, not the one it replaced.
await write('income.salaryAnnual', '91000');
results.afterEdit = {
  labels: await editedLabels(),
  mark: await markOf('income.salaryAnnual'),
  summary: await summary(),
};
await shot('ux9-overview-edited-desktop');

// 5. The global reset lands on the chosen starter, not on the worked example.
await globalReset();
results.afterGlobalReset = {
  salary: await value('income.salaryAnnual'),
  edited: await editedCount(),
  footnote: await starterFootnote(),
};

// 6. Structure the previous situation did not have arrives as a default.
await tab('property');
await wait('!!document.getElementById("property.marketValue")');
await openGroups();
await settle();
results.property = {
  marketValue: await value('property.marketValue'),
  mortgage: await value('property.mortgageBalance'),
  mark: await markOf('property.marketValue'),
};
await shot('ux9-property-chosen-desktop');

// 7. The Scenario screen picker saves a named entry and leaves the others alone.
await tab('scenarios');
await wait('!!document.querySelector(\'[data-testid="starter-picker"]\')');
results.scenarioCards = (await cards()).length;
await choose('fifties-pension-heavy');
results.libraryAfterFirst = await libraryRows();
results.scenarioRunning = await runningSigns();
await choose('contractor-no-employer-pension');
results.libraryAfterSecond = await libraryRows();
await shot('ux9-scenarios-library-desktop');
await tab('overview');
await wait('!!document.getElementById("income.salaryAnnual")');
results.afterScenarioChoice = { salary: await value('income.salaryAnnual'), edited: await editedCount(), footnote: await starterFootnote() };

// 8. Back to the worked example: the choice is reversible.
await openWizard();
await wait('!!document.querySelector(\'[data-testid="starter-picker"]\')');
await choose('worked-example');
await tab('overview');
await wait('!!document.getElementById("income.salaryAnnual")');
results.backToExample = {
  salary: await value('income.salaryAnnual'),
  age: await value('personal.currentAge'),
  edited: await editedCount(),
  footnote: await starterFootnote(),
};

// 9. Every tab still reachable.
results.tabs = await ev(`[...document.querySelectorAll('[role="tab"]')].map(t=>t.textContent.replace(/\\s+/g,' ').trim())`);

// 10. Mobile.
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await openWizard();
await wait('!!document.querySelector(\'[data-testid="starter-picker"]\')');
await settle();
results.mobile = {
  overflow: await overflow(),
  cards: (await cards()).length,
  caveats: await ev(`document.querySelectorAll('[data-testid="starter-caveat"]').length`),
  cardWidth: await ev(`Math.round(document.querySelector('[data-starter]').getBoundingClientRect().width)`),
};
await shot('ux9-wizard-picker-mobile');
await choose('renting-late-20s');
results.mobileAfterChoose = { overflow: await overflow(), age: await value('personal.currentAge') };
await shot('ux9-wizard-chosen-mobile');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const CAVEAT = 'An illustration, not advice and not a benchmark: it is a set of plausible figures to start editing, '
  + 'not a claim about what someone in this situation has or should do.';

// 1. Six cards, each with the caveat and its own figures, the worked example chosen to begin with.
assert.equal(results.wizardCards.length, 6, `expected six cards, saw ${results.wizardCards.length}`);
for (const card of results.wizardCards) {
  assert.equal(card.caveat, CAVEAT, `${card.id} does not carry the caveat verbatim`);
  assert.ok(card.facts >= 8, `${card.id} lists only ${card.facts} facts`);
  assert.ok(!/%\s*(success|probability)|probability/i.test(card.text), `${card.id} shows a result on a card that ran nothing`);
}
assert.deepEqual(results.wizardCards.map(c => c.id), [
  'worked-example', 'renting-late-20s', 'higher-salary-renting-30s',
  'contractor-no-employer-pension', 'family-40s-mid-mortgage', 'fifties-pension-heavy',
]);
assert.equal(results.wizardCards.find(c => c.id === 'worked-example').chosen, true);
assert.match(results.wizardNoteBefore ?? '', /The worked example/);
assert.equal(results.baselineAge, '31');
assert.equal(results.baselineFireAge, '45');

// 2. Choosing rewrote the form, marked the new card, and started nothing.
assert.equal(results.afterChoose.age, '43');
assert.equal(results.afterChoose.fireAge, '61');
assert.match(results.afterChoose.note ?? '', /Family, 40s, mid-mortgage/);
assert.equal(results.afterChoose.cards.find(c => c.id === 'family-40s-mid-mortgage').chosen, true);
assert.equal(results.afterChoose.cards.find(c => c.id === 'family-40s-mid-mortgage').pressed, 'true');
assert.equal(results.afterChoose.cards.find(c => c.id === 'worked-example').chosen, false);
assert.deepEqual(results.afterChoose.running, { progress: 0, running: 0, probability: 0 },
  'choosing a situation must not start a run');

// 3. The whole form is the situation's, and none of it is the reader's.
assert.equal(results.chosenForm.salary, '74,000');
assert.equal(results.chosenForm.pension, '135,000');
assert.equal(results.chosenForm.edited, 0, 'a freshly chosen situation owns every value on the form');
assert.match(results.chosenForm.summary ?? '', /^Every one of these \d+ values is still the starter profile’s\./);
assert.match(results.chosenForm.footnote ?? '', /Family, 40s, mid-mortgage/);
assert.ok((results.chosenForm.footnote ?? '').includes('not advice and not a benchmark'),
  'the reset footnote must keep the illustration caveat');

// 4. The edit is the only thing marked, and it offers the chosen starter's own value.
assert.deepEqual(results.afterEdit.labels, ['Gross salary, in pounds']);
assert.equal(results.afterEdit.mark.edited, true);
assert.match(results.afterEdit.mark.reset ?? '', /£74000/);
assert.ok(!(results.afterEdit.mark.reset ?? '').includes('£55000'),
  'the replaced worked example must never be offered as the default');
assert.match(results.afterEdit.summary ?? '', /^1 of \d+ values is yours/);

// 5. The global reset goes back to the chosen situation.
assert.equal(results.afterGlobalReset.salary, '74,000', 'reset must land on the chosen starter, not the worked example');
assert.equal(results.afterGlobalReset.edited, 0);
assert.match(results.afterGlobalReset.footnote ?? '', /Family, 40s, mid-mortgage/);

// 6. The property the family owns is a default of theirs, not an edit.
assert.equal(results.property.marketValue, '320,000');
assert.equal(results.property.mortgage, '145,000');
assert.equal(results.property.mark.edited, false, 'a situation’s own property is its default, not the reader’s edit');

// 7. Choosing on the Scenario screen saves a named entry and touches no other row.
assert.equal(results.scenarioCards, 6);
assert.deepEqual(results.libraryAfterFirst.map(r => r.salary), ['£88,000']);
// The table heading is uppercased by CSS, and `innerText` reports what is rendered.
assert.match(results.libraryAfterFirst[0].name, /50s, pension-heavy, FIRE soon/i);
assert.match(results.libraryAfterFirst[0].name, /starter:fifties-pension-heavy/i);
assert.deepEqual(results.scenarioRunning, { progress: 0, running: 0, probability: 0 });
assert.equal(results.libraryAfterSecond.length, 2);
assert.deepEqual(results.libraryAfterSecond[0], results.libraryAfterFirst[0],
  'saving a second starter must not rewrite the first');
assert.deepEqual(results.libraryAfterSecond.map(r => r.salary), ['£88,000', '£82,000']);
assert.equal(results.afterScenarioChoice.salary, '82,000');
assert.equal(results.afterScenarioChoice.edited, 0);
assert.match(results.afterScenarioChoice.footnote ?? '', /Contractor, no employer pension/);
assert.match(results.libraryAfterSecond[1].name, /Contractor, no employer pension/i);

// 8. Reversible.
assert.equal(results.backToExample.salary, '55,000');
assert.equal(results.backToExample.age, '31');
assert.equal(results.backToExample.edited, 0);
assert.match(results.backToExample.footnote ?? '', /The worked example/);

// 9. Eight destinations.
assert.equal(results.tabs.length, 8, `saw ${results.tabs.length} tabs: ${results.tabs.join(' | ')}`);

// 10. Mobile: one column, no horizontal scroll, every caveat still on screen.
assert.equal(results.mobile.overflow, 0, `mobile overflowed by ${results.mobile.overflow}px`);
assert.equal(results.mobile.cards, 6);
assert.equal(results.mobile.caveats, 6, 'the caveat is not what gets dropped when space is short');
assert.ok(results.mobile.cardWidth <= 390 - 32, `a card is ${results.mobile.cardWidth}px wide inside a 390px screen`);
assert.equal(results.mobileAfterChoose.overflow, 0);
assert.equal(results.mobileAfterChoose.age, '28');

assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux9-ui-results.json', JSON.stringify({ ...results, errors }, null, 2));
console.log('UX-9 browser acceptance: PASS');
finished = true; ws.close();
