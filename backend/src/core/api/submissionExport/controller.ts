import type { Request, Response } from 'express';
import type { StartSubmissionExportBody } from '@soba/lib';
import { asyncHandler } from '../shared/asyncHandler';
import { submissionExportService, type ExportContext } from './service';

type ExportParams = { id: string; exportId?: string };

const contextOf = (req: Request<ExportParams>): ExportContext => ({
  actorId: req.coreContext!.actorId,
  formId: req.params.id,
});

export const getExportFields = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await submissionExportService.fields());
});

export const listExports = asyncHandler(async (req: Request<ExportParams>, res: Response) => {
  res.json(await submissionExportService.list(contextOf(req)));
});

export const getExport = asyncHandler(async (req: Request<ExportParams>, res: Response) => {
  res.json(await submissionExportService.get(contextOf(req), req.params.exportId!));
});

export const startExport = asyncHandler(
  async (req: Request<ExportParams, unknown, StartSubmissionExportBody>, res: Response) => {
    res.status(201).json(await submissionExportService.start(contextOf(req), req.body));
  },
);
