/**
 * Form.io CE v5 API client for the formio-v5 form-engine plugin.
 * Uses plugin config (PluginConfigReader), not process.env. No URL logging.
 */

import type { PluginConfigReader } from '../../core/config/pluginConfig';

export class FormioApiError extends Error {
  readonly status: number;
  readonly body: string;
  readonly url: string;

  constructor(status: number, body: string, url: string) {
    super(`Formio API ${status}: ${body}`);
    this.name = 'FormioApiError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

export type FormioQuery = { params?: Record<string, unknown> } | undefined;

function buildQueryString(query?: FormioQuery): string {
  if (!query?.params || typeof query.params !== 'object') return '';
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query.params)) {
    if (v !== undefined && v !== null) search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormioForm = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormioSubmission = any;

export type FormioRequestOptions = { token?: string };

export interface FormioCommunityEditionAPIv5Options {
  baseUrl: string;
  username: string;
  password: string;
  actor?: string;
}

export class FormioCommunityEditionAPIv5Client {
  private readonly _baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly actor: string | undefined;
  private token: string | null = null;

  constructor(options: FormioCommunityEditionAPIv5Options) {
    this._baseUrl = options.baseUrl.replace(/\/$/, '');
    this.username = options.username;
    this.password = options.password;
    this.actor = options.actor;
  }

  async login(): Promise<void> {
    const body = JSON.stringify({ data: { email: this.username, password: this.password } });
    const loginPaths = ['/admin/login', '/user/login'];
    let lastError: Error | null = null;
    for (const path of loginPaths) {
      const url = `${this._baseUrl}${path}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      } catch (err) {
        lastError = new Error(
          `Formio login request failed: ${err instanceof Error ? err.message : err}`,
        );
        continue;
      }
      const text = await res.text();
      if (!res.ok) {
        lastError = new Error(`Formio login failed ${res.status}: ${text}`);
        continue;
      }
      const jwt = res.headers.get('x-jwt-token');
      if (!jwt) {
        lastError = new Error('Formio login response missing x-jwt-token header');
        continue;
      }
      this.token = jwt;
      return;
    }
    throw lastError ?? new Error('Formio login failed');
  }

  getToken(): string | null {
    return this.token;
  }

  static async loginWithCredentials(
    baseUrl: string,
    email: string,
    password: string,
  ): Promise<string> {
    const client = new FormioCommunityEditionAPIv5Client({
      baseUrl: baseUrl.replace(/\/$/, ''),
      username: email,
      password,
    });
    await client.login();
    const token = client.getToken();
    if (!token) throw new Error('Formio login did not return a token');
    return token;
  }

  private async request<T>(
    path: string,
    method: string,
    body?: unknown,
    opts?: FormioRequestOptions,
  ): Promise<T> {
    const url = `${this._baseUrl}${path}`;
    const token = opts?.token ?? this.token ?? undefined;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) headers['x-jwt-token'] = token;
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new FormioApiError(res.status, text, url);
    if (res.status === 204 || !text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined as T;
    }
  }

  async loadForms(query?: FormioQuery, opts?: FormioRequestOptions): Promise<FormioForm[]> {
    const qs = buildQueryString(query);
    const result = await this.request<FormioForm[] | FormioForm>(
      `/form${qs}`,
      'GET',
      undefined,
      opts,
    );
    return Array.isArray(result) ? result : [];
  }

  async loadForm(
    formId: string,
    query?: FormioQuery,
    opts?: FormioRequestOptions,
  ): Promise<FormioForm | null> {
    const qs = buildQueryString(query);
    return this.request<FormioForm | null>(`/form/${formId}${qs}`, 'GET', undefined, opts);
  }

  async saveForm(data: FormioForm, opts?: FormioRequestOptions): Promise<FormioForm> {
    if (data._id) return this.request<FormioForm>(`/form/${data._id}`, 'PUT', data, opts);
    return this.request<FormioForm>('/form', 'POST', data, opts);
  }

  async deleteForm(formId: string, opts?: FormioRequestOptions): Promise<void> {
    await this.request(`/form/${formId}`, 'DELETE', undefined, opts);
  }

  async loadSubmissions(
    formId: string,
    query?: FormioQuery,
    opts?: FormioRequestOptions,
  ): Promise<FormioSubmission[]> {
    const qs = buildQueryString(query);
    const result = await this.request<FormioSubmission[] | FormioSubmission>(
      `/form/${formId}/submission${qs}`,
      'GET',
      undefined,
      opts,
    );
    return Array.isArray(result) ? result : [];
  }

  async loadSubmission(
    formId: string,
    submissionId: string,
    query?: FormioQuery,
    opts?: FormioRequestOptions,
  ): Promise<FormioSubmission | null> {
    const qs = buildQueryString(query);
    return this.request<FormioSubmission | null>(
      `/form/${formId}/submission/${submissionId}${qs}`,
      'GET',
      undefined,
      opts,
    );
  }

  async saveSubmission(
    formId: string,
    data: FormioSubmission,
    opts?: FormioRequestOptions,
  ): Promise<FormioSubmission> {
    if (data._id) {
      return this.request<FormioSubmission>(
        `/form/${formId}/submission/${data._id}`,
        'PUT',
        data,
        opts,
      );
    }
    return this.request<FormioSubmission>(`/form/${formId}/submission`, 'POST', data, opts);
  }

  async deleteSubmission(
    formId: string,
    submissionId: string,
    opts?: FormioRequestOptions,
  ): Promise<void> {
    await this.request(`/form/${formId}/submission/${submissionId}`, 'DELETE', undefined, opts);
  }

  async loadRoles(
    query?: FormioQuery,
    opts?: FormioRequestOptions,
  ): Promise<{ _id: string; title?: string; name?: string }[]> {
    const qs = buildQueryString(query);
    const result = await this.request<{ _id: string; title?: string; name?: string }[]>(
      `/role${qs}`,
      'GET',
      undefined,
      opts,
    );
    return Array.isArray(result) ? result : [];
  }

  async loadProject(
    opts?: FormioRequestOptions,
  ): Promise<Record<string, unknown> & { access?: unknown[] }> {
    const project = await this.request<Record<string, unknown>>('', 'GET', undefined, opts);
    if (project && typeof project === 'object' && !Array.isArray(project)) {
      return project as Record<string, unknown> & { access?: unknown[] };
    }
    const accessInfo = await this.loadAccessInfo(opts).catch(() => ({}));
    return {
      access: [],
      ...(accessInfo && typeof accessInfo === 'object' && !Array.isArray(accessInfo)
        ? accessInfo
        : {}),
    } as Record<string, unknown> & { access?: unknown[] };
  }

  async currentUser(opts?: FormioRequestOptions): Promise<Record<string, unknown> | null> {
    return this.request<Record<string, unknown> | null>('/current', 'GET', undefined, opts);
  }

  async loadAccessInfo(opts?: FormioRequestOptions): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/access', 'GET', undefined, opts);
  }

  async logout(opts?: FormioRequestOptions): Promise<unknown> {
    return this.request('/logout', 'GET', undefined, opts);
  }

  /**
   * GET /health — whitelisted, no auth. CE returns 200 when healthy (DB + schema OK).
   * 400 = unhealthy or "Invalid alias" if the server does not reserve "health" in
   * config.reservedForms. At deployment, add "health" to reservedForms in NODE_CONFIG.
   */
  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.request<unknown>('/health', 'GET');
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

function getClientOptions(config: PluginConfigReader): FormioCommunityEditionAPIv5Options {
  return {
    baseUrl: config.getRequired('ADMIN_API_URL'),
    username: config.getRequired('ADMIN_USERNAME'),
    password: config.getRequired('ADMIN_PASSWORD'),
  };
}

let authenticatedClient: FormioCommunityEditionAPIv5Client | null = null;
let authenticatedClientConfigKey: string | null = null;
let authenticatedClientInit: Promise<FormioCommunityEditionAPIv5Client | null> | null = null;

/**
 * Returns a lazily-initialized authenticated client for the given plugin config.
 * Caches by config identity (same config reference reuses client). All options from config.
 */
export async function getAuthenticatedFormioClient(
  config: PluginConfigReader,
): Promise<FormioCommunityEditionAPIv5Client | null> {
  const baseUrl = config.getOptional('ADMIN_API_URL');
  const username = config.getOptional('ADMIN_USERNAME');
  const password = config.getOptional('ADMIN_PASSWORD');
  if (!baseUrl || !username || !password) return null;
  const key = `${baseUrl}:${username}`;
  if (authenticatedClient && authenticatedClientConfigKey === key) return authenticatedClient;
  if (authenticatedClientInit) {
    try {
      const client = await authenticatedClientInit;
      if (client && authenticatedClientConfigKey === key) return client;
    } catch {
      authenticatedClientInit = null;
      authenticatedClient = null;
      authenticatedClientConfigKey = null;
    }
  }
  authenticatedClientInit = (async () => {
    const client = new FormioCommunityEditionAPIv5Client(getClientOptions(config));
    await client.login();
    authenticatedClient = client;
    authenticatedClientConfigKey = key;
    return client;
  })();
  try {
    return await authenticatedClientInit;
  } catch {
    authenticatedClientInit = null;
    authenticatedClient = null;
    authenticatedClientConfigKey = null;
    return null;
  }
}

export async function verifyFormioAuth(config: PluginConfigReader): Promise<{
  ok: boolean;
  hasToken?: boolean;
  error?: string;
  baseUrl?: string;
  username?: string;
}> {
  const baseUrl = config.getOptional('ADMIN_API_URL');
  const username = config.getOptional('ADMIN_USERNAME');
  const password = config.getOptional('ADMIN_PASSWORD');
  if (!username || !password) {
    return {
      ok: false,
      error: 'ADMIN_USERNAME or ADMIN_PASSWORD not set',
      baseUrl: baseUrl ?? undefined,
    };
  }
  if (!baseUrl) {
    return { ok: false, error: 'ADMIN_API_URL not set' };
  }
  try {
    const client = new FormioCommunityEditionAPIv5Client({
      baseUrl,
      username,
      password,
    });
    await client.login();
    return {
      ok: true,
      hasToken: !!client.getToken(),
      baseUrl,
      username: `${username.slice(0, 3)}***`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      baseUrl,
    };
  }
}
