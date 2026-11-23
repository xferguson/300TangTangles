import { useCallback, useEffect, useState } from 'react';

import type { LineBuilderExercise } from '../../core';
import { AudioButton } from '../../ui/AudioButton/AudioButton';
import { Button } from '../../ui/Button/Button';
import type { ExerciseProps } from '../types';
import './LineBuilder.css';

/** Index of the first bank tile showing `char` that is not already in `used`. */
function freeTile(bank: readonly string[], char: string, used: readonly number[]): number {
  return bank.findIndex((c, i) => c === char && !used.includes(i));
}

type Feedback = 'none' | 'wrong' | 'right';

/**
 * Scaffold steps 2-5 of the line builder: tap tiles from the bank to build the line.
 * The step's look (audio, translation, distractors, first-character prompt) comes entirely from
 * the exercise data. `correct` in the result means: right on the first check with no hints.
 */
export function LineBuilder({
  exercise,
  poem,
  playAudio,
  onComplete,
}: ExerciseProps<LineBuilderExercise>) {
  const { bank, answer, firstChar } = exercise;

  // Step 5 starts with the first character already placed and locked.
  const [placed, setPlaced] = useState<number[]>(() => {
    if (!firstChar) return [];
    const i = freeTile(bank, firstChar, []);
    return i >= 0 ? [i] : [];
  });
  const locked = firstChar && placed.length > 0 ? 1 : 0;
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>('none');
  const [startedAt] = useState(() => Date.now());

  const done = feedback === 'right';
  const full = placed.length === answer.length;
  const isCorrect = full && placed.every((b, i) => bank[b] === answer[i]);
  const translation = poem.lines[exercise.line]?.literal;

  const edit = useCallback((next: number[]) => {
    setPlaced(next);
    setFeedback('none');
  }, []);

  const undo = useCallback(() => {
    if (done || placed.length <= locked) return;
    edit(placed.slice(0, -1));
  }, [done, placed, locked, edit]);

  // Backspace undoes from anywhere on the page, like a keyboard's delete.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') undo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo]);

  function addTile(bankIndex: number) {
    if (done || full) return;
    edit([...placed, bankIndex]);
  }

  function removeAt(pos: number) {
    if (done || pos < locked) return;
    edit(placed.filter((_, i) => i !== pos));
  }

  function hint() {
    // First position that is empty or wrong; everything from there on is cleared.
    let at = placed.findIndex((b, i) => bank[b] !== answer[i]);
    if (at < 0) at = placed.length;
    if (at >= answer.length) return;
    const kept = placed.slice(0, at);
    const tile = freeTile(bank, answer[at]!, kept);
    if (tile < 0) return;
    setHintsUsed((n) => n + 1);
    edit([...kept, tile]);
  }

  function check() {
    setAttempts((n) => n + 1);
    if (isCorrect) {
      setFeedback('right');
      return;
    }
    const unitIds = new Set(poem.units.map((u) => u.id));
    const wrong = answer.filter((c, i) => bank[placed[i]!] !== c && unitIds.has(c));
    setMissed((m) => [...new Set([...m, ...wrong])]);
    setFeedback('wrong');
  }

  function finish() {
    onComplete({
      exerciseId: exercise.id,
      poemId: exercise.poemId,
      kind: 'line-builder',
      line: exercise.line,
      correct: attempts === 1 && hintsUsed === 0,
      attempts,
      durationMs: Math.max(0, Date.now() - startedAt),
      hintsUsed,
      accuracy: null,
      unitsMissed: missed,
    });
  }

  const statusText =
    feedback === 'right'
      ? 'Correct!'
      : feedback === 'wrong'
        ? 'Not quite. Remove a tile or ask for a hint.'
        : '';

  return (
    <section className="lb" aria-label={`Build line ${exercise.line + 1}`}>
      <p className="lb-label">句 Line builder · step {exercise.step} of 5</p>

      {exercise.showAudio && (
        <AudioButton
          label="Play line"
          state={playAudio ? 'idle' : 'unavailable'}
          onPlay={() => playAudio?.(answer.join(''))}
        />
      )}
      {exercise.showTranslation && translation && <p className="lb-translation">{translation}</p>}

      <div className="lb-target" role="group" aria-label="Your line" data-feedback={feedback}>
        {answer.map((_, pos) => {
          const bankIndex = placed[pos];
          if (bankIndex === undefined) {
            return <span key={pos} className="lb-slot" data-empty aria-hidden="true" />;
          }
          const char = bank[bankIndex]!;
          const isLocked = pos < locked;
          return (
            <button
              key={pos}
              type="button"
              className="lb-slot"
              data-locked={isLocked || undefined}
              aria-label={
                isLocked ? `${char}, first character` : `Remove ${char}, position ${pos + 1}`
              }
              disabled={isLocked || done}
              onClick={() => removeAt(pos)}
            >
              {char}
            </button>
          );
        })}
      </div>

      <p className="lb-status" role="status" data-feedback={feedback}>
        {statusText}
      </p>

      <div className="lb-bank" role="group" aria-label="Character bank">
        {bank.map((char, i) => (
          <button
            key={i}
            type="button"
            className="lb-tile"
            disabled={placed.includes(i) || done}
            onClick={() => addTile(i)}
          >
            {char}
          </button>
        ))}
      </div>

      <div className="lb-actions">
        <Button onClick={undo} disabled={done || placed.length <= locked}>
          Undo
        </Button>
        <Button onClick={hint} disabled={done || isCorrect} caption="首字">
          Hint
        </Button>
        {done ? (
          <Button variant="primary" onClick={finish} caption="Continue">
            繼續
          </Button>
        ) : (
          <Button variant="primary" onClick={check} disabled={!full} caption="Check">
            檢查
          </Button>
        )}
      </div>
    </section>
  );
}
