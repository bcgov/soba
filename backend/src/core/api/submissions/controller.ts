import { Response } from 'express';
import { z } from 'zod';
import {
  OpenSubmissionBodySchema,
  SubmissionDataBodySchema,
  SubmissionIdParamsSchema,
  SubmitSubmissionBodySchema,
} from './schema';
import { submissionsApiService } from './service';
import type { ListSubmissionsQueryInput } from './serviceFactory';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import type { Request } from 'express';

type OpenSubmissionBody = z.infer<typeof OpenSubmissionBodySchema>;
type SubmissionIdParams = z.infer<typeof SubmissionIdParamsSchema>;
type SubmissionDataBody = z.infer<typeof SubmissionDataBodySchema>;
type SubmitSubmissionBody = z.infer<typeof SubmitSubmissionBodySchema>;

const SUBMISSION_NOT_FOUND = 'Submission not found';

export const getSubmission = asyncHandler(
  async (req: Request<SubmissionIdParams>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.get(ctx, req.params.id);
    if (!result) {
      throw new NotFoundError(SUBMISSION_NOT_FOUND);
    }
    res.json(result);
  },
);

export const getSubmissionData = asyncHandler(
  async (req: Request<SubmissionIdParams>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.getData(ctx, req.params.id);
    if (!result) {
      throw new NotFoundError('Submission content not found');
    }
    res.json(result);
  },
);

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const scope = req.listScope!;
  const result = await submissionsApiService.list(
    { workspaceIds: scope.workspaceIds, actorId: scope.actorId },
    { ...(req.query as unknown as ListSubmissionsQueryInput), locale: req.sortLocale! },
  );
  res.json(result);
});

export const openSubmission = asyncHandler(
  async (req: Request<unknown, unknown, OpenSubmissionBody>, res: Response) => {
    const ctx = req.coreContext!;
    // 201 when this call created the row, 200 when it idempotently returned an existing one.
    const { created, submission } = await submissionsApiService.open(ctx, req.body);
    res.status(created ? 201 : 200).json(submission);
  },
);

export const saveSubmission = asyncHandler(
  async (req: Request<SubmissionIdParams, unknown, SubmissionDataBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.save(ctx, req.params.id, req.body);
    res.json(result);
  },
);

export const submitSubmission = asyncHandler(
  async (req: Request<SubmissionIdParams, unknown, SubmitSubmissionBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.submit(ctx, req.params.id, req.body);
    res.json(result);
  },
);

export const deleteSubmission = asyncHandler(
  async (req: Request<SubmissionIdParams>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.delete(ctx, req.params.id);
    if (!result) {
      throw new NotFoundError(SUBMISSION_NOT_FOUND);
    }
    res.status(204).send();
  },
);
