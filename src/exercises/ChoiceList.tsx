import type { ReactNode } from 'react';

import { Button } from '../ui/Button/Button';
import './exercise.css';

export interface ChoiceItem {
  /** Plain-text name (accessible name of the button). */
  label: string;
  /** Optional richer content, e.g. a character with its reading. */
  content?: ReactNode;
}

export interface ChoiceListProps {
  items: ChoiceItem[];
  wrong: ReadonlySet<number>;
  hidden: ReadonlySet<number>;
  /** Index of the right answer once found, else `null`. */
  solved: number | null;
  layout?: 'grid' | 'stack';
  onPick: (index: number) => void;
}

export function ChoiceList({
  items,
  wrong,
  hidden,
  solved,
  layout = 'stack',
  onPick,
}: ChoiceListProps) {
  return (
    <div className="ex-choices" data-layout={layout} role="group" aria-label="Choices">
      {items.map((item, i) =>
        hidden.has(i) ? null : (
          <button
            key={i}
            type="button"
            className="ex-choice"
            aria-label={item.label}
            data-state={solved === i ? 'right' : wrong.has(i) ? 'wrong' : undefined}
            disabled={wrong.has(i) || solved !== null}
            onClick={() => onPick(i)}
          >
            {item.content ?? item.label}
          </button>
        ),
      )}
    </div>
  );
}

export interface ExerciseFooterProps {
  solved: boolean;
  firstTry: boolean;
  canHint: boolean;
  onHint: () => void;
  onContinue: () => void;
}

/** Hint while solving; feedback and Continue once solved. */
export function ExerciseFooter({
  solved,
  firstTry,
  canHint,
  onHint,
  onContinue,
}: ExerciseFooterProps) {
  return (
    <div className="ex-footer">
      <p className="ex-status" role="status">
        {solved ? (firstTry ? '對 Correct' : '對了 Got it') : ''}
      </p>
      <div className="ex-actions">
        {solved ? (
          <Button variant="primary" size="lg" block caption="CONTINUE" onClick={onContinue}>
            繼續
          </Button>
        ) : (
          <Button caption="Hint" disabled={!canHint} onClick={onHint}>
            提示
          </Button>
        )}
      </div>
    </div>
  );
}
