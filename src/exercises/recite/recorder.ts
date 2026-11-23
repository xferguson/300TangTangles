import type { RecorderLike } from '../../speech';

/**
 * Browser microphone recorder for the record, playback, self-grade fallback. `start()` rejects when
 * there is no microphone, no `MediaRecorder`, or permission is denied; the exercise then drops to
 * manual self-grading, so a learner is never stuck.
 */
export function createBrowserRecorder(): RecorderLike {
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  const chunks: Blob[] = [];
  return {
    async start() {
      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('recording is not supported here');
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.start();
    },
    stop() {
      return new Promise<string>((resolve, reject) => {
        const r = recorder;
        if (!r) return reject(new Error('not recording'));
        r.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop());
          resolve(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })));
        };
        r.stop();
      });
    },
  };
}
