import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioButton } from './AudioButton';

describe('AudioButton', () => {
  it('idle: a play toggle named by its label, calling onPlay', async () => {
    const onPlay = vi.fn();
    render(<AudioButton label="Play line 1" state="idle" onPlay={onPlay} />);
    const btn = screen.getByRole('button', { name: 'Play line 1' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('data-state', 'idle');
    await userEvent.click(btn);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('playing: pressed, and a click calls onStop instead', async () => {
    const onPlay = vi.fn();
    const onStop = vi.fn();
    render(<AudioButton label="Play line 1" state="playing" onPlay={onPlay} onStop={onStop} />);
    const btn = screen.getByRole('button', { name: 'Play line 1' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(btn);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('loading: busy and ignores clicks', async () => {
    const onPlay = vi.fn();
    render(<AudioButton label="Play" state="loading" onPlay={onPlay} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('unavailable: disabled and says audio is coming soon (e.g. Hokkien)', () => {
    render(<AudioButton label="Play 台語" state="unavailable" onPlay={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Play 台語 (coming soon)' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-state', 'unavailable');
  });

  it('slow: marks the slow-speed variant', () => {
    render(<AudioButton label="Play slowly" state="idle" speed="slow" onPlay={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-speed', 'slow');
  });

  it('defaults to idle at normal speed', () => {
    render(<AudioButton label="Play" onPlay={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-state', 'idle');
    expect(btn).toHaveAttribute('data-speed', 'normal');
  });
});
