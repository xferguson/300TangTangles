/**
 * Speech-input wrapper (T44). A `SpeechInput` is either live recognition (Web Speech API)
 * or a record → playback → self-grade fallback. Adapters take their browser dependencies
 * by injection so they can be tested without a real browser.
 */
import type { AudioLanguage, Settings } from '../core';

export type SpeechResult =
  | { kind: 'transcript'; transcript: string; alternatives: string[] }
  | { kind: 'recording'; audioUrl: string };

export type SpeechInputMode = 'recognition' | 'self-grade';

export interface SpeechInput {
  readonly mode: SpeechInputMode;
  /** Start capturing; resolves when capture ends (via `stop()` or end of speech). */
  listen(): Promise<SpeechResult>;
  /** Stop capturing and let `listen()` resolve. */
  stop(): Promise<void>;
}

/** BCP-47 locale for recognition, or null when no recognizer exists (Hokkien). */
export function recognitionLocale(
  language: AudioLanguage,
  script: Settings['script'],
): string | null {
  switch (language) {
    case 'cmn':
      return script === 'simp' ? 'zh-CN' : 'zh-TW';
    case 'yue':
      return 'zh-HK';
    case 'nan':
      return null;
  }
}

// ---- Web Speech API adapter ------------------------------------------------------------

interface RecognitionAlternative {
  transcript: string;
  confidence?: number;
}
interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<RecognitionAlternative>>;
}
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => RecognitionLike;

export interface SpeechEnv {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
}

export function detectSpeechRecognition(env: SpeechEnv): RecognitionCtor | undefined {
  return env.SpeechRecognition ?? env.webkitSpeechRecognition;
}

export class WebSpeechInput implements SpeechInput {
  readonly mode = 'recognition' as const;
  private current: RecognitionLike | undefined;

  constructor(
    private readonly Ctor: RecognitionCtor,
    private readonly locale: string,
  ) {}

  listen(): Promise<SpeechResult> {
    return new Promise((resolve, reject) => {
      const rec = new this.Ctor();
      this.current = rec;
      rec.lang = this.locale;
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 3;
      let alternatives: string[] = [];
      rec.onresult = (e) => {
        const first = e.results[0];
        alternatives = first ? Array.from(first, (a) => a.transcript) : [];
      };
      rec.onerror = (e) => reject(new Error(e.error));
      rec.onend = () =>
        resolve({ kind: 'transcript', transcript: alternatives[0] ?? '', alternatives });
      rec.start();
    });
  }

  async stop(): Promise<void> {
    this.current?.stop();
  }
}

// ---- Record → playback → self-grade fallback -------------------------------------------

export interface RecorderLike {
  start(): Promise<void>;
  /** Stop recording; resolves to a playable URL (e.g. an object URL). */
  stop(): Promise<string>;
}

export class RecordSelfGradeInput implements SpeechInput {
  readonly mode = 'self-grade' as const;
  private recorder: RecorderLike | undefined;
  private stopRequested: ((url: string) => void) | undefined;

  constructor(private readonly recorderFactory: () => RecorderLike) {}

  async listen(): Promise<SpeechResult> {
    const recorder = this.recorderFactory();
    this.recorder = recorder;
    const done = new Promise<string>((resolve) => {
      this.stopRequested = resolve;
    });
    await recorder.start();
    const audioUrl = await done;
    return { kind: 'recording', audioUrl };
  }

  async stop(): Promise<void> {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = undefined;
    const url = await recorder.stop();
    this.stopRequested?.(url);
  }
}

// ---- Mock ------------------------------------------------------------------------------

export class MockSpeechInput implements SpeechInput {
  private queue: SpeechResult[];
  constructor(
    readonly mode: SpeechInputMode,
    results: SpeechResult[] = [],
  ) {
    this.queue = [...results];
  }
  async listen(): Promise<SpeechResult> {
    const next = this.queue.shift();
    if (!next) throw new Error('MockSpeechInput: no scripted result');
    return next;
  }
  async stop(): Promise<void> {}
}

// ---- Selection -------------------------------------------------------------------------

export interface CreateSpeechInputOptions {
  language: AudioLanguage;
  script: Settings['script'];
  env: SpeechEnv;
  recorderFactory: () => RecorderLike;
}

/** Live recognition when the browser and language support it, else record/self-grade. */
export function createSpeechInput(opts: CreateSpeechInputOptions): SpeechInput {
  const Ctor = detectSpeechRecognition(opts.env);
  const locale = recognitionLocale(opts.language, opts.script);
  if (Ctor && locale) return new WebSpeechInput(Ctor, locale);
  return new RecordSelfGradeInput(opts.recorderFactory);
}
