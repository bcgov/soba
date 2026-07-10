import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';
import { createCdogsClient } from '../../../src/plugins/cdogs/cdogsClient';

function createPluginConfig(values: Record<string, string | undefined>): PluginConfigReader {
  return {
    getRequired: (key: string) => {
      const value = values[key];
      if (!value) {
        throw new Error(`Missing required key: ${key}`);
      }
      return value;
    },
    getOptional: (key: string, defaultValue?: string) => values[key] ?? defaultValue,
    getBoolean: () => {
      throw new Error('Not used in test');
    },
    getNumber: () => {
      throw new Error('Not used in test');
    },
    getCsv: () => {
      throw new Error('Not used in test');
    },
  };
}

describe('createCdogsClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses unauthenticated requests when token config is incomplete', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response('healthy', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = createCdogsClient(
      createPluginConfig({
        BASE_URL: 'https://cdogs.example.com',
      }),
    );

    await client.getHealth('v2');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const firstCall = mockFetch.mock.calls[0];
    expect(String(firstCall[0])).toBe('https://cdogs.example.com/api/v2/health');
    const headers = new Headers((firstCall[1]?.headers ?? {}) as HeadersInit);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('uses oauth bearer token when token config is complete', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-123', expires_in: 300 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('healthy', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    global.fetch = mockFetch as jest.Mock;

    const client = createCdogsClient(
      createPluginConfig({
        BASE_URL: 'https://cdogs.example.com',
        TOKEN_URL: 'https://sso.example.com/token',
        CLIENT_ID: 'cdogs-client',
        CLIENT_SECRET: 'cdogs-secret',
      }),
    );

    await client.getHealth('v3');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('https://sso.example.com/token');
    expect(String(mockFetch.mock.calls[1]?.[0])).toBe('https://cdogs.example.com/api/v3/health');

    const requestHeaders = new Headers(
      (mockFetch.mock.calls[1]?.[1]?.headers ?? {}) as HeadersInit,
    );
    expect(requestHeaders.get('Authorization')).toBe('Bearer token-123');
  });
});
