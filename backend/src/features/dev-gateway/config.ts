import { CERTS_PATH } from './server';

const LOOPBACK = new Set(['localhost', '127.0.0.1']);

const portOf = (url: URL) => Number(url.port || 80);

/**
 * Why the dev gateway cannot serve this backend configuration, or null when it can. The backend
 * must fetch keys from this gateway, and the gateway forwards only to plain HTTP on this machine.
 */
export const devGatewayConfigProblem = ({
  jwksUri,
  port,
  upstream,
}: {
  jwksUri: string;
  port: number;
  upstream: URL;
}): string | null => {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return `DEV_GATEWAY_PORT must be a port from 1 to 65535; got ${port}`;
  }
  const certs = new URL(jwksUri);
  if (
    certs.protocol !== 'http:' ||
    !LOOPBACK.has(certs.hostname) ||
    portOf(certs) !== port ||
    certs.pathname !== CERTS_PATH
  ) {
    return `INTEGRATION_GATEWAY_JWKS_URI must be http://127.0.0.1:${port}${CERTS_PATH} for the dev gateway; got ${jwksUri}`;
  }
  // Only the request path is forwarded, so an upstream path, query or credentials would be ignored.
  if (
    upstream.protocol !== 'http:' ||
    !LOOPBACK.has(upstream.hostname) ||
    upstream.pathname !== '/' ||
    upstream.search ||
    upstream.username ||
    upstream.password
  ) {
    return `DEV_GATEWAY_UPSTREAM must be http://localhost:<port> or http://127.0.0.1:<port>; got ${upstream.href}`;
  }
  return null;
};
