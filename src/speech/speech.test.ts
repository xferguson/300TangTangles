import { describe, expect, it } from 'vitest';
import {
  MockSpeechInput,
  RecordSelfGradeInput,
  WebSpeechInput,
  createSpeechInput,
  detectSpeechRecognition,
  recognitionLocale,
  type RecognitionCtor,
  type RecorderLike,
} from './index';

class FakeRecognition {
  static last: FakeRecognition | undefined;
  lang = '';
  interimResults = true;
  maxAlternatives = 1;
  continuous = true;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
}
const Ctor = FakeRecognition as unknown as RecognitionCtor;

describe('recognitionLocale', () => {
  it('maps languages and scripts to BCP-47 locales', () => {
    expect(recognitionLocale('cmn', 'trad')).toBe('zh-TW');
    expect(recognitionLocale('cmn', 'simp')).toBe('zh-CN');
    expect(recognitionLocale('yue', 'trad')).toBe('zh-HK');
    expect(recognitionLocale('yue', 'simp')).toBe('zh-HK');
  });
  it('has no locale for Hokkien', () => {
    expect(recognitionLocale('nan', 'trad')).toBeNull();
  });
});

describe('detectSpeechRecognition', () => {
  it('returns the standard or webkit-prefixed constructor, else undefined', () => {
    expect(detectSpeechRecognition({ SpeechRecognition: Ctor })).toBe(Ctor);
    expect(detectSpeechRecognition({ webkitSpeechRecognition: Ctor })).toBe(Ctor);
    expect(detectSpeechRecognition({})).toBeUndefined();
  });
});

describe('WebSpeechInput', () => {
  it('sets the locale and resolves with transcript and alternatives', async () => {
    const input = new WebSpeechInput(Ctor, 'zh-TW');
    const p = input.listen();
    const r = FakeRecognition.last!;
    expect(r.lang).toBe('zh-TW');
    expect(r.started).toBe(true);
    r.onresult?.({
      results: [
        [
          { transcript: '床前明月光', confidence: 0.9 },
          { transcript: '窗前明月光', confidence: 0.4 },
        ],
      ],
    });
    r.onend?.();
    await expect(p).resolves.toEqual({
      kind: 'transcript',
      transcript: '床前明月光',
      alternatives: ['床前明月光', '窗前明月光'],
    });
  });
  it('rejects with the error code', async () => {
    const input = new WebSpeechInput(Ctor, 'zh-TW');
    const p = input.listen();
    FakeRecognition.last!.onerror?.({ error: 'not-allowed' });
    await expect(p).rejects.toThrow('not-allowed');
  });
  it('resolves an empty transcript when nothing was heard', async () => {
    const input = new WebSpeechInput(Ctor, 'zh-TW');
    const p = input.listen();
    FakeRecognition.last!.onend?.();
    await expect(p).resolves.toEqual({ kind: 'transcript', transcript: '', alternatives: [] });
  });
});

describe('RecordSelfGradeInput', () => {
  it('records, then returns a playable recording result', async () => {
    const recorder: RecorderLike = {
      start: async () => undefined,
      stop: async () => 'blob:abc',
    };
    const input = new RecordSelfGradeInput(() => recorder);
    const p = input.listen();
    await input.stop();
    await expect(p).resolves.toEqual({ kind: 'recording', audioUrl: 'blob:abc' });
  });
});

describe('MockSpeechInput', () => {
  it('replays scripted results in order, then rejects', async () => {
    const m = new MockSpeechInput('recognition', [
      { kind: 'transcript', transcript: 'a', alternatives: ['a'] },
    ]);
    await expect(m.listen()).resolves.toMatchObject({ transcript: 'a' });
    await expect(m.listen()).rejects.toThrow();
  });
});

describe('createSpeechInput fallback selection', () => {
  const recorderFactory = (): RecorderLike => ({
    start: async () => undefined,
    stop: async () => 'blob:x',
  });
  it('uses recognition when supported', () => {
    const i = createSpeechInput({
      language: 'cmn',
      script: 'trad',
      env: { SpeechRecognition: Ctor },
      recorderFactory,
    });
    expect(i.mode).toBe('recognition');
  });
  it('falls back to self-grade without the API', () => {
    const i = createSpeechInput({ language: 'cmn', script: 'trad', env: {}, recorderFactory });
    expect(i.mode).toBe('self-grade');
  });
  it('falls back to self-grade for Hokkien even with the API', () => {
    const i = createSpeechInput({
      language: 'nan',
      script: 'trad',
      env: { SpeechRecognition: Ctor },
      recorderFactory,
    });
    expect(i.mode).toBe('self-grade');
  });
});
