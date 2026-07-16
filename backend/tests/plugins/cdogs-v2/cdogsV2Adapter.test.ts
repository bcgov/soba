import { documentGenerationPluginDefinition } from '../../../src/plugins/cdogs-v2';
import { CdogsV2Adapter } from '../../../src/plugins/cdogs-v2/cdogsV2Adapter';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';
import { clearOAuth2TokenCache } from '../../../src/core/auth/oauth2TokenProvider';
import { ServiceUnavailableError, UnprocessableEntityError } from '../../../src/core/errors';
import { log } from '../../../src/core/logging';

function makeConfig(): PluginConfigReader {
  const values: Record<string, string> = {
    ENDPOINT: 'http://cdogs.test/api',
    TOKEN_URL: 'http://idp.test/token',
    CLIENT_ID: 'client',
    CLIENT_SECRET: 'secret',
  };
  return {
    getRequired: (key: string) => values[key],
    getOptional: (key: string, d?: string) => values[key] ?? d,
    getBoolean: () => false,
    getNumber: () => 0,
    getCsv: () => [],
  };
}

const tokenOk = () =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
  }) as unknown as Response;

const binaryOk = () =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/pdf' }),
    arrayBuffer: () => Promise.resolve(Uint8Array.from([1, 2, 3]).buffer),
  }) as unknown as Response;

describe('cdogs-v2 plugin', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
    clearOAuth2TokenCache();
  });

  it('declares the expected definition', () => {
    expect(documentGenerationPluginDefinition.code).toBe('cdogs-v2');
    expect(documentGenerationPluginDefinition.metadata).toEqual({
      code: 'cdogs-v2',
      name: 'CDOGS',
      version: 'v2',
    });
  });

  it('renders against the v2 endpoint with a bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(binaryOk());
    global.fetch = fetchMock;

    const res = await new CdogsV2Adapter(makeConfig()).render({ template: { content: 'x' } });

    expect(res).toEqual({ data: Buffer.from([1, 2, 3]), contentType: 'application/pdf' });

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://idp.test/token');
    const [renderUrl, renderInit] = fetchMock.mock.calls[1];
    expect(renderUrl).toBe('http://cdogs.test/api/v2/template/render');
    expect((renderInit.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('clears the token and retries once when a render is rejected with 401', async () => {
    const unauthorized = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('token expired'),
    } as unknown as Response;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(tokenOk()) // initial token
      .mockResolvedValueOnce(unauthorized) // render rejected
      .mockResolvedValueOnce(tokenOk()) // refreshed token
      .mockResolvedValueOnce(binaryOk()); // render succeeds
    global.fetch = fetchMock;

    const res = await new CdogsV2Adapter(makeConfig()).render({ template: { content: 'x' } });

    expect(res.data).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('logs an identifiable auth failure when the 401 persists after refresh', async () => {
    const errorSpy = jest.spyOn(log, 'error').mockImplementation(() => log);
    const unauthorized = () =>
      ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('token rejected'),
      }) as unknown as Response;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(unauthorized());

    await expect(new CdogsV2Adapter(makeConfig()).render({})).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ plugin: 'cdogs-v2' }),
      expect.stringContaining('credentials'),
    );
    errorSpy.mockRestore();
  });

  it('maps an upstream 422 to UnprocessableEntityError', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve('bad template'),
      } as unknown as Response);
    global.fetch = fetchMock;

    await expect(new CdogsV2Adapter(makeConfig()).render({})).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );
  });
});
