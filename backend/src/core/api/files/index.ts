export { filesRouter } from './route';
export { registerFilesOpenApi } from './schema';
import { filesRouter } from './route';
import { registerFilesOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const filesDomain: CoreDomain = {
  path: '/files',
  router: filesRouter,
  registerOpenApi: registerFilesOpenApi,
};
