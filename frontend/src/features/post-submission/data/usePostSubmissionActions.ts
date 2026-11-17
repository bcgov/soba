import { useId } from 'react';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import { getFormSettings, getWorkspaceSettings } from '@/src/features/form-settings/data/api';
import {
  POST_SUBMISSION_SETTINGS_KEY,
  type PostSubmissionFormActionList,
  type PostSubmissionWorkspaceActionList,
} from '@/src/types/postSubmission';

// Each mount reads the list anew: which actions show depends on features an administrator can
// change at any time.

/**
 * The post-submission actions a form can set, and whether its workspace can set each. Nothing is
 * read while `enabled` is false, such as where post-submission is off.
 */
export function useFormPostSubmissionActions(formId: string, enabled = true) {
  const readId = useId();
  const { data, error } = useAuthedSWR<PostSubmissionFormActionList>(
    enabled ? ['post-submission-actions', 'form', formId, readId] : null,
    (token) => getFormSettings(token, formId, POST_SUBMISSION_SETTINGS_KEY),
    sessionReadConfig,
  );
  return { actions: data?.actions, error: error ? classifyDataError(error) : null };
}

/** The post-submission actions a workspace can set for its forms; nothing is read until `enabled`. */
export function useWorkspacePostSubmissionActions(workspaceId: string, enabled = true) {
  const readId = useId();
  const { data, error } = useAuthedSWR<PostSubmissionWorkspaceActionList>(
    enabled ? ['post-submission-actions', 'workspace', workspaceId, readId] : null,
    (token) => getWorkspaceSettings(token, workspaceId, POST_SUBMISSION_SETTINGS_KEY),
    sessionReadConfig,
  );
  return { actions: data?.actions, error: error ? classifyDataError(error) : null };
}
