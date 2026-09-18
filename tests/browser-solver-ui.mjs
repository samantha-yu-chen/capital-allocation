/** Manual Chrome/CDP acceptance test for the FIRE Age Curve and Reverse Solver screens.
 *
 * Start `npm run dev -- --port 5176 --strictPort` and a dedicated headless Chrome with
 * --headless=new --remote-debugging-port=9226 --user-data-dir=/tmp/capital-chunk6-chrome, then run
 * with Node 24: `node tests/browser-solver-ui.mjs`. Override APP_PORT / CDP_PORT to use others.
 * Outputs JSON and PNGs into /tmp. Do not edit application source while this runs: a Vite reload
 * resets the deliberately in-memory profile.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const appPort = process.env.APP_PORT ?? '5176';
const cdpPort = process.env.CDP_PORT ?? '9226';
/** Spec section 61's worked answer for the reference profile, at the checked-in seed and count. */
const SOLVER_BASELINE = process.env.SOLVER_BASELINE ?? '£87,600';
const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
// A dropped debugger connection otherwise looks like a silently unsettled await.
let finished = false;
ws.onclose = () => { if (!finished) { console.error('CDP CONNECTION CLOSED'); process.exit(1); } };
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
};
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = async (expr, limit = 120000) => { const start = Date.now(); while (Date.now() - start < limit) { const r = await ev(expr); if (r) return r; await new Promise(r => setTimeout(r, 150)); } throw Error('Timeout: ' + expr); };
const click = async text => ev(`(()=>{const e=[...document.querySelectorAll('button,label')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.click();})()`);
const set = async (elementId, value) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(elementId)});if(!e)throw Error('Missing input '+${JSON.stringify(elementId)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const text = () => ev('document.body.innerText');
/** UX-6: the searched input is a radio group of questions, not a select. */
const ask = async question => ev(`(()=>{const e=document.querySelector('[data-question=${JSON.stringify(question)}]');if(!e)throw Error('Missing question '+${JSON.stringify(question)});e.click();})()`);
const asked = () => ev(`document.querySelector('[role="radio"][aria-checked="true"]')?.dataset.question ?? null`);
/** Card kickers are uppercased by the design system, so read values from the DOM, not innerText. */
const hero = () => ev('document.querySelector(".stat-hero")?.textContent ?? null');
const heroKicker = () => ev('document.querySelector(".stat-hero")?.closest(".card")?.querySelector(".card-kicker")?.textContent ?? null');
const statByKicker = pattern => ev(`(()=>{const c=[...document.querySelectorAll('.card')].find(c=>${pattern}.test(c.querySelector('.card-kicker')?.textContent??''));return c?.querySelector('.stat-value')?.textContent??null;})()`);
/** The design system uppercases kickers and tags, so every text probe ignores case. */
const has = pattern => `${pattern}.test(document.body.innerText)`;
const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };
const tab = async name => { await ev(`document.getElementById("tab-${name}").click()`); await new Promise(r => setTimeout(r, 200)); };

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await wait('document.readyState === "complete"');
await wait('!!document.getElementById("tab-curve")');
const results = { errors };

// ── FIRE & Monte Carlo, for a same-paths cross-check against the curve ──────────────────────────
await tab('fire');
await click('Run 10,000 paths');
await wait('document.body.innerText.includes("Completed in")', 180000);
results.fireProbability = (await text()).match(/Current ([\d.]+)%/)[1];
console.log('FIRE screen probability', results.fireProbability);

// ── FIRE Age Curve ─────────────────────────────────────────────────────────────────────────────
await tab('curve');
await set('curve.fromAge', 42);
await set('curve.toAge', 50);
results.curveAnnouncement = (await text()).match(/This run is[^\n]+/)[0];
console.log(results.curveAnnouncement);
await ev('window.frames6=0;window.gap6=0;window.measure6=true;window.last6=performance.now();requestAnimationFrame(function f(t){window.frames6++;window.gap6=Math.max(window.gap6,t-window.last6);window.last6=t;if(window.measure6)requestAnimationFrame(f)});');
await click('Compute 9 ages');
await wait('document.body.innerText.includes("Age 42")', 300000);
await wait('document.body.innerText.includes("Completed in")', 300000);
results.curveFrames = await ev('({frames:window.frames6,maxGap:window.gap6})');
await ev('window.measure6=false');
const curveText = await text();
results.curveSeconds = curveText.match(/Completed in ([\d.]+) seconds/)[1];
results.curveRows = [...curveText.matchAll(/^(4[2-9]|50)\t([\d.]+)%\t/gm)].map(m => [Number(m[1]), m[2]]);
results.curveEarliest = await hero();
results.curveHasTarget = /earliest fire age reaching the target/i.test(curveText);
results.curvePoints = await ev('document.querySelectorAll(".chart circle").length');
console.log('curve', results.curveSeconds, 's', results.curveEarliest, results.curveRows.map(r => r.join(':')).join(' '));
await ev('[...document.querySelectorAll("h3")].find(e=>e.textContent.includes("Every candidate age"))?.scrollIntoView()');
await shot('chunk6-curve-desktop');

// The curve must reproduce the FIRE screen exactly at the profile's own FIRE age: same paths.
results.curveAtTargetAge = await statByKicker('/probability at your target fire age/i');

// Cancellation publishes nothing.
await ev('window.scrollTo(0,0)');
await click('Compute 9 ages');
await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow")) > 0', 120000);
await click('Cancel');
await wait(has('/run cancelled/i'));
results.curveCancelled = await ev('!document.body.innerText.includes("Completed in")');

// A finished curve is discarded when a relevant input changes.
await click('Compute 9 ages');
await wait('document.body.innerText.includes("Completed in")', 300000);
await set('personal.targetSuccessProbability', 85);
results.curveInvalidated = /the previous curve was discarded/i.test(await text());
results.curveInvalidatedHidden = await ev('!document.body.innerText.includes("Completed in")');
await set('personal.targetSuccessProbability', 90);

// ── Reverse Solver ─────────────────────────────────────────────────────────────────────────────
await tab('solver');
results.solverQuestionStem = await ev('document.querySelector(".question-stem")?.textContent ?? null');
results.solverQuestionCount = await ev('document.querySelectorAll("[data-question]").length');
results.solverQuestionSelected = await asked();
results.solverAnnouncement = (await text()).match(/Up to[^\n]+/)[0];
console.log(results.solverQuestionStem, '|', results.solverAnnouncement);
await click('Work out my gross salary');
await wait(has('/evaluation trace/i'), 900000);
await wait('document.body.innerText.includes("Completed in")', 900000);
const solverText = await text();
results.solverSeconds = solverText.match(/Completed in ([\d.]+) seconds/)[1];
results.solverAnswerSentence = await ev('document.querySelector(".answer-sentence")?.textContent ?? null');
results.solverAnswerStatus = await ev('document.querySelector(".answer-sentence")?.dataset.answerStatus ?? null');
results.solverHeadline = await hero();
results.solverKicker = await heroKicker();
results.solverConfirmed = /confirmed against the full model/i.test(solverText);
results.solverTraceRows = await ev('document.querySelectorAll("table tbody tr").length');
results.solverSensitivity = /fire age \+2 \(\d+\)/i.test(solverText);
results.solverNoteOnAllowance = /outside the supported model/i.test(solverText);
console.log('solver', results.solverSeconds, 's', results.solverKicker, results.solverHeadline,
  'confirmed:', results.solverConfirmed, 'allowance note:', results.solverNoteOnAllowance);
await ev('[...document.querySelectorAll("h3")].find(e=>e.textContent.includes("What was asked"))?.scrollIntoView()');
await shot('chunk6-solver-desktop');

// Cancellation, then a mode switch that changes the searched input's units.
await ev('window.scrollTo(0,0)');
await click('Work out my gross salary');
await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow")) > 0', 120000);
await click('Cancel');
await wait(has('/search cancelled/i'));
results.solverCancelled = await ev('!document.body.innerText.includes("Completed in")');

await ask('retirement_spending');
await new Promise(r => setTimeout(r, 200));
results.spendingBoundUnit = await ev('document.querySelector("label[for=\'solver.bound\']").textContent');
results.spendingRunLabel = await ev('document.querySelector("button.btn-primary")?.textContent ?? null');
await ask('starting_capital');
await new Promise(r => setTimeout(r, 200));
results.destinationVisible = /where the extra capital goes/i.test(await text());
await ask('pension_contribution');
await new Promise(r => setTimeout(r, 200));
results.pensionDefinition = /monotonicity is therefore not assumed/i.test(await text());
await ask('salary');
await new Promise(r => setTimeout(r, 200));
results.backToSalary = await asked();

// Invalid controls block the run rather than silently coercing.
await set('solver.bound', 1000);
results.boundRejected = await ev('!!document.querySelector(".field-error") && document.querySelector("button.btn-primary").disabled');
await set('solver.bound', 255000);

// ── Responsive layout ──────────────────────────────────────────────────────────────────────────
for (const name of ['curve', 'solver']) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await tab(name);
  await ev('window.scrollTo(0,0);document.querySelectorAll("details.group").forEach(e=>e.open=false)');
  await new Promise(r => setTimeout(r, 300));
  results[name + 'MobileOverflow'] = await ev('document.documentElement.scrollWidth-innerWidth');
  await shot('chunk6-' + name + '-mobile');
}
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
for (const name of ['curve', 'solver']) {
  await tab(name);
  await new Promise(r => setTimeout(r, 200));
  results[name + 'DesktopOverflow'] = await ev('document.documentElement.scrollWidth-innerWidth');
}
console.log('overflow', results.curveMobileOverflow, results.solverMobileOverflow, results.curveDesktopOverflow, results.solverDesktopOverflow);

// ── Assertions ─────────────────────────────────────────────────────────────────────────────────
assert.equal(results.curveRows.length, 9, 'every requested age is tabulated');
assert.equal(results.curvePoints, 9, 'the chart draws one point per simulated age');
assert.equal(results.curveAtTargetAge, results.fireProbability + '%',
  'the curve must reproduce the FIRE screen at the profile FIRE age: same seed, same paths');
const qualifying = results.curveRows.find(([, p]) => Number(p) >= 90);
assert.equal(results.curveHasTarget, Boolean(qualifying), 'the headline agrees with the tabulated probabilities');
if (qualifying) assert.equal(results.curveEarliest, `Age ${qualifying[0]}`, 'the earliest qualifying age matches the table');
assert.equal(results.curveCancelled, true, 'a cancelled curve publishes nothing');
assert.equal(results.curveInvalidated, true, 'changing the target discards a finished curve');
assert.equal(results.curveInvalidatedHidden, true, 'the discarded curve is removed from the screen');
assert.ok(results.curveFrames.frames > 30, 'the UI kept animating during the run');
assert.ok(results.curveFrames.maxGap < 250, 'no long main-thread block while the workers run');
assert.ok(results.solverHeadline, 'the solver published a headline');
assert.match(results.solverQuestionStem, /^To hit my goal, what would my … need to be\?$/,
  'the solver opens with the question, not the engine mode name');
assert.equal(results.solverQuestionCount, 6, 'all six searches are offered as answers to that question');
assert.equal(results.solverQuestionSelected, 'salary', 'salary is the default question');
assert.equal(results.solverAnswerStatus, 'achieved', 'the reference salary search resolves to an answer');
assert.match(results.solverAnswerSentence, /^You would need a gross salary of about £/,
  'the answer is a sentence before it is a figure');
assert.match(results.solverAnswerSentence, /we confirmed £[\d,]+ clears your 90% target and that £[\d,]+ does not/,
  'the sentence carries the confirmed bracket');
assert.equal(results.solverHeadline, SOLVER_BASELINE,
  `the reference profile's required salary reproduces at ${SOLVER_BASELINE}`);
assert.ok(results.solverAnswerSentence.includes(SOLVER_BASELINE),
  'the sentence and the headline report the same answer');
assert.match(results.spendingRunLabel, /Work out my retirement spending/,
  'the run button names the question it will answer');
assert.equal(results.backToSalary, 'salary', 'the question picker is a single choice');
assert.equal(results.solverCancelled, true, 'a cancelled search publishes nothing');
assert.ok(results.solverTraceRows > 3, 'the evaluation trace lists the candidates that were simulated');
assert.equal(results.solverSensitivity, true, 'section 33 sensitivity cases were solved');
assert.match(results.spendingBoundUnit, /£ \/ month/, 'the bound control follows the searched input’s units');
assert.equal(results.destinationVisible, true);
assert.equal(results.pensionDefinition, true);
assert.equal(results.boundRejected, true, 'an out-of-direction bound blocks the run');
assert.equal(results.curveMobileOverflow, 0);
assert.equal(results.solverMobileOverflow, 0);
assert.equal(results.curveDesktopOverflow, 0);
assert.equal(results.solverDesktopOverflow, 0);
assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/chunk6-ui-results.json', JSON.stringify(results, null, 2));
console.log('chunk 6 browser acceptance passed');
finished = true; ws.close();
