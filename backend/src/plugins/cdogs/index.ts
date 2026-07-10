import { PluginConfigReader } from '../../core/config/pluginConfig';
import { FeatureApiDefinition } from '../../core/integrations/plugins/FeatureApiDefinition';
import { createCdogsRouter } from './cdogsRoutes';

export const pluginApiDefinition: FeatureApiDefinition = {
  code: 'cdogs',
  basePath: '/document-generation',
  createRouter: (config: PluginConfigReader) => createCdogsRouter(config),
};
