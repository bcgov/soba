import { Request, Response, NextFunction } from 'express';
import { getFeatureByCode, isFeatureEnabled } from '../db/repos/featureRepo';
import { getCacheAdapter } from '../integrations/plugins/PluginRegistry';

const FEATURE_CACHE_TTL_MS = 30_000;

/**
 * Gate a route on a `soba.feature` flag. 404s when the feature is absent or not 'enabled' (a
 * disabled feature looks like a missing route). Cached briefly, so toggles apply within the TTL.
 */
export const requireFeature =
  (code: string) =>
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cache = getCacheAdapter();
      const cacheKey = `feature-enabled:${code}`;
      let enabled = await cache.get<boolean>(cacheKey);
      if (enabled === null) {
        const feature = await getFeatureByCode(code);
        enabled = Boolean(feature && isFeatureEnabled(feature.status));
        await cache.set(cacheKey, enabled, FEATURE_CACHE_TTL_MS);
      }
      if (!enabled) {
        res.status(404).json({ error: 'Not Found', statusCode: 404 });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
