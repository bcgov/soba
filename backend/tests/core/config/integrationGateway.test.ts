import { resolveIntegrationGatewaySettings } from '../../../src/core/config/env';

const config = {
  INTEGRATION_GATEWAY_ISSUER: 'https://aps.example.test',
  INTEGRATION_GATEWAY_JWKS_URI: 'https://aps.example.test/certs',
  INTEGRATION_GATEWAY_AUDIENCE: 'soba-integrations',
};
it('reads configured gateway settings and defaults to the signed consumer name', () => {
  expect(resolveIntegrationGatewaySettings(config)).toEqual({
    issuer: config.INTEGRATION_GATEWAY_ISSUER,
    jwksUri: config.INTEGRATION_GATEWAY_JWKS_URI,
    audience: config.INTEGRATION_GATEWAY_AUDIENCE,
    clientIdClaim: 'consumername',
  });
});
it.each([
  [' consumerid ', 'consumerid'],
  ['  ', 'consumername'],
])('trims the client ID claim setting %j', (claim, expected) => {
  expect(
    resolveIntegrationGatewaySettings({ ...config, INTEGRATION_GATEWAY_CLIENT_ID_CLAIM: claim })
      ?.clientIdClaim,
  ).toBe(expected);
});
it.each([
  {},
  { ...config, INTEGRATION_GATEWAY_AUDIENCE: '' },
  { ...config, INTEGRATION_GATEWAY_ISSUER: 'http://aps.example.test' },
  { ...config, INTEGRATION_GATEWAY_JWKS_URI: 'https://user:password@aps.example.test/certs' },
  { ...config, INTEGRATION_GATEWAY_CLIENT_ID_CLAIM: 'untrusted-header' },
])('disables authentication with incomplete or invalid settings', (source) => {
  expect(resolveIntegrationGatewaySettings(source)).toBeUndefined();
});

const local = {
  INTEGRATION_GATEWAY_ISSUER: 'http://localhost:4002',
  INTEGRATION_GATEWAY_JWKS_URI: 'http://127.0.0.1:4002/certs',
  INTEGRATION_GATEWAY_AUDIENCE: 'local-integrations-v2',
};
it('accepts the local dev gateway over plain HTTP in development', () => {
  expect(resolveIntegrationGatewaySettings({ ...local, NODE_ENV: 'development' })).toEqual({
    issuer: local.INTEGRATION_GATEWAY_ISSUER,
    jwksUri: local.INTEGRATION_GATEWAY_JWKS_URI,
    audience: local.INTEGRATION_GATEWAY_AUDIENCE,
    clientIdClaim: 'consumername',
  });
});
it.each([
  { ...local, NODE_ENV: 'production' },
  { ...local },
  {
    ...local,
    NODE_ENV: 'development',
    INTEGRATION_GATEWAY_JWKS_URI: 'http://aps.example.test/certs',
  },
  { ...local, NODE_ENV: 'development', INTEGRATION_GATEWAY_ISSUER: 'http://10.0.0.5:4002' },
])('refuses plain HTTP outside development or off this machine: %j', (source) => {
  expect(resolveIntegrationGatewaySettings(source)).toBeUndefined();
});
