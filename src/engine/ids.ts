/**
 * Exercise ids carry what the engine needs to read a result back: `poemId:seq:kind:line:unit`.
 * `seq` is the position in the session, so ids are unique within a session and deterministic.
 */
import type { ExerciseKind, UnitId } from '../core/types';

export interface ParsedExerciseId {
  poemId: string;
  seq: number;
  kind: ExerciseKind | null;
  /** Line the exercise is about, or `null` (whole-poem recitation, unparseable id). */
  line: number | null;
  /** Unit a flashcard is about. */
  unit: UnitId | null;
}

export function makeExerciseId(
  poemId: string,
  seq: number,
  kind: ExerciseKind,
  line: number | null,
  unit?: UnitId,
): string {
  return [poemId, seq, kind, line ?? '-', unit ?? ''].join(':');
}

export function parseExerciseId(id: string): ParsedExerciseId {
  const [poemId = '', seq = '0', kind = '', line = '-', unit = ''] = id.split(':');
  const n = Number(line);
  return {
    poemId,
    seq: Number(seq) || 0,
    kind: kind === '' ? null : (kind as ExerciseKind),
    line: line === '-' || Number.isNaN(n) ? null : n,
    unit: unit === '' ? null : unit,
  };
}
