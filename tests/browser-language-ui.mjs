/** Manual Chrome/CDP acceptance test for UX-3 (plain-language layer).
 *
 * Start `npm run dev -- --port 5176 --strictPort` and a dedicated headless Chrome with
 * --remote-debugging-port=9226 --user-data-dir=/tmp/capital-ux3-chrome, then run with Node 24:
 * node tests/browser-language-ui.mjs. Override APP_PORT / CDP_PORT to use another pair.
 * Outputs JSON and PNGs into /tmp.
 *
 * What it proves:
 *  - a jargon label is replaced by its plain form with the technical term kept once, and the plain
 *    sentence is rendered above the modelling convention rather than instead of it;
 *  - glossary terms open, are readable, cross-link, and close on Escape — at 1440px and at 390px,
 *    where the panel has to leave the word and pin itself to the viewport;
 *  - every one of the eight destinations carries its own result vocabulary;
 *  - two invalid states read as sentences, on both render paths: a field's own error and a group's
 *    cross-field rule;
 *  - a household spending override announces itself on Overview instead of silently contradicting
 *    the spending the reader entered;
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
const settle = () => new Promise(r => setTimeout(r, 220));
const nav = async (path) => { await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}` + path }); await wait('document.readyState === "complete"'); };
const write = async (selector, value) => { await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
const set = (fieldId, value) => write('#' + fieldId.replaceAll('.', '\\.'), value);
const shot = async (name) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };
const filter = async (label) => { await ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!l)throw Error('Missing filter '+${JSON.stringify(label)});l.querySelector('input').click();})()`); await settle(); };
const sel = fieldId => '#' + fieldId.replaceAll('.', '\\.');

/** The label, plain sentence and precise sentence a numeric field shows, in DOM order. */
const fieldText = fieldId => ev(`(()=>{const f=document.querySelector(${JSON.stringify(sel(fieldId))}).closest('.field');
  return {label:f.querySelector('label').textContent.replace(/\\s+/g,' ').trim(),
    plain:f.querySelector('.field-plain')?.textContent.trim()??null,
    help:f.querySelector('.field-help')?.textContent.trim()??null,
    order:[...f.querySelectorAll('.field-plain, .field-help')].map(e=>e.className),
    error:f.querySelector('.field-error')?.textContent.trim()??null,
    terms:[...f.querySelectorAll('.glossary-term')].map(e=>e.textContent.trim())};})()`);

/** Open the first glossary term whose visible text starts with `prefix`, and report the panel. */
const openTerm = async prefix => {
  await ev(`(()=>{const b=[...document.querySelectorAll('.glossary-term')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(prefix)}));
    if(!b)throw Error('No glossary term '+${JSON.stringify(prefix)});b.scrollIntoView({block:'center'});b.click();})()`);
  await settle();
  return ev(`(()=>{const p=document.querySelector('.glossary-panel');if(!p)return null;const r=p.getBoundingClientRect();
    return {title:p.querySelector('.glossary-panel-title').textContent.trim(),
      body:p.querySelector('.glossary-panel-body').textContent.trim(),
      seeAlso:[...p.querySelectorAll('.glossary-see-also button')].map(e=>e.textContent.trim()),
      left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),viewport:innerWidth};})()`);
};
const escape = async () => { await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await settle(); };
const panelOpen = () => ev(`!!document.querySelector('.glossary-panel')`);
const screenTerms = () => ev(`[...document.querySelectorAll('.glossary-bar .glossary-row .glossary-term')].map(e=>e.textContent.trim())`);
const groupIssues = group => ev(`(()=>{const d=[...document.querySelectorAll('details.group')].find(e=>e.textContent.includes(${JSON.stringify(group)}));
  return d?[...d.querySelectorAll('.field-error')].map(e=>e.textContent.replace(/\\s+/g,' ').trim()):[];})()`);
const overflow = () => ev('document.documentElement.scrollWidth-innerWidth');
const lineValue = label => ev(`(()=>{const d=[...document.querySelectorAll('.line')].find(e=>e.querySelector('dt')?.textContent.trim()===${JSON.stringify(label)});return d?d.querySelector('dd').textContent.trim():null})()`);

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
const results = {};

await nav('/');
await ev('document.getElementById("tab-overview").click()');
await settle();
await wait('!!document.getElementById("personal.currentAge")');

// 1. A jargon label is replaced, and the plain sentence comes before the modelling convention.
results.fireAge = await fieldText('personal.targetFireAge');
results.salary = await fieldText('income.salaryAnnual');
results.isa = await fieldText('assets.isa');
results.plainCount = await ev(`document.querySelectorAll('details.group .field-plain').length`);
results.visibleInputs = await ev(`document.querySelectorAll('details.group input, details.group select').length`);
await shot('ux3-overview-default-desktop');

// 2. A glossary term opens, reads, cross-links and closes.
results.termsOnFireAge = results.fireAge.terms;
results.firePanel = await openTerm('Financial independence');
results.crossLinked = await ev(`(()=>{const b=[...document.querySelectorAll('.glossary-panel .glossary-see-also button')][0];
  if(!b)throw Error('No see-also');b.click();return true})()`);
await settle();
results.afterCrossLink = await ev(`document.querySelector('.glossary-panel .glossary-panel-title').textContent.trim()`);
await escape();
results.closedByEscape = !(await panelOpen());
await shot('ux3-glossary-desktop');

// 3. Every destination names its own result vocabulary, and stays reachable.
results.screenTerms = {};
for (const tab of ['overview', 'fire', 'curve', 'marginal', 'solver', 'scenarios', 'property', 'attribution']) {
  await ev(`document.getElementById("tab-${tab}").click()`);
  await settle();
  results.screenTerms[tab] = await screenTerms();
}
results.allTermsPanel = await ev(`(()=>{const d=document.querySelector('details.glossary-all');d.open=true;
  return {summary:d.querySelector('summary').textContent.trim(),count:d.querySelectorAll('dt').length};})()`);
await ev(`document.querySelector('details.glossary-all').open=false;document.getElementById("tab-overview").click()`);
await wait('!!document.getElementById("personal.currentAge")');

// 4a. A blank box: the field's own error path.
await set('personal.currentAge', '');
await wait(`document.body.innerText.includes('needs a number')`);
results.blankAge = await fieldText('personal.currentAge');
results.blockedBanner = await ev(`document.body.innerText.includes('Fix the inputs before the model can run')`);
await shot('ux3-plain-error-desktop');
await set('personal.currentAge', '40');
await wait(`!document.body.innerText.includes('needs a number')`);

// 4b. Ages out of order: the group cross-field path, which belongs to no single input.
await set('personal.targetFireAge', '30');
await wait(`document.body.innerText.includes('have to run in order')`);
results.ageOrder = await groupIssues('Personal & target');
results.overviewCrossField = await ev(`(()=>{const b=[...document.querySelectorAll('.banner')].find(e=>e.textContent.includes('run in order'));return b?b.textContent.replace(/\\s+/g,' ').trim():null})()`);
await set('personal.targetFireAge', '55');
await wait(`!document.body.innerText.includes('have to run in order')`);
results.schemaWordingGone = await ev(`!document.body.innerText.includes('Require currentAge')&&!document.body.innerText.includes('expected number, received NaN')`);

// 5. A spending override announces itself rather than silently contradicting the form.
results.spendingBefore = {
  essential: await lineValue('Essential spending'),
  discretionary: await lineValue('Discretionary spending'),
  note: await ev(`document.body.innerText.includes('not the amounts entered above')`),
};
await ev(`document.getElementById('tab-fire').click()`);
await wait('!!document.getElementById("household-override")');
await write('#household-override', '500');
await ev(`document.getElementById('tab-overview').click()`);
await wait('!!document.getElementById("personal.currentAge")');
results.spendingOverridden = {
  essential: await lineValue('Essential spending'),
  discretionary: await lineValue('Discretionary spending'),
  note: await ev(`(()=>{const p=[...document.querySelectorAll('p')].find(e=>e.textContent.includes('not the amounts entered above'));return p?p.textContent.replace(/\\s+/g,' ').trim():null})()`),
};
await shot('ux3-spending-override-desktop');
await ev(`document.getElementById('tab-fire').click()`);
await wait('!!document.getElementById("household-override")');
await write('#household-override', '');
await ev(`document.getElementById('tab-overview').click()`);
await wait('!!document.getElementById("personal.currentAge")');
results.spendingRestored = {
  essential: await lineValue('Essential spending'),
  discretionary: await lineValue('Discretionary spending'),
  note: await ev(`document.body.innerText.includes('not the amounts entered above')`),
};

// 6. Desktop overflow, then the whole thing at phone width.
results.desktopOverflow = await overflow();
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev(`window.scrollTo(0,0)`);
await settle();
results.mobileOverflowDefault = await overflow();
results.mobilePanel = await openTerm('Financial independence');
results.mobileOverflowWithPanel = await overflow();
await shot('ux3-glossary-mobile');
await escape();
await filter('Everything');
results.mobileOverflowEverything = await overflow();
results.mobilePanelExpert = await openTerm('Correlation');
await escape();
await filter('Essential + common');
await shot('ux3-overview-mobile');

console.log('FIRE age field:', JSON.stringify(results.fireAge, null, 1));
console.log('plain sentences on the default form:', results.plainCount, 'of', results.visibleInputs, 'inputs');
console.log('glossary panel:', JSON.stringify(results.firePanel, null, 1));
console.log('screen terms:', JSON.stringify(results.screenTerms, null, 1));
console.log('blank-age error:', results.blankAge.error);
console.log('age-order issue:', results.ageOrder);
console.log('override:', JSON.stringify(results.spendingOverridden, null, 1));
console.log('overflow desktop/mobile/mobile+panel/everything:',
  results.desktopOverflow, results.mobileOverflowDefault, results.mobileOverflowWithPanel, results.mobileOverflowEverything);

// — the label ladder —
assert.equal(results.fireAge.label, 'Age you want to stop needing a salary (target FIRE age)');
assert.ok(results.fireAge.plain?.startsWith('The age from which the plan stops assuming you earn'));
assert.ok(results.fireAge.help?.startsWith('Retirement starts here'), 'the precise sentence must survive');
assert.deepEqual(results.fireAge.order, ['field-plain', 'field-help'], 'plain first, convention second');
assert.equal(results.salary.label, 'Gross salary (£)', 'a label that is already plain is left alone');
assert.ok(results.salary.plain?.includes('before tax'));
assert.equal(results.isa.label, 'ISA savings and investments (£)');
assert.ok(results.plainCount >= 25, `only ${results.plainCount} plain sentences on the default form`);

// — the glossary —
assert.deepEqual(results.termsOnFireAge, ['Financial independence (FIRE — financial independence, retire early)', 'The bridge period']);
assert.equal(results.firePanel.title, 'Financial independence (FIRE — financial independence, retire early)');
assert.ok(results.firePanel.body.length > 100, 'a definition, not a caption');
assert.ok(results.firePanel.seeAlso.length >= 1);
assert.ok(results.firePanel.left >= 0 && results.firePanel.right <= results.firePanel.viewport, 'panel must stay on screen');
assert.equal(results.crossLinked, true);
assert.equal(results.afterCrossLink, 'The bridge period', 'a cross-reference swaps the definition in place');
assert.equal(results.closedByEscape, true, 'Escape must close the panel');
assert.equal(results.allTermsPanel.summary, 'All 25 terms');
assert.equal(results.allTermsPanel.count, 25);
for (const [tab, terms] of Object.entries(results.screenTerms)) {
  assert.ok(terms.length > 0, `${tab} shows no result vocabulary`);
}
assert.ok(results.screenTerms.fire.some(t => t.startsWith('Success probability')));
assert.ok(results.screenTerms.marginal.some(t => t.startsWith('ISA')));
assert.notDeepEqual(results.screenTerms.overview, results.screenTerms.fire, 'each screen names its own words');

// — the messages —
assert.equal(results.blankAge.error, 'Current age needs a number. The box is empty or holds something that is not one, and nothing is assumed on your behalf — the model waits rather than quietly using the previous value.');
assert.equal(results.blockedBanner, true, 'a plain message must not stop the plan being blocked');
assert.equal(results.ageOrder.length, 1);
assert.ok(results.ageOrder[0].startsWith('These three ages have to run in order'));
assert.ok(results.overviewCrossField?.includes('have to run in order'), 'the Overview banner uses the same wording');
assert.equal(results.schemaWordingGone, true, 'no schema phrasing may reach the screen');

// — the override —
// The starter spends £1,300 + £350 a month, so this is its own schedule, untouched.
assert.deepEqual(results.spendingBefore, { essential: '£15,600', discretionary: '£4,200', note: false });
assert.equal(results.spendingOverridden.essential, '£6,000');
assert.equal(results.spendingOverridden.discretionary, '£0');
assert.ok(results.spendingOverridden.note?.includes('£500 a month'));
assert.ok(results.spendingOverridden.note?.includes('FIRE & Monte Carlo screen'));
assert.deepEqual(results.spendingRestored, { essential: '£15,600', discretionary: '£4,200', note: false });

// — widths —
assert.equal(results.desktopOverflow, 0);
assert.equal(results.mobileOverflowDefault, 0);
assert.equal(results.mobileOverflowWithPanel, 0, 'the popover must not widen the page on a phone');
assert.equal(results.mobileOverflowEverything, 0);
for (const panel of [results.mobilePanel, results.mobilePanelExpert]) {
  assert.ok(panel, 'the popover must open at 390px');
  assert.ok(panel.left >= 8, `panel left ${panel.left}`);
  assert.ok(panel.right <= panel.viewport - 8, `panel right ${panel.right} of ${panel.viewport}`);
  assert.ok(panel.width >= 200, `panel too narrow to read: ${panel.width}px`);
}
assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux3-ui-results.json', JSON.stringify({ ...results, errors }, null, 2));
console.log('UX-3 browser acceptance: PASS');
finished = true; ws.close();
