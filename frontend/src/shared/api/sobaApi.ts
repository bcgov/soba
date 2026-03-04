import { getSobaApiBaseUrl } from '../config/runtimeConfig';

export type WorkspaceItem = {
  id: string;
  name: string;
  slug: string | null;
  kind: string;
  role: string;
  status: string;
};

export type WorkspacesResponse = {
  items: WorkspaceItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    cursorMode: 'id' | 'ts_id';
  };
  filters: {
    kind?: string;
    status?: string;
  };
  sort: string;
};

export type BuildMeta = {
  name: string;
  version: string;
  nodeVersion: string;
  gitSha: string;
  gitTag: string;
  imageTag: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

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
