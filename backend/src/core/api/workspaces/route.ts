import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromQuery, workspaceFromResource } from '../../middleware/workspaceContext';
import {
  listWorkspaces,
  streamWorkspaces,
  createWorkspace,
  getCurrentWorkspace,
  getWorkspaceById,
  updateWorkspace,
} from './controller';
import {
  ListWorkspacesQuerySchema,
  CreateWorkspaceBodySchema,
  UpdateWorkspaceBodySchema,
  WorkspaceIdParamsSchema,
} from './schema';

const router = express.Router();

// Actor-only: lists the workspaces the caller belongs to (no workspace context required).
router.get('/workspaces', validateRequest({ query: ListWorkspacesQuerySchema }), listWorkspaces);
router.get('/workspaces/stream', streamWorkspaces);
router.post('/workspaces', validateRequest({ body: CreateWorkspaceBodySchema }), createWorkspace);
// "Current" resolves from the tab's ?workspaceId; echoes the header like other scoped routes.
// Registered before '/workspaces/:id' so the literal isn't captured as an id.
router.get('/workspaces/current', workspaceFromQuery, getCurrentWorkspace);
// Selection endpoint: verifies membership, returns the workspace, and echoes x-soba-workspace-id.
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
