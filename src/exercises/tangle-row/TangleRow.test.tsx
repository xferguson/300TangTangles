import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS, type ExerciseResult, type TangleRowExercise } from '../../core';
import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { parsePoem } from '../../core/poem';
import { TangleRow } from './TangleRow';

const poem = parsePoem(fixturePoemData);
// 床前明月光 / 疑是地上霜 / 舉頭望明月 / 低頭思故鄉
const bank = [...poem.lines.flatMap((l) => l.chars.map((c) => c.trad)), '雪'];

function setup(over: Partial<TangleRowExercise> = {}) {
  const onComplete = vi.fn<(r: ExerciseResult) => void>();
  const exercise: TangleRowExercise = {
    id: 'ex1',
    poemId: poem.id,
    kind: 'tangle-row',
    line: 1,
    bank,
    answer: [...'疑是地上霜'],
    maxAttempts: 6,
    solvedLines: [],
    ...over,
  };
  const user = userEvent.setup();
  render(
    <TangleRow
      exercise={exercise}
      poem={poem}
      settings={DEFAULT_SETTINGS}
      onComplete={onComplete}
    />,
  );
  return { user, onComplete };
}

async function guess(user: ReturnType<typeof userEvent.setup>, text: string) {
  for (const ch of text) {
    const tiles = screen
      .getAllByRole('button')
      .filter((b) => b.closest('[data-testid="bank"]') && b.textContent?.startsWith(ch));
    const free = tiles.find((b) => !(b as HTMLButtonElement).disabled);
    await user.click(free!);
  }
  await user.click(screen.getByRole('button', { name: /submit/i }));
}

describe('TangleRow board', () => {
  it('shows one row per poem line and fills in solved lines', () => {
    setup({ solvedLines: [0] });
    const rows = screen.getAllByTestId('board-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('床前明月光');
  });

  it('keeps Submit disabled until the row is full, and Backspace removes a char', async () => {
    const { user } = setup();
    const submit = screen.getByRole('button', { name: /submit/i });
    expect(submit).toBeDisabled();
    await user.click(
      within(screen.getByTestId('bank')).getAllByRole('button', { name: /^疑/ })[0]!,
    );
    await user.click(screen.getByRole('button', { name: /delete|backspace/i }));
    expect(within(screen.getAllByTestId('board-row')[1]!).queryByText('疑')).toBeNull();
  });
});

describe('TangleRow feedback', () => {
  it('renders each guessed tile with its state and a glyph, not colour alone', async () => {
    const { user } = setup();
    // 疑 correct, 是 correct, 地 correct, 上 correct, 光 belongs to another line
    await guess(user, '疑是地上光');
    const row = screen.getAllByTestId('history-row')[0]!;
    const tiles = within(row).getAllByTestId('tile');
    expect(tiles.map((t) => t.getAttribute('data-state'))).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'other-line',
    ]);
    expect(tiles.map((t) => t.querySelector('.tr-glyph')?.textContent)).toEqual([
      '〇',
      '〇',
      '〇',
      '〇',
      '◇',
    ]);
  });

  it('uses △ for in-line and ✕ for absent', async () => {
    const { user } = setup();
    await guess(user, '是疑地雪霜');
    const tiles = within(screen.getAllByTestId('history-row')[0]!).getAllByTestId('tile');
    expect(tiles.map((t) => t.querySelector('.tr-glyph')?.textContent)).toEqual([
      '△',
      '△',
      '〇',
      '✕',
      '〇',
    ]);
  });

  it('colours bank tiles by the strongest revealed state', async () => {
    const { user } = setup();
    await guess(user, '是疑地雪霜');
    const state = (ch: string) =>
      within(screen.getByTestId('bank'))
        .getAllByRole('button')
        .find((b) => b.textContent?.startsWith(ch))
        ?.getAttribute('data-state');
    expect(state('地')).toBe('correct');
    expect(state('是')).toBe('in-line');
    expect(state('雪')).toBe('absent');
    expect(state('床')).toBe('untried');
  });

  it('describes the state in each tile label for screen readers', async () => {
    const { user } = setup();
    await guess(user, '是疑地雪霜');
    const tiles = within(screen.getAllByTestId('history-row')[0]!).getAllByTestId('tile');
    expect(tiles[0]).toHaveAccessibleName(/是.*wrong spot/i);
    expect(tiles[3]).toHaveAccessibleName(/雪.*not in the poem/i);
  });
});

describe('TangleRow completion', () => {
  it('reports a solved line with attempts used and a share grid', async () => {
    const { user, onComplete } = setup();
    await guess(user, '是疑地雪霜');
    await guess(user, '疑是地上霜');
    expect(screen.getByTestId('share-grid').textContent).toBe(
      ['🟨🟨🟩⬛🟩', '🟩🟩🟩🟩🟩'].join('\n'),
    );
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const r = onComplete.mock.calls[0]![0];
    expect(r).toMatchObject({
      exerciseId: 'ex1',
      poemId: poem.id,
      kind: 'tangle-row',
      line: 1,
      correct: true,
      attempts: 2,
      unitsMissed: [],
    });
  });

  it('shows attempts left and, once exhausted, reveals the line and sends it back to review', async () => {
    const { user, onComplete } = setup({ maxAttempts: 2 });
    expect(screen.getByText(/2 of 2 guesses left/i)).toBeInTheDocument();
    await guess(user, '床前明月光');
    expect(screen.getByText(/1 of 2 guesses left/i)).toBeInTheDocument();
    await guess(user, '舉頭望明月');
    expect(screen.getByText(/review/i)).toBeInTheDocument();
    expect(screen.getByTestId('answer-reveal')).toHaveTextContent('疑是地上霜');
    expect(screen.queryByRole('button', { name: /submit/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    const r = onComplete.mock.calls[0]![0];
    expect(r.correct).toBe(false);
    expect(r.attempts).toBe(2);
    expect(r.unitsMissed).toEqual([...'疑是地上霜']);
  });
});
