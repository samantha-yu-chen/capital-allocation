/** Manual Chrome/CDP localization acceptance. APP_PORT/CDP_PORT override defaults.
 * This is incremental evidence for attribution only.
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
const resultText=()=>ev(`document.querySelector('[data-testid=attribution-result]').innerText`);
await tab('attribution');await set('attribution.stressAge','');assert.equal(await ev(`document.querySelector('button.btn-primary').disabled`),true);assert.match(await ev(`document.querySelector('.field-error').textContent`),/整數壓力測試年齡/);await set('attribution.stressAge',45);
for (const property of [false,true]) {
  if(property){
    await tab('property');await ev(`[...document.querySelectorAll('input[type=checkbox]')].find(e=>e.closest('label')?.textContent.includes('納入房產')).click()`);await settle();await wait(`!!document.getElementById('property.purchase.deposit')`);await set('spending.currentRentMonthlyIncluded',700);await tab('attribution');await set('attribution.stressAge',31);
    await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  }
  assert.equal(Number(await ev(`document.getElementById('simulation.count').value`)),10000);
  console.log('Starting full-count attribution',property?'property mobile':'baseline desktop');
  const started=Date.now();await measure();await click('計算調整效果與壓力測試');await wait(`!!document.querySelector('[role=progressbar]')`);await locale('en');
  await wait(`!!document.querySelector('[data-testid=attribution-result]')`,900000);
  const perf=await endMeasure(),english=await resultText();
  assert.ok(english.includes(property?'35.18%':'68.98%'));
  assert.equal(await ev(`document.querySelectorAll('[data-testid=attribution-result] table tbody tr').length`),28);
  assert.equal(await ev(`document.querySelectorAll('[data-testid=attribution-result] .split > .card').length`),7);
  await locale('zh-TW');const chinese=await resultText();
  assert.deepEqual(chinese.match(/\d+(?:[,.]\d+)*/g),english.match(/\d+(?:[,.]\d+)*/g));
  assert.doesNotMatch(chinese,/First five FIRE|when present|when absent|real shortfall|nominal means|Configure a property|recovered paths|observed recovery|Synthetic adverse/);
  assert.match(chinese,/FIRE 後最初五年/);assert.match(chinese,/2000 式崩盤/);assert.match(chinese,/失業/);
  const overflow=await ev('document.documentElement.scrollWidth-innerWidth');assert.equal(overflow,0);
  results[property?'propertyMobile':'baselineDesktop']={seconds:(Date.now()-started)/1000,...perf,overflow};
  assert.ok(perf.frames>100);assert.ok(perf.maxGap<250);
  await ev(`document.querySelector('[data-testid=attribution-result]').scrollIntoView({block:'start'})`);await settle();await shot(property?'zh-tw-attribution-property-mobile':'zh-tw-attribution-desktop');
  if(!property){await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();assert.equal(await ev('document.documentElement.scrollWidth-innerWidth'),0);await shot('zh-tw-attribution-mobile');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});}
  await set('attribution.stressAge',property?32:44);await wait(`!document.querySelector('[data-testid=attribution-result]')`);
  assert.match(await ev('document.body.innerText'),/先前分析已清除/);
  await click('計算調整效果與壓力測試');await wait(`!!document.querySelector('[role=progressbar]')`);await click('取消');assert.equal(await ev(`!!document.querySelector('[data-testid=attribution-result]')`),false);
  console.log('Full-count attribution passed',property?'property mobile':'baseline desktop',results[property?'propertyMobile':'baselineDesktop']);
}
results.invalidated=true;results.cancelled=true;assert.equal(errors.length,0);await fs.writeFile('/tmp/zh-tw-attribution-ui-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));finished=true;ws.close();
