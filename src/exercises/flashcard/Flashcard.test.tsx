import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS, poemSchema } from '../../core';
import type { FlashcardExercise, Settings } from '../../core';
import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { Flashcard } from './Flashcard';

const poem = poemSchema.parse(fixturePoemData);

const base: FlashcardExercise = {
  kind: 'flashcard',
  id: 'ex-1',
  poemId: poem.id,
  unit: '月',
  direction: 'char-to-meaning',
  choices: ['moon', 'frost', 'bed', 'head'],
  answerIndex: 0,
};

function setup(
  exercise: FlashcardExercise = base,
  opts: { settings?: Settings; playAudio?: (t: string) => void } = {},
) {
  let t = 1000;
  const onComplete = vi.fn();
  render(
    <Flashcard
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

describe('Flashcard results', () => {
  it('reports a first-try right answer once, after Continue, with the measured duration', async () => {
    const { onComplete, tick, user } = setup();
    tick(2500);
    await user.click(screen.getByRole('button', { name: 'moon' }));
    tick(9000); // time spent reading feedback does not count
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      exerciseId: 'ex-1',
      poemId: poem.id,
      kind: 'flashcard',
      line: null,
      correct: true,
      attempts: 1,
      durationMs: 1500,
      hintsUsed: 0,
      accuracy: null,
      unitsMissed: [],
    });
  });

  it('a wrong answer costs an attempt, is disabled, and lists the unit as missed', async () => {
    const { onComplete, user } = setup();
    await user.click(screen.getByRole('button', { name: 'frost' }));
    expect(screen.getByRole('button', { name: 'frost' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'moon' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: false,
      attempts: 2,
      unitsMissed: ['月'],
    });
  });

  it('a hint removes one wrong choice and is counted, without affecting correctness', async () => {
    const { onComplete, user } = setup();
    await user.click(screen.getByRole('button', { name: /hint/i }));
    const choices = ['moon', 'frost', 'bed', 'head'].map((n) =>
      screen.queryByRole('button', { name: n }),
    );
    expect(choices.filter(Boolean)).toHaveLength(3);
    expect(choices[0]).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'moon' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: true,
      attempts: 1,
      hintsUsed: 1,
    });
  });
});

describe('Flashcard directions', () => {
  it('char-to-meaning shows the character with its reading per settings', () => {
    setup(base, { settings: { ...DEFAULT_SETTINGS, mandarinRomanization: 'pinyin' } });
    expect(screen.getByText('月')).toBeInTheDocument();
    expect(screen.getByText('yuè')).toBeInTheDocument();
  });

  it('char-to-meaning hides the reading when readings are off', () => {
    setup(base, {
      settings: { ...DEFAULT_SETTINGS, mandarinRomanization: 'pinyin', showReadings: false },
    });
    expect(screen.queryByText('yuè')).toBeNull();
  });

  it('shows Simplified when the script setting is simp', () => {
    setup(
      { ...base, unit: '舉', choices: ['to raise', 'head', 'bed', 'moon'] },
      { settings: { ...DEFAULT_SETTINGS, script: 'simp' } },
    );
    expect(screen.getByText('举')).toBeInTheDocument();
    expect(screen.queryByText('舉')).toBeNull();
  });

  it('audio-to-char plays the unit, offers characters, and hides their readings', async () => {
    const playAudio = vi.fn();
    const { onComplete, user } = setup(
      {
        ...base,
        direction: 'audio-to-char',
        choices: ['月', '霜', '床', '頭'],
      },
      { playAudio, settings: { ...DEFAULT_SETTINGS, mandarinRomanization: 'pinyin' } },
    );
    await user.click(screen.getByRole('button', { name: /play/i }));
    expect(playAudio).toHaveBeenCalledWith('月');
    expect(screen.queryByText('yuè')).toBeNull();
    await user.click(screen.getByRole('button', { name: '霜' }));
    await user.click(screen.getByRole('button', { name: '月' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: false,
      attempts: 2,
      unitsMissed: ['月'],
    });
  });

  it('audio-to-char marks audio unavailable when no playAudio is given', () => {
    setup({ ...base, direction: 'audio-to-char', choices: ['月', '霜', '床', '頭'] });
    expect(screen.getByRole('button', { name: /play.*coming soon/i })).toBeDisabled();
  });

  it('meaning-to-char shows the gloss and character choices in the chosen script', async () => {
    const { onComplete, user } = setup(
      { ...base, unit: '舉', direction: 'meaning-to-char', choices: ['舉', '頭', '床', '月'] },
      { settings: { ...DEFAULT_SETTINGS, script: 'simp' } },
    );
    expect(screen.getByText('to raise')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '举' }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      correct: true,
      attempts: 1,
      unitsMissed: [],
    });
  });
});
