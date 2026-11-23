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

describe('BrowserSpeechProvider Cantonese', () => {
  const hk = { name: 'Sin-ji', lang: 'zh-HK', localService: true };
  const yue = { name: 'Google 粵語', lang: 'yue-HK', localService: false };

  it('selects the zh-HK voice for yue', () => {
    expect(setup([en, tw, hk]).provider.capability('yue')).toEqual({
      status: 'ready',
      voice: { name: 'Sin-ji', lang: 'zh-HK', local: true },
    });
  });
  it('selects a yue-* voice when there is no zh-HK voice', () => {
    const cap = setup([tw, yue]).provider.capability('yue');
    expect(cap.status === 'ready' && cap.voice.name).toBe('Google 粵語');
  });
  it('reports no-voice (never Mandarin) when only Mandarin voices exist', () => {
    expect(setup([en, tw, cn]).provider.capability('yue')).toEqual({ status: 'no-voice' });
  });
  it('does not speak, and does not use a Mandarin voice, when Cantonese is missing', async () => {
    const { synth, provider } = setup([tw, cn]);
    await expect(provider.speak('床前明月光', 'yue', 'normal')).resolves.toBe('no-voice');
    expect(synth.spoken).toHaveLength(0);
  });
  it('speaks Cantonese with the zh-HK voice and lang', async () => {
    const { synth, provider } = setup([tw, hk]);
    const p = provider.speak('床前明月光', 'yue', 'slow');
    expect(synth.spoken[0]!.voice).toBe(hk);
    expect(synth.spoken[0]!.lang).toBe('zh-HK');
    synth.finishCurrent();
    await expect(p).resolves.toBe('ended');
  });
  it('keeps Mandarin and Cantonese independent when both are installed', () => {
    const { provider } = setup([hk, tw]);
    const m = provider.capability('cmn');
    const c = provider.capability('yue');
    expect(m.status === 'ready' && m.voice.lang).toBe('zh-TW');
    expect(c.status === 'ready' && c.voice.lang).toBe('zh-HK');
  });
});
