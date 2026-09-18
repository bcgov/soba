import { sobaFetch } from './sobaFetch';
import { parseJson } from './sobaHelpers';
import type {
  FormSubmitterAudience,
  SetFormSubmitterAudienceBody,
  SubmitterAudience,
  SetSubmitterAudienceBody,
} from '../../types/groups';

export async function getSubmitterAudience(
  token: string,
  workspaceId: string,
): Promise<SubmitterAudience> {
  const response = await sobaFetch(`/workspaces/${workspaceId}/submitter-audience`, { token });
  return parseJson(response);
}

export async function setSubmitterAudience(
  token: string,
  workspaceId: string,
  body: SetSubmitterAudienceBody,
): Promise<SubmitterAudience> {
  const response = await sobaFetch(`/workspaces/${workspaceId}/submitter-audience`, {
    token,
    method: 'PUT',
    json: body,
  });
  return parseJson(response);
}

export async function getFormSubmitterAudience(
  token: string,
  formId: string,
): Promise<FormSubmitterAudience> {
  const response = await sobaFetch(`/design/forms/${formId}/submitter-audience`, { token });
  return parseJson(response);
}

export async function setFormSubmitterAudience(
  token: string,
  formId: string,
  body: SetFormSubmitterAudienceBody,
): Promise<FormSubmitterAudience> {
  const response = await sobaFetch(`/design/forms/${formId}/submitter-audience`, {
    token,
    method: 'PUT',
    json: body,
  });
  return parseJson(response);
}
