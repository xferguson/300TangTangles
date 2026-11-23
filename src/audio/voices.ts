import type { AudioLanguage } from '../core/types';

/** A voice the device offers, reduced to what we care about. */
export interface VoiceInfo {
  name: string;
  /** BCP-47 tag as reported by the device, e.g. `zh-TW`. */
  lang: string;
  /** True for on-device voices (work offline). */
  local: boolean;
}

/** The two speeds the UI offers. */
export type AudioRate = 'normal' | 'slow';

export function rateToSpeechRate(rate: AudioRate): number {
  return rate === 'slow' ? 0.6 : 1;
}

/** Lower-cases and swaps `_` for `-` (Android reports `zh_TW`). */
export function normalizeLang(lang: string): string {
  return lang.replace(/_/g, '-').toLowerCase();
}

/** Ordered locale preferences per audio language; earlier is better. */
const MANDARIN_ORDER = ['zh-tw', 'zh-cn'];

function isCantonese(tag: string): boolean {
  return tag.startsWith('zh-hk') || tag.startsWith('yue');
}

/** Rank of a voice for a language; lower is better, -1 means unusable. */
function rank(tag: string, lang: AudioLanguage, preferred?: string): number {
  if (lang === 'nan') return -1;
  if (lang === 'yue') {
    if (tag.startsWith('zh-hk')) return 0;
    if (tag.startsWith('yue')) return 1;
    return -1;
  }
  if (isCantonese(tag)) return -1;
  const pref = preferred ? normalizeLang(preferred) : null;
  if (pref && tag === pref) return 0;
  const i = MANDARIN_ORDER.findIndex((p) => tag === p || tag.startsWith(`${p}-`));
  if (i >= 0) return 1 + i;
  if (tag.startsWith('zh') || tag.startsWith('cmn')) return 1 + MANDARIN_ORDER.length;
  return -1;
}

/**
 * Pick the best voice for a language from what the device offers, or null for the "no voice
 * installed" state. Within the same rank a local voice beats a network one. Hokkien has no
 * browser voice, so it always yields null.
 */
export function selectVoice(
  voices: readonly VoiceInfo[],
  lang: AudioLanguage,
  preferredLocale?: string,
): VoiceInfo | null {
  let best: VoiceInfo | null = null;
  let bestKey: [number, number] | null = null;
  for (const voice of voices) {
    const r = rank(normalizeLang(voice.lang), lang, preferredLocale);
    if (r < 0) continue;
    const key: [number, number] = [r, voice.local ? 0 : 1];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = voice;
      bestKey = key;
    }
  }
  return best;
}
