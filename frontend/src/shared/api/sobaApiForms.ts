import { getSobaApiBaseUrl } from '../config/runtimeConfig';
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

function getHeaders(token: string, workspaceId?: string, isJson: boolean = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }
  return headers;
}

export async function createSobaFormioForm(
  token: string,
  data: SobaFormType,
  workspaceId?: string,
): Promise<CreateSobaFormioFormResponse> {
  data.formEngineCode = 'formio-v5';

  const response = await fetch(`${getSobaApiBaseUrl()}/forms`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify(data),
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
  workspaceId?: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms/normalize`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify({ schema }),
  });
  const data = await parseJson<{ schema: Record<string, unknown> }>(response);
  return data.schema;
}

export async function publishSobaFormVersion(token: string, id: string, workspaceId?: string) {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}/publish`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
  });
  return parseJson(response);
}

export async function updateSobaFormVersionVisibility(
  token: string,
  id: string,
  visibility: string[],
  workspaceId?: string,
) {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}`, {
    method: 'PATCH',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify({ visibility }),
  });
  return parseJson(response);
}

export async function getSobaForm(
  token: string,
  id: string,
  workspaceId?: string,
): Promise<SobaResponseFormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  return parseJson(response);
}

/** Create the SOBA submission shell (a PG row); its answer data is saved via saveSobaFormSubmission. */
export async function createSobaFormSubmission(
  token: string,
  formId: string,
  formVersionId: string,
  options?: Record<string, unknown>,
  workspaceId?: string,
): Promise<SubmissionResponse> {
  const sobaFormSubmissionData = {
    formId,
    formVersionId,
    ...options,
  };
  const response = await fetch(`${getSobaApiBaseUrl()}/submissions`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify(sobaFormSubmissionData),
  });
  const responseData = await parseJson<SubmissionResponse>(response);
  return responseData;
}

/** Save a submission's answer data; the server writes a new engine document and records a revision. */
export async function saveSobaFormSubmission(
  token: string,
  submissionId: string,
  data: Record<string, unknown>,
  eventType: string = 'submit',
  workspaceId?: string,
): Promise<SubmissionResponse> {
  const response = await fetch(`${getSobaApiBaseUrl()}/submissions/${submissionId}/save`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify({ data, eventType }),
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
  const response = await fetch(`${getSobaApiBaseUrl()}/forms?limit=100`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  return parseJson(response);
}

export async function getSobaSubmissions(
  token: string,
  params?: Record<string, unknown>,
  workspaceId?: string,
): Promise<ListSubmissionsResponse> {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
  }
  const qs = query.toString();
  const response = await fetch(`${getSobaApiBaseUrl()}/submissions${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  return parseJson(response);
}

/** Fetch a single submission's metadata (form/version, status, timestamps). */
export async function getSobaSubmission(
  token: string,
  id: string,
  workspaceId?: string,
): Promise<SubmissionListItem> {
  const response = await fetch(`${getSobaApiBaseUrl()}/submissions/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  return parseJson(response);
}

/** Read a submission's answer document back from the engine (null if not yet provisioned). */
export async function getSobaSubmissionData(
  token: string,
  id: string,
  workspaceId?: string,
): Promise<{ data?: Record<string, unknown> } | null> {
  const response = await fetch(`${getSobaApiBaseUrl()}/submissions/${id}/data`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  if (response.status === 404) return null;
  return parseJson(response);
}

export async function getSobaFormVersions(
  token: string,
  formId: string,
  workspaceId?: string,
): Promise<{ items: SobaFormVersionType[] }> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions?formId=${formId}&limit=100`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  return parseJson(response);
}

/** Create a new (empty) form version draft for a form. */
export async function createFormVersion(
  token: string,
  formId: string,
  visibility?: string[],
  workspaceId?: string,
): Promise<SobaFormVersionType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify({ formId, visibility }),
  });
  return parseJson(response);
}

/** Save a form version's schema; the server provisions it in the engine (Form.io). */
export async function saveFormVersionSchema(
  token: string,
  id: string,
  schema: FormType,
  workspaceId?: string,
): Promise<SobaFormVersionType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}/schema`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify({ schema }),
  });
  return parseJson(response);
}

/** Read a form version's schema back from the engine (null if not yet provisioned). */
export async function getFormVersionSchema(
  token: string,
  id: string,
  workspaceId?: string,
): Promise<FormType | null> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}/schema`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  if (response.status === 404) return null;
  return parseJson(response);
}
