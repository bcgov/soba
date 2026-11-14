import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/generate-gateway-config.mjs', import.meta.url));
const fixture = {
  GATEWAY_ID: 'gw-test', GATEWAY_QUALIFIER: 'integration-test',
  GATEWAY_SERVICE_NAME: 'soba-integrations-v2', GATEWAY_HOSTNAME: 'soba.example.test',
  GATEWAY_ROUTE_PATH: '/integrations/v2/', BACKEND_HOST: 'backend.namespace.svc',
};
const integration = {
  GATEWAY_ENVIRONMENT_APP_ID: 'environment-app-id',
  GATEWAY_JWT_ISSUER: 'https://aps.example.test',
};
const render = (args = [], env = {}) => spawnSync(process.execPath, [script, ...args], {
  encoding: 'utf8', env: { ...fixture, ...env },
});

test('keeps the existing public proxy mode without API-key plugins', () => {
  const result = render();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /path: \/chefs\/api\/v1\n/);
  assert.doesNotMatch(result.stdout, /plugins:/);
});
test('renders protected v2 routing, ACL and upstream JWT', () => {
  const result = render(['--integration'], integration);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /path: \/chefs\/api\/integrations\/v2/);
  for (const name of ['key-auth', 'acl', 'kong-upstream-jwt']) {
    assert.ok(result.stdout.includes(`name: ${name}`));
  }
  assert.match(result.stdout, /allow: \["environment-app-id"\]/);
  assert.match(result.stdout, /header: GW-JWT/);
  assert.match(result.stdout, /issuer: "https:\/\/aps.example.test"/);
  assert.match(result.stdout, /key_in_query: false/);
  assert.match(result.stdout, /hide_credentials: true/);
  assert.doesNotMatch(result.stdout, /\$\{/);
});
test('refuses to render protection without its environment appId', () => {
  const result = render(['--integration'], { GATEWAY_JWT_ISSUER: integration.GATEWAY_JWT_ISSUER });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GATEWAY_ENVIRONMENT_APP_ID is required/);
});
test('rejects an insecure issuer URL', () => {
  const result = render(['--integration'], { ...integration, GATEWAY_JWT_ISSUER: 'http://aps.example.test' });
  assert.notEqual(result.status, 0);
});
