import { z } from 'zod';
import { IdirUserSchema, type IdirUser, type IdirUserSearch } from '@soba/lib';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type { UserDirectoryAdapter } from '../../core/integrations/user-directory/UserDirectoryAdapter';
import { OAuth2TokenProvider } from '../../core/auth/oauth2TokenProvider';
import { HttpClient, HttpClientError, resolveTimeoutMs } from '../../core/http/httpClient';
import { ServiceUnavailableError } from '../../core/errors';
import { log } from '../../core/logging';

const CssUserSearchResponseSchema = z.object({ data: z.array(IdirUserSchema) });

export class CssAdapter implements UserDirectoryAdapter {
  private readonly client: HttpClient;
  private readonly tokenProvider: OAuth2TokenProvider;
  private readonly environment: string;

  constructor(config: PluginConfigReader) {
    this.environment = z.enum(['dev', 'test', 'prod']).parse(config.getRequired('ENVIRONMENT'));
    const timeoutMs = resolveTimeoutMs(
      config.getOptionalNumber('TIMEOUT_MS'),
      'PLUGIN_CSS_V1_TIMEOUT_MS',
    );
    this.tokenProvider = new OAuth2TokenProvider({
      tokenUrl: config.getRequired('TOKEN_URL'),
      clientId: config.getRequired('CLIENT_ID'),
      clientSecret: config.getRequired('CLIENT_SECRET'),
      label: 'css-v1',
      timeoutMs,
    });
    this.client = new HttpClient({
      baseUrl: config.getRequired('API_BASE_URL'),
      timeoutMs,
      getToken: (remaining) => this.tokenProvider.getToken(remaining),
    });
  }

  // Validate the credential exchange without running an unfiltered directory search.
  async readinessCheck() {
    try {
      await this.tokenProvider.getToken();
      return { ok: true };
    } catch {
      return { ok: false, message: 'CSS credential exchange failed' };
    }
  }

  async queryIdirUsers(input: IdirUserSearch): Promise<IdirUser[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) if (value) params.set(key, value);
    const path = `${this.environment}/idir/users?${params.toString()}`;
    const deadline = this.client.deadline();
    try {
      let body: unknown;
      try {
        body = await this.client.getJson(path, deadline);
      } catch (err) {
        if (!(err instanceof HttpClientError) || err.status !== 401) throw err;
        this.tokenProvider.clearCache();
        body = await this.client.getJson(path, deadline);
      }
      return CssUserSearchResponseSchema.parse(body).data;
    } catch (err) {
      // Keep credentials, search filters and directory records out of failure logs.
      log.warn(
        {
          plugin: 'css-v1',
          failureType: err instanceof Error ? err.name : 'UnknownError',
          upstreamStatus: err instanceof HttpClientError ? err.status : undefined,
        },
        'CSS user search failed',
      );
      throw new ServiceUnavailableError('CSS user search is unavailable');
    }
  }
}
