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
  {},
  { ...config, INTEGRATION_GATEWAY_AUDIENCE: '' },
  { ...config, INTEGRATION_GATEWAY_ISSUER: 'http://aps.example.test' },
  { ...config, INTEGRATION_GATEWAY_JWKS_URI: 'https://user:password@aps.example.test/certs' },
  { ...config, INTEGRATION_GATEWAY_CLIENT_ID_CLAIM: 'untrusted-header' },
])('disables authentication with incomplete or invalid settings', (source) => {
  expect(resolveIntegrationGatewaySettings(source)).toBeUndefined();
});
