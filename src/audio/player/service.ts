import type { AudioLanguage, Settings } from '../../core/types';
import { createPlayer } from '../player';
import type { PlayOptions, PlayResult, PlayTarget } from '../player';
import type { AudioCapability, AudioProvider } from '../types';

export interface PlayExtras {
  slow?: boolean;
  onHighlight?: PlayOptions['onHighlight'];
}

export interface AudioService {
  /** Play full poem / line / char in `settings.audioLanguage`; slow via `extras.slow`. */
  play(
    target: PlayTarget,
    settings: Pick<Settings, 'audioLanguage'>,
    extras?: PlayExtras,
  ): Promise<PlayResult>;
  /** Shape of `ExerciseProps.playAudio`, minus the settings binding. */
  speakText(
    text: string,
    settings: Pick<Settings, 'audioLanguage'>,
    extras?: PlayExtras,
  ): Promise<PlayResult>;
  stop(): void;
  isPlaying(): boolean;
  capability(settings: Pick<Settings, 'audioLanguage'>): AudioCapability;
  /** Notified when playback starts/stops or the provider's capability changes. */
  subscribe(listener: () => void): () => void;
}

export function createAudioService({ provider }: { provider: AudioProvider }): AudioService {
  const player = createPlayer(provider);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  async function play(
    target: PlayTarget,
    settings: Pick<Settings, 'audioLanguage'>,
    extras: PlayExtras = {},
  ): Promise<PlayResult> {
    const lang: AudioLanguage = settings.audioLanguage;
    const p = player.play(target, {
      lang,
      rate: extras.slow ? 'slow' : 'normal',
      onHighlight: extras.onHighlight,
    });
    emit();
    try {
      return await p;
    } finally {
      emit();
    }
  }

  return {
    play,
    speakText: (text, settings, extras) => play({ kind: 'line', text, line: 0 }, settings, extras),
    stop() {
      player.stop();
      emit();
    },
    isPlaying: () => player.isPlaying(),
    capability: (settings) => provider.capability(settings.audioLanguage),
    subscribe(listener) {
      listeners.add(listener);
      const off = provider.onChange(listener);
      return () => {
        listeners.delete(listener);
        off();
      };
    },
  };
}
