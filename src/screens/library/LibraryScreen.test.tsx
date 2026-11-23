import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '../../core';
import type { Lexicon } from '../../core';
import { parsePoem } from '../../core/poem';
import jingyesi from '../../../content/poems/jingyesi.json';
import { LibraryScreen } from './LibraryScreen';
import type { Catalog } from './library';

const poem = parsePoem(jingyesi);

const mk = (
  id: string,
  trad: string,
  simp: string,
  status: 'available' | 'coming-soon',
  n = 3,
) => ({
  id,
  title: { trad, simp },
  poet: { trad: '李白', simp: '李白' },
  form: 'wujue' as const,
  status,
  charCount: 20,
  familiarity: 0.4,
  inkDrops: n,
});

const catalog: Catalog = {
  tiers: [
    {
      tier: 'wujue',
      poems: [
        mk('jingyesi', '靜夜思', '静夜思', 'available'),
        mk('chunxiao', '春曉', '春晓', 'coming-soon', 1),
      ],
    },
    { tier: 'qijue', poems: [mk('zao', '早發白帝城', '早发白帝城', 'coming-soon', 4)] },
  ],
};

const known = (unit: string): Lexicon[string] => ({
  unit,
  status: 'known',
  level: null,
  fsrs: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('LibraryScreen', () => {
  it('groups poems under tier headings', () => {
    render(
      <LibraryScreen catalog={catalog} poems={[poem]} lexicon={{}} settings={DEFAULT_SETTINGS} />,
    );
    expect(screen.getByRole('heading', { name: /五絕/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /七絕/ })).toBeInTheDocument();
  });

  it('links a playable poem card to the reading screen', () => {
    render(
      <LibraryScreen catalog={catalog} poems={[poem]} lexicon={{}} settings={DEFAULT_SETTINGS} />,
    );
    expect(screen.getByRole('link', { name: /靜夜思/ })).toHaveAttribute('href', '#/read/jingyesi');
  });

  it('offers a Play link to the session for a playable poem only', () => {
    render(
      <LibraryScreen catalog={catalog} poems={[poem]} lexicon={{}} settings={DEFAULT_SETTINGS} />,
    );
    const links = screen.getAllByRole('link', { name: 'Play' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '#/play/jingyesi');
  });

  it('shows the personal known count and a meter', () => {
    const lex: Lexicon = { 月: known('月'), 明: known('明') };
    render(
      <LibraryScreen catalog={catalog} poems={[poem]} lexicon={lex} settings={DEFAULT_SETTINGS} />,
    );
    const link = screen.getByRole('link', { name: /靜夜思/ });
    expect(within(link).getByText('2/17')).toBeInTheDocument();
    expect(within(link).getByRole('meter')).toHaveAttribute('aria-valuenow', '2');
  });

  it('shows ink-drop difficulty accessibly', () => {
    render(
      <LibraryScreen catalog={catalog} poems={[poem]} lexicon={{}} settings={DEFAULT_SETTINGS} />,
    );
    const link = screen.getByRole('link', { name: /靜夜思/ });
    expect(within(link).getByLabelText('difficulty 3 of 5')).toBeInTheDocument();
  });

  it('renders coming-soon cards as non-links', () => {
    render(
      <LibraryScreen catalog={catalog} poems={[poem]} lexicon={{}} settings={DEFAULT_SETTINGS} />,
    );
    expect(screen.queryByRole('link', { name: /春曉/ })).toBeNull();
    const item = screen.getByText('春曉').closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText(/coming soon/i)).toBeInTheDocument();
  });

  it('shows how many poems are open', () => {
    render(
      <LibraryScreen catalog={catalog} poems={[poem]} lexicon={{}} settings={DEFAULT_SETTINGS} />,
    );
    expect(screen.getByText(/1 of 3 open/)).toBeInTheDocument();
  });

  it('uses Simplified titles when the script setting asks for it', () => {
    render(
      <LibraryScreen
        catalog={catalog}
        poems={[poem]}
        lexicon={{}}
        settings={{ ...DEFAULT_SETTINGS, script: 'simp' }}
      />,
    );
    expect(screen.getByRole('link', { name: /静夜思/ })).toBeInTheDocument();
  });
});
