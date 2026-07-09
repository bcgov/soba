import { HttpClient, HttpClientError } from '../../../src/core/clients/httpClient';

const baseUrl = 'https://api.example.com';
const origFetch = global.fetch;

describe('HttpClient', () => {
  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
  });

  // Constructor tests
  it('removes trailing slash from baseUrl', () => {
    const client = new HttpClient({ baseUrl: 'https://api.example.com/' });
    expect(client.getBaseUrl()).toBe('https://api.example.com');
  });

  it('keeps baseUrl without trailing slash', () => {
    const client = new HttpClient({ baseUrl });
    expect(client.getBaseUrl()).toBe(baseUrl);
  });

  it('stores default headers', () => {
    const defaultHeaders = { 'X-Custom': 'value' };
    const client = new HttpClient({ baseUrl, defaultHeaders });
    expect(client.getBaseUrl()).toBe(baseUrl);
  });

  // GET request tests
  it('makes GET request to correct URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const result = await client.get('/endpoint');

    expect(result).toEqual({ result: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/endpoint',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('handles path without leading slash', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    await client.get('endpoint');

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/endpoint', expect.any(Object));
  });

  it('parses JSON response', async () => {
    const responseData = { id: 1, name: 'test' };
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const result = await client.get('/data');

    expect(result).toEqual(responseData);
  });

  it('returns text response when Content-Type is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('plain text response', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    ) as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const result = await client.get('/text');

    expect(result).toBe('plain text response');
  });

  // POST request tests
  it('sends JSON body', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const payload = { name: 'test' };
    const result = await client.post('/create', payload);

    expect(result).toEqual({ id: 1 });
    const call = mockFetch.mock.calls[0];
    expect(call[1]?.body).toBe(JSON.stringify(payload));
    expect(call[1]?.method).toBe('POST');
  });

  it('sends FormData without JSON.stringify', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ hash: 'abc123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const formData = new FormData();
    formData.append('file', new Blob(['content']), 'file.txt');

    await client.post('/upload', formData);

    const call = mockFetch.mock.calls[0];
    expect(call[1]?.body).toBe(formData);
  });

  it('sets Content-Type header for JSON but not FormData', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });

    // Test JSON
    await client.post('/endpoint', { key: 'value' });
    let call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const jsonHeaders = call[1]?.headers as Record<string, string>;
    expect(jsonHeaders['Content-Type']).toBe('application/json');

    // Test FormData - create fresh mock
    mockFetch.mockClear();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const formData = new FormData();
    formData.append('file', new Blob());
    await client.post('/upload', formData);
    call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const formHeaders = call[1]?.headers as Record<string, string>;
    expect(formHeaders['Content-Type']).toBeUndefined();
  });

  // PUT request tests
  it('sends PUT request with JSON body', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ updated: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const payload = { name: 'updated' };
    const result = await client.put('/resource/1', payload);

    expect(result).toEqual({ updated: true });
    const call = mockFetch.mock.calls[0];
    expect(call[1]?.method).toBe('PUT');
    expect(call[1]?.body).toBe(JSON.stringify(payload));
  });

  // DELETE request tests
  it('sends DELETE request', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    await client.delete('/resource/1');

    const call = mockFetch.mock.calls[0];
    expect(call[1]?.method).toBe('DELETE');
  });

  // Bearer token injection tests
  it('includes Authorization header when token provider returns token', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const getToken = jest.fn().mockResolvedValue('my-access-token');
    const client = new HttpClient({ baseUrl, getToken });

    await client.get('/protected');

    const call = mockFetch.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer my-access-token');
    expect(getToken).toHaveBeenCalled();
  });

  it('omits Authorization header when token provider returns null', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const getToken = jest.fn().mockResolvedValue(null);
    const client = new HttpClient({ baseUrl, getToken });

    await client.get('/public');

    const call = mockFetch.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('omits Authorization header when no token provider', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    await client.get('/public');

    const call = mockFetch.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  // Custom headers tests
  it('includes default headers in request', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const defaultHeaders = { 'X-Custom-Header': 'custom-value', 'X-Api-Version': 'v2' };
    const client = new HttpClient({ baseUrl, defaultHeaders });

    await client.get('/endpoint');

    const call = mockFetch.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers['X-Custom-Header']).toBe('custom-value');
    expect(headers['X-Api-Version']).toBe('v2');
  });

  it('merges default headers with implicit Content-Type', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const defaultHeaders = { 'X-Custom': 'value' };
    const client = new HttpClient({ baseUrl, defaultHeaders });

    await client.post('/endpoint', { key: 'value' });

    const call = mockFetch.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers['X-Custom']).toBe('value');
    expect(headers['Content-Type']).toBe('application/json');
  });

  // Error handling tests
  it('throws HttpClientError on non-OK response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' }),
      ) as jest.Mock;

    const client = new HttpClient({ baseUrl });

    await expect(client.get('/missing')).rejects.toThrow(HttpClientError);
  });

  it('HttpClientError contains status, statusText, and body', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('Not Found error message', { status: 404, statusText: 'Not Found' }),
      ) as jest.Mock;

    const client = new HttpClient({ baseUrl });

    try {
      await client.get('/missing');
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError);
      const error = err as HttpClientError;
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
      expect(error.body).toBe('Not Found error message');
    }
  });

  // Status 204 No Content test
  it('returns null for 204 response', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 })) as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const result = await client.delete('/resource/1');

    expect(result).toBeNull();
  });

  // rawRequest tests
  it('rawRequest returns raw Response without parsing', async () => {
    const mockResponse = new Response('raw content', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    const client = new HttpClient({ baseUrl });
    const response = await client.rawRequest('/raw', { method: 'GET' });

    expect(response).toBe(mockResponse);
  });

  it('rawRequest injects Authorization header', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('content', { status: 200 }));
    global.fetch = mockFetch as jest.Mock;

    const getToken = jest.fn().mockResolvedValue('token-123');
    const client = new HttpClient({ baseUrl, getToken });

    await client.rawRequest('/endpoint', { method: 'POST' });

    const call = mockFetch.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-123');
  });

  it('rawRequest merges additional headers with Authorization', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('content', { status: 200 }));
    global.fetch = mockFetch as jest.Mock;

    const getToken = jest.fn().mockResolvedValue('token-123');
    const client = new HttpClient({ baseUrl, getToken });

    await client.rawRequest('/endpoint', {
      method: 'POST',
      headers: { 'X-Custom': 'value' },
    });

    const call = mockFetch.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-123');
    expect(headers['X-Custom']).toBe('value');
  });

  // getBaseUrl tests
  it('getBaseUrl returns the configured base URL without trailing slash', () => {
    const client = new HttpClient({ baseUrl: 'https://api.example.com/' });
    expect(client.getBaseUrl()).toBe('https://api.example.com');
  });

  it('getBaseUrl returns the configured base URL as-is if no trailing slash', () => {
    const client = new HttpClient({ baseUrl });
    expect(client.getBaseUrl()).toBe(baseUrl);
  });

  // URL construction tests
  it('handles path with leading slash', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = mockFetch as jest.Mock;

    const client = new HttpClient({ baseUrl });
    await client.get('/path/to/resource');

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://api.example.com/path/to/resource');
  });
});
