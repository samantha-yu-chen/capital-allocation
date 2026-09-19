/** Manual Chrome/CDP acceptance test for UX-10 (the in-app "How this works" panel).
 *
 * Checks that the explanation is reachable from the sidebar on every screen, that it opens the
 * section for the screen the reader came from, that all eight destinations have one, that it shows
 * no figure and starts no run, and that opening it neither discards a published result nor breaks
 * tab reachability at desktop or phone width.
 *
 * Start Vite on APP_PORT and isolated Chrome on CDP_PORT, then run with Node 24.
 * Writes results and desktop/mobile screenshots to /tmp.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const appPort = process.env.APP_PORT ?? '5178';
const cdpPort = process.env.CDP_PORT ?? '9229';
const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let id = 0; const pending = new Map(); const errors = []; let finished = false;
ws.onclose = () => { if (!finished) { console.error('CDP CONNECTION CLOSED'); process.exit(1); } };
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const promise = pending.get(message.id); pending.delete(message.id);
    message.error ? promise.reject(message.error) : promise.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
};
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const request = ++id; pending.set(request, { resolve, reject });
  ws.send(JSON.stringify({ id: request, method, params }));
});
const ev = async expression => {
  const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
};
const wait = async (expression, limit = 600000) => {
  const started = Date.now();
  while (Date.now() - started < limit) {
    if (await ev(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('Timeout: ' + expression);
};
const settle = () => new Promise(resolve => setTimeout(resolve, 250));
const click = async text => {
  await ev(`(()=>{const e=[...document.querySelectorAll('button,label')].find(e=>e.textContent.replace(/\\s+/g,' ').trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.click();})()`);
  await settle();
};
const byTestId = async testId => {
  await ev(`(()=>{const e=document.querySelector('[data-testid=${JSON.stringify(testId)}]');if(!e)throw Error('Missing '+${JSON.stringify(testId)});e.click();})()`);
  await settle();
};
const set = async (fieldId, value) => {
  await ev(`(()=>{const e=document.getElementById(${JSON.stringify(fieldId)});if(!e)throw Error('Missing '+${JSON.stringify(fieldId)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await settle();
};
const tab = async name => { await ev(`document.getElementById("tab-${name}").click()`); await settle(); };
const shot = async name => {
  const image = await cdp('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`/tmp/${name}.png`, Buffer.from(image.data, 'base64'));
};
const body = () => ev('document.body.innerText');
const panelText = () => ev('document.querySelector(\'[data-testid="learn-panel"]\')?.innerText.replace(/\\s+/g," ").trim() ?? null');
/** Which screen sections exist, and which one the panel opened for the reader. */
const sections = () => ev(`[...document.querySelectorAll('[data-testid^="learn-screen-"]')].map(e=>({tab:e.dataset.testid.replace('learn-screen-',''),open:e.open}))`);
const tabCount = () => ev('document.querySelectorAll(\'[role="tab"]\').length');
const smoke = async suffix => {
  await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/tests/browser-worker-smoke.html${suffix}` });
  await wait('document.querySelector("#result")?.textContent.trim().startsWith("{")', 180000);
  return JSON.parse(await ev('document.querySelector("#result").textContent'));
};

const AUTHORITY = 'the number your target is judged against';
const CAVEAT_BODY = 'n illustration, not advice and not a benchmark: it is a set of plausible figures to start editing, '
  + 'not a claim about what someone in this situation has or should do.';
const EVENT_ORDER = 'Inside a year the order is fixed: opening balances, then income, tax and contributions, '
  + 'then spending and withdrawals, then that year’s market return, then closing balances.';
const NO_DYNAMIC_CUT = 'The model never cuts your spending for you part-way through a run: the floor, target '
  + 'and comfort levels are three separate runs, not one run that adapts.';
const TODAYS_MONEY = 'The ledger works in the money of the day, and every figure the app shows you has been '
  + 'converted back into today’s money, so you never see the same inflation applied twice.';
const NOT_ADVICE = 'This app explains and simulates. It does not advise, and it does not predict.';
const EIGHT = ['overview', 'fire', 'curve', 'marginal', 'solver', 'scenarios', 'property', 'attribution'];
const step = name => console.log(`[step] ${name} ${new Date().toISOString()}`);

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });

step('worker smoke');
const smokeBaseline = await smoke('');
const smokeProperty = await smoke('?property');
const results = { errors, smokeBaseline, smokeProperty };

step('the sidebar offers the explanation, and it opens');
// ---- The panel is reachable from the shell, on the screen the reader is already on ---------------
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
await wait('document.readyState === "complete" && !!document.querySelector(".start-here-button")');
await ev('localStorage.setItem("capital-allocation:start-here-dismissed:v1","true");location.reload()');
await wait('document.readyState === "complete" && !!document.querySelector(".headline-card")');
results.entryPresent = await ev('!!document.querySelector(\'[data-testid="open-learn"]\')');
await byTestId('open-learn');
await wait('!!document.querySelector(\'[data-testid="learn-panel"]\')');
const opened = await panelText();
results.openedFromOverview = {
  heading: await ev('document.querySelector(".page-header h2").innerText.trim()'),
  sections: await sections(),
  tabs: await tabCount(),
  words: opened.split(' ').length,
};
await shot('ux10-panel-desktop');

step('it shows no figure and recommends nothing');
// ---- No figure, no advice: this is the page a reader reaches before they trust a number ----------
// Scoped to the prose. A glossary term *name* may legitimately contain a figure — "Withdrawal rate
// (the "4% rule")" is one — and that is a definition's own title from UX-3, not a result.
const prose = await ev('[...document.querySelectorAll(\'[data-testid="learn-panel"] .learn-paragraph\')].map(e=>e.innerText.replace(/\\s+/g," ")).join(" ")');
results.noFigures = {
  paragraphs: await ev('document.querySelectorAll(\'[data-testid="learn-panel"] .learn-paragraph\').length'),
  money: /£/.test(prose),
  percent: /\d\s*%/.test(prose),
  advice: /you should|we recommend/i.test(prose),
};
results.quotes = {
  authority: opened.includes(AUTHORITY),
  starterCaveat: opened.includes(CAVEAT_BODY),
  eventOrder: opened.includes(EVENT_ORDER),
  noDynamicCut: opened.includes(NO_DYNAMIC_CUT),
  todaysMoney: opened.includes(TODAYS_MONEY),
  notAdvice: opened.includes(NOT_ADVICE),
  taxReliefNames: ['Tax relief', 'Tax and National Insurance you no longer pay', 'What it actually costs you']
    .every(label => opened.includes(label)),
};
results.cites = opened.includes('docs/architecture-decisions.md (ADR 002)')
  && opened.includes('src/engine/ledger.ts');

step('opening an explanation starts nothing');
// ---- Reading is free; 10,000 paths are not ------------------------------------------------------
results.nothingRan = {
  progressBars: await ev('document.querySelectorAll(".progress-track").length'),
  runningButtons: await ev('[...document.querySelectorAll("button")].filter(b=>/Running|Cancel/.test(b.textContent)).length'),
  publishedProbability: await ev('document.querySelectorAll(".stat-hero").length'),
};

step('the way back, and per-screen sections that follow the reader');
// ---- The section that opens is the screen you came from ------------------------------------------
await byTestId('learn-close');
await settle();
results.closedBackToOverview = (await ev('document.querySelector(".page-header h2").innerText.trim()')) === 'Overview';
await tab('property');
await wait('document.querySelector(".page-header h2").innerText.trim() === "Property & Leverage"');
await byTestId('open-learn');
await wait('!!document.querySelector(\'[data-testid="learn-panel"]\')');
results.openedFromProperty = { sections: await sections(), tabs: await tabCount() };

step('every tab stays reachable while the panel is open');
// ---- The eight destinations are beside the panel, not behind it ----------------------------------
await tab('attribution');
await settle();
results.tabFromPanel = {
  heading: await ev('document.querySelector(".page-header h2").innerText.trim()'),
  panelGone: (await panelText()) === null,
};
await byTestId('open-learn');
await wait('!!document.querySelector(\'[data-testid="learn-panel"]\')');
results.openedFromAttribution = { sections: await sections() };

step('a glossary word inside the panel still opens its definition');
// ---- The ladder down to ordinary language works from here too ------------------------------------
await ev('document.querySelector(\'[data-testid="learn-panel"] .glossary-term\').click()');
await settle();
results.glossary = {
  panels: await ev('document.querySelectorAll(\'[data-testid="learn-panel"] .glossary-panel\').length'),
  expanded: await ev('document.querySelectorAll(\'[data-testid="learn-panel"] .glossary-term[aria-expanded="true"]\').length'),
};

step('a real run, then the explanation, then the result is still there');
// ---- Opening the explanation is not an edit: it must not discard a published probability ----------
await tab('fire');
await wait('!!document.getElementById("simulation.referenceWithdrawalRate")');
await click('Run 10,000 paths');
let sawProgress = false;
for (let attempt = 0; attempt < 400 && !sawProgress; attempt += 1) {
  sawProgress = await ev('document.querySelectorAll(".progress-track").length > 0');
  if (!sawProgress) await new Promise(resolve => setTimeout(resolve, 100));
}
results.progressSeen = sawProgress;
await wait('document.body.innerText.includes("Completed in")', 600000);
const probability = await ev('document.querySelector(".stat-hero")?.innerText.trim() ?? null');
await byTestId('open-learn');
await wait('!!document.querySelector(\'[data-testid="learn-panel"]\')');
results.duringPanel = { fireSectionOpen: (await sections()).find(s => s.tab === 'fire')?.open ?? null };
await tab('fire');
await settle();
results.resultSurvivedPanel = {
  before: probability,
  after: await ev('document.querySelector(".stat-hero")?.innerText.trim() ?? null'),
};

step('a stale result is still discarded, and a cancelled run still publishes nothing');
// ---- The explanation changed nothing about honest failure ----------------------------------------
await tab('overview');
await wait('!!document.getElementById("income.salaryAnnual")');
await set('income.salaryAnnual', 56_000);
await tab('fire');
await settle();
results.invalidated = {
  discarded: (await body()).includes('Inputs changed'),
  noProbability: (await ev('document.querySelectorAll(".stat-hero").length')) === 0,
};
await click('Run 10,000 paths');
await wait('document.querySelectorAll(".progress-track").length > 0', 30000);
await click('Cancel');
await settle();
results.cancelled = { noProbability: (await ev('document.querySelectorAll(".stat-hero").length')) === 0 };
await shot('ux10-fire-desktop');

step('phone width');
// ---- 390 × 844: no horizontal overflow, eight tabs, the entry and the panel both usable -----------
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await settle();
await byTestId('open-learn');
await wait('!!document.querySelector(\'[data-testid="learn-panel"]\')');
await settle();
results.mobile = {
  overflow: await ev('Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)'),
  tabs: await tabCount(),
  sections: (await sections()).length,
  paragraphs: await ev('document.querySelectorAll(\'[data-testid="learn-panel"] .learn-paragraph\').length'),
  entryBox: await ev('(()=>{const r=document.querySelector(\'[data-testid="open-learn"]\').getBoundingClientRect();return {left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)}})()'),
};
await shot('ux10-panel-mobile');
// Expanding a screen section on a phone must not push the page sideways either.
await ev('document.querySelector(\'[data-testid="learn-screen-solver"] summary\').click()');
await settle();
results.mobileExpanded = {
  overflow: await ev('Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)'),
  solverOpen: (await sections()).find(s => s.tab === 'solver')?.open ?? null,
};
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });

// ---- Assertions ---------------------------------------------------------------------------------
assert.deepEqual([smokeBaseline.passed, smokeBaseline.count, smokeBaseline.success], [true, 10_000, 0.6898]);
assert.deepEqual([smokeProperty.passed, smokeProperty.count, smokeProperty.success], [true, 10_000, 0.3518]);

// AC 3 — the panel renders, from the sidebar, with the eight tabs still beside it.
assert.equal(results.entryPresent, true, 'the sidebar must offer the explanation');
assert.equal(results.openedFromOverview.heading, 'How this works');
assert.equal(results.openedFromOverview.tabs, 8, 'all eight destinations stay reachable while it is open');
assert.ok(results.openedFromOverview.words > 900, 'the panel is the walkthrough, not a stub');

// AC 2 — every one of the eight has a section, and the one that opens is the reader's own screen.
assert.deepEqual(results.openedFromOverview.sections.map(s => s.tab), EIGHT);
assert.deepEqual(results.openedFromOverview.sections.filter(s => s.open).map(s => s.tab), ['overview']);
assert.deepEqual(results.openedFromProperty.sections.filter(s => s.open).map(s => s.tab), ['property']);
assert.deepEqual(results.openedFromAttribution.sections.filter(s => s.open).map(s => s.tab), ['attribution']);
assert.equal(results.openedFromProperty.tabs, 8);

// It explains and never reports: no figure that could pass for a result, and no recommendation.
assert.equal(results.noFigures.paragraphs >= 17, true, 'the walkthrough plus the open section, in prose');
assert.deepEqual(
  { money: results.noFigures.money, percent: results.noFigures.percent, advice: results.noFigures.advice },
  { money: false, percent: false, advice: false });
assert.deepEqual(results.quotes, {
  authority: true, starterCaveat: true, eventOrder: true, noDynamicCut: true,
  todaysMoney: true, notAdvice: true, taxReliefNames: true,
});
assert.equal(results.cites, true, 'a section must name the files its claims come from');

// Reading costs nothing: the panel starts no run and publishes no number.
assert.deepEqual(results.nothingRan, { progressBars: 0, runningButtons: 0, publishedProbability: 0 });

// Navigation: the way back names the screen, and a tab click leaves the panel.
assert.equal(results.closedBackToOverview, true);
assert.equal(results.tabFromPanel.heading, 'Where It Comes From');
assert.equal(results.tabFromPanel.panelGone, true);
assert.ok(results.glossary.panels >= 1 && results.glossary.expanded === 1,
  'a word in the panel still opens its definition');

// A published result survives a visit to the explanation — opening a panel is not an edit.
assert.equal(results.progressSeen, true);
assert.match(results.resultSurvivedPanel.before ?? '', /^\d+\.\d+%$/);
assert.equal(results.resultSurvivedPanel.after, results.resultSurvivedPanel.before);
assert.equal(results.duringPanel.fireSectionOpen, true);

// Honest failure is unchanged: a stale result is discarded, a cancelled run publishes nothing.
assert.deepEqual(results.invalidated, { discarded: true, noProbability: true });
assert.deepEqual(results.cancelled, { noProbability: true });

// Phone width.
assert.equal(results.mobile.overflow, 0);
assert.equal(results.mobile.tabs, 8);
assert.equal(results.mobile.sections, 8);
assert.ok(results.mobile.paragraphs >= 17, 'the walkthrough is not truncated on a phone');
assert.ok(results.mobile.entryBox.left >= 8 && results.mobile.entryBox.right <= 382,
  `the entry runs off the phone: ${JSON.stringify(results.mobile.entryBox)}`);
assert.deepEqual(results.mobileExpanded, { overflow: 0, solverOpen: true });

assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux10-ui-results.json', JSON.stringify(results, null, 2));
console.log('UX-10 browser acceptance passed:', JSON.stringify(results, null, 2));
finished = true; ws.close();
