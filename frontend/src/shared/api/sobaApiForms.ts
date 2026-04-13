import { getSobaApiBaseUrl } from '../config/runtimeConfig';
import { parseJson } from './sobaHelpers';
import { FormType } from '@formio/react';
import type {
  SobaFormType,
  CreateSobaFormioFormResponse,
  SobaResponseFormType,
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
  await createSobaFormVersion(token, data, publish);
  return parseJson(response);
}

async function createSobaFormVersion(token: string, data: FormType, publish: boolean) {
  const sobaFormVersionData = {
    id: data._id,
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
  return parseJson(update_resp);
}

async function updateSobaFormVersion(
  token: string,
  id: string,
  formData: FormType,
  publish: boolean,
): Promise<Response> {
  const data = {
    formioFormDefinition: formData,
    enqueueProvision: true,
  };
  const response = await fetch(`${getSobaApiBaseUrl()}/${id}/form-versions`, {
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
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions?formId=${id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response);
}
