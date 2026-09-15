/** Manual Chrome/CDP acceptance test. Start npm run dev -- --port 5175 and a dedicated
 * headless Chrome with --remote-debugging-port=9225 --user-data-dir=/tmp/capital-chunk5-chrome.
 * Run with Node 24: node tests/browser-property-ui.mjs. Override APP_PORT / CDP_PORT to use
 * another pair. Outputs JSON and PNGs into /tmp.
 * Do not edit application source while this runs: Vite reloads reset in-memory profiles.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const appPort=process.env.APP_PORT??'5175';
const cdpPort=process.env.CDP_PORT??'9225';
const tabs=await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();const errors=[];
// A dropped debugger connection otherwise looks like a silently unsettled await.
let finished = false;
ws.onclose = () => { if (!finished) { console.error('CDP CONNECTION CLOSED'); process.exit(1); } };
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const ev=async(expression)=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async(expr,limit=90000)=>{const start=Date.now();while(Date.now()-start<limit){const r=await ev(expr);if(r)return r;await new Promise(r=>setTimeout(r,150));}throw Error('Timeout: '+expr);};
const nav=async(path)=>{await cdp('Page.navigate',{url:`http://127.0.0.1:${appPort}`+path});await wait('document.readyState === "complete"');};
const click=async(text)=>{await ev(`(()=>{const e=[...document.querySelectorAll('button,label')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.click();})()`);};
const set=async(id,value)=>{await ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
const shot=async(name)=>{const r=await cdp('Page.captureScreenshot',{format:'png'});await fs.writeFile('/tmp/'+name+'.png',Buffer.from(r.data,'base64'));};
await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
const results={};
await nav('/');await wait('!!document.getElementById("tab-property")');await ev('document.getElementById("tab-property").click()');await click('Include a property');await wait('!!document.getElementById("property.purchase.deposit")');await set('spending.currentRentMonthlyIncluded',700);
await ev('document.getElementById("tab-fire").click()');
await ev('window.framesSeen=0;window.maxGap=0;window.measure=true;window.lastFrame=performance.now();requestAnimationFrame(function f(t){window.framesSeen++;window.maxGap=Math.max(window.maxGap,t-window.lastFrame);window.lastFrame=t;if(window.measure)requestAnimationFrame(f)});');
await click('Run 10,000 paths');await wait('document.body.innerText.includes("Completed in")');
results.fullRun=await ev('({frames:window.framesSeen,maxGap:window.maxGap,text:document.body.innerText})');await ev('window.measure=false');
console.log('UI full run',results.fullRun.frames,results.fullRun.maxGap,results.fullRun.text.match(/Completed in[^\n]+/)[0]);
await ev('document.querySelectorAll("details.group").forEach(e=>e.open=false)');await shot('chunk5-fire-desktop');
await click('Run 10,000 paths');await wait('Number(document.querySelector(".progress-track")?.getAttribute("aria-valuenow")) > 0');await click('Cancel');await wait('document.body.innerText.includes("Run cancelled")');
results.cancelled=await ev('!document.body.innerText.includes("Completed in")');
await ev('document.getElementById("tab-property").click()');await wait('!!document.getElementById("property.purchase.deposit")');await set('property.purchase.deposit',400000);
results.invalid=await ev('document.body.innerText.includes("Inputs invalid")');await set('property.purchase.deposit',60000);
await ev('document.querySelectorAll("details.group").forEach(e=>e.open=false)');
await click('Compare 10,000 matching paths');await wait('document.querySelector("[role=status]")?.textContent.match(/^[1-9]/)');await click('Cancel comparison');await wait('document.body.innerText.includes("Comparison cancelled")');
results.comparisonCancelled=true;
await click('Compare 10,000 matching paths');await wait('document.body.innerText.includes("Median terminal liquid capital")',120000);
results.comparison=await ev('document.body.innerText');console.log('comparison done');
await ev('[...document.querySelectorAll("h3")].find(e=>e.textContent.includes("Buy versus")).scrollIntoView()');await shot('chunk5-comparison-desktop');
for(const tab of ['property','overview','fire']){
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await ev(`document.getElementById("tab-${tab}").click();window.scrollTo(0,0);document.querySelectorAll("details.group").forEach(e=>e.open=false)`);
 await new Promise(r=>setTimeout(r,250));
 results[tab+'MobileOverflow']=await ev('document.documentElement.scrollWidth-innerWidth');await shot('chunk5-'+tab+'-mobile');
}
console.log('mobile overflow',results.propertyMobileOverflow,results.overviewMobileOverflow,results.fireMobileOverflow);
assert.equal(results.cancelled,true);assert.equal(results.invalid,true);assert.equal(results.comparisonCancelled,true);
assert.equal(results.propertyMobileOverflow,0);assert.equal(results.overviewMobileOverflow,0);assert.equal(results.fireMobileOverflow,0);
assert.equal(errors.length,0);assert.ok(results.fullRun.frames>30);assert.ok(results.fullRun.maxGap<250);
assert.equal(results.comparison.match(/FIRE success\t([\d.]+)%/)?.[1],results.fullRun.text.match(/Current ([\d.]+)%/)?.[1]);
assert.ok(results.comparison.toLowerCase().includes('rent + invest'));
await fs.writeFile('/tmp/chunk5-ui-results.json',JSON.stringify({...results,errors},null,2));finished = true; ws.close();
