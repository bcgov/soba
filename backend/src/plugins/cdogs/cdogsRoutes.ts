import express, { NextFunction, Request, Response as ExpressResponse, Router } from 'express';
import {
  documentGenerationVersions,
  type DocumentGenerationAdapter,
  type DocumentGenerationVersion,
} from '../../core/integrations/cdogs/documentGenerationAdapter';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import { ValidationError } from '../../core/errors';
import { log } from '../../core/logging';
import { CdogsAdapter } from './cdogsAdapter';
import { CdogsApiError, createCdogsClient } from './cdogsClient';

const jsonBodyParser = express.json({ limit: '10mb' });
const rawBodyParser = express.raw({ type: '*/*', limit: '25mb' });

function parseVersion(req: Request): DocumentGenerationVersion {
  const version = String(req.params.version || '').trim();
  if (!documentGenerationVersions.includes(version as DocumentGenerationVersion)) {
    throw new ValidationError(
      `Unsupported document generation version: ${version}. Supported versions: ${documentGenerationVersions.join(', ')}`,
    );
  }
  return version as DocumentGenerationVersion;
}

function parseVersionAndHash(req: Request): { version: DocumentGenerationVersion; hash: string } {
  const version = parseVersion(req);
  const hash = String(req.params.hash || '').trim();
  if (!hash) {
    throw new ValidationError('Template hash is required');
  }
  return { version, hash };
}

async function proxyResponse(res: ExpressResponse, upstream: globalThis.Response): Promise<void> {
  const contentType = upstream.headers.get('Content-Type');
  const templateHash = upstream.headers.get('X-Template-Hash');

  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  if (templateHash) {
    res.setHeader('X-Template-Hash', templateHash);
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  res.status(upstream.status).send(body);
}

function getAuditFields(req: Request, version: DocumentGenerationVersion): Record<string, unknown> {
  const body =
    req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  return {
    workspaceId:
      req.header('x-soba-workspace-id') ??
      req.header('x-workspace-id') ??
      req.query.workspaceId ??
      body.workspaceId ??
      null,
    formId: req.query.formId ?? body.formId ?? null,
    version,
    timestamp: new Date().toISOString(),
  };
}

function withAudit(
  action: string,
  handler: (req: Request, res: ExpressResponse) => Promise<void>,
): (req: Request, res: ExpressResponse, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    let version: DocumentGenerationVersion | undefined;
    try {
      version = parseVersion(req);
      await handler(req, res);
      log.info({ action, outcome: 'success', ...getAuditFields(req, version) }, 'CDOGS request');
    } catch (err) {
      if (version) {
        log.warn(
          {
            action,
            outcome: 'failure',
            ...getAuditFields(req, version),
            error: err instanceof Error ? err.message : String(err),
          },
          'CDOGS request failed',
        );
      }
      if (err instanceof CdogsApiError) {
        next(new Error(`CDOGS integration error: ${err.message}`));
        return;
      }
      next(err);
    }
  };
}

export function createCdogsRouter(
  pluginConfig: PluginConfigReader,
  adapterOverride?: DocumentGenerationAdapter,
): Router {
  const router = Router();
  const adapter = adapterOverride ?? new CdogsAdapter(createCdogsClient(pluginConfig));

  router.post(
    '/:version/template',
    rawBodyParser,
    withAudit('upload-template', async (req, res) => {
      const version = parseVersion(req);
      const response = await adapter.uploadTemplate(
        version,
        Buffer.isBuffer(req.body) ? req.body : Buffer.from([]),
        req.header('content-type') ?? undefined,
      );
      await proxyResponse(res, response);
    }),
  );

  router.post(
    '/:version/template/render',
    jsonBodyParser,
    withAudit('render-template', async (req, res) => {
      const version = parseVersion(req);
      const response = await adapter.renderTemplate(version, req.body);
      await proxyResponse(res, response);
    }),
  );

  router.post(
    '/:version/template/:hash/render',
    jsonBodyParser,
    withAudit('render-template-by-hash', async (req, res) => {
      const { version, hash } = parseVersionAndHash(req);
      const response = await adapter.renderTemplateByHash(version, hash, req.body);
      await proxyResponse(res, response);
    }),
  );

  router.get(
    '/:version/template/:hash',
    withAudit('get-template', async (req, res) => {
      const { version, hash } = parseVersionAndHash(req);
      const response = await adapter.getTemplate(version, hash);
      await proxyResponse(res, response);
    }),
  );

  router.delete(
    '/:version/template/:hash',
    withAudit('delete-template', async (req, res) => {
      const { version, hash } = parseVersionAndHash(req);
      const response = await adapter.deleteTemplate(version, hash);
      await proxyResponse(res, response);
    }),
  );

  router.get(
    '/:version/file-types',
    withAudit('get-file-types', async (req, res) => {
      const version = parseVersion(req);
      const response = await adapter.getFileTypes(version);
      await proxyResponse(res, response);
    }),
  );

  router.get(
    '/:version/health',
    withAudit('get-health', async (req, res) => {
      const version = parseVersion(req);
      const response = await adapter.getHealth(version);
      await proxyResponse(res, response);
    }),
  );

  return router;
}
