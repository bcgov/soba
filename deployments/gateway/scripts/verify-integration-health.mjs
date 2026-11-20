#!/usr/bin/env node
import { checkIntegrationHealth } from './check-integration-health.mjs';

try {
  const url = await checkIntegrationHealth({
    hostname: process.env.GATEWAY_HOSTNAME,
    routePath: process.env.INTEGRATION_ROUTE_PATH,
    apiKey: process.env.APS_INTEGRATION_HEALTH_API_KEY,
  });
  console.log(`PASS ${url}: unauthenticated=401, authenticated=200, gateway JWT verified`);
} catch {
  // Do not print fetch errors or upstream bodies: either could contain sensitive request data.
  console.error('FAIL protected integration health check (routing, API key, ACL or gateway JWT verification)');
  process.exitCode = 1;
}
