import { HttpClient, HttpClientError, joinUrl } from '../../../src/core/http/httpClient';

const binaryResponse = (body: number[], contentType = 'application/pdf') =>
  ({
    ok: true,
    status: 200,
    headers: new Headers(contentType ? { 'content-type': contentType } : {}),
    arrayBuffer: () => Promise.resolve(Uint8Array.from(body).buffer),
  }) as unknown as Response;

describe('HttpClient', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
  });

  it('joins base + path, posts JSON, and returns the raw bytes', async () => {
    const fetchMock = jest.fn().mockResolvedValue(binaryResponse([1, 2, 3]));
    global.fetch = fetchMock;

    const client = new HttpClient({ baseUrl: 'http://svc.test/api/' });
    const res = await client.postJsonForBinary('/template/render', { a: 1 });

    expect(res).toEqual({ data: Buffer.from([1, 2, 3]), contentType: 'application/pdf' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://svc.test/api/template/render');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('adds a single slash when the path has none', async () => {
    const fetchMock = jest.fn().mockResolvedValue(binaryResponse([9]));
    global.fetch = fetchMock;

    await new HttpClient({ baseUrl: 'http://svc.test' }).postJsonForBinary('render', {});

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://svc.test/render');
  });

  it('injects a bearer token when getToken returns one', async () => {
    const fetchMock = jest.fn().mockResolvedValue(binaryResponse([9]));
    global.fetch = fetchMock;

    const client = new HttpClient({
      baseUrl: 'http://svc.test',
      getToken: () => Promise.resolve('tok-123'),
    });
    await client.postJsonForBinary('/x', {});

    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer tok-123',
    );
  });

  it('omits Authorization when getToken returns null', async () => {
    const fetchMock = jest.fn().mockResolvedValue(binaryResponse([0]));
    global.fetch = fetchMock;

    const client = new HttpClient({
      baseUrl: 'http://svc.test',
      getToken: () => Promise.resolve(null),
    });
    await client.postJsonForBinary('/x', {});

    expect(
      (fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it('throws HttpClientError on a non-2xx response, carrying status, body, and url', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: () => Promise.resolve('bad template'),
    } as unknown as Response);

    const client = new HttpClient({ baseUrl: 'http://svc.test' });
    const err = await client.postJsonForBinary('/x', {}).catch((e) => e);

    expect(err).toBeInstanceOf(HttpClientError);
    expect(err).toMatchObject({ status: 422, body: 'bad template', url: 'http://svc.test/x' });
  });
});

describe('joinUrl', () => {
  it('joins with exactly one slash regardless of stray slashes', () => {
    expect(joinUrl('http://x/api', 'v2')).toBe('http://x/api/v2');
    expect(joinUrl('http://x/api/', 'v2')).toBe('http://x/api/v2');
    expect(joinUrl('http://x/api/', '/v2')).toBe('http://x/api/v2');
  });
});
