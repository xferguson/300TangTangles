import { describe, expect, it } from 'vitest';

import { MockAudioProvider } from './mock';
import { createPlayer, type Highlight } from './player';

const lines = ['床前明月光', '疑是地上霜', '舉頭望明月', '低頭思故鄉'];

function setup(opts: ConstructorParameters<typeof MockAudioProvider>[0] = {}) {
  const provider = new MockAudioProvider(opts);
  const player = createPlayer(provider);
  const highlights: (Highlight | null)[] = [];
  const onHighlight = (h: Highlight | null) => highlights.push(h);
  return { provider, player, highlights, onHighlight };
}

describe('MockAudioProvider', () => {
  it('records calls and reports a configurable capability', async () => {
    const provider = new MockAudioProvider({ capability: { status: 'no-voice' } });
    expect(provider.capability('cmn')).toEqual({ status: 'no-voice' });
    expect(await provider.speak('月', 'cmn', 'slow')).toBe('no-voice');
    const ok = new MockAudioProvider();
    await ok.speak('月', 'cmn', 'slow');
    expect(ok.calls).toEqual([{ text: '月', lang: 'cmn', rate: 'slow' }]);
  });
});

describe('player', () => {
  it('plays a whole poem line by line, in order, highlighting each line', async () => {
    const { provider, player, highlights, onHighlight } = setup();
    const result = await player.play(
      { kind: 'poem', lines },
      { lang: 'cmn', rate: 'normal', onHighlight },
    );
    expect(result).toBe('completed');
    expect(provider.calls.map((c) => c.text)).toEqual(lines);
    expect(highlights).toEqual([{ line: 0 }, { line: 1 }, { line: 2 }, { line: 3 }, null]);
  });

  it('plays one line at the chosen rate', async () => {
    const { provider, player, highlights, onHighlight } = setup();
    await player.play(
      { kind: 'line', text: lines[1]!, line: 1 },
      { lang: 'cmn', rate: 'slow', onHighlight },
    );
    expect(provider.calls).toEqual([{ text: lines[1], lang: 'cmn', rate: 'slow' }]);
    expect(highlights).toEqual([{ line: 1 }, null]);
  });

  it('plays one char and highlights it', async () => {
    const { provider, player, highlights, onHighlight } = setup();
    await player.play(
      { kind: 'char', text: '月', line: 0, char: 3 },
      { lang: 'cmn', rate: 'normal', onHighlight },
    );
    expect(provider.calls.map((c) => c.text)).toEqual(['月']);
    expect(highlights).toEqual([{ line: 0, char: 3 }, null]);
  });

  it('stop cancels the poem mid-way and plays no further lines', async () => {
    const { provider, player, highlights, onHighlight } = setup({ manual: true });
    const done = player.play({ kind: 'poem', lines }, { lang: 'cmn', rate: 'normal', onHighlight });
    expect(provider.calls).toHaveLength(1);
    provider.finishCurrent();
    await Promise.resolve();
    await Promise.resolve();
    expect(provider.calls).toHaveLength(2);
    player.stop();
    expect(await done).toBe('cancelled');
    expect(provider.calls).toHaveLength(2);
    expect(provider.stopCount).toBeGreaterThan(0);
    expect(highlights.at(-1)).toBeNull();
  });

  it('starting a new playback cancels the one in progress', async () => {
    const { provider, player } = setup({ manual: true });
    const first = player.play({ kind: 'poem', lines }, { lang: 'cmn', rate: 'normal' });
    const second = player.play(
      { kind: 'char', text: '月', line: 0, char: 3 },
      { lang: 'cmn', rate: 'normal' },
    );
    expect(await first).toBe('cancelled');
    provider.finishCurrent();
    expect(await second).toBe('completed');
    expect(provider.calls.map((c) => c.text)).toEqual([lines[0], '月']);
  });

  it('reports no-voice and clears the highlight', async () => {
    const { player, highlights, onHighlight } = setup({ capability: { status: 'no-voice' } });
    const result = await player.play({ kind: 'poem', lines }, { lang: 'cmn', rate: 'normal', onHighlight });
    expect(result).toBe('no-voice');
    expect(highlights.at(-1)).toBeNull();
  });

  it('exposes whether it is playing', async () => {
    const { provider, player } = setup({ manual: true });
    expect(player.isPlaying()).toBe(false);
    const done = player.play({ kind: 'line', text: lines[0]!, line: 0 }, { lang: 'cmn', rate: 'normal' });
    expect(player.isPlaying()).toBe(true);
    provider.finishCurrent();
    await done;
    expect(player.isPlaying()).toBe(false);
  });
});
