/**
 * The starter situation picker (UX-9), with the way out of it (UX-11).
 *
 * The only component that renders a starter card, so the illustration caveat cannot be omitted on
 * one surface and present on another: the caveat arrives on the card, from
 * `view/starter-picker.ts`, and this file renders it without deciding anything about it.
 *
 * UX-11 added the half that was missing. Choosing a situation used to end in twelve read-only facts
 * and no indication of where any of them could be changed, which is a dead end for the reader whose
 * life differs from the card in one respect. Now:
 *
 * - every fact on the situation currently in use is a button that opens the form at the input
 *   behind it — but only on that card, because a fact on a card you have not chosen describes a
 *   profile you are not holding, and sending you to a box with a different number in it would be a
 *   lie;
 * - a fact whose input this profile has no equivalent for stays plain text rather than becoming a
 *   link that goes nowhere (`firstFieldTarget` returns null and the button is not rendered);
 * - a short, labelled set of jumps names the four departures a reader most often makes next.
 *
 * It still calculates nothing and runs nothing. Choosing a situation replaces the working profile
 * and the provenance baseline; a jump moves the reader to an input. No simulation starts on either.
 */
import type { ReactNode } from 'react';
import type { Profile } from '../../domain/contracts.js';
import { firstFieldTarget } from '../view/field-navigation.js';
import {
  STARTER_CHOICE_EFFECT, STARTER_FACT_LINK_NOTE, STARTER_NEXT_JUMPS, STARTER_NEXT_PROMPT,
  jumpDescription, starterCards, type StarterFact,
} from '../view/starter-picker.js';
import { Card } from './components.js';

/**
 * One fact. A link when the reader is using this situation and the profile really has that input;
 * otherwise the same `<dd>` it has always been.
 */
function Fact(props: {
  fact: StarterFact; profile: Profile; linkable: boolean; onOpenField?: ((fieldId: string) => void) | undefined;
}): ReactNode {
  const target = props.linkable && props.onOpenField
    ? firstFieldTarget(props.profile, props.fact.fieldIds)
    : null;
  return (
    <div>
      <dt>{props.fact.label}</dt>
      <dd>
        {target ? (
          <button
            type="button"
            className="link-button starter-fact-link"
            data-testid={`starter-fact-${target.id}`}
            aria-label={`${props.fact.label}: ${props.fact.value}. Change it under ${target.groupLabel}`}
            onClick={() => props.onOpenField?.(target.id)}
          >
            {props.fact.value}
          </button>
        ) : props.fact.value}
      </dd>
    </div>
  );
}

export function StarterPicker(props: {
  /** The situation currently chosen, so the reader can see what they are measured against. */
  chosenId: string;
  onChoose: (id: string) => void;
  /** Extra sentence for a surface that does more than choose (the scenario screen also saves). */
  effectNote?: string;
  /**
   * The profile the reader is holding. Fact links are resolved against it rather than against the
   * card, because it is the form a jump actually lands on.
   */
  profile: Profile;
  /** Open the profile form at one registry input. Absent on a surface that cannot navigate. */
  onOpenField?: ((fieldId: string) => void) | undefined;
}): ReactNode {
  const cards = starterCards();
  return (
    <Card kicker="People like me" title="Start from a situation that looks like yours" elevation="sm">
      <p className="card-body">{props.effectNote ?? STARTER_CHOICE_EFFECT}</p>
      {props.onOpenField ? <p className="card-body">{STARTER_FACT_LINK_NOTE}</p> : null}
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
                  <Fact key={fact.label} fact={fact} profile={props.profile} linkable={chosen}
                    onOpenField={props.onOpenField} />
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
      {props.onOpenField ? (
        <div className="starter-next" data-testid="starter-next">
          <p className="card-body">{STARTER_NEXT_PROMPT}</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {STARTER_NEXT_JUMPS.map(jump => {
              const target = firstFieldTarget(props.profile, jump.fieldIds);
              if (!target) return null;
              return (
                <button
                  key={jump.id}
                  type="button"
                  className="btn btn-secondary"
                  data-testid={`starter-next-${jump.id}`}
                  aria-label={jumpDescription(jump.label, jump.fieldIds.length)}
                  onClick={() => props.onOpenField?.(target.id)}
                >
                  Change {jump.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
