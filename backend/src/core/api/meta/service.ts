import packageJson from '../../../../package.json';
import { env } from '../../config/env';
import { authEnv } from '../../config/authEnv';
import { getWorkspacePluginsConfig } from '../../config/workspacePlugins';
import { getFormEnginePlugins } from '../../integrations/form-engine/FormEngineRegistry';
import { getPluginCatalog } from '../../integrations/plugins/PluginRegistry';
import { isFeatureEnabled, listFeatures } from '../../db/repos/featureRepo';
import { roleService } from '../../services/roleService';

function parseKeycloakIssuer(issuer: string): { url: string; realm: string } {
  const marker = '/realms/';
  const markerIndex = issuer.indexOf(marker);
  if (markerIndex === -1) {
    return { url: issuer, realm: '' };
  }
  const url = issuer.slice(0, markerIndex);
  const remainder = issuer.slice(markerIndex + marker.length);
  const realm = remainder.split('/')[0] ?? '';
  return { url, realm };
}

export class MetaApiService {
  getPlugins() {
    const config = getWorkspacePluginsConfig();
    const plugins = getPluginCatalog();
    const activeFormEngineCode =
      env.getFormEngineDefaultCode() ?? getFormEnginePlugins()[0]?.code ?? 'formio-v5';
    const activeCacheCode = env.getCacheDefaultCode() ?? 'cache-memory';
    const activeMessageBusCode = env.getMessageBusDefaultCode() ?? 'messagebus-memory';
    const activeCodes = new Set([
      activeFormEngineCode,
      activeCacheCode,
      activeMessageBusCode,
      ...config.enabledPlugins,
    ]);
    return {
      enabledPluginCodes: config.enabledPlugins,
      plugins: plugins.map((plugin) => ({
        ...plugin,
        enabled: activeCodes.has(plugin.code),
      })),
    };
  }

  async getFeatures() {
    const features = await listFeatures();
    return {
      features: features.map((f) => ({
        code: f.code,
        name: f.name,
        description: f.description,
        version: f.version,
        status: f.status,
        enabled: isFeatureEnabled(f.status),
      })),
    };
  }

  getBuild() {
    return {
      name: packageJson.name,
      version: packageJson.version,
      nodeVersion: process.version,
      gitSha: env.getOptionalEnv('GIT_SHA') ?? 'unknown',
      gitTag: env.getOptionalEnv('GIT_TAG') ?? 'unknown',
      imageTag: env.getOptionalEnv('IMAGE_TAG') ?? 'unknown',
    };
  }

  getFrontendConfig() {
    const issuer = authEnv.getIdpPluginDefaultSsoJwtIssuer();
    const { url, realm } = parseKeycloakIssuer(issuer);
    const clientId = authEnv.getIdpPluginDefaultSsoJwtAudience() ?? '';
    return {
      auth: {
        provider: 'keycloak',
        idpPluginDefaultCode: authEnv.getIdpPluginDefaultCode(),
        keycloak: {
          url,
          realm,
          clientId,
          pkceMethod: 'S256',
        },
      },
      api: {
        baseUrl: env.getOptionalEnv('SOBA_API_BASE_URL') ?? 'http://localhost:4000/api/v1',
      },
      build: {
        name: packageJson.name,
        version: packageJson.version,
      },
    };
  }

  async getFormEngines() {
    const plugins = getFormEnginePlugins();
    const defaultCode = env.getFormEngineDefaultCode();
    return {
      items: plugins.map((plugin) => ({
        code: plugin.code,
        name: plugin.name,
        engineVersion: plugin.version ?? null,
        isDefault: plugin.code === (defaultCode ?? plugins[0]?.code ?? null),
      })),
    };
  }

  async getRoles(filters?: {
    code?: string[];
    source?: string;
    status?: string;
    onlyEnabledFeatures?: boolean;
  }) {
    const roles = await roleService.listRoles(filters);
    return { roles };
  }
}

export const metaApiService = new MetaApiService();
