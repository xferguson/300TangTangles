import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS, poemSchema } from '../../core';
import type { MeaningCheckExercise, Settings } from '../../core';
import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { MeaningCheck } from './MeaningCheck';

const poem = poemSchema.parse(fixturePoemData);

const lineToTranslation: MeaningCheckExercise = {
  kind: 'meaning-check',
  id: 'mc-1',
  poemId: poem.id,
  line: 2,
  prompt: 'line-to-translation',
  stem: '舉頭望明月',
  choices: ['I bow my head', 'I raise my head and gaze at the bright moon', 'Frost on the ground'],
  answerIndex: 1,
};

function setup(
  exercise: MeaningCheckExercise = lineToTranslation,
  opts: { settings?: Settings; playAudio?: (t: string) => void } = {},
) {
  let t = 0;
  const onComplete = vi.fn();
  render(
    <MeaningCheck
      exercise={exercise}
      poem={poem}
      settings={opts.settings ?? DEFAULT_SETTINGS}
      playAudio={opts.playAudio}
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

describe('MeaningCheck', () => {
  it('line-to-translation: right answer gives a clean result for that line', async () => {
    const { onComplete, tick, user } = setup();
    tick(3200);
    await user.click(screen.getByRole('button', { name: /gaze at the bright moon/ }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      exerciseId: 'mc-1',
      poemId: poem.id,
      kind: 'meaning-check',
      line: 2,
      correct: true,
      attempts: 1,
      durationMs: 3200,
      hintsUsed: 0,
      accuracy: null,
      unitsMissed: [],
    });
  });

  it('wrong answers cost attempts and mark the result incorrect; the wrong choice is disabled', async () => {
    const { onComplete, user } = setup();
    await user.click(screen.getByRole('button', { name: 'I bow my head' }));
    expect(screen.getByRole('button', { name: 'I bow my head' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Frost on the ground' }));
    await user.click(screen.getByRole('button', { name: /gaze at the bright moon/ }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: false,
      attempts: 3,
      unitsMissed: [],
    });
  });

  it('line-to-translation shows the line with readings per settings and can play it', async () => {
    const playAudio = vi.fn();
    const { user } = setup(lineToTranslation, {
      playAudio,
      settings: { ...DEFAULT_SETTINGS, mandarinRomanization: 'pinyin' },
    });
    expect(screen.getByText('jǔ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /play/i }));
    expect(playAudio).toHaveBeenCalledWith('舉頭望明月');
  });

  it('translation-to-line shows the translation and offers lines in the chosen script', async () => {
    const { onComplete, user } = setup(
      {
        ...lineToTranslation,
        prompt: 'translation-to-line',
        stem: 'I raise my head and gaze at the bright moon',
        choices: ['低頭思故鄉', '舉頭望明月'],
        answerIndex: 1,
      },
      { settings: { ...DEFAULT_SETTINGS, script: 'simp' } },
    );
    expect(screen.getByText('I raise my head and gaze at the bright moon')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '举头望明月' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ correct: true, attempts: 1, line: 2 });
  });

  it('feeling: shows the question and choices, and reports a wrong-then-right result', async () => {
    const { onComplete, user } = setup({
      ...lineToTranslation,
      prompt: 'feeling',
      line: 3,
      stem: 'What is the poet feeling?',
      choices: ['Joy at the bright night', 'Homesickness', 'Anger at being far away'],
      answerIndex: 1,
    });
    expect(screen.getByText('What is the poet feeling?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Joy at the bright night' }));
    await user.click(screen.getByRole('button', { name: 'Homesickness' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      line: 3,
      correct: false,
      attempts: 2,
    });
  });

  it('a hint removes one wrong choice and is counted', async () => {
    const { onComplete, user } = setup();
    await user.click(screen.getByRole('button', { name: /hint/i }));
    const names = ['I bow my head', 'Frost on the ground'];
    expect(names.filter((n) => screen.queryByRole('button', { name: n }))).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /gaze at the bright moon/ }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: true,
      attempts: 1,
      hintsUsed: 1,
    });
  });
});
