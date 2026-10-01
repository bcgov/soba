import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { ApiError, parseJson } from '@/src/shared/api/sobaHelpers';
import type { TemplateListResponse, TemplateResponse } from '@/src/types/templates';

const TEMPLATES_PATH = '/templates';
const templatePath = (templateId: string) => `${TEMPLATES_PATH}/${templateId}`;

/** The templates on a form version, by name. */
export async function listTemplates(
  token: string,
  formVersionId: string,
): Promise<TemplateListResponse> {
  const response = await sobaFetch(TEMPLATES_PATH, { token, query: { formVersionId } });
  return parseJson(response);
}

export async function uploadTemplate(
  token: string,
  formVersionId: string,
  name: string,
  file: File,
): Promise<TemplateResponse> {
  const form = new FormData();
  form.set('name', name);
  form.set('file', file);
  const response = await sobaFetch(TEMPLATES_PATH, {
    token,
    method: 'POST',
    query: { formVersionId },
    form,
  });
  return parseJson(response);
}

export async function deleteTemplate(token: string, templateId: string): Promise<void> {
  const response = await sobaFetch(templatePath(templateId), { token, method: 'DELETE' });
  if (!response.ok) throw new ApiError(`Request failed (${response.status})`, response.status);
}

/** The template's file. The caller owns the blob. */
export async function downloadTemplate(token: string, templateId: string): Promise<Blob> {
  const response = await sobaFetch(`${templatePath(templateId)}/content`, { token });
  if (!response.ok) throw new ApiError(`Request failed (${response.status})`, response.status);
  return response.blob();
}
