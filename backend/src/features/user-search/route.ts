import express, { type RequestHandler } from 'express';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { validateRequest } from '../../core/api/shared/validation';
import { requireFeature } from '../../core/middleware/requireFeature';
import { sortLocale } from '../../core/middleware/sortLocale';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { Features } from '../../core/db/codes';
import { requireUserSearchAccess } from './access';
import { getUserSearchCapabilitiesHandler, searchUsersHandler } from './controller';
import {
  UserSearchParamsSchema,
  UserSearchQuerySchema,
  UserSearchScopeParamsSchema,
} from './schema';

/** GET / lists what can be searched; GET /:identityProvider searches. */
function userSearchRouter(resolveScope: RequestHandler): express.Router {
  const router = express.Router({ mergeParams: true });
  router.use(requireFeature(Features.user_search));
  router.get(
    '/',
    validateRequest({ params: UserSearchScopeParamsSchema }),
    resolveScope,
    requireUserSearchAccess,
    sortLocale,
    asyncHandler(getUserSearchCapabilitiesHandler),
  );
  router.get(
    '/:identityProvider',
    validateRequest({ params: UserSearchParamsSchema, query: UserSearchQuerySchema }),
    resolveScope,
    requireUserSearchAccess,
    sortLocale,
    asyncHandler(searchUsersHandler),
  );
  return router;
}

/** Mounted at /workspaces/:id/user-search. */
export const workspaceUserSearchRouter = userSearchRouter(
  workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' }),
);

/** Mounted at /forms/:id/user-search on the design surface. */
export const formUserSearchRouter = userSearchRouter(
  workspaceFromResource({ kind: 'form', idFrom: 'paramsId' }),
);
