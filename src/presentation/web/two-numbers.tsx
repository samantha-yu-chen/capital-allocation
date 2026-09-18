/**
 * UX-7: the one component every surface showing the reference FIRE number renders.
 *
 * All wording comes from `view/two-numbers.ts`; nothing here is a second copy of the explanation.
 * Two variants, one story: `full` where both numbers are on screen and the reader needs the
 * arbitration spelled out, `note` where the reference figure appears beside the probability that
 * already dominates the screen and only needs the caveat under it.
 *
 * The `data-two-numbers` attribute is the stable handle the browser harnesses select on.
 */
import type { ReactNode } from 'react';
import type { TwoNumbersStory } from '../view/two-numbers.js';
import { GlossaryTerms } from './glossary-ui.js';

export function TwoNumbers(props: { story: TwoNumbersStory; variant?: 'full' | 'note' }): ReactNode {
  const { story } = props;
  if ((props.variant ?? 'full') === 'note') {
    return <p className="footnote" data-two-numbers="note">{story.caveat}</p>;
  }
  return (
    <div className="two-numbers" data-two-numbers="full">
      <p className="two-numbers-question">{story.question}</p>
      <dl className="two-numbers-parts">
        <dt>{story.landmark.title}</dt>
        <dd>{story.landmark.sentence}</dd>
        <dt>{story.verdict.title}</dt>
        <dd>{story.verdict.sentence}</dd>
      </dl>
      <GlossaryTerms ids={story.glossary} />
    </div>
  );
}
