import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import request from 'supertest';
import { meRouter } from '../../../../src/core/api/me';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';

const USER_ID = 'F45AFBBD68C44D6F956BA3A1D9181399';

const TENANT = {
  id: 'f98cbbfb-b96c-4a40-a10b-c2a7e795022c',
  name: 'Roads initiative',
  ministryName: 'Ministry of Transportation',
  description: 'Road works',
  createdDateTime: '2024-03-21',
  updatedDateTime: '2024-03-21',
  createdBy: USER_ID,
  updatedBy: USER_ID,
};

// Stands in for checkJwt + resolveActor, which need a signed token; everything after is real.
function buildApp(claims: Record<string, unknown>) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { idpAttributes: claims } as Express.User;
    req.actorId = 'actor-1';
    next();
  });
  app.use('/api/v1', meRouter);
  app.use(coreErrorHandler);
  return app;
}

const idirApp = () => buildApp({ identity_provider: 'idir', idir_user_guid: USER_ID });

// Stands in for CSTAR under /api/v1 and records what each request carried.
async function startCstar(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const requests: { url?: string; authorization?: string }[] = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const json = (status: number, body: unknown) => (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

describe('GET /me/tenants', () => {
  const saved = { ...process.env };
  let cstar: Awaited<ReturnType<typeof startCstar>> | undefined;
  afterEach(async () => {
    process.env = { ...saved };
    await cstar?.close();
    cstar = undefined;
  });

  async function useCstar(handler: (req: IncomingMessage, res: ServerResponse) => void) {
    cstar = await startCstar(handler);
    process.env.TENANT_ENGINE_DEFAULT_CODE = 'cstar-v1';
    process.env.PLUGIN_CSTAR_V1_API_BASE_URL = cstar.baseUrl;
    return cstar;
  }

  it('returns no tenants from the default noop engine', async () => {
    delete process.env.TENANT_ENGINE_DEFAULT_CODE;

    const res = await request(idirApp())
      .get('/api/v1/me/tenants')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tenants: [] });
  });

  it("returns the caller's CSTAR tenants", async () => {
    const server = await useCstar(json(200, { data: { tenants: [TENANT] } }));

    const res = await request(idirApp())
      .get('/api/v1/me/tenants')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tenants: [TENANT] });
    expect(server.requests).toEqual([
      { url: `/api/v1/users/${USER_ID}/tenants`, authorization: 'Bearer tok' },
    ]);
  });

  it('forwards a token sent in X-Jwt-Token as a bearer token', async () => {
    const server = await useCstar(json(200, { data: { tenants: [] } }));

    const res = await request(idirApp()).get('/api/v1/me/tenants').set('X-Jwt-Token', 'tok');

    expect(res.status).toBe(200);
    expect(server.requests[0].authorization).toBe('Bearer tok');
  });

  it('returns no tenants for an identity provider CSTAR does not serve', async () => {
    const server = await useCstar(json(200, { data: { tenants: [TENANT] } }));

    const res = await request(buildApp({ identity_provider: 'bcservicescard', sub: 'S1' }))
      .get('/api/v1/me/tenants')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tenants: [] });
    expect(server.requests).toHaveLength(0);
  });

  it('answers 503 when CSTAR rejects the call', async () => {
    await useCstar(json(401, { message: 'Unauthorized' }));

    const res = await request(idirApp())
      .get('/api/v1/me/tenants')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'CSTAR error 401' });
  });

  it.each([
    ['the configured engine is not installed', 'cstar'],
    ['the engine is missing its config', 'cstar-v1'],
  ])('answers 503 without config detail when %s', async (_label, code) => {
    process.env.TENANT_ENGINE_DEFAULT_CODE = code;
    delete process.env.PLUGIN_CSTAR_V1_API_BASE_URL;

    const res = await request(idirApp())
      .get('/api/v1/me/tenants')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Tenant engine is unavailable' });
  });

  it('answers 400 when the request carries no token', async () => {
    const res = await request(idirApp()).get('/api/v1/me/tenants');

    expect(res.status).toBe(400);
  });
});
