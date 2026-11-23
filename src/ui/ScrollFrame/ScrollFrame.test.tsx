import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScrollFrame } from './ScrollFrame';

describe('ScrollFrame', () => {
  it('wraps its content between two decorative rods', () => {
    const { container } = render(<ScrollFrame>床前明月光</ScrollFrame>);
    expect(screen.getByText('床前明月光')).toBeInTheDocument();
    const rods = container.querySelectorAll('.scroll-rod');
    expect(rods).toHaveLength(2);
    rods.forEach((r) => expect(r).toHaveAttribute('aria-hidden', 'true'));
  });

  it('is a named region when given a label', () => {
    render(<ScrollFrame label="靜夜思">床前明月光</ScrollFrame>);
    expect(screen.getByRole('region', { name: '靜夜思' })).toBeInTheDocument();
  });

  it('defaults to horizontal text', () => {
    const { container } = render(<ScrollFrame>x</ScrollFrame>);
    expect(container.firstElementChild).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('supports vertical right-to-left text', () => {
    const { container } = render(<ScrollFrame orientation="vertical">x</ScrollFrame>);
    expect(container.firstElementChild).toHaveAttribute('data-orientation', 'vertical');
  });

  it('unrolls when asked and reports when done', () => {
    const onUnrolled = vi.fn();
    const { container } = render(
      <ScrollFrame unrolling onUnrolled={onUnrolled}>
        x
      </ScrollFrame>,
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveAttribute('data-unrolling');
    fireEvent.animationEnd(frame);
    expect(onUnrolled).toHaveBeenCalledTimes(1);
  });

  it('is still by default', () => {
    const { container } = render(<ScrollFrame>x</ScrollFrame>);
    expect(container.firstElementChild).not.toHaveAttribute('data-unrolling');
  });
});
