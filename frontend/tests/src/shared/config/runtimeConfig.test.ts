import { describe, expect, it } from 'vitest';
import { isRuntimeConfigPayload } from '@/src/shared/config/runtimeConfig';

describe('isRuntimeConfigPayload', () => {
  it('validates expected payload shape', () => {
    const validPayload = {
      auth: {
        provider: 'keycloak',
        idpPluginDefaultCode: 'bcgov-sso',
        keycloak: {
          url: 'https://dev.loginproxy.gov.bc.ca/auth',
          realm: 'standard',
          clientId: 'connected-services-submit-6349',
          pkceMethod: 'S256',
        },
      },
      api: {
        baseUrl: 'http://localhost:4000/api/v1',
      },
      build: {
        name: 'soba-ui',
        version: '0.1.0',
      },
    };
    expect(isRuntimeConfigPayload(validPayload)).toBe(true);
    expect(isRuntimeConfigPayload({ auth: {}, api: {} })).toBe(false);
  });
});
