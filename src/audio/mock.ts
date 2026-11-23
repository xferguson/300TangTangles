import type { AudioLanguage } from '../core/types';
import type { AudioCapability, AudioProvider, SpeakResult } from './types';
import type { AudioRate, VoiceInfo } from './voices';

export interface MockCall {
  text: string;
  lang: AudioLanguage;
  rate: AudioRate;
}

export interface MockAudioOptions {
  capability?: AudioCapability;
  /** When true, `speak` stays pending until `finishCurrent()` / `stop()`; otherwise it ends at once. */
  manual?: boolean;
}

const MOCK_VOICE: VoiceInfo = { name: 'Mock', lang: 'zh-TW', local: true };

/** In-memory `AudioProvider` for tests of screens and the player. */
export class MockAudioProvider implements AudioProvider {
  calls: MockCall[] = [];
  stopCount = 0;
  private readonly cap: AudioCapability;
  private readonly manual: boolean;
  private pending: ((r: SpeakResult) => void) | null = null;

  constructor(options: MockAudioOptions = {}) {
    this.cap = options.capability ?? { status: 'ready', voice: MOCK_VOICE };
    this.manual = options.manual ?? false;
  }

  // The mock answers the same for every language; the parameter only satisfies the interface.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  capability(_lang?: AudioLanguage): AudioCapability {
    return this.cap;
  }

  listVoices(): VoiceInfo[] {
    return this.cap.status === 'ready' ? [this.cap.voice] : [];
  }

  speak(text: string, lang: AudioLanguage, rate: AudioRate): Promise<SpeakResult> {
    if (this.cap.status !== 'ready') return Promise.resolve('no-voice');
    this.pending?.('cancelled');
    this.calls.push({ text, lang, rate });
    if (!this.manual) return Promise.resolve('ended');
    return new Promise((resolve) => {
      this.pending = resolve;
    });
  }

  /** Manual mode: end the utterance currently "playing". */
  finishCurrent(): void {
    const p = this.pending;
    this.pending = null;
    p?.('ended');
  }

  stop(): void {
    this.stopCount += 1;
    const p = this.pending;
    this.pending = null;
    p?.('cancelled');
  }

  onChange(): () => void {
    return () => undefined;
  }
}
