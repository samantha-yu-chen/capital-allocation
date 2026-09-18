/**
 * UX-7: one story for the two success numbers.
 *
 * Two different-looking verdicts are visible in this app — the reference FIRE number (spec §13/§18:
 * retirement spending ÷ the configured withdrawal rate) and the Monte Carlo success probability.
 * The engine has always been honest about which is authoritative; finding A.1.8 is that a lay reader
 * still sees two answers and no arbitration. This module is the single canonical explanation, as
 * view data, so every surface that shows the reference number says the same thing about it.
 *
 * It computes nothing. The withdrawal rate and the path count are read off the profile that is
 * already on screen, which is why the wording is never a hard-coded "4%" or "10,000".
 */
import type { Profile } from '../../domain/contracts.js';
import { count, percent } from './format.js';

/**
 * The clause that makes the arbitration. It is asserted by the surface audit, so neither variant of
 * the shared component can be reworded into saying the two numbers are equally authoritative.
 */
export const AUTHORITY_CLAUSE = 'the number your target is judged against';

export interface TwoNumbersInput {
  /** `simulation.referenceWithdrawalRate` — a rate (0.04), not a percentage. */
  withdrawalRate: number;
  /** `simulation.count` — the paths the probability is measured over. */
  pathCount: number;
}

export interface TwoNumbersPart {
  title: string;
  sentence: string;
}

export interface TwoNumbersStory {
  question: 'Which of these two numbers says whether my plan works?';
  /** The reference FIRE number: arithmetic, useful, and not a safety result. */
  landmark: TwoNumbersPart;
  /** The success probability: the simulated plan, and the only number the target is judged against. */
  verdict: TwoNumbersPart;
  /** One line short enough to sit under a figure, for surfaces with no room for the full story. */
  caveat: string;
  /**
   * Which number arbitrates. A single literal type rather than a free string: the reference
   * arithmetic must never be relabelled as the safety result.
   */
  authority: 'success-probability';
  /** Glossary entries a reader can open from either sentence. */
  glossary: readonly string[];
}

/**
 * The canonical explanation, with the reader's own withdrawal rate and path count in it.
 *
 * @throws RangeError if the rate is not a positive fraction or the path count is not a positive
 * integer — a story that quoted "0%" or "NaN times" would be worse than no story.
 */
export function twoNumbersStory(input: TwoNumbersInput): TwoNumbersStory {
  const { withdrawalRate, pathCount } = input;
  if (!Number.isFinite(withdrawalRate) || withdrawalRate <= 0 || withdrawalRate >= 1)
    throw new RangeError('A withdrawal rate must be a fraction in (0, 1)');
  if (!Number.isInteger(pathCount) || pathCount <= 0)
    throw new RangeError('A path count must be a positive integer');
  const rate = percent(withdrawalRate, 2);
  const paths = count(pathCount);
  return {
    question: 'Which of these two numbers says whether my plan works?',
    landmark: {
      title: 'The FIRE number is a landmark',
      sentence:
        `The FIRE number is simple arithmetic: your yearly retirement spending ÷ ${rate}, the withdrawal `
        + 'rate you configured. It is a useful landmark for the size of pot you are aiming at, and it is '
        + 'silent about the tax you pay on withdrawals and about bad market years arriving early.',
    },
    verdict: {
      title: 'The success probability is the verdict',
      sentence:
        `The success probability simulates your actual plan ${paths} times, with taxes, inflation and `
        + `market ups and downs. It is ${AUTHORITY_CLAUSE}.`,
    },
    caveat:
      `${rate} arithmetic, so a landmark and not the safety result: the success probability over `
      + `${paths} simulated futures is ${AUTHORITY_CLAUSE}.`,
    authority: 'success-probability',
    glossary: ['withdrawal-rate', 'success-probability'],
  };
}

/** The same story, read off the profile already on screen. */
export const twoNumbersStoryFor = (profile: Profile): TwoNumbersStory => twoNumbersStory({
  withdrawalRate: profile.simulation.referenceWithdrawalRate,
  pathCount: profile.simulation.count,
});

export interface ReferenceFireSurface {
  id: string;
  /** What the reader sees the reference number called on that screen. */
  label: string;
  /** Repository-relative path of the React screen that renders it. */
  file: string;
}

/**
 * Every screen under `src/presentation/web/` that puts the reference FIRE number in front of a
 * reader. The audit test asserts two things against it: that nothing renders the reference number
 * without being listed here, and that every entry renders the shared component. Adding a sixth
 * surface without its caveat therefore fails the suite rather than shipping.
 */
export const REFERENCE_FIRE_SURFACES: readonly ReferenceFireSurface[] = [
  { id: 'overview', label: 'Reference FIRE target', file: 'src/presentation/web/screen-overview.tsx' },
  { id: 'fire', label: 'Reference FIRE number', file: 'src/presentation/web/screen-fire.tsx' },
  { id: 'curve', label: 'Reference FIRE number', file: 'src/presentation/web/screen-curve.tsx' },
  { id: 'wizard', label: 'Reference FIRE number', file: 'src/presentation/web/screen-wizard.tsx' },
  { id: 'scenarios', label: 'Reference FIRE number', file: 'src/presentation/web/screen-scenarios.tsx' },
];
