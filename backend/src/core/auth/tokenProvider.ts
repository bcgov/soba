/**
 * Generic token provider interface.
 * Abstracts different ways to obtain tokens (OAuth2, API keys, JWT signing, etc.)
 *
 * Any service integration can use a TokenProvider to get authentication credentials.
 * This enables swapping implementations (e.g., OAuth2 for production, hardcoded for tests).
 */

export interface TokenProvider {
  /**
   * Get a token for authentication.
   * @returns Token string, or null if unauthenticated/no token available
   */
  getToken(): Promise<string | null>;

  /**
   * Clear any cached state (tokens, etc).
   * Useful for testing or force-refresh scenarios.
   */
  clearCache?(): void;
}

/**
 * A token provider that always returns null.
 * Use when a service doesn't require authentication.
 */
export class NoOpTokenProvider implements TokenProvider {
  async getToken(): Promise<null> {
    return null;
  }
}

/**
 * A token provider with a static token.
 * Use for testing or simple API key auth.
 */
export class StaticTokenProvider implements TokenProvider {
  constructor(private readonly token: string) {}

  async getToken(): Promise<string> {
    return this.token;
  }
}
