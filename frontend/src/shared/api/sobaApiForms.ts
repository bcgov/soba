import { sobaFetch } from './sobaFetch';
import { parseJson } from './sobaHelpers';
import { FormType } from '@formio/react';
import type {
  SobaFormType,
  CreateSobaFormioFormResponse,
  SobaResponseFormType,
  SobaFormVersionType,
} from '../../types/forms';
import type {
  ListSubmissionsResponse,
  SubmissionResponse,
  SubmissionListItem,
} from '@/src/types/submissions';

export async function createSobaFormioForm(
  token: string,
  data: SobaFormType,
  workspaceId?: string,
): Promise<CreateSobaFormioFormResponse> {
  data.formEngineCode = 'formio-v5';

  const response = await sobaFetch('/forms', {
    token,
    method: 'POST',
    json: data,
    workspaceId,
  });
  return parseJson(response);
}

/**
 * POST a Form.io schema to the server to normalize it into a clean, portable, builder-ready
 * form definition. Used both for import (file upload) and export (download).
 */
export async function normalizeFormSchema(
  token: string,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await sobaFetch('/forms/normalize', {
    token,
    method: 'POST',
    json: { schema },
  });
  const data = await parseJson<{ schema: Record<string, unknown> }>(response);
  return data.schema;
}

export async function publishSobaFormVersion(token: string, id: string) {
  const response = await sobaFetch(`/form-versions/${id}/publish`, {
    token,
    method: 'POST',
  });
  return parseJson(response);
}

export async function updateSobaFormVersionVisibility(
  token: string,
  id: string,
  visibility: string[],
) {
  const response = await sobaFetch(`/form-versions/${id}`, {
    token,
    method: 'PATCH',
    json: { visibility },
  });
  return parseJson(response);
}

export async function getSobaForm(token: string, id: string): Promise<SobaResponseFormType> {
  const response = await sobaFetch(`/forms/${id}`, { token });
  return parseJson(response);
}

/** Create the SOBA submission shell (a PG row); its answer data is saved via saveSobaFormSubmission. */
export async function createSobaFormSubmission(
  token: string,
  formId: string,
  formVersionId: string,
  options?: Record<string, unknown>,
): Promise<SubmissionResponse> {
  const sobaFormSubmissionData = {
    formId,
    formVersionId,
    ...options,
  };
  const response = await sobaFetch('/submissions', {
    token,
    method: 'POST',
    json: sobaFormSubmissionData,
  });
  return parseJson<SubmissionResponse>(response);
}

/** Save a submission's answer data; the server writes a new engine document and records a revision. */
export async function saveSobaFormSubmission(
  token: string,
  submissionId: string,
  data: Record<string, unknown>,
  eventType: string = 'submit',
): Promise<SubmissionResponse> {
  const response = await sobaFetch(`/submissions/${submissionId}/save`, {
    token,
    method: 'POST',
    json: { data, eventType },
  });
  return parseJson<SubmissionResponse>(response);
}

/** Compact form row for the designer/submit list. */
export type SobaFormSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

/** List forms (PG-backed) with each form's representative version, for the designer/submit list. */
export async function getSobaForms(
  token: string,
  workspaceId?: string,
): Promise<{ items: SobaFormSummary[] }> {
  const response = await sobaFetch('/forms', {
    token,
    workspaceId,
    query: { limit: 100 },
  });
  return parseJson(response);
}

export async function getSobaSubmissions(
  token: string,
  params?: Record<string, unknown>,
  workspaceId?: string,
): Promise<ListSubmissionsResponse> {
  const query: Record<string, string> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        query[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }
  }
  const response = await sobaFetch('/submissions', {
    token,
    workspaceId,
    query,
  });
  return parseJson(response);
}

/** Fetch a single submission's metadata (form/version, status, timestamps). */
export async function getSobaSubmission(token: string, id: string): Promise<SubmissionListItem> {
  const response = await sobaFetch(`/submissions/${id}`, { token });
  return parseJson(response);
}

/** Read a submission's answer document back from the engine (null if not yet provisioned). */
export async function getSobaSubmissionData(
  token: string,
  id: string,
): Promise<{ data?: Record<string, unknown> } | null> {
  const response = await sobaFetch(`/submissions/${id}/data`, { token });
  if (response.status === 404) return null;
  return parseJson(response);
}

export async function getSobaFormVersions(
  token: string,
  formId: string,
): Promise<{ items: SobaFormVersionType[] }> {
  const response = await sobaFetch('/form-versions', {
    token,
    query: { formId, limit: 100 },
  });
  return parseJson(response);
}

/** Create a new (empty) form version draft for a form. */
export async function createFormVersion(
  token: string,
  formId: string,
  visibility?: string[],
): Promise<SobaFormVersionType> {
  const response = await sobaFetch('/form-versions', {
    token,
    method: 'POST',
    json: { formId, visibility },
  });
  return parseJson(response);
}

/** Save a form version's schema; the server provisions it in the engine (Form.io). */
export async function saveFormVersionSchema(
  token: string,
  id: string,
  schema: FormType,
): Promise<SobaFormVersionType> {
  const response = await sobaFetch(`/form-versions/${id}/schema`, {
    token,
    method: 'POST',
    json: { schema },
  });
  return parseJson(response);
}

/** Read a form version's schema back from the engine (null if not yet provisioned). */
export async function getFormVersionSchema(token: string, id: string): Promise<FormType | null> {
  const response = await sobaFetch(`/form-versions/${id}/schema`, { token });
  if (response.status === 404) return null;
  return parseJson(response);
}
