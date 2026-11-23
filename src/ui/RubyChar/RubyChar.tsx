import './RubyChar.css';

/** Which reading to show. Mandarin defaults to zhuyin; the reading always matches the audio language. */
export type Romanization = 'zhuyin' | 'pinyin' | 'jyutping' | 'tailo' | 'off';

export type ZhuyinTone = 'ˊ' | 'ˇ' | 'ˋ' | '˙';

const TONE_MARKS: readonly string[] = ['ˊ', 'ˇ', 'ˋ', '˙'];

export interface ParsedZhuyin {
  symbols: string[];
  tone: ZhuyinTone | null;
}

/** Split a zhuyin syllable such as `ㄔㄨㄤˊ` into its symbols and tone mark (none for 1st tone). */
export function parseZhuyin(reading: string): ParsedZhuyin {
  const chars = [...reading.trim()];
  let tone: ZhuyinTone | null = null;
  const symbols: string[] = [];
  for (const c of chars) {
    if (TONE_MARKS.includes(c)) tone = c as ZhuyinTone;
    else symbols.push(c);
  }
  return { symbols, tone };
}

export interface RubyCharProps {
  char: string;
  /** The reading for `mode` (e.g. `ㄔㄨㄤˊ` for zhuyin, `chuáng` for pinyin). Omit to show the bare char. */
  reading?: string;
  mode: Romanization;
  className?: string;
}

/**
 * One character with its reading. Zhuyin stacks in a column to the right (Taiwan textbook style);
 * other romanizations sit above in a native <ruby>. Browsers lack `ruby-position: inter-character`,
 * so zhuyin uses an inline grid instead.
 */
export function RubyChar({ char, reading, mode, className }: RubyCharProps) {
  const cls = ['ruby-char', className].filter(Boolean).join(' ');

  if (mode === 'off' || !reading) {
    return (
      <span className={cls} data-mode={mode}>
        <span className="ruby-han">{char}</span>
      </span>
    );
  }

  if (mode === 'zhuyin') {
    const { symbols, tone } = parseZhuyin(reading);
    const neutral = tone === '˙';
    return (
      <span className={`${cls} ruby-zhuyin`} data-mode={mode}>
        <span className="ruby-han">{char}</span>
        <span className="zy-col">
          {neutral && <span className="zy-neutral">˙</span>}
          {symbols.map((s, i) => (
            <span className="zy-sym" key={i}>
              {s}
            </span>
          ))}
        </span>
        {tone && !neutral && <span className="zy-tone">{tone}</span>}
      </span>
    );
  }

  return (
    <span className={cls} data-mode={mode}>
      <ruby className="ruby-over">
        <span className="ruby-han">{char}</span>
        <rt>{reading}</rt>
      </ruby>
    </span>
  );
}
