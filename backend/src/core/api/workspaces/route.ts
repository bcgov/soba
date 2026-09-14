import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromResource } from '../../middleware/workspaceContext';
import {
  listWorkspaces,
  lookupWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
} from './controller';
import {
  ListWorkspacesQuerySchema,
  CreateWorkspaceBodySchema,
  UpdateWorkspaceBodySchema,
  WorkspaceIdParamsSchema,
  WorkspaceLookupQuerySchema,
} from './schema';

const router = express.Router();

// Actor-only: lists the workspaces the caller belongs to (no workspace context required).
router.get('/workspaces', validateRequest({ query: ListWorkspacesQuerySchema }), listWorkspaces);
router.post('/workspaces', validateRequest({ body: CreateWorkspaceBodySchema }), createWorkspace);
// Registered before the `:id` route, which would otherwise take `lookup` as an id.
router.get(
  '/workspaces/lookup',
  validateRequest({ query: WorkspaceLookupQuerySchema }),
  lookupWorkspaces,
);

router.get(
  '/workspaces/:id',
  workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' }),
  getWorkspaceById,
);
router.patch(
  '/workspaces/:id',
  validateRequest({ params: WorkspaceIdParamsSchema, body: UpdateWorkspaceBodySchema }),
  workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' }),
  updateWorkspace,
);

export { router as workspacesRouter };
