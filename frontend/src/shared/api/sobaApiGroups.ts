import type { SortLocale } from '@soba/lib/sort';
import { sobaFetch } from './sobaFetch';
import { sortLocaleRequest } from './sortLocaleRequest';
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
  locale?: SortLocale,
): Promise<SubmitterAudience> {
  const response = await sobaFetch(`/workspaces/${workspaceId}/submitter-audience`, {
    token,
    ...sortLocaleRequest(locale),
  });
  return parseJson(response);
}

export async function setSubmitterAudience(
  token: string,
  workspaceId: string,
  body: SetSubmitterAudienceBody,
  locale?: SortLocale,
): Promise<SubmitterAudience> {
  const response = await sobaFetch(`/workspaces/${workspaceId}/submitter-audience`, {
    token,
    method: 'PUT',
    json: body,
    ...sortLocaleRequest(locale),
  });
  return parseJson(response);
}

export async function getFormSubmitterAudience(
  token: string,
  formId: string,
  locale?: SortLocale,
): Promise<FormSubmitterAudience> {
  const response = await sobaFetch(`/design/forms/${formId}/submitter-audience`, {
    token,
    ...sortLocaleRequest(locale),
  });
  return parseJson(response);
}

export async function setFormSubmitterAudience(
  token: string,
  formId: string,
  body: SetFormSubmitterAudienceBody,
  locale?: SortLocale,
): Promise<FormSubmitterAudience> {
  const response = await sobaFetch(`/design/forms/${formId}/submitter-audience`, {
    token,
    method: 'PUT',
    json: body,
    ...sortLocaleRequest(locale),
  });
  return parseJson(response);
}
