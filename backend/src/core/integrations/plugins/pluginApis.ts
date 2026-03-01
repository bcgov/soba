import express from 'express';
import { registerOpenApiPaths } from '../../api/shared/openapi';
import { createPluginConfigReader } from '../../config/pluginConfig';
import { getEnabledPluginApiDefinitions } from './PluginRegistry';

const enabledApiDefinitions = getEnabledPluginApiDefinitions();

registerOpenApiPaths((registry) => {
  for (const definition of enabledApiDefinitions) {
    definition.registerOpenApi?.(registry);
  }
});

export const createPluginApiRouter = () => {
  const router = express.Router();

  for (const definition of enabledApiDefinitions) {
    router.use(
      definition.basePath,
      definition.createRouter(createPluginConfigReader(definition.code)),
    );
  }

  return router;
};
