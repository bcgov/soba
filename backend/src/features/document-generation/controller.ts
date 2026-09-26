import { Request, Response } from 'express';
import { documentGenerationService, type DocumentRenderOutcome } from './service';
import { resolveCaller } from '../../core/middleware/actor';
import { accessDenial } from '../../core/middleware/formSubmitAccess';
import { contentDisposition } from '../../core/api/shared/contentDisposition';
import {
  InternalError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
} from '../../core/errors';

interface RenderBody {
  templateId: string;
  options?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

const NOT_AUTHORIZED = 'Not authorized to generate this document';

/** Filename from the CDOGS options: `${reportName}.${convertTo}`, falling back to `document`. */
function buildFilename(options: Record<string, unknown> | undefined): string {
  const reportName = options?.reportName;
  const convertTo = options?.convertTo;
  const base = typeof reportName === 'string' && reportName ? reportName : 'document';
  const ext = typeof convertTo === 'string' && convertTo ? `.${convertTo}` : '';
  return `${base}${ext}`;
}

/** Map a render outcome to an HTTP response: stream the bytes, or throw the matching error. */
function respond(
  req: Request,
  res: Response,
  outcome: DocumentRenderOutcome,
  filename: string,
): void {
  switch (outcome.status) {
    case 'notfound':
      throw new NotFoundError('Submission not found');
    case 'template-notfound':
      throw new NotFoundError('Template not found');
    case 'template-unavailable':
      throw new ServiceUnavailableError('Template content unavailable');
    case 'denied':
      throw accessDenial(req, NOT_AUTHORIZED);
    case 'unavailable':
      throw new ServiceUnavailableError('Document generation is not available for this submission');
    case 'busy':
      throw new ServiceUnavailableError('Document generation is busy; try again shortly');
    case 'no-content':
      throw new UnprocessableEntityError('Submission has no saved data to print');
    case 'error':
      // The generic error for a failed render, or for a stored template that cannot be rendered.
      throw outcome.error;
    case 'ok':
      res.setHeader('Content-Type', outcome.contentType ?? 'application/octet-stream');
      res.setHeader('Content-Disposition', contentDisposition('attachment', filename));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(outcome.data);
      return;
    default: {
      const unhandled: never = outcome;
      throw new InternalError(`Unhandled document render outcome: ${String(unhandled)}`);
    }
  }
}

export async function listSubmissionTemplatesHandler(req: Request, res: Response): Promise<void> {
  const outcome = await documentGenerationService.listTemplates(resolveCaller(req), req.params.id);
  if (outcome.status === 'notfound') throw new NotFoundError('Submission not found');
  if (outcome.status === 'denied') throw accessDenial(req, NOT_AUTHORIZED);
  res.json({ items: outcome.templates });
}

export async function previewDocumentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as RenderBody;
  const outcome = await documentGenerationService.preview(resolveCaller(req), {
    submissionId: req.params.id,
    templateId: body.templateId,
    options: body.options,
    data: body.data ?? {},
  });
  respond(req, res, outcome, buildFilename(body.options));
}

export async function printDocumentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as RenderBody;
  const outcome = await documentGenerationService.print(resolveCaller(req), {
    submissionId: req.params.id,
    templateId: body.templateId,
    options: body.options,
  });
  respond(req, res, outcome, buildFilename(body.options));
}
