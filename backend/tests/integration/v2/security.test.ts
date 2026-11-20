jest.mock('../../../src/core/db/repos/workspaceCredentialRepo', () => ({
  findActiveApiCredential: jest.fn(),
}));
jest.mock('../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));
jest.mock('../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry', () => ({
  resolveDefaultCredentialIssuerCode: () => 'aps',
}));
jest.mock('jwks-rsa', () => {
  const actual = jest.requireActual<typeof import('jwks-rsa')>('jwks-rsa');
  return {
    __esModule: true,
    default: Object.assign(jest.fn(), { expressJwtSecret: actual.expressJwtSecret }),
  };
});

import { restoreAppTestEnvironment } from '../fixtures/appEnvironment';
import { credentialFixture } from '../fixtures/data';
import { gatewayJwtFixture } from '../fixtures/gatewayJwt';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import {
  findActiveApiCredential,
  type CredentialRecord,
} from '../../../src/core/db/repos/workspaceCredentialRepo';
import { isFeatureAvailable } from '../../../src/core/services/featureAvailabilityService';
import { createApp } from '../../../src/createApp';
import { createIntegrationApp } from '../../../src/integration/createIntegrationApp';
import { integrationV2Router } from '../../../src/integration/v2/routes';
import { IntegrationMeResponseSchema } from '../../../src/integration/v2/schema';
import { buildIntegrationV2OpenApiSpec } from '../../../src/integration/v2/openapi';

const base = '/chefs/api/integrations/v2';
// Every mounted/documented operation must be listed here. The spec declares the gateway API key on
// all of them; backendAuth is whether the backend itself requires the gateway JWT.
const operations = [
  { method: 'get', path: '/health', backendAuth: false },
  { method: 'get', path: '/openapi.json', backendAuth: false },
  { method: 'get', path: '/me', backendAuth: true },
] as const;
const protectedOperations = operations
  .filter((op) => op.backendAuth)
  .map(({ method, path }) => ({ method, path }));
const getSigningKey = jest.fn();
jest.mocked(jwksRsa).mockReturnValue({ getSigningKey } as unknown as ReturnType<typeof jwksRsa>);
const settings = {
  INTEGRATION_GATEWAY_ISSUER: 'https://security.example.test',
  INTEGRATION_GATEWAY_JWKS_URI: 'https://security.example.test/certs',
  INTEGRATION_GATEWAY_AUDIENCE: 'integration-security-test',
  INTEGRATION_GATEWAY_CLIENT_ID_CLAIM: 'consumername',
};
const original = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
const app = createIntegrationApp();
const staffApp = createApp();
const gateway = gatewayJwtFixture(
  settings.INTEGRATION_GATEWAY_ISSUER,
  settings.INTEGRATION_GATEWAY_AUDIENCE,
  'client',
);
const token = (overrides: jwt.SignOptions = {}) => gateway.sign({}, overrides);
let credential: CredentialRecord | null;
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(jwksRsa).mockReturnValue({ getSigningKey } as unknown as ReturnType<typeof jwksRsa>);
  Object.assign(process.env, settings);
  getSigningKey.mockResolvedValue({
    getPublicKey: () => gateway.publicKey,
  });
  credential = credentialFixture();
  jest.mocked(findActiveApiCredential).mockImplementation(async () => credential);
  jest.mocked(isFeatureAvailable).mockResolvedValue(true);
});
afterAll(() => {
  restoreAppTestEnvironment();
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

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
        operations.map(({ method, path }) => ({ method, path, security: [{ apiKey: [] }] })),
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
      expect.arrayContaining(operations.map(({ method, path }) => ({ method, path }))),
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
    const response = await request(staffApp).get('/chefs/api/v1/me').set('GW-JWT', token());
    expect(response.status).toBe(401);
    expect(findActiveApiCredential).not.toHaveBeenCalled();
  });

  it.each(operations.filter((op) => !op.backendAuth).map(({ path }) => path))(
    'serves %s without a gateway JWT at the backend',
    async (path) => {
      const response = await request(app).get(base + path);
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit']).toBeDefined();
      expect(findActiveApiCredential).not.toHaveBeenCalled();
    },
  );
});

describe('Listener separation', () => {
  it.each(operations.map(({ path }) => path))(
    'does not serve integration %s on the main API port',
    async (path) => {
      const response = await request(staffApp)
        .get(base + path)
        .set('GW-JWT', token());
      expect(response.status).toBe(404);
      expect(findActiveApiCredential).not.toHaveBeenCalled();
    },
  );

  it.each(['/chefs/api/v1/health', `${base}/nope`])(
    'answers %s on the integration port with a rate-limited 404',
    async (path) => {
      const response = await request(app).get(path);
      expect(response.status).toBe(404);
      expect(response.headers['ratelimit']).toBeDefined();
    },
  );
});

describe('Published specification', () => {
  it('publishes the integration spec on the main API docs, matching the inventory', async () => {
    const response = await request(staffApp).get('/chefs/api/docs/integrations/v2/openapi.json');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths).sort()).toEqual(
      operations.map(({ path }) => path).sort(),
    );
  });

  it('offers both specs in the docs page selector', async () => {
    const init = await request(staffApp).get('/chefs/api/docs/swagger-ui-init.js');
    expect(init.status).toBe(200);
    expect(init.text).toContain('"url": "/chefs/api/docs/openapi.json"');
    expect(init.text).toContain('"url": "/chefs/api/docs/integrations/v2/openapi.json"');
    // swagger-ui-express hides the selector with this rule unless explorer is on.
    const page = await request(staffApp).get('/chefs/api/docs/');
    expect(page.status).toBe(200);
    expect(page.text).not.toContain('download-url-wrapper { display: none }');
  });
});

describe('Rate limits', () => {
  const remaining = (response: { headers: Record<string, unknown> }) => {
    const match = /remaining=(\d+)/.exec(String(response.headers['ratelimit']));
    if (!match) throw new Error('RateLimit header missing');
    return Number(match[1]);
  };
  const unverifiedMe = () => request(app).get(base + '/me');
  const meAs = (consumername: string) =>
    request(app)
      .get(base + '/me')
      .set('GW-JWT', gateway.sign({ consumername }));

  it('counts /me per gateway consumer, so consumers behind one gateway address do not share a limit', async () => {
    const first = await meAs('rate-a');
    const again = await meAs('rate-a');
    const other = await meAs('rate-b');
    expect([first.status, again.status, other.status]).toEqual([200, 200, 200]);
    expect(remaining(again)).toBe(remaining(first) - 1);
    expect(remaining(other)).toBe(remaining(first));
  });

  it('counts /me requests that fail gateway verification, but not verified ones', async () => {
    const first = await unverifiedMe();
    const verified = await meAs('rate-verified');
    const again = await unverifiedMe();
    expect([first.status, verified.status, again.status]).toEqual([401, 200, 401]);
    expect(remaining(again)).toBe(remaining(first) - 1);
  });

  it('counts /me calls refused for an unknown or inactive key', async () => {
    credential = null;
    const first = await meAs('rate-refused');
    const again = await meAs('rate-refused');
    expect([first.status, again.status]).toEqual([401, 401]);
    expect(remaining(again)).toBe(remaining(first) - 1);
  });
});
