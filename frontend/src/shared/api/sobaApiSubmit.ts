// Submit-mode API service: public form read + submission create/save + confirmation read. All calls
// hit /submit/* and take an optional token — anonymous callers on a public-audience form are attributed
// to the seeded public user by the backend. Access is decided by the workspace Form submitters audience.
import { sobaFetch } from './sobaFetch';
import { parseJson } from './sobaHelpers';
import { FormType } from '@formio/react';
import type { SubmitFormBundle } from '../../types/forms';
import type { SubmissionResponse, SubmissionListItem } from '@/src/types/submissions';

/** The published form + its version + schema, for rendering the public fill page (one call). */
export async function getSubmitForm(
  token: string | undefined,
  formId: string,
): Promise<SubmitFormBundle> {
  const response = await sobaFetch(`/submit/forms/${formId}`, { token });
  return parseJson<SubmitFormBundle>(response);
}

/** A submission's own form-version schema, for its read-only confirmation view. */
export async function getSubmitSubmissionSchema(
  token: string | undefined,
  submissionId: string,
): Promise<FormType | null> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}/schema`, { token });
  if (response.status === 404) return null;
  return parseJson(response);
}

/**
 * Create the SOBA submission shell (a PG row); its answer data is saved via saveSobaFormSubmission.
 * Token is optional: anonymous submissions to a public-audience form are attributed to the public user.
 */
export async function createSobaFormSubmission(
  token: string | undefined,
  formId: string,
  formVersionId: string,
  options?: Record<string, unknown>,
): Promise<SubmissionResponse> {
  const response = await sobaFetch('/submit/submissions', {
    token,
    method: 'POST',
    json: { formId, formVersionId, ...options },
  });
  return parseJson<SubmissionResponse>(response);
}

/** Save a submission's answer data; the server writes a new engine document and records a revision. */
export async function saveSobaFormSubmission(
  token: string | undefined,
  submissionId: string,
  data: Record<string, unknown>,
  eventType: string = 'submit',
): Promise<SubmissionResponse> {
  const response = await sobaFetch(`/submit/submissions/${submissionId}/save`, {
    token,
    method: 'POST',
    json: { data, eventType },
  });
  return parseJson<SubmissionResponse>(response);
}

/** Read a submission's metadata for the confirmation view (audience-readable). */
export async function getSubmitSubmission(
  token: string | undefined,
  id: string,
): Promise<SubmissionListItem> {
  const response = await sobaFetch(`/submit/submissions/${id}`, { token });
  return parseJson(response);
}

/** Read a submission's answer document for the confirmation view (null if not yet provisioned). */
export async function getSubmitSubmissionData(
  token: string | undefined,
  id: string,
): Promise<{ data?: Record<string, unknown> } | null> {
  const response = await sobaFetch(`/submit/submissions/${id}/data`, { token });
  if (response.status === 404) return null;
  return parseJson(response);
}
