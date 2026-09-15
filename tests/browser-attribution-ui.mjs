/** Package 9 real Chrome acceptance: both worker smokes, full-count attribution on desktop,
 * a configured-property full-count mobile run, cancellation, invalidation and layout.
 * Start a fresh isolated Chrome for each harness. APP_PORT=5180 CDP_PORT=9230 node this-file.
 * Outputs /tmp/chunk9-ui-results.json and /tmp/chunk9-*.png. No source edits during a run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const appPort = process.env.APP_PORT ?? '5180';
const cdpPort = process.env.CDP_PORT ?? '9230';
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
await cdp('Page.navigate', {url:`http://127.0.0.1:${appPort}/`});
await wait('!!document.getElementById("tab-attribution")');await tab('attribution');
assert.equal(await ev('!!document.querySelector("#tab-attribution .nav-item-flag")'),false);
await set('attribution.stressAge','');assert.equal(await ev('[...document.querySelectorAll("button")].find(b=>b.textContent==="Compute levers and stresses").disabled'),true);
await set('attribution.stressAge',45);
await click('Compute levers and stresses');await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow"))>0');await click('Cancel');
await wait('document.body.innerText.includes("Run cancelled")');assert.equal(await ev('!!document.querySelector("[data-testid=attribution-result]")'),false);results.cancellation=true;
await ev('window.framesSeen=0;window.maxGap=0;window.measure=true;window.lastFrame=performance.now();requestAnimationFrame(function f(t){window.framesSeen++;window.maxGap=Math.max(window.maxGap,t-window.lastFrame);window.lastFrame=t;if(window.measure)requestAnimationFrame(f)});');
let started=Date.now();await click('Compute levers and stresses');
await wait('!!document.querySelector("[data-testid=attribution-result]") || document.body.innerText.includes("Analysis could not be computed")',900000);
assert.equal(await ev('!!document.querySelector("[data-testid=attribution-result]")'),true,await text());
results.desktop={seconds:(Date.now()-started)/1000,frames:await ev('window.framesSeen'),maxGap:await ev('window.maxGap'),text:await text()};await ev('window.measure=false');
assert.ok(results.desktop.text.includes('68.98%'));assert.ok(results.desktop.text.includes('Within sampling uncertainty'));assert.ok(results.desktop.frames>100);assert.ok(results.desktop.maxGap<250);
assert.equal(await ev('document.documentElement.scrollWidth-innerWidth'),0);
await ev('document.querySelector("[data-testid=attribution-result]").scrollIntoView()');await shot('chunk9-desktop-results');
console.log('attribution desktop',results.desktop.seconds,results.desktop.frames,results.desktop.maxGap);
await mobile();assert.equal(await ev('document.documentElement.scrollWidth-innerWidth'),0);await shot('chunk9-mobile-results');
await set('attribution.stressAge',44);await wait('!document.querySelector("[data-testid=attribution-result]")');assert.ok((await text()).includes('previous analysis was discarded'));results.stale=true;
// Real configured property and full-count mobile run, not a reduced-count preview.
await tab('property');await click('Include a property');await wait('!!document.getElementById("property.purchase.deposit")');await set('spending.currentRentMonthlyIncluded',700);
await tab('attribution');await set('attribution.stressAge',31);
started=Date.now();await click('Compute levers and stresses');
await wait('!!document.querySelector("[data-testid=attribution-result]") || document.body.innerText.includes("Analysis could not be computed")',900000);
assert.equal(await ev('!!document.querySelector("[data-testid=attribution-result]")'),true,await text());
results.mobileProperty={seconds:(Date.now()-started)/1000,text:await text()};
await fs.writeFile('/tmp/chunk9-ui-results.json',JSON.stringify(results,null,2));
assert.ok(results.mobileProperty.text.includes('35.18%'));assert.ok(results.mobileProperty.text.toLowerCase().includes('mortgage shock'));
assert.equal(await ev('document.documentElement.scrollWidth-innerWidth'),0);await ev('document.querySelector("[data-testid=attribution-result]").scrollIntoView()');await shot('chunk9-property-mobile');
console.log('attribution property mobile',results.mobileProperty.seconds);
await set('attribution.stressAge',32);await wait('!document.querySelector("[data-testid=attribution-result]")');
await click('Compute levers and stresses');await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow"))>0');await set('personal.targetSuccessProbability',91);
await wait('[...document.querySelectorAll("button")].find(b=>b.textContent==="Cancel")?.disabled === true');
assert.equal(await ev('!!document.querySelector("[data-testid=attribution-result]")'),false);
assert.equal(errors.length,0);results.errors=errors;
await fs.writeFile('/tmp/chunk9-ui-results.json',JSON.stringify(results,null,2));
finished=true;ws.close();console.log('all attribution browser checks passed');
