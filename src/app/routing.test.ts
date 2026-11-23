import { describe, expect, it } from 'vitest';
import { assertUniquePaths, matchRoute, type RouteDef } from './routing';

const Stub = () => null;
const routes: RouteDef[] = [
  { path: '#/library', title: 'Library', Component: Stub },
  { path: '#/library/archive', title: 'Archive', Component: Stub },
  { path: '#/ui', title: 'UI', Component: Stub },
];

describe('matchRoute', () => {
  it('matches an exact hash', () => {
    expect(matchRoute(routes, '#/ui')?.title).toBe('UI');
  });

  it('matches when the route path is a "/"-prefix of the hash', () => {
    expect(matchRoute(routes, '#/library/jing-ye-si')?.title).toBe('Library');
  });

  it('prefers the longest matching route', () => {
    expect(matchRoute(routes, '#/library/archive/x')?.title).toBe('Archive');
  });

  it('does not match a path that is only a string prefix', () => {
    expect(matchRoute(routes, '#/library-extra')).toBeNull();
    expect(matchRoute(routes, '#/uikit')).toBeNull();
  });

  it('returns null for unknown or empty hashes (home shell)', () => {
    expect(matchRoute(routes, '')).toBeNull();
    expect(matchRoute(routes, '#/nowhere')).toBeNull();
  });

  it('never matches two routes to the same hash: result is a single route', () => {
    const hash = '#/library/archive';
    const matched = routes.filter((r) => matchRoute([r], hash));
    expect(matched.length).toBe(2); // both are prefixes…
    expect(matchRoute(routes, hash)).toBe(routes[1]); // …but exactly one wins
  });
});

describe('assertUniquePaths', () => {
  it('passes for distinct paths', () => {
    expect(() => assertUniquePaths(routes)).not.toThrow();
  });

  it('throws when two routes share a path', () => {
    expect(() =>
      assertUniquePaths([...routes, { path: '#/ui', title: 'Dup', Component: Stub }]),
    ).toThrow(/#\/ui/);
  });
});
