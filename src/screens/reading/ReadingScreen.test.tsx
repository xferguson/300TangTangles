import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { DEFAULT_SETTINGS, parsePoem, type Lexicon, type Settings } from '../../core';
import { setStatus, statusOf } from '../../lexicon';
import jingyesiJson from '../../../content/poems/jingyesi.json';
import { ReadingScreen } from './ReadingScreen';

const poem = parsePoem(jingyesiJson);
const NOW = new Date('2026-01-01T00:00:00Z');

/** Holds the lexicon the way the route does, and exposes the latest value to assertions. */
function Harness({
  initial = {},
  settings = DEFAULT_SETTINGS,
  playAudio,
  onChange,
}: {
  initial?: Lexicon;
  settings?: Settings;
  playAudio?: (text: string, opts?: { slow?: boolean }) => void;
  onChange: (lexicon: Lexicon) => void;
}) {
  const [lexicon, setLexicon] = useState(initial);
  return (
    <ReadingScreen
      poem={poem}
      settings={settings}
      lexicon={lexicon}
      onLexiconChange={(next) => {
        setLexicon(next);
        onChange(next);
      }}
      playAudio={playAudio}
    />
  );
}

function setup(props: Omit<Parameters<typeof Harness>[0], 'onChange'> = {}) {
  const sink = { lexicon: {} as Lexicon };
  const user = userEvent.setup();
  render(
    <Harness
      {...props}
      onChange={(next) => {
        sink.lexicon = next;
      }}
    />,
  );
  return { sink, user };
}

describe('ReadingScreen nav', () => {
  it('has an app nav with Home and Settings links', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'App' });
    expect(within(nav).getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '#/settings',
    );
    expect(within(nav).getByRole('link', { name: /home/i })).toHaveAttribute('href', '#/');
  });
});

describe('ReadingScreen highlights', () => {
  it('colours each character by its lexicon status', () => {
    const lexicon = setStatus({}, '霜', { status: 'learning', level: 3 }, NOW);
    setup({ initial: lexicon });
    const frost = screen.getByRole('button', { name: '霜 · learning 3' });
    expect(frost).toHaveAttribute('data-status', 'learning');
    expect(screen.getAllByRole('button', { name: '床 · new' })).toHaveLength(1);
  });
});

describe('ReadingScreen popover', () => {
  it('shows the reading for the current language and the meaning', async () => {
    const { user } = setup({ settings: { ...DEFAULT_SETTINGS, audioLanguage: 'yue' } });
    await user.click(screen.getByRole('button', { name: '床 · new' }));
    const pop = screen.getByRole('dialog', { name: /床/ });
    expect(within(pop).getByText('cong4')).toBeInTheDocument();
    expect(within(pop).getByText('bed')).toBeInTheDocument();
  });

  it('shows both Hokkien layers for Taiwanese', async () => {
    const { user } = setup({ settings: { ...DEFAULT_SETTINGS, audioLanguage: 'nan' } });
    await user.click(screen.getByRole('button', { name: '床 · new' }));
    const pop = screen.getByRole('dialog', { name: /床/ });
    expect(within(pop).getByText('tshông')).toBeInTheDocument();
    expect(within(pop).getByText('tshn̂g')).toBeInTheDocument();
  });

  it('shows the reading even when readings are hidden on the poem', async () => {
    const { user } = setup({ settings: { ...DEFAULT_SETTINGS, showReadings: false } });
    await user.click(screen.getByRole('button', { name: '床 · new' }));
    expect(within(screen.getByRole('dialog')).getByText('ㄔㄨㄤˊ')).toBeInTheDocument();
  });

  it('sends a status change to the lexicon', async () => {
    const { sink, user } = setup();
    await user.click(screen.getByRole('button', { name: '霜 · new' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Known' }));
    expect(statusOf(sink.lexicon, '霜')).toBe('known');
    expect(screen.getByRole('button', { name: '霜 · known' })).toBeInTheDocument();
  });

  it('sets learning at a chosen level', async () => {
    const { sink, user } = setup();
    await user.click(screen.getByRole('button', { name: '霜 · new' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Learning' }));
    expect(sink.lexicon['霜']).toMatchObject({ status: 'learning', level: 1 });
  });

  it('lets the learner ignore a unit', async () => {
    const { sink, user } = setup();
    await user.click(screen.getByRole('button', { name: '霜 · new' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ignored' }));
    expect(statusOf(sink.lexicon, '霜')).toBe('ignored');
  });

  it('also offers the compounds that contain the character', async () => {
    const { sink, user } = setup();
    await user.click(screen.getAllByRole('button', { name: '月 · new' })[0]!);
    const pop = screen.getByRole('dialog');
    expect(within(pop).getByText('明月')).toBeInTheDocument();
    await user.click(within(pop).getByRole('button', { name: '明月 Known' }));
    expect(statusOf(sink.lexicon, '明月')).toBe('known');
    expect(statusOf(sink.lexicon, '月')).toBe('new');
  });

  it('plays the character through the audio callback', async () => {
    const playAudio = vi.fn();
    const { user } = setup({ playAudio });
    await user.click(screen.getByRole('button', { name: '床 · new' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Play 床/ }));
    expect(playAudio).toHaveBeenCalledWith('床');
  });

  it('closes with the close button', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '床 · new' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ReadingScreen mark rest known', () => {
  it('marks every still-new unit known and leaves ignored ones alone', async () => {
    const lexicon = {
      ...setStatus({}, '霜', { status: 'ignored' }, NOW),
      ...setStatus({}, '月', { status: 'learning', level: 2 }, NOW),
    };
    const { sink, user } = setup({ initial: lexicon });
    await user.click(screen.getByRole('button', { name: /Mark rest known/ }));
    expect(statusOf(sink.lexicon, '床')).toBe('known');
    expect(statusOf(sink.lexicon, '故鄉')).toBe('known');
    expect(statusOf(sink.lexicon, '霜')).toBe('ignored');
    expect(statusOf(sink.lexicon, '月')).toBe('learning');
  });
});

describe('ReadingScreen translation toggles', () => {
  it('is off by default and shows the whole translation', async () => {
    const { user } = setup();
    expect(screen.queryByText(poem.translation.poetic)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Whole' }));
    expect(screen.getByText(poem.translation.poetic)).toBeInTheDocument();
  });

  it('shows a gloss under every line', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Line' }));
    for (const l of poem.lines) expect(screen.getByText(l.gloss)).toBeInTheDocument();
  });

  it('shows word glosses', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Word' }));
    expect(screen.getAllByText('bright moon').length).toBeGreaterThan(0);
    expect(screen.getByText('frost')).toBeInTheDocument();
  });

  it('switches back to off', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Whole' }));
    await user.click(screen.getByRole('button', { name: 'Off' }));
    expect(screen.queryByText(poem.translation.poetic)).not.toBeInTheDocument();
  });
});

describe('ReadingScreen script toggle', () => {
  it('switches between Traditional and Simplified', async () => {
    const { user } = setup();
    expect(screen.getByRole('button', { name: '鄉 · new' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '简' }));
    expect(screen.getByRole('button', { name: '乡 · new' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '鄉 · new' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '繁' }));
    expect(screen.getByRole('button', { name: '鄉 · new' })).toBeInTheDocument();
  });

  it('still keys the lexicon by the Traditional unit when Simplified is shown', async () => {
    const { sink, user } = setup();
    await user.click(screen.getByRole('button', { name: '简' }));
    await user.click(screen.getByRole('button', { name: '乡 · new' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Known' }));
    expect(statusOf(sink.lexicon, '鄉')).toBe('known');
  });
});

describe('ReadingScreen notes drawer', () => {
  it('opens and closes the scholar notes', async () => {
    const { user } = setup();
    expect(screen.queryByText('What is 床?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Scholar/ }));
    expect(screen.getByText('What is 床?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Scholar/ }));
    expect(screen.queryByText('What is 床?')).not.toBeInTheDocument();
  });
});
