import { devGatewayConfigProblem } from '../../../src/features/dev-gateway/config';

const upstream = new URL('http://127.0.0.1:4001');

describe('devGatewayConfigProblem', () => {
  it.each(['http://127.0.0.1:4002/certs', 'http://localhost:4002/certs'])(
    'accepts the backend fetching keys from this gateway: %s',
    (jwksUri) => {
      expect(devGatewayConfigProblem({ jwksUri, port: 4002, upstream })).toBeNull();
    },
  );

  it.each([
    'https://aps-jwks-upstream-jwt.api.gov.bc.ca/certs',
    'http://127.0.0.1:4003/certs',
    'http://127.0.0.1:4002/keys',
    'http://10.0.0.5:4002/certs',
  ])('refuses a JWKS URI that is not this gateway: %s', (jwksUri) => {
    expect(devGatewayConfigProblem({ jwksUri, port: 4002, upstream })).toMatch(
      /INTEGRATION_GATEWAY_JWKS_URI/,
    );
  });

  it('accepts the default HTTP port when the gateway listens on it', () => {
    expect(
      devGatewayConfigProblem({ jwksUri: 'http://127.0.0.1/certs', port: 80, upstream }),
    ).toBeNull();
  });

  it.each([0, -1, 65536, 4002.5])('refuses port %s', (port) => {
    expect(devGatewayConfigProblem({ jwksUri: 'http://127.0.0.1/certs', port, upstream })).toMatch(
      /DEV_GATEWAY_PORT/,
    );
  });

  it.each([
    'https://127.0.0.1:4001',
    'http://soba-dev-backend.svc:4001',
    'http://127.0.0.1:4001/chefs',
    'http://127.0.0.1:4001/?x=1',
    'http://user:secret@127.0.0.1:4001',
  ])('refuses an upstream that is not plain HTTP on this machine: %s', (target) => {
    expect(
      devGatewayConfigProblem({
        jwksUri: 'http://127.0.0.1:4002/certs',
        port: 4002,
        upstream: new URL(target),
      }),
    ).toMatch(/DEV_GATEWAY_UPSTREAM/);
  });
});
