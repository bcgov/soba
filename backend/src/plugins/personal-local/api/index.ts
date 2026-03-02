import { PluginConfigReader } from '../../../core/config/pluginConfig';
import { FeatureApiDefinition } from '../../../core/integrations/plugins/FeatureApiDefinition';
import { createPersonalLocalInfoRouter } from './info/route';
import { registerPersonalLocalInfoOpenApi } from './info/schema';

export const pluginApiDefinition: FeatureApiDefinition = {
  code: 'personal-local',
  basePath: '/plugins/personal-local',
  createRouter: (config: PluginConfigReader) =>
    createPersonalLocalInfoRouter({
      cookieKey: config.getRequired('COOKIE_KEY'),
      allowHeaderOverride: config.getBoolean('ALLOW_HEADER_OVERRIDE'),
    }),
  registerOpenApi: registerPersonalLocalInfoOpenApi,
};
