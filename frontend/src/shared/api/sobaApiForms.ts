import { getSobaApiBaseUrl } from '../config/runtimeConfig';
import { parseJson } from './sobaHelpers';
import { FormType } from '@formio/react';
import type {
  SobaFormType,
  CreateSobaFormioFormResponse,
  SobaResponseFormType,
  SobaFormWithVersionResponse,
  SobaFormVersionType,
} from '../../types/forms';
import type { ListSubmissionsResponse, SubmissionResponse } from '@/src/types/submissions';

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

export async function createFormioForm(
  token: string,
  data: FormType,
  sobaId: string,
  publish: boolean,
  visibility?: string[],
  workspaceId?: string,
): Promise<FormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/formio-v5/form`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify(data),
  });
  // parse the Form.io create response and attach the returned id to the form data
  const created = await parseJson<unknown>(response);
  // created might be an object with _id or id
  let createdId: unknown = undefined;
  if (created && typeof created === 'object') {
    const obj = created as Record<string, unknown>;
    if (typeof obj._id === 'string' || typeof obj._id === 'number') createdId = obj._id;
    else if (typeof obj.id === 'string' || typeof obj.id === 'number') createdId = obj.id;
  }
  if (createdId != null) {
    // attach to the form data so subsequent save sends engine_schema_ref
    (data as Record<string, unknown>)._id = String(createdId);
  }

  await createSobaFormVersion(token, data, sobaId, publish, visibility, workspaceId);
  return data;
}

/**
 * Update an existing Form.io form resource on the engine.
 * This mirrors the createFormioForm flow but issues a PATCH to the engine resource.
 */
export async function updateFormioForm(
  token: string,
  id: string,
  data: FormType,
  sobaVersionId: string,
  publish: boolean,
  workspaceId?: string,
): Promise<FormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/formio-v5/form/${id}`, {
    method: 'PUT',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify(data),
  });

  // Some engines return the updated object; ensure the form data has an _id
  const updated = await parseJson<unknown>(response);
  let updatedId: unknown = undefined;
  if (updated && typeof updated === 'object') {
    const obj = updated as Record<string, unknown>;
    if (typeof obj._id === 'string' || typeof obj._id === 'number') updatedId = obj._id;
    else if (typeof obj.id === 'string' || typeof obj.id === 'number') updatedId = obj.id;
  }
  if (updatedId != null) {
    (data as Record<string, unknown>)._id = String(updatedId);
  }

  // Save to the existing SOBA form version
  await updateSobaFormVersion(token, sobaVersionId, data, publish, workspaceId);
  return data;
}

async function createSobaFormVersion(
  token: string,
  data: FormType,
  sobaId: string,
  publish: boolean,
  visibility?: string[],
  workspaceId?: string,
) {
  const sobaFormVersionData = {
    formId: sobaId,
    visibility,
  };
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify(sobaFormVersionData),
  });
  const responseData: SobaResponseFormType = await parseJson(response);
  const update_resp = await updateSobaFormVersion(
    token,
    responseData.id,
    data,
    publish,
    workspaceId,
  );
  return update_resp;
}

async function updateSobaFormVersion(
  token: string,
  id: string,
  formData: FormType,
  publish: boolean,
  workspaceId?: string,
): Promise<Response> {
  const data = {
    formioFormDefinition: formData,
    engine_schema_ref: formData._id,
  };
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}/save`, {
    method: 'POST',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId, true),
    body: JSON.stringify(data),
  });

  if (publish) {
    await publishSobaFormVersion(token, id, workspaceId);
  }

  return parseJson(response);
}

/**
 * Public wrapper to save/update an existing SOBA form version.
 * This calls the internal /form-versions/{id}/save endpoint.
 */
export async function saveSobaFormVersion(
  token: string,
  id: string,
  formData: FormType,
  publish: boolean,
  workspaceId?: string,
) {
  return updateSobaFormVersion(token, id, formData, publish, workspaceId);
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

export async function getFormioForm(
  token: string,
  id: string,
  workspaceId?: string,
): Promise<FormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/formio-v5/form/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
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

export async function getSobaFormVersion(
  token: string,
  id: string,
  workspaceId?: string,
): Promise<SobaResponseFormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  return parseJson(response);
}

export async function getSobaFormVersionFromFormioId(
  token: string,
  id: string,
  workspaceId?: string,
): Promise<SobaFormWithVersionResponse> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms/engine/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: getHeaders(token, workspaceId),
  });
  return parseJson(response) as Promise<SobaFormWithVersionResponse>;
}

/**
 * Create a soba submission after the formio one is created.
 */

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

export async function getSobaFormioForms(token: string, workspaceId?: string): Promise<FormType[]> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms/formio/form`, {
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
