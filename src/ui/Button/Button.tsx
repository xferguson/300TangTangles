import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** `primary` is cinnabar and is reserved for the one main action on a screen (Continue, Check). */
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  /** Stretch to the container's width. */
  block?: boolean;
  /** Small Latin caption after the label, e.g. 繼續 CONTINUE. */
  caption?: string;
  /** `submit` only where a form needs it; buttons default to `button`. */
  type?: 'button' | 'submit';
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  caption,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={['tt-button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      data-block={block || undefined}
    >
      <span className="tt-button-label">{children}</span>
      {caption && (
        <>
          {' '}
          <span className="tt-button-caption">{caption}</span>
        </>
      )}
    </button>
  );
}
