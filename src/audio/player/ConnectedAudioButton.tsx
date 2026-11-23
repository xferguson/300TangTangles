import { useRef, useState } from 'react';

import type { Settings } from '../../core/types';
import { AudioButton } from '../../ui/AudioButton/AudioButton';
import type { PlayExtras } from './service';
import type { PlayTarget } from '../player';
import { useAudioService, useAudioVersion } from './serviceContext';

export interface ConnectedAudioButtonProps {
  label: string;
  target: PlayTarget;
  settings: Pick<Settings, 'audioLanguage'>;
  slow?: boolean;
  onHighlight?: PlayExtras['onHighlight'];
  className?: string;
}

/** `AudioButton` wired to the audio service: plays `target` and mirrors playback state. */
export function ConnectedAudioButton({
  label,
  target,
  settings,
  slow = false,
  onHighlight,
  className,
}: ConnectedAudioButtonProps) {
  const service = useAudioService();
  useAudioVersion(service);
  const [mine, setMine] = useState(false);
  const run = useRef(0);

  const unavailable = service.capability(settings).status !== 'ready';
  const playing = mine && service.isPlaying();

  function onPlay() {
    run.current += 1;
    const id = run.current;
    setMine(true);
    void service.play(target, settings, { slow, onHighlight }).finally(() => {
      if (run.current === id) setMine(false);
    });
  }

  return (
    <AudioButton
      label={label}
      state={unavailable ? 'unavailable' : playing ? 'playing' : 'idle'}
      speed={slow ? 'slow' : 'normal'}
      onPlay={onPlay}
      onStop={() => service.stop()}
      className={className}
    />
  );
}
