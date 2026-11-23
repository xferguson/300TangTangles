import { useState } from 'react';

import { DEFAULT_SETTINGS, type LineBuilderExercise } from '../core';
import { parsePoem } from '../core/poem';
import { LineBuilder } from '../exercises/line-builder/LineBuilder';
import jingyesi from '../../content/poems/jingyesi.json';

const poem = parsePoem(jingyesi);
const LINE = 2;
const answer = poem.lines[LINE]!.chars.map((c) => c.trad);

/** Fixed, hand-picked look-alikes/meaning-alikes for the preview (the session engine, T34, builds real banks). */
const BANK: Record<2 | 3 | 4 | 5, string[]> = {
  2: ['月', '望', '舉', '明', '頭'],
  3: ['看', '月', '山', '望', '舉', '明', '名', '頭'],
  4: ['看', '月', '山', '望', '舉', '明', '名', '頭'],
  5: ['看', '月', '山', '望', '舉', '明', '名', '頭'],
};

function exerciseFor(step: 2 | 3 | 4 | 5): LineBuilderExercise {
  return {
    id: `preview-${step}`,
    poemId: poem.id,
    kind: 'line-builder',
    line: LINE,
    step,
    bank: BANK[step],
    answer,
    showAudio: step <= 3,
    showTranslation: true,
    firstChar: step === 5 ? answer[0]! : null,
  };
}

/** Preview of the line-builder exercise (T53); the real flow arrives with the session screen (T55). */
export function LineBuilderPreview() {
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);
  const [last, setLast] = useState('');
  return (
    <main style={{ padding: '1rem 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.2rem' }}>Line builder preview</h1>
      <label>
        Scaffold step{' '}
        <select
          value={step}
          onChange={(e) => {
            setStep(Number(e.target.value) as 2 | 3 | 4 | 5);
            setLast('');
          }}
        >
          {[2, 3, 4, 5].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <LineBuilder
        key={step}
        exercise={exerciseFor(step)}
        poem={poem}
        settings={DEFAULT_SETTINGS}
        playAudio={() => undefined}
        onComplete={(r) => setLast(JSON.stringify(r))}
      />
      {last && <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>{last}</pre>}
    </main>
  );
}
