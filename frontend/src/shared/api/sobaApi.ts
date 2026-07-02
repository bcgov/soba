import type { FeaturesMetaPayload } from '@/src/shared/config/featuresMeta';
import { isFeaturesMetaPayload } from '@/src/shared/config/featuresMeta';
import { getSobaApiBaseUrl } from '../config/runtimeConfig';
import { parseJson } from './sobaHelpers';

import type { SobaFormType } from '../../types/forms';
import type { WorkspaceItem, WorkspacesResponse } from '../../types/workspaces';
import type { CurrentUserResponse } from '../../types/user';

export type { SobaFormType, WorkspaceItem, WorkspacesResponse, CurrentUserResponse };
export {
  createSobaFormioForm,
  publishSobaFormVersion,
  getSobaForm,
  createSobaFormSubmission,
  saveSobaFormSubmission,
  getSobaForms,
  getSobaFormVersions,
  updateSobaFormVersionVisibility,
  createFormVersion,
  saveFormVersionSchema,
  getFormVersionSchema,
} from './sobaApiForms';

export type BuildMeta = {
  name: string;
  version: string;
  nodeVersion: string;
  gitSha: string;
  gitTag: string;
  imageTag: string;
};

export async function fetchHealth(): Promise<{ status: string }> {
  const response = await fetch(`${getSobaApiBaseUrl()}/health`, {
    method: 'GET',
    cache: 'no-store',
  });
  return parseJson(response);
}

export async function fetchBuildMeta(): Promise<BuildMeta> {
  const response = await fetch(`${getSobaApiBaseUrl()}/meta/build`, {
    method: 'GET',
    cache: 'no-store',
  });
  return parseJson(response);
}

export async function fetchFeaturesMeta(): Promise<FeaturesMetaPayload> {
  const response = await fetch(`${getSobaApiBaseUrl()}/meta/features`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });
  const payload = await parseJson<unknown>(response);
  if (!isFeaturesMetaPayload(payload)) {
    throw new Error('Invalid features meta response');
  }
  return payload;
}

/** Readiness may return 503 with a JSON body; callers should not use `parseJson` alone. */
export async function fetchHealthReady(): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${getSobaApiBaseUrl()}/health/ready`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const body = (await response.json()) as unknown;
  return { status: response.status, body };
}

export async function fetchPluginsMeta(): Promise<unknown> {
  const response = await fetch(`${getSobaApiBaseUrl()}/meta/plugins`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  return parseJson(response);
}

export async function fetchFormEnginesMeta(): Promise<unknown> {
  const response = await fetch(`${getSobaApiBaseUrl()}/meta/form-engines`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  return parseJson(response);
}

export async function fetchFrontendConfigMeta(): Promise<unknown> {
  const response = await fetch(`${getSobaApiBaseUrl()}/meta/frontend-config`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  return parseJson(response);
}

export async function fetchCodesMeta(onlyEnabledFeatures = true): Promise<unknown> {
  const q = onlyEnabledFeatures ? '?only_enabled_features=true' : '';
  const response = await fetch(`${getSobaApiBaseUrl()}/meta/codes${q}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  return parseJson(response);
}

export async function fetchRolesMeta(onlyEnabledFeatures = true): Promise<unknown> {
  const q = onlyEnabledFeatures ? '?only_enabled_features=true' : '';
  const response = await fetch(`${getSobaApiBaseUrl()}/meta/roles${q}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  return parseJson(response);
}

export async function fetchWorkspaces(token: string): Promise<WorkspacesResponse> {
  const response = await fetch(`${getSobaApiBaseUrl()}/workspaces`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response);
}

export async function fetchCurrentUser(token: string): Promise<CurrentUserResponse> {
  const response = await fetch(`${getSobaApiBaseUrl()}/me`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJson(response);
}
