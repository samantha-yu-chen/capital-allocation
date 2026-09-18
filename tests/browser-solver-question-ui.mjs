/** Manual Chrome/CDP acceptance test for UX-6 (question-first Reverse Solver).
 *
 * Start Vite on APP_PORT and isolated Chrome on CDP_PORT, then run with Node 24. It checks the two
 * worker smoke variants, the Overview "what would it take?" route into the solver — which must
 * pre-select the salary question and start nothing — the plain answer sentence at the configured
 * path count, and the responsive layout of the question picker.
 * Writes results and screenshots to /tmp.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const appPort = process.env.APP_PORT ?? '5176';
const cdpPort = process.env.CDP_PORT ?? '9226';
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
const wait = async (expression, limit = 900000) => {
  const started = Date.now();
  while (Date.now() - started < limit) {
    if (await ev(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw Error('Timeout: ' + expression);
};
const settle = () => new Promise(resolve => setTimeout(resolve, 250));
const click = async text => {
  await ev(`(()=>{const b=[...document.querySelectorAll('button,label')].find(e=>e.textContent.replace(/\\s+/g,' ').trim()===${JSON.stringify(text)});if(!b)throw Error('Missing control '+${JSON.stringify(text)});b.click();})()`);
  await settle();
};
const set = async (fieldId, value) => {
  await ev(`(()=>{const e=document.getElementById(${JSON.stringify(fieldId)});if(!e)throw Error('Missing '+${JSON.stringify(fieldId)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await settle();
};
const shot = async name => {
  const image = await cdp('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`/tmp/${name}.png`, Buffer.from(image.data, 'base64'));
};
const body = () => ev('document.body.innerText');
const asked = () => ev('document.querySelector(\'[role="radio"][aria-checked="true"]\')?.dataset.question ?? null');
const activeTab = () => ev('document.querySelector(\'[role=tab][aria-selected="true"]\')?.id ?? null');
const smoke = async suffix => {
  await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/tests/browser-worker-smoke.html${suffix}` });
  await wait('document.querySelector("#result")?.textContent.trim().startsWith("{")', 180000);
  return JSON.parse(await ev('document.querySelector("#result").textContent'));
};

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
const smokeBaseline = await smoke('');
const smokeProperty = await smoke('?property');
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await wait('document.readyState === "complete" && !!document.querySelector(".start-here-button")');
await ev('localStorage.setItem("capital-allocation:start-here-dismissed:v1","true");location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".headline-card")');

const results = { errors, smokeBaseline, smokeProperty };

// ── The offer appears only once a completed run has measured a shortfall ────────────────────────
results.offerBeforeRun = await ev('document.querySelectorAll(".headline-solve").length');
await click('Run 10,000 simulated futures');
await wait('document.querySelectorAll(".headline-source").length === 1');
results.offerAfterRun = await ev('document.querySelector(".headline-solve")?.textContent ?? null');
await shot('ux6-overview-offer-desktop');

// ── Following it pre-selects the salary question and starts nothing ─────────────────────────────
await click(results.offerAfterRun);
results.landedOn = await activeTab();
results.preselected = await asked();
const landedText = await body();
results.noAutoRun = {
  idleCard: landedText.includes('Nothing is shown until a search has finished'),
  noProgress: await ev('document.querySelectorAll(".progress-track").length === 0'),
  noResult: !landedText.includes('Completed in'),
  noAnswer: await ev('document.querySelectorAll(".answer-sentence").length === 0'),
  runLabel: await ev('document.querySelector("button.btn-primary")?.textContent ?? null'),
};
results.questionStem = await ev('document.querySelector(".question-stem")?.textContent ?? null');
await shot('ux6-solver-preselected-desktop');

// ── The answer, at the configured path count, in ordinary words ─────────────────────────────────
await click('Also solve the section 33 sensitivity cases'); // one search, not four
await settle();
results.announcement = (await body()).match(/Up to[^\n]+/)?.[0] ?? null;
await click('Work out my gross salary');
await wait('!!document.querySelector(".answer-sentence")');
await wait('document.body.innerText.includes("Completed in")');
results.answer = {
  sentence: await ev('document.querySelector(".answer-sentence")?.textContent ?? null'),
  status: await ev('document.querySelector(".answer-sentence")?.dataset.answerStatus ?? null'),
  hero: await ev('document.querySelector(".stat-hero")?.textContent ?? null'),
  seconds: (await body()).match(/Completed in ([\d.]+) seconds/)?.[1] ?? null,
};
await shot('ux6-solver-answer-desktop');
console.log('answer', results.answer.seconds, 's —', results.answer.sentence);

// ── Switching the question keeps the same six choices and re-labels the run ─────────────────────
await ev('document.querySelector(\'[data-question="fire_age"]\').click()'); await settle();
results.switched = {
  question: await asked(),
  runLabel: await ev('document.querySelector("button.btn-primary")?.textContent ?? null'),
  discarded: !(await body()).includes('Completed in'),
  choices: await ev('document.querySelectorAll("[data-question]").length'),
};
await ev('document.querySelector(\'[data-question="salary"]\').click()'); await settle();

// ── A plan that already clears its target is offered no fix ─────────────────────────────────────
await click('Overview');
await set('personal.targetSuccessProbability', 60);
await click('Run 10,000 simulated futures');
await wait('document.querySelectorAll(".headline-source").length === 1');
results.offerWhenMet = await ev('document.querySelectorAll(".headline-solve").length');
await set('personal.targetSuccessProbability', 90);

// ── Responsive ─────────────────────────────────────────────────────────────────────────────────
await ev('document.getElementById("tab-solver").click()'); await settle();
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev('window.scrollTo(0,0);document.querySelectorAll("details.group").forEach(e=>e.open=false)'); await settle();
results.mobile = {
  overflow: await ev('document.documentElement.scrollWidth - innerWidth'),
  tabs: await ev('document.querySelectorAll("[role=tab]").length'),
  choices: await ev('document.querySelectorAll("[data-question]").length'),
  columns: await ev('getComputedStyle(document.querySelector(".question-options")).gridTemplateColumns'),
};
await shot('ux6-solver-mobile');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await settle();
results.desktopOverflow = await ev('document.documentElement.scrollWidth - innerWidth');

// ── Assertions ─────────────────────────────────────────────────────────────────────────────────
assert.deepEqual([smokeBaseline.passed, smokeBaseline.count, smokeBaseline.success], [true, 10_000, 0.6898]);
assert.deepEqual([smokeProperty.passed, smokeProperty.count, smokeProperty.success], [true, 10_000, 0.3518]);
assert.equal(results.offerBeforeRun, 0, 'no completed run means no offer to fix one');
assert.equal(results.offerAfterRun, 'What would it take to reach 90%?');
assert.equal(results.landedOn, 'tab-solver', 'the offer lands on the Reverse Solver');
assert.equal(results.preselected, 'salary', 'the salary question is pre-selected');
assert.equal(results.noAutoRun.idleCard, true, 'arriving starts no search');
assert.equal(results.noAutoRun.noProgress, true, 'no search is in flight on arrival');
assert.equal(results.noAutoRun.noResult, true);
assert.equal(results.noAutoRun.noAnswer, true);
assert.match(results.noAutoRun.runLabel, /Work out my gross salary/);
assert.match(results.questionStem, /^To hit my goal, what would my … need to be\?$/);
assert.equal(results.answer.status, 'achieved');
assert.match(results.answer.sentence, /^You would need a gross salary of about £[\d,]+ \(we confirmed £[\d,]+ clears your 90% target and that £[\d,]+ does not\)\.$/);
assert.ok(results.answer.sentence.includes(results.answer.hero),
  'the sentence and the headline figure are the same answer');
assert.equal(results.switched.question, 'fire_age');
assert.match(results.switched.runLabel, /Work out my FIRE age/);
assert.equal(results.switched.discarded, true, 'a new question discards the previous answer');
assert.equal(results.switched.choices, 6);
assert.equal(results.offerWhenMet, 0, 'a plan that clears its target is offered no fix');
assert.equal(results.mobile.overflow, 0);
assert.equal(results.mobile.tabs, 8);
assert.equal(results.mobile.choices, 6);
assert.equal(results.mobile.columns.split(' ').length, 1, 'the picker stacks to one column on a phone');
assert.equal(results.desktopOverflow, 0);
assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux6-ui-results.json', JSON.stringify(results, null, 2));
console.log('UX-6 browser acceptance passed:', JSON.stringify(results, null, 2));
finished = true; ws.close();
