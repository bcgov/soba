import { PluginConfigReader } from '../../core/config/pluginConfig';
import {
  DocumentGenerationAdapter,
  DocumentRenderResult,
} from '../../core/integrations/document-generation/DocumentGenerationAdapter';
import { HttpClient, HttpClientError, joinUrl } from '../../core/http/httpClient';
import { httpErrorToAppError } from '../../core/http/httpErrorMapper';
import { OAuth2TokenProvider } from '../../core/auth/oauth2TokenProvider';
import { log } from '../../core/logging';

const SERVICE = 'CDOGS';
const PLUGIN = 'cdogs-v2';
const RENDER_PATH = '/template/render';

const isTokenRejected = (err: unknown): boolean =>
  err instanceof HttpClientError && err.status === 401;

/** CDOGS v2 document generator. Authenticated via OAuth2 client-credentials. */
export class CdogsV2Adapter implements DocumentGenerationAdapter {
  private readonly http: HttpClient;
  private readonly tokenProvider: OAuth2TokenProvider;

  constructor(config: PluginConfigReader) {
    this.tokenProvider = new OAuth2TokenProvider({
      tokenUrl: config.getRequired('TOKEN_URL'),
      clientId: config.getRequired('CLIENT_ID'),
      clientSecret: config.getRequired('CLIENT_SECRET'),
      label: PLUGIN,
    });
    this.http = new HttpClient({
      baseUrl: joinUrl(config.getRequired('ENDPOINT'), 'v2'),
      getToken: () => this.tokenProvider.getToken(),
    });
  }

  async render(payload: Record<string, unknown>): Promise<DocumentRenderResult> {
    try {
      return await this.attemptRender(payload);
    } catch (err) {
      if (isTokenRejected(err)) {
        log.error(
          { plugin: PLUGIN },
          'CDOGS rejected the access token after refresh — check client credentials/permissions',
        );
      }
      throw httpErrorToAppError(err, SERVICE);
    }
  }

  private async attemptRender(payload: Record<string, unknown>): Promise<DocumentRenderResult> {
    try {
      return await this.http.postJsonForBinary(RENDER_PATH, payload);
    } catch (err) {
      if (!isTokenRejected(err)) throw err;
      // CDOGS rejected our token — drop the cached token and retry once.
      log.warn({ plugin: PLUGIN }, 'CDOGS rejected the access token; refreshing and retrying');
      this.tokenProvider.clearCache();
      return this.http.postJsonForBinary(RENDER_PATH, payload);
    }
  }
}
