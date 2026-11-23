import { AudioButton } from '../../ui/AudioButton/AudioButton';
import { RubyChar } from '../../ui/RubyChar/RubyChar';
import { ChoiceList, ExerciseFooter } from '../ChoiceList';
import { displayChars, rubyMode, toScript } from '../display';
import { useChoiceRound } from '../useChoiceRound';
import type { Clock } from '../useChoiceRound';
import type { MeaningCheckExercise } from '../../core';
import type { ExerciseProps } from '../types';
import './meaning-check.css';

export type MeaningCheckProps = ExerciseProps<MeaningCheckExercise> & {
  /** Millisecond clock for `durationMs`; defaults to `performance.now`. */
  now?: Clock;
};

const LABELS = {
  'line-to-translation': ['意 Line → meaning', 'What does this line mean?'],
  'translation-to-line': ['句 Meaning → line', 'Which line says this?'],
  feeling: ['情 Feeling', 'What is the poet feeling?'],
} as const;

/** Pick the translation for a line, the line for a translation, or the poet's feeling. */
export function MeaningCheck(props: MeaningCheckProps) {
  return <MeaningCheckBody key={props.exercise.id} {...props} />;
}

function MeaningCheckBody({
  exercise,
  poem,
  settings,
  playAudio,
  onComplete,
  now = () => performance.now(),
}: MeaningCheckProps) {
  const { prompt, stem, choices, answerIndex, line } = exercise;
  const round = useChoiceRound(choices.length, answerIndex, now);
  const mode = rubyMode(settings);
  const [label, question] = LABELS[prompt];
  const poemLine = poem.lines[line];
  const lineText = poemLine ? poemLine.chars.map((c) => c.trad).join('') : stem;

  const showLine = prompt === 'line-to-translation' || prompt === 'feeling';
  const items = choices.map((c) => ({
    label: prompt === 'translation-to-line' ? toScript(c, poem, settings) : c,
  }));

  function finish() {
    const s = round.stats();
    onComplete({
      exerciseId: exercise.id,
      poemId: exercise.poemId,
      kind: 'meaning-check',
      line,
      correct: s.correct,
      attempts: s.attempts,
      durationMs: s.durationMs,
      hintsUsed: s.hintsUsed,
      accuracy: null,
      unitsMissed: [],
    });
  }

  return (
    <section className="ex ex-meaning" data-prompt={prompt} aria-label="Meaning check">
      <p className="ex-label">{label}</p>
      <p className="ex-prompt">{prompt === 'feeling' ? stem : question}</p>
      {showLine && (
        <div className="ex-stage">
          {displayChars(prompt === 'feeling' ? lineText : stem, poem, settings, line).map(
            (d, i) => (
              <RubyChar key={i} char={d.char} reading={d.reading} mode={mode} />
            ),
          )}
          <AudioButton
            label="Play line"
            state={playAudio ? 'idle' : 'unavailable'}
            onPlay={() => playAudio?.(prompt === 'feeling' ? lineText : stem)}
          />
        </div>
      )}
      {prompt === 'translation-to-line' && <p className="ex-quote">{stem}</p>}
      <ChoiceList
        items={items}
        wrong={round.wrong}
        hidden={round.hidden}
        solved={round.solved ? answerIndex : null}
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
