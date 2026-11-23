import type { AudioLanguage } from '../core/types';
import type { AudioCapability, AudioProvider, SpeakResult } from './types';
import { rateToSpeechRate, selectVoice, type AudioRate, type VoiceInfo } from './voices';

/** The slice of `SpeechSynthesisVoice` we use. */
export interface SynthVoiceLike {
  name: string;
  lang: string;
  localService: boolean;
}

/** The slice of `SpeechSynthesisUtterance` we use. */
export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  voice: SynthVoiceLike | null;
  onstart?: (() => void) | null;
  onend?: (() => void) | null;
  onerror?: ((e: { error?: string }) => void) | null;
}

/** The slice of `speechSynthesis` we use; a fake implements it in tests. */
export interface SynthLike {
  getVoices(): SynthVoiceLike[];
  speak(u: UtteranceLike): void;
  cancel(): void;
  addEventListener(type: 'voiceschanged', listener: () => void): void;
  removeEventListener(type: 'voiceschanged', listener: () => void): void;
}

export interface BrowserSpeechOptions {
  /** `null` forces the unsupported state; omitted uses the global `speechSynthesis` if present. */
  synth?: SynthLike | null;
  createUtterance?: (text: string) => UtteranceLike;
  /** Preferred Mandarin locale, e.g. `zh-CN` for Simplified readers. Falls back if not installed. */
  preferredLocale?: string;
}

function defaultSynth(): SynthLike | null {
  return typeof speechSynthesis === 'undefined' ? null : (speechSynthesis as SynthLike);
}

function defaultUtterance(text: string): UtteranceLike {
  // Structurally compatible; the DOM type is stricter about `voice` only.
  return new SpeechSynthesisUtterance(text) as unknown as UtteranceLike;
}

const toInfo = (v: SynthVoiceLike): VoiceInfo => ({
  name: v.name,
  lang: v.lang,
  local: v.localService,
});

/** `AudioProvider` backed by the browser's built-in `speechSynthesis`. */
export class BrowserSpeechProvider implements AudioProvider {
  private readonly synth: SynthLike | null;
  private readonly createUtterance: (text: string) => UtteranceLike;
  private readonly preferredLocale: string | undefined;
  private active = false;

  constructor(options: BrowserSpeechOptions = {}) {
    this.synth = options.synth === undefined ? defaultSynth() : options.synth;
    this.createUtterance = options.createUtterance ?? defaultUtterance;
    this.preferredLocale = options.preferredLocale;
  }

  listVoices(): VoiceInfo[] {
    return this.synth ? this.synth.getVoices().map(toInfo) : [];
  }

  private pick(lang: AudioLanguage): SynthVoiceLike | null {
    if (!this.synth) return null;
    const raw = this.synth.getVoices();
    const chosen = selectVoice(raw.map(toInfo), lang, this.preferredLocale);
    return chosen
      ? (raw.find((v) => v.name === chosen.name && v.lang === chosen.lang) ?? null)
      : null;
  }

  capability(lang: AudioLanguage): AudioCapability {
    if (!this.synth) return { status: 'unsupported' };
    const voice = this.pick(lang);
    return voice ? { status: 'ready', voice: toInfo(voice) } : { status: 'no-voice' };
  }

  speak(text: string, lang: AudioLanguage, rate: AudioRate): Promise<SpeakResult> {
    const synth = this.synth;
    const voice = this.pick(lang);
    if (!synth || !voice) return Promise.resolve('no-voice');
    if (this.active) synth.cancel();
    return new Promise<SpeakResult>((resolve) => {
      const u = this.createUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rateToSpeechRate(rate);
      let settled = false;
      const settle = (r: SpeakResult) => {
        if (settled) return;
        settled = true;
        this.active = false;
        resolve(r);
      };
      u.onend = () => settle('ended');
      // Any error (canceled, interrupted, synthesis-failed) ends playback; sequencing stops on it.
      u.onerror = () => settle('cancelled');
      this.active = true;
      synth.speak(u);
    });
  }

  stop(): void {
    this.synth?.cancel();
  }

  onChange(listener: () => void): () => void {
    const synth = this.synth;
    if (!synth) return () => undefined;
    synth.addEventListener('voiceschanged', listener);
    return () => synth.removeEventListener('voiceschanged', listener);
  }
}
