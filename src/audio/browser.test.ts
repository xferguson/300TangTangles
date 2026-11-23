import { describe, expect, it, vi } from 'vitest';

import { BrowserSpeechProvider } from './browser';
import { fakeUtteranceFactory, FakeSpeechSynthesis } from './fakeSpeech';

const tw = { name: 'Mei-Jia', lang: 'zh-TW', localService: true };
const cn = { name: 'Tingting', lang: 'zh-CN', localService: true };
const en = { name: 'Alex', lang: 'en-US', localService: true };

function setup(voices = [en, cn, tw]) {
  const synth = new FakeSpeechSynthesis(voices);
  const provider = new BrowserSpeechProvider({ synth, createUtterance: fakeUtteranceFactory });
  return { synth, provider };
}

describe('BrowserSpeechProvider capability', () => {
  it('is ready with the zh-TW voice when installed', () => {
    const { provider } = setup();
    expect(provider.capability('cmn')).toEqual({
      status: 'ready',
      voice: { name: 'Mei-Jia', lang: 'zh-TW', local: true },
    });
  });
  it('falls back to zh-CN when there is no zh-TW voice', () => {
    const { provider } = setup([en, cn]);
    const cap = provider.capability('cmn');
    expect(cap.status === 'ready' && cap.voice.name).toBe('Tingting');
  });
  it('reports no-voice when only non-Chinese voices exist', () => {
    const { provider } = setup([en]);
    expect(provider.capability('cmn')).toEqual({ status: 'no-voice' });
  });
  it('reports no-voice for Hokkien', () => {
    expect(setup().provider.capability('nan')).toEqual({ status: 'no-voice' });
  });
  it('reports unsupported when speechSynthesis is missing', () => {
    const provider = new BrowserSpeechProvider({ synth: null });
    expect(provider.capability('cmn')).toEqual({ status: 'unsupported' });
    expect(provider.listVoices()).toEqual([]);
  });
  it('lists all device voices', () => {
    expect(
      setup()
        .provider.listVoices()
        .map((v) => v.name),
    ).toEqual(['Alex', 'Tingting', 'Mei-Jia']);
  });
  it('notices voices that load late and notifies subscribers', () => {
    const { synth, provider } = setup([]);
    const cb = vi.fn();
    const off = provider.onChange(cb);
    expect(provider.capability('cmn').status).toBe('no-voice');
    synth.setVoices([tw]);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(provider.capability('cmn').status).toBe('ready');
    off();
    expect(synth.listenerCount).toBe(0);
  });
});

describe('BrowserSpeechProvider speak', () => {
  it('speaks with the chosen voice, its lang, and the mapped rate', async () => {
    const { synth, provider } = setup();
    const p = provider.speak('床前明月光', 'cmn', 'slow');
    const u = synth.spoken[0]!;
    expect(u.text).toBe('床前明月光');
    expect(u.lang).toBe('zh-TW');
    expect(u.voice).toBe(tw);
    expect(u.rate).toBeLessThan(1);
    synth.finishCurrent();
    await expect(p).resolves.toBe('ended');
  });
  it('uses rate 1 for normal', () => {
    const { synth, provider } = setup();
    void provider.speak('月', 'cmn', 'normal');
    expect(synth.spoken[0]!.rate).toBe(1);
  });
  it('resolves no-voice without speaking when nothing is installed', async () => {
    const { synth, provider } = setup([en]);
    await expect(provider.speak('月', 'cmn', 'normal')).resolves.toBe('no-voice');
    expect(synth.spoken).toHaveLength(0);
  });
  it('stop cancels the current utterance', async () => {
    const { synth, provider } = setup();
    const p = provider.speak('月', 'cmn', 'normal');
    provider.stop();
    await expect(p).resolves.toBe('cancelled');
    expect(synth.cancelCount).toBe(1);
  });
  it('a new speak interrupts the previous one', async () => {
    const { synth, provider } = setup();
    const first = provider.speak('月', 'cmn', 'normal');
    const second = provider.speak('光', 'cmn', 'normal');
    await expect(first).resolves.toBe('cancelled');
    synth.finishCurrent();
    await expect(second).resolves.toBe('ended');
  });
});
