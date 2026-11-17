'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// The parts of the Navigation API used here; TypeScript's DOM types do not include it yet.
type Navigation = EventTarget & { traverseTo: (key: string) => unknown };
type NavigateEvent = Event & { navigationType: string; destination: { key: string } };

/** Where a held leave goes: an in-app link, or a Back or Forward history entry. */
type Leaving = { href: string } | { key: string };

const browserNavigation = () => (window as { navigation?: Navigation }).navigation;

/** The in-app page a plain click on a link would leave to, or null for one that stays or opens elsewhere. */
const linkDestination = (event: MouseEvent): string | null => {
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (link.target || link.hasAttribute('download')) return null;
  const url = new URL(link.href);
  // A query-only change, such as a tab, stays on the page and keeps the edits.
  if (url.origin !== location.origin || url.pathname === location.pathname) return null;
  return url.pathname + url.search + url.hash;
};

/**
 * While `active`, has the browser confirm a refresh or close, and holds a click on an in-app link to
 * another page, or a Back or Forward the browser lets the page cancel, until `leave` or `stay`.
 */
export function useLeaveWarning(active: boolean) {
  const router = useRouter();
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  // Set by `leave`, so its own traversal is not held as well.
  const traversing = useRef(false);

  useEffect(() => {
    if (!active) return undefined;
    traversing.current = false;
    const navigation = browserNavigation();
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const holdLink = (event: MouseEvent) => {
      const href = linkDestination(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving({ href });
    };
    // Without a new click or key press, the next Back is not cancelable, so the user can always get out.
    const holdTraverse = (event: Event) => {
      const { navigationType, destination } = event as NavigateEvent;
      if (navigationType !== 'traverse' || !event.cancelable || traversing.current) return;
      event.preventDefault();
      setLeaving({ key: destination.key });
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', holdLink, true);
    navigation?.addEventListener('navigate', holdTraverse);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', holdLink, true);
      navigation?.removeEventListener('navigate', holdTraverse);
      setLeaving(null);
    };
  }, [active]);

  const leave = () => {
    if (!leaving) return;
    if ('href' in leaving) {
      router.push(leaving.href);
      return;
    }
    traversing.current = true;
    browserNavigation()?.traverseTo(leaving.key);
  };

  return { leaving: leaving !== null, leave, stay: () => setLeaving(null) };
}
