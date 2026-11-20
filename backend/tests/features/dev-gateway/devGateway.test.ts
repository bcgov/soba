import http from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createJwksVerifier } from '../../../src/core/auth/jwks';
import { createSigningKey } from '../../../src/features/dev-gateway/keys';
import { createDevGateway } from '../../../src/features/dev-gateway/server';

type Seen = { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string };

const issuer = 'http://127.0.0.1:4002';
const audience = 'local-integrations-v2';
const basePath = '/chefs/api/integrations/v2';
const at = (path: string) => `${basePath}${path}`;
const seen: Seen[] = [];

// A real upstream that records what reached it. /reset drops the connection mid-response.
const upstream = http.createServer((req, res) => {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk: string) => (body += chunk));
  req.on('end', () => {
    seen.push({ method: req.method, url: req.url, headers: req.headers, body });
    if (req.url === at('/hop-response')) {
      res.writeHead(200, { Connection: 'X-Up', 'X-Up': 'drop me', 'X-Kept': 'yes' });
      res.end('ok');
      return;
    }
    if (req.url === at('/reset')) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write('partial');
      setImmediate(() => res.socket?.destroy());
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'x-upstream': 'yes' });
    res.end(JSON.stringify({ ok: true }));
  });
});

let gateway: http.Server;
let base: string;
let gatewayPort: number;

const listen = async (server: http.Server) => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return (server.address() as AddressInfo).port;
};
const close = (server: http.Server) =>
  new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });

/** A request with a raw target and exact headers, which fetch would normalize. */
const raw = (options: http.RequestOptions, chunks: string[] = []) =>
  new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>(
    (resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port: gatewayPort, ...options }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers }),
        );
        res.on('error', reject);
      });
      request.on('error', reject);
      for (const chunk of chunks) request.write(chunk);
      request.end();
    },
  );

beforeAll(async () => {
  const upstreamPort = await listen(upstream);
  gateway = createDevGateway({
    issuer,
    audience,
    upstream: new URL(`http://127.0.0.1:${upstreamPort}`),
    basePath,
    key: createSigningKey(),
  });
  gatewayPort = await listen(gateway);
  base = `http://127.0.0.1:${gatewayPort}`;
});
beforeEach(() => {
  seen.length = 0;
});
afterAll(async () => {
  await close(gateway);
  await close(upstream);
});

describe('dev gateway forwarding', () => {
  it('forwards with the key replaced by a GW-JWT the backend verifier accepts', async () => {
    const response = await fetch(`${base}/chefs/api/integrations/v2/me?x=1`, {
      headers: { 'X-API-KEY': 'dev-data-client', 'X-Request-Id': 'rid-1' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-upstream')).toBe('yes');
    const [request] = seen;
    expect(request.url).toBe('/chefs/api/integrations/v2/me?x=1');
    expect(request.headers['x-api-key']).toBeUndefined();
    expect(request.headers['x-request-id']).toBe('rid-1');
    const token = request.headers['gw-jwt'];
    expect(typeof token).toBe('string');

    const verify = createJwksVerifier({
      jwksUri: `${base}/certs`,
      issuer,
      audience,
      algorithms: ['RS256'],
      maxAge: '2m',
      clockTolerance: 5,
    });
    const payload = await verify(token as string);
    expect(payload).toMatchObject({ consumername: 'dev-data-client', iss: issuer, aud: audience });
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('forwards the method and request body', async () => {
    const response = await fetch(`${base}/chefs/api/integrations/v2/anything`, {
      method: 'POST',
      headers: { 'X-API-KEY': 'k', 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    expect(response.status).toBe(200);
    expect(seen[0]).toMatchObject({ method: 'POST', body: '{"hello":"world"}' });
  });

  it.each(['DELETE', 'GET', 'OPTIONS'])(
    'keeps a chunked %s body framed, so the next request on the connection is intact',
    async (method) => {
      const first = await raw(
        {
          method,
          path: at('/first'),
          headers: { 'X-API-KEY': 'k', 'Transfer-Encoding': 'chunked' },
        },
        ['GET /smuggled HTTP/1.1\r\nHost: x\r\n\r\n', 'tail'],
      );
      const second = await raw({ path: at('/second'), headers: { 'X-API-KEY': 'k' } });
      expect([first.status, second.status]).toEqual([200, 200]);
      expect(seen.map((s) => s.url)).toEqual([at('/first'), at('/second')]);
      expect(seen[0].body).toBe('GET /smuggled HTTP/1.1\r\nHost: x\r\n\r\ntail');
    },
  );

  it.each(['DELETE', 'GET', 'OPTIONS'])(
    'keeps a %s body framed when Connection names Content-Length',
    async (method) => {
      const body = 'GET /smuggled HTTP/1.1\r\nHost: x\r\n\r\n';
      const first = await raw(
        {
          method,
          path: at('/first'),
          headers: {
            'X-API-KEY': 'k',
            Connection: 'keep-alive, Content-Length',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        [body],
      );
      const second = await raw({ path: at('/second'), headers: { 'X-API-KEY': 'k' } });
      expect([first.status, second.status]).toEqual([200, 200]);
      expect(seen.map((s) => s.url)).toEqual([at('/first'), at('/second')]);
      expect(seen[0].body).toBe(body);
    },
  );

  it('refuses a transfer coding other than chunked', async () => {
    const response = await raw(
      {
        method: 'POST',
        path: at('/coded'),
        headers: { 'X-API-KEY': 'k', 'Transfer-Encoding': 'gzip, chunked' },
      },
      ['data'],
    );
    expect(response.status).toBe(501);
    expect(seen).toHaveLength(0);
  });

  it('drops hop-by-hop response headers and any header the upstream Connection names', async () => {
    const response = await raw({ path: at('/hop-response'), headers: { 'X-API-KEY': 'k' } });
    expect(response.status).toBe(200);
    expect(response.headers['x-up']).toBeUndefined();
    expect(response.headers['x-kept']).toBe('yes');
  });

  it('drops hop-by-hop request headers and any header Connection names', async () => {
    await raw({
      path: at('/hop'),
      headers: {
        'X-API-KEY': 'k',
        Connection: 'keep-alive, X-Hop',
        'X-Hop': 'drop me',
        TE: 'trailers',
        'Proxy-Authorization': 'Basic abc',
      },
    });
    const { headers } = seen[0];
    expect(headers['x-hop']).toBeUndefined();
    expect(headers.te).toBeUndefined();
    expect(headers['proxy-authorization']).toBeUndefined();
  });

  it.each(['http://127.0.0.2:9/x', 'https://example.test/x'])(
    'refuses an absolute-form target %s without reaching any host',
    async (path) => {
      const response = await raw({ path, headers: { 'X-API-KEY': 'k' } });
      expect(response.status).toBe(400);
      expect(seen).toHaveLength(0);
    },
  );

  it.each(['//127.0.0.2:9/x', '/\\127.0.0.2:9/x', `//127.0.0.2:9${basePath}/me`, '//[/x'])(
    'refuses a path that names another or an invalid host, %s, without reaching any host',
    async (path) => {
      const response = await raw({ path, headers: { 'X-API-KEY': 'k' } });
      expect(response.status).toBe(404);
      expect(seen).toHaveLength(0);
    },
  );

  it.each([
    '/chefs/api/v1/health',
    '/chefs/api/integrations/v2x/me',
    `${basePath}/../../v1/health`,
    `${basePath}/%2e%2e/%2E%2E/v1/health`,
  ])('answers %s, outside the integration path, with 404 like APS', async (path) => {
    const response = await raw({ path, headers: { 'X-API-KEY': 'k' } });
    expect(response.status).toBe(404);
    expect(seen).toHaveLength(0);
  });

  it('forwards the resolved path, without dot segments', async () => {
    const response = await raw({ path: at('/x/../me?y=2'), headers: { 'X-API-KEY': 'k' } });
    expect(response.status).toBe(200);
    expect(seen.map((s) => s.url)).toEqual([at('/me?y=2')]);
  });

  it.each([undefined, '', '   '])('refuses a request without an API key (%j)', async (key) => {
    const headers: Record<string, string> = key === undefined ? {} : { 'X-API-KEY': key };
    const response = await fetch(`${base}/chefs/api/integrations/v2/me`, { headers });
    expect(response.status).toBe(401);
    expect(seen).toHaveLength(0);
  });

  it('closes the response when the integration API drops the connection mid-body', async () => {
    const response = await fetch(`${base}${at('/reset')}`, { headers: { 'X-API-KEY': 'k' } });
    await expect(response.text()).rejects.toThrow();
  });

  it('returns 502 when the integration API is not reachable', async () => {
    const closed = http.createServer();
    const closedPort = await listen(closed);
    await close(closed);
    const orphan = createDevGateway({
      issuer,
      audience,
      upstream: new URL(`http://127.0.0.1:${closedPort}`),
      basePath,
      key: createSigningKey(),
    });
    const orphanPort = await listen(orphan);
    try {
      const response = await fetch(`http://127.0.0.1:${orphanPort}${at('/x')}`, {
        headers: { 'X-API-KEY': 'k' },
      });
      expect(response.status).toBe(502);
    } finally {
      await close(orphan);
    }
  });

  it('serves its one signing key at /certs', async () => {
    const certs = (await (await fetch(`${base}/certs`)).json()) as {
      keys: { kid: string; kty: string; alg: string }[];
    };
    expect(certs.keys).toHaveLength(1);
    expect(certs.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256' });
  });
});
