jest.mock('../../../src/core/db/repos/workspaceCredentialRepo', () => ({
  findActiveApiCredential: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/formRepo', () => ({ getWorkspaceIdForForm: jest.fn() }));
jest.mock('../../../src/core/db/repos/formAccessRepo', () => ({
  resolveFormPermissions: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/featureRepo', () => ({ isFeatureEnabledCached: jest.fn() }));
jest.mock('../../../src/core/db/repos/submissionExportRepo', () => ({
  isVersionOfForm: jest.fn(),
}));
jest.mock('../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry', () => ({
  resolveDefaultCredentialIssuerCode: () => 'aps',
}));
jest.mock('jwks-rsa', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/features/submission-export/engineSource', () => ({
  ...jest.requireActual('../../../src/features/submission-export/engineSource'),
  exportSchemas: jest.fn(),
  formAnswerReader: jest.fn(),
}));
jest.mock('../../../src/features/submission-export/submissionQuery', () => ({
  submissionExportQuery: { count: jest.fn(), pages: jest.fn() },
}));

import { restoreAppTestEnvironment } from '../fixtures/appEnvironment';
import { credentialFixture, submissionFixture, testIds } from '../fixtures/data';
import { gatewayJwtFixture } from '../fixtures/gatewayJwt';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import {
  findActiveApiCredential,
  type CredentialRecord,
} from '../../../src/core/db/repos/workspaceCredentialRepo';
import { getWorkspaceIdForForm } from '../../../src/core/db/repos/formRepo';
import { resolveFormPermissions } from '../../../src/core/db/repos/formAccessRepo';
import { isFeatureEnabledCached } from '../../../src/core/db/repos/featureRepo';
import {
  exportSchemas,
  formAnswerReader,
} from '../../../src/features/submission-export/engineSource';
import { submissionExportQuery } from '../../../src/features/submission-export/submissionQuery';
import { createApp } from '../../../src/createApp';
import { integrationV2Router } from '../../../src/integration/v2/routes';
import { IntegrationMeResponseSchema } from '../../../src/integration/v2/schema';
import { buildIntegrationV2OpenApiSpec } from '../../../src/integration/v2/openapi';

const formId = testIds.form;
const base = '/chefs/api/integrations/v2';
const exportPath = `/forms/${formId}/submissions/export`;
// Every mounted/documented operation must explicitly declare its access policy here.
const operations = [
  { method: 'get', path: '/health', access: 'public' },
  { method: 'get', path: '/openapi.json', access: 'public' },
  { method: 'get', path: '/me', access: 'apiKey' },
  { method: 'get', path: '/forms/{formId}/submissions/export', access: 'apiKey' },
] as const;
const protectedOperations = operations
  .filter((op) => op.access === 'apiKey')
  .map(({ method, path }) => ({ method, path: path.replace('{formId}', formId) }));
const getSigningKey = jest.fn();
jest.mocked(jwksRsa).mockReturnValue({ getSigningKey } as unknown as ReturnType<typeof jwksRsa>);
const settings = {
  INTEGRATION_GATEWAY_ISSUER: 'https://security.example.test',
  INTEGRATION_GATEWAY_JWKS_URI: 'https://security.example.test/certs',
  INTEGRATION_GATEWAY_AUDIENCE: 'integration-security-test',
  INTEGRATION_GATEWAY_CLIENT_ID_CLAIM: 'consumername',
};
const original = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
const app = createApp();
const gateway = gatewayJwtFixture(
  settings.INTEGRATION_GATEWAY_ISSUER,
  settings.INTEGRATION_GATEWAY_AUDIENCE,
  'client',
);
const token = (overrides: jwt.SignOptions = {}) => gateway.sign({}, overrides);
let credential: CredentialRecord | null;
let permissions: Set<string>;
const readAnswers = jest.fn();
const record = submissionFixture();
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(jwksRsa).mockReturnValue({ getSigningKey } as unknown as ReturnType<typeof jwksRsa>);
  Object.assign(process.env, settings);
  getSigningKey.mockResolvedValue({
    getPublicKey: () => gateway.publicKey,
  });
  credential = credentialFixture();
  permissions = new Set(['submission_read']);
  jest.mocked(findActiveApiCredential).mockImplementation(async () => credential);
  jest.mocked(getWorkspaceIdForForm).mockResolvedValue(testIds.workspace);
  jest.mocked(resolveFormPermissions).mockImplementation(async () => permissions);
  jest.mocked(isFeatureEnabledCached).mockResolvedValue(true);
  jest.mocked(exportSchemas).mockResolvedValue([
    {
      versionId: testIds.version,
      schema: { components: [{ key: 'answer', type: 'textfield', input: true }] },
    },
  ]);
  readAnswers.mockImplementation(async () => ({
    found: new Map([['document', { data: { answer: 'allowed' } }]]),
    missing: [],
  }));
  jest.mocked(formAnswerReader).mockResolvedValue(readAnswers);
  jest.mocked(submissionExportQuery.pages).mockImplementation(async function* () {
    yield [record];
  });
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  restoreAppTestEnvironment();
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
const getExport = (format = 'json') =>
  request(app)
    .get(base + exportPath + `?format=${format}`)
    .set('GW-JWT', token());

describe('Endpoint inventory and access policies', () => {
  it('keeps all documented methods, paths and security policies aligned with the inventory', () => {
    const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
    const documented = Object.entries(buildIntegrationV2OpenApiSpec().paths).flatMap(
      ([path, item]) =>
        Object.entries(item)
          .filter(([method]) => methods.has(method))
          .map(([method, operation]) => ({
            method,
            path,
            security: (operation as { security?: unknown }).security,
          })),
    );
    expect(documented).toEqual(
      expect.arrayContaining(
        operations.map(({ method, path, access }) => ({
          method,
          path,
          security: access === 'public' ? [] : [{ apiKey: [] }],
        })),
      ),
    );
    expect(documented).toHaveLength(operations.length);
  });

  it('keeps actual route registrations aligned with every documented method and path', () => {
    const registered = integrationV2Router.stack.flatMap((layer) => {
      // Nested routers need an explicit inventory update, not a silent coverage gap.
      expect(Reflect.get(layer.handle, 'stack')).toBeUndefined();
      if (!layer.route) return [];
      // Express exposes methods at runtime but its IRoute type does not declare the property.
      const methods: unknown = Reflect.get(layer.route, 'methods');
      if (typeof methods !== 'object' || methods === null)
        throw new Error('Route methods are unavailable');
      expect(typeof layer.route.path).toBe('string');
      return Object.entries(methods)
        .filter(([, enabled]) => enabled === true)
        .map(([method]) => ({
          method,
          path: layer.route!.path,
        }));
    });
    expect(registered).toEqual(
      expect.arrayContaining(
        operations.map(({ method, path }) => ({
          method,
          path: path.replace('{formId}', ':formId'),
        })),
      ),
    );
    expect(registered).toHaveLength(operations.length);
  });
});

describe('Gateway authentication and identity', () => {
  it.each(protectedOperations)(
    'rejects unsigned identity and raw API keys at $method $path',
    async ({ method, path }) => {
      const res = await request(app)
        [method](base + path)
        .set('X-API-KEY', 'not-backend-auth')
        .set('X-Consumer-Username', 'client')
        .set('Authorization', 'Bearer forged');
      expect(res.status).toBe(401);
      expect(findActiveApiCredential).not.toHaveBeenCalled();
      expect(submissionExportQuery.pages).not.toHaveBeenCalled();
    },
  );

  it.each(protectedOperations)(
    'rejects the wrong audience at $method $path before credential lookup',
    async ({ method, path }) => {
      expect(
        (
          await request(app)
            [method](base + path)
            .set('GW-JWT', token({ audience: 'other-service' }))
        ).status,
      ).toBe(401);
      expect(findActiveApiCredential).not.toHaveBeenCalled();
    },
  );

  it.each(protectedOperations)(
    'requires an active local credential at $method $path',
    async ({ method, path }) => {
      credential = null;
      expect(
        (
          await request(app)
            [method](base + path)
            .set('GW-JWT', token())
        ).status,
      ).toBe(401);
    },
  );

  it('returns credential metadata that satisfies the public identity contract', async () => {
    const response = await request(app)
      .get(base + '/me')
      .set('GW-JWT', token());
    expect(response.status).toBe(200);
    expect(IntegrationMeResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe('Export authorization and responses', () => {
  it.each(['json', 'csv'])(
    'exports %s through real authentication, authorization and serialization',
    async (format) => {
      const res = await getExport(format);
      expect(res.status).toBe(200);
      expect(res.text).toContain('allowed');
      expect(findActiveApiCredential).toHaveBeenCalledWith('aps', 'client');
      expect(resolveFormPermissions).toHaveBeenCalledWith(
        testIds.creator,
        testIds.workspace,
        formId,
      );
    },
  );

  it.each([
    { overrides: { workspaceId: testIds.otherWorkspace }, status: 404, error: 'Form not found' },
    { overrides: { formId: testIds.otherForm }, status: 404, error: 'Form not found' },
    {
      overrides: { permissions: [] },
      status: 403,
      error: 'Submission read access is required for this form',
    },
  ])(
    'refuses unauthorized key scope/grants with $status: $overrides',
    async ({ overrides, status, error }) => {
      Object.assign(credential!, overrides);
      const response = await getExport();
      expect(response.status).toBe(status);
      expect(response.body).toEqual({ error });
      expect(submissionExportQuery.pages).not.toHaveBeenCalled();
      expect(readAnswers).not.toHaveBeenCalled();
    },
  );

  it('denies creator permission loss before opening the export', async () => {
    permissions.clear();
    expect((await getExport()).status).toBe(403);
    expect(readAnswers).not.toHaveBeenCalled();
  });

  it.each([
    { change: 'revoke', status: 401, body: { error: 'API credential is not active' } },
    {
      change: 'remove-grant',
      status: 403,
      body: { error: 'Submission read access is required for this form' },
    },
    {
      change: 'remove-creator-permission',
      status: 403,
      body: { error: 'Submission read access is required for this form' },
    },
    {
      change: 'disable-feature',
      status: 404,
      body: { error: 'Not found', code: 'route_not_found' },
    },
  ])(
    'returns $status without a partial file when $change happens between pages',
    async ({ change, status, body }) => {
      const secondPage = jest.fn();
      jest.mocked(submissionExportQuery.pages).mockImplementation(async function* () {
        yield [record];
        secondPage();
        yield [record];
      });
      readAnswers.mockImplementationOnce(async () => {
        if (change === 'revoke') credential = null;
        if (change === 'remove-grant') credential!.permissions = [];
        if (change === 'remove-creator-permission') permissions.clear();
        if (change === 'disable-feature')
          jest.mocked(isFeatureEnabledCached).mockResolvedValue(false);
        return {
          found: new Map([['document', { data: { answer: 'must-not-leak' } }]]),
          missing: [],
        };
      });
      const res = await getExport();
      expect(res.status).toBe(status);
      expect(res.body).toEqual(body);
      expect(secondPage).not.toHaveBeenCalled();
      expect(res.text).not.toContain('must-not-leak');
      expect(res.headers['content-disposition']).toBeUndefined();
    },
  );
});

describe('Request deadlines', () => {
  it('times out stalled schema loading and never starts the data query afterward', async () => {
    const deadline = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    let release!: (value: Awaited<ReturnType<typeof exportSchemas>>) => void;
    jest.mocked(exportSchemas).mockImplementationOnce(() => {
      const pending = new Promise<Awaited<ReturnType<typeof exportSchemas>>>((resolve) => {
        release = resolve;
      });
      deadline.abort(new Error('deadline'));
      return pending;
    });
    const res = await getExport();
    expect(res.status).toBe(503);
    expect(res.text).toContain('Export timed out');
    expect(AbortSignal.timeout).toHaveBeenCalledWith(60_000);
    release([]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(submissionExportQuery.pages).not.toHaveBeenCalled();
    expect(readAnswers).not.toHaveBeenCalled();
  });

  it('times out a stalled database page without sending buffered JSON', async () => {
    const deadline = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    jest.mocked(submissionExportQuery.pages).mockImplementation(async function* () {
      deadline.abort(new Error('deadline'));
      await new Promise<void>(() => {});
      yield [record];
    });
    const res = await getExport();
    expect(res.status).toBe(503);
    expect(res.text).not.toContain('allowed');
    expect(readAnswers).not.toHaveBeenCalled();
  });
});

describe('CSV data integrity', () => {
  it.each(['all', 'one'])(
    'returns 503 without a partial CSV when %s required schemas are missing',
    async (missing) => {
      if (missing === 'all') jest.mocked(exportSchemas).mockResolvedValueOnce([]);
      else
        jest.mocked(submissionExportQuery.pages).mockImplementationOnce(async function* () {
          yield [record];
          yield [{ ...record, versionId: 'missing-version' }];
        });
      const response = await getExport('csv');
      expect(response.status).toBe(503);
      expect(response.text).toContain('Some submission schemas are unavailable');
      expect(response.text).not.toContain('allowed');
      expect(response.headers['content-disposition']).toBeUndefined();
    },
  );
});

describe('Production middleware and staff authentication boundaries', () => {
  it.each(protectedOperations)(
    'routes $method $path through application middleware without requiring a staff login',
    async ({ method, path }) => {
      const response = await request(app)
        [method](base + path)
        .set('X-Request-Id', 'integration-middleware-regression')
        .set('Authorization', 'Bearer invalid-staff-token')
        .set('GW-JWT', token());
      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBe('integration-middleware-regression');
      expect(response.headers['ratelimit']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    },
  );

  it('does not accept gateway authentication on the staff API', async () => {
    const response = await request(app).get('/chefs/api/v1/me').set('GW-JWT', token());
    expect(response.status).toBe(401);
    expect(findActiveApiCredential).not.toHaveBeenCalled();
  });

  it.each(['/health', '/openapi.json'])(
    'keeps the intended public integration probe %s reachable through the app mount',
    async (path) => {
      expect((await request(app).get(base + path)).status).toBe(200);
      expect(findActiveApiCredential).not.toHaveBeenCalled();
    },
  );
});

describe('Iterator and response cleanup', () => {
  it('closes the real export source after JSON exceeds the response size limit', async () => {
    const close = jest.fn();
    const nextPage = jest.fn();
    jest.mocked(submissionExportQuery.pages).mockImplementationOnce(async function* () {
      try {
        yield [record];
        nextPage();
        yield [record];
      } finally {
        close();
      }
    });
    readAnswers.mockResolvedValueOnce({
      found: new Map([['document', { data: { answer: 'x'.repeat(10 * 1024 * 1024) } }]]),
      missing: [],
    });
    const response = await getExport('json');
    expect(response.status).toBe(413);
    // Closing the serializer is asynchronous so HTTP timeout handling never waits on a stuck reader.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(close).toHaveBeenCalledTimes(1);
    expect(nextPage).not.toHaveBeenCalled();
  });

  it('closes the page iterator when CSV schema validation rejects a row', async () => {
    const close = jest.fn();
    const nextPage = jest.fn();
    jest.mocked(exportSchemas).mockResolvedValueOnce([]);
    jest.mocked(submissionExportQuery.pages).mockImplementationOnce(async function* () {
      try {
        yield [record];
        nextPage();
        yield [record];
      } finally {
        close();
      }
    });
    expect((await getExport('csv')).status).toBe(503);
    expect(close).toHaveBeenCalledTimes(1);
    expect(nextPage).not.toHaveBeenCalled();
  });
});
