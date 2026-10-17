import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { ApiError, parseJson } from '@/src/shared/api/sobaHelpers';

/** A template the caller may render from a submission. */
export type SubmissionTemplate = {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
};

const submissionPath = (submissionId: string) => `/submit/submissions/${submissionId}`;

async function documentBlob(response: Response): Promise<Blob> {
  if (!response.ok) throw new ApiError(`Request failed (${response.status})`, response.status);
  return response.blob();
}

/** The templates the caller may render from the submission. The token is optional (anonymous). */
export async function listSubmissionTemplates(
  token: string | undefined,
  submissionId: string,
): Promise<SubmissionTemplate[]> {
  const response = await sobaFetch(`${submissionPath(submissionId)}/templates`, { token });
  return (await parseJson<{ items: SubmissionTemplate[] }>(response)).items;
}

/** The submission rendered with a template already on its form version. */
export async function printWithStoredTemplate(
  token: string | undefined,
  submissionId: string,
  templateId: string,
): Promise<Blob> {
  const response = await sobaFetch(`${submissionPath(submissionId)}/print`, {
    token,
    method: 'POST',
    json: { templateId },
  });
  return documentBlob(response);
}

/** The submission rendered with a template sent along with the request; nothing is stored. */
export async function printWithUploadedTemplate(
  token: string | undefined,
  submissionId: string,
  file: File,
): Promise<Blob> {
  const form = new FormData();
  form.set('file', file);
  const response = await sobaFetch(`${submissionPath(submissionId)}/print/upload`, {
    token,
    method: 'POST',
    form,
  });
  return documentBlob(response);
}

/** Live (on-screen) answers rendered with a template already on the form version. */
export async function previewWithStoredTemplate(
  token: string | undefined,
  submissionId: string,
  templateId: string,
  data: Record<string, unknown>,
): Promise<Blob> {
  const response = await sobaFetch(`${submissionPath(submissionId)}/preview`, {
    token,
    method: 'POST',
    json: { templateId, data },
  });
  return documentBlob(response);
}

/** Live (on-screen) answers rendered with a template sent along with the request. */
export async function previewWithUploadedTemplate(
  token: string | undefined,
  submissionId: string,
  file: File,
  data: Record<string, unknown>,
): Promise<Blob> {
  const form = new FormData();
  form.set('data', JSON.stringify(data));
  form.set('file', file);
  const response = await sobaFetch(`${submissionPath(submissionId)}/preview/upload`, {
    token,
    method: 'POST',
    form,
  });
  return documentBlob(response);
}
