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
  carried = false,
}: Readonly<{
  canWrite: boolean;
  nothingSaved: boolean;
  /** Answers typed on an older version of the form and carried here, so already edited. */
  carried?: boolean;
}>) {
  const { touchProps, isUserChange } = useUserChange();
  const edits = useRef(carried ? 1 : 0);
  const savedEdits = useRef(0);
  const saved = useRef(!nothingSaved);
  const echoUntil = useRef(0);
  // The answers at Form.io's last change, so a change that leaves them as they were is not an edit.
  const lastAnswers = useRef<string | null>(null);
  const [unsaved, setUnsaved] = useState(nothingSaved);
  // Edits not yet held by an applied save; unlike `unsaved`, false on a blank new form.
  const [edited, setEdited] = useState(canWrite && carried);

  const markEdited = useCallback(() => {
    if (!canWrite) return;
    edits.current += 1;
    setUnsaved(true);
    setEdited(true);
  }, [canWrite]);

  const onInputCapture = useCallback(() => {
    echoUntil.current = Date.now() + ECHO_MS;
    markEdited();
  }, [markEdited]);

  const onFormChange = useCallback(
    (value: { data?: unknown } | undefined, _flags: unknown, modified: boolean) => {
      const answers = JSON.stringify(value?.data ?? null);
      const unchanged = answers === lastAnswers.current;
      lastAnswers.current = answers;
      if (Date.now() < echoUntil.current) {
        echoUntil.current = 0;
        return;
      }
      // Form.io's own change on blur, such as Validate On: Blur, leaves the answers as they were.
      if (!modified && unchanged) return;
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
      setEdited(edits.current > editsSaved);
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

  return { unsaved, edited, isUnsaved, beginSave, onFormChange, formProps };
}
