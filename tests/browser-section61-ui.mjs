/** Manual Chrome/CDP acceptance test for spec section 61's required-salary column (package 10).
 *
 * Start `npm run dev -- --port 5182 --strictPort` and a dedicated headless Chrome with
 * --headless=new --remote-debugging-port=9245 --user-data-dir=/tmp/capital-chunk10-chrome, then run
 * with Node 24: `node tests/browser-section61-ui.mjs`. Override APP_PORT / CDP_PORT to use others.
 * Outputs JSON and PNGs into /tmp. Do not edit application source while this runs: a Vite reload
 * resets the deliberately in-memory profile.
 *
 * Section 61's table is monthly spending, FIRE age at the target, required salary and the reference
 * FIRE number. This harness covers the required-salary half: each spending case re-solves its own
 * gross salary through the complete model, the announced cost is a ceiling stated before the run,
 * progress names the search, a cancelled search publishes nothing, and toggling the search discards
 * a completed comparison instead of leaving a stale column on screen.
 *
 * PATH COUNT. The default run here explicitly lowers `simulation.count` first, as a user would,
 * because three bounded salary solves at 10,000 paths take roughly twenty minutes. Nothing in the
 * product reduces the count on its own: set FULL_COUNT=1 to leave the entered 10,000 paths alone and
 * measure the full-count answer. The harness records which of the two it ran.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const appPort = process.env.APP_PORT ?? '5182';
const cdpPort = process.env.CDP_PORT ?? '9245';
const fullCount = process.env.FULL_COUNT === '1';
const searchPaths = Number(process.env.SEARCH_PATHS ?? 400);
const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  else if (m.method === 'Inspector.targetCrashed') { console.error('RENDERER CRASHED'); process.exit(1); }
};
// A dropped debugger connection otherwise looks like a silently unsettled await.
let finished = false;
ws.onclose = () => { if (!finished) { console.error('CDP CONNECTION CLOSED'); process.exit(1); } };
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = async (expr, limit = 120000) => { const start = Date.now(); while (Date.now() - start < limit) { const r = await ev(expr); if (r) return r; await new Promise(r => setTimeout(r, 200)); } throw Error('Timeout: ' + expr); };
const click = async text => ev(`(()=>{const e=[...document.querySelectorAll('button,label')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.click();})()`);
const set = async (elementId, value) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(elementId)});if(!e)throw Error('Missing input '+${JSON.stringify(elementId)});const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const choose = async (labelText, value) => ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(labelText)});if(!l)throw Error('Missing label '+${JSON.stringify(labelText)});const s=document.getElementById(l.htmlFor);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(value)});s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const text = () => ev('document.body.innerText');
const rowCount = testid => ev(`document.querySelectorAll("[data-testid=${testid}] tbody tr").length`);
const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };
const tab = async name => { await ev(`document.getElementById("tab-${name}").click()`); await new Promise(r => setTimeout(r, 200)); };
const openScenarios = async () => { await wait('!!document.getElementById("tab-scenarios")'); await tab('scenarios'); await wait('!!document.getElementById("scenario.name")'); };
const desktop = () => cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
const mobile = () => cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
const amount = value => Number(value.replace(/[^0-9.-]/g, ''));
const SEARCH_LABEL = 'Solve the required gross salary per scenario (section 61)';

await cdp('Runtime.enable'); await cdp('Page.enable');
const results = { errors, fullCount, searchPaths: fullCount ? 10000 : searchPaths };

// ---- Both worker smoke variants, as every harness does ------------------------------------------
for (const suffix of ['', '?property']) {
  await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/tests/browser-worker-smoke.html${suffix}` });
  await wait('document.getElementById("result")?.textContent.includes("passed") || document.getElementById("result")?.textContent.startsWith("FAILED")', 180000);
  const value = await ev('document.getElementById("result").textContent');
  assert.ok(!value.startsWith('FAILED'), value);
  results[suffix ? 'propertySmoke' : 'smoke'] = JSON.parse(value);
  console.log('smoke', suffix, value);
}

await desktop();
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await wait('!!document.getElementById("tab-scenarios")');
await ev('localStorage.removeItem("capital-allocation.scenarios")');
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await openScenarios();

// ---- The announcement states the ceiling BEFORE anything runs -----------------------------------
await choose('What to compare', 'spending');
const announcement = () => ev('document.querySelector("[data-testid=scenario-announcement]").textContent');
const before = await announcement();
assert.match(before, /3 scenarios/);
assert.equal(/required-salary solve/.test(before), false, 'the cost must only mention the solve once it is requested');
await click(SEARCH_LABEL);
const announced = await announcement();
results.announcement = announced;
assert.match(announced, /required-salary solve/);
assert.match(announced, /up to 26 complete simulations each/);
assert.match(announced, /78 simulations/);
assert.match(announced, /never reduced to finish sooner/);
assert.match(await text(), /This run is expensive/);
console.log('announced', announced);

if (!fullCount) {
  // An explicit operator choice, exactly as a user would make it. The product never does this.
  await set('simulation.count', searchPaths);
  await wait(`document.querySelector("[data-testid=scenario-announcement]").textContent.includes("${(searchPaths * 78).toLocaleString('en-GB')}")`);
  results.loweredCountAnnouncement = await announcement();
}

// ---- Progress names the search, then cancelling publishes nothing --------------------------------
await click('Run comparison');
await wait('document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow") > 0', 300000);
const progressLine = await wait('(document.querySelector("[role=status] p")?.textContent ?? "").includes("required salary") ? document.querySelector("[role=status] p").textContent : ""', 600000);
results.progressLine = progressLine;
assert.match(progressLine, /required salary/);
console.log('progress', progressLine);
await click('Cancel');
await wait('document.body.innerText.includes("Run cancelled")');
assert.equal(await ev('!!document.querySelector("[data-testid=spending-effects]")'), false,
  'a cancelled search must publish no section 61 table at all');
assert.match(await text(), /No partial matrix is published/);
results.cancelledPublishesNothing = true;

// ---- A complete run: one solved required salary per spending case --------------------------------
const started = Date.now();
await click('Run comparison');
const heartbeat = setInterval(() => {
  void ev('document.querySelector("[role=status] p")?.textContent ?? "no status"')
    .then(line => console.log(`  ${((Date.now() - started) / 1000).toFixed(0)}s ${line}`), () => {});
}, 20000);
await wait('!!document.querySelector("[data-testid=spending-effects]")', 3_600_000).finally(() => clearInterval(heartbeat));
results.seconds = (Date.now() - started) / 1000;
console.log('completed', results.seconds);

assert.equal(await rowCount('spending-effects'), 3);
const rows = await ev('[...document.querySelectorAll("[data-testid=spending-effects] tbody tr")].map(r=>[...r.children].map(c=>c.innerText))');
results.rows = rows;
console.log(JSON.stringify(rows, null, 2));

// Column order: case, surplus, total invested, retirement budget, reference FIRE number,
// FIRE success, earliest qualifying age, required salary.
assert.deepEqual(rows.map(r => r[0]), ['£1,300/mo', '£1,650/mo', '£2,000/mo']);
assert.ok(amount(rows[0][1]) > amount(rows[2][1]), 'surplus must fall as the spending case rises');
assert.ok(amount(rows[0][4]) < amount(rows[2][4]), 'the reference FIRE number must rise as the spending case rises');

const required = rows.map(r => r[7]);
results.requiredSalaries = required;
for (const cell of required) {
  assert.notEqual(cell.trim(), '—', 'a completed search must publish what it found');
  assert.ok(/^£[\d,]+/.test(cell) || /^None up to £/.test(cell) || /already met/.test(cell) || /not supported/i.test(cell),
    `unexpected required-salary cell: ${cell}`);
  // Every cell explains what the search actually spent, so no number stands alone.
  assert.match(cell, /complete simulation/);
}
// A leaner household can never need more salary than a richer one.
const solved = required.map(cell => /^£[\d,]+/.test(cell) ? amount(cell.split('\n')[0]) : Number.POSITIVE_INFINITY);
assert.ok(solved[0] <= solved[1], 'the £1,300 case cannot need more salary than £1,650');
assert.ok(solved[1] <= solved[2], 'the £1,650 case cannot need more salary than £2,000');

// The same figures reach the full scenario table.
const fullRows = await ev('[...document.querySelectorAll("[data-testid=scenario-rows] tbody tr")].map(r=>[...r.children].map(c=>c.innerText))');
assert.equal(fullRows.length, 3);
assert.deepEqual(fullRows.map(r => r[3].split('\n')[0]), required.map(cell => cell.split('\n')[0]));
results.scenarioTableAgrees = true;

assert.equal(await ev('document.body.innerText.includes("PREVIEW")'), false, 'this is not a preview run');
assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'), false, 'no desktop overflow');
await shot('chunk10-section61-desktop');

// ---- Stale-result invalidation when the search itself is toggled ---------------------------------
await click(SEARCH_LABEL);
await wait('!document.querySelector("[data-testid=spending-effects]")');
assert.match(await text(), /previous comparison was discarded/);
results.staleOnSearchToggle = true;
await click(SEARCH_LABEL);

// ---- Mobile layout -------------------------------------------------------------------------------
await mobile();
await new Promise(r => setTimeout(r, 400));
assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'), false, 'no mobile overflow');
results.mobileOverflow = await ev('document.documentElement.scrollWidth-innerWidth');
await shot('chunk10-section61-mobile');
await desktop();

assert.deepEqual(errors, [], 'no uncaught page errors');
finished = true;
await fs.writeFile(`/tmp/chunk10-section61${fullCount ? '-full' : ''}-results.json`, JSON.stringify(results, null, 2));
console.log('SECTION 61 REQUIRED SALARY PASSED');
ws.close();
