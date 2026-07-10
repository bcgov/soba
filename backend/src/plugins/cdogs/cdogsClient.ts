import { createOAuth2TokenProvider, OAuth2Config } from '../../core/auth/oauth2TokenProvider';
import { HttpClient } from '../../core/clients/httpClient';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type { DocumentGenerationVersion } from '../../core/integrations/cdogs/documentGenerationAdapter';

export class CdogsApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CdogsApiError';
    this.status = status;
  }
}

export class CdogsClient {
  private readonly client: HttpClient;

  constructor(options: { baseUrl: string; getToken?: () => Promise<string | null> }) {
    this.client = new HttpClient({
      baseUrl: options.baseUrl,
      getToken: options.getToken,
    });
  }

  async uploadTemplate(
    version: DocumentGenerationVersion,
    body: Buffer,
    contentType?: string,
  ): Promise<globalThis.Response> {
    return this.request(`/api/${version}/template`, {
      method: 'POST',
      body: new Uint8Array(body),
      headers: contentType ? { 'Content-Type': contentType } : undefined,
    });
  }

  async renderTemplate(
    version: DocumentGenerationVersion,
    payload: unknown,
  ): Promise<globalThis.Response> {
    return this.request(`/api/${version}/template/render`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async renderTemplateByHash(
    version: DocumentGenerationVersion,
    hash: string,
    payload: unknown,
  ): Promise<globalThis.Response> {
    return this.request(`/api/${version}/template/${encodeURIComponent(hash)}/render`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getTemplate(
    version: DocumentGenerationVersion,
    hash: string,
  ): Promise<globalThis.Response> {
    return this.request(`/api/${version}/template/${encodeURIComponent(hash)}`, {
      method: 'GET',
    });
  }

  async deleteTemplate(
    version: DocumentGenerationVersion,
    hash: string,
  ): Promise<globalThis.Response> {
    return this.request(`/api/${version}/template/${encodeURIComponent(hash)}`, {
      method: 'DELETE',
    });
  }

  async getFileTypes(version: DocumentGenerationVersion): Promise<globalThis.Response> {
    return this.request(`/api/${version}/file-types`, {
      method: 'GET',
    });
  }

  async getHealth(version: DocumentGenerationVersion): Promise<globalThis.Response> {
    return this.request(`/api/${version}/health`, {
      method: 'GET',
    });
  }

  private async request(path: string, options: RequestInit): Promise<globalThis.Response> {
    try {
      return await this.client.rawRequest(path, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reach CDOGS';
      throw new CdogsApiError(message);
    }
  }
}

export function createCdogsClient(pluginConfig: PluginConfigReader): CdogsClient {
  const tokenUrl = pluginConfig.getOptional('TOKEN_URL');
  const clientId = pluginConfig.getOptional('CLIENT_ID');
  const clientSecret = pluginConfig.getOptional('CLIENT_SECRET');

  let tokenProvider: (() => Promise<string | null>) | undefined;
  if (tokenUrl && clientId && clientSecret) {
    const oauthConfig: OAuth2Config = {
      tokenUrl,
      clientId,
      clientSecret,
    };
    tokenProvider = createOAuth2TokenProvider(oauthConfig, 'cdogs');
  }

  return new CdogsClient({
    baseUrl: pluginConfig.getRequired('BASE_URL'),
    getToken: tokenProvider,
  });
}
