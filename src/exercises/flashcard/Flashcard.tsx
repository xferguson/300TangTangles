import { RubyChar } from '../../ui/RubyChar/RubyChar';
import { AudioButton } from '../../ui/AudioButton/AudioButton';
import { ChoiceList, ExerciseFooter } from '../ChoiceList';
import type { ChoiceItem } from '../ChoiceList';
import { displayChars, rubyMode, toScript } from '../display';
import { useChoiceRound } from '../useChoiceRound';
import type { Clock } from '../useChoiceRound';
import type { FlashcardExercise } from '../../core';
import type { ExerciseProps } from '../types';
import './flashcard.css';

export type FlashcardProps = ExerciseProps<FlashcardExercise> & {
  /** Millisecond clock for `durationMs`; defaults to `performance.now`. */
  now?: Clock;
};

const LABELS = {
  'char-to-meaning': ['字義 Character → meaning', 'What does this mean?'],
  'audio-to-char': ['聽字 Audio → character', 'Which character did you hear?'],
  'meaning-to-char': ['寫字 Meaning → character', 'Which character means this?'],
} as const;

/** One unit, multiple choice, in one of three directions. Remounts per exercise id. */
export function Flashcard(props: FlashcardProps) {
  return <FlashcardBody key={props.exercise.id} {...props} />;
}

function FlashcardBody({
  exercise,
  poem,
  settings,
  playAudio,
  onComplete,
  now = () => performance.now(),
}: FlashcardProps) {
  const { direction, unit, choices, answerIndex } = exercise;
  const round = useChoiceRound(choices.length, answerIndex, now);
  const [label, prompt] = LABELS[direction];
  const mode = rubyMode(settings);

  const unitChars = displayChars(unit, poem, settings);
  const gloss = poem.units.find((u) => u.id === unit)?.gloss ?? '';

  const items: ChoiceItem[] =
    direction === 'char-to-meaning'
      ? choices.map((c) => ({ label: c }))
      : choices.map((c) => {
          const text = toScript(c, poem, settings);
          return {
            label: text,
            content:
              direction === 'meaning-to-char'
                ? displayChars(c, poem, settings).map((d, i) => (
                    <RubyChar key={i} char={d.char} reading={d.reading} mode={mode} />
                  ))
                : text,
          };
        });

  function finish() {
    const s = round.stats();
    onComplete({
      exerciseId: exercise.id,
      poemId: exercise.poemId,
      kind: 'flashcard',
      line: null,
      correct: s.correct,
      attempts: s.attempts,
      durationMs: s.durationMs,
      hintsUsed: s.hintsUsed,
      accuracy: null,
      unitsMissed: s.correct ? [] : [unit],
    });
  }

  return (
    <section className="ex ex-flashcard" aria-label="Flashcard">
      <p className="ex-label">{label}</p>
      <p className="ex-prompt">{prompt}</p>
      <div className="ex-stage">
        {direction === 'char-to-meaning' &&
          unitChars.map((d, i) => (
            <RubyChar key={i} char={d.char} reading={d.reading} mode={mode} />
          ))}
        {direction === 'audio-to-char' && (
          <AudioButton
            label="Play audio"
            state={playAudio ? 'idle' : 'unavailable'}
            onPlay={() => playAudio?.(unit)}
          />
        )}
        {direction === 'meaning-to-char' && <span className="ex-gloss">{gloss}</span>}
      </div>
      <ChoiceList
        items={items}
        wrong={round.wrong}
        hidden={round.hidden}
        solved={round.solved ? answerIndex : null}
        layout={direction === 'char-to-meaning' ? 'stack' : 'grid'}
        onPick={round.pick}
      />
      <ExerciseFooter
        solved={round.solved}
        firstTry={round.stats().correct}
        canHint={round.canHint}
        onHint={round.hint}
        onContinue={finish}
      />
    </section>
  );
}
