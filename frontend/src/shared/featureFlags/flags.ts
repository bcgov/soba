import type { FeaturesMetaPayload } from '@/src/shared/config/featuresMeta';

/** Feature `code` values aligned with `GET /meta/features` and `soba.feature`. */
export const FEATURE_CODES = {
  WORKSPACES: 'workspaces',
  DESIGN_MODE: 'design-mode',
  SUBMIT_MODE: 'submit-mode',
  /** Dev/review: API meta & health inspection (matches `soba.feature` seed code `meta`). */
  META: 'meta',
} as const;

export type FeatureCode = (typeof FEATURE_CODES)[keyof typeof FEATURE_CODES];

const FRONTEND_FEATURES_ENV = 'NEXT_PUBLIC_SOBA_FEATURES_ALLOWED';

/** Wildcard: allow every platform-allowed feature on this frontend deployment. */
const FRONTEND_FEATURES_WILDCARD_TOKENS = new Set(['*', 'all']);

export type FrontendFeaturesPolicy = 'all' | Set<string>;

export function normalizeFeatureCode(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Parses `NEXT_PUBLIC_SOBA_FEATURES_ALLOWED`.
 *
 * - **Unset or empty** — no codes allowed at the frontend layer (use `*` or `all` explicitly for “everything”).
 * - **`*` or `all`** (sole token, case-insensitive) — allow all platform-allowed features.
 * - **Comma-separated codes** — allow only those codes (must match `/meta/features` `code` values).
 */
export function parseFrontendFeaturesAllowlist(raw: string | undefined): FrontendFeaturesPolicy {
  if (raw === undefined || raw.trim() === '') {
    return new Set();
  }
  const tokens = raw
    .split(',')
    .map(normalizeFeatureCode)
    .filter(Boolean);
  if (tokens.length === 0) {
    return new Set();
  }
  if (tokens.length === 1 && FRONTEND_FEATURES_WILDCARD_TOKENS.has(tokens[0]!)) {
    return 'all';
  }
  return new Set(tokens);
}

/**
 * `featureAllowed(code) === platformAllowed(code) && frontendAllowed(code)`.
 * Unknown codes are not platform-allowed (missing from meta → false).
 */
export function createIsFeatureAllowed(meta: FeaturesMetaPayload) {
  const platformByCode = new Map(
    meta.features.map((f) => [normalizeFeatureCode(f.code), f.platformAllowed] as const),
  );
  const policy = parseFrontendFeaturesAllowlist(process.env[FRONTEND_FEATURES_ENV]);

  return function isFeatureAllowed(code: string): boolean {
    const key = normalizeFeatureCode(code);
    const platformAllowed = platformByCode.get(key) ?? false;
    const frontendAllowed = policy === 'all' || policy.has(key);
    return platformAllowed && frontendAllowed;
  };
}

/** Known `FEATURE_CODES` that are both platform- and frontend-allowed for this build. */
export function listEnabledKnownFeatures(meta: FeaturesMetaPayload): FeatureCode[] {
  const isFeatureAllowed = createIsFeatureAllowed(meta);
  return (Object.values(FEATURE_CODES) as FeatureCode[]).filter((code) => isFeatureAllowed(code));
}
