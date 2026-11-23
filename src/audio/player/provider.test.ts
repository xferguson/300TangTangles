import { describe, expect, it } from 'vitest';

import { MockAudioProvider } from '../mock';
import { createClipManifest, EMPTY_MANIFEST } from './clips';
import type { ClipPlayer } from './clips';
import { createClipFirstProvider, selectProvider } from './provider';

function fakeClips(result: 'ended' | 'cancelled' | 'error' = 'ended') {
  const played: string[] = [];
  let stops = 0;
  const player: ClipPlayer = {
    play(url) {
      played.push(url);
      return Promise.resolve(result);
    },
    stop() {
      stops += 1;
    },
  };
  return { player, played, stops: () => stops };
}

const manifest = createClipManifest([
  { text: '床前明月光', lang: 'cmn', rate: 'normal', url: 'audio/l1.mp3' },
  { text: '床前明月光', lang: 'cmn', rate: 'slow', url: 'audio/l1-slow.mp3' },
]);

describe('clip manifest', () => {
  it('looks clips up by text, language and rate', () => {
    expect(manifest.lookup({ text: '床前明月光', lang: 'cmn', rate: 'slow' })).toBe(
      'audio/l1-slow.mp3',
    );
    expect(manifest.lookup({ text: '床前明月光', lang: 'yue', rate: 'normal' })).toBeUndefined();
    expect(manifest.hasLanguage('cmn')).toBe(true);
    expect(manifest.hasLanguage('nan')).toBe(false);
  });
  it('the stub manifest is empty', () => {
    expect(EMPTY_MANIFEST.size).toBe(0);
    expect(EMPTY_MANIFEST.lookup({ text: 'x', lang: 'cmn', rate: 'normal' })).toBeUndefined();
  });
});

describe('selectProvider', () => {
  it('returns the browser provider itself when there is no manifest or it is empty', () => {
    const browser = new MockAudioProvider();
    expect(selectProvider({ browser })).toBe(browser);
    expect(selectProvider({ browser, manifest: EMPTY_MANIFEST, clips: fakeClips().player })).toBe(
      browser,
    );
  });
  it('returns a clip-first provider when the manifest has clips', () => {
    const browser = new MockAudioProvider();
    const p = selectProvider({ browser, manifest, clips: fakeClips().player });
    expect(p).not.toBe(browser);
  });
  it('ignores a manifest when no clip player is available', () => {
    const browser = new MockAudioProvider();
    expect(selectProvider({ browser, manifest })).toBe(browser);
  });
});

describe('clip-first provider', () => {
  it('plays the clip and does not touch the browser voice', async () => {
    const browser = new MockAudioProvider();
    const c = fakeClips();
    const p = createClipFirstProvider({ fallback: browser, manifest, clips: c.player });
    expect(await p.speak('床前明月光', 'cmn', 'slow')).toBe('ended');
    expect(c.played).toEqual(['audio/l1-slow.mp3']);
    expect(browser.calls).toEqual([]);
  });
  it('falls back to the browser voice when the text has no clip', async () => {
    const browser = new MockAudioProvider();
    const c = fakeClips();
    const p = createClipFirstProvider({ fallback: browser, manifest, clips: c.player });
    await p.speak('疑是地上霜', 'cmn', 'normal');
    expect(c.played).toEqual([]);
    expect(browser.calls).toEqual([{ text: '疑是地上霜', lang: 'cmn', rate: 'normal' }]);
  });
  it('falls back to the browser voice when the clip fails to play', async () => {
    const browser = new MockAudioProvider();
    const p = createClipFirstProvider({
      fallback: browser,
      manifest,
      clips: fakeClips('error').player,
    });
    expect(await p.speak('床前明月光', 'cmn', 'normal')).toBe('ended');
    expect(browser.calls).toHaveLength(1);
  });
  it('does not fall back when the clip was cancelled', async () => {
    const browser = new MockAudioProvider();
    const p = createClipFirstProvider({
      fallback: browser,
      manifest,
      clips: fakeClips('cancelled').player,
    });
    expect(await p.speak('床前明月光', 'cmn', 'normal')).toBe('cancelled');
    expect(browser.calls).toEqual([]);
  });
  it('stop stops both the clip and the browser voice', () => {
    const browser = new MockAudioProvider();
    const c = fakeClips();
    createClipFirstProvider({ fallback: browser, manifest, clips: c.player }).stop();
    expect(c.stops()).toBe(1);
    expect(browser.stopCount).toBe(1);
  });
  it('is ready for a clipped language even when the device has no voice', () => {
    const browser = new MockAudioProvider({ capability: { status: 'no-voice' } });
    const p = createClipFirstProvider({ fallback: browser, manifest, clips: fakeClips().player });
    expect(p.capability('cmn').status).toBe('ready');
    expect(p.capability('nan').status).toBe('no-voice');
  });
  it('passes through to the browser when it has no voice and there is no clip', async () => {
    const browser = new MockAudioProvider({ capability: { status: 'no-voice' } });
    const p = createClipFirstProvider({ fallback: browser, manifest, clips: fakeClips().player });
    expect(await p.speak('疑是地上霜', 'cmn', 'normal')).toBe('no-voice');
  });
});
