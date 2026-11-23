import { describe, expect, it } from 'vitest';

import { rateToSpeechRate, selectVoice, type VoiceInfo } from './voices';

const v = (name: string, lang: string, local = true): VoiceInfo => ({ name, lang, local });

describe('selectVoice (cmn)', () => {
  it('prefers zh-TW over zh-CN', () => {
    const voices = [v('A', 'zh-CN'), v('B', 'zh-TW'), v('C', 'en-US')];
    expect(selectVoice(voices, 'cmn')?.name).toBe('B');
  });
  it('falls back to zh-CN, then any other Mandarin-ish zh voice', () => {
    expect(selectVoice([v('A', 'en-US'), v('B', 'zh-CN')], 'cmn')?.name).toBe('B');
    expect(selectVoice([v('A', 'cmn-Hans-CN')], 'cmn')?.name).toBe('A');
  });
  it('normalises underscores and case (Android reports zh_TW)', () => {
    expect(selectVoice([v('A', 'zh_cn'), v('B', 'zh_TW')], 'cmn')?.name).toBe('B');
  });
  it('never picks a Cantonese voice for Mandarin', () => {
    expect(selectVoice([v('A', 'zh-HK'), v('B', 'yue-HK')], 'cmn')).toBeNull();
  });
  it('prefers a local voice within the same language', () => {
    const voices = [v('Net', 'zh-TW', false), v('Local', 'zh-TW', true)];
    expect(selectVoice(voices, 'cmn')?.name).toBe('Local');
  });
  it('honours a preferred locale when one is installed', () => {
    const voices = [v('TW', 'zh-TW'), v('CN', 'zh-CN')];
    expect(selectVoice(voices, 'cmn', 'zh-CN')?.name).toBe('CN');
    expect(selectVoice([v('TW', 'zh-TW')], 'cmn', 'zh-CN')?.name).toBe('TW');
  });
  it('returns null when there are no voices', () => {
    expect(selectVoice([], 'cmn')).toBeNull();
  });
});

describe('selectVoice (other languages)', () => {
  it('picks zh-HK / yue for Cantonese', () => {
    expect(selectVoice([v('A', 'zh-TW'), v('B', 'zh-HK')], 'yue')?.name).toBe('B');
  });
  it('has no browser voice for Hokkien', () => {
    expect(selectVoice([v('A', 'zh-TW')], 'nan')).toBeNull();
  });
});

describe('rateToSpeechRate', () => {
  it('maps normal to 1 and slow to a slower rate', () => {
    expect(rateToSpeechRate('normal')).toBe(1);
    expect(rateToSpeechRate('slow')).toBeLessThan(1);
    expect(rateToSpeechRate('slow')).toBeGreaterThan(0.1);
  });
});
