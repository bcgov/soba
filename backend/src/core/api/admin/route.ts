import express from 'express';
import { validateRequest } from '../shared/validation';
import { addSobaAdminHandler, listSobaAdminsHandler, removeSobaAdminHandler } from './controller';
import {
  AddSobaAdminBodySchema,
  ListSobaAdminsQuerySchema,
  SobaAdminUserIdParamsSchema,
} from './schema';

const router = express.Router();

router.get(
  '/soba-admins',
  validateRequest({ query: ListSobaAdminsQuerySchema }),
  listSobaAdminsHandler,
);
router.post('/soba-admins', validateRequest({ body: AddSobaAdminBodySchema }), addSobaAdminHandler);
router.delete(
  '/soba-admins/:userId',
  validateRequest({ params: SobaAdminUserIdParamsSchema }),
  removeSobaAdminHandler,
);

export { router as adminRouter };
