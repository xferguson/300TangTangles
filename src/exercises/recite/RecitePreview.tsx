import { useState } from 'react';

import { DEFAULT_SETTINGS } from '../../core';
import type { ExerciseResult, ReciteExercise } from '../../core';
import { parsePoem } from '../../core/poem';
import jingyesi from '../../../content/poems/jingyesi.json';
import { Recite } from './Recite';

const poem = parsePoem(jingyesi);

const MODES = {
  'line-translation': { scope: 'line', line: 2, prompt: 'translation' },
  'line-previous': { scope: 'line', line: 2, prompt: 'previous-line' },
  poem: { scope: 'poem', line: null, prompt: 'blank' },
} as const;
type Mode = keyof typeof MODES;

/** Preview of the recite exercise (T56); the real flow arrives with the session screen (T55). */
export function RecitePreview() {
  const [mode, setMode] = useState<Mode>('line-translation');
  const [last, setLast] = useState('');
  const exercise: ReciteExercise = {
    kind: 'recite',
    id: `preview-${mode}`,
    poemId: poem.id,
    language: 'cmn',
    ...MODES[mode],
  };
  return (
    <main style={{ padding: '1rem 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.2rem' }}>Recite preview</h1>
      <label>
        Mode{' '}
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode);
            setLast('');
          }}
        >
          {Object.keys(MODES).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <Recite
        exercise={exercise}
        poem={poem}
        settings={DEFAULT_SETTINGS}
        onComplete={(r: ExerciseResult) => setLast(JSON.stringify(r))}
      />
      {last && (
        <pre data-testid="result" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {last}
        </pre>
      )}
    </main>
  );
}
