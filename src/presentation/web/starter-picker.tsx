/**
 * The starter situation picker (UX-9).
 *
 * The only component that renders a starter card, so the illustration caveat cannot be omitted on
 * one surface and present on another: the caveat arrives on the card, from
 * `view/starter-picker.ts`, and this file renders it without deciding anything about it.
 *
 * It calculates nothing and runs nothing. Choosing a situation replaces the working profile and the
 * provenance baseline and stops there; no simulation starts, because a reader browsing starting
 * points has not asked for one.
 */
import type { ReactNode } from 'react';
import { starterCards, STARTER_CHOICE_EFFECT } from '../view/starter-picker.js';
import { Card } from './components.js';

export function StarterPicker(props: {
  /** The situation currently chosen, so the reader can see what they are measured against. */
  chosenId: string;
  onChoose: (id: string) => void;
  /** Extra sentence for a surface that does more than choose (the scenario screen also saves). */
  effectNote?: string;
}): ReactNode {
  const cards = starterCards();
  return (
    <Card kicker="People like me" title="Start from a situation that looks like yours" elevation="sm">
      <p className="card-body">{props.effectNote ?? STARTER_CHOICE_EFFECT}</p>
      <ul className="starter-grid" data-testid="starter-picker">
        {cards.map(card => {
          const chosen = card.id === props.chosenId;
          return (
            <li key={card.id} className={`starter-card${chosen ? ' is-chosen' : ''}`} data-starter={card.id}>
              <h4>{card.name}</h4>
              <p className="starter-who">{card.who}</p>
              <p className="starter-caveat" data-testid="starter-caveat">{card.caveat}</p>
              <dl className="starter-facts">
                {card.facts.map(fact => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary>Why these figures</summary>
                <ul className="starter-reasoning">
                  {card.reasoning.map(line => <li key={line}>{line}</li>)}
                </ul>
              </details>
              <button
                type="button"
                className={chosen ? 'btn btn-secondary' : 'btn btn-primary'}
                aria-pressed={chosen}
                data-testid={`starter-choose-${card.id}`}
                onClick={() => props.onChoose(card.id)}
              >
                {chosen ? 'Chosen — start again from it' : `Use ${card.name}`}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
