import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS, type ExerciseResult, type LineBuilderExercise } from '../../core';
import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { parsePoem } from '../../core/poem';
import type { ExerciseProps } from '../types';
import { LineBuilder } from './LineBuilder';

const poem = parsePoem(fixturePoemData);

/** Line 3 (index 2): 舉頭望明月, "literal line 3" in the fixture. */
function make(over: Partial<LineBuilderExercise> = {}): LineBuilderExercise {
  return {
    id: 'ex-1',
    poemId: poem.id,
    kind: 'line-builder',
    line: 2,
    step: 2,
    bank: ['月', '望', '舉', '明', '頭'],
    answer: ['舉', '頭', '望', '明', '月'],
    showAudio: true,
    showTranslation: true,
    firstChar: null,
    ...over,
  };
}

function setup(
  over: Partial<LineBuilderExercise> = {},
  props: Partial<ExerciseProps<LineBuilderExercise>> = {},
) {
  const onComplete = vi.fn<(r: ExerciseResult) => void>();
  const user = userEvent.setup();
  render(
    <LineBuilder
      exercise={make(over)}
      poem={poem}
      settings={DEFAULT_SETTINGS}
      onComplete={onComplete}
      {...props}
    />,
  );
  const tap = async (...chars: string[]) => {
    for (const c of chars) {
      await user.click(screen.getByRole('button', { name: c }));
    }
  };
  const bank = () => screen.getByRole('group', { name: /bank/i });
  const target = () => screen.getByRole('group', { name: /your line/i });
  return { user, onComplete, tap, bank, target };
}

const check = () => screen.getByRole('button', { name: /check/i });
const undo = () => screen.getByRole('button', { name: /undo/i });
const hint = () => screen.getByRole('button', { name: /hint/i });
const placed = (c: string, pos: number) =>
  screen.getByRole('button', { name: `Remove ${c}, position ${pos}` });
const notPlaced = (c: string, pos: number) =>
  screen.queryByRole('button', { name: `Remove ${c}, position ${pos}` });

describe('LineBuilder step 2: ordered bank', () => {
  it('shows the translation and one tile per bank character', () => {
    setup();
    expect(screen.getByText('literal line 3')).toBeInTheDocument();
    for (const c of ['舉', '頭', '望', '明', '月']) {
      expect(screen.getByRole('button', { name: c })).toBeEnabled();
    }
  });

  it('places tapped tiles in order and disables the used bank tile', async () => {
    const { tap, bank, target } = setup();
    await tap('頭', '舉');
    expect(within(target()).getByRole('button', { name: 'Remove 頭, position 1' })).toBeVisible();
    expect(within(target()).getByRole('button', { name: 'Remove 舉, position 2' })).toBeVisible();
    expect(within(bank()).getByRole('button', { name: '頭' })).toBeDisabled();
    expect(within(bank()).getByRole('button', { name: '舉' })).toBeDisabled();
  });

  it('keeps Check disabled until the line is full', async () => {
    const { tap } = setup();
    expect(check()).toBeDisabled();
    await tap('舉', '頭', '望', '明');
    expect(check()).toBeDisabled();
    await tap('月');
    expect(check()).toBeEnabled();
  });

  it('a right answer reports success, then Continue emits a clean result', async () => {
    const { user, tap, onComplete } = setup();
    await tap('舉', '頭', '望', '明', '月');
    await user.click(check());
    expect(screen.getByRole('status')).toHaveTextContent(/correct/i);
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result).toMatchObject({
      exerciseId: 'ex-1',
      poemId: poem.id,
      kind: 'line-builder',
      line: 2,
      correct: true,
      attempts: 1,
      hintsUsed: 0,
      accuracy: null,
      unitsMissed: [],
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('a wrong answer says so, keeps the tiles, and does not finish', async () => {
    const { user, tap, onComplete } = setup();
    await tap('頭', '舉', '望', '明', '月');
    await user.click(check());
    expect(screen.getByRole('status')).toHaveTextContent(/not quite/i);
    expect(onComplete).not.toHaveBeenCalled();
    expect(placed('頭', 1)).toBeVisible();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('after a wrong try, fixing the line completes as incorrect with the missed units', async () => {
    const { user, tap, onComplete } = setup();
    await tap('頭', '舉', '望', '明', '月');
    await user.click(check());
    for (let i = 0; i < 5; i++) await user.click(undo());
    await tap('舉', '頭', '望', '明', '月');
    await user.click(check());
    await user.click(screen.getByRole('button', { name: /continue/i }));
    const result = onComplete.mock.calls[0]![0];
    expect(result.correct).toBe(false);
    expect(result.attempts).toBe(2);
    expect([...result.unitsMissed].sort()).toEqual(['舉', '頭']);
  });
});

describe('LineBuilder undo and tap-to-remove', () => {
  it('Undo removes the last tile and frees its bank tile', async () => {
    const { user, tap, bank } = setup();
    expect(undo()).toBeDisabled();
    await tap('舉', '頭');
    await user.click(undo());
    expect(notPlaced('頭', 2)).not.toBeInTheDocument();
    expect(within(bank()).getByRole('button', { name: '頭' })).toBeEnabled();
    expect(within(bank()).getByRole('button', { name: '舉' })).toBeDisabled();
  });

  it('tapping a placed tile removes just that tile and closes the gap', async () => {
    const { user, tap, target } = setup();
    await tap('舉', '頭', '望');
    await user.click(placed('頭', 2));
    expect(within(target()).getByRole('button', { name: 'Remove 舉, position 1' })).toBeVisible();
    expect(within(target()).getByRole('button', { name: 'Remove 望, position 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: '頭' })).toBeEnabled();
  });

  it('Backspace undoes from the keyboard', async () => {
    const { user, tap } = setup();
    await tap('舉', '頭');
    await user.keyboard('{Backspace}');
    expect(notPlaced('頭', 2)).not.toBeInTheDocument();
  });

  it('tiles work from the keyboard (focus a tile, press Enter)', async () => {
    const { user } = setup();
    screen.getByRole('button', { name: '舉' }).focus();
    await user.keyboard('{Enter}');
    expect(placed('舉', 1)).toBeVisible();
  });

  it('undoing after a wrong check clears the wrong message', async () => {
    const { user, tap } = setup();
    await tap('頭', '舉', '望', '明', '月');
    await user.click(check());
    await user.click(undo());
    expect(screen.getByRole('status')).not.toHaveTextContent(/not quite/i);
  });
});

describe('LineBuilder hints', () => {
  it('places the next correct character and counts the hints', async () => {
    const { user, tap, onComplete } = setup();
    await user.click(hint());
    expect(placed('舉', 1)).toBeVisible();
    await user.click(hint());
    expect(placed('頭', 2)).toBeVisible();
    await tap('望', '明', '月');
    await user.click(check());
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      hintsUsed: 2,
      correct: false,
      attempts: 1,
    });
  });

  it('replaces a wrong tile with the right one', async () => {
    const { user, tap } = setup();
    await tap('舉', '望');
    await user.click(hint());
    expect(placed('舉', 1)).toBeVisible();
    expect(placed('頭', 2)).toBeVisible();
    expect(screen.getByRole('button', { name: '望' })).toBeEnabled();
  });

  it('is disabled once the line is correctly full', async () => {
    const { user, tap } = setup();
    await tap('舉', '頭', '望', '明', '月');
    await user.click(check());
    expect(hint()).toBeDisabled();
  });
});

describe('LineBuilder step 3: distractors', () => {
  const ex = {
    step: 3 as const,
    bank: ['看', '月', '山', '望', '明', '舉', '名', '頭'],
  };

  it('offers distractor tiles and a wrong pick fails the check', async () => {
    const { user, tap, onComplete } = setup(ex);
    expect(screen.getByRole('button', { name: '看' })).toBeEnabled();
    await tap('舉', '頭', '看', '明', '月');
    await user.click(check());
    expect(screen.getByRole('status')).toHaveTextContent(/not quite/i);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('can still be completed with the right tiles', async () => {
    const { user, tap, onComplete } = setup(ex);
    await tap('舉', '頭', '望', '明', '月');
    await user.click(check());
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0].correct).toBe(true);
  });

  it('hint skips distractors', async () => {
    const { user } = setup(ex);
    await user.click(hint());
    expect(placed('舉', 1)).toBeVisible();
  });

  it('duplicate characters are separate tiles', async () => {
    const { user } = setup({
      line: 0,
      answer: ['床', '前', '明', '月', '光'],
      bank: ['明', '月', '光', '床', '前', '明'],
    });
    const tiles = screen.getAllByRole('button', { name: '明' });
    expect(tiles).toHaveLength(2);
    await user.click(tiles[0]!);
    const free = screen
      .getAllByRole('button', { name: '明' })
      .filter((b) => !b.hasAttribute('disabled'));
    expect(free).toHaveLength(1);
  });
});

describe('LineBuilder audio and translation by step', () => {
  it('step 2 plays the line when the audio button is pressed', async () => {
    const playAudio = vi.fn();
    const { user } = setup({}, { playAudio });
    await user.click(screen.getByRole('button', { name: /play/i }));
    expect(playAudio).toHaveBeenCalledWith('舉頭望明月');
  });

  it('step 4 is translation-only: no audio button even when audio is available', () => {
    setup({ step: 4, showAudio: false, showTranslation: true }, { playAudio: vi.fn() });
    expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument();
    expect(screen.getByText('literal line 3')).toBeInTheDocument();
  });

  it('hides the translation when the exercise says so', () => {
    setup({ showTranslation: false });
    expect(screen.queryByText('literal line 3')).not.toBeInTheDocument();
  });
});

describe('LineBuilder step 5: first-character prompt', () => {
  const ex = { step: 5 as const, showAudio: false, firstChar: '舉' };

  it('starts with the first character in place and locked', async () => {
    const { user, target } = setup(ex);
    const first = within(target()).getByRole('button', { name: /舉.*first/i });
    expect(first).toBeDisabled();
    expect(undo()).toBeDisabled();
    await user.keyboard('{Backspace}');
    expect(within(target()).getByRole('button', { name: /舉.*first/i })).toBeVisible();
  });

  it('needs only the remaining characters, and reports success', async () => {
    const { user, tap, onComplete } = setup(ex);
    await tap('頭', '望', '明');
    expect(check()).toBeDisabled();
    await tap('月');
    await user.click(check());
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ correct: true, attempts: 1 });
  });

  it('hint continues after the locked first character', async () => {
    const { user } = setup(ex);
    await user.click(hint());
    expect(placed('頭', 2)).toBeVisible();
  });
});
