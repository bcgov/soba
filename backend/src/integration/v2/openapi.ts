import { buildOpenApiDocument } from '../../core/api/shared/openapi';
import { env } from '../../core/config/env';
import { registerIntegrationV2OpenApi } from './schema';

// Without INTEGRATION_API_PUBLIC_URL the server is the backend path, which resolves only on the
// integration port.
const server = () => {
  const publicUrl = env.getIntegrationApiPublicUrl();
  return publicUrl
    ? { url: publicUrl, description: 'APS gateway' }
    : { url: `${env.getApiBasePath()}/api/integrations/v2` };
};

export const buildIntegrationV2OpenApiSpec = () =>
  buildOpenApiDocument([registerIntegrationV2OpenApi], {
    info: { title: 'SOBA Integration API', version: '2.0.0' },
    servers: [server()],
    registerSecuritySchemes: (registry) => {
      registry.registerComponent('securitySchemes', 'apiKey', {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY',
        description:
          'Validated by APS key-auth + the Product Environment ACL. The gateway adds a signed GW-JWT for backend verification; clients only supply their API key.',
      });
    },
  });
