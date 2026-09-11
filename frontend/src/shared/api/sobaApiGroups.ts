import { sobaFetch } from './sobaFetch';
import { parseJson } from './sobaHelpers';
import type { SubmitterAudience, SetSubmitterAudienceBody } from '../../types/groups';

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
