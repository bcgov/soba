import { getSobaApiBaseUrl } from '../config/runtimeConfig';
import { parseJson } from './sobaHelpers';
import { FormType } from '@formio/react';

export type SobaFormType = {
  slug: string;
  name: string;
  description: string;
  formEngineCode?: string;
};

export type CreateSobaFormioFormResponse = {
  createdAt: Date;
  description: string;
  id: string;
  name: string;
  slug: string;
  status: string;
  updatedAt: Date;
};

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

export async function createFormioForm(token: string, data: FormType): Promise<FormType> {
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
  return parseJson(response);
}
