import express from 'express';
import { validateRequest } from '../shared/validation';
import { listMembers } from './controller';
import { ListMembersQuerySchema } from './schema';

const router = express.Router();

router.get('/', validateRequest({ query: ListMembersQuerySchema }), listMembers);

export { router as membersRouter };
