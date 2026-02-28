import { Request, Response } from 'express';
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

type CreateSubmissionBody = z.infer<typeof CreateSubmissionBodySchema>;
type UpdateSubmissionBody = z.infer<typeof UpdateSubmissionBodySchema>;
type UpdateSubmissionParams = z.infer<typeof UpdateSubmissionParamsSchema>;
type SaveSubmissionBody = z.infer<typeof SaveSubmissionBodySchema>;
type SaveSubmissionParams = z.infer<typeof SaveSubmissionParamsSchema>;
type ListSubmissionsQuery = z.infer<typeof ListSubmissionsQuerySchema>;

export const getSubmission = async (req: Request<UpdateSubmissionParams>, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.get(ctx, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const listSubmissions = async (req: Request, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.list(
      ctx,
      req.query as unknown as ListSubmissionsQuery,
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const createSubmission = async (
  req: Request<unknown, unknown, CreateSubmissionBody>,
  res: Response,
) => {
  try {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.create(ctx, req.body.formId, req.body.formVersionId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const updateSubmission = async (
  req: Request<UpdateSubmissionParams, unknown, UpdateSubmissionBody>,
  res: Response,
) => {
  try {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.update(ctx, req.params.id, req.body.workflowState);
    if (!result) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const saveSubmission = async (
  req: Request<SaveSubmissionParams, unknown, SaveSubmissionBody>,
  res: Response,
) => {
  try {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.save(ctx, req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const deleteSubmission = async (req: Request<UpdateSubmissionParams>, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await submissionsApiService.delete(ctx, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
