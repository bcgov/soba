import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIntegrationHealth } from '../scripts/check-integration-health.mjs';

const options = { hostname: 'soba.example.test', routePath: '/pr/123/integrations/v2/', apiKey: 'ci-secret' };
const healthy = { status: 'OK', timestamp: '2026-11-10T00:00:00Z', gatewayAuthenticated: true };
const responder = (replies, calls = []) => async (url, init) => {
  calls.push({ url, init });
  return replies.shift();
};
test('checks key rejection then verified gateway health without forwarding a key to redirects', async () => {
  const calls = [];
  const url = await checkIntegrationHealth({ ...options, fetchImpl: responder([
    new Response(null, { status: 401 }), Response.json(healthy),
  ], calls) });
  assert.equal(url, 'https://soba.example.test/pr/123/integrations/v2/health');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers, undefined);
  assert.deepEqual(calls[1].init.headers, { 'X-API-KEY': 'ci-secret' });
  assert.ok(calls.every(({ init }) => init.redirect === 'error'));
});
test('refuses an unprotected health route even if it returns OK', async () => {
  await assert.rejects(checkIntegrationHealth({ ...options, fetchImpl: responder([Response.json(healthy)]) }), /expected 401/);
});
test('fails when the API key is rejected by the ACL', async () => {
  await assert.rejects(checkIntegrationHealth({ ...options, fetchImpl: responder([
    new Response(null, { status: 401 }), new Response('untrusted body', { status: 403 }),
  ]) }), /HTTP 403/);
});
test('requires backend verification rather than only an OK response', async () => {
  await assert.rejects(checkIntegrationHealth({ ...options, fetchImpl: responder([
    new Response(null, { status: 401 }), Response.json({ status: 'OK', timestamp: healthy.timestamp }),
  ]) }), /did not confirm/);
});
test('validates the CI key and target before making requests', async () => {
  const fetchImpl = () => { throw new Error('Must not fetch'); };
  for (const overrides of [{ apiKey: '' }, { hostname: 'https://invalid' }, { routePath: '/other/' }]) {
    await assert.rejects(checkIntegrationHealth({ ...options, ...overrides, fetchImpl }));
  }
});
