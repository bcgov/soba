/** A protected gateway check: no key must fail; a valid key must reach JWT-verified v2 health. */
export async function checkIntegrationHealth({ hostname, routePath, apiKey, fetchImpl = fetch }) {
  if (!hostname || hostname.length > 253 || !hostname.split('.').every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('GATEWAY_HOSTNAME must be a DNS hostname');
  }
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*integrations\/v2\/$/.test(routePath ?? '')) {
    throw new Error('INTEGRATION_ROUTE_PATH must end in /integrations/v2/');
  }
  if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error('A valid CI API key is required');
  const url = `https://${hostname}${routePath}health`;
  const unauthenticated = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  // Discard bodies; gateway errors must never put request credentials in CI logs.
  await unauthenticated.body?.cancel();
  if (unauthenticated.status !== 401) throw new Error(`Unauthenticated health returned HTTP ${unauthenticated.status}; expected 401`);
  const response = await fetchImpl(url, {
    headers: { 'X-API-KEY': apiKey }, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`Authenticated health returned HTTP ${response.status}; expected 200`);
  }
  const body = await response.json();
  if (body.status !== 'OK' || body.gatewayAuthenticated !== true ||
      typeof body.timestamp !== 'string' || !Number.isFinite(Date.parse(body.timestamp))) {
    throw new Error('Health response did not confirm backend gateway JWT verification');
  }
  return url;
}
