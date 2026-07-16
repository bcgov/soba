import { log } from '../logging';

export interface HttpClientOptions {
  baseUrl: string;
  /** Called before each request; returns a bearer token, or null for an unauthenticated call. */
  getToken?: () => Promise<string | null>;
  defaultHeaders?: Record<string, string>;
}

/** Carrier for a non-2xx response. `body` is the raw text; callers map it to a domain error. */
export class HttpClientError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly url: string;

  constructor(status: number, statusText: string, body: string, url: string) {
    super(`HTTP ${status} ${statusText}`);
    this.name = 'HttpClientError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.url = url;
  }
}

export interface BinaryResponse {
  data: Buffer;
  contentType?: string;
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end--;
  return value.slice(0, end);
}

/** Join a base URL and a path segment with exactly one slash, tolerating stray slashes on either side. */
export function joinUrl(base: string, segment: string): string {
  return `${stripTrailingSlashes(base)}/${segment.replace(/^\/+/, '')}`;
}

/**
 * Minimal fetch wrapper for outbound service calls: joins the base URL, injects a bearer
 * token when a provider is supplied, and turns non-2xx responses into HttpClientError.
 * Response decoding is left to the caller-facing methods.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly getToken?: () => Promise<string | null>;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions) {
    this.baseUrl = stripTrailingSlashes(options.baseUrl);
    this.getToken = options.getToken;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  /** POST a JSON body and return the raw response bytes (e.g. a rendered document). */
  async postJsonForBinary(path: string, body: unknown): Promise<BinaryResponse> {
    const res = await this.send(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    return {
      data: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? undefined,
    };
  }

  private buildUrl(path: string): string {
    return joinUrl(this.baseUrl, path);
  }

  private async buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...this.defaultHeaders, ...extra };
    if (this.getToken) {
      const token = await this.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    const url = this.buildUrl(path);
    const headers = await this.buildHeaders(init.headers as Record<string, string> | undefined);
    log.debug({ method: init.method, url }, 'outbound http request');

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpClientError(res.status, res.statusText, text, url);
    }
    return res;
  }
}
