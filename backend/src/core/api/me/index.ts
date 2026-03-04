export { meRouter } from './route';
export { registerMeOpenApi } from './schema';
import { meRouter } from './route';
import { registerMeOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const meDomain: CoreDomain = {
  path: '/',
  router: meRouter,
  registerOpenApi: registerMeOpenApi,
};
