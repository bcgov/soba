jest.mock('../../../../src/core/db/repos/membershipRepo', () => ({
  ...jest.requireActual('../../../../src/core/db/repos/membershipRepo'),
  findActorMembership: jest.fn(),
}));
jest.mock('../../../../src/core/db/repos/formAccessRepo', () => ({
  resolveWorkspacePermissions: jest.fn(),
}));
import { findActorMembership } from '../../../../src/core/db/repos/membershipRepo';
import { resolveWorkspacePermissions } from '../../../../src/core/db/repos/formAccessRepo';
import express from 'express';
import request from 'supertest';
import { identitySearchDomain } from '../../../../src/core/api/identity-search';
import { coreErrorHandler } from '../../../../src/core/middleware/errorHandler';
import {
  getUserDirectoryPlugins,
  resolveUserDirectoryPlugin,
  checkUserDirectoryReadiness,
} from '../../../../src/core/integrations/user-directory/UserDirectoryRegistry';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const app = express();
app.use((req, _res, next) => {
  req.actorId = 'actor-1';
  next();
});
app.use('/api/v1', identitySearchDomain.router);
app.use(coreErrorHandler);
const user = {
  username: 'abc@idir',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
};
const saved = { ...process.env };
let server: Server | undefined;
let baseUrl: string;
let status = 200;
let body: unknown = { data: [user] };
let requests: { url: string; authorization?: string }[];
let rejectFirstToken = false;
let rawBody: string | undefined;
let stall = false;

beforeEach(async () => {
  jest
    .mocked(findActorMembership)
    .mockResolvedValue({ role: 'admin', displayLabel: 'Admin' } as NonNullable<
      Awaited<ReturnType<typeof findActorMembership>>
    >);
  jest.mocked(resolveWorkspacePermissions).mockResolvedValue(new Set(['team_update']));
  rawBody = undefined;
  stall = false;
  requests = [];
  status = 200;
  body = { data: [user] };
  rejectFirstToken = false;
  server = createServer((req, res) => {
    requests.push({ url: req.url!, authorization: req.headers.authorization });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/token') {
      res.end(JSON.stringify({ access_token: 'service-token', expires_in: 3600 }));
      return;
    }
    if (rejectFirstToken) {
      rejectFirstToken = false;
      res.statusCode = 401;
      res.end('{}');
      return;
    }
    res.statusCode = status;
    if (stall) return;
    res.end(rawBody ?? JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  Object.assign(process.env, {
    USER_DIRECTORY_DEFAULT_CODE: 'css-v1',
    PLUGIN_CSS_V1_API_BASE_URL: `${baseUrl}/api/v1`,
    PLUGIN_CSS_V1_ENVIRONMENT: 'dev',
    PLUGIN_CSS_V1_TOKEN_URL: `${baseUrl}/token`,
    PLUGIN_CSS_V1_CLIENT_ID: 'css-client',
    PLUGIN_CSS_V1_CLIENT_SECRET: 'css-secret',
  });
});
afterEach(async () => {
  process.env = { ...saved };
  server!.closeAllConnections();
  await new Promise<void>((resolve) => server!.close(() => resolve()));
});

it('discovers CSS and rejects an unknown plugin', () => {
  expect(getUserDirectoryPlugins().map((p) => p.code)).toEqual(['css-v1']);
  expect(() => resolveUserDirectoryPlugin('missing')).toThrow();
});
it('uses CSS when no directory code is configured', async () => {
  delete process.env.USER_DIRECTORY_DEFAULT_CODE;
  const res = await request(app).get(
    '/api/v1/identity-search/idir?workspaceId=workspace-1&firstName=Alice',
  );
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ users: [user] });
  expect(requests).toHaveLength(2);
});
it.each([{}, { firstName: ' ' }, { firstName: ['a', 'b'] }, { other: 'x' }])(
  'rejects invalid search %j without calling CSS',
  async (query) => {
    const res = await request(app)
      .get('/api/v1/identity-search/idir')
      .query({ workspaceId: 'workspace-1', ...query });
    expect(res.status).toBe(400);
    expect(requests).toHaveLength(0);
  },
);
it('forwards filters and uses a service token', async () => {
  const res = await request(app)
    .get('/api/v1/identity-search/idir')
    .query({ workspaceId: 'workspace-1', firstName: ' Alice ', email: 'alice+test@example.com' });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ users: [user] });
  const forwarded = new URL(requests[1].url, baseUrl);
  expect(forwarded.pathname).toBe('/api/v1/dev/idir/users');
  expect(forwarded.searchParams.get('firstName')).toBe('Alice');
  expect(forwarded.searchParams.get('email')).toBe('alice+test@example.com');
  expect(requests[1].authorization).toBe('Bearer service-token');
});
it('refreshes a rejected token once', async () => {
  rejectFirstToken = true;
  const res = await request(app).get(
    '/api/v1/identity-search/idir?workspaceId=workspace-1&guid=abc',
  );
  expect(res.status).toBe(200);
  expect(requests.filter((r) => r.url === '/token')).toHaveLength(2);
});
it.each([400, 403, 500])('maps upstream %s to 503 without upstream details', async (code) => {
  status = code;
  body = { secret: 'upstream-detail' };
  const res = await request(app).get(
    '/api/v1/identity-search/idir?workspaceId=workspace-1&lastName=Smith',
  );
  expect(res.status).toBe(503);
  expect(JSON.stringify(res.body)).not.toContain('upstream-detail');
});
it.each([{ invalid: true }, { data: {} }, { data: [{ email: 'alice@example.com' }] }])(
  'rejects malformed upstream data %j',
  async (response) => {
    body = response;
    expect(
      (await request(app).get('/api/v1/identity-search/idir?workspaceId=workspace-1&guid=abc'))
        .status,
    ).toBe(503);
  },
);
it('unwraps an empty CSS search result', async () => {
  body = { data: [] };
  const res = await request(app).get(
    '/api/v1/identity-search/idir?workspaceId=workspace-1&lastName=Smith',
  );
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ users: [] });
});
it('reports missing configuration without failing readiness', async () => {
  delete process.env.PLUGIN_CSS_V1_CLIENT_SECRET;
  const results = await checkUserDirectoryReadiness();
  expect(results['css-v1'].ok).toBe(false);
  expect(Object.keys(results)).toEqual(['css-v1']);
});

it('rejects non-JSON responses', async () => {
  rawBody = '<html>not CSS</html>';
  expect(
    (await request(app).get('/api/v1/identity-search/idir?workspaceId=workspace-1&guid=abc'))
      .status,
  ).toBe(503);
});
it('times out a stalled directory request', async () => {
  stall = true;
  process.env.PLUGIN_CSS_V1_TIMEOUT_MS = '100';
  expect(
    (await request(app).get('/api/v1/identity-search/idir?workspaceId=workspace-1&guid=abc'))
      .status,
  ).toBe(503);
});

it('requires workspace context', async () => {
  const res = await request(app).get('/api/v1/identity-search/idir?firstName=Alice');
  expect(res.status).toBe(400);
  expect(requests).toHaveLength(0);
});
it.each(['member', 'viewer'])(
  'refuses workspace %s even with wildcard permissions',
  async (role) => {
    jest.mocked(findActorMembership).mockResolvedValue({ role, displayLabel: 'User' });
    jest.mocked(resolveWorkspacePermissions).mockResolvedValue(new Set(['*']));
    const res = await request(app).get(
      '/api/v1/identity-search/idir?workspaceId=workspace-1&firstName=Alice',
    );
    expect(res.status).toBe(403);
    expect(requests).toHaveLength(0);
  },
);
it('refuses users outside the workspace', async () => {
  jest.mocked(findActorMembership).mockResolvedValue(null);
  const res = await request(app).get(
    '/api/v1/identity-search/idir?workspaceId=workspace-1&firstName=Alice',
  );
  expect(res.status).toBe(403);
  expect(requests).toHaveLength(0);
});
it.each(['owner', 'admin'])('allows workspace %s without form permissions', async (role) => {
  jest.mocked(findActorMembership).mockResolvedValue({ role, displayLabel: 'Manager' });
  jest.mocked(resolveWorkspacePermissions).mockClear();
  jest.mocked(resolveWorkspacePermissions).mockResolvedValue(new Set());
  const res = await request(app).get(
    '/api/v1/identity-search/idir?workspaceId=workspace-1&firstName=Alice',
  );
  expect(res.status).toBe(200);
  expect(resolveWorkspacePermissions).not.toHaveBeenCalled();
  expect(requests[1].url).not.toContain('workspaceId');
});

it('returns 503 when the default CSS directory is not configured', async () => {
  delete process.env.USER_DIRECTORY_DEFAULT_CODE;
  delete process.env.PLUGIN_CSS_V1_CLIENT_SECRET;
  const res = await request(app).get(
    '/api/v1/identity-search/idir?workspaceId=workspace-1&firstName=Alice',
  );
  expect(res.status).toBe(503);
  expect(requests).toHaveLength(0);
});
