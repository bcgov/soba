import express from 'express';
import { validateRequest } from '../shared/validation';
import { requireFeature } from '../../middleware/requireFeature';
import { sortLocale } from '../../middleware/sortLocale';
import { Features } from '../../db/codes';
import {
  getCurrentActor,
  getCurrentActorTenants,
  listMySubmissions,
  patchCurrentActor,
} from './controller';
import { ListMySubmissionsQuerySchema, PatchMeBodySchema } from './schema';

const router = express.Router();

router.get('/me', getCurrentActor);
router.patch('/me', validateRequest({ body: PatchMeBodySchema }), patchCurrentActor);
router.get('/me/tenants', getCurrentActorTenants);
// The core surface has no feature gate of its own; this list belongs to submit mode.
router.get(
  '/me/submissions',
  requireFeature(Features.submit_mode),
  validateRequest({ query: ListMySubmissionsQuerySchema }),
  sortLocale,
  listMySubmissions,
);

export { router as meRouter };
