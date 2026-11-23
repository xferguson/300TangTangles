import type { AudioLanguage } from '../../core/types';
import type { AudioRate } from '../voices';

export interface ClipKey {
  text: string;
  lang: AudioLanguage;
  rate: AudioRate;
}

export interface ClipEntry extends ClipKey {
  /** Path of the clip relative to the app base, e.g. `audio/cmn/jingyesi-1.mp3`. */
  url: string;
}

/**
 * Which recorded clips exist. No manifest is generated yet (T43 / T45 may add one), so the app
 * runs on `EMPTY_MANIFEST`; the clip-first path is exercised by tests only until clips ship.
 */
export interface ClipManifest {
  readonly size: number;
  lookup(key: ClipKey): string | undefined;
  hasLanguage(lang: AudioLanguage): boolean;
}

const keyOf = (k: ClipKey) => `${k.lang}|${k.rate}|${k.text}`;

export function createClipManifest(entries: readonly ClipEntry[]): ClipManifest {
  const byKey = new Map(entries.map((e) => [keyOf(e), e.url]));
  const langs = new Set(entries.map((e) => e.lang));
  return {
    size: byKey.size,
    lookup: (key) => byKey.get(keyOf(key)),
    hasLanguage: (lang) => langs.has(lang),
  };
}

export const EMPTY_MANIFEST: ClipManifest = createClipManifest([]);

/** Plays one recorded clip. `error` means it could not play, so the caller may fall back. */
export interface ClipPlayer {
  play(url: string, rate: AudioRate): Promise<'ended' | 'cancelled' | 'error'>;
  stop(): void;
}

/** `ClipPlayer` on an `HTMLAudioElement`; `null` where there is no `Audio` (tests, SSR). */
export function createHtmlClipPlayer(
  AudioCtor: (new (src?: string) => HTMLAudioElement) | undefined = typeof Audio === 'undefined'
    ? undefined
    : Audio,
): ClipPlayer | null {
  if (!AudioCtor) return null;
  let current: { el: HTMLAudioElement; finish: (r: 'cancelled') => void } | null = null;
  return {
    play(url, rate) {
      current?.finish('cancelled');
      return new Promise((resolve) => {
        const el = new AudioCtor(url);
        el.playbackRate = rate === 'slow' ? 0.6 : 1;
        const done = (r: 'ended' | 'cancelled' | 'error') => {
          if (current?.el === el) current = null;
          el.onended = el.onerror = null;
          resolve(r);
        };
        current = {
          el,
          finish: (r) => {
            el.pause();
            done(r);
          },
        };
        el.onended = () => done('ended');
        el.onerror = () => done('error');
        el.play().catch(() => done('error'));
      });
    },
    stop() {
      current?.finish('cancelled');
    },
  };
}
