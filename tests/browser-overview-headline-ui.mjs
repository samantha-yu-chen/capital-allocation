/** Manual Chrome/CDP acceptance test for UX-5 (question-led Overview headline).
 *
 * Start Vite on APP_PORT and isolated Chrome on CDP_PORT, then run with Node 24.
 * Writes results and desktop/mobile screenshots to /tmp.
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
const wait = async (expression, limit = 360000) => {
  const started = Date.now();
  while (Date.now() - started < limit) {
    if (await ev(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw Error('Timeout: ' + expression);
};
const settle = () => new Promise(resolve => setTimeout(resolve, 250));
const click = async text => {
  await ev(`(()=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.replace(/\\s+/g,' ').trim()===${JSON.stringify(text)});if(!button)throw Error('Missing button '+${JSON.stringify(text)});button.click();})()`);
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
results.empty = {
  question: (await body()).includes('When can I be financially independent?'),
  sourceCount: await ev('document.querySelectorAll(".headline-source").length'),
  noPlaceholderProbability: !(await body()).includes('simulated futures (“'),
};
await shot('ux5-headline-empty-desktop');

await click('Run 10,000 simulated futures');
await wait('document.querySelectorAll(".headline-source").length === 1');
const completeText = await body();
results.probability = {
  sentence: completeText.match(/At your target[^\n]+/)?.[0] ?? null,
  source: await ev('document.querySelector(".headline-source")?.innerText.replace(/\\s+/g," ").trim()'),
};
await shot('ux5-headline-probability-desktop');

// The figure itself is the route to its owning detailed screen.
await ev('document.querySelector(".headline-source").click()'); await settle();
results.probabilityLink = await ev('document.getElementById("tab-fire").getAttribute("aria-selected") === "true"');
await click('Overview');

// The full-count curve is deliberately expensive: all 21 ages keep the configured 10,000 paths.
await click('Compute the earliest age that reaches the target');
await ev('window.ux5Frames=0;window.ux5Gap=0;window.ux5Measure=true;window.ux5Last=performance.now();requestAnimationFrame(function frame(t){window.ux5Frames++;window.ux5Gap=Math.max(window.ux5Gap,t-window.ux5Last);window.ux5Last=t;if(window.ux5Measure)requestAnimationFrame(frame);})');
await click('Compute 21 ages');
await wait('document.body.innerText.includes("PROBABILITY BY FIRE AGE") && document.body.innerText.includes("Completed in")');
results.curveResponsiveness = await ev('window.ux5Measure=false;({frames:window.ux5Frames,maxGap:window.ux5Gap})');
await click('Overview');
await wait('document.querySelectorAll(".headline-source").length === 2');
const combinedText = await body();
results.curve = {
  sentence: combinedText.match(/At your target[^\n]+/)?.[0] ?? null,
  source: await ev('document.querySelectorAll(".headline-source")[1].innerText.replace(/\\s+/g," ").trim()'),
};
await shot('ux5-headline-complete-desktop');

await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev('window.scrollTo(0,0)'); await settle();
results.mobileComplete = {
  overflow: await ev('document.documentElement.scrollWidth - innerWidth'),
  tabs: await ev('document.querySelectorAll("[role=tab]").length'),
  headlineColumns: await ev('getComputedStyle(document.querySelector(".headline-card")).gridTemplateColumns'),
  sourceCount: await ev('document.querySelectorAll(".headline-source").length'),
};
await shot('ux5-headline-complete-mobile');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await settle();

// A profile edit clears both completed runs before the new profile can display either figure.
await set('income.salaryAnnual', 56_000);
results.invalidated = {
  sourceCount: await ev('document.querySelectorAll(".headline-source").length'),
  emptyCopy: (await body()).includes('Run your plan to see its success probability'),
  noOldProbability: !(await body()).includes('69.0% of simulated futures'),
};

// A cancelled replacement run still publishes nothing to the headline.
await click('Run 10,000 simulated futures');
await click('See run settings');
await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow")) > 0');
await click('Cancel');
await wait('document.body.innerText.includes("Run cancelled")');
await click('Overview');
results.cancelledEmpty = await ev('document.querySelectorAll(".headline-source").length === 0');

await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev('window.scrollTo(0,0)'); await settle();
results.mobileEmpty = {
  overflow: await ev('document.documentElement.scrollWidth - innerWidth'),
  tabs: await ev('document.querySelectorAll("[role=tab]").length'),
  headlineColumns: await ev('getComputedStyle(document.querySelector(".headline-card")).gridTemplateColumns'),
};
await shot('ux5-headline-mobile');

assert.deepEqual([smokeBaseline.passed, smokeBaseline.count, smokeBaseline.success], [true, 10_000, 0.6898]);
assert.deepEqual([smokeProperty.passed, smokeProperty.count, smokeProperty.success], [true, 10_000, 0.3518]);
assert.deepEqual(results.empty, { question: true, sourceCount: 0, noPlaceholderProbability: true });
assert.match(results.probability.sentence ?? '', /69\.0% of simulated futures \(“Fragile”\)/);
assert.match(results.probability.source ?? '', /Success probability 69\.0% From FIRE & Monte Carlo: 10,000 paths, seed 421337/);
assert.equal(results.probabilityLink, true);
assert.match(results.curve.sentence ?? '', /The earliest age that meets your 90% target is \d+\./);
assert.match(results.curve.source ?? '', /Earliest qualifying age \d+ From FIRE Age Curve: 21 ages × 10,000 paths/);
assert.ok(results.curveResponsiveness.frames > 30);
assert.ok(results.curveResponsiveness.maxGap < 250, `main thread frame gap was ${results.curveResponsiveness.maxGap}ms`);
assert.deepEqual(results.invalidated, { sourceCount: 0, emptyCopy: true, noOldProbability: true });
assert.equal(results.cancelledEmpty, true);
assert.deepEqual(
  { overflow: results.mobileComplete.overflow, tabs: results.mobileComplete.tabs, sourceCount: results.mobileComplete.sourceCount },
  { overflow: 0, tabs: 8, sourceCount: 2 },
);
assert.equal(results.mobileComplete.headlineColumns.split(' ').length, 1);
assert.equal(results.mobileEmpty.overflow, 0);
assert.equal(results.mobileEmpty.tabs, 8);
assert.equal(results.mobileEmpty.headlineColumns.split(' ').length, 1);
assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux5-ui-results.json', JSON.stringify(results, null, 2));
console.log('UX-5 browser acceptance passed:', JSON.stringify(results, null, 2));
finished = true; ws.close();
