import { CharTile } from '../../ui/CharTile/CharTile';
import { useState } from 'react';
import { ChoiceList, ExerciseFooter } from '../ChoiceList';
import { displayChars, rubyMode, toScript } from '../display';
import { nextHintTarget, useAttemptTracker } from '../useChoiceRound';
import type { Clock } from '../useChoiceRound';
import type { ClozeExercise } from '../../core';
import type { ExerciseProps } from '../types';
import './cloze.css';

export type ClozeProps = ExerciseProps<ClozeExercise> & {
  /** Millisecond clock for `durationMs`; defaults to `performance.now`. */
  now?: Clock;
};

/** A line with one or two characters blanked out; fill them in order. Remounts per exercise id. */
export function Cloze(props: ClozeProps) {
  return <ClozeBody key={props.exercise.id} {...props} />;
}

function ClozeBody({
  exercise,
  poem,
  settings,
  onComplete,
  now = () => performance.now(),
}: ClozeProps) {
  const { blanks, line } = exercise;
  const tracker = useAttemptTracker(now);
  const [filled, setFilled] = useState(0);
  const [wrong, setWrong] = useState<ReadonlySet<string>>(new Set());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [missed, setMissed] = useState<readonly string[]>([]);

  const mode = rubyMode(settings);
  const poemLine = poem.lines[line];
  const text = poemLine ? poemLine.chars.map((c) => c.trad).join('') : '';
  const shown = displayChars(text, poem, settings, line);
  const blankAt = new Map(blanks.map((b, i) => [b.index, i]));

  const solved = filled >= blanks.length;
  const active = solved ? undefined : blanks[filled];
  const choices = active?.choices ?? [];
  const answerIndex = active ? choices.indexOf(active.answer) : -1;
  // Wrong/hidden choices are tracked per blank by `${blank}:${choice}` so blanks stay independent.
  const key = (c: string) => `${filled}:${c}`;
  const goneIdx = new Set(
    choices.map((c, i) => (wrong.has(key(c)) || hidden.has(key(c)) ? i : -1)).filter((i) => i >= 0),
  );
  const hintTarget = active ? nextHintTarget(choices.length, answerIndex, goneIdx) : null;

  function pick(i: number) {
    if (!active || goneIdx.has(i)) return;
    if (i === answerIndex) {
      if (filled + 1 >= blanks.length) tracker.finish();
      setFilled(filled + 1);
    } else {
      tracker.recordWrong();
      setWrong(new Set([...wrong, key(choices[i]!)]));
      if (!missed.includes(active.answer)) setMissed([...missed, active.answer]);
    }
  }

  function hint() {
    if (hintTarget === null) return;
    tracker.recordHint();
    setHidden(new Set([...hidden, key(choices[hintTarget]!)]));
  }

  function finish() {
    const s = tracker.stats();
    onComplete({
      exerciseId: exercise.id,
      poemId: exercise.poemId,
      kind: 'cloze',
      line,
      correct: s.correct,
      attempts: s.attempts,
      durationMs: s.durationMs,
      hintsUsed: s.hintsUsed,
      accuracy: null,
      unitsMissed: [...missed],
    });
  }

  return (
    <section className="ex ex-cloze" aria-label="Cloze">
      <p className="ex-label">補字 Fill the blank</p>
      <p className="ex-prompt">Which characters complete the line?</p>
      <div className="ex-line">
        {shown.map((d, i) => {
          const b = blankAt.get(i);
          if (b === undefined) {
            return (
              <CharTile key={i} char={d.char} status="known" reading={d.reading} mode={mode} />
            );
          }
          const done = b < filled;
          return (
            <span
              key={i}
              className="ex-slot"
              data-active={b === filled && !solved ? '' : undefined}
            >
              {done ? (
                <CharTile
                  char={d.char}
                  status="learning"
                  level={1}
                  reading={d.reading}
                  mode={mode}
                />
              ) : (
                <CharTile char="" status="new" fade="blank" />
              )}
            </span>
          );
        })}
      </div>
      {poemLine && <p className="ex-gloss">{poemLine.gloss}</p>}
      {active && (
        <ChoiceList
          items={choices.map((c) => ({ label: toScript(c, poem, settings) }))}
          wrong={new Set([...goneIdx].filter((i) => wrong.has(key(choices[i]!))))}
          hidden={new Set([...goneIdx].filter((i) => hidden.has(key(choices[i]!))))}
          solved={null}
          layout="grid"
          onPick={pick}
        />
      )}
      <ExerciseFooter
        solved={solved}
        firstTry={tracker.stats().correct}
        canHint={hintTarget !== null}
        onHint={hint}
        onContinue={finish}
      />
    </section>
  );
}
