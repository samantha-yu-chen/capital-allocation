/** Manual Chrome/CDP localization acceptance. APP_PORT/CDP_PORT override defaults.
 * This is incremental evidence for marginal allocation and property only.
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
for (const property of [false,true]) {
  await nav('/tests/browser-worker-smoke.html'+(property?'?property':''));
  const smoke=JSON.parse(await wait(`(()=>{const t=document.querySelector('#result')?.textContent;if(t?.startsWith('FAILED'))throw Error(t);return t?.includes('"passed"')?t:null;})()`,180000));
  assert.equal(smoke.passed,true);assert.equal(smoke.count,10000);
  results[property?'propertySmoke':'baselineSmoke']=smoke;
}
await nav('/');await wait(`!!document.querySelector('.language-picker select')`);
await ev('localStorage.clear()');await nav('/');await wait(`!!document.querySelector('.language-picker select')`);
await locale('zh-TW');
const tab=async id=>{await ev(`document.getElementById('tab-${id}').click()`);await settle();};
const measure=()=>ev(`window.localeFrames=0;window.localeMaxGap=0;window.localeMeasure=true;window.localeLast=performance.now();requestAnimationFrame(function f(t){window.localeFrames++;window.localeMaxGap=Math.max(window.localeMaxGap,t-window.localeLast);window.localeLast=t;if(window.localeMeasure)requestAnimationFrame(f)});`);
const endMeasure=async()=>{const p=await ev(`({frames:window.localeFrames,maxGap:window.localeMaxGap})`);await ev('window.localeMeasure=false');return p;};
const mobile=async selector=>{await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();const overflow=await ev('document.documentElement.scrollWidth-innerWidth');assert.equal(overflow,0);await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);await settle();return overflow;};
const desktop=()=>cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
await tab('marginal');await set('marginal.amount','bad');assert.match(await ev(`document.querySelector('.field-error').textContent`),/有效的有限數值/);assert.equal(await ev(`document.querySelector('button.btn-primary').disabled`),true);await set('marginal.amount',1000);
assert.match(await ev('document.body.innerText'),/70,000 個完整人生推估/);
await measure();await click('比較資金配置');await wait(`!!document.querySelector('[role=progressbar]')`);await locale('en');
await wait(`!!document.querySelector('[data-testid=marginal-result]')`,300000);results.marginalPerformance=await endMeasure();
const englishCards=await ev(`Array.from(document.querySelectorAll('[data-testid=marginal-result] .split > .card'),e=>e.innerText)`);
assert.equal(englishCards.length,6);await locale('zh-TW');
const chineseCards=await ev(`Array.from(document.querySelectorAll('[data-testid=marginal-result] .split > .card'),e=>e.innerText)`);
for(let i=0;i<6;i++)assert.deepEqual(chineseCards[i].match(/\d+(?:[,.]\d+)*/g),englishCards[i].match(/\d+(?:[,.]\d+)*/g));
assert.doesNotMatch(chineseCards.join(' '),/pension added|not cleared by|requires an existing|requires a configured|taxable band/);
results.marginalCards=chineseCards.map(t=>t.slice(0,160));
results.marginalMobileOverflow=await mobile('[data-testid=marginal-result]');await shot('zh-tw-marginal-mobile');await desktop();
await set('marginal.amount',2000);await wait(`!document.querySelector('[data-testid=marginal-result]')`);results.marginalInvalidated=true;
await click('比較資金配置');await wait(`!!document.querySelector('[role=progressbar]')`);await click('取消');assert.equal(await ev(`!!document.querySelector('[data-testid=marginal-result]')`),false);results.marginalCancelled=true;
await tab('property');
await ev(`[...document.querySelectorAll('input[type=checkbox]')].find(e=>e.closest('label')?.textContent.includes('納入房產')).click()`);await settle();await wait(`!!document.getElementById('property.purchase.deposit')`);
await set('spending.currentRentMonthlyIncluded',700);
assert.match(await ev('document.body.innerText'),/每年住房現金流出/);
await measure();await click('比較 10,000 組配對路徑');await wait(`!!document.querySelector('[role=status]')?.textContent.match(/^[0-9,]+／/)`);await locale('en');
await wait(`!!document.querySelector('[data-testid=property-comparison-result]')`,180000);results.propertyPerformance=await endMeasure();
const englishRows=await ev(`Array.from(document.querySelectorAll('[data-testid=property-comparison-result] tbody tr'),r=>Array.from(r.cells,c=>c.textContent))`);
await locale('zh-TW');const chineseRows=await ev(`Array.from(document.querySelectorAll('[data-testid=property-comparison-result] tbody tr'),r=>Array.from(r.cells,c=>c.textContent))`);
assert.deepEqual(chineseRows.map(r=>r.slice(1)),englishRows.map(r=>r.slice(1)));assert.equal(chineseRows[0][0],'FIRE 成功率');results.propertyRows=chineseRows;
results.propertyMobileOverflow=await mobile('[data-testid=property-comparison-result]');await shot('zh-tw-property-mobile');await desktop();
await set('property.purchase.deposit',61000);await wait(`!document.querySelector('[data-testid=property-comparison-result]')`);results.propertyInvalidated=true;
await click('比較 10,000 組配對路徑');await wait(`!!document.querySelector('[role=status]')?.textContent.match(/^[0-9,]+／/)`);await click('取消比較');await wait(`document.body.innerText.includes('比較已取消')`);assert.equal(await ev(`!!document.querySelector('[data-testid=property-comparison-result]')`),false);results.propertyCancelled=true;
assert.equal(Number(await ev(`document.getElementById('simulation.count')?.value ?? '10000'`)),10000);
for(const perf of [results.marginalPerformance,results.propertyPerformance]){assert.ok(perf.frames>30);assert.ok(perf.maxGap<250);}
assert.equal(errors.length,0);await fs.writeFile('/tmp/zh-tw-property-ui-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));finished=true;ws.close();
