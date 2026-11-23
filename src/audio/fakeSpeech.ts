import type { SynthLike, SynthVoiceLike, UtteranceLike } from './browser';

/**
 * A fake `speechSynthesis` for tests. Utterances queue like the real thing: `finishCurrent()`
 * fires `onend` for the one being spoken, `cancel()` fires `onerror('canceled')` for all pending.
 */
export class FakeSpeechSynthesis implements SynthLike {
  voices: SynthVoiceLike[];
  spoken: UtteranceLike[] = [];
  cancelCount = 0;
  private queue: UtteranceLike[] = [];
  private listeners = new Set<() => void>();

  constructor(voices: SynthVoiceLike[] = []) {
    this.voices = voices;
  }

  getVoices(): SynthVoiceLike[] {
    return this.voices;
  }

  speak(u: UtteranceLike): void {
    this.spoken.push(u);
    this.queue.push(u);
    if (this.queue.length === 1) u.onstart?.();
  }

  cancel(): void {
    this.cancelCount += 1;
    const pending = this.queue;
    this.queue = [];
    for (const u of pending) u.onerror?.({ error: 'canceled' });
  }

  addEventListener(_type: 'voiceschanged', l: () => void): void {
    this.listeners.add(l);
  }

  removeEventListener(_type: 'voiceschanged', l: () => void): void {
    this.listeners.delete(l);
  }

  /** Simulate the browser finishing the utterance currently being spoken. */
  finishCurrent(): void {
    const u = this.queue.shift();
    if (!u) return;
    u.onend?.();
    this.queue[0]?.onstart?.();
  }

  /** Simulate voices arriving late (Chrome loads them asynchronously). */
  setVoices(voices: SynthVoiceLike[]): void {
    this.voices = voices;
    for (const l of [...this.listeners]) l();
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

export function fakeUtteranceFactory(text: string): UtteranceLike {
  return { text, lang: '', rate: 1, voice: null };
}
