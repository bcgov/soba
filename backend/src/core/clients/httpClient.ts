import { log } from '../logging';

/**
 * Generic HTTP client for calling external services with optional authentication.
 * Handles:
 * - Optional Bearer token (OAuth2 or other)
 * - Automatic header injection
 * - Error wrapping
 * - JSON request/response handling
 *
 * This is a reusable base for plugins that need to call external services.
 * Plugins should extend or compose this for service-specific behavior.
 */

export interface HttpClientOptions {
  baseUrl: string;
  /**
   * Optional token provider. Called before each request.
   * Should return a token string or null (for unauthenticated requests).
   */
  getToken?: () => Promise<string | null>;
  /**
   * Custom headers to include in all requests.
   * Authorization header will be added automatically if token is available.
   */
  defaultHeaders?: Record<string, string>;
}

export class HttpClientError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`HTTP ${status}: ${statusText}\n${body}`);
    this.name = 'HttpClientError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly getToken?: () => Promise<string | null>;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getToken = options.getToken;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  /**
   * Prepare headers for a request.
   * Includes default headers and Authorization if token available.
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const headers = { ...this.defaultHeaders };

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Make a GET request.
   */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  /**
   * Make a POST request.
   */
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  /**
   * Make a PUT request.
   */
  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  /**
   * Make a DELETE request.
   */
  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  /**
   * Make a generic request.
   * Automatically handles:
   * - URL construction
   * - Authorization headers
   * - Error handling
   * - JSON response parsing
   */
  private async request<T = unknown>(path: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = await this.getHeaders();

    // Merge default content-type for JSON unless FormData
    const isFormData = options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    log.debug({ method: options.method, url }, 'HTTP request');

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpClientError(res.status, res.statusText, body);
    }

    // For empty responses, return null as T
    if (res.status === 204) {
      return null as T;
    }

    const contentType = res.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
      return res.json() as Promise<T>;
    }

    return (await res.text()) as T;
  }

  /**
   * Make a raw fetch request with full control.
   * Automatically injects Authorization header if available.
   */
  async rawRequest(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = await this.getHeaders();

    return fetch(url, {
      ...options,
      headers: { ...options.headers, ...headers },
    });
  }

  /**
   * Get the base URL (useful for subclasses or logging).
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
