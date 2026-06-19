import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromQuery, workspaceFromResource } from '../../middleware/workspaceContext';
import { listWorkspaces, getCurrentWorkspace, getWorkspaceById } from './controller';
import { ListWorkspacesQuerySchema } from './schema';

const router = express.Router();

// Actor-only: lists the workspaces the caller belongs to (no workspace context required).
router.get('/workspaces', validateRequest({ query: ListWorkspacesQuerySchema }), listWorkspaces);
// "Current" resolves from the tab's ?workspaceId; echoes the header like other scoped routes.
// Registered before '/workspaces/:id' so the literal isn't captured as an id.
router.get('/workspaces/current', workspaceFromQuery, getCurrentWorkspace);
// Selection endpoint: verifies membership, returns the workspace, and echoes x-soba-workspace-id.
router.get(
  '/workspaces/:id',
  workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' }),
  getWorkspaceById,
);

export { router as workspacesRouter };
