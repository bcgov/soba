import express from 'express';
import { validateRequest } from '../shared/validation';
import { listWorkspaces, getCurrentWorkspace } from './controller';
import { ListWorkspacesQuerySchema } from './schema';

const router = express.Router();

router.get('/workspaces/current', getCurrentWorkspace);
router.get('/workspaces', validateRequest({ query: ListWorkspacesQuerySchema }), listWorkspaces);

export { router as workspacesRouter };
