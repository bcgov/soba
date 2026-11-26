'use client';

import { checkFormName, checkNewFormName } from '@/src/shared/api/sobaApiDesign';
import { useNameCheck, type NameCheck, type NameCheckLabels } from '@/src/shared/api/useNameCheck';

/**
 * A new form's name, checked as it is typed in the workspace it would be created in. Names are
 * unique within a workspace, so there is nothing to check until one is picked.
 */
export function useNewFormNameCheck(
  name: string,
  workspaceId: string | null,
  labels: NameCheckLabels,
): NameCheck {
  return useNameCheck({
    name,
    scope: workspaceId ? ['new-form', workspaceId] : null,
    check: (token, checked) =>
      checkNewFormName(token, { workspaceId: workspaceId!, name: checked }),
    labels,
  });
}

/**
 * A form's new name, checked as it is typed against the other forms in its workspace. Its own name
 * doesn't count against it, so only a changed name is checked, once the form has loaded.
 */
export function useFormRenameCheck(
  name: string,
  formId: string,
  savedName: string | undefined,
  labels: NameCheckLabels,
): NameCheck {
  return useNameCheck({
    name,
    scope: savedName === undefined ? null : ['form-rename', formId],
    savedName,
    check: (token, checked) => checkFormName(token, formId, checked),
    labels,
  });
}
