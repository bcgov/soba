import { getBootstrapApiBaseUrl } from '@/src/shared/config/runtimeConfig';

export type MetaFeatureRow = {
  code: string;
  name: string;
  description: string | null;
  version: string | null;
  status: string;
  platformAllowed: boolean;
};

export type FeaturesMetaPayload = {
  features: MetaFeatureRow[];
};

let cachedFeaturesMeta: FeaturesMetaPayload | null = null;
let featuresMetaPromise: Promise<FeaturesMetaPayload> | null = null;

export function isFeaturesMetaPayload(value: unknown): value is FeaturesMetaPayload {
  if (!value || typeof value !== 'object') return false;
  const parsed = value as { features?: unknown };
  if (!Array.isArray(parsed.features)) return false;
  return parsed.features.every((row) => {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    return (
      typeof r.code === 'string' &&
      typeof r.name === 'string' &&
      (r.description === null || typeof r.description === 'string') &&
      (r.version === null || typeof r.version === 'string') &&
      typeof r.status === 'string' &&
      typeof r.platformAllowed === 'boolean'
    );
  });
}

function assertFeaturesMetaShape(value: unknown): asserts value is FeaturesMetaPayload {
  if (!isFeaturesMetaPayload(value)) {
    throw new Error('Features meta payload is invalid');
  }
}

export async function loadFeaturesMeta(): Promise<FeaturesMetaPayload> {
  if (cachedFeaturesMeta) return cachedFeaturesMeta;
  if (featuresMetaPromise) return featuresMetaPromise;

  featuresMetaPromise = fetch(`${getBootstrapApiBaseUrl()}/meta/features`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load features meta: ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      assertFeaturesMetaShape(payload);
      cachedFeaturesMeta = payload;
      return payload;
    })
    .finally(() => {
      featuresMetaPromise = null;
    });

  return featuresMetaPromise;
}

export function getCachedFeaturesMeta(): FeaturesMetaPayload | null {
  return cachedFeaturesMeta;
}
