import { PluginConfigReader } from '../../core/config/pluginConfig';
import { FormEnginePluginDefinition } from '../../core/integrations/form-engine/FormEnginePluginDefinition';
import { FormioEngineAdapter } from './formioEngineAdapter';

export const formEnginePluginDefinition: FormEnginePluginDefinition = {
  code: 'formio-v5',
  metadata: {
    code: 'formio-v5',
    name: 'Form.io v5',
    version: 'v5',
  },
  createAdapter: (config: PluginConfigReader) => new FormioEngineAdapter(config),
};
