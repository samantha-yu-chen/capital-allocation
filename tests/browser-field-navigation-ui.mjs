/** Manual Chrome/CDP acceptance test for UX-11 (a way out of the starter picker, and the flat
 * real-terms spending line explained).
 *
 * Start `npm run dev -- --port 5176 --strictPort` and a dedicated headless Chrome with
 * --remote-debugging-port=9226 --user-data-dir=/tmp/capital-ux11-chrome, then run with Node 24:
 * node tests/browser-field-navigation-ui.mjs. Override APP_PORT / CDP_PORT to use another pair.
 * Outputs JSON and PNGs into /tmp.
 *
 * What it proves in a real browser, rather than in a view model:
 *  - every fact on the situation in use is a real button, and clicking it lands on the Overview
 *    form with that exact input focused and inside the viewport;
 *  - facts on a card that is NOT in use are not links, because they describe a profile the form
 *    does not hold;
 *  - each of the four "not quite you?" jumps lands on its own input, focused and visible;
 *  - a jump whose target is hidden by the reader's chosen depth raises the filter, moves the radio
 *    the reader can see, and says on screen what it moved and why;
 *  - the household inputs are on screen at the depth the form opens on, which is the specific dead
 *    end that was reported;
 *  - the property fact crosses to the Property & Leverage screen, because that is the form that
 *    renders the property group;
 *  - clicking a fact or a jump starts nothing: no progress bar, no running button, no probability;
 *  - a completed 10,000-path result survives a jump, and is still discarded by a real edit;
 *  - the ledger's real-terms spending column is flat while the cash-terms one grows, and the
 *    explanation beside the control says so and quotes one year both ways;
 *  - eight tabs stay reachable and 390px does not overflow, before and after a jump.
 *
 * Do not edit application source while this runs: Vite reloads reset in-memory profiles.
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
const wait = async (expr, limit = 90000) => { const start = Date.now(); while (Date.now() - start < limit) { const r = await ev(expr); if (r) return r; await new Promise(r => setTimeout(r, 150)); } throw Error('Timeout: ' + expr); };
const nav = async (path) => { await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}` + path }); await wait('document.readyState === "complete"'); };
const settle = () => new Promise(r => setTimeout(r, 300));
const shot = async (name) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile('/tmp/' + name + '.png', Buffer.from(r.data, 'base64')); };

const q = fieldId => JSON.stringify('#' + fieldId.replaceAll('.', '\\.'));
const value = fieldId => ev(`(()=>{const e=document.querySelector(${q(fieldId)});return e?e.value:null})()`);
const tab = async (tabId) => { await ev(`document.getElementById("tab-${tabId}").click()`); await settle(); };
const openWizard = async () => { await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start here')).click()`); await settle(); };
const overflow = () => ev(`Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`);
const runningSigns = () => ev(`({
  progress: document.querySelectorAll('.progress, progress, [role="progressbar"]').length,
  running: [...document.querySelectorAll('button')].filter(b=>/Running…|Comparing…/.test(b.textContent)).length,
  probability: document.querySelectorAll('.wizard-probability').length,
})`);
const heading = () => ev(`document.querySelector('.page-header h2').textContent.trim()`);

/** What the browser says actually happened after a jump: which box has focus, and can it be seen. */
const landing = () => ev(`(()=>{
  const a = document.activeElement;
  if (!a || a === document.body) return { focused: null };
  const r = a.getBoundingClientRect();
  const label = a.labels && a.labels[0] ? a.labels[0].textContent.replace(/\\s+/g,' ').trim() : null;
  const group = a.closest('details');
  return {
    focused: a.id || null,
    tag: a.tagName.toLowerCase(),
    label,
    groupOpen: group ? group.open : null,
    inViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0 && r.height > 0,
    top: Math.round(r.top),
  };
})()`);
const arrival = () => ev(`(()=>{const e=document.querySelector('[data-testid="field-arrival"]');
  const t=document.querySelector('[data-testid="tier-raised"]');
  return { note: e ? e.innerText.replace(/\\s+/g,' ').trim() : null, raised: t ? t.textContent.replace(/\\s+/g,' ').trim() : null };})()`);
const tierRadio = () => ev(`(()=>{const r=[...document.querySelectorAll('input[name="profile-tier"]')].find(i=>i.checked);
  return r ? r.closest('label').textContent.replace(/\\s+/g,' ').trim() : null})()`);
const setTier = async (label) => { await ev(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.includes(${JSON.stringify(label)})&&e.querySelector('input[name="profile-tier"]'));l.querySelector('input').click();})()`); await settle(); };
const isVisible = fieldId => ev(`(()=>{const e=document.querySelector(${q(fieldId)});if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})()`);

/** The facts on one card, and whether each is a link. */
const factsOf = starterId => ev(`(()=>{const li=document.querySelector('[data-starter="${starterId}"]');
  return [...li.querySelectorAll('.starter-facts > div')].map(d=>({
    label: d.querySelector('dt').textContent.trim(),
    value: d.querySelector('dd').textContent.trim(),
    link: !!d.querySelector('button'),
    testid: d.querySelector('button') ? d.querySelector('button').getAttribute('data-testid') : null,
    aria: d.querySelector('button') ? d.querySelector('button').getAttribute('aria-label') : null,
  }))})()`);
const clickFact = async (starterId, label) => { await ev(`(()=>{const li=document.querySelector('[data-starter="${starterId}"]');
  const d=[...li.querySelectorAll('.starter-facts > div')].find(x=>x.querySelector('dt').textContent.trim()===${JSON.stringify(label)});
  const b=d.querySelector('button'); if(!b) throw Error('Fact is not a link: '+${JSON.stringify(label)}); b.click();})()`); await settle(); };
const jumps = () => ev(`[...document.querySelectorAll('[data-testid="starter-next"] button')].map(b=>({
  testid: b.getAttribute('data-testid'), text: b.textContent.trim(), aria: b.getAttribute('aria-label') }))`);
const clickJump = async (jumpId) => { await ev(`document.querySelector('[data-testid="starter-next-${jumpId}"]').click()`); await settle(); };
const choose = async (starterId) => { await ev(`document.querySelector('[data-testid="starter-choose-${starterId}"]').click()`); await settle(); };

/** The ledger's money-basis surface: the note, the pair, and the spending column on each basis. */
const setBasis = async (label) => { await ev(`(()=>{const s=[...document.querySelectorAll('select')].find(e=>e.closest('.field')&&/Money basis/.test(e.closest('.field').textContent));
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(label)});
  s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
const basisSurface = () => ev(`(()=>{const e=document.querySelector('[data-testid="basis-explanation"]');
  return {
    spending: document.querySelector('[data-testid="basis-spending-note"]').textContent.replace(/\\s+/g,' ').trim(),
    switch: document.querySelector('[data-testid="basis-switch-note"]').textContent.replace(/\\s+/g,' ').trim(),
    pair: document.querySelector('[data-testid="inflation-pair"]').textContent.replace(/\\s+/g,' ').trim(),
    terms: [...e.querySelectorAll('.glossary-term')].map(b=>b.textContent.trim()),
  };})()`);
/** The Spending cell of the first and the twenty-first visible ledger row. */
const spendingColumn = () => ev(`(()=>{const rows=[...document.querySelectorAll('.table tbody tr')].filter(r=>r.children.length>=10);
  const cell=r=>r.children[5].textContent.trim();
  return { first: cell(rows[0]), later: cell(rows[20]), ageFirst: rows[0].children[0].textContent.trim(), ageLater: rows[20].children[0].textContent.trim() };})()`);

await cdp('Runtime.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
const results = {};

await nav('/');
await ev(`try{localStorage.clear()}catch(e){}`);
await nav('/');
await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);

// ---------------------------------------------------------------------------
// 1. The reported dead end, reproduced and then walked out of
// ---------------------------------------------------------------------------

// The contractor situation is the one the reader named: one adult, and a family to plan for.
await choose('contractor-no-employer-pension');
results.contractorFacts = await factsOf('contractor-no-employer-pension');
results.otherCardFacts = await factsOf('family-40s-mid-mortgage');
results.jumps = await jumps();
await shot('ux11-wizard-links-desktop');

// Clicking the household fact leaves the wizard and lands on the box, focused.
await clickFact('contractor-no-employer-pension', 'Household');
results.householdLanding = await landing();
results.householdHeading = await heading();
results.householdArrival = await arrival();
results.householdTier = await tierRadio();
results.householdValue = await value('household.adults');
results.householdRunning = await runningSigns();
await shot('ux11-household-landed-desktop');

// And it can be changed, from one adult to two, without going anywhere else.
await ev(`(()=>{const e=document.querySelector(${q('household.adults')});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2');
  e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await settle();
results.householdAfterEdit = await value('household.adults');
results.householdEditedMark = await ev(`(()=>{const e=document.querySelector(${q('household.adults')});
  const m=e.closest('.field').querySelector('.provenance');return m?m.textContent.replace(/\\s+/g,' ').trim():null})()`);

// ---------------------------------------------------------------------------
// 2. Every fact on the chosen card, and every jump, lands where it says
// ---------------------------------------------------------------------------

const factChecks = {};
for (const label of ['Age now', 'Target FIRE age', 'Tax region', 'Gross salary', 'Spending now',
  'Retirement spending', 'Cash, ISA and GIA', 'Pension and SIPP', 'You pay in', 'Employer pays in']) {
  await openWizard();
  await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);
  await clickFact('contractor-no-employer-pension', label);
  factChecks[label] = { ...(await landing()), heading: await heading() };
}
results.factChecks = factChecks;

// The property fact crosses to the screen that renders the property group.
await openWizard();
await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);
await clickFact('contractor-no-employer-pension', 'Property');
results.propertyLanding = { ...(await landing()), heading: await heading() };
await shot('ux11-property-landed-desktop');

const jumpChecks = {};
for (const jump of ['household', 'salary', 'spending', 'fire-age']) {
  await openWizard();
  await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);
  await clickJump(jump);
  jumpChecks[jump] = { ...(await landing()), heading: await heading(), running: await runningSigns() };
}
results.jumpChecks = jumpChecks;
await shot('ux11-jump-landed-desktop');

// ---------------------------------------------------------------------------
// 3. Raising the filter is visible, and the default depth already shows household
// ---------------------------------------------------------------------------

await tab('overview');
await wait('!!document.getElementById("income.salaryAnnual")');
results.defaultTier = await tierRadio();
results.householdVisibleByDefault = {
  adults: await isVisible('household.adults'),
  children: await isVisible('household.children'),
};

// Narrow the reader's depth so the household inputs really are hidden, then jump to one.
await setTier('Essential only');
results.narrowedTier = await tierRadio();
results.householdHiddenWhenNarrow = await isVisible('household.adults');
await openWizard();
await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);
await clickJump('household');
results.raised = {
  tier: await tierRadio(),
  arrival: await arrival(),
  landing: await landing(),
  visible: await isVisible('household.adults'),
};
await shot('ux11-tier-raised-desktop');

// ---------------------------------------------------------------------------
// 4. A completed 10,000-path result survives a jump, and a real edit still discards it
// ---------------------------------------------------------------------------

await tab('overview');
await wait('!!document.getElementById("income.salaryAnnual")');
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>/^Run [\\d,]+ simulated futures$/.test(e.textContent.trim()));if(!b)throw Error('No run button');b.click();})()`);
results.runStarted = await ev(`[...document.querySelectorAll('button')].some(b=>/Running your plan…/.test(b.textContent))`);
await wait(`[...document.querySelectorAll('.tag')].some(t=>/^Current /.test(t.textContent))`, 180000);
results.probabilityBeforeJump = await ev(`(()=>{const t=[...document.querySelectorAll('.tag')].find(e=>/^Current /.test(e.textContent));return t?t.textContent.trim():null})()`);

await openWizard();
await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);
await clickJump('salary');
results.probabilityAfterJump = await ev(`(()=>{const t=[...document.querySelectorAll('.tag')].find(e=>/^Current /.test(e.textContent));return t?t.textContent.trim():null})()`);
results.jumpRunning = await runningSigns();

// An edit is an edit: the result goes.
await ev(`(()=>{const e=document.querySelector(${q('income.salaryAnnual')});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'83001');
  e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await settle();
results.probabilityAfterEdit = await ev(`(()=>{const t=[...document.querySelectorAll('.tag')].find(e=>/^Current /.test(e.textContent));return t?t.textContent.trim():null})()`);

// ---------------------------------------------------------------------------
// 5. The flat real-terms spending column, and what the screen says about it
// ---------------------------------------------------------------------------

// Back to the profile the app opens with, so the ledger is the documented one.
await openWizard();
await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);
await choose('worked-example');
await tab('overview');
await wait(`!!document.querySelector('[data-testid="basis-explanation"]')`);
results.realBasis = await basisSurface();
results.realSpending = await spendingColumn();
await ev(`document.querySelector('[data-testid="basis-explanation"]').scrollIntoView({block:'center'})`);
await settle();
await shot('ux11-basis-real-desktop');

await setBasis('nominal');
results.nominalBasis = await basisSurface();
results.nominalSpending = await spendingColumn();
await shot('ux11-basis-nominal-desktop');
await setBasis('real');

// The glossary opens from the explanation, so the words in it are reachable.
await ev(`document.querySelector('[data-testid="basis-explanation"] .glossary-term').click()`);
await settle();
results.glossaryOpened = await ev(`document.querySelectorAll('.glossary-panel').length`);
results.glossaryText = await ev(`(()=>{const p=document.querySelector('.glossary-panel');return p?p.innerText.replace(/\\s+/g,' ').trim().slice(0,160):null})()`);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);

// ---------------------------------------------------------------------------
// 6. Eight destinations, and 390px
// ---------------------------------------------------------------------------

results.tabs = await ev(`[...document.querySelectorAll('[role="tab"]')].map(t=>t.textContent.trim())`);

await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await settle();
await openWizard();
await wait(`!!document.querySelector('[data-testid="starter-picker"]')`);
results.mobile = {
  overflow: await overflow(),
  jumps: (await jumps()).length,
  facts: (await factsOf('worked-example')).filter(f => f.link).length,
};
await shot('ux11-picker-mobile');
await clickJump('household');
results.mobileAfterJump = {
  overflow: await overflow(),
  landing: await landing(),
  arrival: await arrival(),
};
await shot('ux11-jump-landed-mobile');
await tab('overview');
await wait(`!!document.querySelector('[data-testid="basis-explanation"]')`);
await ev(`document.querySelector('[data-testid="basis-explanation"]').scrollIntoView({block:'center'})`);
await settle();
results.mobileBasisOverflow = await overflow();
await shot('ux11-basis-mobile');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });

// ===========================================================================
// Assertions
// ===========================================================================

// 1. Facts on the card in use are links; facts on a card that is not in use are not.
assert.equal(results.contractorFacts.length, 12);
assert.equal(results.contractorFacts.filter(f => f.link).length, 12,
  'every fact on the situation in use must say where it lives');
assert.equal(results.otherCardFacts.filter(f => f.link).length, 0,
  'a card you are not using describes a profile the form does not hold, so its facts are not links');
const household = results.contractorFacts.find(f => f.label === 'Household');
assert.equal(household.value, '1 adult');
assert.equal(household.testid, 'starter-fact-household.adults');
assert.match(household.aria, /Change it under Household/);

// 2. The reported dead end is now four clicks shorter: picker → box → typed.
assert.equal(results.householdHeading, 'Overview', 'a jump leaves the picker for the form that holds the input');
assert.equal(results.householdLanding.focused, 'household.adults');
assert.equal(results.householdLanding.inViewport, true, `the box landed at y=${results.householdLanding.top}`);
assert.equal(results.householdLanding.groupOpen, true, 'a collapsed group cannot be typed into');
assert.equal(results.householdValue, '1');
assert.equal(results.householdAfterEdit, '2', 'the reader can change it where they landed');
assert.match(results.householdEditedMark ?? '', /edited/);
assert.match(results.householdArrival.note ?? '', /Adults/);
assert.match(results.householdArrival.note ?? '', /Household/);
assert.deepEqual(results.householdRunning, { progress: 0, running: 0, probability: 0 },
  'a jump is navigation; it must not spend 10,000 paths');

// 3. Every other fact lands on its own input, focused and visible.
const expected = {
  'Age now': 'personal.currentAge',
  'Target FIRE age': 'personal.targetFireAge',
  'Tax region': 'personal.taxRegion',
  'Gross salary': 'income.salaryAnnual',
  'Spending now': 'spending.current.essentialMonthly',
  'Retirement spending': 'spending.retirement.essentialMonthly',
  'Cash, ISA and GIA': 'assets.cash',
  'Pension and SIPP': 'assets.pension',
  'You pay in': 'pension.employeeRate',
  'Employer pays in': 'pension.employerRate',
};
for (const [label, fieldId] of Object.entries(expected)) {
  const check = results.factChecks[label];
  assert.equal(check.focused, fieldId, `"${label}" landed on ${check.focused}`);
  assert.equal(check.inViewport, true, `"${label}" landed off screen at y=${check.top}`);
  assert.equal(check.heading, 'Overview');
}
// A select is addressable too, which it was not before UX-11 gave it the registry id.
assert.equal(results.factChecks['Tax region'].tag, 'select');

// 4. The property fact crosses to the screen whose form renders that group.
assert.equal(results.propertyLanding.heading, 'Property & Leverage');
assert.equal(results.propertyLanding.focused, 'property');
assert.equal(results.propertyLanding.inViewport, true);

// 5. The four jumps.
assert.deepEqual(results.jumps.map(j => j.testid),
  ['starter-next-household', 'starter-next-salary', 'starter-next-spending', 'starter-next-fire-age']);
assert.match(results.jumps[2].aria, /4 inputs/);
const jumpTargets = {
  household: 'household.adults', salary: 'income.salaryAnnual',
  spending: 'spending.current.essentialMonthly', 'fire-age': 'personal.targetFireAge',
};
for (const [jump, fieldId] of Object.entries(jumpTargets)) {
  assert.equal(results.jumpChecks[jump].focused, fieldId, `jump "${jump}" landed on ${results.jumpChecks[jump].focused}`);
  assert.equal(results.jumpChecks[jump].inViewport, true, `jump "${jump}" landed off screen`);
  assert.deepEqual(results.jumpChecks[jump].running, { progress: 0, running: 0, probability: 0 });
}

// 6. The default depth shows household — the re-tiering, measured rather than argued.
assert.equal(results.defaultTier, 'Essential + common');
assert.deepEqual(results.householdVisibleByDefault, { adults: true, children: true },
  'the inputs every starter card advertises must be on screen at the depth the form opens on');

// 7. When the depth really is too narrow, raising it is visible and explained.
assert.equal(results.narrowedTier, 'Essential only');
assert.equal(results.householdHiddenWhenNarrow, false, 'this check is only meaningful while it is hidden');
assert.equal(results.raised.tier, 'Essential + common', 'the radio the reader can see has moved');
assert.equal(results.raised.visible, true);
assert.equal(results.raised.landing.focused, 'household.adults');
assert.match(results.raised.arrival.raised ?? '', /Detail raised to “Essential \+ common”/);
assert.match(results.raised.arrival.raised ?? '', /Nothing about your plan changed/);
assert.ok(!(results.raised.arrival.note ?? '').includes('£'), 'a display notice carries no figure');

// 8. A jump is not an edit: the published result is still there afterwards.
assert.equal(results.runStarted, true, 'the run must visibly be in progress while 10,000 paths run');
assert.ok(results.probabilityBeforeJump, 'no completed probability to test with');
assert.equal(results.probabilityAfterJump, results.probabilityBeforeJump,
  'navigating to an input must not discard a completed run');
assert.deepEqual(results.jumpRunning, { progress: 0, running: 0, probability: 0 });
assert.equal(results.probabilityAfterEdit, null, 'a real edit still invalidates the result');

// 9. The flat column, and the sentence beside it.
assert.equal(results.realSpending.ageFirst, '31');
assert.equal(results.realSpending.ageLater, '51');
assert.equal(results.realSpending.first, results.realSpending.later,
  'constant real spending is a flat line in today’s money — the appearance that was reported');
const cash = text => Number(text.replace(/[^0-9]/g, ''));
assert.ok(cash(results.nominalSpending.later) > cash(results.nominalSpending.first) * 1.4,
  `cash-terms spending only moved ${results.nominalSpending.first} → ${results.nominalSpending.later}`);
assert.equal(results.nominalSpending.first, results.realSpending.first,
  'the two bases agree in the current year, where the index is one');

assert.match(results.realBasis.spending, /flat/);
assert.match(results.realBasis.spending, /prices do rise here, every year/);
assert.match(results.realBasis.switch, /cash terms/);
assert.match(results.realBasis.pair, /At age 45/, 'the pair opens on the first year the plan stops earning');
assert.match(results.realBasis.pair, /prices are \d+\.\d% higher by then/);
assert.match(results.nominalBasis.spending, /grows/);
assert.deepEqual(results.realBasis.terms,
  ['Today’s money (real terms) versus cash terms (nominal)', 'Inflation index']);
assert.equal(results.glossaryOpened, 1, 'the words in the explanation are reachable from it');

// 10. Eight destinations, and 390px.
assert.equal(results.tabs.length, 8, `saw ${results.tabs.length} tabs`);
assert.equal(results.mobile.overflow, 0, `mobile overflowed by ${results.mobile.overflow}px`);
assert.equal(results.mobile.jumps, 4, 'the way out is not what gets dropped when space is short');
assert.equal(results.mobile.facts, 12);
assert.equal(results.mobileAfterJump.overflow, 0, `mobile overflowed by ${results.mobileAfterJump.overflow}px after a jump`);
assert.equal(results.mobileAfterJump.landing.focused, 'household.adults');
assert.equal(results.mobileAfterJump.landing.inViewport, true);
assert.equal(results.mobileBasisOverflow, 0, `the basis explanation overflowed by ${results.mobileBasisOverflow}px`);

assert.equal(errors.length, 0, JSON.stringify(errors));

await fs.writeFile('/tmp/ux11-ui-results.json', JSON.stringify({ ...results, errors }, null, 2));
console.log('UX-11 browser acceptance: PASS');
finished = true; ws.close();
