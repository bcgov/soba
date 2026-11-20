// Must be first: initializes .env + .env.local for this process.
import { env } from '../../core/config/env';
env.loadEnv();

import { devGatewayConfigProblem } from './config';
import { createSigningKey } from './keys';
import { CERTS_PATH, createDevGateway } from './server';

// Console output, like the dev-data CLI: the dev log format prints fields but not messages.
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

if (!env.isDevelopment()) fail('The dev gateway runs only with NODE_ENV=development');

const settings =
  env.getIntegrationGatewaySettings() ??
  fail(
    'Set valid INTEGRATION_GATEWAY_ISSUER, INTEGRATION_GATEWAY_JWKS_URI and INTEGRATION_GATEWAY_AUDIENCE for the dev gateway; see backend/.env.example',
  );
const port = env.getNumberEnv('DEV_GATEWAY_PORT') ?? 4002;
const upstream = new URL(
  env.getOptionalEnv('DEV_GATEWAY_UPSTREAM') ?? `http://127.0.0.1:${env.getIntegrationPort()}`,
);
const problem = devGatewayConfigProblem({ jwksUri: settings.jwksUri, port, upstream });
if (problem) fail(problem);
const basePath = `${env.getApiBasePath()}/api/integrations/v2`;

// Loopback only: the gateway signs a token for any key value it is sent.
createDevGateway({
  issuer: settings.issuer,
  audience: settings.audience,
  upstream,
  basePath,
  key: createSigningKey(),
})
  .on('error', (error: Error) =>
    fail(`Dev gateway could not listen on 127.0.0.1:${port}: ${error.message}`),
  )
  .listen(port, '127.0.0.1', () => {
    console.log(
      `Dev gateway listening on http://127.0.0.1:${port}, forwarding ${basePath} to ${upstream.origin}`,
    );
    console.log(`  issuer ${settings.issuer}, audience ${settings.audience}`);
    console.log(`  signing key at http://127.0.0.1:${port}${CERTS_PATH}`);
  });
