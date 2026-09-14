/** Manual Chrome/CDP acceptance test for Marginal Allocation, including both worker smoke variants.
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
const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
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
const choose = async (labelText, value) => ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(labelText)});if(!l)throw Error('Missing label '+${JSON.stringify(labelText)});const s=document.getElementById(l.htmlFor);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(value)});s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const text = () => ev('document.body.innerText');
/** Card kickers are uppercased by the design system, so read values from the DOM, not innerText. */
const hero = () => ev('document.querySelector(".stat-hero")?.textContent ?? null');
const heroKicker = () => ev('document.querySelector(".stat-hero")?.closest(".card")?.querySelector(".card-kicker")?.textContent ?? null');
const statByKicker = pattern => ev(`(()=>{const c=[...document.querySelectorAll('.card')].find(c=>${pattern}.test(c.querySelector('.card-kicker')?.textContent??''));return c?.querySelector('.stat-value')?.textContent??null;})()`);
/** The design system uppercases kickers and tags, so every text probe ignores case. */
const has = pattern => `${pattern}.test(document.body.innerText)`;
const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };
const tab = async name => { await ev(`document.getElementById("tab-${name}").click()`); await new Promise(r => setTimeout(r, 200)); };


await cdp('Runtime.enable'); await cdp('Page.enable');
const results = { errors };
for (const suffix of ['', '?property']) {
  await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/tests/browser-worker-smoke.html${suffix}` });
  await wait('document.getElementById("result")?.textContent.includes("passed") || document.getElementById("result")?.textContent.startsWith("FAILED")', 180000);
  const value=await ev('document.getElementById("result").textContent');
  assert.ok(!value.startsWith('FAILED'),value);
  results[suffix ? 'propertySmoke' : 'smoke']=JSON.parse(value);
  console.log('smoke',suffix,value);
}
await cdp('Emulation.setDeviceMetricsOverride', { width:1440,height:950,deviceScaleFactor:1,mobile:false });
await cdp('Page.navigate', { url:`http://127.0.0.1:${appPort}/` });
await wait('!!document.getElementById("tab-marginal")');
await tab('marginal');
assert.match(await text(),/70,000 lifetime projections/);
await set('marginal.amount','bad');
assert.equal(await ev('[...document.querySelectorAll("button")].find(b=>b.textContent==="Compare allocation").disabled'),true);
await set('marginal.amount',1000);
await ev('window.frames7=0;window.gap7=0;window.measure7=true;window.last7=performance.now();requestAnimationFrame(function f(t){window.frames7++;window.gap7=Math.max(window.gap7,t-window.last7);window.last7=t;if(window.measure7)requestAnimationFrame(f)});');
let started=Date.now();
await click('Compare allocation');
await wait('document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow") > 0');
results.progress=true;
await wait('!!document.querySelector("[data-testid=marginal-result]")',300000);
results.grossSeconds=(Date.now()-started)/1000;
results.frames=await ev('({count:window.frames7,maxGap:window.gap7})');
await ev('window.measure7=false');
results.grossText=await text();
assert.match(results.grossText,/No destination clears all constraints/);
assert.match(results.grossText,/Mortgage overpayment requires an existing/);
assert.match(results.grossText,/pension added £1,000/);
assert.equal(await ev('document.querySelectorAll("[data-testid=marginal-result] .split > .card").length'),6);
assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'),false);
await shot('chunk7-desktop');
await ev('document.querySelector("[data-testid=marginal-result]").scrollIntoView()');
await shot('chunk7-desktop-results');
console.log('gross completed',results.grossSeconds,results.frames);
await set('marginal.amount',2000);
await wait('!document.querySelector("[data-testid=marginal-result]")');
assert.match(await text(),/previous allocation was discarded/);
results.staleAmount=true;
await click('Compare allocation');
await wait('document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow") > 0');
await click('Cancel');
await wait('document.body.innerText.includes("Run cancelled")');
assert.equal(await ev('!!document.querySelector("[data-testid=marginal-result]")'),false);
results.cancelled=true;
await cdp('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
await ev('scrollTo(0,0)');
await set('marginal.amount',1000);
await choose('Funding basis','after_tax_cash');
started=Date.now();
await click('Compare allocation');
await wait('!!document.querySelector("[data-testid=marginal-result]")',300000);
results.cashSeconds=(Date.now()-started)/1000;
results.cashText=await text();
assert.match(results.cashText,/Existing after-tax cash/);
assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'),false);
await shot('chunk7-mobile');
await ev('document.querySelector("[data-testid=marginal-result]").scrollIntoView()');
await shot('chunk7-mobile-results');
await choose('Funding basis','gross_earnings');
await wait('!document.querySelector("[data-testid=marginal-result]")');
results.staleBasis=true;
await click('Compare allocation');
await wait('document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow") > 0');
await set('personal.targetSuccessProbability',85);
await wait('![...document.querySelectorAll("button")].some(b=>b.textContent==="Computing…")');
assert.equal(await ev('!!document.querySelector("[data-testid=marginal-result]")'),false);
results.inflightInvalidation=true;
assert.equal(errors.length,0,JSON.stringify(errors));
await fs.writeFile('/tmp/chunk7-ui-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({grossSeconds:results.grossSeconds,cashSeconds:results.cashSeconds,frames:results.frames,passed:true}));
ws.close();
