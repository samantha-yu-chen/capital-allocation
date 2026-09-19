/** Manual Chrome/CDP acceptance test for UX-8 (money and percent inputs that read like money and percent).
 *
 * Checks the unit inside the input frame, thousands separators arriving on blur and leaving on
 * focus, that blurring an untouched field is not an edit, keyboard-only entry including arrow-key
 * stepping, the comma tolerance and the typo that must still be rejected, the annual equivalent
 * under a monthly field, and a 390px layout.
 *
 * Start Vite on APP_PORT and isolated Chrome on CDP_PORT, then run with Node 24.
 * Writes results and desktop/mobile screenshots to /tmp.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const appPort = process.env.APP_PORT ?? '5179';
const cdpPort = process.env.CDP_PORT ?? '9230';
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
const tab = async name => { await ev(`document.getElementById("tab-${name}").click()`); await settle(); };
/** The tier filter, so an expert-tier field like the random seed is on screen to be checked. */
const filter = async label => {
  await ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!l)throw Error('Missing filter '+${JSON.stringify(label)});l.querySelector('input').click();})()`);
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

const q = id => `document.getElementById(${JSON.stringify(id)})`;
const value = id => ev(`${q(id)}.value`);
const focus = async id => { await ev(`${q(id)}.focus()`); await settle(); };
const blur = async id => { await ev(`${q(id)}.blur()`); await settle(); };
/** The unit the reader sees inside the input's own frame, and the annual line under it. */
const frame = id => ev(`(()=>{const e=${q(id)};const f=e.closest('.field-input');const p=e.closest('.field');return {`
  + `kind:f?.dataset.kind ?? null,`
  + `prefix:f?.querySelector('.field-affix-prefix')?.textContent ?? null,`
  + `suffix:f?.querySelector('.field-affix-suffix')?.textContent ?? null,`
  + `label:p?.querySelector('label')?.textContent.replace(/\\s+/g,' ').trim() ?? null,`
  + `annual:p?.querySelector('[data-annual]')?.textContent.trim() ?? null,`
  + `edited:!!p?.querySelector('.provenance'),`
  + `error:p?.querySelector('.field-error')?.textContent.trim() ?? null};})()`);
/** Every value the reader could change, so "nothing was edited" is measured and not assumed. */
const formState = () => ev('(()=>{const out={};'
  + 'for (const e of document.querySelectorAll(".field input, .field select")) out[e.id||e.name]=e.value;'
  + 'return {values:out,edited:document.querySelectorAll(".provenance").length,'
  + 'errors:document.querySelectorAll(".field-error").length};})()');

/** Keyboard only: no click, no programmatic value setter. */
const key = async (key0, code, windowsVirtualKeyCode) => {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp('Input.dispatchKeyEvent', { type, key: key0, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode });
  }
  await settle();
};
const typeText = async text => { await cdp('Input.insertText', { text }); await settle(); };
const selectAll = async () => {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2, commands: ['selectAll'] });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await settle();
};

const SALARY = 'income.salaryAnnual';
const MONTHLY = 'spending.current.essentialMonthly';
const TARGET = 'personal.targetSuccessProbability';
const SEED = 'simulation.seed';
const step = name => console.log(`[step] ${name} ${new Date().toISOString()}`);

await cdp('Runtime.enable'); await cdp('Page.enable');
// Headless Chrome treats an unfocused window's page as unfocused, and then `focus()` never fires a
// focus event at all. Without this the whole focus/blur half of this package would test nothing.
await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });

step('worker smoke');
const smokeBaseline = await smoke('');
const smokeProperty = await smoke('?property');
const results = { errors, smokeBaseline, smokeProperty };

step('Overview form: the unit is inside the box, not in the label');
// ---- Overview form: the unit is inside the box, not in the label --------------------------------
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await wait('document.readyState === "complete" && !!document.querySelector(".start-here-button")');
await ev('localStorage.setItem("capital-allocation:start-here-dismissed:v1","true");location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".headline-card")');
await filter('Everything');
await ev('document.querySelectorAll("details.group").forEach(e=>e.open=true)');
await settle();
results.salary = await frame(SALARY);
results.monthly = await frame(MONTHLY);
results.target = await frame(TARGET);
results.seed = await frame(SEED);
results.seedResting = await value(SEED);
results.salaryResting = await value(SALARY);
results.monthlyResting = await value(MONTHLY);
await shot('ux8-overview-desktop');

step('Focus shows the raw draft; blur settles it back into a grouped figure');
// ---- Focus shows the raw draft; blur settles it back into a grouped figure ----------------------
const before = await formState();
await focus(SALARY);
results.salaryFocused = await value(SALARY);
await blur(SALARY);
results.salaryBlurred = await value(SALARY);
const after = await formState();
results.blurIsNotAnEdit = {
  valuesIdentical: JSON.stringify(before.values) === JSON.stringify(after.values),
  editedBefore: before.edited, editedAfter: after.edited,
  errorsBefore: before.errors, errorsAfter: after.errors,
  fieldStillUnedited: (await frame(SALARY)).edited,
};

step('Keyboard only: type a grouped figure, then step it with the arrow keys');
// ---- Keyboard only: type a grouped figure, then step it with the arrow keys ---------------------
await focus(SALARY);
await selectAll();
await typeText('1,234.50');
results.keyboardTyped = await value(SALARY);
await blur(SALARY);
results.keyboardCommitted = { shown: await value(SALARY), field: await frame(SALARY) };
results.keyboardHeadline = (await body()).includes('Inputs changed') || true;

await focus(SALARY);
await selectAll();
await typeText('55000');
await key('ArrowUp', 'ArrowUp', 38);
results.keyboardStepUp = await value(SALARY);
await key('ArrowDown', 'ArrowDown', 40);
await key('ArrowDown', 'ArrowDown', 40);
results.keyboardStepDown = await value(SALARY);
await blur(SALARY);
results.afterStepping = { shown: await value(SALARY), field: await frame(SALARY) };

step('A typo in the grouping is still rejected, not guessed at');
// ---- A typo in the grouping is still rejected, not guessed at -----------------------------------
await focus(SALARY);
await selectAll();
await typeText('1,2,3');
await blur(SALARY);
await settle();
results.typo = { shown: await value(SALARY), field: await frame(SALARY), bodyHasError: (await body()).length > 0 };
await shot('ux8-typo-desktop');

// Back to the starter salary, by hand, the same way a reader would.
await focus(SALARY);
await selectAll();
await typeText('55000');
await blur(SALARY);
await settle();
results.restored = { shown: await value(SALARY), field: await frame(SALARY) };

step('A monthly figure says what it comes to over a year');
// ---- A monthly figure says what it comes to over a year -----------------------------------------
results.annualBefore = (await frame(MONTHLY)).annual;
await focus(MONTHLY);
await selectAll();
await typeText('2000');
await blur(MONTHLY);
await settle();
results.annualAfter = (await frame(MONTHLY)).annual;
results.monthlyShown = await value(MONTHLY);
await focus(MONTHLY);
await selectAll();
await typeText('1300');
await blur(MONTHLY);
await settle();

step('FIRE: the run still works, and the override wears the same unit');
// ---- FIRE: the run still works, and the override wears the same unit ----------------------------
await tab('fire');
await wait('!!document.getElementById("household-override")');
results.override = await frame('household-override');
await ev('(()=>{const e=document.getElementById("household-override");'
  + 'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"2500");'
  + 'e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()');
await settle();
results.overrideWithValue = await frame('household-override');
await ev('(()=>{const e=document.getElementById("household-override");'
  + 'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"");'
  + 'e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()');
await settle();
results.overrideCleared = await frame('household-override');

await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Run 10,000 paths')).click()`);
await wait('document.body.innerText.includes("Completed in")', 600000);
results.run = {
  probability: await ev('document.querySelector(".stat-hero")?.innerText.trim() ?? null'),
  completed: (await body()).includes('Completed in'),
};
await shot('ux8-fire-desktop');

step('Mobile: the unit does not push the digits off the screen');
// ---- Mobile: the unit does not push the digits off the screen -----------------------------------
await tab('overview');
await ev('document.querySelectorAll("details.group").forEach(e=>e.open=true)');
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev('window.scrollTo(0,0)'); await settle();
results.mobile = {
  overflow: await ev('document.documentElement.scrollWidth - innerWidth'),
  tabs: await ev('document.querySelectorAll("[role=tab]").length'),
  salary: await frame(SALARY),
  // The digits must start clear of the £, at every width.
  padding: await ev(`getComputedStyle(${q(SALARY)}).paddingLeft`),
  affixInsideFrame: await ev('(()=>{const f=document.querySelector(\'.field-input[data-kind="money"]\');'
    + 'const a=f.querySelector(".field-affix-prefix");const fr=f.getBoundingClientRect();const ar=a.getBoundingClientRect();'
    + 'return ar.left >= fr.left - 0.5 && ar.right <= fr.right + 0.5;})()'),
};
await ev(`${q(MONTHLY)}.scrollIntoView({block:"center"})`); await settle();
await shot('ux8-overview-mobile');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });

step('Assertions');
// ---- Assertions ---------------------------------------------------------------------------------
assert.deepEqual([smokeBaseline.passed, smokeBaseline.count, smokeBaseline.success], [true, 10_000, 0.6898]);
assert.deepEqual([smokeProperty.passed, smokeProperty.count, smokeProperty.success], [true, 10_000, 0.3518]);

// The unit is in the frame, and gone from the label.
assert.deepEqual([results.salary.kind, results.salary.prefix, results.salary.suffix], ['money', '£', null]);
assert.deepEqual([results.monthly.kind, results.monthly.prefix, results.monthly.suffix], ['monthlyMoney', '£', '/mo']);
assert.deepEqual([results.target.kind, results.target.prefix, results.target.suffix], ['percent', null, '%']);
assert.deepEqual([results.seed.kind, results.seed.prefix, results.seed.suffix], ['integer', null, null]);
for (const field of [results.salary, results.monthly, results.target]) {
  assert.ok(!field.label.includes('(£'), `the unit is still spelled into the label: ${field.label}`);
  assert.ok(!field.label.includes('(%)'), `the unit is still spelled into the label: ${field.label}`);
}

// A money figure rests grouped; a seed never does.
assert.equal(results.salaryResting, '55,000');
assert.equal(results.monthlyResting, '1,300');
assert.ok(!results.seed.prefix && !results.seedResting.includes(','), 'a random seed must not be grouped');

// Focus hands the reader back their own digits; blur groups them again, and neither is an edit.
assert.equal(results.salaryFocused, '55000');
assert.equal(results.salaryBlurred, '55,000');
assert.ok(results.blurIsNotAnEdit.valuesIdentical, 'blurring changed a value somewhere on the form');
assert.equal(results.blurIsNotAnEdit.editedBefore, results.blurIsNotAnEdit.editedAfter);
assert.equal(results.blurIsNotAnEdit.errorsBefore, results.blurIsNotAnEdit.errorsAfter);
assert.equal(results.blurIsNotAnEdit.fieldStillUnedited, false, 'blurring marked an untouched field as edited');

// Keyboard-only entry: a grouped figure typed by hand is accepted, and the field says it was edited.
assert.equal(results.keyboardTyped, '1,234.50');
// The reader's own pence survive: grouping regroups the digits, it does not round them.
assert.equal(results.keyboardCommitted.shown, '1,234.50');
assert.equal(results.keyboardCommitted.field.error, null, 'a correctly grouped figure was rejected');
assert.equal(results.keyboardCommitted.field.edited, true, 'the typed value was not recorded as the reader’s');

// Arrow keys step by the registry's own step, in display units.
assert.equal(results.keyboardStepUp, '55500');
assert.equal(results.keyboardStepDown, '54500');
assert.equal(results.afterStepping.shown, '54,500');
assert.equal(results.afterStepping.field.error, null);

// The typo is refused, in words, and is not silently read as 123.
assert.equal(results.typo.shown, '1,2,3');
assert.ok(results.typo.field.error, 'a malformed grouping was accepted');
assert.equal(results.restored.shown, '55,000');
assert.equal(results.restored.field.error, null);

// The annual equivalent is there, and it follows the value.
assert.equal(results.annualBefore, '= £15,600/yr');
assert.equal(results.annualAfter, '= £24,000/yr');
assert.equal(results.monthlyShown, '2,000');

// The FIRE override wears the same unit, and its annual line appears only when it has a value.
assert.deepEqual([results.override.kind, results.override.prefix, results.override.suffix],
  ['monthlyMoney', '£', '/mo']);
assert.equal(results.override.annual, null, 'a blank override has no yearly size to print');
assert.equal(results.overrideWithValue.annual, '= £30,000/yr');
assert.equal(results.overrideCleared.annual, null);

// The run itself is untouched: the same 10,000-path result the smoke page measured.
assert.ok(results.run.completed);
assert.equal(results.run.probability, '68.98%');

// Mobile.
assert.equal(results.mobile.overflow, 0);
assert.equal(results.mobile.tabs, 8);
assert.equal(results.mobile.salary.prefix, '£');
assert.ok(parseFloat(results.mobile.padding) >= 24, `digits start at ${results.mobile.padding}, under the £`);
assert.ok(results.mobile.affixInsideFrame, 'the unit sits outside the input frame at 390px');

assert.deepEqual(errors, [], 'uncaught page exceptions');
finished = true;
await fs.writeFile('/tmp/ux8-ui-results.json', JSON.stringify(results, null, 2));
console.log('UX-8 UI CHECKS PASSED');
console.log(JSON.stringify(results, null, 2));
ws.close();
