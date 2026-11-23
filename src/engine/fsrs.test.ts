import { describe, expect, it } from 'vitest';

import { isDue, newCard, retrievability, scheduleCard } from './fsrs';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const days = (d: number) => new Date(T0.getTime() + d * 86_400_000);

describe('engine FSRS scheduler', () => {
  it('creates a due new card', () => {
    const c = newCard(T0);
    expect(c.state).toBe(0);
    expect(c.reps).toBe(0);
    expect(c.lastReview).toBeNull();
    expect(isDue(c, T0)).toBe(true);
  });

  it('schedules a first review into the future, longer for better ratings', () => {
    const due = (r: 'again' | 'hard' | 'good' | 'easy') =>
      new Date(scheduleCard(newCard(T0), r, T0).due).getTime();
    expect(due('again')).toBeGreaterThan(T0.getTime());
    expect(due('hard')).toBeLessThanOrEqual(due('good'));
    expect(due('good')).toBeLessThan(due('easy'));
    const c = scheduleCard(newCard(T0), 'good', T0);
    expect(c.reps).toBe(1);
    expect(c.lastReview).toBe(T0.toISOString());
    expect(c.stability).toBeGreaterThan(0);
    expect(c.difficulty).toBeGreaterThanOrEqual(1);
    expect(c.difficulty).toBeLessThanOrEqual(10);
    expect(isDue(c, T0)).toBe(false);
  });

  it('grows the interval on repeated successes (on time)', () => {
    let c = scheduleCard(newCard(T0), 'good', T0);
    let prev = c.stability;
    for (let i = 0; i < 4; i++) {
      c = scheduleCard(c, 'good', new Date(c.due));
      expect(c.stability).toBeGreaterThan(prev);
      prev = c.stability;
    }
    expect(c.state).toBe(2);
  });

  it('a lapse counts, drops stability and enters relearning', () => {
    let c = scheduleCard(newCard(T0), 'good', T0);
    c = scheduleCard(c, 'good', new Date(c.due));
    const before = c.stability;
    const lapsed = scheduleCard(c, 'again', new Date(c.due));
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe(3);
    expect(lapsed.stability).toBeLessThan(before);
  });

  it('retrievability decays with time and is 1 right after a review', () => {
    const c = scheduleCard(newCard(T0), 'good', T0);
    expect(retrievability(c, T0)).toBeCloseTo(1, 5);
    expect(retrievability(c, days(30))).toBeLessThan(retrievability(c, days(3)));
    expect(retrievability(newCard(T0), T0)).toBe(0);
  });

  it('is pure: does not mutate its input', () => {
    const c = newCard(T0);
    const copy = structuredClone(c);
    scheduleCard(c, 'easy', T0);
    expect(c).toEqual(copy);
  });
});
