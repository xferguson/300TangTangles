import { RubyChar } from '../RubyChar/RubyChar';
import type { Romanization } from '../RubyChar/zhuyin';
import './CharTile.css';

/** Lexicon status as shown on a tile. Mirrors the lexicon's unit status (T02/T30). */
export type CharTileStatus = 'new' | 'learning' | 'known' | 'ignored';
export type LearningLevel = 1 | 2 | 3 | 4;
/** How much support the fading scroll still gives this char: full → bare (no reading) → mist → blank. */
export type CharFade = 'full' | 'bare' | 'mist' | 'blank';

export interface CharTileProps {
  char: string;
  status: CharTileStatus;
  /** Only used when status is `learning`; defaults to 1. */
  level?: LearningLevel;
  reading?: string;
  mode?: Romanization;
  fade?: CharFade;
  selected?: boolean;
  /** Makes the tile a toggle button (e.g. to open the char popover). */
  onSelect?: () => void;
  className?: string;
}

const PIPS = [1, 2, 3, 4] as const;

function statusLabel(status: CharTileStatus, level: LearningLevel) {
  return status === 'learning' ? `learning ${level}` : status;
}

/** A character highlighted by its lexicon status, with optional reading and fade level. */
export function CharTile({
  char,
  status,
  level = 1,
  reading,
  mode = 'off',
  fade = 'full',
  selected = false,
  onSelect,
  className,
}: CharTileProps) {
  const blank = fade === 'blank';
  const label = blank ? 'blank' : `${char} · ${statusLabel(status, level)}`;
  const showLevel = status === 'learning';

  const content = blank ? (
    <span className="ct-cell" />
  ) : (
    <RubyChar
      char={char}
      reading={fade === 'full' ? reading : undefined}
      mode={fade === 'full' ? mode : 'off'}
    />
  );

  const shared = {
    className: ['char-tile', className].filter(Boolean).join(' '),
    'data-status': status,
    'data-level': showLevel ? String(level) : undefined,
    'data-fade': fade,
    'data-selected': selected || undefined,
    'aria-label': label,
  };

  const inner = (
    <>
      <span className="ct-face" aria-hidden="true">
        {content}
      </span>
      {showLevel && !blank && (
        <span className="ct-pips" aria-hidden="true">
          {PIPS.map((n) => (
            <span key={n} className="ct-pip" data-on={n <= level || undefined} />
          ))}
        </span>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" {...shared} aria-pressed={selected} onClick={onSelect}>
        {inner}
      </button>
    );
  }
  return (
    <span role="img" {...shared}>
      {inner}
    </span>
  );
}
