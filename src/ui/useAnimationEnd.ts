import { useEffect, type RefObject } from 'react';

/**
 * Call `onEnd` when a CSS animation on `ref` finishes, while `active`.
 * Uses a native listener: React maps onAnimationEnd to a vendor-prefixed event in some environments.
 */
export function useAnimationEnd(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEnd: (() => void) | undefined,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active || !onEnd) return;
    el.addEventListener('animationend', onEnd);
    return () => el.removeEventListener('animationend', onEnd);
  }, [ref, active, onEnd]);
}
