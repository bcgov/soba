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
  const markTouched = useCallback(() => {
    touched.current = true;
  }, []);
  /** For the element around the form. */
  const touchProps = useMemo(
    () => ({ onPointerDownCapture: markTouched, onKeyDownCapture: markTouched }),
    [markTouched],
  );
  /** Whether a change Form.io reports, with its `modified` flag, is the user's. */
  const isUserChange = useCallback((modified: boolean) => modified || touched.current, []);
  return { touchProps, isUserChange };
}
