import { buildOpenApiDocument } from '../../core/api/shared/openapi';
import { env } from '../../core/config/env';
import { registerIntegrationV2OpenApi } from './schema';

export const buildIntegrationV2OpenApiSpec = () =>
  buildOpenApiDocument([registerIntegrationV2OpenApi], {
    info: { title: 'SOBA Integration API', version: '2.0.0' },
    servers: [{ url: `${env.getApiBasePath()}/api/integrations/v2` }],
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
