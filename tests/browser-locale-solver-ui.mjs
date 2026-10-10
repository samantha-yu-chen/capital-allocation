/** Manual Chrome/CDP curve and solver localization acceptance. APP_PORT/CDP_PORT override defaults.
 * This is incremental evidence for curve and solver only.
 * It does not yet certify all eight screen bodies are translated.
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


const results = { errors };
const locale = async value => {
  await ev(`(()=>{const e=document.querySelector('.language-picker select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.documentElement.lang===${JSON.stringify(value)}`);
  await settle();
};
const click = async label => {
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click();})()`);
  await settle();
};
await cdp('Runtime.enable');await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
await nav('/');await wait(`!!document.querySelector('.language-picker select')`);
await ev('localStorage.clear()');await nav('/');await wait(`!!document.querySelector('.language-picker select')`);
await locale('zh-TW');
const tab = async id => { await ev(`document.getElementById('tab-${id}').click()`);await settle(); };
const hero = () => ev(`document.querySelector('.stat-hero')?.textContent ?? null`);
const measure = async () => ev(`window.localeFrames=0;window.localeMaxGap=0;window.localeMeasure=true;window.localeLast=performance.now();requestAnimationFrame(function f(t){window.localeFrames++;window.localeMaxGap=Math.max(window.localeMaxGap,t-window.localeLast);window.localeLast=t;if(window.localeMeasure)requestAnimationFrame(f)});`);
await tab('curve');await set('curve.fromAge',45);await set('curve.toAge',47);
assert.match(await ev('document.body.innerText'),/本次會執行 3 次完整模擬/);
await measure();await click('計算 3 個年齡');await wait(`!!document.querySelector('[role=progressbar]')`);
await locale('en');await wait(`!!document.querySelector('.stat-hero')`,300000);
results.curvePerformance=await ev(`({frames:window.localeFrames,maxGap:window.localeMaxGap})`);await ev('window.localeMeasure=false');
results.curveEnglishHero=await hero();
results.curveEnglishRows=await ev(`Array.from(document.querySelectorAll('table tbody tr'),r=>Array.from(r.cells,c=>c.textContent))`);
assert.equal(results.curveEnglishRows.length,3);assert.equal(results.curveEnglishRows[0][1],'68.98%');
await locale('zh-TW');results.curveChineseHero=await hero();
const chineseRows=await ev(`Array.from(document.querySelectorAll('table tbody tr'),r=>Array.from(r.cells,c=>c.textContent))`);
assert.deepEqual(chineseRows.map(r=>r.slice(0,6)),results.curveEnglishRows.map(r=>r.slice(0,6)));
assert.match(await ev(`document.querySelector('.chart').getAttribute('aria-label')`),/各 FIRE 年齡的成功率/);
assert.match(await ev('document.body.innerText'),/沒有 FIRE 年齡|成功率為/);
assert.equal(Number(await ev(`document.getElementById('simulation.count').value`)),10000);
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();
results.curveMobileOverflow=await ev('document.documentElement.scrollWidth-innerWidth');assert.equal(results.curveMobileOverflow,0);await ev(`document.querySelector('.stat-hero').scrollIntoView({block:'start'})`);await settle();await shot('zh-tw-curve-mobile');
await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
await set('personal.targetSuccessProbability',85);await wait(`!document.querySelector('.stat-hero')`);results.curveInvalidated=true;
await set('personal.targetSuccessProbability',90);await click('計算 3 個年齡');await wait(`!!document.querySelector('[role=progressbar]')`);await click('取消');assert.equal(await hero(),null);results.curveCancelled=true;
await tab('solver');assert.equal(await ev(`document.querySelectorAll('[data-question]').length`),6);
await ev(`[...document.querySelectorAll('input[type=checkbox]')].find(e=>e.closest('label')?.textContent.includes('敏感度情境')).click()`);await settle();
assert.match(await ev('document.body.innerText'),/最多 [\d,]+ 次完整模擬/);
await measure();await click('求解我的稅前薪資');await wait(`!!document.querySelector('[role=progressbar]')`);
await locale('en');await wait(`!!document.querySelector('.answer-sentence')`,900000);
results.solverPerformance=await ev(`({frames:window.localeFrames,maxGap:window.localeMaxGap})`);await ev('window.localeMeasure=false');
results.solverEnglishHero=await hero();assert.equal(results.solverEnglishHero,'£87,600');
results.solverStatus=await ev(`document.querySelector('.answer-sentence').dataset.answerStatus`);assert.equal(results.solverStatus,'achieved');
const englishAnswer=await ev(`document.querySelector('.answer-sentence').textContent`);
await locale('zh-TW');assert.equal(await hero(),results.solverEnglishHero);
results.solverChineseAnswer=await ev(`document.querySelector('.answer-sentence').textContent`);
assert.doesNotMatch(await ev(`document.querySelector('.stat-hero').closest('.card').innerText`),/against a|re-checked against/);
assert.doesNotMatch(await ev('document.body.innerText'),/Pension input exceeds/);
assert.match(results.solverChineseAnswer,/已確認/);assert.doesNotMatch(results.solverChineseAnswer,/we confirmed|the search/);
assert.deepEqual(results.solverChineseAnswer.match(/\d+(?:[,.]\d+)*/g),englishAnswer.match(/\d+(?:[,.]\d+)*/g));
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();
results.solverMobileOverflow=await ev('document.documentElement.scrollWidth-innerWidth');assert.equal(results.solverMobileOverflow,0);await ev(`document.querySelector('.answer-sentence').scrollIntoView({block:'start'})`);await settle();await shot('zh-tw-solver-mobile');
await set('solver.target',85);await wait(`!document.querySelector('.answer-sentence')`);results.solverInvalidated=true;
await set('solver.target',90);await click('求解我的稅前薪資');await wait(`!!document.querySelector('[role=progressbar]')`);await click('取消');assert.equal(await hero(),null);results.solverCancelled=true;
await set('solver.bound',1000);assert.match(await ev(`document.querySelector('.field-error').textContent`),/邊界必須大於或等於目前值/);
for(const perf of [results.curvePerformance,results.solverPerformance]) { assert.ok(perf.frames>30);assert.ok(perf.maxGap<250); }
assert.equal(errors.length,0);await fs.writeFile('/tmp/zh-tw-solver-ui-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));finished=true;ws.close();
