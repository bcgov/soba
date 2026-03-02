/**
 * IdP plugin discovery and composite auth middleware.
 * Lives outside core so core has no direct reference to plugin or IdP code.
 */
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authEnv } from '../config/authEnv';
import { createPluginConfigReader } from '../core/config/pluginConfig';
import type { IdpPluginDefinition, IdpClaimMapper } from './IdpPlugin';

const IdpPluginDefinitionSchema = z.object({
  code: z.string().min(1),
  createAuthMiddleware: z.any(),
  createClaimMapper: z.any(),
});

export interface IdpPluginInstance {
  code: string;
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  claimMapper: IdpClaimMapper;
}

function getPluginsRoot(): string {
  const fromEnv = authEnv.getPluginsPath();
  if (fromEnv) return path.resolve(fromEnv);
  const runningFromDist = __dirname.includes(path.sep + 'dist' + path.sep);
  const pluginsDir = runningFromDist
    ? path.join('dist', 'src', 'plugins')
    : path.join('src', 'plugins');
  return path.resolve(process.cwd(), pluginsDir);
}

let idpDefinitionsCache: IdpPluginDefinition[] | null = null;

function discoverIdpDefinitions(): IdpPluginDefinition[] {
  if (idpDefinitionsCache) return idpDefinitionsCache;
  const pluginsRoot = getPluginsRoot();
  if (!fs.existsSync(pluginsRoot)) {
    idpDefinitionsCache = [];
    return idpDefinitionsCache;
  }
  const pluginDirs = fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const result: IdpPluginDefinition[] = [];
  for (const pluginDir of pluginDirs) {
    const modulePath = path.join(pluginsRoot, pluginDir);
    let raw: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      raw = require(modulePath);
    } catch {
      continue;
    }
    const obj = raw !== null && typeof raw === 'object' ? raw : {};
    const idpDef = (obj as Record<string, unknown>).idpPluginDefinition;
    if (idpDef === undefined) continue;
    const parsed = IdpPluginDefinitionSchema.safeParse(idpDef);
    if (parsed.success) {
      result.push(idpDef as IdpPluginDefinition);
    }
  }
  idpDefinitionsCache = result;
  return idpDefinitionsCache;
}

let idpPluginsCache: IdpPluginInstance[] | null = null;

export function getIdpPlugins(): IdpPluginInstance[] {
  if (idpPluginsCache) return idpPluginsCache;
  const codes = authEnv.getIdpPlugins();
  const definitions = discoverIdpDefinitions();
  const byCode = new Map(definitions.map((d) => [d.code, d]));
  const result: IdpPluginInstance[] = [];
  for (const code of codes) {
    const def = byCode.get(code);
    if (!def) {
      throw new Error(
        `IdP plugin '${code}' is configured in IDP_PLUGINS but not found. Available: ${definitions.map((d) => d.code).join(', ') || '<none>'}`,
      );
    }
    const config = createPluginConfigReader(def.code);
    result.push({
      code: def.code,
      middleware: def.createAuthMiddleware(config) as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void,
      claimMapper: def.createClaimMapper(config),
    });
  }
  idpPluginsCache = result;
  return result;
}

/** Composite auth middleware: try each IdP plugin in order; first success wins. */
export function createIdpAuthMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  const plugins = getIdpPlugins();
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;
    const tryNext = (err?: unknown): void => {
      if (!err && (req as Request & { idpPluginCode?: string }).idpPluginCode) {
        return next();
      }
      if (index >= plugins.length) {
        const statusErr = err as { status?: number } | undefined;
        if (statusErr?.status === 401) return next(err);
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Error occurred during authentication',
          statusCode: 401,
        });
        return;
      }
      const { middleware } = plugins[index++];
      middleware(req, res, tryNext);
    };
    tryNext();
  };
}
