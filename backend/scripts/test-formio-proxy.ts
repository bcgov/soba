/**
 * Test Form.io proxy routes against a running backend (e.g. PR deploy).
 *
 * Usage:
 *   # PR deploy: use the BACKEND host (soba-pr-N-api.<domain>), not the frontend URL.
 *   # The workflow comment shows the frontend URL; API lives at soba-pr-<N>-api.<domain>.
 *   SOBA_API_BASE_URL=https://soba-pr-26-api.apps.silver.devops.gov.bc.ca SOBA_TEST_TOKEN=eyJ... pnpm run script:test-formio-proxy
 *
 *   # Local (or set SOBA_API_BASE_URL + SOBA_TEST_TOKEN in .env / .env.local)
 *   pnpm run script:test-formio-proxy
 *
 *   # Health only (no token)
 *   SOBA_API_BASE_URL=https://soba-pr-26-api.apps.silver.devops.gov.bc.ca pnpm run script:test-formio-proxy
 *
 * Env:
 *   SOBA_API_BASE_URL  – Backend origin (no /api/v1). Default: http://localhost:4000
 *   SOBA_TEST_TOKEN    – JWT access token (Bearer). Required for Formio proxy routes.
 *   FORMIO_JWT_TOKEN   – Optional. If set, sent as x-jwt-token to Form.io CE for form-level auth.
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

const API_BASE = (process.env.SOBA_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN = (process.env.SOBA_TEST_TOKEN || '').trim().replace(/^Bearer\s+/i, '');
const FORMIO_TOKEN = process.env.FORMIO_JWT_TOKEN?.trim();

const FORMIO_BASE = `${API_BASE}/api/v1/formio-v5`;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
  if (FORMIO_TOKEN) h['x-jwt-token'] = FORMIO_TOKEN;
  return h;
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const url = path.startsWith('http')
    ? path
    : `${FORMIO_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { method: 'GET', headers: headers() });
  let body: unknown;
  const ct = res.headers.get('content-type') || '';
  try {
    body = ct.includes('json') ? await res.json() : await res.text();
  } catch {
    body = await res.text();
  }
  return { status: res.status, body };
}

async function getHealth(path: string): Promise<{ status: number; body: unknown }> {
  const url = `${API_BASE}/api/v1${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  let body: unknown;
  const ct = res.headers.get('content-type') || '';
  try {
    body = ct.includes('json') ? await res.json() : await res.text();
  } catch {
    body = await res.text();
  }
  return { status: res.status, body };
}

async function main(): Promise<void> {
  console.log('Backend:', API_BASE);
  console.log('Formio proxy:', FORMIO_BASE);
  console.log('');

  // Health (public, no token)
  console.log('--- Health ---');
  const healthRes = await getHealth('/health');
  console.log(
    'GET /api/v1/health:',
    healthRes.status,
    typeof healthRes.body === 'object' ? JSON.stringify(healthRes.body) : healthRes.body,
  );

  const readyRes = await getHealth('/health/ready');
  const readyOk = readyRes.status >= 200 && readyRes.status < 300;
  console.log('GET /api/v1/health/ready:', readyRes.status, readyOk ? '(ready)' : '(unhealthy)');
  console.log(
    'Result:',
    typeof readyRes.body === 'object' ? JSON.stringify(readyRes.body, null, 2) : readyRes.body,
  );
  console.log('');

  if (!TOKEN) {
    console.error(
      'SOBA_TEST_TOKEN is required for Formio proxy routes. Health checks above completed.',
    );
    process.exit(1);
  }

  console.log('--- Formio proxy ---');
  const routes: { name: string; path: string }[] = [
    { name: 'Project root (GET /)', path: '/' },
    { name: 'Current user (GET /current)', path: '/current' },
    { name: 'Access info (GET /access)', path: '/access' },
    { name: 'Roles (GET /role)', path: '/role' },
    { name: 'Forms list (GET /form)', path: '/form' },
  ];

  let failed = 0;
  for (const r of routes) {
    process.stdout.write(`${r.name} ... `);
    const { status, body } = await get(r.path);
    if (status >= 200 && status < 300) {
      console.log(`OK (${status})`);
      if (process.env.DEBUG && body !== undefined) {
        console.log(
          '  ',
          typeof body === 'object' ? JSON.stringify(body).slice(0, 200) + '...' : body,
        );
      }
    } else {
      console.log(`FAIL (${status})`);
      console.log(
        '  ',
        typeof body === 'object' ? JSON.stringify(body, null, 2).slice(0, 500) : body,
      );
      failed++;
    }
  }

  console.log('');
  if (failed > 0) {
    console.error(`${failed} route(s) failed.`);
    process.exit(1);
  }
  console.log('All Formio proxy routes responded successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
