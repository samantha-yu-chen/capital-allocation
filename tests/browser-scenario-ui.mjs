/** Manual Chrome/CDP acceptance test for Scenario Comparison, including both worker smoke variants.
 *
 * Start `npm run dev -- --port 5179 --strictPort` and a dedicated headless Chrome with
 * --headless=new --remote-debugging-port=9229 --user-data-dir=/tmp/capital-chunk8-chrome, then run
 * with Node 24: `node tests/browser-scenario-ui.mjs`. Override APP_PORT / CDP_PORT to use others.
 * Outputs JSON and PNGs into /tmp. Do not edit application source while this runs: a Vite reload
 * resets the deliberately in-memory profile.
 *
 * It exercises the whole package-8 contract in a real browser: versioned local persistence across a
 * page reload, migration and rejection of stored data, scenario independence, the full 60-cell
 * matrix at the entered path count, progress, cancellation, stale-result invalidation, an explicit
 * labelled preview, and desktop plus mobile layout without horizontal overflow.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const appPort = process.env.APP_PORT ?? '5179';
const cdpPort = process.env.CDP_PORT ?? '9229';
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
const clickIn = async (selector, text) => ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)}+' button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.click();})()`);
const set = async (elementId, value) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(elementId)});if(!e)throw Error('Missing input '+${JSON.stringify(elementId)});const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const choose = async (labelText, value) => ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(labelText)});if(!l)throw Error('Missing label '+${JSON.stringify(labelText)});const s=document.getElementById(l.htmlFor);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(value)});s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const text = () => ev('document.body.innerText');
const rowCount = testid => ev(`document.querySelectorAll("[data-testid=${testid}] tbody tr").length`);
const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };
const tab = async name => { await ev(`document.getElementById("tab-${name}").click()`); await new Promise(r => setTimeout(r, 200)); };
const openScenarios = async () => { await wait('!!document.getElementById("tab-scenarios")'); await tab('scenarios'); await wait('!!document.getElementById("scenario.name")'); };
const desktop = () => cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
const mobile = () => cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

await cdp('Runtime.enable'); await cdp('Page.enable');
const results = { errors };

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
// A clean library so repeated runs are deterministic.
await ev('localStorage.removeItem("capital-allocation.scenarios")');
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await openScenarios();
assert.equal(await ev('[...document.querySelectorAll(".nav-item")].length'), 8);
assert.equal(await ev('!!document.querySelector("#tab-scenarios .nav-item-flag")'), false, 'Scenario Comparison must no longer be flagged as planned');

// ---- Named scenarios, versioned persistence and independence -------------------------------
await set('scenario.name', 'Baseline');
await click('Save current profile as a scenario');
await wait('!!document.querySelector("[data-testid=scenario-library]")');
for (const preset of ['ISA Heavy', 'Pension Heavy', 'Income Growth', 'Aggressive FIRE']) await click(preset);
assert.equal(await rowCount('scenario-library'), 5);
results.libraryRows = 5;
const libraryText = () => ev('document.querySelector("[data-testid=scenario-library]").innerText');
// The design system uppercases table headings, so every text probe ignores case.
assert.match(await libraryText(), /income growth/i);
assert.match(await libraryText(), /£65,000/);
// Independence: the Income Growth scenario holds £65,000 while Baseline still holds £55,000.
assert.match(await libraryText(), /£55,000/);
await clickIn('[data-testid=scenario-library] tbody tr:nth-child(2)', 'Duplicate');
assert.equal(await rowCount('scenario-library'), 6);
assert.match(await libraryText(), /isa heavy copy/i);
await clickIn('[data-testid=scenario-library] tbody tr:nth-child(6)', 'Delete');
assert.equal(await rowCount('scenario-library'), 5);

// Persistence across a real page reload, then rejection and migration of stored documents.
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await openScenarios();
assert.equal(await rowCount('scenario-library'), 5, 'the saved library must survive a page reload');
assert.match(await text(), /Loaded 5 scenario\(s\) saved at/);
results.reloadPersisted = true;
const stored = await ev('localStorage.getItem("capital-allocation.scenarios")');
const parsed = JSON.parse(stored);
assert.equal(parsed.version, '2');
assert.equal(parsed.scenarios.length, 5);
assert.equal(parsed.scenarios[0].profile.income.salaryAnnual, 55000);
assert.equal(parsed.scenarios.find(s => s.origin === 'income_growth').profile.income.salaryAnnual, 65000);

const corrupt = JSON.parse(stored);
corrupt.scenarios[0].profile.income.salaryAnnual = -1;
await ev(`localStorage.setItem("capital-allocation.scenarios",${JSON.stringify(JSON.stringify(corrupt))})`);
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await openScenarios();
assert.match(await text(), /Saved scenarios could not be loaded/);
assert.match(await text(), /salaryAnnual/);
assert.equal(await ev('!!document.querySelector("[data-testid=scenario-library]")'), false, 'a refused document must load nothing');
results.rejectedInvalidStorage = true;

const legacy = { kind: 'capital-allocation/scenario-library', version: '1', savedAt: '2026-01-01T00:00:00.000Z',
  scenarios: [{ schemaVersion: '1', id: 'old-baseline', name: 'Old baseline', profile: parsed.scenarios[0].profile }] };
await ev(`localStorage.setItem("capital-allocation.scenarios",${JSON.stringify(JSON.stringify(legacy))})`);
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await openScenarios();
assert.match(await text(), /Migrated 1 scenario\(s\) from schema 1/);
assert.equal(await rowCount('scenario-library'), 1);
results.migratedOnLoad = true;

// Import an invalid document, then rebuild the library for the comparisons.
await ev('document.querySelector("details summary").click()');
await wait('!!document.getElementById("scenario.transfer")');
await set('scenario.transfer', '{"kind":"capital-allocation/scenario-library","version":"99","savedAt":"x","scenarios":[]}');
await click('Import from the box');
assert.match(await text(), /Unsupported scenario library version/);
results.rejectedUnknownVersion = true;
await ev('localStorage.removeItem("capital-allocation.scenarios")');
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await openScenarios();
await set('scenario.name', 'Baseline');
await click('Save current profile as a scenario');
await click('ISA Heavy');
await click('Pension Heavy');
assert.equal(await rowCount('scenario-library'), 3);

// ---- The required matrix at the entered path count --------------------------------------------
assert.match(await ev('document.querySelector("[data-testid=scenario-announcement]").textContent'), /600,000 lifetime projections/);
assert.match(await text(), /never reduced to finish sooner/);
await set('scenario.salary3', 'bad');
assert.equal(await ev('[...document.querySelectorAll("button")].find(b=>b.textContent==="Run comparison").disabled'), true);
results.invalidControlBlocks = true;
await set('scenario.salary3', 75000);

await ev('window.frames8=0;window.gap8=0;window.measure8=true;window.last8=performance.now();requestAnimationFrame(function f(t){window.frames8++;window.gap8=Math.max(window.gap8,t-window.last8);window.last8=t;if(window.measure8)requestAnimationFrame(f)});');
let started = Date.now();
await click('Run comparison');
await wait('document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow") > 0', 180000);
results.progress = true;
const heartbeat = setInterval(() => {
  void ev('document.querySelector("[role=status] p")?.textContent ?? "no status"')
    .then(line => console.log(`  ${((Date.now() - started) / 1000).toFixed(0)}s ${line}`), () => {});
}, 20000);
await wait('!!document.querySelector("[data-testid=scenario-result]")', 1_200_000).finally(() => clearInterval(heartbeat));
results.matrixSeconds = (Date.now() - started) / 1000;
results.frames = await ev('({count:window.frames8,maxGap:window.gap8})');
await ev('window.measure8=false');
assert.equal(await rowCount('scenario-rows'), 60);
assert.equal(await rowCount('scenario-matrix'), 15);
assert.equal(await ev('document.querySelectorAll("[data-testid=scenario-matrix] thead th").length'), 6);
results.matrixText = await text();
assert.match(results.matrixText, /scenarios evaluated/i);
assert.match(results.matrixText, /moves FIRE success most/);
assert.equal(await ev('document.body.innerText.includes("PREVIEW")'), false, 'a full-count run must not be labelled a preview');
assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'), false);
results.matrixRowSample = await ev('document.querySelector("[data-testid=scenario-rows] tbody tr").innerText');
results.matrixGridSample = await ev('document.querySelector("[data-testid=scenario-matrix] tbody tr").innerText');
results.summary = await ev('[...document.querySelectorAll(".stat-value")].map(e=>e.textContent)');
await shot('chunk8-desktop');
await ev('document.querySelector("[data-testid=scenario-matrix]").scrollIntoView()');
await shot('chunk8-matrix-desktop');
console.log('matrix completed', results.matrixSeconds, JSON.stringify(results.frames));

// ---- Stale-result invalidation -----------------------------------------------------------------
await set('scenario.salary5', 130000);
await wait('!document.querySelector("[data-testid=scenario-result]")');
assert.match(await text(), /previous comparison was discarded/);
results.staleOnAxisEdit = true;
await set('scenario.salary5', 120000);

// ---- Cancellation after real progress ----------------------------------------------------------
await click('Run comparison');
await wait('document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow") > 0', 180000);
await click('Cancel');
await wait('document.body.innerText.includes("Run cancelled")');
assert.equal(await ev('!!document.querySelector("[data-testid=scenario-result]")'), false);
assert.match(await text(), /No partial matrix is published/);
results.cancelled = true;

// ---- Spending sensitivity at full count, both effects -------------------------------------------
await choose('What to compare', 'spending');
started = Date.now();
await click('Run comparison');
await wait('!!document.querySelector("[data-testid=spending-effects]")', 600000);
results.spendingSeconds = (Date.now() - started) / 1000;
assert.equal(await rowCount('spending-effects'), 3);
const spendingRows = await ev('[...document.querySelectorAll("[data-testid=spending-effects] tbody tr")].map(r=>[...r.children].map(c=>c.innerText))');
results.spendingRows = spendingRows;
const amount = value => Number(value.replace(/[^0-9.-]/g, ''));
assert.ok(amount(spendingRows[0][1]) > amount(spendingRows[2][1]), 'surplus must fall as the spending case rises');
assert.ok(amount(spendingRows[0][4]) < amount(spendingRows[2][4]), 'the capital target must rise as the spending case rises');
assert.ok(amount(spendingRows[0][3]) < amount(spendingRows[2][3]));
console.log('spending completed', results.spendingSeconds, JSON.stringify(spendingRows));

// ---- An explicit, labelled preview --------------------------------------------------------------
await click('Run a reduced-path preview instead');
await wait('!!document.getElementById("scenario.previewPaths")');
assert.match(await ev('document.querySelector("[data-testid=scenario-announcement]").textContent'), /PREVIEW/);
await wait('!document.querySelector("[data-testid=scenario-result]")');
started = Date.now();
await click('Run comparison');
await wait('!!document.querySelector("[data-testid=scenario-result]")', 600000);
results.previewSeconds = (Date.now() - started) / 1000;
assert.match(await text(), /PREVIEW — 1000 of 10000 paths/);
assert.match(await text(), /not a full-count result/);
results.previewLabelled = true;
await click('Run a reduced-path preview instead');
await wait('!document.querySelector("[data-testid=scenario-result]")');

// ---- Saved scenarios compared on the same paths, at mobile width ----------------------------------
await mobile();
await ev('scrollTo(0,0)');
await choose('What to compare', 'library');
started = Date.now();
await click('Run comparison');
await wait('!!document.querySelector("[data-testid=scenario-result]")', 600000);
results.librarySeconds = (Date.now() - started) / 1000;
assert.equal(await rowCount('scenario-rows'), 3);
results.libraryText = await ev('document.querySelector("[data-testid=scenario-rows]").innerText');
assert.match(results.libraryText, /baseline/i);
assert.match(results.libraryText, /isa heavy/i);
assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'), false);
await shot('chunk8-mobile');
await ev('document.querySelector("[data-testid=scenario-result]").scrollIntoView()');
await shot('chunk8-mobile-results');
await desktop();
await ev('document.querySelector("[data-testid=scenario-rows]").scrollIntoView()');
await shot('chunk8-library-desktop');
console.log('library completed', results.librarySeconds);

assert.equal(errors.length, 0, JSON.stringify(errors));
await fs.writeFile('/tmp/chunk8-ui-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify({ matrixSeconds: results.matrixSeconds, spendingSeconds: results.spendingSeconds,
  previewSeconds: results.previewSeconds, librarySeconds: results.librarySeconds, frames: results.frames, passed: true }));
finished = true;
ws.close();
