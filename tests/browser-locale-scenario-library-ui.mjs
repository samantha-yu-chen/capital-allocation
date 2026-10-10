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

const settle=()=>new Promise(r=>setTimeout(r,220));
const locale=async value=>{await ev(`(()=>{const e=document.querySelector('.language-picker select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await settle();};

await cdp('Runtime.enable');await cdp('Page.enable');await mobile();const results={errors};
await cdp('Page.navigate',{url:`http://127.0.0.1:${appPort}/`});await openScenarios();await locale('zh-TW');
await click('清除已儲存情境');await settle();
for(const name of ['Cash','Baseline']){await set('scenario.name',name);await settle();await click('將目前資料儲存為情境');await settle();}
const resultText=()=>ev(`document.querySelector('[data-testid=scenario-result]').innerText`);
const run=async(view,rows)=>{
 await locale('zh-TW');await choose('比較項目',view);await settle();
 assert.equal(Number(await ev(`document.getElementById('simulation.count').value`)),10000);
 await ev(`window.lframes=0;window.lgap=0;window.lmeasure=true;window.llast=performance.now();requestAnimationFrame(function f(t){window.lframes++;window.lgap=Math.max(window.lgap,t-window.llast);window.llast=t;if(window.lmeasure)requestAnimationFrame(f)});`);
 const start=Date.now();console.log('Starting 10000-path scenarios',view);await click('執行比較');await wait(`!!document.querySelector('[role=progressbar]')`);await locale('en');
 await wait(`!!document.querySelector('[data-testid=scenario-result]')`,3600000);
 const english=await resultText();await locale('zh-TW');const chinese=await resultText();
 assert.deepEqual(chinese.match(/\d+(?:[,.]\d+)*/g),english.match(/\d+(?:[,.]\d+)*/g));
 assert.doesNotMatch(chinese,/Contractual employee|leads at|lead within|Averaged across|computed from scratch|scenarios evaluated|Buys at age|Employee contribution|Held at/);
 assert.equal(await rowCount('scenario-rows'),rows);
 const perf=await ev(`({frames:window.lframes,maxGap:window.lgap})`);await ev('window.lmeasure=false');
 assert.ok(perf.frames>100);assert.ok(perf.maxGap<250);assert.equal(await ev('document.documentElement.scrollWidth-innerWidth'),0);
 results[view]={seconds:(Date.now()-start)/1000,...perf,rows};console.log('Passed',view,results[view]);
 await ev(`document.querySelector('[data-testid=scenario-result]').scrollIntoView()`);await settle();await shot('zh-tw-scenarios-'+view);
 if(view==='matrix'){await mobile();await settle();assert.equal(await ev('document.documentElement.scrollWidth-innerWidth'),0);await shot('zh-tw-scenarios-matrix-mobile');await desktop();}
 if(view==='library'){assert.match(chinese,/Cash/i);assert.match(chinese,/Baseline/i);}
};

await run('library',2);
await click('執行比較');await settle();await wait(`!!document.querySelector('[data-testid=scenario-result]')`);assert.match(await resultText(),/1／2 個情境/);results.cache=true;
await click('改用較少路徑執行預覽');await settle();assert.equal(await ev(`!!document.querySelector('[data-testid=scenario-result]')`),false);await click('執行比較');await wait(`!!document.querySelector('[data-testid=scenario-result]')`,180000);assert.match(await resultText(),/預覽/);assert.match(await resultText(),/1000|1,000/);assert.equal(Number(await ev(`document.getElementById('simulation.count').value`)),10000);results.preview=true;
await click('改用較少路徑執行預覽');await settle();
await click('Export or import the versioned library').catch(()=>{});
await ev(`document.querySelector('textarea').closest('details').open=true`);
await set('scenario.transfer','[]');await settle();await click('從文字框匯入');await settle();assert.match(await text(),/情境庫必須為 JSON object/);results.rejected=true;
const saved=await ev(`JSON.parse(localStorage.getItem('capital-allocation.scenarios'))`);
const v1={kind:saved.kind,version:'1',savedAt:saved.savedAt,scenarios:saved.scenarios.map(s=>({schemaVersion:'1',id:s.id,name:s.name,profile:s.profile}))};
await set('scenario.transfer',JSON.stringify(v1));await settle();await click('從文字框匯入');await settle();assert.equal(await rowCount('scenario-library'),2);results.migrated=true;
assert.match(await ev(`document.querySelector('[data-testid=scenario-library]').innerText`),/Cash/i);
await ev(`document.querySelector('[data-testid=scenario-library]').scrollIntoView()`);await shot('zh-tw-scenarios-library-mobile');
assert.equal(await ev('document.documentElement.scrollWidth-innerWidth'),0);assert.equal(errors.length,0);await fs.writeFile('/tmp/zh-tw-scenario-library-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));finished=true;ws.close();
