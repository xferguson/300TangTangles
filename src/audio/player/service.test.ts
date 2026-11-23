import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '../../core/types';
import { MockAudioProvider } from '../mock';
import { createAudioService } from './service';

const lines = ['床前明月光', '疑是地上霜'];

describe('audio service', () => {
  it('plays a whole poem line by line in the settings language', async () => {
    const provider = new MockAudioProvider();
    const svc = createAudioService({ provider });
    const r = await svc.play(
      { kind: 'poem', lines },
      { ...DEFAULT_SETTINGS, audioLanguage: 'yue' },
    );
    expect(r).toBe('completed');
    expect(provider.calls.map((c) => [c.text, c.lang, c.rate])).toEqual([
      ['床前明月光', 'yue', 'normal'],
      ['疑是地上霜', 'yue', 'normal'],
    ]);
  });
  it('plays one line or one char, slow on request', async () => {
    const provider = new MockAudioProvider();
    const svc = createAudioService({ provider });
    await svc.play({ kind: 'line', text: lines[1]!, line: 1 }, DEFAULT_SETTINGS, { slow: true });
    await svc.play({ kind: 'char', text: '床', line: 0, char: 0 }, DEFAULT_SETTINGS);
    expect(provider.calls.map((c) => [c.text, c.rate])).toEqual([
      ['疑是地上霜', 'slow'],
      ['床', 'normal'],
    ]);
  });
  it('reports capability for the settings language and tracks playing state', async () => {
    const provider = new MockAudioProvider({ manual: true });
    const svc = createAudioService({ provider });
    expect(svc.capability(DEFAULT_SETTINGS).status).toBe('ready');
    const seen: boolean[] = [];
    svc.subscribe(() => seen.push(svc.isPlaying()));
    const done = svc.play({ kind: 'line', text: lines[0]!, line: 0 }, DEFAULT_SETTINGS);
    expect(svc.isPlaying()).toBe(true);
    svc.stop();
    expect(await done).toBe('cancelled');
    expect(svc.isPlaying()).toBe(false);
    expect(seen).toContain(true);
    expect(seen.at(-1)).toBe(false);
  });
  it('speakText gives exercises a playAudio function', async () => {
    const provider = new MockAudioProvider();
    const svc = createAudioService({ provider });
    await svc.speakText('床', DEFAULT_SETTINGS, { slow: true });
    expect(provider.calls).toEqual([{ text: '床', lang: 'cmn', rate: 'slow' }]);
  });
});
