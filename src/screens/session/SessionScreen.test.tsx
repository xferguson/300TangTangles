import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS, parsePoem, type PoemProgress } from '../../core';
import { initialProgress } from '../../engine';
import { markKnown } from '../../lexicon';
import jingyesi from '../../../content/poems/jingyesi.json';
import { SessionScreen } from './SessionScreen';

const poem = parsePoem(jingyesi);
const T0 = '2026-03-01T08:00:00.000Z';
const mastered = {
  recognition: 1,
  production: 1,
  meaning: 1,
  recitation: 1,
  scaffoldStep: 5,
  tangleCleared: true,
} as const;

const allKnown = () =>
  markKnown(
    {},
    poem.units.map((u) => u.id),
    new Date(T0),
  );

/** Everything learned and cleared except the final blank-scroll recitation. */
function almostThere(): PoemProgress {
  return {
    ...initialProgress(poem, T0),
    lines: poem.lines.map(() => ({ ...mastered })),
    seals: ['xiucai', 'juren', 'jinshi', 'tanhua'],
  };
}

function setup(over: { lexicon?: ReturnType<typeof allKnown>; progress?: PoemProgress } = {}) {
  const onPersist = vi.fn();
  render(
    <SessionScreen
      poem={poem}
      settings={DEFAULT_SETTINGS}
      lexicon={over.lexicon ?? {}}
      progress={over.progress ?? initialProgress(poem, T0)}
      onPersist={onPersist}
      now={() => T0}
      seed={3}
    />,
  );
  return { onPersist };
}

describe('SessionScreen', () => {
  it('has an app nav with Home and Settings links', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'App' });
    expect(within(nav).getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '#/settings',
    );
    expect(within(nav).getByRole('link', { name: /home/i })).toHaveAttribute('href', '#/');
  });

  it('shows the poem scroll, the current rank and the first exercise', () => {
    setup();
    expect(screen.getByRole('region', { name: '靜夜思' })).toBeInTheDocument();
    expect(screen.getByText('童生')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Flashcard' })).toBeInTheDocument();
  });

  it('fades mastered characters into blank paper on the scroll', () => {
    setup({ lexicon: allKnown(), progress: almostThere() });
    expect(screen.getAllByLabelText('blank')).toHaveLength(
      poem.lines.reduce((n, l) => n + l.chars.length, 0),
    );
  });

  it('runs the real Recite exercise; a self-graded pass completes the poem', async () => {
    const { onPersist } = setup({ lexicon: allKnown(), progress: almostThere() });
    expect(screen.getByRole('region', { name: 'Recite' })).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).toBeNull();
    // Nothing is persisted until the learner actually recites (or grades themselves).
    await userEvent.click(screen.getByRole('button', { name: /grade myself|自評/i }));
    await userEvent.click(screen.getByRole('button', { name: /got it|對/i }));
    expect(onPersist).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /continue|繼續/i }));
    expect(onPersist).toHaveBeenCalledTimes(1);
    const [, progress] = onPersist.mock.calls[0]!;
    expect(progress.seals).toContain('zhuangyuan');
  });

  it('stamps the rank-up seal, then shows the session summary', async () => {
    setup({ lexicon: allKnown(), progress: almostThere() });
    await userEvent.click(screen.getByRole('button', { name: /grade myself|自評/i }));
    await userEvent.click(screen.getByRole('button', { name: /got it|對/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue|繼續/i }));
    expect(screen.getByRole('region', { name: 'Rank up' })).toBeInTheDocument();
    expect(screen.getAllByText('狀元').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('region', { name: 'Session summary' })).toBeInTheDocument();
    expect(screen.getByText(/1 exercise/)).toBeInTheDocument();
  });

  it('lets the learner end the session early and see the summary', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /end session/i }));
    expect(screen.getByRole('region', { name: 'Session summary' })).toBeInTheDocument();
  });
});
