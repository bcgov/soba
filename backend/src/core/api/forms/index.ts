export { formVersionsRouter } from './route';
export { registerFormsOpenApi } from './schema';
import { formVersionsRouter } from './route';
import { registerFormsOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const formsDomain: CoreDomain = {
  path: '/',
  router: formVersionsRouter,
  registerOpenApi: registerFormsOpenApi,
};
