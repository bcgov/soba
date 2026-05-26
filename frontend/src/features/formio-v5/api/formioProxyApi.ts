import { getFormioProxyBaseUrl } from '@/src/shared/config/runtimeConfig';

export type FormioProxyFetchResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string };

function joinProxyPath(path: string): string {
  const base = getFormioProxyBaseUrl().replace(/\/$/, '');
  if (!path || path === '/') return base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

const MAX_PROXY_BODY_SNIPPET = 200;

function truncateForMessage(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_PROXY_BODY_SNIPPET) return t;
  return `${t.slice(0, MAX_PROXY_BODY_SNIPPET)}…`;
}

/**
 * GET a path relative to the Form.io proxy (e.g. `/current`, `/form`).
 * Caller supplies a fresh Keycloak access token.
 *
 * On HTTP success: the body must be **non-empty valid JSON**; otherwise the result is `ok: false`.
 * (Callers should treat `ok: true` as a parsed `T`, not raw text.)
 */
export async function fetchFormioProxyGet<T = unknown>(
  path: string,
  token: string,
): Promise<FormioProxyFetchResult<T>> {
  const url = joinProxyPath(path);
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      message: text || `Request failed (${response.status})`,
    };
  }

  const text = await response.text();
  if (!text.trim()) {
    return {
      ok: false,
      status: response.status,
      message: 'Empty response body from Form.io proxy (expected JSON).',
    };
  }

  try {
    return { ok: true, status: response.status, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      status: response.status,
      message: `Invalid JSON from Form.io proxy: ${truncateForMessage(text)}`,
    };
  }
}
