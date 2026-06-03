import { Response } from 'express';
import { z } from 'zod';
import {
  CreateFormBodySchema,
  CreateFormVersionBodySchema,
  FormIdParamsSchema,
  FormVersionIdParamsSchema,
  ListFormsQuerySchema,
  ListFormVersionsQuerySchema,
  SaveFormVersionBodySchema,
  SaveFormVersionParamsSchema,
  UpdateFormBodySchema,
  UpdateFormVersionBodySchema,
} from './schema';
import { formsApiService } from './service';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import type { Request } from 'express';

type CreateFormBody = z.infer<typeof CreateFormBodySchema>;
type CreateFormVersionBody = z.infer<typeof CreateFormVersionBodySchema>;
type FormIdParams = z.infer<typeof FormIdParamsSchema>;
type FormVersionIdParams = z.infer<typeof FormVersionIdParamsSchema>;
type UpdateFormBody = z.infer<typeof UpdateFormBodySchema>;
type UpdateFormVersionBody = z.infer<typeof UpdateFormVersionBodySchema>;
type SaveFormVersionBody = z.infer<typeof SaveFormVersionBodySchema>;
type SaveFormVersionParams = z.infer<typeof SaveFormVersionParamsSchema>;
type ListFormsQuery = z.infer<typeof ListFormsQuerySchema>;
type ListFormVersionsQuery = z.infer<typeof ListFormVersionsQuerySchema>;

export const getFormByEngineRef = asyncHandler(
  async (req: Request<{ engineRef: string }>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.getFormByEngineRef(ctx, req.params.engineRef);
    if (!result) {
      throw new NotFoundError('Form not found');
    }
    res.json(result);
  },
);

export const createForm = asyncHandler(
  async (req: Request<unknown, unknown, CreateFormBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.createForm(ctx, req.body);
    res.status(201).json(result);
  },
);

export const updateForm = asyncHandler(
  async (req: Request<FormIdParams, unknown, UpdateFormBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.updateForm(ctx, req.params.id, req.body);
    if (!result) {
      throw new NotFoundError('Form not found');
    }
    res.json(result);
  },
);

export const getForm = asyncHandler(async (req: Request<FormIdParams>, res: Response) => {
  const ctx = req.coreContext!;
  const result = await formsApiService.getForm(ctx, req.params.id);
  if (!result) {
    throw new NotFoundError('Form not found');
  }
  res.json(result);
});

export const listForms = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await formsApiService.list(ctx, req.query as unknown as ListFormsQuery);
  res.json(result);
});

export const getFormVersion = asyncHandler(
  async (req: Request<FormVersionIdParams>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.getFormVersion(ctx, req.params.id);
    if (!result) {
      throw new NotFoundError('Form version not found');
    }
    res.json(result);
  },
);

export const listFormVersions = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await formsApiService.listFormVersions(
    ctx,
    req.query as unknown as ListFormVersionsQuery,
  );
  res.json(result);
});

export const createFormVersion = asyncHandler(
  async (req: Request<unknown, unknown, CreateFormVersionBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.createDraft(ctx, req.body.formId, req.body.visibility);
    res.status(201).json(result);
  },
);

export const updateFormVersion = asyncHandler(
  async (req: Request<FormVersionIdParams, unknown, UpdateFormVersionBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.updateDraft(ctx, req.params.id, req.body.state, req.body.visibility);
    if (!result) {
      throw new NotFoundError('Form version not found');
    }
    res.json(result);
  },
);

export const saveFormVersion = asyncHandler(
  async (req: Request<SaveFormVersionParams, unknown, SaveFormVersionBody>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.save(ctx, req.params.id, req.body);
    res.json(result);
  },
);

export const deleteFormVersion = asyncHandler(
  async (req: Request<FormVersionIdParams>, res: Response) => {
    const ctx = req.coreContext!;
    const result = await formsApiService.delete(ctx, req.params.id);
    if (!result) {
      throw new NotFoundError('Form version not found');
    }
    res.status(204).send();
  },
);

export const deleteForm = asyncHandler(async (req: Request<FormIdParams>, res: Response) => {
  const ctx = req.coreContext!;
  const result = await formsApiService.deleteForm(ctx, req.params.id);
  if (!result) {
    throw new NotFoundError('Form not found');
  }
  res.status(204).send();
});

export const listFormioForms = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.coreContext!;
  const result = await formsApiService.listFormioForms(ctx, req.query as unknown as ListFormsQuery);
  res.json(result);
});
