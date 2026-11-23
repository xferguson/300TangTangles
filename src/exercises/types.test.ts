import { describe, expectTypeOf, it } from 'vitest';
import type { ClozeExercise, Exercise, ExerciseResult, Poem, Settings } from '../core';
import type { ExerciseProps } from './types';

describe('ExerciseProps', () => {
  it('has the contract shape', () => {
    type P = ExerciseProps<ClozeExercise>;
    expectTypeOf<P['exercise']>().toEqualTypeOf<ClozeExercise>();
    expectTypeOf<P['poem']>().toEqualTypeOf<Poem>();
    expectTypeOf<P['settings']>().toEqualTypeOf<Settings>();
    expectTypeOf<P['onComplete']>().toEqualTypeOf<(result: ExerciseResult) => void>();
    expectTypeOf<P['playAudio']>().toEqualTypeOf<
      ((text: string, opts?: { slow?: boolean }) => void) | undefined
    >();
  });

  it('only accepts Exercise subtypes', () => {
    expectTypeOf<ExerciseProps<Exercise>['exercise']>().toEqualTypeOf<Exercise>();
  });
});
