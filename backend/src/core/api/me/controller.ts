import { Response } from 'express';
import { asyncHandler } from '../shared/asyncHandler';
import type { Request } from 'express';
import { NotFoundError } from '../../errors';
import { meApiService } from './service';

export const getCurrentActor = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await meApiService.get(ctx.actorId);
  if (!result) {
    throw new NotFoundError('Current actor not found');
  }
  res.json(result);
});
