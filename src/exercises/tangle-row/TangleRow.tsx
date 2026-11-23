import { useMemo, useState } from 'react';

import type { TangleRowExercise } from '../../core';
import {
  aggregateBank,
  lineOutcome,
  scoreRow,
  shareGrid,
  type TileFeedback,
  type TileState,
} from '../../tangle';
import { Button } from '../../ui/Button/Button';
import type { ExerciseProps } from '../types';
import './TangleRow.css';

/** Glyph paired with each state so colour is never the only signal. */
const GLYPHS: Record<TileState, string> = {
  correct: '〇',
  'in-line': '△',
  'other-line': '◇',
  absent: '✕',
};

const STATE_LABEL: Record<TileState, string> = {
  correct: 'right spot',
  'in-line': 'wrong spot',
  'other-line': 'in another line',
  absent: 'not in the poem',
};

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八'];

function FeedbackTile({
  tile,
  index,
  display,
}: {
  tile: TileFeedback;
  index: number;
  display: string;
}) {
  return (
    <span
      role="img"
      data-testid="tile"
      className="tr-tile"
      data-state={tile.state}
      style={{ '--i': index } as React.CSSProperties}
      aria-label={`${display} · ${STATE_LABEL[tile.state]}`}
    >
      <span className="tr-face" aria-hidden="true">
        {display}
      </span>
      <span className="tr-glyph" aria-hidden="true">
        {GLYPHS[tile.state]}
      </span>
    </span>
  );
}

/** Wordle-style board for the whole poem: guess one line at a time from a shared bank. */
export function TangleRow({
  exercise,
  poem,
  settings,
  onComplete,
}: ExerciseProps<TangleRowExercise>) {
  const { line, bank, answer, maxAttempts, solvedLines } = exercise;
  const [guesses, setGuesses] = useState<TileFeedback[][]>([]);
  /** Indices into `bank` of the tiles placed in the current row. */
  const [entry, setEntry] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const startedAt = useState(() => Date.now())[0];

  const display = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of poem.lines) {
      for (const c of l.chars) map.set(c.trad, settings.script === 'simp' ? c.simp : c.trad);
    }
    return (ch: string) => map.get(ch) ?? ch;
  }, [poem, settings.script]);

  const outcome = lineOutcome(guesses, maxAttempts);
  const finished = outcome.status !== 'in-progress';
  const bankState = useMemo(() => aggregateBank(guesses), [guesses]);
  const width = answer.length;
  const used = new Set(entry);

  const place = (i: number) => {
    if (finished || entry.length >= width || used.has(i)) return;
    setEntry([...entry, i]);
  };
  const remove = () => setEntry((e) => e.slice(0, -1));
  const submit = () => {
    if (finished || entry.length !== width) return;
    setGuesses([
      ...guesses,
      scoreRow(
        poem,
        line,
        entry.map((i) => bank[i]!),
      ),
    ]);
    setEntry([]);
  };

  const solved = outcome.status === 'solved';
  const grid = shareGrid(guesses);
  const shareText = `300 Tang Tangles · ${poem.title.trad} · line ${line + 1} · ${
    solved ? guesses.length : 'X'
  }/${maxAttempts}\n${grid}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard unavailable: the text stays selectable on screen
    }
  };

  const finish = () =>
    onComplete({
      exerciseId: exercise.id,
      poemId: exercise.poemId,
      kind: 'tangle-row',
      line,
      correct: solved,
      attempts: Math.max(1, guesses.length),
      durationMs: Date.now() - startedAt,
      hintsUsed: 0,
      accuracy: null,
      unitsMissed: solved ? [] : [...answer],
    });

  return (
    <section
      className="tr"
      aria-label={`Tangle, line ${line + 1}`}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' && !finished) remove();
      }}
    >
      <div className="tr-board" role="group" aria-label="Poem board">
        {poem.lines.map((l, i) => {
          const done = solvedLines.includes(i) || (i === line && solved);
          const active = i === line && !done;
          return (
            <div
              key={i}
              className="tr-row"
              data-testid="board-row"
              data-active={active || undefined}
            >
              <span className="tr-label" aria-hidden="true">
                {NUMERALS[i] ?? i + 1}
              </span>
              {l.chars.map((c, k) => {
                const ch = done ? c.trad : active && entry[k] !== undefined ? bank[entry[k]!] : '';
                return (
                  <span
                    key={k}
                    className="tr-tile tr-tile--board"
                    data-testid="board-tile"
                    data-state={done ? 'correct' : ch ? 'entered' : 'empty'}
                    data-cursor={(active && entry.length === k) || undefined}
                  >
                    {ch ? display(ch) : ''}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="tr-status" role="status" aria-live="polite">
        {outcome.status === 'in-progress' &&
          `${outcome.attemptsLeft} of ${maxAttempts} guesses left`}
        {solved && `Line ${line + 1} solved in ${guesses.length}.`}
        {outcome.status === 'review' && 'Out of guesses. This line goes back to review.'}
      </p>

      {outcome.status === 'review' && (
        <p className="tr-answer" data-testid="answer-reveal">
          {answer.map(display).join('')}
        </p>
      )}

      {guesses.length > 0 && (
        <div className="tr-history" aria-label="Your guesses">
          {guesses.map((row, r) => (
            <div
              key={r}
              className="tr-hrow"
              data-testid="history-row"
              data-reveal={r === guesses.length - 1 || undefined}
            >
              {row.map((t, k) => (
                <FeedbackTile key={k} tile={t} index={k} display={display(t.char)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {!finished && (
        <div className="tr-actions">
          <Button onClick={remove} disabled={entry.length === 0} aria-label="Delete">
            ⌫
          </Button>
          <Button variant="primary" onClick={submit} disabled={entry.length !== width}>
            Submit
          </Button>
        </div>
      )}

      <div className="tr-bank" data-testid="bank" role="group" aria-label="Character bank">
        {bank.map((ch, i) => {
          const st = bankState.get(ch);
          return (
            <button
              key={i}
              type="button"
              className="tr-tile tr-bank-tile"
              data-state={st ?? 'untried'}
              disabled={finished || used.has(i)}
              aria-label={st ? `${display(ch)} · ${STATE_LABEL[st]}` : display(ch)}
              onClick={() => place(i)}
            >
              <span className="tr-face" aria-hidden="true">
                {display(ch)}
              </span>
              {st && (
                <span className="tr-glyph" aria-hidden="true">
                  {GLYPHS[st]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {finished && (
        <div className="tr-share">
          <pre data-testid="share-grid" aria-label="Share grid">
            {grid}
          </pre>
          <div className="tr-actions">
            <Button onClick={copy}>{copied ? 'Copied' : 'Copy result'}</Button>
            <Button variant="primary" onClick={finish}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
