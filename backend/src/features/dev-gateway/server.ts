import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { SigningKey } from './keys';

export interface DevGatewayOptions {
  /** Must equal the backend's INTEGRATION_GATEWAY_ISSUER. */
  issuer: string;
  /** Must equal the backend's INTEGRATION_GATEWAY_AUDIENCE. */
  audience: string;
  /** The integration listener, e.g. http://127.0.0.1:4001. Every request goes to this host. */
  upstream: URL;
  key: SigningKey;
}

export const CERTS_PATH = '/certs';

// Hop-by-hop headers describe one connection, so neither direction forwards them, nor any header
// a Connection header names. Request body framing is restated separately, so no Connection token
// can remove it.
const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

const endToEndHeaders = (
  headers: http.IncomingHttpHeaders,
  alsoDrop: readonly string[] = [],
): http.OutgoingHttpHeaders => {
  const named = String(headers.connection ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const drop = new Set([...HOP_BY_HOP, ...named, ...alsoDrop]);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !drop.has(name)));
};

const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

/**
 * A local stand-in for the APS gateway. Serves its signing key at /certs. A path request with
 * X-API-KEY is forwarded to the integration listener with the key replaced by a signed GW-JWT
 * naming it as the consumer; other targets get 400 and requests without a key 401. It does not
 * check keys or ACLs.
 */
export const createDevGateway = ({ issuer, audience, upstream, key }: DevGatewayOptions) =>
  http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === CERTS_PATH) {
      sendJson(res, 200, { keys: [key.jwk] });
      return;
    }
    // Absolute-form and `*` targets are refused rather than passed upstream.
    if (!req.url?.startsWith('/')) {
      sendJson(res, 400, { message: 'Request target must be a path' });
      return;
    }
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      sendJson(res, 401, { message: 'No API key found in request' });
      return;
    }
    const transferEncoding = req.headers['transfer-encoding'];
    if (transferEncoding && transferEncoding.trim().toLowerCase() !== 'chunked') {
      sendJson(res, 501, { message: 'Only chunked transfer encoding is supported' });
      return;
    }
    const token = jwt.sign({ consumername: apiKey, consumerid: apiKey }, key.privateKey, {
      algorithm: 'RS256',
      keyid: key.kid,
      issuer,
      audience,
      expiresIn: 60,
      jwtid: randomUUID(),
    });
    // Kong strips the API key (hide_credentials) and sets GW-JWT itself.
    const headers = endToEndHeaders(req.headers, ['host', 'x-api-key', 'gw-jwt']);
    headers['gw-jwt'] = token;
    // Node frames a body by default only for some methods, so state the framing for every method.
    if (transferEncoding) headers['transfer-encoding'] = 'chunked';
    else if (req.headers['content-length'] !== undefined) {
      headers['content-length'] = req.headers['content-length'];
    }
    const forward = http.request(
      {
        hostname: upstream.hostname,
        port: upstream.port || 80,
        path: req.url,
        method: req.method,
        headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, endToEndHeaders(upstreamRes.headers));
        pipeline(upstreamRes, res, (error) => {
          if (error) res.destroy();
        });
      },
    );
    forward.on('error', () => {
      if (res.headersSent) res.destroy();
      else sendJson(res, 502, { message: 'Integration API is not reachable' });
    });
    pipeline(req, forward, (error) => {
      if (error) forward.destroy();
    });
  });
