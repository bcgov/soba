export const FEATURE_KEYS = {
  workspaces: 'workspaces',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

const DEFAULT_ENABLED_FEATURES: FeatureKey[] = [FEATURE_KEYS.workspaces];

function normalizeFeatureToken(value: string): string {
  return value.trim().toLowerCase();
}

function parseFeatureList(raw: string | undefined): Set<string> {
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(',')
      .map(normalizeFeatureToken)
      .filter(Boolean),
  );
}

const explicitlyEnabled = parseFeatureList(process.env.NEXT_PUBLIC_FEATURE_FLAGS);
const explicitlyDisabled = parseFeatureList(process.env.NEXT_PUBLIC_DISABLED_FEATURE_FLAGS);

export function isFeatureEnabled(feature: FeatureKey): boolean {
  const normalized = normalizeFeatureToken(feature);

  if (explicitlyDisabled.has(normalized)) {
    return false;
  }

  if (explicitlyEnabled.size === 0) {
    return DEFAULT_ENABLED_FEATURES.includes(feature);
  }

  return explicitlyEnabled.has(normalized);
}
