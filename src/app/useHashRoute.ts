import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current location hash, e.g. `#/ui`. Routing is hash-based so GitHub Pages deep links work. */
export function useHashRoute() {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}
