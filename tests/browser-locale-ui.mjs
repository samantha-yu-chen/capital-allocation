/** Manual Chrome/CDP localization acceptance. APP_PORT/CDP_PORT override defaults.
 * This is incremental evidence for shell, inputs, glossary, onboarding and FIRE only.
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
await ev(`localStorage.clear()`);await nav('/');await wait(`!!document.querySelector('.language-picker select')`);
assert.equal(await ev('document.documentElement.lang'),'en');
await locale('zh-TW');
assert.equal(await ev(`document.querySelector('#wizard-title').textContent`),'建立計畫輪廓');
assert.equal(await ev(`document.querySelectorAll('.starter-card').length`),6);
assert.equal(await ev(`document.querySelector('.starter-card h4').textContent`),'完整範例');
results.wizardTranslated=true;
await ev(`document.getElementById('tab-overview').click()`);await settle();
const salary=()=>ev(`document.getElementById('income.salaryAnnual').value`);
const originalSalary=await salary();
await set('income.salaryAnnual','56000');
await locale('en');assert.equal(await salary(),'56,000');
await locale('zh-TW');assert.equal(await salary(),'56,000');
await ev(`[...document.querySelectorAll('.glossary-bar .glossary-term')].find(e=>e.textContent.startsWith('今日幣值')).click()`);await settle();
assert.match(await ev(`document.querySelector('.glossary-panel-body').textContent`),/今日幣值/);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
await set('income.salaryAnnual','55000');assert.equal(await salary(),originalSalary);
results.inputsPreserved=true;
assert.match(await ev(`document.querySelector('#panel-overview').innerText`),/目前資產狀況/);
assert.match(await ev(`document.querySelector('#panel-overview').innerText`),/期初餘額/);
await ev(`document.querySelector('[data-testid="open-learn"]').click()`);await settle();
assert.equal(await ev(`document.querySelectorAll('.learn-section').length`),5);
assert.equal(await ev(`document.querySelectorAll('.learn-screen').length`),8);
assert.match(await ev(`document.querySelector('[data-testid="learn-panel"]').innerText`),/模型如何計算一年/);
await locale('en');
assert.match(await ev(`document.querySelector('[data-testid="learn-panel"]').innerText`),/What one year of the model does/);
await locale('zh-TW');
await ev(`document.querySelector('[data-testid="learn-close"]').click()`);await settle();
results.overviewAndLearnTranslated=true;

for (const id of ['overview','fire','curve','marginal','solver','scenarios','property','attribution']) {
  await ev(`document.getElementById('tab-${id}').click()`);await settle();
  assert.equal(await ev(`document.querySelector('[role=tabpanel]').id`),'panel-'+id);
}
results.eightTabsReachable=true;
await ev(`document.getElementById('tab-fire').click()`);await settle();
await click('執行 10,000 條路徑');
await wait(`!!document.querySelector('[role=progressbar]')`);
await locale('en');
await wait(`!!document.querySelector('.stat-hero')`,180000);
assert.equal(await ev(`document.querySelector('.stat-hero').textContent`),'68.98%');
await locale('zh-TW');
assert.equal(await ev(`document.querySelector('.stat-hero').textContent`),'68.98%');
assert.match(await ev(`document.querySelector('.stat-hero').closest('.card').innerText`),/已執行全部指定路徑/);
results.fireProbability='68.98%';results.switchDuringRun=true;results.switchAfterRun=true;
const originalSeed=await ev(`document.getElementById('simulation.seed').value`);
await set('simulation.seed','20261010');
await wait(`!document.querySelector('.stat-hero')`);results.staleResultDiscarded=true;
await set('simulation.seed',originalSeed);

await click('執行 10,000 條路徑');await wait(`!!document.querySelector('[role=progressbar]')`);
await click('取消');assert.equal(await ev(`!!document.querySelector('.stat-hero')`),false);
results.cancelled=true;
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await settle();results.mobileOverflow=await ev('document.documentElement.scrollWidth-innerWidth');
assert.equal(results.mobileOverflow,0);await shot('zh-tw-fire-mobile');
await nav('/');await wait(`!!document.querySelector('.language-picker select')`);
assert.equal(await ev('document.documentElement.lang'),'zh-TW');results.persisted=true;
assert.equal(errors.length,0);await fs.writeFile('/tmp/zh-tw-ui-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));finished=true;ws.close();
