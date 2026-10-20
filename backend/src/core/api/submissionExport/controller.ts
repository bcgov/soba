import type { Request, Response } from 'express';
import type { SubmissionExportBody, SubmissionExportFieldsBody } from '@soba/lib';
import { submissionExportService } from '../../services/submissionExport/service';
import { sendAttachment } from '../shared/contentDisposition';

const exportContext = (req: Request) => {
  const ctx = req.coreContext!;
  return { workspaceId: ctx.workspaceId, formId: req.params.id, actorId: ctx.actorId };
};

export async function exportFieldsHandler(req: Request, res: Response): Promise<void> {
  res.json(
    await submissionExportService.fields(
      exportContext(req),
      req.body as SubmissionExportFieldsBody,
    ),
  );
}

export async function exportHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as SubmissionExportBody;
  // Attachment links point at the caller's app; CORS vetted the origin.
  const linkBase = `${req.get('origin') ?? ''}/${body.locale}`;
  const file = await submissionExportService.export(exportContext(req), body, linkBase);
  sendAttachment(res, `${file.contentType}; charset=utf-8`, file.filename, file.body);
}
