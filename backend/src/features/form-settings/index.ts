import type { RegisterOpenApiPaths } from '../../core/api/shared/openapi';
import { formSettingsModules } from './registry';

export { formSettingsRouter } from './router';
export { formSettingsModules } from './registry';
export type { FormSettingsModule, WorkspaceScopedTable } from './types';

export const registerFormSettingsOpenApi: RegisterOpenApiPaths = (registry) => {
  for (const module of formSettingsModules) {
    module.registerOpenApi(registry);
  }
};
