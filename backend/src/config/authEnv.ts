/**
 * Auth/IdP-specific env. Kept outside core so core has no dependency on plugin or IdP concepts.
 * Used by auth middleware and IdP plugin registry.
 */
import { env } from '../core/config/env';

function getOptionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value !== undefined && value !== '' ? value : undefined;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function getCsvEnv(key: string): string[] | undefined {
  const raw = getOptionalEnv(key);
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Default IdP plugin code when IDP_PLUGINS not set (e.g. bcgov-sso). */
const DEFAULT_IDP_PLUGIN_CODE = 'bcgov-sso';

export const authEnv = {
  getPluginsPath: () => env.getPluginsPath(),
  getIdpPluginDefaultCode: () =>
    getOptionalEnv('IDP_PLUGIN_DEFAULT_CODE') ?? DEFAULT_IDP_PLUGIN_CODE,
  getIdpPluginDefaultSsoJwksUri: () => getRequiredEnv('IDP_PLUGIN_DEFAULT_SSO_JWKS_URI'),
  getIdpPluginDefaultSsoJwtIssuer: () => getRequiredEnv('IDP_PLUGIN_DEFAULT_SSO_JWT_ISSUER'),
  getIdpPluginDefaultSsoJwtAudience: () => getOptionalEnv('IDP_PLUGIN_DEFAULT_SSO_JWT_AUDIENCE'),
  /** Ordered list of IdP plugin codes; when unset uses [IDP_PLUGIN_DEFAULT_CODE]. */
  getIdpPlugins: (): string[] => {
    const raw = getCsvEnv('IDP_PLUGINS');
    return raw?.length
      ? raw
      : [getOptionalEnv('IDP_PLUGIN_DEFAULT_CODE') ?? DEFAULT_IDP_PLUGIN_CODE];
  },
};
