import type { Exercise, ExerciseResult, Poem, Settings } from '../core';

/**
 * Props every exercise component takes. Each exercise emits exactly one `ExerciseResult`
 * through `onComplete` when the learner finishes.
 *
 * No barrel files: do not add an `index.ts` that re-exports exercises or screens (they become
 * merge-conflict hotspots). Import directly from each folder, e.g. `../exercises/cloze/Cloze`.
 */
export interface ExerciseProps<E extends Exercise> {
  exercise: E;
  poem: Poem;
  settings: Settings;
  /** Speak `text` in the audio language; absent when audio is unavailable. */
  playAudio?: (text: string, opts?: { slow?: boolean }) => void;
  onComplete: (result: ExerciseResult) => void;
}
