/**
 * A spoken question whose answers are the choices.
 *
 * The Reverse Solver's six modes are one decision, and a `<select>` labelled "Searched input" hides
 * both the question and the alternatives behind a closed box. This renders the same single choice as
 * a real radio group — one tab stop, arrow keys between options, the checked option announced — so
 * the reader sees what they are choosing between before choosing.
 */
import type { ReactNode } from 'react';
import { useId, useRef } from 'react';

export interface QuestionChoice<T extends string> {
  value: T;
  /** Completes the question stem. */
  subject: string;
  /** One plain sentence about what this choice would move. */
  plain: string;
}

export function QuestionPicker<T extends string>(props: {
  stem: string;
  choices: readonly QuestionChoice<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Rendered under the chosen option: the mode's own precise definition. */
  children?: ReactNode;
}): ReactNode {
  const id = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const move = (offset: number) => {
    const index = props.choices.findIndex(choice => choice.value === props.value);
    const next = props.choices[(index + offset + props.choices.length) % props.choices.length]!;
    props.onChange(next.value);
    refs.current.get(next.value)?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move(1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') move(-1);
    else return;
    event.preventDefault();
  };
  return (
    <div className="question-picker">
      {/* The question is the card's heading: it is what the screen is for, and the radio group is
          labelled by it, so the outline and the screen reader hear the same thing. */}
      <h3 className="question-stem" id={`${id}-stem`}>{props.stem}</h3>
      <div className="question-options" role="radiogroup" aria-labelledby={`${id}-stem`} onKeyDown={onKeyDown}>
        {props.choices.map(choice => {
          const selected = choice.value === props.value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              className="question-option"
              data-question={choice.value}
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              ref={element => { if (element) refs.current.set(choice.value, element); else refs.current.delete(choice.value); }}
              onClick={() => props.onChange(choice.value)}
            >
              <strong>{choice.subject}</strong>
              <small>{choice.plain}</small>
            </button>
          );
        })}
      </div>
      {props.children}
    </div>
  );
}
