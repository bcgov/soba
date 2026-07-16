import { PluginConfigReader } from '../../core/config/pluginConfig';
import { DocumentGenerationPluginDefinition } from '../../core/integrations/document-generation/DocumentGenerationPluginDefinition';
import { CdogsV3Adapter } from './cdogsV3Adapter';

export const documentGenerationPluginDefinition: DocumentGenerationPluginDefinition = {
  code: 'cdogs-v3',
  metadata: {
    code: 'cdogs-v3',
    name: 'CDOGS',
    version: 'v3',
  },
  createAdapter: (config: PluginConfigReader) => new CdogsV3Adapter(config),
};
