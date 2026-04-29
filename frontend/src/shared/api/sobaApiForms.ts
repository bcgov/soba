import { getSobaApiBaseUrl } from '../config/runtimeConfig';
import { parseJson } from './sobaHelpers';
import { FormType } from '@formio/react';
import type {
  SobaFormType,
  CreateSobaFormioFormResponse,
  SobaResponseFormType,
  SobaFormWithVersionResponse,
} from '../../types/forms';

export async function createSobaFormioForm(
  token: string,
  data: SobaFormType,
): Promise<CreateSobaFormioFormResponse> {
  data.formEngineCode = 'formio-v5';

  const response = await fetch(`${getSobaApiBaseUrl()}/forms`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return parseJson(response);
}

export async function createFormioForm(
  token: string,
  data: FormType,
  sobaId: string,
  publish: boolean,
): Promise<FormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/formio-v5/form`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
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

  await createSobaFormVersion(token, data, sobaId, publish);
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
): Promise<FormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/formio-v5/form/${id}`, {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
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
  await updateSobaFormVersion(token, sobaVersionId, data, publish);
  return data;
}

/**
 * Update an existing Form.io form (proxied) by id.
 * Returns the updated form payload (same shape as FormType).
 */
// (Removed duplicate PUT-style updater — keep the PATCH-style `updateFormioForm` above.)

async function createSobaFormVersion(
  token: string,
  data: FormType,
  sobaId: string,
  publish: boolean,
) {
  const sobaFormVersionData = {
    formId: sobaId,
  };
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sobaFormVersionData),
  });
  const responseData: SobaResponseFormType = await parseJson(response);
  const update_resp = await updateSobaFormVersion(token, responseData.id, data, publish);
  return update_resp;
}

async function updateSobaFormVersion(
  token: string,
  id: string,
  formData: FormType,
  publish: boolean,
): Promise<Response> {
  const data = {
    formioFormDefinition: formData,
    enqueueProvision: false,
    engine_schema_ref: formData._id,
  };
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}/save`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (publish) {
    await publishSobaFormVersion(token, id);
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
) {
  return updateSobaFormVersion(token, id, formData, publish);
}

export async function publishSobaFormVersion(token: string, id: string) {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}`, {
    method: 'PATCH',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      state: 'published',
    }),
  });
  return parseJson(response);
}

export async function getFormioForm(token: string, id: string): Promise<FormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/formio-v5/form/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response);
}

export async function getSobaForm(token: string, id: string): Promise<SobaResponseFormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response);
}

export async function getSobaFormVersion(token: string, id: string): Promise<SobaResponseFormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response);
}

export async function getSobaFormVersionFromFormioId(
  token: string,
  id: string,
): Promise<SobaResponseFormType> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms/engine/${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response) as Promise<SobaFormWithVersionResponse>;
}
