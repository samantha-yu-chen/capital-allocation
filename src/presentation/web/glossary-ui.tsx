import { useLocale } from './locale.js';
import { localizeGlossaryEntry } from '../i18n/glossary.js';
/**
 * Glossary terms, reachable from wherever the word is used.
 *
 * The definition itself is data (`view/glossary.ts`); this file only renders it. A term is a real
 * button, so it is reachable by keyboard and announced as expandable, and the panel is a card from
 * the same design system as everything else — no new dependency, and nothing that only works with a
 * mouse. At narrow widths the panel stops being anchored to the word and spans the viewport with a
 * gutter, because a popover that runs off the side of a phone is not a popover.
 */
import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { GLOSSARY, SCREEN_TERMS, glossaryEntries, glossaryEntry } from '../view/glossary.js';
import type { TabId } from '../view/tabs.js';

/** One term and its definition, shown on demand. Unknown ids render nothing rather than a gap. */
export function GlossaryTerm(props: { id: string }): ReactNode {
  const { locale, text } = useLocale();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(props.id);
  const wrapper = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const rawEntry = glossaryEntry(shown);
  const entry = rawEntry ? localizeGlossaryEntry(locale, rawEntry) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const rawFirst = glossaryEntry(props.id);
  const first = rawFirst ? localizeGlossaryEntry(locale, rawFirst) : undefined;
  if (!first) return null;
  return (
    <span className="glossary-anchor" ref={wrapper}>
      <button
        type="button"
        className="glossary-term"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => { setShown(props.id); setOpen(value => !value); }}
      >
        {first.term}
      </button>
      {open && entry ? (
        <span className="glossary-panel card elev-md" id={panelId} role="note">
          <b className="glossary-panel-title">{entry.term}</b>
          <span className="glossary-panel-body">{entry.definition}</span>
          {entry.seeAlso && entry.seeAlso.length > 0 ? (
            <span className="glossary-see-also">
              {text('See also:')}{' '}
              {glossaryEntries(entry.seeAlso).map((other, index) => (
                <span key={other.id}>
                  {index > 0 ? ', ' : null}
                  <button type="button" className="link-button" onClick={() => setShown(other.id)}>{localizeGlossaryEntry(locale, other).term}</button>
                </span>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** A row of terms. Renders nothing at all when there is nothing to explain. */
export function GlossaryTerms(props: { ids: readonly string[] | undefined; lead?: string }): ReactNode {
  const { text } = useLocale();
  const entries = glossaryEntries(props.ids ?? []);
  if (entries.length === 0) return null;
  return (
    <p className="glossary-row">
      <span className="glossary-lead">{text(props.lead ?? 'What is')}</span>
      {entries.map(entry => <GlossaryTerm key={entry.id} id={entry.id} />)}
    </p>
  );
}

/**
 * The terms the active screen's *results* use, plus the whole glossary behind a disclosure.
 *
 * It sits in the shell rather than inside each screen, so all eight destinations are covered by one
 * piece of wiring and none of them can quietly go without.
 */
export function GlossaryBar(props: { tab: TabId }): ReactNode {
  const { locale, text } = useLocale();
  return (
    <div className="glossary-bar">
      <GlossaryTerms ids={SCREEN_TERMS[props.tab]} lead="Words used on this screen:" />
      <details className="glossary-all">
        <summary>{text(`All ${GLOSSARY.length} terms`)}</summary>
        <dl className="glossary-list">
          {GLOSSARY.map(entry => (
            <div key={entry.id} id={`glossary-${entry.id}`}>
              <dt>{localizeGlossaryEntry(locale, entry).term}</dt>
              <dd>{localizeGlossaryEntry(locale, entry).definition}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
