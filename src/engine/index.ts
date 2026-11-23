/**
 * Public API of the session engine (T34). Import the engine from here; the distractor generator
 * (T33) stays importable from `src/engine/distractors`.
 */
export { applyResult, FINAL_ACCURACY } from './apply';
export { nextExercise } from './next';
export {
  PASS,
  READY_LEVEL,
  computeRank,
  fadeLevels,
  initialProgress,
  isLineMastered,
  isLineReady,
  isUnitReady,
  lineFade,
  lineRecognition,
  lineUnits,
  refreshRecognition,
  sealsFor,
  unitScore,
} from './mastery';
export { makeExerciseId, parseExerciseId, type ParsedExerciseId } from './ids';
export {
  getReviewCard,
  isReviewDue,
  isReviewKey,
  ratingFor,
  recordReview,
  reviewKey,
} from './review';
export { isDue, newCard, retrievability, scheduleCard } from './fsrs';
