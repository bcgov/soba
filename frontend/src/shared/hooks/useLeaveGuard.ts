'use client';

import { useEffect, useRef } from 'react';
import { useLeaveWarning } from './useLeaveWarning';

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
  if (to.pathname === window.location.pathname && to.search === window.location.search) {
    return null;
  }
  return anchor;
}

/**
 * While `active`, asks `onLeave` before the page is left: by an in-app link such as the side
 * navigation, or by anything that calls requestLeave. A refresh, a close or a typed URL get the
 * browser's own prompt instead, which a page cannot replace. The browser's Back is not covered.
 */
export function useLeaveGuard(active: boolean, onLeave: LeaveHandler) {
  useLeaveWarning(active);

  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });

  useEffect(() => {
    if (!active) return undefined;
    const handler: LeaveHandler = (proceed) => onLeaveRef.current(proceed);
    // Set while a link the person agreed to leave by is followed, so its own click goes through.
    let following = false;

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
    return () => {
      document.removeEventListener('click', onClick, true);
      if (activeHandler === handler) activeHandler = null;
    };
  }, [active]);
}
