import { getSobaApiBaseUrl } from '../config/runtimeConfig';
import { getWorkspaceId, setWorkspaceId } from '../workspace/workspaceStore';
import { notifyWorkspaceResolved } from '../workspace/workspaceSync';

export const WORKSPACE_HEADER = 'x-soba-workspace-id';

export type SobaFetchOptions = {
  /** Bearer token; when present an Authorization header is sent. */
  token?: string;
  method?: string;
  /** JSON body; serialized and sent with a Content-Type: application/json header. */
  json?: unknown;
  /**
   * Workspace id for workspace-scoped calls (lists/creates). Sent as the `workspaceId`
   * query param read from per-tab storage by the caller. Resource calls omit this and
   * let the backend derive the workspace from the resource.
   */
  workspaceId?: string;
  /** Additional query params. */
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

function buildUrl(path: string, options: SobaFetchOptions): string {
  const params = new URLSearchParams();
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
  }
  if (options.workspaceId) {
    params.set('workspaceId', options.workspaceId);
  }
  const qs = params.toString();
  return `${getSobaApiBaseUrl()}${path}${qs ? `?${qs}` : ''}`;
}

/**
 * Single entry point for all SOBA API calls. Injects auth/JSON headers (never a workspace
 * request header) and, after the response, captures the echoed `x-soba-workspace-id`
 * header to update the per-tab workspace store and Redux mirror.
 */
export async function sobaFetch(path: string, options: SobaFetchOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const hasJsonBody = options.json !== undefined;
  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, options), {
    method: options.method ?? 'GET',
    cache: options.cache ?? 'no-store',
    headers,
    body: hasJsonBody ? JSON.stringify(options.json) : undefined,
  });

  const resolved = response.headers.get(WORKSPACE_HEADER);
  if (resolved && resolved !== getWorkspaceId()) {
    setWorkspaceId(resolved);
    notifyWorkspaceResolved(resolved);
  }

  return response;
}
