import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharTile } from './CharTile';

describe('CharTile lexicon states', () => {
  it.each(['new', 'known', 'ignored'] as const)(
    '%s: marks the status and shows no level pips',
    (status) => {
      const { container } = render(<CharTile char="霜" status={status} />);
      const tile = container.firstElementChild;
      expect(tile).toHaveAttribute('data-status', status);
      expect(tile).not.toHaveAttribute('data-level');
      expect(container.querySelectorAll('.ct-pip')).toHaveLength(0);
    },
  );

  it.each([1, 2, 3, 4] as const)(
    'learning %i: sets the level and fills that many of 4 pips',
    (level) => {
      const { container } = render(<CharTile char="霜" status="learning" level={level} />);
      const tile = container.firstElementChild;
      expect(tile).toHaveAttribute('data-status', 'learning');
      expect(tile).toHaveAttribute('data-level', String(level));
      expect(container.querySelectorAll('.ct-pip')).toHaveLength(4);
      expect(container.querySelectorAll('.ct-pip[data-on]')).toHaveLength(level);
    },
  );

  it('learning without a level defaults to level 1', () => {
    const { container } = render(<CharTile char="霜" status="learning" />);
    expect(container.firstElementChild).toHaveAttribute('data-level', '1');
  });

  it('names the char and its status for screen readers', () => {
    render(<CharTile char="霜" status="learning" level={2} />);
    expect(screen.getByLabelText('霜 · learning 2')).toBeInTheDocument();
    render(<CharTile char="月" status="new" />);
    expect(screen.getByLabelText('月 · new')).toBeInTheDocument();
  });
});

describe('CharTile interaction', () => {
  it('is static (not a button) without onSelect', () => {
    render(<CharTile char="霜" status="known" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is a toggle button with onSelect, reporting selection', async () => {
    const onSelect = vi.fn();
    render(<CharTile char="霜" status="new" selected onSelect={onSelect} />);
    const btn = screen.getByRole('button', { name: '霜 · new' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(btn);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('is not pressed when unselected', () => {
    render(<CharTile char="霜" status="new" onSelect={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CharTile fade (fading scroll)', () => {
  it('full: shows the char with its reading', () => {
    const { container } = render(
      <CharTile char="霜" status="known" reading="ㄕㄨㄤ" mode="zhuyin" fade="full" />,
    );
    expect(container.querySelector('[data-mode="zhuyin"]')).not.toBeNull();
    expect(container.textContent).toContain('ㄕ');
  });

  it('bare: drops the reading but keeps the char', () => {
    const { container } = render(
      <CharTile char="霜" status="known" reading="ㄕㄨㄤ" mode="zhuyin" fade="bare" />,
    );
    expect(container.textContent).toBe('霜');
  });

  it('mist: keeps the char, marked for the mist treatment', () => {
    const { container } = render(<CharTile char="霜" status="known" fade="mist" />);
    expect(container.firstElementChild).toHaveAttribute('data-fade', 'mist');
    expect(container.textContent).toBe('霜');
  });

  it('blank: hides the char from sight and from screen readers', () => {
    const { container } = render(<CharTile char="霜" status="learning" level={2} fade="blank" />);
    expect(container.firstElementChild).toHaveAttribute('data-fade', 'blank');
    expect(container.textContent).not.toContain('霜');
    expect(screen.queryByLabelText(/霜/)).toBeNull();
    expect(screen.getByLabelText('blank')).toBeInTheDocument();
  });
});
