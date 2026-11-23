import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Seal } from './Seal';

describe('Seal', () => {
  it('shows its characters as an image named for screen readers', () => {
    render(<Seal text="進士" />);
    const seal = screen.getByRole('img', { name: '進士 seal' });
    expect(seal.textContent).toBe('進士');
  });

  it('defaults to an earned cinnabar seal', () => {
    render(<Seal text="進士" />);
    const seal = screen.getByRole('img');
    expect(seal).toHaveAttribute('data-state', 'earned');
    expect(seal).toHaveAttribute('data-tone', 'cinnabar');
  });

  it.each([
    ['locked', '探花 seal, locked'],
    ['overdue', '探花 seal, review overdue'],
  ] as const)('%s: sets the state and says so in its name', (state, name) => {
    render(<Seal text="探花" state={state} />);
    expect(screen.getByRole('img', { name })).toHaveAttribute('data-state', state);
  });

  it('gold tone for the memorized seal', () => {
    render(<Seal text="已背" tone="gold" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-tone', 'gold');
  });

  it('accepts a custom accessible label', () => {
    render(<Seal text="已背" label="Memorized" />);
    expect(screen.getByRole('img', { name: 'Memorized' })).toBeInTheDocument();
  });

  it('lays out 1–2 chars in one column and 3–4 chars as a 2×2 block', () => {
    render(<Seal text="狀元" />);
    render(<Seal text="李白之印" />);
    const [two, four] = screen.getAllByRole('img');
    expect(two).toHaveAttribute('data-layout', 'column');
    expect(four).toHaveAttribute('data-layout', 'block');
  });

  it('sets its size in px', () => {
    render(<Seal text="童生" size={40} />);
    expect(screen.getByRole('img').style.getPropertyValue('--seal-size')).toBe('40px');
  });

  it('stamps when asked and reports when the stamp lands', () => {
    const onStamped = vi.fn();
    render(<Seal text="探花" stamping onStamped={onStamped} />);
    const seal = screen.getByRole('img');
    expect(seal).toHaveAttribute('data-stamping');
    fireEvent.animationEnd(seal);
    expect(onStamped).toHaveBeenCalledTimes(1);
  });

  it('does not stamp by default', () => {
    render(<Seal text="童生" />);
    expect(screen.getByRole('img')).not.toHaveAttribute('data-stamping');
  });
});
