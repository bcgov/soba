import { FeatureAvailability } from '../db/codes';
import { getFeatureGateCached } from '../db/repos/featureRepo';
import { hasActiveFeatureGrant } from '../db/repos/featureScopeRepo';

export interface FeatureScopeContext {
  workspaceId?: string | null;
  formId?: string | null;
}

/**
 * Resolve whether a feature is available for a given scope, in gates:
 *  1. platform — the feature must be present and enabled;
 *  2. availability `fixed` — available everywhere it is platform-enabled;
 *  3. availability `scoped` — available only where an active workspace or form grant exists.
 * Only `scoped` consults grants; anything else resolves open. Status/availability is cached; grants
 * are not (see featureRepo).
 */
export const isFeatureAvailable = async (
  code: string,
  scope: FeatureScopeContext = {},
): Promise<boolean> => {
  const gate = await getFeatureGateCached(code, Date.now());
  if (!gate?.enabled) return false;
  if (gate.availability !== FeatureAvailability.scoped) return true;

  return hasActiveFeatureGrant({
    featureCode: code,
    workspaceId: scope.workspaceId,
    formId: scope.formId,
  });
};
