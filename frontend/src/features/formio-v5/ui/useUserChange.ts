'use client';

import { useCallback, useMemo, useRef } from 'react';

/**
 * Tells the user's changes to a Form.io form from those Form.io makes itself. Form.io changes the
 * answers itself as they load, and leaves `modified` off for some real edits, such as removing a
 * grid row, so neither the flag nor a comparison with the loaded answers says what the user
 * changed. A change counts once the user has acted in the form.
 */
export function useUserChange() {
  const touched = useRef(false);
  // The answers at Form.io's last change, so a change that leaves them as they were is not an edit.
  const lastAnswers = useRef<string | null>(null);
  const markTouched = useCallback(() => {
    touched.current = true;
  }, []);
  /** For the element around the form. */
  const touchProps = useMemo(
    () => ({ onPointerDownCapture: markTouched, onKeyDownCapture: markTouched }),
    [markTouched],
  );
  /** Records the loaded answers, for a form that reports no change as they load. */
  const noteAnswers = useCallback((data: unknown) => {
    lastAnswers.current = JSON.stringify(data ?? null);
  }, []);
  /** Whether a change Form.io reports is the user's. Call it for every change, to track the answers. */
  const isUserChange = useCallback(
    (value: { data?: unknown } | undefined, flags: unknown, modified: boolean) => {
      const answers = JSON.stringify(value?.data ?? null);
      const unchanged = answers === lastAnswers.current;
      lastAnswers.current = answers;
      if (modified) return true;
      // The answers loading, which a click while the form loads would otherwise count.
      if ((flags as { fromSubmission?: boolean } | undefined)?.fromSubmission) return false;
      // Form.io's own change on blur, such as Validate On: Blur, leaves the answers as they were.
      if (unchanged) return false;
      return touched.current;
    },
    [],
  );
  return { touchProps, isUserChange, noteAnswers };
}
