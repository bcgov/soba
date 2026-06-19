import { Response } from 'express';
import { asyncHandler } from '../shared/asyncHandler';
import type { Request } from 'express';
import { NotFoundError, ValidationError } from '../../errors';
import { getActorId } from '../../middleware/actor';
import { meApiService } from './service';

export const getCurrentActor = asyncHandler(async (req: Request, res: Response) => {
  const actorId = getActorId(req);
  if (!actorId) {
    throw new ValidationError('Missing actor identity (actorId or x-soba-user-id)');
  }
  const result = await meApiService.get(actorId);
  if (!result) {
    throw new NotFoundError('Current actor not found');
  }
  res.json(result);
});
