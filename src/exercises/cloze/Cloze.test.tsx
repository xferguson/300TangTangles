import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS, poemSchema } from '../../core';
import type { ClozeExercise, Settings } from '../../core';
import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { Cloze } from './Cloze';

const poem = poemSchema.parse(fixturePoemData);

// Line 2 is 舉頭望明月
const base: ClozeExercise = {
  kind: 'cloze',
  id: 'cz-1',
  poemId: poem.id,
  line: 2,
  blanks: [
    { index: 2, answer: '望', choices: ['望', '看', '想', '見'] },
    { index: 4, answer: '月', choices: ['月', '日', '星', '明'] },
  ],
};

function setup(exercise: ClozeExercise = base, settings: Settings = DEFAULT_SETTINGS) {
  let t = 100;
  const onComplete = vi.fn();
  render(
    <Cloze
      exercise={exercise}
      poem={poem}
      settings={settings}
      onComplete={onComplete}
      now={() => t}
    />,
  );
  return {
    onComplete,
    tick: (to: number) => {
      t = to;
    },
    user: userEvent.setup(),
  };
}

describe('Cloze', () => {
  it('shows the line with blanks and the gloss, offering choices for the first blank only', () => {
    setup();
    expect(screen.getAllByLabelText(/^blank/i)).toHaveLength(2);
    expect(screen.getByText('舉')).toBeInTheDocument();
    expect(screen.getByText(poem.lines[2]!.gloss)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '看' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '星' })).toBeNull();
  });

  it('fills both blanks correctly and reports a clean result after Continue', async () => {
    const { onComplete, tick, user } = setup();
    await user.click(screen.getByRole('button', { name: '望' }));
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    tick(4100);
    await user.click(screen.getByRole('button', { name: '月' }));
    tick(8000);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      exerciseId: 'cz-1',
      poemId: poem.id,
      kind: 'cloze',
      line: 2,
      correct: true,
      attempts: 1,
      durationMs: 4000,
      hintsUsed: 0,
      accuracy: null,
      unitsMissed: [],
    });
  });

  it('wrong picks cost attempts, are disabled, and list the missed answers', async () => {
    const { onComplete, user } = setup();
    await user.click(screen.getByRole('button', { name: '看' }));
    expect(screen.getByRole('button', { name: '看' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '想' }));
    await user.click(screen.getByRole('button', { name: '望' }));
    await user.click(screen.getByRole('button', { name: '月' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: false,
      attempts: 3,
      unitsMissed: ['望'],
    });
  });

  it('a hint removes one wrong choice from the active blank and is counted', async () => {
    const { onComplete, user } = setup();
    await user.click(screen.getByRole('button', { name: /hint/i }));
    expect(
      ['看', '想', '見'].filter((c) => screen.queryByRole('button', { name: c })),
    ).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '望' }));
    await user.click(screen.getByRole('button', { name: '月' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: true,
      attempts: 1,
      hintsUsed: 1,
    });
  });

  it('shows the line in Simplified with readings per settings', () => {
    setup(base, { ...DEFAULT_SETTINGS, script: 'simp', mandarinRomanization: 'pinyin' });
    expect(screen.getByText('举')).toBeInTheDocument();
    expect(screen.getByText('头')).toBeInTheDocument();
    expect(screen.getByText('jǔ')).toBeInTheDocument();
  });

  it('works with a single blank', async () => {
    const { onComplete, user } = setup({ ...base, blanks: [base.blanks[1]!] });
    await user.click(screen.getByRole('button', { name: '月' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ correct: true, attempts: 1 });
  });
});
