import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS, poemSchema } from '../../core';
import type { ReciteExercise } from '../../core';
import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { MockSpeechInput } from '../../speech';
import type { SpeechInput, SpeechResult } from '../../speech';
import { Recite } from './Recite';

const poem = poemSchema.parse(fixturePoemData);

const lineEx: ReciteExercise = {
  kind: 'recite',
  id: 'rc-1',
  poemId: poem.id,
  scope: 'line',
  line: 2,
  prompt: 'translation',
  language: 'cmn',
};
const poemEx: ReciteExercise = {
  ...lineEx,
  id: 'rc-poem',
  scope: 'poem',
  line: null,
  prompt: 'blank',
};

const said = (transcript: string): SpeechResult => ({
  kind: 'transcript',
  transcript,
  alternatives: [transcript],
});

function setup(exercise: ReciteExercise, speech?: SpeechInput) {
  let t = 0;
  const onComplete = vi.fn();
  render(
    <Recite
      exercise={exercise}
      poem={poem}
      settings={DEFAULT_SETTINGS}
      speech={speech}
      onComplete={onComplete}
      now={() => t}
    />,
  );
  return {
    onComplete,
    user: userEvent.setup(),
    tick: (to: number) => {
      t = to;
    },
  };
}

const speak = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /speak/i }));

describe('Recite: line, recognition', () => {
  it('shows the translation as the prompt', () => {
    setup(lineEx, new MockSpeechInput('recognition'));
    expect(screen.getByLabelText('Prompt')).toHaveTextContent('poetic line 3');
  });

  it('shows the previous line as the prompt for 上句接下句', () => {
    setup({ ...lineEx, prompt: 'previous-line' }, new MockSpeechInput('recognition'));
    expect(screen.getByLabelText('Prompt')).toHaveTextContent('疑是地上霜');
    expect(screen.queryByText('poetic line 3')).not.toBeInTheDocument();
  });

  it('passes on a correct recitation and reports a clean result on Continue', async () => {
    const { onComplete, user, tick } = setup(
      lineEx,
      new MockSpeechInput('recognition', [said('舉頭望明月。')]),
    );
    tick(4000);
    await speak(user);
    expect(await screen.findByRole('status')).toHaveTextContent(/correct/i);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      exerciseId: 'rc-1',
      poemId: poem.id,
      kind: 'recite',
      line: 2,
      correct: true,
      attempts: 1,
      durationMs: 4000,
      hintsUsed: 0,
      accuracy: 1,
      unitsMissed: [],
    });
  });

  it('highlights the mis-said char and reports it as missed', async () => {
    const { onComplete, user } = setup(
      lineEx,
      new MockSpeechInput('recognition', [said('舉頭望明日')]),
    );
    await speak(user);
    const wrong = await screen.findByLabelText('月, mis-said, heard 日');
    expect(wrong).toHaveAttribute('data-status', 'wrong');
    expect(screen.getByLabelText('舉, correct')).toHaveAttribute('data-status', 'correct');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        correct: false,
        attempts: 1,
        accuracy: 0.8,
        unitsMissed: ['月'],
        line: 2,
      }),
    );
  });

  it('marks a missing char and lets the learner try again', async () => {
    const { onComplete, user } = setup(
      lineEx,
      new MockSpeechInput('recognition', [said('舉頭望明'), said('舉頭望明月')]),
    );
    await speak(user);
    expect(await screen.findByLabelText('月, missing')).toHaveAttribute('data-status', 'missing');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await speak(user);
    expect(await screen.findByRole('status')).toHaveTextContent(/correct/i);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, attempts: 2, accuracy: 1 }),
    );
  });

  it('treats silence as a miss, not a crash', async () => {
    const { user } = setup(lineEx, new MockSpeechInput('recognition', [said('')]));
    await speak(user);
    expect(await screen.findByText(/didn.t catch/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });
});

describe('Recite: whole poem', () => {
  it('starts from a blank scroll (no line text) and passes at 90% or better', async () => {
    const { onComplete, user } = setup(
      poemEx,
      new MockSpeechInput('recognition', [said('床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。')]),
    );
    expect(screen.queryByText('床前明月光')).not.toBeInTheDocument();
    await speak(user);
    expect(await screen.findByRole('status')).toHaveTextContent(/correct/i);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'recite', line: null, correct: true, accuracy: 1 }),
    );
  });

  it('fails below 90% and lists the missed units', async () => {
    const { onComplete, user } = setup(
      poemEx,
      new MockSpeechInput('recognition', [said('床前明月光疑是地上霜舉頭望明月低頭')]),
    );
    await speak(user);
    await screen.findByLabelText('思, missing');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    const result = onComplete.mock.calls[0]![0];
    expect(result.correct).toBe(false);
    expect(result.accuracy).toBeCloseTo(18 / 20);
    expect(result.unitsMissed).toEqual(expect.arrayContaining(['思', '故', '鄉']));
  });
});

describe('Recite: self-grade fallback', () => {
  it('records, reveals the line with playback, and takes a self-grade', async () => {
    const { onComplete, user } = setup(
      lineEx,
      new MockSpeechInput('self-grade', [{ kind: 'recording', audioUrl: 'blob:mine' }]),
    );
    expect(screen.queryByText('舉頭望明月')).not.toBeInTheDocument();
    await speak(user);
    expect(await screen.findByLabelText('Your recording')).toHaveAttribute('src', 'blob:mine');
    expect(screen.getByLabelText('Answer')).toHaveTextContent('舉頭望明月');
    await user.click(screen.getByRole('button', { name: /got it/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, accuracy: 1, attempts: 1 }),
    );
  });

  it('records a not-yet self-grade as incorrect', async () => {
    const { onComplete, user } = setup(
      lineEx,
      new MockSpeechInput('self-grade', [{ kind: 'recording', audioUrl: 'blob:mine' }]),
    );
    await speak(user);
    await user.click(await screen.findByRole('button', { name: /not yet/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it('falls back to self-grade when listening fails, and still lets the learner finish', async () => {
    // No scripted result: MockSpeechInput.listen() rejects, like a denied microphone.
    const { onComplete, user } = setup(lineEx, new MockSpeechInput('recognition'));
    await speak(user);
    expect(await screen.findByText(/couldn.t use the microphone/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your recording')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /got it/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });

  it('with no speech adapter and no browser support, still finishes (jsdom has neither)', async () => {
    const { onComplete, user } = setup(lineEx);
    await speak(user);
    await user.click(await screen.findByRole('button', { name: /not yet/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('offers "grade myself" without touching the microphone', async () => {
    const { onComplete, user } = setup(lineEx, new MockSpeechInput('recognition'));
    await user.click(screen.getByRole('button', { name: /grade myself/i }));
    expect(screen.getByLabelText('Answer')).toHaveTextContent('舉頭望明月');
    await user.click(screen.getByRole('button', { name: /got it/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });
});

describe('Recite: meaning check', () => {
  it('asks what the line means after recitation, without gating Continue', async () => {
    const { onComplete, user } = setup(
      { ...lineEx, prompt: 'previous-line' },
      new MockSpeechInput('recognition', [said('舉頭望明月')]),
    );
    expect(screen.queryByRole('group', { name: /meaning/i })).not.toBeInTheDocument();
    await speak(user);
    const group = await screen.findByRole('group', { name: /meaning/i });
    const right = within(group).getByRole('button', { name: 'poetic line 3' });
    await user.click(within(group).getByRole('button', { name: 'poetic line 1' }));
    expect(within(group).getByRole('button', { name: 'poetic line 1' })).toBeDisabled();
    await user.click(right);
    expect(right).toHaveAttribute('data-state', 'right');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });

  it('asks about the poet feeling when the translation was already the prompt', async () => {
    const { user } = setup(lineEx, new MockSpeechInput('recognition', [said('舉頭望明月')]));
    await speak(user);
    const group = await screen.findByRole('group', { name: /meaning/i });
    expect(
      within(group).getByRole('button', { name: 'Loneliness on a still night' }),
    ).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'poetic line 3' })).not.toBeInTheDocument();
  });

  it('is still offered (and optional) after a failed recitation', async () => {
    const { onComplete, user } = setup(
      lineEx,
      new MockSpeechInput('recognition', [said('舉頭望明日')]),
    );
    await speak(user);
    await screen.findByRole('group', { name: /meaning/i });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });
});
