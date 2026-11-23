import './AudioButton.css';

export type AudioButtonState = 'idle' | 'loading' | 'playing' | 'unavailable';

export interface AudioButtonProps {
  /** Accessible name, e.g. "Play line 1". */
  label: string;
  state?: AudioButtonState;
  speed?: 'normal' | 'slow';
  onPlay: () => void;
  onStop?: () => void;
  className?: string;
}

/**
 * Play/stop toggle. A shell only: the caller owns playback (T58) and passes the state in.
 * `unavailable` covers languages without audio yet, such as Hokkien.
 */
export function AudioButton({
  label,
  state = 'idle',
  speed = 'normal',
  onPlay,
  onStop,
  className,
}: AudioButtonProps) {
  const unavailable = state === 'unavailable';
  const loading = state === 'loading';
  const playing = state === 'playing';

  function handleClick() {
    if (loading || unavailable) return;
    if (playing) onStop?.();
    else onPlay();
  }

  return (
    <button
      type="button"
      className={['audio-button', className].filter(Boolean).join(' ')}
      aria-label={unavailable ? `${label} (coming soon)` : label}
      aria-pressed={playing}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={unavailable}
      title={unavailable ? 'Audio coming soon' : undefined}
      data-state={state}
      data-speed={speed}
      onClick={handleClick}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="audio-icon">
        {playing ? (
          <rect x="4" y="4" width="8" height="8" rx="1" />
        ) : loading ? (
          <circle cx="8" cy="8" r="5" className="audio-spinner" />
        ) : (
          <path d="M5 3.5v9l7.5-4.5z" />
        )}
      </svg>
      {speed === 'slow' && (
        <span className="audio-slow" aria-hidden="true">
          慢
        </span>
      )}
    </button>
  );
}
