import { Response } from 'express';
import { z } from 'zod';
import {
  CreateSubmissionBodySchema,
  ListSubmissionsQuerySchema,
  SaveSubmissionBodySchema,
  SaveSubmissionParamsSchema,
  UpdateSubmissionBodySchema,
  UpdateSubmissionParamsSchema,
} from './schema';
import { submissionsApiService } from './service';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import type { Request } from 'express';

type CreateSubmissionBody = z.infer<typeof CreateSubmissionBodySchema>;
type UpdateSubmissionBody = z.infer<typeof UpdateSubmissionBodySchema>;
type UpdateSubmissionParams = z.infer<typeof UpdateSubmissionParamsSchema>;
type SaveSubmissionBody = z.infer<typeof SaveSubmissionBodySchema>;
type SaveSubmissionParams = z.infer<typeof SaveSubmissionParamsSchema>;
type ListSubmissionsQuery = z.infer<typeof ListSubmissionsQuerySchema>;

export const getSubmission = asyncHandler(
  async (req: Request<UpdateSubmissionParams>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.get(ctx, req.params.id);
    if (!result) {
      throw new NotFoundError('Submission not found');
    }
    res.json(result);
  },
);

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await submissionsApiService.list(
    ctx,
    req.query as unknown as ListSubmissionsQuery,
  );
  res.json(result);
});

export const createSubmission = asyncHandler(
  async (req: Request<unknown, unknown, CreateSubmissionBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.create(ctx, req.body.formId, req.body.formVersionId);
    res.status(201).json(result);
  },
);

export const updateSubmission = asyncHandler(
  async (req: Request<UpdateSubmissionParams, unknown, UpdateSubmissionBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.update(ctx, req.params.id, req.body.workflowState);
    if (!result) {
      throw new NotFoundError('Submission not found');
    }
    res.json(result);
  },
);

export const saveSubmission = asyncHandler(
  async (req: Request<SaveSubmissionParams, unknown, SaveSubmissionBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.save(ctx, req.params.id, req.body);
    res.json(result);
  },
);

export const deleteSubmission = asyncHandler(
  async (req: Request<UpdateSubmissionParams>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.delete(ctx, req.params.id);
    if (!result) {
      throw new NotFoundError('Submission not found');
    }
    res.status(204).send();
  },
);
