import express from 'express';
import { validateRequest } from '../shared/validation';
import { workspaceFromQuery } from '../../middleware/workspaceContext';
import { listMembers } from './controller';
import { ListMembersQuerySchema } from './schema';

const router = express.Router();

router.get(
  '/',
  validateRequest({ query: ListMembersQuerySchema }),
  workspaceFromQuery,
  listMembers,
);

export { router as membersRouter };
