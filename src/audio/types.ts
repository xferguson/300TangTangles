import type { AudioLanguage } from '../core/types';
import type { AudioRate, VoiceInfo } from './voices';

export type { AudioRate, VoiceInfo };

/**
 * What a provider can do for a language right now.
 * - `ready`: a voice was found; `voice` is the one that will be used.
 * - `no-voice`: speech works but the device has no suitable voice (show the "no voice installed" state).
 * - `unsupported`: the browser has no speech synthesis at all.
 */
export type AudioCapability =
  { status: 'ready'; voice: VoiceInfo } | { status: 'no-voice' } | { status: 'unsupported' };

/** How a `speak` call ended. `cancelled` = stopped or interrupted by a newer call. */
export type SpeakResult = 'ended' | 'cancelled' | 'no-voice';

/** Where sound comes from. Screens depend on this, never on `speechSynthesis` directly. */
export interface AudioProvider {
  capability(lang: AudioLanguage): AudioCapability;
  /** Every voice the device offers, for diagnostics and the findings doc. */
  listVoices(): VoiceInfo[];
  /** Speak `text`, interrupting anything already playing. Never rejects. */
  speak(text: string, lang: AudioLanguage, rate: AudioRate): Promise<SpeakResult>;
  stop(): void;
  /** Subscribe to capability changes (voices load late on some browsers). Returns unsubscribe. */
  onChange(listener: () => void): () => void;
}
