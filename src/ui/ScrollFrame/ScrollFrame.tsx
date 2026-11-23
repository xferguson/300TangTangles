import { useRef, type ReactNode } from 'react';
import { useAnimationEnd } from '../useAnimationEnd';
import './ScrollFrame.css';

export interface ScrollFrameProps {
  children: ReactNode;
  /** `vertical` sets text top-to-bottom in right-to-left columns. */
  orientation?: 'horizontal' | 'vertical';
  /** Accessible name; makes the scroll a named region. */
  label?: string;
  /** Play the unroll animation (poem open). */
  unrolling?: boolean;
  onUnrolled?: () => void;
  className?: string;
}

/** The poem scroll: a paper panel between two wooden rods. */
export function ScrollFrame({
  children,
  orientation = 'horizontal',
  label,
  unrolling = false,
  onUnrolled,
  className,
}: ScrollFrameProps) {
  const ref = useRef<HTMLElement>(null);
  useAnimationEnd(ref, unrolling, onUnrolled);
  return (
    <section
      ref={ref}
      aria-label={label}
      className={['scroll-frame', className].filter(Boolean).join(' ')}
      data-orientation={orientation}
      data-unrolling={unrolling || undefined}
    >
      <span className="scroll-rod" aria-hidden="true" />
      <div className="scroll-paper">{children}</div>
      <span className="scroll-rod" aria-hidden="true" />
    </section>
  );
}
