import { eq } from 'drizzle-orm';
import { FeatureStatus } from '../codes';
import { db } from '../client';
import { features } from '../schema';

export interface FeatureRow {
  code: string;
  name: string;
  description: string | null;
  version: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export const listFeatures = async (): Promise<FeatureRow[]> => {
  const rows = await db.select().from(features).orderBy(features.code);
  return rows;
};

export const getFeatureByCode = async (code: string): Promise<FeatureRow | null> => {
  const rows = await db.select().from(features).where(eq(features.code, code)).limit(1);
  return rows[0] ?? null;
};

export const isFeatureEnabled = (status: string): boolean => status === FeatureStatus.enabled;

// Feature status changes rarely; cache per code for a short TTL so route gating isn't a DB hit per request.
const FEATURE_CACHE_TTL_MS = 30_000;
const featureCache = new Map<string, { enabled: boolean; at: number }>();

/** Cached check that a feature is present and enabled, for per-request route gating. */
export const isFeatureEnabledCached = async (code: string, now: number): Promise<boolean> => {
  const hit = featureCache.get(code);
  if (hit && now - hit.at < FEATURE_CACHE_TTL_MS) return hit.enabled;
  const feature = await getFeatureByCode(code);
  const enabled = feature ? isFeatureEnabled(feature.status) : false;
  featureCache.set(code, { enabled, at: now });
  return enabled;
};
