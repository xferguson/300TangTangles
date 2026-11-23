import { useState } from 'react';

import {
  RANK_LABELS,
  readingFor,
  readingSystemFor,
  type EngineState,
  type Exercise,
  type ExerciseResult,
  type Lexicon,
  type Poem,
  type PoemProgress,
  type Rank,
  type ReciteExercise,
  type Settings,
} from '../../core';
import { computeRank, fadeLevels } from '../../engine';
import { Cloze } from '../../exercises/cloze/Cloze';
import { Flashcard } from '../../exercises/flashcard/Flashcard';
import { LineBuilder } from '../../exercises/line-builder/LineBuilder';
import { MeaningCheck } from '../../exercises/meaning-check/MeaningCheck';
import { TangleRow } from '../../exercises/tangle-row/TangleRow';
import type { ExerciseProps } from '../../exercises/types';
import { Button, CharTile, ScrollFrame, Seal, type CharFade } from '../../ui';
import {
  completeExercise,
  dismissSeal,
  endFlow,
  isFinished,
  startFlow,
  summarize,
  type Flow,
} from './flow';
import './SessionScreen.css';

export interface SessionScreenProps {
  poem: Poem;
  settings: Settings;
  lexicon: Lexicon;
  progress: PoemProgress;
  /** Called after every completed exercise with the updated lexicon and progress, to save them. */
  onPersist: (lexicon: Lexicon, progress: PoemProgress) => void;
  /** Speak `text` in the audio language; absent when audio is unavailable. */
  playAudio?: (text: string, opts?: { slow?: boolean }) => void;
  /** Clock (ISO string); injectable for tests. */
  now?: () => string;
  /** Seed for shuffling and distractors. */
  seed?: number;
}

/** Fade 0-1 → how much of the character the scroll still shows. */
function fadeLabel(level: number): CharFade {
  if (level < 0.25) return 'full';
  if (level < 0.5) return 'bare';
  if (level < 0.8) return 'mist';
  return 'blank';
}

/** Exercises that test recall of a line must not find it written on the scroll above them. */
function hiddenLines(ex: Exercise | null, lineCount: number): ReadonlySet<number> {
  if (!ex) return new Set();
  switch (ex.kind) {
    case 'cloze':
    case 'line-builder':
    case 'tangle-row':
      return new Set([ex.line]);
    case 'recite':
      return ex.line === null
        ? new Set(Array.from({ length: lineCount }, (_, i) => i))
        : new Set([ex.line]);
    default:
      return new Set();
  }
}

/** The poem scroll that stays on screen all session; characters fade as they are mastered. */
function SessionScroll({
  poem,
  settings,
  engine,
  current,
}: {
  poem: Poem;
  settings: Settings;
  engine: EngineState;
  current: Exercise | null;
}) {
  const fades = fadeLevels(poem, engine.lexicon, engine.progress);
  const hidden = hiddenLines(current, poem.lines.length);
  const mode = settings.showReadings ? readingSystemFor(settings) : 'off';
  return (
    <ScrollFrame label={poem.title.trad} className="ss-scroll">
      <ol className="ss-lines">
        {poem.lines.map((line, li) => (
          <li key={li} className="ss-line">
            {line.chars.map((c, ci) => {
              const entry = engine.lexicon[c.trad];
              const fade = hidden.has(li) ? 'blank' : fadeLabel(fades[li]?.[ci] ?? 0);
              return (
                <CharTile
                  key={ci}
                  char={c[settings.script]}
                  status={entry?.status ?? 'new'}
                  level={entry?.level ?? undefined}
                  reading={readingFor(c.readings, settings)}
                  mode={mode}
                  fade={fade}
                />
              );
            })}
          </li>
        ))}
      </ol>
    </ScrollFrame>
  );
}

/**
 * Stand-in for the Recite exercise until T56 lands (T62 wires the real one). Its Continue reports
 * a perfect recitation so the journey can reach 狀元; it must not ship as the real thing.
 */
function RecitePlaceholder({ exercise, poem, onComplete }: ExerciseProps<ReciteExercise>) {
  const [startedAt] = useState(() => Date.now());
  const what =
    exercise.line === null ? 'the whole poem from a blank scroll' : `line ${exercise.line + 1}`;
  const gloss = exercise.line === null ? null : poem.lines[exercise.line]?.gloss;
  return (
    <section className="ss-card" aria-label="Recite (placeholder)">
      <p className="ss-kicker">背 Recite · placeholder</p>
      <p>
        Speech recitation is not wired in yet. In the finished game you would recite {what} aloud.
      </p>
      {gloss && <p className="ss-gloss">{gloss}</p>}
      <Button
        variant="primary"
        size="lg"
        block
        onClick={() =>
          onComplete({
            exerciseId: exercise.id,
            poemId: exercise.poemId,
            kind: 'recite',
            line: exercise.line,
            correct: true,
            attempts: 1,
            durationMs: Date.now() - startedAt,
            hintsUsed: 0,
            accuracy: 1,
            unitsMissed: [],
          })
        }
      >
        Continue
      </Button>
    </section>
  );
}

function ExerciseView({
  exercise,
  poem,
  settings,
  playAudio,
  onComplete,
}: {
  exercise: Exercise;
  poem: Poem;
  settings: Settings;
  playAudio?: SessionScreenProps['playAudio'];
  onComplete: (r: ExerciseResult) => void;
}) {
  const common = { poem, settings, playAudio, onComplete };
  switch (exercise.kind) {
    case 'flashcard':
      return <Flashcard key={exercise.id} exercise={exercise} {...common} />;
    case 'cloze':
      return <Cloze key={exercise.id} exercise={exercise} {...common} />;
    case 'meaning-check':
      return <MeaningCheck key={exercise.id} exercise={exercise} {...common} />;
    case 'line-builder':
      return <LineBuilder key={exercise.id} exercise={exercise} {...common} />;
    case 'tangle-row':
      return <TangleRow key={exercise.id} exercise={exercise} {...common} />;
    case 'recite':
      return <RecitePlaceholder key={exercise.id} exercise={exercise} {...common} />;
  }
}

function SealMoment({ rank, onContinue }: { rank: Rank; onContinue: () => void }) {
  const label = RANK_LABELS[rank];
  return (
    <section className="ss-card ss-seal-moment" aria-label="Rank up">
      <p className="ss-kicker">Rank up</p>
      <Seal text={label} size={96} tone={rank === 'zhuangyuan' ? 'gold' : 'cinnabar'} stamping />
      <h2 className="ss-rank-name">{label}</h2>
      <Button variant="primary" size="lg" block onClick={onContinue}>
        Continue
      </Button>
    </section>
  );
}

function SummaryView({ flow }: { flow: Flow }) {
  const s = summarize(flow);
  const percent = Math.round(s.accuracy * 100);
  const minutes = Math.max(1, Math.round(s.durationMs / 60000));
  return (
    <section className="ss-card" aria-label="Session summary">
      <p className="ss-kicker">Session summary</p>
      <p className="ss-big">
        {s.exercises} exercise{s.exercises === 1 ? '' : 's'}
      </p>
      <p>
        {percent}% correct · about {minutes} min
      </p>
      <p>
        Rank: {RANK_LABELS[s.rankBefore]}
        {s.rankAfter !== s.rankBefore ? ` → ${RANK_LABELS[s.rankAfter]}` : ' (unchanged)'}
      </p>
      {s.newSeals.length > 0 && (
        <div className="ss-seals" aria-label="Seals earned">
          {s.newSeals.map((r) => (
            <Seal
              key={r}
              text={RANK_LABELS[r]}
              size={56}
              tone={r === 'zhuangyuan' ? 'gold' : 'cinnabar'}
            />
          ))}
        </div>
      )}
      <p>
        Characters: {s.units.known} known · {s.units.learning} learning · {s.units.new} new
      </p>
      <nav className="ss-links" aria-label="Next">
        <a className="ss-link" href="#/library">
          Library
        </a>
        <a className="ss-link" href={`#/read/${encodeURIComponent(flow.engine.poem.id)}`}>
          Read the poem
        </a>
      </nav>
    </section>
  );
}

/** One poem, one Continue: the engine picks each exercise; the scroll fades as you learn. */
export function SessionScreen({
  poem,
  settings,
  lexicon,
  progress,
  onPersist,
  playAudio,
  now = () => new Date().toISOString(),
  seed = 1,
}: SessionScreenProps) {
  const [flow, setFlow] = useState<Flow>(() =>
    startFlow({ poem, lexicon, progress, settings, now: now(), seed, history: [] }),
  );
  const rank = computeRank(poem, flow.engine.lexicon, flow.engine.progress);
  const finished = isFinished(flow);

  function onComplete(result: ExerciseResult) {
    const next = completeExercise(flow, result, now());
    if (next === flow) return;
    setFlow(next);
    onPersist(next.engine.lexicon, next.engine.progress);
  }

  return (
    <main className="session">
      <header className="ss-header">
        <div>
          <h1>{poem.title[settings.script]}</h1>
          <p className="ss-byline">{poem.poet[settings.script]}</p>
        </div>
        <div className="ss-rank" aria-label="Current rank">
          <span className="ss-rank-label">{RANK_LABELS[rank]}</span>
        </div>
      </header>

      <SessionScroll
        poem={poem}
        settings={settings}
        engine={flow.engine}
        current={finished ? null : flow.current}
      />

      {finished ? (
        <SummaryView flow={flow} />
      ) : flow.sealQueue.length > 0 ? (
        <SealMoment rank={flow.sealQueue[0]!} onContinue={() => setFlow(dismissSeal(flow))} />
      ) : flow.current ? (
        <ExerciseView
          exercise={flow.current}
          poem={poem}
          settings={settings}
          playAudio={playAudio}
          onComplete={onComplete}
        />
      ) : null}

      {!finished && (
        <div className="ss-footer">
          <Button variant="ghost" onClick={() => setFlow(endFlow(flow))}>
            End session
          </Button>
        </div>
      )}
    </main>
  );
}
