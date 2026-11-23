import { useState } from 'react';

import { DEFAULT_SETTINGS } from '../../core/types';
import { ConnectedAudioButton } from './ConnectedAudioButton';
import { useAudioService, useAudioVersion } from './serviceContext';
import './AudioCheckPage.css';

const POEM = ['床前明月光', '疑是地上霜', '舉頭望明月', '低頭思故鄉'];

/** Test/diagnostic page for the audio buttons (T58); also shows the "no voice" state. */
export function AudioCheckPage() {
  const service = useAudioService();
  useAudioVersion(service);
  const [highlight, setHighlight] = useState('');
  const cap = service.capability(DEFAULT_SETTINGS);
  const status =
    cap.status === 'ready'
      ? `Voice: ${cap.voice.name} (${cap.voice.lang})`
      : cap.status === 'no-voice'
        ? 'No Mandarin voice installed on this device.'
        : 'This browser has no speech synthesis.';
  return (
    <main className="audio-check">
      <h1>Audio check</h1>
      <p data-testid="audio-status">{status}</p>
      <p data-testid="audio-highlight" aria-live="polite">
        {highlight}
      </p>
      <div className="audio-check-row">
        <ConnectedAudioButton
          label="Play poem"
          target={{ kind: 'poem', lines: POEM }}
          settings={DEFAULT_SETTINGS}
          onHighlight={(h) => setHighlight(h ? `line ${h.line}` : '')}
        />
        <ConnectedAudioButton
          label="Play line 1 slowly"
          target={{ kind: 'line', text: POEM[0]!, line: 0 }}
          settings={DEFAULT_SETTINGS}
          slow
        />
        <ConnectedAudioButton
          label="Play char 床"
          target={{ kind: 'char', text: '床', line: 0, char: 0 }}
          settings={DEFAULT_SETTINGS}
        />
      </div>
    </main>
  );
}
