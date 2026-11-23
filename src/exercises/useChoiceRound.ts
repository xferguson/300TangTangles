import { useState } from 'react';

import type { ExerciseResult } from '../core';

/** Clock in milliseconds; injectable so tests (and replays) control `durationMs`. */
export type Clock = () => number;

export type RoundStats = Pick<ExerciseResult, 'attempts' | 'durationMs' | 'hintsUsed' | 'correct'>;

/**
 * Counts wrong taps, hints and elapsed time for one exercise. Mount it fresh per exercise (the
 * exercise components key their body on `exercise.id`). Duration runs from mount to `finish()`
 * (the final right answer), so time spent reading feedback is not counted.
 *
 * Conventions: `attempts` = 1 + wrong taps; `correct` = no wrong taps (hints are reported
 * separately in `hintsUsed` and do not change `correct`).
 */
export function useAttemptTracker(now: Clock) {
  const [startedAt] = useState(now);
  const [wrongs, setWrongs] = useState(0);
  const [hints, setHints] = useState(0);
  const [endedAt, setEndedAt] = useState<number | null>(null);

  const stats = (): RoundStats => ({
    attempts: wrongs + 1,
    hintsUsed: hints,
    correct: wrongs === 0,
    durationMs: Math.max(0, Math.round((endedAt ?? now()) - startedAt)),
  });

  return {
    stats,
    recordWrong: () => setWrongs((n) => n + 1),
    recordHint: () => setHints((n) => n + 1),
    finish: () => setEndedAt(now()),
  };
}

/** Pick the next wrong choice to hide, or `null` when only two options would be left. */
export function nextHintTarget(
  count: number,
  answerIndex: number,
  gone: ReadonlySet<number>,
): number | null {
  const open = Array.from({ length: count }, (_, i) => i).filter((i) => !gone.has(i));
  if (open.length <= 2) return null;
  return open.find((i) => i !== answerIndex) ?? null;
}

/** State machine for a one-question multiple-choice round (flashcard, meaning check). */
export function useChoiceRound(count: number, answerIndex: number, now: Clock) {
  const tracker = useAttemptTracker(now);
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set());
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const [solved, setSolved] = useState(false);

  const gone = new Set([...wrong, ...hidden]);
  const hintTarget = solved ? null : nextHintTarget(count, answerIndex, gone);

  return {
    wrong,
    hidden,
    solved,
    canHint: hintTarget !== null,
    stats: tracker.stats,
    pick(i: number) {
      if (solved || wrong.has(i) || hidden.has(i)) return;
      if (i === answerIndex) {
        tracker.finish();
        setSolved(true);
      } else {
        tracker.recordWrong();
        setWrong(new Set([...wrong, i]));
      }
    },
    hint() {
      if (hintTarget === null) return;
      tracker.recordHint();
      setHidden(new Set([...hidden, hintTarget]));
    },
  };
}
