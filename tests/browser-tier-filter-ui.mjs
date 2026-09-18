/** Manual Chrome/CDP acceptance test for UX-1 (field tiering).
 *
 * Start `npm run dev -- --port 5176 --strictPort` and a dedicated headless Chrome with
 * --remote-debugging-port=9226 --user-data-dir=/tmp/capital-ux1-chrome, then run with Node 24:
 * node tests/browser-tier-filter-ui.mjs. Override APP_PORT / CDP_PORT to use another pair.
 * Outputs JSON and PNGs into /tmp.
 *
 * What it proves:
 *  - the default view is small enough to read, and Essential only is exactly the recorded set;
 *  - switching the filter changes no figure the model produced, and hidden values survive;
 *  - a profile made invalid in an expert field (a non-positive-semidefinite correlation matrix)
 *    surfaces that editor and its message even in Essential only — validation is never maskable;
 *  - desktop and mobile widths render without horizontal overflow.
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
const write = async (selector, value) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); };
const set = (fieldId, value) => write('#' + fieldId.replaceAll('.', '\\.'), value);
/** The correlation cells are labelled rather than identified: the matrix is one composite editor. */
const setCell = (label, value) => write(`[aria-label="${label}"]`, value);
const shot = async (name) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };

/** Pick the tier radio by its visible label. */
const filter = async (label) => {
  await ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!l)throw Error('Missing filter '+${JSON.stringify(label)});l.querySelector('input').click();})()`);
  await new Promise(r => setTimeout(r, 200));
};
/** Every rendered profile input, whatever the group's open/closed state. */
const inputs = () => ev(`[...document.querySelectorAll('details.group input, details.group select')].map(e=>e.tagName==='SELECT'?'select':(e.id||e.getAttribute('aria-label')||e.type))`);
const groups = () => ev(`[...document.querySelectorAll('details.group > summary')].map(e=>e.textContent.replace('needs attention','').trim())`);
const netWorth = () => ev(`(()=>{const d=[...document.querySelectorAll('.line')].find(e=>e.textContent.includes('Net worth'));return d?d.querySelector('dd').textContent.trim():null})()`);

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
const results = {};

await nav('/');
await ev('document.getElementById("tab-overview").click()');
await new Promise(r => setTimeout(r, 220));
await wait('!!document.getElementById("personal.currentAge")');

// 1. The default is Essential + common and it is a readable form.
results.defaultChecked = await ev(`[...document.querySelectorAll('input[name=profile-tier]')].find(e=>e.checked)?.closest('label').textContent.trim()`);
results.defaultInputs = await inputs();
results.defaultGroups = await groups();
results.baselineNetWorth = await netWorth();
await shot('ux1-overview-default-desktop');

// 2. Essential only is exactly the recorded set.
await filter('Essential only');
results.essentialInputs = await inputs();
results.essentialGroups = await groups();
results.essentialNetWorth = await netWorth();
await shot('ux1-overview-essential-desktop');

// 3. Everything restores the full surface, and the stored values were never touched.
await filter('Everything');
results.allInputs = await inputs();
results.allGroups = await groups();
results.allNetWorth = await netWorth();
results.hiddenValuesKept = await ev(`({equities:document.getElementById('market.equities.meanNominal').value,seed:document.getElementById('simulation.seed').value,isaEquities:document.getElementById('portfolios.isa.equities').value})`);

// 4. Break an expert-tier input: a correlation matrix that is not could actually exist together.
await ev(`document.querySelectorAll('details.group').forEach(e=>e.open=true)`);
await setCell('equities / bonds log-shock correlation', '0.9');
await setCell('equities / cash log-shock correlation', '0.9');
await setCell('bonds / cash log-shock correlation', '-0.9');
await wait(`document.body.innerText.includes('could actually exist together')`);
results.errorAtEverything = true;

// 5. ...and it must still be visible, with its message, in Essential only.
await filter('Essential only');
results.essentialWithError = {
  inputs: await inputs(),
  groups: await groups(),
  matrixVisible: await ev(`!!document.querySelector('table.matrix')`),
  cellVisible: await ev(`!!document.querySelector('[aria-label="equities / bonds log-shock correlation"]')`),
  message: await ev(`(()=>{const e=[...document.querySelectorAll('.field-error')].find(e=>e.textContent.includes('could actually exist together'));return e?e.textContent.trim():null})()`),
  marketOpen: await ev(`!!document.querySelector('details.group')&&[...document.querySelectorAll('details.group')].some(e=>e.open&&e.textContent.includes('Market assumptions'))`),
  blocked: await ev(`document.body.innerText.includes('Fix the inputs before the model can run')`),
};
await shot('ux1-overview-essential-error-desktop');

// Repair it and confirm the group disappears again at the same filter setting.
await filter('Everything');
await setCell('equities / bonds log-shock correlation', '0');
await setCell('equities / cash log-shock correlation', '0');
await setCell('bonds / cash log-shock correlation', '0');
await wait(`!document.body.innerText.includes('could actually exist together')`);
await filter('Essential only');
results.repairedGroups = await groups();
await filter('Essential + common');
results.restoredNetWorth = await netWorth();

// 6. Screens that render a targeted group are unfiltered: the FIRE tab still offers the simulation inputs.
await ev(`document.getElementById('tab-fire').click()`);
await wait('!!document.getElementById("simulation.count")');
results.fireSimulationInputs = await ev(`[...document.querySelectorAll('details.group input')].map(e=>e.id)`);
results.fireHasFilter = await ev(`!!document.querySelector('input[name=profile-tier]')`);
await ev(`document.getElementById('tab-property').click()`);
await wait(`document.body.innerText.includes('Include a property')`);
results.propertyHasFilter = await ev(`!!document.querySelector('input[name=profile-tier]')`);
await ev(`document.getElementById('tab-overview').click()`);
await wait('!!document.getElementById("personal.currentAge")');

// 7. Mobile.
for (const [tab, label] of [['overview', 'Essential only'], ['overview', 'Essential + common'], ['overview', 'Everything']]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await ev(`document.getElementById("tab-${tab}").click();window.scrollTo(0,0)`);
  await filter(label);
  await new Promise(r => setTimeout(r, 250));
  results['mobileOverflow:' + label] = await ev('document.documentElement.scrollWidth-innerWidth');
  await shot('ux1-overview-mobile-' + label.replace(/\W+/g, '-').toLowerCase());
}

const ESSENTIAL = [
  'personal.currentAge', 'personal.targetFireAge', 'income.salaryAnnual',
  'spending.current.essentialMonthly', 'spending.current.discretionaryMonthly',
  'spending.retirement.essentialMonthly', 'spending.retirement.discretionaryMonthly',
  'assets.cash', 'assets.isa', 'assets.pension', 'pension.employeeRate', 'pension.employerRate',
];

console.log('default filter:', results.defaultChecked);
console.log('inputs  essential/default/all:', results.essentialInputs.length, results.defaultInputs.length, results.allInputs.length);
console.log('groups  essential:', results.essentialGroups.join(' | '));
console.log('groups  default  :', results.defaultGroups.join(' | '));
console.log('error in Essential only:', JSON.stringify(results.essentialWithError, null, 1));
console.log('mobile overflow:', Object.entries(results).filter(([k]) => k.startsWith('mobileOverflow')));

assert.equal(results.defaultChecked, 'Essential + common');
assert.ok(results.defaultInputs.length <= 40, `default view renders ${results.defaultInputs.length} inputs`);
assert.ok(results.defaultInputs.length < results.allInputs.length);
// The essential view is exactly the recorded numeric set plus the tax-region select.
assert.deepEqual(results.essentialInputs.filter(i => i !== 'select').sort(), [...ESSENTIAL].sort());
assert.equal(results.essentialInputs.filter(i => i === 'select').length, 1, 'tax region is the one essential select');
// Groups with nothing to show are gone; the full view has them all back.
for (const hidden of ['Household', 'ISA & GIA behaviour', 'Portfolios by wrapper', 'Market assumptions', 'Simulation']) {
  assert.ok(!results.defaultGroups.includes(hidden), `${hidden} should be hidden by default`);
  assert.ok(results.allGroups.includes(hidden), `${hidden} should return at Everything`);
}
assert.ok(results.essentialGroups.includes('Personal & target'));
assert.ok(!results.essentialGroups.includes('Liquidity & known capital needs'));
// Filtering changed no figure the model produced, and no stored value.
assert.equal(results.essentialNetWorth, results.baselineNetWorth);
assert.equal(results.allNetWorth, results.baselineNetWorth);
assert.equal(results.restoredNetWorth, results.baselineNetWorth);
assert.deepEqual(results.hiddenValuesKept, { equities: '7', seed: '421337', isaEquities: '85' });
// An expert-field error is unmaskable.
assert.equal(results.essentialWithError.matrixVisible, true);
assert.equal(results.essentialWithError.cellVisible, true);
assert.ok(results.essentialWithError.message?.includes('could actually exist together'));
assert.equal(results.essentialWithError.marketOpen, true);
assert.equal(results.essentialWithError.blocked, true);
assert.ok(results.essentialWithError.groups.includes('Market assumptions'));
// ...and only that group came back: the rest of the expert surface stayed hidden.
assert.ok(!results.essentialWithError.groups.includes('Simulation'));
assert.ok(!results.repairedGroups.includes('Market assumptions'), 'the group goes away again once it is valid');
// Targeted single-group forms are never filtered.
assert.ok(results.fireSimulationInputs.includes('simulation.count'));
assert.ok(results.fireSimulationInputs.includes('simulation.seed'));
assert.equal(results.fireHasFilter, false);
assert.equal(results.propertyHasFilter, false);
for (const [key, value] of Object.entries(results)) {
  if (key.startsWith('mobileOverflow')) assert.equal(value, 0, `${key} overflowed by ${value}px`);
}
assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux1-ui-results.json', JSON.stringify({ ...results, errors }, null, 2));
console.log('UX-1 browser acceptance: PASS');
finished = true; ws.close();
