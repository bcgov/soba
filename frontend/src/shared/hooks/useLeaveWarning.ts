'use client';

import { useCallback, useEffect, useRef } from 'react';

const noop = () => undefined;

/**
 * Has the browser confirm a refresh or close while `active`. In-app links are not covered.
 * Returns `release`, which lets the next unload through at once: a leave the person has already
 * agreed to, such as logout, navigates before the re-render that would turn the warning off.
 */
export function useLeaveWarning(active: boolean): () => void {
  const releaseRef = useRef<() => void>(noop);

  useEffect(() => {
    if (!active) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const remove = () => window.removeEventListener('beforeunload', warn);
    window.addEventListener('beforeunload', warn);
    releaseRef.current = remove;
    return () => {
      remove();
      releaseRef.current = noop;
    };
  }, [active]);

  return useCallback(() => releaseRef.current(), []);
}
