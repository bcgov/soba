/**
 * Form.io v5 proxy routes. Mount at the form-engine route base path (e.g. /formio-v5).
 * Uses formioV5Client with plugin config; forwards x-jwt-token from request.
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import {
  FormioApiError,
  FormioCommunityEditionAPIv5Client,
  getAuthenticatedFormioClient,
  type FormioQuery,
} from './formioV5Client';

type Req = Request;
type Res = Response;

function getToken(req: Req): string | undefined {
  const t = req.headers['x-jwt-token'];
  return typeof t === 'string' ? t : Array.isArray(t) ? t[0] : undefined;
}

function queryFromReq(req: Req): FormioQuery | undefined {
  const q = req.query as Record<string, unknown>;
  if (!q || typeof q !== 'object') return undefined;
  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    params[k] = Array.isArray(v) ? v[0] : v;
  }
  return Object.keys(params).length > 0 ? { params } : undefined;
}

async function getClient(config: PluginConfigReader): Promise<FormioCommunityEditionAPIv5Client> {
  const existing = await getAuthenticatedFormioClient(config);
  if (existing) return existing;
  const baseUrl = config.getRequired('ADMIN_API_URL');
  return new FormioCommunityEditionAPIv5Client({
    baseUrl,
    username: '',
    password: '',
  });
}

function errorPayload(err: unknown, fallback: string): { error: string } {
  if (err instanceof FormioApiError) return { error: err.body || fallback };
  if (err instanceof Error && err.message) return { error: err.message };
  return { error: fallback };
}

function errorStatus(err: unknown): number {
  return err instanceof FormioApiError ? err.status : 500;
}

async function handleJsonRoute(
  res: Res,
  task: () => Promise<unknown>,
  fallback: string,
  successStatus = 200,
): Promise<void> {
  try {
    const data = await task();
    res.status(successStatus).json(data);
  } catch (err) {
    res.status(errorStatus(err)).json(errorPayload(err, fallback));
  }
}

async function handleEmptyRoute(
  res: Res,
  task: () => Promise<void>,
  fallback: string,
  successStatus = 204,
): Promise<void> {
  try {
    await task();
    res.status(successStatus).send();
  } catch (err) {
    res.status(errorStatus(err)).json(errorPayload(err, fallback));
  }
}

/**
 * Creates the Form.io CE proxy router for the given plugin config.
 * All handlers use the authenticated client from config; forwards x-jwt-token from requests.
 */
export function createFormioV5ProxyRouter(config: PluginConfigReader): Router {
  const router = Router();

  // CE project root + auth/session endpoints
  router.get('/', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await getClient(config)).loadProject({ token }),
      'Failed to load project',
    );
  });

  router.get('/current', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await getClient(config)).currentUser({ token }),
      'Failed to load current user',
    );
  });

  router.get('/access', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await getClient(config)).loadAccessInfo({ token }),
      'Failed to load access info',
    );
  });

  router.get('/role', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await getClient(config)).loadRoles(queryFromReq(req), { token }),
      'Failed to load roles',
    );
  });

  router.get('/logout', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await (await getClient(config)).logout({ token })) ?? {},
      'Failed to logout',
    );
  });

  router.post('/logout', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await (await getClient(config)).logout({ token })) ?? {},
      'Failed to logout',
    );
  });

  // Forms
  router.get('/form', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await getClient(config)).loadForms(queryFromReq(req), { token }),
      'Failed to load forms',
    );
  });

  router.post('/form', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await getClient(config)).saveForm(req.body, { token }),
      'Failed to create form',
      201,
    );
  });

  router.get('/form/:id', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () => (await getClient(config)).loadForm(req.params.id, queryFromReq(req), { token }),
      'Failed to load form',
    );
  });

  router.put('/form/:id', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () =>
        (await getClient(config)).saveForm({ ...req.body, _id: req.params.id }, { token }),
      'Failed to update form',
    );
  });

  router.delete('/form/:id', async (req, res) => {
    const token = getToken(req);
    await handleEmptyRoute(
      res,
      async () => (await getClient(config)).deleteForm(req.params.id, { token }),
      'Failed to delete form',
    );
  });

  // Submissions
  router.get('/form/:formId/submission', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () =>
        (await getClient(config)).loadSubmissions(req.params.formId, queryFromReq(req), { token }),
      'Failed to load submissions',
    );
  });

  router.post('/form/:formId/submission', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () =>
        (await getClient(config)).saveSubmission(req.params.formId, req.body, {
          token,
        }),
      'Failed to create submission',
      201,
    );
  });

  router.get('/form/:formId/submission/:sid', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () =>
        (await getClient(config)).loadSubmission(
          req.params.formId,
          req.params.sid,
          queryFromReq(req),
          { token },
        ),
      'Failed to load submission',
    );
  });

  router.put('/form/:formId/submission/:sid', async (req, res) => {
    const token = getToken(req);
    await handleJsonRoute(
      res,
      async () =>
        (await getClient(config)).saveSubmission(
          req.params.formId,
          { ...req.body, _id: req.params.sid },
          { token },
        ),
      'Failed to update submission',
    );
  });

  router.delete('/form/:formId/submission/:sid', async (req, res) => {
    const token = getToken(req);
    await handleEmptyRoute(
      res,
      async () =>
        (await getClient(config)).deleteSubmission(req.params.formId, req.params.sid, { token }),
      'Failed to delete submission',
    );
  });

  return router;
}
