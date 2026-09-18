/**
 * The words this app cannot avoid, explained once.
 *
 * The audit's finding was that GIA, MPAA, sequence risk and p90 all appear as labels or help text
 * with no ladder down to ordinary language. This file is that ladder: a term is defined in one
 * paragraph aimed at someone who knows "salary", "rent" and "pension" and nothing else, and every
 * definition explains rather than advises — the app models, it does not recommend.
 *
 * It is data, and React-free. A registry entry names the terms its wording relies on
 * (`ControlFieldDef.terms`), and each screen names the terms its *results* use (`SCREEN_TERMS`), so
 * "which terms does this surface need?" is answered by reading data rather than by scanning prose.
 * A test holds both directions honest: nothing may reference a term that does not exist, and no term
 * may sit in the glossary unreferenced.
 */
import type { TabId } from './tabs.js';

export interface GlossaryEntry {
  /** Stable kebab-case id; the reference key and the DOM id. */
  id: string;
  /** Plain name first, the technical term once in parentheses. */
  term: string;
  /** One paragraph. Plain first sentence, precision after it. */
  definition: string;
  /** Related ids, offered as follow-on reading. */
  seeAlso?: readonly string[];
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'isa',
    term: 'ISA (individual savings account)',
    definition:
      'A wrapper you can put savings or investments inside, where growth and withdrawals are not taxed. '
      + 'You can pay in up to a set amount each tax year, and you can take money out at any age. '
      + 'In this model the ISA is one of the accounts spending is drawn from, and nothing inside it is taxed.',
    seeAlso: ['gia', 'annual-allowance'],
  },
  {
    id: 'gia',
    term: 'Ordinary investment account (GIA, general investment account)',
    definition:
      'Investments held outside any tax shelter. Dividends are taxed each year, and when you sell at a '
      + 'profit the gain above the annual exemption is taxed too. It is where money goes once the ISA '
      + 'allowance for the year is used up, and it is the only investment account in this model that '
      + 'generates a tax bill while you simply hold it.',
    seeAlso: ['isa', 'cost-basis'],
  },
  {
    id: 'sipp',
    term: 'Personal pension you run yourself (SIPP)',
    definition:
      'A pension you open and control, rather than one arranged by an employer. It follows the same rules '
      + 'as a workplace pension — tax relief going in, no access before the pension access age, income tax '
      + 'on most of what comes out — and this model tracks it as a separate balance so that employer '
      + 'contributions and your own are never confused.',
    seeAlso: ['annual-allowance', 'drawdown'],
  },
  {
    id: 'salary-sacrifice',
    term: 'Salary sacrifice',
    definition:
      'An arrangement where you give up part of your gross pay and your employer pays that amount straight '
      + 'into your pension instead. Because the money never counts as salary, neither you nor your employer '
      + 'pays National Insurance on it, so the same pension contribution costs you less take-home pay. '
      + 'Whether it is available is your employer’s decision, which is why this model asks rather than assumes.',
    seeAlso: ['annual-allowance', 'taper'],
  },
  {
    id: 'fire',
    term: 'Financial independence (FIRE — financial independence, retire early)',
    definition:
      'The point where your savings, investments and pensions can pay for your living costs without a salary. '
      + 'Retiring is then a choice rather than a requirement. Throughout this app, "FIRE age" means the age '
      + 'from which you stop assuming a salary and start funding spending from what you have.',
    seeAlso: ['bridge-period', 'withdrawal-rate'],
  },
  {
    id: 'bridge-period',
    term: 'The bridge period',
    definition:
      'The years between stopping work and the age you can first touch your pension. Spending in those years '
      + 'has to come from cash, ISA and ordinary investments alone, so a plan can be comfortably funded '
      + 'overall and still fail here. This model reports bridge failures separately for that reason.',
    seeAlso: ['fire', 'accessible-wealth'],
  },
  {
    id: 'monte-carlo',
    term: 'Monte Carlo simulation',
    definition:
      'Running your plan thousands of times over, each time with a different randomly drawn sequence of '
      + 'market returns and inflation, and then counting how the results came out. It replaces a single '
      + 'guess about the future with a spread of possible futures. It is not a forecast: it says what your '
      + 'plan does under the market assumptions you entered, not what markets will do.',
    seeAlso: ['success-probability', 'percentile', 'standard-error'],
  },
  {
    id: 'success-probability',
    term: 'Success probability',
    definition:
      'The share of the simulated futures in which your plan paid for your essential spending every year to '
      + 'the end age without running out. 69% means it worked in 6,900 of 10,000 runs. It is the number your '
      + 'own target is judged against, and it already includes taxes, inflation and bad market years.',
    seeAlso: ['monte-carlo', 'standard-error', 'sequence-risk'],
  },
  {
    id: 'percentile',
    term: 'Percentile (p10, median, p90)',
    definition:
      'A way of describing a spread of outcomes by where a value sits in the ranking. The 10th percentile '
      + '(p10) is the figure only one run in ten came in below; the median is the middle run; p90 is the '
      + 'figure only one in ten beat. The distance between p10 and p90 is how uncertain the outcome is — a '
      + 'wide band is a real finding, not a defect.',
    seeAlso: ['monte-carlo', 'volatility'],
  },
  {
    id: 'todays-money',
    term: 'Today’s money (real terms) versus cash terms (nominal)',
    definition:
      'A figure in today’s money has had inflation taken out, so £40,000 in thirty years means "what £40,000 '
      + 'buys today". A cash-terms figure is the number that would actually appear on a statement, inflation '
      + 'included. Every result this app shows you is in today’s money, so amounts decades apart can be '
      + 'compared directly; the year-by-year accounting underneath is done in cash terms and converted once.',
    seeAlso: ['inflation-index'],
  },
  {
    id: 'inflation-index',
    term: 'Inflation index',
    definition:
      'A running multiplier for how much prices have risen since today: 1.00 now, 1.34 after ten years of '
      + '3% inflation. Each simulated future draws its own inflation each year and builds its own index, '
      + 'which is what converts cash-terms balances back into today’s money.',
    seeAlso: ['todays-money'],
  },
  {
    id: 'withdrawal-rate',
    term: 'Withdrawal rate (the "4% rule")',
    definition:
      'The share of a pot you take out in the first year of retirement. A 4% rate means a pot of 25 times '
      + 'your yearly spending. It is arithmetic, not a safety result: it says nothing about tax on '
      + 'withdrawals, or about the order good and bad market years arrive in. This app uses it only for the '
      + 'reference FIRE number and judges your plan on the success probability instead.',
    seeAlso: ['fire', 'success-probability', 'sequence-risk'],
  },
  {
    id: 'annual-allowance',
    term: 'Annual allowance',
    definition:
      'The most that can go into your pensions in one tax year — from you, your employer and tax relief '
      + 'together — before a tax charge applies. Unused allowance from earlier years can sometimes be '
      + 'carried forward, which this model only counts if you enter it explicitly, because eligibility '
      + 'depends on history the app cannot see.',
    seeAlso: ['taper', 'mpaa', 'salary-sacrifice'],
  },
  {
    id: 'mpaa',
    term: 'Reduced pension allowance after taking money out (MPAA)',
    definition:
      'Once you have flexibly taken taxable income from a pension pot, the amount you may pay into pensions '
      + 'each year drops sharply and carry-forward stops applying to it. It is a switch that stays on for '
      + 'good, so the model asks whether it has already been triggered rather than trying to infer it.',
    seeAlso: ['annual-allowance', 'drawdown'],
  },
  {
    id: 'taper',
    term: 'Tapered allowance for higher earners (the taper)',
    definition:
      'Above a set level of income, the annual allowance shrinks by £1 for every £2 of income, down to a '
      + 'floor. Whether pension contributions made by salary sacrifice count towards that income depends on '
      + 'when the arrangement started, which is why this model asks you rather than guessing.',
    seeAlso: ['annual-allowance', 'salary-sacrifice'],
  },
  {
    id: 'cost-basis',
    term: 'Cost basis (book cost)',
    definition:
      'What you originally paid for an investment, which is what a future gain is measured against. Sell '
      + 'something worth £30,000 that you bought for £20,000 and the £10,000 difference is the gain that may '
      + 'be taxed. It can legitimately be higher than today’s value, which simply means the holding is '
      + 'showing a loss.',
    seeAlso: ['gia'],
  },
  {
    id: 'drawdown',
    term: 'Drawdown',
    definition:
      'Leaving a pension invested and taking money out of it as you need it, rather than exchanging it for a '
      + 'guaranteed income. Most of what you take is taxed as income in the year you take it. This model '
      + 'assumes drawdown throughout; it does not model buying an annuity.',
    seeAlso: ['sipp', 'mpaa'],
  },
  {
    id: 'sequence-risk',
    term: 'Sequence risk (the order returns arrive in)',
    definition:
      'Two futures with the same average return can end very differently depending on when the bad years '
      + 'fall. A crash in the first years of retirement does lasting damage, because you sell more units to '
      + 'cover the same spending and there is less left to recover. The same crash twenty years later matters '
      + 'far less. Averages hide this; simulating thousands of orderings does not.',
    seeAlso: ['monte-carlo', 'withdrawal-rate'],
  },
  {
    id: 'equities',
    term: 'Equities (shares)',
    definition:
      'Part-ownership of companies, usually held through a fund that spreads the money across many of them. '
      + 'Over long periods equities have tended to grow more than cash or bonds, and they also fall further '
      + 'and more often. In this model they are one of three asset types each account can hold.',
    seeAlso: ['volatility', 'correlation'],
  },
  {
    id: 'volatility',
    term: 'Volatility',
    definition:
      'How much a return bounces around its average from year to year, written as a percentage. An average '
      + 'of 7% with a volatility of 16% means most years land somewhere between roughly −9% and +23%, and '
      + 'some land outside that. Volatility is what makes the range of outcomes wide; it is not itself a '
      + 'prediction that anything will fall.',
    seeAlso: ['equities', 'percentile'],
  },
  {
    id: 'correlation',
    term: 'Correlation',
    definition:
      'Whether two things tend to move together. 1 means they rise and fall in lockstep, 0 means knowing one '
      + 'tells you nothing about the other, −1 means they move opposite ways. It matters because holdings '
      + 'that fall together offer less protection than their separate volatilities suggest.',
    seeAlso: ['volatility', 'equities'],
  },
  {
    id: 'state-pension',
    term: 'State pension',
    definition:
      'The government pension paid from state pension age, based on your National Insurance record rather '
      + 'than on anything you have invested. This model treats the amount and the age as figures you supply, '
      + 'and pays it as taxable income from that age onwards.',
    seeAlso: ['drawdown'],
  },
  {
    id: 'accessible-wealth',
    term: 'Net worth versus wealth you can actually reach',
    definition:
      'Net worth is everything you own less what you owe, pension and house included. Reachable wealth is '
      + 'only the part that can pay a bill now: cash, ISA and ordinary investments. A pension you cannot '
      + 'touch for fifteen years counts fully towards the first and not at all towards the second, which is '
      + 'why a large net worth can still leave a plan short during the bridge period.',
    seeAlso: ['bridge-period', 'emergency-fund'],
  },
  {
    id: 'standard-error',
    term: 'Standard error (how precise a sampled number is)',
    definition:
      'A success probability measured from 10,000 random futures is itself an estimate, and running it again '
      + 'with different randomness would move it slightly. The standard error says by how much — typically a '
      + 'few tenths of a percentage point at this sample size. A gap smaller than that is noise, so this app '
      + 'does not present one as a difference.',
    seeAlso: ['success-probability', 'monte-carlo'],
  },
  {
    id: 'emergency-fund',
    term: 'Emergency fund (cash reserve)',
    definition:
      'Cash held back so an unexpected bill does not force you to sell investments at a bad moment, usually '
      + 'counted in months of essential spending. In this model it is a target the plan funds and a coverage '
      + 'check it reports each year; it is not a wall the simulation refuses to spend through if the '
      + 'alternative is going unfunded.',
    seeAlso: ['accessible-wealth'],
  },
];

const BY_ID = new Map(GLOSSARY.map(entry => [entry.id, entry] as const));

export const glossaryEntry = (id: string): GlossaryEntry | undefined => BY_ID.get(id);

/** The entries for a list of ids, in glossary order, skipping ids with no entry. */
export function glossaryEntries(ids: Iterable<string>): GlossaryEntry[] {
  const wanted = new Set(ids);
  return GLOSSARY.filter(entry => wanted.has(entry.id));
}

/**
 * Terms each screen's *results* rely on, as opposed to its inputs.
 *
 * The form's terms come from the field registry; these are the words that appear in the numbers and
 * the prose a screen prints once a run has finished. The shell renders them beside the active tab,
 * so no screen has to carry its own glossary wiring.
 */
export const SCREEN_TERMS: Record<TabId, readonly string[]> = {
  overview: ['todays-money', 'accessible-wealth', 'withdrawal-rate', 'fire', 'emergency-fund'],
  fire: ['success-probability', 'monte-carlo', 'standard-error', 'percentile', 'bridge-period', 'sequence-risk', 'drawdown'],
  curve: ['fire', 'success-probability', 'bridge-period'],
  marginal: ['isa', 'gia', 'sipp', 'annual-allowance', 'mpaa', 'taper', 'salary-sacrifice'],
  solver: ['success-probability', 'fire', 'standard-error'],
  scenarios: ['success-probability', 'todays-money', 'percentile'],
  property: ['todays-money', 'accessible-wealth', 'cost-basis'],
  attribution: ['sequence-risk', 'success-probability', 'inflation-index', 'state-pension', 'equities', 'volatility', 'correlation'],
};

/**
 * Every id a *surface* points at: the screens above, plus whatever the caller passes from the field
 * registry. Cross-references between glossary entries are deliberately not counted — a definition
 * that only other definitions point at is one nobody reaches from the app.
 */
export function referencedTermIds(fromRegistry: Iterable<string> = []): Set<string> {
  const ids = new Set<string>(fromRegistry);
  for (const terms of Object.values(SCREEN_TERMS)) for (const id of terms) ids.add(id);
  return ids;
}

/** Every id used in a `seeAlso`. These must resolve too, even though they cannot justify an entry. */
export function seeAlsoTermIds(): Set<string> {
  const ids = new Set<string>();
  for (const entry of GLOSSARY) for (const id of entry.seeAlso ?? []) ids.add(id);
  return ids;
}

/** Referenced ids with no glossary entry. Empty is the only acceptable answer. */
export function danglingTermIds(referenced: Iterable<string>): string[] {
  return [...new Set(referenced)].filter(id => !BY_ID.has(id)).sort();
}

/** Glossary entries nothing points at. Also empty: an unreferenced definition is never read. */
export function unreferencedTermIds(referenced: Iterable<string>): string[] {
  const seen = new Set(referenced);
  return GLOSSARY.filter(entry => !seen.has(entry.id)).map(entry => entry.id);
}
