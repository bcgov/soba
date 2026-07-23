import { PluginConfigReader } from '../../core/config/pluginConfig';
import { DocumentGenerationPluginDefinition } from '../../core/integrations/document-generation/DocumentGenerationPluginDefinition';
import { CdogsV2Adapter } from './cdogsV2Adapter';

export const documentGenerationPluginDefinition: DocumentGenerationPluginDefinition = {
  code: 'cdogs-v2',
  metadata: {
    code: 'cdogs-v2',
    name: 'CDOGS',
    version: 'v2',
  },
  featureCode: 'document-generation-v2',
  createAdapter: (config: PluginConfigReader) => new CdogsV2Adapter(config),
};
