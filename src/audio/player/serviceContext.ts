import { createContext, useContext, useEffect, useState } from 'react';

import type { Settings } from '../../core/types';
import { BrowserSpeechProvider } from '../browser';
import { createHtmlClipPlayer, EMPTY_MANIFEST } from './clips';
import { selectProvider } from './provider';
import { createAudioService } from './service';
import type { AudioService } from './service';

/** The real service: browser voices now, clips first once a manifest is wired in here. */
export function createDefaultAudioService(): AudioService {
  const provider = selectProvider({
    browser: new BrowserSpeechProvider(),
    manifest: EMPTY_MANIFEST,
    clips: createHtmlClipPlayer(),
  });
  return createAudioService({ provider });
}

let shared: AudioService | null = null;

export const AudioServiceContext = createContext<AudioService | null>(null);

/** The provided service, or one shared app-wide default. */
export function useAudioService(): AudioService {
  const ctx = useContext(AudioServiceContext);
  if (ctx) return ctx;
  shared ??= createDefaultAudioService();
  return shared;
}

/** Re-renders when playback or capability changes. */
export function useAudioVersion(service: AudioService): number {
  const [version, setVersion] = useState(0);
  useEffect(() => service.subscribe(() => setVersion((v) => v + 1)), [service]);
  return version;
}

/** Fits `ExerciseProps.playAudio`; `undefined` when the device cannot speak this language. */
export function usePlayAudio(
  settings: Pick<Settings, 'audioLanguage'>,
): ((text: string, opts?: { slow?: boolean }) => void) | undefined {
  const service = useAudioService();
  useAudioVersion(service);
  if (service.capability(settings).status !== 'ready') return undefined;
  return (text, opts) => {
    void service.speakText(text, settings, opts);
  };
}
