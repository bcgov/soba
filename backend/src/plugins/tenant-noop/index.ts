import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type { TenantEngineAdapter } from '../../core/integrations/tenant/TenantEngineAdapter';
import type { TenantEnginePluginDefinition } from '../../core/integrations/tenant/TenantEnginePluginDefinition';

const CODE = 'tenant-noop';

/** No-op tenant engine: every caller has no tenants, no external call. */
function createNoopTenantEngineAdapter(config: PluginConfigReader): TenantEngineAdapter {
  void config; // Required by interface; this plugin does not use config
  return {
    async getTenants() {
      return [];
    },
  };
}

export const tenantEnginePluginDefinition: TenantEnginePluginDefinition = {
  code: CODE,
  metadata: {
    code: CODE,
    name: 'No-op tenant engine',
  },
  createAdapter: createNoopTenantEngineAdapter,
};
