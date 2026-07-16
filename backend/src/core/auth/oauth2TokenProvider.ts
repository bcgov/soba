import { log } from '../logging';

interface CachedToken {
  token: string;
  expiresAt: number;
}

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  /** Refresh this many ms before the token actually expires. Default 60000. */
  refreshBufferMs?: number;
  /** Identifies the caller (e.g. plugin code) in credential-failure logs. */
  label?: string;
}

const DEFAULT_REFRESH_BUFFER_MS = 60_000;
const DEFAULT_EXPIRES_IN_S = 3600;

// Module-level state shared across providers, keyed by tokenUrl + clientId.
const cache = new Map<string, CachedToken>();
const inFlight = new Map<string, Promise<string>>();

/** OAuth2 client-credentials token source with caching. */
export class OAuth2TokenProvider {
  private readonly config: OAuth2Config;
  private readonly cacheKey: string;

  constructor(config: OAuth2Config) {
    this.config = config;
    this.cacheKey = `${config.tokenUrl}:${config.clientId}`;
  }

  async getToken(): Promise<string> {
    const buffer = this.config.refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;
    const cached = cache.get(this.cacheKey);
    if (cached && Date.now() < cached.expiresAt - buffer) {
      return cached.token;
    }
    // Collapse concurrent misses onto a single token request per cache key.
    const pending = inFlight.get(this.cacheKey);
    if (pending) return pending;

    const request = this.fetchAndCache().finally(() => inFlight.delete(this.cacheKey));
    inFlight.set(this.cacheKey, request);
    return request;
  }

  clearCache(): void {
    cache.delete(this.cacheKey);
  }

  private async fetchAndCache(): Promise<string> {
    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      log.error(
        { label: this.config.label, status: res.status, tokenUrl: this.config.tokenUrl },
        'oauth2 token request rejected (check client credentials)',
      );
      throw new Error(`OAuth2 token request failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new Error('OAuth2 token response missing access_token');
    }

    const expiresIn = json.expires_in ?? DEFAULT_EXPIRES_IN_S;
    cache.set(this.cacheKey, {
      token: json.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    return json.access_token;
  }
}

/** Clear all cached tokens (tests / forced refresh). */
export function clearOAuth2TokenCache(): void {
  cache.clear();
  inFlight.clear();
}
