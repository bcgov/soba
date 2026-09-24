import { PluginConfigReader } from '../../core/config/pluginConfig';
import { TenantEnginePluginDefinition } from '../../core/integrations/tenant/TenantEnginePluginDefinition';
import { CstarEngineAdapter } from './CstarEngineAdapter';

export const tenantEngineDefinition: TenantEnginePluginDefinition = {
  code: 'tenant-cstar',
  metadata: {
    code: 'tenant-cstar',
    name: 'CSTAR',
    version: 'v1',
  },
  createAdapter: (config: PluginConfigReader) => new CstarEngineAdapter(config),
};
