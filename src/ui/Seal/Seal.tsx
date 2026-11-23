import { useRef, type CSSProperties } from 'react';
import { useAnimationEnd } from '../useAnimationEnd';
import './Seal.css';

export type SealState = 'earned' | 'locked' | 'overdue';
export type SealTone = 'cinnabar' | 'gold';

export interface SealProps {
  /** 1–4 characters, read top-to-bottom, right-to-left. */
  text: string;
  state?: SealState;
  /** Gold is for the 狀元 "Memorized" seal. */
  tone?: SealTone;
  /** Side length in px. Default 64. */
  size?: number;
  /** Play the stamp animation (rank-up). */
  stamping?: boolean;
  onStamped?: () => void;
  /** Accessible name; defaults to "<text> seal" plus its state. */
  label?: string;
  className?: string;
}

const STATE_SUFFIX: Record<SealState, string> = {
  earned: '',
  locked: ', locked',
  overdue: ', review overdue',
};

/** A 白文 seal: paper-colored characters cut out of cinnabar (or gold), with a hand-cut edge. */
export function Seal({
  text,
  state = 'earned',
  tone = 'cinnabar',
  size = 64,
  stamping = false,
  onStamped,
  label,
  className,
}: SealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const chars = [...text];

  useAnimationEnd(ref, stamping, onStamped);
  const style = { '--seal-size': `${size}px` } as CSSProperties;
  return (
    <span
      ref={ref}
      role="img"
      aria-label={label ?? `${text} seal${STATE_SUFFIX[state]}`}
      className={['seal', className].filter(Boolean).join(' ')}
      data-state={state}
      data-tone={tone}
      data-layout={chars.length > 2 ? 'block' : 'column'}
      data-stamping={stamping || undefined}
      style={style}
    >
      {chars.map((c, i) => (
        <span key={i} className="seal-char" aria-hidden="true">
          {c}
        </span>
      ))}
    </span>
  );
}
