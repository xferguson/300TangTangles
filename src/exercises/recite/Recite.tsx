import { useEffect, useMemo, useRef, useState } from 'react';

import { readingFor, readingSystemFor } from '../../core';
import type { PoemChar, ReciteExercise } from '../../core';
import { gradeRecitation } from '../../speech/grade';
import type { GradeResult } from '../../speech/grade';
import { createSpeechInput } from '../../speech';
import type { SpeechEnv, SpeechInput } from '../../speech';
import { Button } from '../../ui/Button/Button';
import { RubyChar } from '../../ui/RubyChar/RubyChar';
import { rubyMode, toScript } from '../display';
import type { Clock } from '../useChoiceRound';
import type { ExerciseProps } from '../types';
import { createBrowserRecorder } from './recorder';
import '../exercise.css';
import './recite.css';

/** Whole-poem recitation earns the gold seal at 90% character accuracy (PLAN); lines use the same bar. */
export const PASS_ACCURACY = 0.9;

/** How long to wait for the recognizer after Stop before offering self-grade instead. */
const STOP_GRACE_MS = 4000;

export type ReciteProps = ExerciseProps<ReciteExercise> & {
  /** Speech input; defaults to live recognition when the browser supports it, else record/self-grade. */
  speech?: SpeechInput;
  /** Millisecond clock for `durationMs`; defaults to `performance.now`. */
  now?: Clock;
};

type Phase = 'ready' | 'listening' | 'self-grade' | 'review';

interface Review {
  passed: boolean;
  accuracy: number;
  grade: GradeResult | null;
  /** Nothing was heard, so there is nothing to diff. */
  silent: boolean;
}

export function Recite(props: ReciteProps) {
  return <ReciteBody key={props.exercise.id} {...props} />;
}

function ReciteBody({
  exercise,
  poem,
  settings,
  playAudio,
  onComplete,
  speech,
  now = () => performance.now(),
}: ReciteProps) {
  const { scope, line, prompt } = exercise;
  const startedAt = useRef(now());
  const input = useMemo<SpeechInput | null>(() => {
    if (speech) return speech;
    try {
      return createSpeechInput({
        language: exercise.language,
        script: settings.script,
        env: window as unknown as SpeechEnv,
        recorderFactory: createBrowserRecorder,
      });
    } catch {
      return null;
    }
  }, [speech, exercise.language, settings.script]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [attempts, setAttempts] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const mounted = useRef(true);
  /** Bumped whenever a listen() is finished or abandoned, so late results are ignored. */
  const runRef = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(stopTimer.current);
      void input?.stop().catch(() => {});
    };
  }, [input]);

  const target: PoemChar[] = useMemo(
    () =>
      scope === 'line' && line !== null
        ? (poem.lines[line]?.chars ?? [])
        : poem.lines.flatMap((l) => l.chars),
    [poem, scope, line],
  );
  const mode = rubyMode(settings);
  const system = readingSystemFor(settings);

  const poemLine = line === null ? undefined : poem.lines[line];
  const prevLine = line !== null && line > 0 ? poem.lines[line - 1] : undefined;

  async function begin() {
    setNote('');
    setReview(null);
    setPhase('listening');
    const run = ++runRef.current;
    if (!input) return fallBack("Couldn't use the microphone here.");
    try {
      const result = await input.listen();
      if (!mounted.current || run !== runRef.current) return;
      runRef.current++;
      setAttempts((n) => n + 1);
      if (result.kind === 'recording') {
        setRecordingUrl(result.audioUrl);
        setPhase('self-grade');
        return;
      }
      grade(result.transcript);
    } catch {
      if (mounted.current && run === runRef.current) {
        runRef.current++;
        fallBack("Couldn't use the microphone here, so grade yourself instead.");
      }
    }
  }

  function fallBack(message: string) {
    setAttempts((n) => n + 1);
    setNote(message);
    setRecordingUrl(null);
    setPhase('self-grade');
  }

  function grade(transcript: string) {
    if (!/[\p{L}\p{N}]/u.test(transcript)) {
      setReview({ passed: false, accuracy: 0, grade: null, silent: true });
      setNote("Didn't catch anything. Try again, or grade yourself.");
      setPhase('review');
      return;
    }
    const g = gradeRecitation({
      target,
      transcript,
      system,
      hokkienLayer: settings.hokkienLayer,
    });
    setReview({
      passed: g.accuracy >= PASS_ACCURACY,
      accuracy: g.accuracy,
      grade: g,
      silent: false,
    });
    setPhase('review');
  }

  function selfGrade(passed: boolean) {
    // Self-reported: a pass counts as a perfect recitation, a miss as none.
    setReview({ passed, accuracy: passed ? 1 : 0, grade: null, silent: false });
    setPhase('review');
  }

  async function stop() {
    // Recognizers can hang (no microphone, offline): if nothing comes back, drop to self-grade.
    const run = runRef.current;
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      if (!mounted.current || run !== runRef.current) return;
      runRef.current++;
      fallBack("Didn't hear back from speech recognition, so grade yourself instead.");
    }, STOP_GRACE_MS);
    try {
      await input?.stop();
    } catch {
      /* the pending listen() settles or rejects on its own */
    }
  }

  function manual() {
    runRef.current++; // abandon any pending listen()
    clearTimeout(stopTimer.current);
    void input?.stop().catch(() => {});
    setAttempts((n) => n + 1);
    setNote('');
    setRecordingUrl(null);
    setPhase('self-grade');
  }

  function retry() {
    setReview(null);
    setNote('');
    setRecordingUrl(null);
    setPhase('ready');
  }

  function finish() {
    const unitIds = new Set(poem.units.map((u) => u.id));
    const missed = review?.grade
      ? [...new Set(review.grade.missedIndexes.map((i) => target[i]!.trad))].filter((c) =>
          unitIds.has(c),
        )
      : [];
    onComplete({
      exerciseId: exercise.id,
      poemId: exercise.poemId,
      kind: 'recite',
      line: scope === 'line' ? line : null,
      correct: review?.passed ?? false,
      attempts: Math.max(1, attempts),
      durationMs: Math.max(0, Math.round(now() - startedAt.current)),
      hintsUsed: 0,
      accuracy: review?.accuracy ?? null,
      unitsMissed: missed,
    });
  }

  const shown = (c: PoemChar) => (settings.script === 'simp' ? c.simp : c.trad);
  const renderChar = (c: PoemChar, i: number, status?: string, heard?: string) => {
    const ch = shown(c);
    const label =
      status === 'wrong'
        ? `${ch}, mis-said, heard ${toScript(heard ?? '', poem, settings)}`
        : status === 'missing'
          ? `${ch}, missing`
          : status
            ? `${ch}, ${status}`
            : undefined;
    return (
      <span
        key={i}
        className="rc-char"
        data-status={status}
        aria-label={label}
        role={label ? 'img' : undefined}
      >
        <RubyChar char={ch} reading={readingFor(c.readings, settings)} mode={mode} />
        {status === 'wrong' && (
          <span className="rc-heard" aria-hidden="true">
            {toScript(heard ?? '', poem, settings)}
          </span>
        )}
        {status === 'missing' && (
          <span className="rc-heard" aria-hidden="true">
            –
          </span>
        )}
      </span>
    );
  };

  const promptEl = (() => {
    if (scope === 'poem' || prompt === 'blank') {
      return (
        <p className="ex-recite-prompt" aria-label="Prompt">
          {scope === 'poem'
            ? `Recite the whole poem: ${toScript(poem.title.trad, poem, settings)}`
            : 'Recite this line from memory.'}
        </p>
      );
    }
    if (prompt === 'previous-line' && prevLine) {
      return (
        <p className="ex-recite-prompt" data-kind="previous-line" aria-label="Prompt">
          {prevLine.chars.map(shown).join('')}
          {prevLine.punct}
        </p>
      );
    }
    return (
      <p className="ex-recite-prompt" data-kind="translation" aria-label="Prompt">
        {poemLine?.poetic ?? ''}
      </p>
    );
  })();

  const ranRecognition = input?.mode === 'recognition';
  const failedStatus = review && !review.passed;

  return (
    <section className="ex ex-recite" data-scope={scope} aria-label="Recite">
      <p className="ex-label">{scope === 'poem' ? '背 Recite the poem' : '誦 Recite the line'}</p>
      {promptEl}

      {phase === 'ready' && (
        <>
          <div className="ex-stage ex-recite-scroll">
            {scope === 'poem' ? 'The scroll is blank.' : '…'}
          </div>
          <div className="ex-recite-row">
            <Button variant="primary" size="lg" caption="SPEAK" onClick={() => void begin()}>
              {ranRecognition ? '誦' : '錄'}
            </Button>
            <Button caption="Grade myself" onClick={manual}>
              自評
            </Button>
          </div>
          {prompt === 'previous-line' && playAudio && prevLine && (
            <div className="ex-recite-row">
              <Button
                caption="Hear it"
                onClick={() => playAudio(prevLine.chars.map((c) => c.trad).join(''))}
              >
                聽
              </Button>
            </div>
          )}
        </>
      )}

      {phase === 'listening' && (
        <>
          <div className="ex-stage ex-recite-scroll" role="status">
            Listening…
          </div>
          <div className="ex-recite-row">
            <Button size="lg" caption="Stop" onClick={() => void stop()}>
              停
            </Button>
            <Button caption="Grade myself" onClick={manual}>
              自評
            </Button>
          </div>
        </>
      )}

      {phase === 'self-grade' && (
        <>
          {note && <p className="ex-recite-note">{note}</p>}
          {recordingUrl && (
            <audio
              className="ex-recite-audio"
              controls
              src={recordingUrl}
              aria-label="Your recording"
            />
          )}
          <div className="ex-stage" aria-label="Answer">
            {target.map((c, i) => renderChar(c, i))}
          </div>
          <p className="ex-recite-note">Did you say it right?</p>
          <div className="ex-recite-row">
            <Button variant="primary" caption="Got it" onClick={() => selfGrade(true)}>
              對
            </Button>
            <Button caption="Not yet" onClick={() => selfGrade(false)}>
              未
            </Button>
          </div>
        </>
      )}

      {phase === 'review' && review && (
        <>
          {review.grade ? (
            <div className="ex-stage" aria-label="Result">
              {review.grade.diff.map((d) =>
                renderChar(target[d.index]!, d.index, d.status, d.heard),
              )}
            </div>
          ) : (
            <div className="ex-stage" aria-label="Answer">
              {review.silent ? null : target.map((c, i) => renderChar(c, i))}
            </div>
          )}
          {review.grade && review.grade.extras.length > 0 && (
            <p className="ex-recite-note">
              Extra: {review.grade.extras.map((e) => toScript(e.char, poem, settings)).join(' ')}
            </p>
          )}
          {note && <p className="ex-recite-note">{note}</p>}
          <div className="ex-footer">
            <p className="ex-status" role="status">
              {review.passed
                ? '對 Correct'
                : review.silent
                  ? ''
                  : `${Math.round(review.accuracy * 100)}% – not quite`}
            </p>
          </div>
          <MeaningCheck exercise={exercise} poem={poem} scope={scope} line={line} prompt={prompt} />
          <div className="ex-recite-row">
            {failedStatus && (
              <Button caption="Try again" onClick={retry}>
                再試
              </Button>
            )}
            {failedStatus && review.silent && (
              <Button caption="Grade myself" onClick={manual}>
                自評
              </Button>
            )}
            <Button variant="primary" size="lg" caption="CONTINUE" onClick={finish}>
              繼續
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

interface MeaningProps {
  exercise: ReciteExercise;
  poem: ReciteProps['poem'];
  scope: ReciteExercise['scope'];
  line: number | null;
  prompt: ReciteExercise['prompt'];
}

/**
 * Post-recitation meaning check. Optional: it never gates Continue and never changes `correct`.
 * Asks for the line's translation, or the poet's feeling when the translation was the prompt
 * (and for the whole poem, where it asks about the last line's feeling).
 */
function MeaningCheck({ poem, scope, line, prompt }: MeaningProps) {
  const lineIndex = scope === 'line' && line !== null ? line : poem.lines.length - 1;
  const source = poem.lines[lineIndex];
  const [wrong, setWrong] = useState<ReadonlySet<string>>(new Set());
  const [solved, setSolved] = useState(false);
  if (!source) return null;

  const feeling = scope === 'poem' || prompt === 'translation';
  const right = feeling ? source.meaning.feeling : source.poetic;
  const others = feeling
    ? source.meaning.wrongFeelings
    : poem.lines.filter((_, i) => i !== lineIndex).map((l) => l.poetic);
  const distractors = [...new Set(others)].filter((o) => o !== right).slice(0, 2);
  const choices = [...distractors];
  choices.splice(lineIndex % (distractors.length + 1), 0, right);

  return (
    <div className="ex-recite-meaning" role="group" aria-label="Meaning check">
      <p className="ex-prompt">
        {feeling ? 'What is the poet feeling?' : 'What does this line mean?'}
      </p>
      {choices.map((c) => (
        <button
          key={c}
          type="button"
          className="ex-choice"
          aria-label={c}
          data-state={solved && c === right ? 'right' : wrong.has(c) ? 'wrong' : undefined}
          disabled={solved || wrong.has(c)}
          onClick={() => (c === right ? setSolved(true) : setWrong(new Set([...wrong, c])))}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
