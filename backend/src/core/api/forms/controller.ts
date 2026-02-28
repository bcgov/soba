import { Request, Response } from 'express';
import { z } from 'zod';
import {
  CreateFormBodySchema,
  CreateFormVersionBodySchema,
  ListFormsQuerySchema,
  ListFormVersionsQuerySchema,
  SaveFormVersionBodySchema,
  SaveFormVersionParamsSchema,
  UpdateFormBodySchema,
  UpdateFormVersionBodySchema,
  UpdateFormVersionParamsSchema,
} from './schema';
import { formsApiService } from './service';

type CreateFormBody = z.infer<typeof CreateFormBodySchema>;
type CreateFormVersionBody = z.infer<typeof CreateFormVersionBodySchema>;
type UpdateFormBody = z.infer<typeof UpdateFormBodySchema>;
type UpdateFormVersionBody = z.infer<typeof UpdateFormVersionBodySchema>;
type UpdateFormVersionParams = z.infer<typeof UpdateFormVersionParamsSchema>;
type SaveFormVersionBody = z.infer<typeof SaveFormVersionBodySchema>;
type SaveFormVersionParams = z.infer<typeof SaveFormVersionParamsSchema>;
type ListFormsQuery = z.infer<typeof ListFormsQuerySchema>;
type ListFormVersionsQuery = z.infer<typeof ListFormVersionsQuerySchema>;

export const createForm = async (req: Request<unknown, unknown, CreateFormBody>, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.createForm(ctx, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const updateForm = async (
  req: Request<UpdateFormVersionParams, unknown, UpdateFormBody>,
  res: Response,
) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.updateForm(ctx, req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const getForm = async (req: Request<UpdateFormVersionParams>, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.getForm(ctx, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const listForms = async (req: Request, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.list(ctx, req.query as unknown as ListFormsQuery);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const getFormVersion = async (req: Request<UpdateFormVersionParams>, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.getFormVersion(ctx, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Form version not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const listFormVersions = async (req: Request, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.listFormVersions(
      ctx,
      req.query as unknown as ListFormVersionsQuery,
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const createFormVersion = async (
  req: Request<unknown, unknown, CreateFormVersionBody>,
  res: Response,
) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.createDraft(ctx, req.body.formId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const updateFormVersion = async (
  req: Request<UpdateFormVersionParams, unknown, UpdateFormVersionBody>,
  res: Response,
) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.updateDraft(ctx, req.params.id, req.body.state);
    if (!result) {
      return res.status(404).json({ error: 'Form version not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const saveFormVersion = async (
  req: Request<SaveFormVersionParams, unknown, SaveFormVersionBody>,
  res: Response,
) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.save(ctx, req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const deleteFormVersion = async (req: Request<UpdateFormVersionParams>, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.delete(ctx, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Form version not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const deleteForm = async (req: Request<UpdateFormVersionParams>, res: Response) => {
  try {
    const ctx = req.coreContext!;
    const result = await formsApiService.deleteForm(ctx, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
