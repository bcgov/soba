import { log } from '../logging';
import { TokenProvider } from './tokenProvider';

/**
 * OAuth2 client-credentials token provider with caching.
 * Implements the TokenProvider interface for OAuth2 flows.
 */

interface TokenCache {
  token: string;
  expiresAt: number;
}

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  /** Buffer time in milliseconds before token expiry to refresh. Default: 60000 (1 minute). */
  refreshBufferMs?: number;
}

const tokenCache: Map<string, TokenCache> = new Map();

/**
 * OAuth2 client-credentials token provider.
 * Handles token fetching with intelligent caching.
 */
export class OAuth2TokenProvider implements TokenProvider {
  private readonly config: OAuth2Config;
  private readonly cacheKey: string;

  constructor(config: OAuth2Config, cacheKey?: string) {
    this.config = config;
    this.cacheKey = cacheKey || `${config.tokenUrl}:${config.clientId}`;
  }

  async getToken(): Promise<string> {
    const refreshBuffer = this.config.refreshBufferMs ?? 60000; // 1 minute default

    // Check cache (refresh if within buffer before expiry)
    const cached = tokenCache.get(this.cacheKey);
    if (cached && Date.now() < cached.expiresAt - refreshBuffer) {
      log.debug({ service: this.cacheKey }, 'Using cached OAuth2 token');
      return cached.token;
    }

    log.debug(
      { service: this.cacheKey, tokenUrl: this.config.tokenUrl },
      'Fetching new OAuth2 token',
    );

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'client_credentials',
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`OAuth2 token request failed ${res.status}: ${text}`);
      log.error({ service: this.cacheKey, status: res.status, error }, 'OAuth2 token fetch failed');
      throw error;
    }

    interface TokenResponse {
      access_token?: string;
      expires_in?: number;
    }

    const json = (await res.json()) as TokenResponse;
    const token = json.access_token;

    if (!token) {
      const error = new Error('OAuth2 token response missing access_token');
      log.error({ service: this.cacheKey }, 'OAuth2 token response invalid');
      throw error;
    }

    const expiresIn = json.expires_in ?? 3600; // Default 1 hour
    const expiresAt = Date.now() + expiresIn * 1000;

    tokenCache.set(this.cacheKey, { token, expiresAt });
    log.debug({ service: this.cacheKey, expiresInSeconds: expiresIn }, 'OAuth2 token cached');

    return token;
  }

  clearCache(): void {
    tokenCache.delete(this.cacheKey);
  }
}

/**
 * Create an OAuth2 token provider.
 * Wraps token fetch errors to return null (for optional auth scenarios).
 *
 * @param config OAuth2 configuration
 * @param cacheKey Optional cache key for multiple services
 * @returns Function that returns token or null on error
 */
export function createOAuth2TokenProvider(
  config: OAuth2Config,
  cacheKey?: string,
): () => Promise<string | null> {
  const provider = new OAuth2TokenProvider(config, cacheKey);
  return async () => {
    try {
      return await provider.getToken();
    } catch (err) {
      // Log but return null to allow unauthenticated fallback
      log.error({ error: err, cacheKey }, 'OAuth2 token fetch failed, allowing unauthenticated');
      return null;
    }
  };
}

/**
 * Clear global OAuth2 token cache.
 * Useful for testing or force-refresh scenarios.
 */
export function clearOAuth2TokenCache(): void {
  tokenCache.clear();
}
