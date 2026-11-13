'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useUserChange } from './useUserChange';

// Form.io reports a field's change 100ms after its input.
const ECHO_MS = 500;

/**
 * The user's edits to a fill form against its last applied save. Typing counts from its input
 * event, so a Print right after it sees the edit; the change Form.io reports for that input a moment
 * later is the same edit, so it is skipped once.
 */
export function useUnsavedEdits({
  canWrite,
  nothingSaved,
}: Readonly<{ canWrite: boolean; nothingSaved: boolean }>) {
  const { touchProps, isUserChange } = useUserChange();
  const edits = useRef(0);
  const savedEdits = useRef(0);
  const saved = useRef(!nothingSaved);
  const echoUntil = useRef(0);
  const [unsaved, setUnsaved] = useState(nothingSaved);

  const markEdited = useCallback(() => {
    if (!canWrite) return;
    edits.current += 1;
    setUnsaved(true);
  }, [canWrite]);

  const onInputCapture = useCallback(() => {
    echoUntil.current = Date.now() + ECHO_MS;
    markEdited();
  }, [markEdited]);

  const onFormChange = useCallback(
    (_value: unknown, _flags: unknown, modified: boolean) => {
      if (Date.now() < echoUntil.current) {
        echoUntil.current = 0;
        return;
      }
      if (isUserChange(modified)) markEdited();
    },
    [isUserChange, markEdited],
  );

  /** Notes the edits a save holds as it reads the answers; call the result once it is applied. */
  const beginSave = useCallback(() => {
    const editsSaved = edits.current;
    return () => {
      saved.current = true;
      savedEdits.current = editsSaved;
      setUnsaved(edits.current > editsSaved);
    };
  }, []);

  /** Read when a print runs, not from the last render. A caller who cannot write has none. */
  const isUnsaved = useCallback(
    () => canWrite && (!saved.current || edits.current > savedEdits.current),
    [canWrite],
  );

  /** For the element around the form. */
  const formProps = useMemo(
    () => ({ ...touchProps, onInputCapture }),
    [touchProps, onInputCapture],
  );

  return { unsaved, isUnsaved, beginSave, onFormChange, formProps };
}
