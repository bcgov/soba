import {
  TenantEngineAdapter,
  type TenantsResult,
  type TenantEngineReadinessResult,
  type GetTenantsInput,
} from '../../core/integrations/tenant/TenantEngineAdapter';
import { PluginConfigReader } from '../../core/config/pluginConfig';
import { ValidationError } from '../../core/errors';

export interface CSTARV1Config {
  apiBaseUrl: string;
}

const loadConfig = (config: PluginConfigReader): CSTARV1Config => {
  return {
    apiBaseUrl: config.getRequired('API_BASE_URL'),
  };
};

export class CstarEngineAdapter implements TenantEngineAdapter {
  private readonly config: CSTARV1Config;
  private readonly pluginConfig: PluginConfigReader;

  constructor(pluginConfig: PluginConfigReader) {
    this.pluginConfig = pluginConfig;
    this.config = loadConfig(pluginConfig);
  }

  async readinessCheck(): Promise<TenantEngineReadinessResult> {
    try {
      const url = this.config.apiBaseUrl.replace(/\/$/, '') || this.config.apiBaseUrl;
      const res = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status === 404) {
        return { ok: true };
      }
      return { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getTenants(input: GetTenantsInput): Promise<TenantsResult> {
    if (!input.userId) {
      throw new ValidationError('User Id not provided');
    }
    if (!input.token) {
      throw new ValidationError('Token not provided');
    }
    try {
      const url = this.config.apiBaseUrl.replace(/\/$/, '') || this.config.apiBaseUrl;
      const headers: Record<string, string> = { Authorization: `${input.token}` };
      const tenantsUrl = `${url}/users/${input.userId}/tenants`;
      const res = await fetch(tenantsUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status === 404) {
        const data = await res.json();
        return { tenants: data.data.tenants };
      }
      return { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
