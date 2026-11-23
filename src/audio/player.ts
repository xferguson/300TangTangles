import type { AudioLanguage } from '../core/types';
import type { AudioProvider } from './types';
import type { AudioRate } from './voices';

/** What is being spoken: a line, or one char of a line. `null` means nothing. */
export interface Highlight {
  line: number;
  char?: number;
}

export type PlayTarget =
  | { kind: 'poem'; lines: readonly string[] }
  | { kind: 'line'; text: string; line: number }
  | { kind: 'char'; text: string; line: number; char: number };

export interface PlayOptions {
  lang: AudioLanguage;
  rate: AudioRate;
  onHighlight?: (h: Highlight | null) => void;
}

export type PlayResult = 'completed' | 'cancelled' | 'no-voice';

export interface Player {
  /** Play a target, cancelling whatever was playing. Resolves when it finishes or is cancelled. */
  play(target: PlayTarget, options: PlayOptions): Promise<PlayResult>;
  stop(): void;
  isPlaying(): boolean;
}

/**
 * Sequences a provider: the whole poem line by line, one line, or one char, with highlight
 * callbacks. Browser voices give no reliable per-char timing, so a poem highlights per line and
 * a char highlight only appears when a single char is played.
 */
export function createPlayer(provider: AudioProvider): Player {
  let token = 0;
  let playing = 0;
  /** Token of the playback that owns the highlight; 0 when stopped. */
  let owner = 0;

  async function run(target: PlayTarget, o: PlayOptions, mine: number): Promise<PlayResult> {
    const items: { text: string; highlight: Highlight }[] =
      target.kind === 'poem'
        ? target.lines.map((text, line) => ({ text, highlight: { line } }))
        : target.kind === 'line'
          ? [{ text: target.text, highlight: { line: target.line } }]
          : [{ text: target.text, highlight: { line: target.line, char: target.char } }];
    for (const item of items) {
      if (token !== mine) return 'cancelled';
      o.onHighlight?.(item.highlight);
      const r = await provider.speak(item.text, o.lang, o.rate);
      if (r === 'no-voice') return 'no-voice';
      if (r === 'cancelled' || token !== mine) return 'cancelled';
    }
    return 'completed';
  }

  return {
    async play(target, options) {
      token += 1;
      const mine = token;
      owner = mine;
      provider.stop();
      playing += 1;
      try {
        return await run(target, options, mine);
      } finally {
        playing -= 1;
        // A newer playback owns the highlight now; don't clear it from under that one.
        if (owner === mine || owner === 0) options.onHighlight?.(null);
      }
    },
    stop() {
      token += 1;
      owner = 0;
      provider.stop();
    },
    isPlaying: () => playing > 0,
  };
}
