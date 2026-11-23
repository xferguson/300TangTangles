import type { ComponentType } from 'react';

export interface RouteDef {
  /** Hash path, e.g. `#/library`. Also matches `#/library/…`. */
  path: string;
  title: string;
  Component: ComponentType;
}

/** Longest route whose path equals the hash or is a "/"-prefix of it; `null` → home shell. */
export function matchRoute(routes: readonly RouteDef[], hash: string): RouteDef | null {
  let best: RouteDef | null = null;
  for (const r of routes) {
    const hit = hash === r.path || hash.startsWith(r.path + '/');
    if (hit && (!best || r.path.length > best.path.length)) best = r;
  }
  return best;
}

export function assertUniquePaths(routes: readonly RouteDef[]): void {
  const seen = new Set<string>();
  for (const r of routes) {
    if (seen.has(r.path)) throw new Error(`Duplicate route path: ${r.path}`);
    seen.add(r.path);
  }
}
