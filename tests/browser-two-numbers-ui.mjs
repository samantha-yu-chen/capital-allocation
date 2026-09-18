/** Manual Chrome/CDP acceptance test for UX-7 (one story for the two success numbers).
 *
 * Checks the shared explanation on all five surfaces that show the reference FIRE number, that its
 * wording follows the profile's own withdrawal rate, and that it never appears beside a probability
 * that was invalidated or cancelled.
 *
 * Start Vite on APP_PORT and isolated Chrome on CDP_PORT, then run with Node 24.
 * Writes results and desktop/mobile screenshots to /tmp.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const appPort = process.env.APP_PORT ?? '5178';
const cdpPort = process.env.CDP_PORT ?? '9229';
const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let id = 0; const pending = new Map(); const errors = []; let finished = false;
ws.onclose = () => { if (!finished) { console.error('CDP CONNECTION CLOSED'); process.exit(1); } };
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const promise = pending.get(message.id); pending.delete(message.id);
    message.error ? promise.reject(message.error) : promise.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
};
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const request = ++id; pending.set(request, { resolve, reject });
  ws.send(JSON.stringify({ id: request, method, params }));
});
const ev = async expression => {
  const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
};
const wait = async (expression, limit = 600000) => {
  const started = Date.now();
  while (Date.now() - started < limit) {
    if (await ev(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('Timeout: ' + expression);
};
const settle = () => new Promise(resolve => setTimeout(resolve, 250));
const click = async text => {
  await ev(`(()=>{const e=[...document.querySelectorAll('button,label')].find(e=>e.textContent.replace(/\\s+/g,' ').trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.click();})()`);
  await settle();
};
const set = async (fieldId, value) => {
  await ev(`(()=>{const e=document.getElementById(${JSON.stringify(fieldId)});if(!e)throw Error('Missing '+${JSON.stringify(fieldId)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await settle();
};
const choose = async (label, value) => {
  await ev(`(()=>{const e=[...document.querySelectorAll('select')].find(s=>s.labels?.[0]?.textContent.replace(/\\s+/g,' ').trim().startsWith(${JSON.stringify(label)}));if(!e)throw Error('Missing select '+${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await settle();
};
const tab = async name => { await ev(`document.getElementById("tab-${name}").click()`); await settle(); };
const shot = async name => {
  const image = await cdp('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`/tmp/${name}.png`, Buffer.from(image.data, 'base64'));
};
const body = () => ev('document.body.innerText');
/** The full explanation, as the reader sees it, with whitespace normalised. */
const story = () => ev('[...document.querySelectorAll(\'[data-two-numbers="full"]\')].map(e=>e.innerText.replace(/\\s+/g," ").trim())');
const notes = () => ev('[...document.querySelectorAll(\'[data-two-numbers="note"]\')].map(e=>e.innerText.replace(/\\s+/g," ").trim())');
const smoke = async suffix => {
  await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/tests/browser-worker-smoke.html${suffix}` });
  await wait('document.querySelector("#result")?.textContent.trim().startsWith("{")', 180000);
  return JSON.parse(await ev('document.querySelector("#result").textContent'));
};

const AUTHORITY = 'the number your target is judged against';
const step = name => console.log(`[step] ${name} ${new Date().toISOString()}`);

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
step('worker smoke');
const smokeBaseline = await smoke('');
const smokeProperty = await smoke('?property');
const results = { errors, smokeBaseline, smokeProperty };

step('Overview: the reference card carries the whole story');
// ---- Overview: the reference card carries the whole story ---------------------------------------
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await wait('document.readyState === "complete" && !!document.querySelector(".start-here-button")');
await ev('localStorage.setItem("capital-allocation:start-here-dismissed:v1","true");location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".headline-card")');
results.overview = { stories: await story(), notes: await notes() };
await shot('ux7-overview-desktop');

step("The rate in the sentence is the profile's own, not a hard-coded 4%");
// ---- The rate in the sentence is the profile's own, not a hard-coded 4% -------------------------
await tab('fire');
await wait('!!document.getElementById("simulation.referenceWithdrawalRate")');
results.fireDefault = { stories: await story() };
await set('simulation.referenceWithdrawalRate', '4.25');
await tab('overview');
results.overviewRetuned = { stories: await story() };
await tab('fire');
await set('simulation.referenceWithdrawalRate', '3.5');
await settle();

step('FIRE: both numbers on screen at once, and never beside a discarded run');
// ---- FIRE: both numbers on screen at once, and never beside a discarded run ---------------------
await click('Run 10,000 paths');
await wait('document.body.innerText.includes("Completed in")', 600000);
results.fireWithProbability = {
  stories: await story(),
  probabilityText: await ev('document.querySelector(".stat-hero")?.innerText.trim() ?? null'),
};
await shot('ux7-fire-desktop');

// A profile edit discards the probability; the landmark and its caveat stay, because the reference
// number is arithmetic on the current profile and was never a run result.
await tab('overview');
await set('income.salaryAnnual', 56_000);
await tab('fire');
results.fireInvalidated = {
  stories: (await story()).length,
  discarded: (await body()).includes('Inputs changed'),
  noProbability: !(await body()).includes('Completed in'),
};
await tab('overview');
await set('income.salaryAnnual', 55_000);
await tab('fire');

// A cancelled run publishes nothing next to the landmark either.
await click('Run 10,000 paths');
await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow")) > 0', 120000);
results.progressSeen = true;
await click('Cancel');
await wait('document.body.innerText.includes("Run cancelled")');
results.fireCancelled = {
  stories: (await story()).length,
  noProbability: !(await body()).includes('Completed in'),
};

step('Curve: the short caveat sits under the reference figure');
// ---- Curve: the short caveat sits under the reference figure ------------------------------------
await tab('curve');
await wait('!!document.getElementById("curve.fromAge")');
const fromAge = await ev('Number(document.getElementById("curve.fromAge").value)');
await set('curve.toAge', String(fromAge + 1));
await click(`Compute 2 ages`);
await wait('document.body.innerText.includes("Completed in")', 900000);
results.curve = { stories: await story(), notes: await notes() };
await shot('ux7-curve-desktop');

step('Wizard step 5: the two numbers are introduced where a first-timer meets them');
// ---- Wizard step 5: the two numbers are introduced where a first-timer meets them ---------------
await ev('localStorage.removeItem("capital-allocation:start-here-dismissed:v1");location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".wizard-shell")');
for (let step = 0; step < 4; step += 1) await click('Continue');
// Card kickers render uppercase, so the reader-facing text is matched on the component's own
// handle rather than on a label CSS has transformed.
await wait('!!document.querySelector(\'[data-two-numbers="full"]\') && document.body.innerText.includes("REFERENCE FIRE NUMBER")');
results.wizard = { stories: await story(), notes: await notes() };
await shot('ux7-wizard-desktop');

step('Mobile: the two-column explanation stacks and nothing overflows');
// ---- Mobile: the two-column explanation stacks and nothing overflows ----------------------------
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev('window.scrollTo(0,0)'); await settle();
results.mobile = {
  overflow: await ev('document.documentElement.scrollWidth - innerWidth'),
  tabs: await ev('document.querySelectorAll("[role=tab]").length'),
  columns: await ev('getComputedStyle(document.querySelector(".two-numbers-parts")).gridTemplateColumns'),
  stories: (await story()).length,
};
await shot('ux7-wizard-mobile');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await ev('localStorage.setItem("capital-allocation:start-here-dismissed:v1","true");location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".headline-card")');

step('Scenarios: the spending table names the reference number, so it carries the caveat');
// ---- Scenarios: the spending table names the reference number, so it carries the caveat ---------
await tab('scenarios');
await wait('!!document.getElementById("scenario.name")');
await choose('What to compare', 'spending');
await click('Run comparison');
await wait('!!document.querySelector("[data-testid=spending-effects]")', 1_200_000);
results.scenarios = {
  stories: (await story()).length,
  notes: await notes(),
  spendingRows: await ev('document.querySelectorAll("[data-testid=spending-effects] tbody tr").length'),
};
await shot('ux7-scenarios-desktop');

step('Assertions');
// ---- Assertions ---------------------------------------------------------------------------------
assert.deepEqual([smokeBaseline.passed, smokeBaseline.count, smokeBaseline.success], [true, 10_000, 0.6898]);
assert.deepEqual([smokeProperty.passed, smokeProperty.count, smokeProperty.success], [true, 10_000, 0.3518]);

// Overview shows the full story exactly once, with the profile's 3.50% rate and 10,000 paths in it.
assert.equal(results.overview.stories.length, 1);
assert.match(results.overview.stories[0], /Which of these two numbers says whether my plan works\?/);
assert.match(results.overview.stories[0], /÷ 3\.50%/);
assert.match(results.overview.stories[0], /10,000 times/);
assert.ok(results.overview.stories[0].includes(AUTHORITY));
assert.ok(!results.overview.stories[0].includes('4.00%'), 'the rate must be the reader’s, never a hard-coded 4%');

// Retuning the rate retunes the sentence: the wording is view data, not a fixed string.
assert.equal(results.overviewRetuned.stories.length, 1);
assert.match(results.overviewRetuned.stories[0], /÷ 4\.25%/);
assert.ok(!results.overviewRetuned.stories[0].includes('3.50%'));

// FIRE: the landmark and the verdict are on screen together, and the story survives neither a
// discarded nor a cancelled run being removed — because it describes the arithmetic, not a result.
assert.equal(results.fireDefault.stories.length, 1);
assert.equal(results.fireWithProbability.stories.length, 1);
assert.match(results.fireWithProbability.probabilityText ?? '', /^\d+\.\d+%$/);
assert.deepEqual(results.fireInvalidated, { stories: 1, discarded: true, noProbability: true });
assert.deepEqual(results.fireCancelled, { stories: 1, noProbability: true });
assert.equal(results.progressSeen, true);

// Curve and scenarios use the one-line form beside a figure that already has the probability above it.
assert.equal(results.curve.stories.length, 0, 'the curve screen uses the short caveat, not the full story');
assert.equal(results.curve.notes.length, 1);
assert.ok(results.curve.notes[0].includes(AUTHORITY));
assert.match(results.curve.notes[0], /^3\.50% arithmetic, so a landmark and not the safety result/);
assert.equal(results.scenarios.notes.length, 1);
assert.ok(results.scenarios.notes[0].includes(AUTHORITY));
assert.equal(results.scenarios.stories, 0);
assert.equal(results.scenarios.spendingRows, 3);

// The wizard introduces the two numbers in full at the step that first shows both.
assert.equal(results.wizard.stories.length, 1);
assert.match(results.wizard.stories[0], /÷ 3\.50%/);
assert.ok(results.wizard.stories[0].includes(AUTHORITY));

assert.equal(results.mobile.overflow, 0);
assert.equal(results.mobile.tabs, 8);
assert.equal(results.mobile.columns.split(' ').length, 1, 'the two parts stack to one column on a phone');
assert.equal(results.mobile.stories, 1);
assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux7-ui-results.json', JSON.stringify(results, null, 2));
console.log('UX-7 browser acceptance passed:', JSON.stringify(results, null, 2));
finished = true; ws.close();
