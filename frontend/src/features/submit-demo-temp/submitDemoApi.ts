/**
 * TEMP(submit-demo): authenticated Core API calls with workspace header.
 * Remove this module with the `submit-demo-temp` feature folder.
 */
import type { WorkspacesResponse } from '@/src/shared/api/sobaApi';
import { getSobaApiBaseUrl } from '@/src/shared/config/runtimeConfig';

function workspaceHeaders(token: string, workspaceId: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-workspace-id': workspaceId,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status})`);
  }
  return JSON.parse(text) as T;
}

export async function fetchWorkspacesForSubmitDemo(token: string): Promise<WorkspacesResponse> {
  /** Core API only allows `id:desc` | `updatedAt:desc`; workspace pick is sorted client-side. */
  const q = new URLSearchParams({ limit: '100' });
  const response = await fetch(`${getSobaApiBaseUrl()}/workspaces?${q.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response);
}

export type SubmitDemoFormListItem = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export type SubmitDemoFormsListResponse = {
  items: SubmitDemoFormListItem[];
};

export type SubmitDemoFormVersionListItem = {
  id: string;
  formId: string;
  versionNo: number;
  state: string;
  engineSyncStatus: string;
  engineSchemaRef: string | null;
};

export type SubmitDemoFormVersionsListResponse = {
  items: SubmitDemoFormVersionListItem[];
};

export async function listForms(
  token: string,
  workspaceId: string,
): Promise<SubmitDemoFormsListResponse> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms?limit=100`, {
    method: 'GET',
    cache: 'no-store',
    headers: workspaceHeaders(token, workspaceId),
  });
  return parseJson(response);
}

export async function listFormVersionsForForm(
  token: string,
  workspaceId: string,
  formId: string,
): Promise<SubmitDemoFormVersionsListResponse> {
  const q = new URLSearchParams({ formId, limit: '5', sort: 'id:desc' });
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions?${q}`, {
    method: 'GET',
    cache: 'no-store',
    headers: workspaceHeaders(token, workspaceId),
  });
  return parseJson(response);
}

export async function createForm(
  token: string,
  workspaceId: string,
  body: { slug: string; name: string; formEngineCode: string },
): Promise<{ id: string }> {
  const response = await fetch(`${getSobaApiBaseUrl()}/forms`, {
    method: 'POST',
    cache: 'no-store',
    headers: workspaceHeaders(token, workspaceId),
    body: JSON.stringify(body),
  });
  return parseJson(response);
}

export async function createFormVersionDraft(
  token: string,
  workspaceId: string,
  formId: string,
): Promise<{ id: string }> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions`, {
    method: 'POST',
    cache: 'no-store',
    headers: workspaceHeaders(token, workspaceId),
    body: JSON.stringify({ formId }),
  });
  return parseJson(response);
}

export async function saveFormVersionWithProvision(
  token: string,
  workspaceId: string,
  formVersionId: string,
  formioFormDefinition: Record<string, unknown>,
): Promise<{ id: string; engineSyncStatus: string; engineSchemaRef: string | null }> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${formVersionId}/save`, {
    method: 'POST',
    cache: 'no-store',
    headers: workspaceHeaders(token, workspaceId),
    body: JSON.stringify({
      eventType: 'initial_provision',
      enqueueProvision: true,
      formioFormDefinition,
    }),
  });
  return parseJson(response);
}

export async function getFormVersion(
  token: string,
  workspaceId: string,
  formVersionId: string,
): Promise<{
  id: string;
  engineSyncStatus: string;
  engineSchemaRef: string | null;
}> {
  const response = await fetch(`${getSobaApiBaseUrl()}/form-versions/${formVersionId}`, {
    method: 'GET',
    cache: 'no-store',
    headers: workspaceHeaders(token, workspaceId),
  });
  return parseJson(response);
}
