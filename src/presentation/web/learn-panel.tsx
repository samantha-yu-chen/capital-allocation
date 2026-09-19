/**
 * The "How this works" panel (UX-10).
 *
 * The only component that renders a learn section, so an explanation cannot exist on one surface
 * and be missing on another, and no screen can rewrite a paragraph locally. Every string arrives
 * from `view/learn.ts`; this file decides layout and nothing else.
 *
 * It computes nothing, runs nothing and shows no figure. A number here would be a result nobody
 * asked for, and the panel is the one place in the app a reader arrives at *before* they trust a
 * number — putting one on it would be the worst possible place to get that wrong.
 *
 * The eight tabs stay reachable while it is open: the panel occupies the main column, exactly as
 * the wizard does, and the navigation is untouched beside it.
 */
import type { ReactNode } from 'react';
import {
  LEARN_DOC_PATH, MODEL_SECTIONS, learnForTab, tabSections,
  type LearnSection, type LearnTabSection,
} from '../view/learn.js';
import type { TabId } from '../view/tabs.js';
import { GlossaryTerms } from './glossary-ui.js';
import { Card } from './components.js';

function SectionBody(props: { section: LearnSection }): ReactNode {
  const { section } = props;
  return (
    <>
      {section.paragraphs.map(paragraph => <p key={paragraph} className="learn-paragraph">{paragraph}</p>)}
      <GlossaryTerms ids={section.terms} lead="Words used here:" />
      <p className="learn-sources">
        <span className="learn-sources-lead">Where this comes from:</span> {section.sources.join(' · ')}
      </p>
    </>
  );
}

function ScreenSection(props: { section: LearnTabSection; open: boolean }): ReactNode {
  const { section } = props;
  return (
    <details className="learn-screen" id={`learn-${section.id}`} open={props.open}
      data-testid={`learn-screen-${section.tab}`}>
      <summary>
        <b>{section.title}</b>
        <small>{section.question}</small>
      </summary>
      <div className="learn-screen-body"><SectionBody section={section} /></div>
    </details>
  );
}

export function LearnPanel(props: {
  /** The screen the reader was last on, so its own section opens first. */
  tab: TabId;
  onClose: () => void;
}): ReactNode {
  const current = learnForTab(props.tab);
  return (
    <div className="stack" data-testid="learn-panel">
      <Card kicker="How this works" title="What this model does with your numbers" elevation="sm">
        <p className="card-body">
          A plain-language walkthrough of the model: one year at a time, then many lifetimes at once, then what
          the results do and do not mean. Nothing on this page is a result — it explains the method, and every
          section says which files in the project the rule comes from.
        </p>
        <p className="learn-doc-note">
          The same walkthrough is written up at <code>{LEARN_DOC_PATH}</code> for reading away from the app.
        </p>
        <button type="button" className="btn btn-secondary learn-back" data-testid="learn-close" onClick={props.onClose}>
          Back to {current.title}
        </button>
      </Card>

      {MODEL_SECTIONS.map(section => (
        <Card key={section.id} title={section.title} elevation="sm">
          <div id={`learn-${section.id}`} className="learn-section"><SectionBody section={section} /></div>
        </Card>
      ))}

      <Card kicker="Screen by screen" title="What each of the eight screens answers" elevation="sm">
        <p className="card-body">
          Each screen asks one question of the same model. The screen you were on is open first; the rest are
          here so you can read ahead before you spend a run on one.
        </p>
        <div className="learn-screens">
          {tabSections().map(section => (
            <ScreenSection key={section.tab} section={section} open={section.tab === props.tab} />
          ))}
        </div>
      </Card>
    </div>
  );
}
