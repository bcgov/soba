import { documentGenerationPluginDefinition } from '../../../src/plugins/cdogs-v3';
import { CdogsV3Adapter } from '../../../src/plugins/cdogs-v3/cdogsV3Adapter';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';
import { ServiceUnavailableError } from '../../../src/core/errors';

function makeConfig(): PluginConfigReader {
  const values: Record<string, string> = { ENDPOINT: 'http://cdogs3.test/api' };
  return {
    getRequired: (key: string) => values[key],
    getOptional: (key: string, d?: string) => values[key] ?? d,
    getBoolean: () => false,
    getNumber: () => 0,
    getCsv: () => [],
  };
}

const binaryOk = () =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/pdf' }),
    arrayBuffer: () => Promise.resolve(Uint8Array.from([7, 8]).buffer),
  }) as unknown as Response;

describe('cdogs-v3 plugin', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
  });

  it('declares the expected definition', () => {
    expect(documentGenerationPluginDefinition.code).toBe('cdogs-v3');
    expect(documentGenerationPluginDefinition.metadata).toEqual({
      code: 'cdogs-v3',
      name: 'CDOGS',
      version: 'v3',
    });
  });

  it('renders against the v3 endpoint without authentication', async () => {
    const fetchMock = jest.fn().mockResolvedValue(binaryOk());
    global.fetch = fetchMock;

    const res = await new CdogsV3Adapter(makeConfig()).render({ template: { content: 'x' } });

    expect(res.data).toEqual(Buffer.from([7, 8]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://cdogs3.test/api/v3/template/render');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('maps a transport failure to ServiceUnavailableError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(new CdogsV3Adapter(makeConfig()).render({})).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });
});
