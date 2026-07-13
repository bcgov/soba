export { groupsRouter } from './route';
export { registerGroupsOpenApi } from './schema';
import { groupsRouter } from './route';
import { registerGroupsOpenApi } from './schema';
import type { CoreDomain } from '../shared/openapi';

export const groupsDomain: CoreDomain = {
  path: '/',
  router: groupsRouter,
  registerOpenApi: registerGroupsOpenApi,
};
