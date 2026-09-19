/** Manual Chrome/CDP acceptance test for UX-4 (Start here wizard).
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
const wait = async (expression, limit = 180000) => {
  const started = Date.now();
  while (Date.now() - started < limit) {
    if (await ev(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw Error('Timeout: ' + expression);
};
const settle = () => new Promise(resolve => setTimeout(resolve, 220));
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
const openWizard = async () => { await ev('document.querySelector(".start-here-button").click()'); await settle(); };
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
await ev('localStorage.clear(); location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".wizard-shell")');
const results = { errors, smokeBaseline, smokeProperty };

results.tabsAtStart = await ev('document.querySelectorAll("[role=tab]").length');
results.initialStep = await ev('document.querySelector(".wizard-steps [aria-current=step]")?.textContent.replace(/\\s+/g," ").trim()');
results.initialSimulationState = await ev('document.querySelector(".progress-track") === null && !document.body.innerText.includes("Your plan succeeded in")');
await shot('ux4-wizard-step1-desktop');

// Invalid age stays on step 1 and uses UX-3's plain cross-field message.
await set('personal.targetFireAge', 20);
await click('Continue');
results.invalidStep = {
  current: await ev('document.querySelector(".wizard-steps [aria-current=step]")?.textContent.replace(/\\s+/g," ").trim()'),
  message: (await body()).includes('These three ages have to run in order'),
  banner: (await body()).includes('Fix this step before continuing'),
};
await shot('ux4-wizard-invalid-desktop');
await set('personal.targetFireAge', 45);

// Complete the remaining input steps without changing the curated defaults.
for (let step = 0; step < 4; step += 1) await click('Continue');
await wait('document.body.innerText.includes("REFERENCE FIRE NUMBER")');
const resultText = await body();
results.reference = {
  fireNumber: resultText.includes('£565,714'),
  wealth: resultText.includes('£755,017'),
  // UX-7 replaced this step's hand-written half-sentence with the shared two-numbers story, so the
  // claim to check is the arbitration clause that story carries.
  arithmeticLabel: resultText.includes('the number your target is judged against'),
  deterministicLabel: resultText.includes('One deterministic path'),
  noImplicitRun: !resultText.includes('Your plan succeeded in'),
};
await shot('ux4-wizard-result-desktop');

// Explicit run cancellation publishes no probability.
await click('Run 10,000 paths');
await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow")) > 0');
await click('Cancel');
await wait('document.body.innerText.includes("Run cancelled")');
results.cancelled = !(await body()).includes('Your plan succeeded in');

// The completed result is the same shared runner result the FIRE tab shows.
await ev('window.ux4Frames=0;window.ux4Gap=0;window.ux4Measure=true;window.ux4Last=performance.now();requestAnimationFrame(function frame(t){window.ux4Frames++;window.ux4Gap=Math.max(window.ux4Gap,t-window.ux4Last);window.ux4Last=t;if(window.ux4Measure)requestAnimationFrame(frame);})');
await click('Run 10,000 paths');
await wait('document.body.innerText.includes("Your plan succeeded in")');
results.responsiveness = await ev('window.ux4Measure=false;({frames:window.ux4Frames,maxGap:window.ux4Gap})');
results.wizardProbability = (await body()).match(/Your plan succeeded in\s*([\d.]+%)/)?.[1] ?? null;
await shot('ux4-wizard-probability-desktop');
await click('See the full FIRE result');
await wait('document.getElementById("tab-fire").getAttribute("aria-selected") === "true"');
results.fireProbability = (await body()).match(/Current ([\d.]+%)/)?.[1] ?? null;

// Editing the shared profile invalidates the shared result immediately, whichever surface launched it.
await openWizard();
await ev('document.querySelectorAll(".wizard-steps button")[1].click()'); await settle();
await set('income.salaryAnnual', 56_000);
await ev('document.querySelectorAll(".wizard-steps button")[4].click()'); await settle();
results.staleInvalidated = await ev('!document.body.innerText.includes("Your plan succeeded in") && !document.body.innerText.includes("Current 68.98%")');

// Dismissal survives reload, and the sidebar always offers a way back.
await click('Dismiss start here');
results.dismissedKey = await ev('localStorage.getItem("capital-allocation:start-here-dismissed:v1")');
await ev('location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".start-here-button")');
results.hiddenAfterReload = await ev('document.querySelector(".wizard-shell") === null');
await openWizard();
results.reopened = await ev('!!document.querySelector(".wizard-shell")');

// Phone width: wizard and all eight reference tabs remain in the DOM without page overflow.
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev('window.scrollTo(0,0)'); await settle();
results.mobileOverflow = await ev('document.documentElement.scrollWidth - innerWidth');
results.mobileTabs = await ev('document.querySelectorAll("[role=tab]").length');
results.mobileSteps = await ev('document.querySelectorAll(".wizard-steps li").length');
await shot('ux4-wizard-mobile');

assert.equal(results.tabsAtStart, 8);
assert.deepEqual(
  [results.smokeBaseline.passed, results.smokeBaseline.count, results.smokeBaseline.success],
  [true, 10_000, 0.6898],
);
assert.deepEqual(
  [results.smokeProperty.passed, results.smokeProperty.count, results.smokeProperty.success],
  [true, 10_000, 0.3518],
);
assert.match(results.initialStep ?? '', /^1About you/);
assert.equal(results.initialSimulationState, true, 'opening the wizard must not start Monte Carlo');
assert.match(results.invalidStep.current ?? '', /^1About you/);
assert.equal(results.invalidStep.message, true);
assert.equal(results.invalidStep.banner, true);
assert.deepEqual(results.reference, {
  fireNumber: true, wealth: true, arithmeticLabel: true, deterministicLabel: true, noImplicitRun: true,
});
assert.equal(results.cancelled, true, 'cancelled runs publish no probability');
assert.equal(results.wizardProbability, '68.98%');
assert.equal(results.fireProbability, results.wizardProbability, 'wizard and FIRE tab share the exact result');
assert.ok(results.responsiveness.frames > 30, 'the UI must continue drawing frames during the full run');
assert.ok(results.responsiveness.maxGap < 250, `main thread frame gap was ${results.responsiveness.maxGap}ms`);
assert.equal(results.staleInvalidated, true, 'an edited profile discards the old probability');
assert.equal(results.dismissedKey, 'true');
assert.equal(results.hiddenAfterReload, true);
assert.equal(results.reopened, true);
assert.equal(results.mobileOverflow, 0);
assert.equal(results.mobileTabs, 8);
assert.equal(results.mobileSteps, 5);
assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux4-ui-results.json', JSON.stringify(results, null, 2));
console.log('UX-4 browser acceptance passed:', JSON.stringify(results, null, 2));
finished = true; ws.close();
