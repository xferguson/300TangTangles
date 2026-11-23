import type { AudioLanguage } from '../core/types';
import type { AudioCapability } from './types';

const LANGUAGE_NAME: Record<AudioLanguage, string> = {
  cmn: 'Mandarin',
  yue: 'Cantonese',
  nan: 'Hokkien',
};

/**
 * The honest user-facing message for a capability, or null when a voice is ready.
 * It names the language that is missing and never suggests another language as a substitute
 * (a Cantonese poem must not be read in Mandarin without the learner knowing).
 */
export function capabilityMessage(cap: AudioCapability, lang: AudioLanguage): string | null {
  switch (cap.status) {
    case 'ready':
      return null;
    case 'no-voice':
      return `This device has no ${LANGUAGE_NAME[lang]} voice installed.`;
    case 'unsupported':
      return 'This browser does not support speech playback.';
  }
}
