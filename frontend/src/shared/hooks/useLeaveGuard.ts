'use client';

import { useEffect, useRef } from 'react';
import { useLeaveWarning } from './useLeaveWarning';

// The parts of the Navigation API used here; TypeScript's DOM types do not include it yet.
type Navigation = EventTarget & { traverseTo: (key: string) => { finished: Promise<unknown> } };
type NavigateEvent = Event & { navigationType: string; destination: { key: string; url: string } };

const browserNavigation = () => (window as { navigation?: Navigation }).navigation;

/** Asks whether to go ahead with a navigation; calls `proceed` only if the person agrees. */
export type LeaveHandler = (proceed: () => void) => void;

// One page holds unsaved work at a time, so one handler stands for all of them.
let activeHandler: LeaveHandler | null = null;

/**
 * Run a navigation that leaves the page, such as a router push, once the page holding unsaved work
 * agrees. With nothing unsaved it runs at once.
 */
export function requestLeave(proceed: () => void): void {
  if (activeHandler) activeHandler(proceed);
  else proceed();
}

/** Whether `url` is this page, so going there keeps it. */
const isThisPage = (url: URL) =>
  url.pathname === window.location.pathname && url.search === window.location.search;

/** The link a click would follow inside the app, or null for one the browser should handle. */
function inAppLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  // A modifier opens a new tab or window, which leaves this page as it is.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.hasAttribute('download')) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  const to = new URL(anchor.href, window.location.href);
  if (to.origin !== window.location.origin) return null;
  // A jump within the page keeps it.
  if (isThisPage(to)) return null;
  return anchor;
}

/**
 * While `active`, asks `onLeave` before the page is left: by an in-app link such as the side
 * navigation, by the browser's Back or Forward where the browser lets the page cancel it, or by
 * anything that calls requestLeave. A refresh, a close or a typed URL get the browser's own prompt
 * instead, which a page cannot replace.
 */
export function useLeaveGuard(active: boolean, onLeave: LeaveHandler) {
  const releaseWarning = useLeaveWarning(active);

  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });

  useEffect(() => {
    if (!active) return undefined;
    // Once the person agrees, the browser is not asked again on the way out.
    const handler: LeaveHandler = (proceed) =>
      onLeaveRef.current(() => {
        releaseWarning();
        proceed();
      });
    // Set while a link the person agreed to leave by is followed, so its own click goes through.
    let following = false;

    // Set while a Back or Forward the person agreed to is under way, so it is not held again.
    let traversing = false;
    const holdBackAgain = () => {
      traversing = false;
    };
    const navigation = browserNavigation();

    // Without a new click or key press the next Back is not cancelable, so the person can always leave.
    const onNavigate = (event: Event) => {
      const { navigationType, destination } = event as NavigateEvent;
      if (traversing || navigationType !== 'traverse' || !event.cancelable) return;
      if (isThisPage(new URL(destination.url))) return;
      event.preventDefault();
      handler(() => {
        traversing = true;
        navigation?.traverseTo(destination.key).finished.catch(holdBackAgain);
      });
    };

    const onClick = (event: MouseEvent) => {
      if (following) return;
      const anchor = inAppLink(event);
      if (!anchor) return;
      // Captured on the document, so neither the browser nor the link's own handler sees it.
      event.preventDefault();
      event.stopPropagation();
      handler(() => {
        following = true;
        try {
          anchor.click();
        } finally {
          following = false;
        }
      });
    };

    activeHandler = handler;
    document.addEventListener('click', onClick, true);
    navigation?.addEventListener('navigate', onNavigate);
    return () => {
      document.removeEventListener('click', onClick, true);
      navigation?.removeEventListener('navigate', onNavigate);
      if (activeHandler === handler) activeHandler = null;
    };
  }, [active, releaseWarning]);
}
