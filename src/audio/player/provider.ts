import type { AudioLanguage } from '../../core/types';
import type { AudioCapability, AudioProvider, SpeakResult } from '../types';
import type { AudioRate } from '../voices';
import type { ClipManifest, ClipPlayer } from './clips';

export interface ClipFirstOptions {
  /** The browser-voice provider used whenever a clip is missing or fails. */
  fallback: AudioProvider;
  manifest: ClipManifest;
  clips: ClipPlayer;
}

/** Plays a recorded clip when the manifest has one, otherwise (or on clip error) the fallback. */
export function createClipFirstProvider({
  fallback,
  manifest,
  clips,
}: ClipFirstOptions): AudioProvider {
  return {
    capability(lang: AudioLanguage): AudioCapability {
      const cap = fallback.capability(lang);
      if (cap.status === 'ready' || !manifest.hasLanguage(lang)) return cap;
      return { status: 'ready', voice: { name: 'Recorded clips', lang, local: true } };
    },
    listVoices: () => fallback.listVoices(),
    async speak(text: string, lang: AudioLanguage, rate: AudioRate): Promise<SpeakResult> {
      const url = manifest.lookup({ text, lang, rate });
      if (url !== undefined) {
        fallback.stop();
        const r = await clips.play(url, rate);
        if (r === 'ended') return 'ended';
        if (r === 'cancelled') return 'cancelled';
      }
      return fallback.speak(text, lang, rate);
    },
    stop() {
      clips.stop();
      fallback.stop();
    },
    onChange: (l) => fallback.onChange(l),
  };
}

export interface SelectProviderOptions {
  browser: AudioProvider;
  manifest?: ClipManifest;
  clips?: ClipPlayer | null;
}

/** Browser voices alone until clips exist; clip-first with browser fallback once they do. */
export function selectProvider({ browser, manifest, clips }: SelectProviderOptions): AudioProvider {
  if (!manifest || manifest.size === 0 || !clips) return browser;
  return createClipFirstProvider({ fallback: browser, manifest, clips });
}
