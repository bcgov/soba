export { metaRouter } from './route';
export { registerMetaOpenApi } from './schema';
import { metaRouter } from './route';
import { registerMetaOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const metaDomain: CoreDomain = {
  path: '/meta',
  router: metaRouter,
  registerOpenApi: registerMetaOpenApi,
};
