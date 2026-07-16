import {
  OAuth2TokenProvider,
  clearOAuth2TokenCache,
} from '../../../src/core/auth/oauth2TokenProvider';
import { log } from '../../../src/core/logging';

const tokenResponse = (accessToken: string, expiresIn = 3600) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ access_token: accessToken, expires_in: expiresIn }),
  }) as unknown as Response;

describe('OAuth2TokenProvider', () => {
  const origFetch = global.fetch;
  const config = { tokenUrl: 'http://idp.test/token', clientId: 'id', clientSecret: 'secret' };

  afterEach(() => {
    global.fetch = origFetch;
    clearOAuth2TokenCache();
    jest.restoreAllMocks();
  });

  it('fetches a client-credentials token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(tokenResponse('tok-1'));
    global.fetch = fetchMock;

    await expect(new OAuth2TokenProvider(config).getToken()).resolves.toBe('tok-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://idp.test/token');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('grant_type=client_credentials');
    expect(String(init.body)).toContain('client_id=id');
  });

  it('caches the token across calls', async () => {
    const fetchMock = jest.fn().mockResolvedValue(tokenResponse('tok-cache'));
    global.fetch = fetchMock;

    const provider = new OAuth2TokenProvider(config);
    await provider.getToken();
    await provider.getToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('collapses concurrent misses onto a single token request', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(tokenResponse('tok-concurrent')), 10)),
      );
    global.fetch = fetchMock;

    const provider = new OAuth2TokenProvider(config);
    const tokens = await Promise.all([
      provider.getToken(),
      provider.getToken(),
      provider.getToken(),
    ]);

    expect(tokens).toEqual(['tok-concurrent', 'tok-concurrent', 'tok-concurrent']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches after clearCache', async () => {
    const fetchMock = jest.fn().mockResolvedValue(tokenResponse('tok'));
    global.fetch = fetchMock;

    const provider = new OAuth2TokenProvider(config);
    await provider.getToken();
    provider.clearCache();
    await provider.getToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes when the cached token is within the expiry buffer', async () => {
    const fetchMock = jest.fn().mockResolvedValue(tokenResponse('tok', 30));
    global.fetch = fetchMock;

    // 60s buffer against a 30s TTL means the cached token is always "too close" to expiry.
    const provider = new OAuth2TokenProvider({ ...config, refreshBufferMs: 60_000 });
    await provider.getToken();
    await provider.getToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the token request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as unknown as Response);

    await expect(new OAuth2TokenProvider(config).getToken()).rejects.toThrow(
      'OAuth2 token request failed',
    );
  });

  it('logs the caller label and a credentials hint when the token request is rejected', async () => {
    const errorSpy = jest.spyOn(log, 'error').mockImplementation(() => log);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as unknown as Response);

    await expect(
      new OAuth2TokenProvider({ ...config, label: 'cdogs-v2' }).getToken(),
    ).rejects.toThrow('OAuth2 token request failed');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'cdogs-v2', status: 401 }),
      expect.stringContaining('credentials'),
    );
    errorSpy.mockRestore();
  });

  it('throws when the response has no access_token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    await expect(new OAuth2TokenProvider(config).getToken()).rejects.toThrow(
      'missing access_token',
    );
  });
});
