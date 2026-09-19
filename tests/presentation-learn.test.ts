/**
 * UX-10: the "How this works" panel and the written walkthrough.
 *
 * Four things are held down here.
 *
 * 1. **Coverage.** Every one of the eight destinations has a section, and the list is derived from
 *    `TABS` rather than restated, so a ninth tab arrives with a failing test rather than with a
 *    silently unexplained screen.
 * 2. **No contradiction with the doc.** `LEARN_SHARED_CLAIMS` are the conventions a reader can be
 *    misled by. Each must appear verbatim in the panel data *and* in
 *    `docs/learnings/how-the-model-works.md`. Phrasing around them may diverge; these may not.
 * 3. **Quoted, not paraphrased.** Where another module already owns a sentence — the arbitration
 *    clause, the starter caveat, the three pension-relief labels — the learn text must carry that
 *    constant, so a later edit there cannot leave the explanation asserting the old wording.
 * 4. **It explains and never reports.** No money figure and no percentage appears anywhere on the
 *    surface. The one page a reader reaches *before* they trust a number is the worst possible
 *    place to put one that nobody ran.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { GLOSSARY } from '../src/presentation/view/glossary.js';
import { TABS, type TabId } from '../src/presentation/view/tabs.js';
import { AUTHORITY_CLAUSE } from '../src/presentation/view/two-numbers.js';
import { STARTER_ILLUSTRATION_CAVEAT } from '../src/presentation/view/starter-picker.js';
import {
  PERSONAL_NET_COST_LABEL, TAX_AND_NI_LABEL, TAX_RELIEF_LABEL,
} from '../src/presentation/view/pension-relief.js';
import {
  LEARN_DOC_PATH, LEARN_SHARED_CLAIMS, LEARN_SURFACES, MODEL_SECTIONS, TAB_SECTIONS,
  learnForTab, learnParagraphs, learnSources, learnTermIds, tabSections,
} from '../src/presentation/view/learn.js';

const WEB = 'src/presentation/web';

/** Markdown wraps; the claims do not. Compare on whitespace-normalised text, never on line breaks. */
const flat = (text: string): string => text.replace(/\s+/g, ' ');

const doc = (): string => {
  assert.ok(existsSync(LEARN_DOC_PATH), `${LEARN_DOC_PATH} must exist — AC 1`);
  return readFileSync(LEARN_DOC_PATH, 'utf8');
};

// ---------------------------------------------------------------------------
// AC 2 — every tab has a section, and the list is derived
// ---------------------------------------------------------------------------

test('the section map covers exactly the eight destinations, derived from TABS', () => {
  const tabIds = TABS.map(tab => tab.id);
  assert.deepEqual(Object.keys(TAB_SECTIONS).sort(), [...tabIds].sort(),
    'a destination without a learn section is an unexplained screen');
  assert.equal(tabIds.length, 8, 'the eight reference destinations');
  // Each entry knows which tab it is, so a copy-paste cannot leave two sections claiming one screen.
  for (const id of tabIds) {
    const section = learnForTab(id);
    assert.equal(section.tab, id, `${id} section is filed under the wrong tab`);
  }
  // The panel renders them in the navigation's order rather than in object-literal order.
  assert.deepEqual(tabSections().map(section => section.tab), tabIds);
});

test('a screen section asks one question and answers it in two to four paragraphs', () => {
  for (const section of tabSections()) {
    assert.ok(section.question.trim().endsWith('?'), `${section.tab} must state the question it answers`);
    assert.ok(section.paragraphs.length >= 2 && section.paragraphs.length <= 4,
      `${section.tab} has ${section.paragraphs.length} paragraphs; UX-10 asks for two to four`);
    for (const paragraph of section.paragraphs)
      assert.ok(paragraph.trim().length > 80, `${section.tab} has a paragraph too short to explain anything`);
    assert.ok(section.sources.length > 0, `${section.tab} must say where its claims come from`);
  }
  for (const section of MODEL_SECTIONS) {
    assert.ok(section.paragraphs.length >= 2 && section.paragraphs.length <= 4,
      `${section.id} has ${section.paragraphs.length} paragraphs`);
    assert.ok(section.sources.length > 0, `${section.id} must cite its sources`);
  }
  const ids = [...MODEL_SECTIONS.map(s => s.id), ...tabSections().map(s => s.id)];
  assert.deepEqual(ids, [...new Set(ids)], 'section ids are DOM ids; two sections cannot share one');
});

// ---------------------------------------------------------------------------
// AC 1 — the doc exists, is short enough to read, and does not contradict the app
// ---------------------------------------------------------------------------

test('the written walkthrough stays within the length a general reader will actually read', () => {
  const words = doc().trim().split(/\s+/).length;
  assert.ok(words > 0 && words <= 2500, `${LEARN_DOC_PATH} is ${words} words; UX-10 caps it at 2,500`);
});

test('every shared claim is one string, carried verbatim by both the panel and the doc', () => {
  const panel = learnParagraphs().map(flat);
  const written = flat(doc());
  assert.ok(LEARN_SHARED_CLAIMS.length >= 6, 'the conventions worth pinning are more than a couple');
  for (const claim of LEARN_SHARED_CLAIMS) {
    const wanted = flat(claim);
    assert.ok(panel.some(paragraph => paragraph.includes(wanted)),
      `the in-app panel dropped a shared claim: ${claim}`);
    assert.ok(written.includes(wanted),
      `${LEARN_DOC_PATH} dropped a shared claim, so the doc and the app can now disagree: ${claim}`);
  }
});

test('the doc cites the conventions it is derived from rather than asserting them alone', () => {
  const written = flat(doc());
  for (const cited of ['AGENTS.md', 'docs/architecture-decisions.md', 'src/engine/ledger.ts', 'profileSchema'])
    assert.ok(written.includes(cited), `${LEARN_DOC_PATH} must name ${cited}`);
  // ADR 002 and ADR 004 are the two the walkthrough leans on hardest.
  assert.ok(/ADR 002/.test(written) && /ADR 004/.test(written));
});

// ---------------------------------------------------------------------------
// Quoted, not paraphrased
// ---------------------------------------------------------------------------

test('shared wording arrives as its owning constant, in the panel and in the doc', () => {
  const panel = learnParagraphs().map(flat).join(' ');
  const written = flat(doc());
  // The arbitration clause decides which of the two verdict numbers counts. Both surfaces quote it.
  assert.ok(panel.includes(AUTHORITY_CLAUSE), 'the panel paraphrased the arbitration clause');
  assert.ok(written.includes(AUTHORITY_CLAUSE), `${LEARN_DOC_PATH} paraphrased the arbitration clause`);
  // The starter caveat may be sentence-cased into a clause, but not reworded.
  const caveatBody = STARTER_ILLUSTRATION_CAVEAT.slice(1);
  assert.ok(panel.includes(flat(caveatBody)), 'the panel reworded the starter illustration caveat');
  // The three pension figures must stay three different names on both surfaces.
  for (const label of [TAX_RELIEF_LABEL, TAX_AND_NI_LABEL, PERSONAL_NET_COST_LABEL]) {
    assert.ok(panel.includes(label), `the panel dropped the name “${label}”`);
    assert.ok(written.includes(label), `${LEARN_DOC_PATH} dropped the name “${label}”`);
  }
});

// ---------------------------------------------------------------------------
// It explains; it never reports
// ---------------------------------------------------------------------------

test('no figure on the learn surface could be mistaken for a result', () => {
  for (const paragraph of [...learnParagraphs(), ...MODEL_SECTIONS.map(s => s.title)]) {
    assert.ok(!paragraph.includes('£'), `a money figure reached the learn text: ${paragraph}`);
    assert.ok(!/\d\s*%/.test(paragraph), `a percentage reached the learn text: ${paragraph}`);
  }
  // Nor may it recommend. The app explains and simulates; Part D forbids the rest.
  const panel = learnParagraphs().join(' ').toLowerCase();
  for (const phrase of ['you should', 'we recommend', 'the best option is'])
    assert.ok(!panel.includes(phrase), `the learn text advises: “${phrase}”`);
});

// ---------------------------------------------------------------------------
// References resolve in both directions
// ---------------------------------------------------------------------------

test('every glossary term the learn text points at is defined', () => {
  const defined = new Set(GLOSSARY.map(entry => entry.id));
  for (const id of learnTermIds())
    assert.ok(defined.has(id), `the learn text points at an undefined glossary term: ${id}`);
  // Every section offers at least one word to open, since the whole point is the ladder down.
  for (const section of [...MODEL_SECTIONS, ...tabSections()])
    assert.ok(section.terms.length > 0, `${section.id} offers no glossary term`);
});

test('every source the learn text cites is a real path in this repository', () => {
  for (const cited of learnSources()) {
    // Citations carry a human pointer in brackets — "docs/architecture-decisions.md (ADR 002)".
    const path = cited.replace(/\s*\(.*\)$/, '').replace(/\/$/, '');
    assert.ok(existsSync(path), `the learn text cites a path that does not exist: ${cited}`);
  }
});

// ---------------------------------------------------------------------------
// Surface audit, and AC 4 — no engine or profile change of any kind
// ---------------------------------------------------------------------------

test('one component renders learn sections, and the shell reaches it', () => {
  const sources = readdirSync(WEB)
    .filter(file => file.endsWith('.tsx') || file.endsWith('.ts'))
    .map(file => ({ file, source: readFileSync(`${WEB}/${file}`, 'utf8') }));

  // Detection is on the sources, so a screen that starts rendering learn content joins this audit
  // or fails it. Copy that lives in two components is copy that drifts apart.
  const renders = sources.filter(entry =>
    entry.source.includes('MODEL_SECTIONS') || entry.source.includes('TAB_SECTIONS')
    || entry.source.includes('learnForTab') || entry.source.includes('tabSections('));
  assert.deepEqual(renders.map(entry => entry.file).sort(), [...LEARN_SURFACES].sort(),
    'a file rendering learn sections must be listed in LEARN_SURFACES');

  // The panel has to be reachable, and from the shell rather than from one screen.
  const shell = sources.find(entry => entry.file === 'app.tsx');
  assert.ok(shell, 'app.tsx is the shell');
  assert.ok(shell.source.includes('<LearnPanel'), 'the shell must render the panel');
  assert.ok(/learn-button|open-learn/.test(shell.source), 'the sidebar must offer a way in');
  // Opening an explanation cannot start a run: reading is free, and 10,000 paths are not.
  for (const entry of renders)
    for (const forbidden of ['runner.run(', 'runMonteCarlo', 'onRun'])
      assert.ok(!entry.source.includes(forbidden), `${entry.file} can start a run from the learn panel`);
});

test('the learn text is presentation only — no engine or domain module reaches it', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`)
      : entry.name.endsWith('.ts') ? [`${dir}/${entry.name}`] : []);
  for (const file of [...walk('src/engine'), ...walk('src/domain')]) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!source.includes('learn.js') && !source.includes('view/learn'),
      `${file} imports the learn copy; UX-10 changes no engine and no profile`);
  }
});

// A compile-time guard that the map is total. If `TabId` gains a member and `TAB_SECTIONS` does not,
// this stops being assignable and `npm run typecheck` fails before any test runs.
const _total: Record<TabId, unknown> = TAB_SECTIONS;
void _total;
void LEARN_DOC_PATH;
