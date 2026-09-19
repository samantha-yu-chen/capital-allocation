/**
 * UX-10: the conceptual on-ramp, as data.
 *
 * Finding A.1.9 was that the app has no explanation of itself: the only walkthrough was a PDF
 * outside it, written by the user because the product did not carry one. This module is that
 * explanation in the app — what a projected year does, what the simulation does, what the numbers
 * mean, what the model deliberately refuses to do, and then one section per screen saying which
 * question it answers and how to read its output.
 *
 * Three rules hold it honest:
 *
 * 1. **It computes nothing and asserts no figure.** Every sentence here is about the *method*. A
 *    number on this surface would be a result nobody ran, and `docs/ux-improvement-plan.md` Part D
 *    forbids an illustrative figure that could pass for one.
 * 2. **Shared wording is quoted, never paraphrased.** Where another module already owns a sentence
 *    — `AUTHORITY_CLAUSE`, `STARTER_ILLUSTRATION_CAVEAT`, the three pension-relief labels — this
 *    module interpolates that constant. Paraphrasing is how the app and the doc start disagreeing
 *    about which number decides.
 * 3. **`LEARN_SHARED_CLAIMS` must appear verbatim both here and in the markdown doc.** The doc
 *    (`docs/learnings/how-the-model-works.md`) and this panel are written for different readers and
 *    may differ in phrasing, but the load-bearing claims are one string in one place, and a test
 *    reads the file to prove the doc still carries them. Copy divergence is allowed; contradiction
 *    on a convention is not.
 *
 * Every section cites the repository files its claims come from, so a reader who wants the rule
 * rather than the explanation knows where to look, and a later edit to a convention has a list of
 * the prose it invalidates.
 */
import { TABS, type TabId } from './tabs.js';
import { AUTHORITY_CLAUSE } from './two-numbers.js';
import { STARTER_ILLUSTRATION_CAVEAT } from './starter-picker.js';
import { PERSONAL_NET_COST_LABEL, TAX_AND_NI_LABEL, TAX_RELIEF_LABEL } from './pension-relief.js';

/** Where the long-form version lives. Named once so the panel's link and the test agree. */
export const LEARN_DOC_PATH = 'docs/learnings/how-the-model-works.md';

/**
 * The claims the app and the written doc are not allowed to drift apart on.
 *
 * Each is a convention from `AGENTS.md` or `docs/architecture-decisions.md` that a reader can be
 * actively misled by if the two surfaces say different things. They are exported as strings rather
 * than described, because a test can check a string against the markdown file and cannot check a
 * description against anything.
 */
export const LEARN_SHARED_CLAIMS = [
  'A projected year runs from one birthday to the next: year t covers the year from age t to age t + 1.',
  'Inside a year the order is fixed: opening balances, then income, tax and contributions, then spending and withdrawals, then that year’s market return, then closing balances.',
  'If a year cannot be funded, that failure is recorded, and a good market later in the same path cannot erase it.',
  'The ledger works in the money of the day, and every figure the app shows you has been converted back into today’s money, so you never see the same inflation applied twice.',
  'The model never cuts your spending for you part-way through a run: the floor, target and comfort levels are three separate runs, not one run that adapts.',
  `The success probability is ${AUTHORITY_CLAUSE}.`,
  'A probability measured from a sample carries a margin of error, and a difference smaller than that margin is not a finding.',
  'This app explains and simulates. It does not advise, and it does not predict.',
] as const;

export interface LearnSection {
  /** Stable kebab-case id; also the DOM id the in-page links point at. */
  id: string;
  title: string;
  /** Two to four paragraphs, in reading order. */
  paragraphs: readonly string[];
  /** Glossary ids offered beside the section. Every one must resolve in `glossary.ts`. */
  terms: readonly string[];
  /** Repository paths the section's claims are taken from. */
  sources: readonly string[];
}

/** A screen's section: the question it answers, then how to read what it puts on the page. */
export interface LearnTabSection extends LearnSection {
  tab: TabId;
  question: string;
}

/**
 * The walkthrough: one year, then many years, then the numbers, then the refusals.
 *
 * Order is deliberate. A reader who stops after the first two sections still knows what the app is
 * doing to their money; a reader who stops before the last one does not know what it will not do,
 * which is the part that gets a model misused.
 */
export const MODEL_SECTIONS: readonly LearnSection[] = [
  {
    id: 'what-a-year-does',
    title: 'What one year of the model does',
    paragraphs: [
      'The model works one year at a time, and every year is the same five steps: you earn, you are taxed, '
      + 'you spend, whatever is left is invested, and then the markets move. '
      + LEARN_SHARED_CLAIMS[1],
      LEARN_SHARED_CLAIMS[0]
      + ' The first point on every wealth chart is what you have today, at your current age. Every point after '
      + 'that is a closing balance at the end of a year, not an opening one.',
      'The order matters more than it looks. Because spending and withdrawals are settled before that year’s '
      + 'market return is applied, a year where the money ran out stays a year where the money ran out. '
      + LEARN_SHARED_CLAIMS[2]
      + ' A model that let a December rally pay January’s bills would report a plan as safe that was not.',
      'Money leaves your accounts in the order you set, not in whichever order happens to look best. Cash, '
      + 'ordinary investments, ISA and pension are drawn in the sequence recorded in your profile, and the '
      + 'pension cannot be touched at all before the pension access age.',
    ],
    terms: ['todays-money', 'accessible-wealth', 'drawdown', 'bridge-period'],
    sources: ['docs/architecture-decisions.md (ADR 002)', 'src/engine/ledger.ts', 'src/domain/contracts.ts'],
  },
  {
    id: 'tax-and-pensions',
    title: 'Tax, pensions and what a contribution really costs',
    paragraphs: [
      'Tax is calculated from the published rules for the tax year in your profile, separately for Scotland '
      + 'and the rest of the UK, and it is applied to each year of the projection rather than estimated once '
      + 'and scaled. Those rules are then held constant in real terms for the whole projection: bands and '
      + 'allowances move with inflation and never otherwise change. Real tax law will change over a lifetime, '
      + 'and that risk is not modelled — the app says so on every screen rather than hiding it here.',
      'A pension contribution is worth more than it costs you, and the app names the difference three ways '
      + `rather than lumping them together. “${TAX_RELIEF_LABEL}” is income tax only — the figure people mean `
      + `when they say relief at their marginal rate. “${TAX_AND_NI_LABEL}” adds the National Insurance a `
      + 'salary sacrifice avoids, so it is '
      + `larger whenever sacrifice is in use. “${PERSONAL_NET_COST_LABEL}” is the drop in your take-home pay, `
      + 'and it is the only one of the three you can check against a payslip.',
      'Contributions are also constrained, not merely counted. When a contribution would exceed the pension '
      + 'allowance available to you, the app reports the plan as unsupported and says which limit stopped it. '
      + 'It does not quietly trim the contribution to fit and then show you a probability for a plan you did '
      + 'not describe.',
    ],
    terms: ['salary-sacrifice', 'annual-allowance', 'taper', 'mpaa', 'sipp'],
    sources: ['src/config/tax/', 'src/domain/tax/', 'docs/tax-rules-2026-27.md', 'src/presentation/view/pension-relief.ts'],
  },
  {
    id: 'what-the-simulation-does',
    title: 'What the simulation does that a single projection cannot',
    paragraphs: [
      'Running the plan once, with average returns every year, tells you whether the arithmetic works. It '
      + 'cannot tell you whether the plan is safe, because no real lifetime gets the average every year. The '
      + 'simulation therefore runs the same plan thousands of times over randomly generated market histories, '
      + 'built from the average returns, the volatility and the correlations in your profile.',
      'Each of those runs is a complete lifetime ledger — the same five steps, the same tax rules, the same '
      + 'withdrawal order — differing only in the market returns it meets. A run counts as a success if every '
      + 'year of it was funded. The success probability is the share of runs that succeeded.',
      'Two runs of the app with the same inputs give the same answer, because each path’s random numbers come '
      + 'from your seed and that path’s position in the list, and nothing else. That is also what makes '
      + 'comparisons fair: when the app compares two plans, it compares them over matching paths, so a '
      + 'difference between them is a difference in the plans rather than in the weather they were given.',
      'Runs that you cancel, and runs that fail, publish nothing at all. There is no partial probability and '
      + 'no last-good number left standing on the screen — if the figure is there, a complete run produced it '
      + 'from the inputs currently on the form.',
    ],
    terms: ['monte-carlo', 'volatility', 'correlation', 'equities', 'sequence-risk'],
    sources: ['docs/architecture-decisions.md (ADR 004)', 'src/engine/monte-carlo/simulation.ts', 'src/engine/returns.ts'],
  },
  {
    id: 'reading-the-numbers',
    title: 'Reading the numbers without over-reading them',
    paragraphs: [
      `${LEARN_SHARED_CLAIMS[5]} The reference FIRE number beside it — retirement spending divided by the `
      + 'reference withdrawal rate — is a useful landmark and a piece of arithmetic, not a safety result. It '
      + 'knows nothing about your tax, your pension access age or the order markets happen to arrive in.',
      LEARN_SHARED_CLAIMS[6]
      + ' Two plans a percentage point apart over ten thousand paths have not been shown to differ, and the '
      + 'app writes its probabilities with that uncertainty attached rather than leaving you to assume the '
      + 'last digit is real.',
      LEARN_SHARED_CLAIMS[3]
      + ' The accounting underneath runs in the money of each future year, because that is the only way to '
      + 'apply a tax band correctly, and the conversion back happens once, at the boundary between the engine '
      + 'and the screen.',
      'A percentile band on a chart is not a forecast and not a range of likely outcomes for you. It says '
      + 'that, of the runs this app performed, that share ended at or below that line. Half the runs end below '
      + 'the median, and the ones at the bottom are the ones worth planning against.',
    ],
    terms: ['success-probability', 'standard-error', 'withdrawal-rate', 'todays-money', 'percentile', 'inflation-index'],
    sources: ['src/presentation/view/two-numbers.ts', 'src/engine/fire-curve.ts', 'docs/architecture-decisions.md (ADR 002)', 'AGENTS.md'],
  },
  {
    id: 'what-it-will-not-do',
    title: 'What this model deliberately does not do',
    paragraphs: [
      LEARN_SHARED_CLAIMS[7]
      + ' Nothing on any screen is a recommendation, and no screen ranks your options by how well they turned '
      + 'out and calls the winner the right answer. Where the app orders things — the marginal screen, the '
      + 'attribution screen — it is telling you what its own model measured, on the assumptions you entered.',
      LEARN_SHARED_CLAIMS[4]
      + ' Real people cut back when a bad decade arrives, and that flexibility is worth a great deal. Modelling '
      + 'it automatically would make almost every plan look safe, so instead you choose a spending level and '
      + 'the app tests that level honestly. Running the floor level is how you ask “what if I had to cut back?”.',
      'It models one household, one property, and a market described by averages, volatilities and '
      + 'correlations that do not change with age. It does not model job loss, divorce, care costs, inheritance, '
      + 'a company you own, or a glide path that shifts you into bonds as you get older. Anything you want '
      + 'tested has to be something you can express in the profile.',
      'The starting situations the app offers are illustrations of this, and say so on every card: '
      + STARTER_ILLUSTRATION_CAVEAT.charAt(0).toLowerCase() + STARTER_ILLUSTRATION_CAVEAT.slice(1),
    ],
    terms: ['fire', 'state-pension', 'emergency-fund'],
    sources: ['AGENTS.md', 'docs/ux-improvement-plan.md (Part D)', 'src/presentation/view/starter-picker.ts', 'src/engine/spending.ts'],
  },
];

/**
 * One section per screen. Keyed on `TabId`, so a ninth destination cannot be added without the
 * coverage test — which derives its list from `TABS` — failing.
 */
export const TAB_SECTIONS: Record<TabId, LearnTabSection> = {
  overview: {
    tab: 'overview',
    id: 'screen-overview',
    title: 'Overview',
    question: 'Where do I stand today, and what does this year look like?',
    paragraphs: [
      'This screen is the model run once, with average returns, and no randomness anywhere. It shows what you '
      + 'have now, what this year earns, pays in tax, spends and saves, and then the whole year-by-year ledger '
      + 'to the end of the plan. It is the screen to check first, because a figure that looks wrong here is an '
      + 'input you mistyped rather than a market you cannot control.',
      'The reference FIRE number is arithmetic: your retirement spending divided by the reference withdrawal '
      + 'rate. Treat it as a landmark to steer by. The headline success figure is only shown once a full '
      + 'simulation has finished for exactly these inputs — change a field and it disappears rather than going '
      + 'stale.',
      'Read the ledger rows as closing positions. Each row covers the year from that age to the next birthday, '
      + 'and the balance shown is where the year ended.',
    ],
    terms: ['todays-money', 'accessible-wealth', 'withdrawal-rate', 'emergency-fund'],
    sources: ['src/presentation/view/overview-model.ts', 'src/engine/ledger.ts'],
  },
  fire: {
    tab: 'fire',
    id: 'screen-fire',
    title: 'FIRE & Monte Carlo',
    question: 'Across many possible market histories, how often does this plan work?',
    paragraphs: [
      'This is the safety test. It runs the plan over thousands of generated market histories and reports the '
      + 'share in which every year was funded, together with how the failures divided between running out '
      + 'before the pension opens and running out afterwards. The run starts when you press the button and '
      + 'costs real time, which is why nothing here runs on its own.',
      `${LEARN_SHARED_CLAIMS[5]} Read it with its margin of error, not to the last digit, and compare it `
      + 'against the target probability you set rather than against a number you have in mind.',
      'The failure breakdown is the useful part. Failures concentrated before the pension access age mean the '
      + 'bridge is too thin and the fix is money you can reach; failures spread across old age mean the plan '
      + 'is too expensive for the capital, wherever that capital sits.',
      'The percentile fan shows where the runs ended up, not where you will. The lower band is the part to '
      + 'plan against, because a plan that only works in the upper band is a plan that needs luck.',
    ],
    terms: ['success-probability', 'monte-carlo', 'standard-error', 'percentile', 'bridge-period', 'sequence-risk'],
    sources: ['src/engine/monte-carlo/simulation.ts', 'src/presentation/view/monte-carlo-model.ts'],
  },
  curve: {
    tab: 'curve',
    id: 'screen-curve',
    title: 'FIRE Age Curve',
    question: 'How much does waiting a year actually buy me?',
    paragraphs: [
      'The same full simulation, repeated at every candidate FIRE age, so you can see the whole trade rather '
      + 'than one point on it. It also reports the earliest age at which the plan clears the target '
      + 'probability you set.',
      'The shape is the answer. A steep stretch means a year of extra work moves the plan a long way — more '
      + 'contributions, fewer years to fund, and a shorter bridge to the pension. A flat stretch means another '
      + 'year buys very little, and whatever is limiting the plan is not time.',
      'Every point carries the same sampling uncertainty as any other probability here, so a curve that wobbles '
      + 'by a point or two between neighbouring ages is wobbling inside its own margin of error, not telling '
      + 'you that one age is better than its neighbour.',
    ],
    terms: ['fire', 'success-probability', 'bridge-period', 'standard-error'],
    sources: ['src/engine/fire-curve.ts', 'src/presentation/view/solver-model.ts'],
  },
  marginal: {
    tab: 'marginal',
    id: 'screen-marginal',
    title: 'Marginal Allocation',
    question: 'If I had one more pound to save, where would it do the most good?',
    paragraphs: [
      'This screen takes the next increment of money and works out what each destination — pension, ISA, '
      + 'ordinary investment account, mortgage — actually does with it after tax and after the rules that '
      + 'constrain it. An employer match, a marginal rate, a withdrawn personal allowance and an annual '
      + 'allowance are all part of the arithmetic, which is why the ordering can be surprising.',
      'The answer is specific to the increment, not to the person. It tells you where the *next* money lands '
      + 'best given everything already in your profile; it does not say one wrapper is better than another in '
      + 'general, and it changes as soon as a limit is reached.',
      `The three pension figures are deliberately named apart: “${TAX_RELIEF_LABEL}” is income tax only, `
      + `“${TAX_AND_NI_LABEL}” adds the National Insurance a sacrifice avoids, and “${PERSONAL_NET_COST_LABEL}” `
      + 'is what your take-home pay drops by. Comparing the wrong two of those is the easiest mistake on this '
      + 'screen.',
      'Where an option is not available to you — a contribution above the allowance you have left, for '
      + 'instance — it is reported as unsupported, not as a plan that failed.',
    ],
    terms: ['isa', 'gia', 'sipp', 'annual-allowance', 'mpaa', 'taper', 'salary-sacrifice'],
    sources: ['src/engine/marginal.ts', 'src/presentation/view/marginal-model.ts', 'docs/architecture-decisions.md (ADR 006)'],
  },
  solver: {
    tab: 'solver',
    id: 'screen-solver',
    title: 'Reverse Solver',
    question: 'What would have to change for this plan to hit my target?',
    paragraphs: [
      'Instead of asking what your plan achieves, this screen fixes the target and solves for one input: the '
      + 'salary, the saving, the FIRE age, the retirement spending, the starting capital or the pension '
      + 'contribution that would reach it. You choose the question; it changes one thing and holds the rest of '
      + 'your profile still.',
      'Each candidate value is a complete simulation, so a solve is many runs and takes correspondingly '
      + 'longer. The app tells you the cost before it starts and never begins one on its own.',
      'The answer is a boundary, not a target and not a recommendation. It says where the plan crosses the '
      + 'probability you asked for under today’s assumptions — and because the probability it is solving '
      + 'against is sampled, the crossing point is itself uncertain by roughly the width of that sampling '
      + 'error.',
    ],
    terms: ['success-probability', 'fire', 'standard-error'],
    sources: ['src/engine/solver.ts', 'src/engine/solve.ts', 'docs/architecture-decisions.md (ADR 009)'],
  },
  scenarios: {
    tab: 'scenarios',
    id: 'screen-scenarios',
    title: 'Scenario Comparison',
    question: 'How do my alternatives compare, on the same terms?',
    paragraphs: [
      'Save a plan under a name, change something, save another, and compare them side by side. The matrix '
      + 'does the same thing over a grid of salary, spending and strategy, so you can see a whole surface '
      + 'rather than two points on it.',
      'Comparisons reuse matching market paths by construction: the same seed and the same path positions for '
      + 'every plan in the comparison, asserted rather than assumed. A difference you see is a difference '
      + 'between the plans, not between the market histories they happened to be handed.',
      `${LEARN_SHARED_CLAIMS[6]} The app shows each cell with its uncertainty for exactly this reason, and a `
      + 'leader whose lead is inside that error has not been shown to lead.',
    ],
    terms: ['success-probability', 'todays-money', 'percentile', 'standard-error'],
    sources: ['src/engine/scenario.ts', 'src/presentation/view/scenario-model.ts', 'docs/architecture-decisions.md (ADR 007)'],
  },
  property: {
    tab: 'property',
    id: 'screen-property',
    title: 'Property & Leverage',
    question: 'Does buying, owning or renting leave me better off in this plan?',
    paragraphs: [
      'The property lives inside the same lifetime ledger as everything else: the purchase costs cash and '
      + 'stamp duty on the day, the mortgage is amortised and charged every year, and the house appreciates '
      + 'after the year’s flows rather than before them. It is not a separate calculator bolted on beside the '
      + 'plan.',
      'The comparison against renting is run over matching market paths, with rent invested where the model '
      + 'says it would have been, so the two sides differ in housing and nothing else. Outside this comparison '
      + 'the app deliberately leaves that rent-investment assumption switched off, so it can never quietly '
      + 'flatter a plan elsewhere.',
      'Property equity is not spending money. It is never sold automatically to fund a year, so a plan that '
      + 'fails while sitting on a large house has genuinely failed on the terms you set — selling is a decision '
      + 'you make in the profile, not one the model makes for you.',
    ],
    terms: ['todays-money', 'accessible-wealth', 'cost-basis'],
    sources: ['src/engine/property.ts', 'src/engine/property-comparison.ts', 'docs/property-model.md', 'docs/architecture-decisions.md (ADR 005)'],
  },
  attribution: {
    tab: 'attribution',
    id: 'screen-attribution',
    title: 'Where It Comes From',
    question: 'Which assumption is my result actually resting on?',
    paragraphs: [
      'This screen takes the result apart. It measures how much each lever moves the outcome, how sensitive '
      + 'the plan is to the assumptions you are least sure about, and how it behaves down a handful of '
      + 'deliberately nasty deterministic paths.',
      'Sensitivity is not blame. A plan that swings hard on the assumed equity return is telling you where '
      + 'its uncertainty lives, not that the return assumption is wrong. The stress paths are constructed, not '
      + 'sampled — they exist to show the mechanism of a bad sequence, and they have no probability attached.',
      'Ordered lists here are measurements of this model on your inputs, and the ordering can be inside the '
      + 'sampling error of the runs behind it. Read the top of the list as “this is where the movement is”, '
      + 'not as instructions.',
    ],
    terms: ['sequence-risk', 'success-probability', 'inflation-index', 'state-pension', 'equities', 'volatility', 'correlation'],
    sources: ['src/engine/attribution.ts', 'src/engine/stress.ts', 'docs/architecture-decisions.md (ADR 008)'],
  },
};

/** The screens that render learn sections. Audited against the sources, like the other shared copy. */
export const LEARN_SURFACES: readonly string[] = ['learn-panel.tsx'];

/** The section for a screen. Total by construction — `TabId` has exactly eight members. */
export const learnForTab = (tab: TabId): LearnTabSection => TAB_SECTIONS[tab];

/** Tab sections in the navigation's own order, so the panel cannot invent a different one. */
export const tabSections = (): readonly LearnTabSection[] => TABS.map(tab => TAB_SECTIONS[tab.id]);

/** Every glossary id the learn surface points at, for the glossary's reference audit. */
export function learnTermIds(): Set<string> {
  const ids = new Set<string>();
  for (const section of MODEL_SECTIONS) for (const id of section.terms) ids.add(id);
  for (const section of Object.values(TAB_SECTIONS)) for (const id of section.terms) ids.add(id);
  return ids;
}

/** Every repository path cited anywhere in the learn text. */
export function learnSources(): Set<string> {
  const sources = new Set<string>();
  for (const section of MODEL_SECTIONS) for (const path of section.sources) sources.add(path);
  for (const section of Object.values(TAB_SECTIONS)) for (const path of section.sources) sources.add(path);
  return sources;
}

/** Every paragraph on the surface, which is what the shared-claim audit searches. */
export function learnParagraphs(): readonly string[] {
  return [
    ...MODEL_SECTIONS.flatMap(section => section.paragraphs),
    ...Object.values(TAB_SECTIONS).flatMap(section => [section.question, ...section.paragraphs]),
  ];
}
