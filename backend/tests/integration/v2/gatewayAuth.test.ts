jest.mock('../../../src/core/db/repos/workspaceCredentialRepo', () => ({
  findActiveApiCredential: jest.fn(),
}));
jest.mock('../../../src/core/services/featureAvailabilityService', () => ({
  isFeatureAvailable: jest.fn(),
}));
jest.mock('../../../src/core/integrations/credential-issuer/CredentialIssuerRegistry', () => ({
  resolveDefaultCredentialIssuerCode: () => 'aps',
}));
jest.mock('jwks-rsa', () => ({ __esModule: true, default: jest.fn() }));

import { credentialFixture, testIds } from '../fixtures/data';
import { gatewayJwtFixture } from '../fixtures/gatewayJwt';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { env } from '../../../src/core/config/env';
import { findActiveApiCredential } from '../../../src/core/db/repos/workspaceCredentialRepo';
import { isFeatureAvailable } from '../../../src/core/services/featureAvailabilityService';
import { integrationV2Router } from '../../../src/integration/v2/routes';
import { buildIntegrationV2OpenApiSpec } from '../../../src/integration/v2/openapi';

const getSigningKey = jest.fn();
jest.mocked(jwksRsa).mockReturnValue({ getSigningKey } as unknown as ReturnType<typeof jwksRsa>);
const issuer = 'https://aps.example.test';
const audience = 'soba-integrations';
const config = {
  INTEGRATION_GATEWAY_ISSUER: issuer,
  INTEGRATION_GATEWAY_JWKS_URI: `${issuer}/certs`,
  INTEGRATION_GATEWAY_AUDIENCE: audience,
  INTEGRATION_GATEWAY_CLIENT_ID_CLAIM: 'consumername',
};
const original = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
const app = express();
app.use('/', integrationV2Router);
const gateway = gatewayJwtFixture(issuer, audience, 'aps-client');
const { keys, otherKeys, publicKey } = gateway;
const token = gateway.sign;
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(jwksRsa).mockReturnValue({ getSigningKey } as unknown as ReturnType<typeof jwksRsa>);
  Object.assign(process.env, config);
  getSigningKey.mockResolvedValue({ getPublicKey: () => publicKey });
  jest
    .mocked(findActiveApiCredential)
    .mockResolvedValue(credentialFixture({ clientId: 'aps-client' }));
  jest.mocked(isFeatureAvailable).mockResolvedValue(true);
});
afterAll(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('Signed identity mapping and header trust', () => {
  it('uses signed consumername and ignores forged identity headers', async () => {
    const response = await request(app)
      .get('/me')
      .set('GW-JWT', token())
      .set('X-Consumer-Username', 'victim')
      .set('X-API-KEY', 'secret');
    expect(response.status).toBe(200);
    expect(findActiveApiCredential).toHaveBeenCalledWith('aps', 'aps-client');
    expect(response.body).not.toHaveProperty('headers');
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(getSigningKey).toHaveBeenCalledWith('aps-key');
  });

  it('allows an explicitly configured signed consumerid mapping', async () => {
    process.env.INTEGRATION_GATEWAY_CLIENT_ID_CLAIM = 'consumerid';
    expect((await request(app).get('/me').set('GW-JWT', token())).status).toBe(200);
    expect(findActiveApiCredential).toHaveBeenCalledWith('aps', 'kong-id');
  });

  it('does not trust an unsigned client ID or any gateway header other than GW-JWT', async () => {
    expect(
      (
        await request(app)
          .get('/me')
          .set('X-Consumer-Username', 'aps-client')
          .set('X-Gateway-Token', 'not-a-gateway-jwt')
      ).status,
    ).toBe(401);
    expect(findActiveApiCredential).not.toHaveBeenCalled();
  });
});

describe('JWT and credential rejection', () => {
  it.each([
    ['wrong issuer', () => token({}, { issuer: 'https://other.example.test' })],
    ['wrong audience', () => token({}, { audience: 'other-service' })],
    ['expired', () => token({}, { expiresIn: -60 })],
    ['too old', () => token({ iat: Math.floor(Date.now() / 1000) - 300 }, { expiresIn: 600 })],
    ['future issue time', () => token({ iat: Math.floor(Date.now() / 1000) + 60 })],
    ['missing identity', () => token({ consumername: '' })],
    [
      'missing expiration',
      () =>
        jwt.sign({ consumername: 'aps-client' }, keys.privateKey, {
          algorithm: 'RS256',
          keyid: 'aps-key',
          issuer,
          audience,
        }),
    ],
    [
      'invalid signature',
      () =>
        jwt.sign({ consumername: 'aps-client' }, otherKeys.privateKey, {
          algorithm: 'RS256',
          keyid: 'aps-key',
          issuer,
          audience,
          expiresIn: 60,
        }),
    ],
    [
      'wrong algorithm',
      () =>
        jwt.sign({ consumername: 'aps-client' }, 'secret', {
          algorithm: 'HS256',
          issuer,
          audience,
          expiresIn: 60,
        }),
    ],
  ])('rejects %s before credential lookup', async (_label, makeToken) => {
    expect((await request(app).get('/me').set('GW-JWT', makeToken())).status).toBe(401);
    expect(findActiveApiCredential).not.toHaveBeenCalled();
  });

  it('reports unreadable signing keys as 503 without exposing the error', async () => {
    getSigningKey.mockRejectedValue(new Error('private internal detail'));
    const response = await request(app).get('/me').set('GW-JWT', token());
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('private internal detail');
    expect(findActiveApiCredential).not.toHaveBeenCalled();
  });

  it('rejects a token naming a signing key the key set does not hold as 401', async () => {
    getSigningKey.mockRejectedValue(
      Object.assign(new Error('Unable to find a signing key that matches'), {
        name: 'SigningKeyNotFoundError',
      }),
    );
    const response = await request(app).get('/me').set('GW-JWT', token());
    expect(response.status).toBe(401);
    expect(findActiveApiCredential).not.toHaveBeenCalled();
  });

  it('fails closed without configured issuer, JWKS URI or audience', async () => {
    for (const key of [
      'INTEGRATION_GATEWAY_ISSUER',
      'INTEGRATION_GATEWAY_JWKS_URI',
      'INTEGRATION_GATEWAY_AUDIENCE',
    ]) {
      Object.assign(process.env, config);
      delete process.env[key];
      expect((await request(app).get('/me').set('GW-JWT', token())).status).toBe(503);
    }
  });

  it('rejects an unknown or inactive API credential', async () => {
    jest.mocked(findActiveApiCredential).mockResolvedValue(null);
    expect((await request(app).get('/me').set('GW-JWT', token())).status).toBe(401);
  });

  it.each([
    { workspaceId: testIds.workspace, formId: null },
    { workspaceId: testIds.workspace, formId: '00000000-0000-4000-8000-000000000009' },
  ])('rejects a key where the api-keys feature is unavailable: %j', async (scope) => {
    jest
      .mocked(findActiveApiCredential)
      .mockResolvedValue(credentialFixture({ clientId: 'aps-client', ...scope }));
    jest.mocked(isFeatureAvailable).mockResolvedValue(false);
    const response = await request(app).get('/me').set('GW-JWT', token());
    expect(response.status).toBe(401);
    expect(isFeatureAvailable).toHaveBeenCalledWith('api-keys', scope);
  });
});

describe('Gateway proof on health', () => {
  it('reports unreadable signing keys on health as 503', async () => {
    getSigningKey.mockRejectedValue(new Error('key set down'));
    const response = await request(app).get('/health').set('GW-JWT', token());
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('key set down');
  });

  it('verifies the gateway hop on health without requiring a local credential record', async () => {
    jest.mocked(findActiveApiCredential).mockResolvedValue(null);
    const response = await request(app).get('/health').set('GW-JWT', token());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'OK', gatewayAuthenticated: true });
    expect(findActiveApiCredential).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rejects invalid gateway proof on health instead of returning a healthy result', async () => {
    expect(
      (
        await request(app)
          .get('/health')
          .set('GW-JWT', token({}, { audience: 'wrong' }))
      ).status,
    ).toBe(401);
  });
});

describe('Public probes and OpenAPI contract', () => {
  it('keeps health and OpenAPI public at the backend', async () => {
    delete process.env.INTEGRATION_GATEWAY_ISSUER;
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/openapi.json')).status).toBe(200);
  });

  it('documents integration security and gateway error schemas independently of staff auth', () => {
    const spec = buildIntegrationV2OpenApiSpec();
    expect(Object.keys(spec.paths).sort()).toEqual(['/health', '/me', '/openapi.json']);
    expect(spec.paths['/me'].get.security).toEqual([{ apiKey: [] }]);
    expect(spec.components.securitySchemes).not.toHaveProperty('bearerAuth');
    expect(spec.components.schemas).toHaveProperty('IntegrationV2_MeResponse');
    expect(spec.paths['/me'].get.responses['503']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Core_ApiError' } } },
    });
    expect(spec.paths['/me'].get.responses['403']).toMatchObject({
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/IntegrationV2_GatewayError' } },
      },
    });
  });

  it.each([
    {
      publicUrl: 'https://gateway.example.test/pr/1/integrations/v2',
      servers: [
        { url: 'https://gateway.example.test/pr/1/integrations/v2', description: 'APS gateway' },
      ],
    },
    { publicUrl: undefined, servers: [{ url: `${env.getApiBasePath()}/api/integrations/v2` }] },
    { publicUrl: '  ', servers: [{ url: `${env.getApiBasePath()}/api/integrations/v2` }] },
  ])('lists the server for a gateway URL of $publicUrl', ({ publicUrl, servers }) => {
    const previous = process.env.INTEGRATION_API_PUBLIC_URL;
    if (publicUrl === undefined) delete process.env.INTEGRATION_API_PUBLIC_URL;
    else process.env.INTEGRATION_API_PUBLIC_URL = publicUrl;
    try {
      expect(buildIntegrationV2OpenApiSpec().servers).toEqual(servers);
    } finally {
      if (previous === undefined) delete process.env.INTEGRATION_API_PUBLIC_URL;
      else process.env.INTEGRATION_API_PUBLIC_URL = previous;
    }
  });
});
