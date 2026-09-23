import { useMemo } from 'react';
import { useSWRConfig } from 'swr';
import {
  getFormSubmitterAudience,
  getSubmitterAudience,
  setFormSubmitterAudience,
  setSubmitterAudience,
} from '@/src/shared/api/sobaApiGroups';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import type {
  AudienceMode,
  FormSubmitterAudience,
  SetFormSubmitterAudienceBody,
  SubmitterAudience,
} from '@/src/types/groups';

const WORKSPACE_AUDIENCE_KEY = 'submitter-audience';
const FORM_AUDIENCE_KEY = 'form-submitter-audience';

/** An audience as the control shows it, for a workspace or for one form. */
export interface AudienceView {
  /** Whether the form inherits the workspace audience; null for the workspace itself. */
  inherit: boolean | null;
  mode: AudienceMode;
  idps: string[];
  users: SubmitterAudience['users'];
  available: SubmitterAudience['available'];
  /** The workspace audience a form inherits; null for the workspace itself. */
  workspace: FormSubmitterAudience['workspace'] | null;
}

const fromWorkspace = (audience: SubmitterAudience): AudienceView => ({
  inherit: null,
  mode: audience.mode,
  idps: audience.idps,
  users: audience.users,
  available: audience.available,
  workspace: null,
});

// A form override holds providers only, so named people appear only while the form inherits.
const fromForm = (audience: FormSubmitterAudience): AudienceView => ({
  inherit: audience.inherit,
  mode: audience.mode,
  idps: audience.idps,
  users: audience.inherit ? audience.workspace.users : [],
  available: audience.available,
  workspace: audience.workspace,
});

/** The submitter audience of a form when `formId` is given, otherwise of the workspace. */
export function useSubmitterAudience(workspaceId: string | null, formId?: string) {
  const { mutate: globalMutate } = useSWRConfig();
  const workspaceRead = useAuthedSWR<SubmitterAudience>(
    !formId && workspaceId ? [WORKSPACE_AUDIENCE_KEY, workspaceId] : null,
    (token) => getSubmitterAudience(token, workspaceId as string),
  );
  const formRead = useAuthedSWR<FormSubmitterAudience>(
    formId ? [FORM_AUDIENCE_KEY, formId] : null,
    (token) => getFormSubmitterAudience(token, formId as string),
  );

  const formData = formRead.data;
  const workspaceData = workspaceRead.data;
  const view = useMemo(() => {
    if (formId) return formData && fromForm(formData);
    return workspaceData && fromWorkspace(workspaceData);
  }, [formId, formData, workspaceData]);

  const save = async (token: string, body: SetFormSubmitterAudienceBody): Promise<void> => {
    if (formId) {
      await formRead.mutate(setFormSubmitterAudience(token, formId, body), { revalidate: false });
      return;
    }
    if (!workspaceId || body.mode === 'inherit') {
      throw new Error('A workspace audience has nothing to inherit from');
    }
    await workspaceRead.mutate(setSubmitterAudience(token, workspaceId, body), {
      revalidate: false,
    });
    // Forms that inherit carry a copy of the workspace audience. Dropping the cached copies, not only
    // revalidating, also covers a form whose control is not mounted: it reloads rather than showing
    // the old audience when it next opens.
    await globalMutate((key) => Array.isArray(key) && key[0] === FORM_AUDIENCE_KEY, undefined, {
      revalidate: true,
    });
  };

  const rawError = formId ? formRead.error : workspaceRead.error;
  return { view, error: rawError ? classifyDataError(rawError) : null, save };
}

/** A hook to update a form's submitter audience without a pre-existing formId. */
export function useFormAudienceWriter() {
  const saveFormAudience = async (
    token: string,
    formId: string,
    body: SetFormSubmitterAudienceBody,
  ): Promise<void> => {
    await setFormSubmitterAudience(token, formId, body);
  };

  return { saveFormAudience };
}
