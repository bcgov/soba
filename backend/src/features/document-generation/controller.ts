import { Request, Response } from 'express';
import { documentGenerationService, type DocumentRenderOutcome } from './service';
import { resolveCaller } from '../../core/middleware/actor';
import { accessDenial } from '../../core/middleware/formSubmitAccess';
import {
  InternalError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
} from '../../core/errors';

interface RenderBody {
  template: Record<string, unknown>;
  options?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

/** Filename from the CDOGS options: `${reportName}.${convertTo}`, falling back to `document`. */
function buildFilename(options: Record<string, unknown> | undefined): string {
  const reportName = options?.reportName;
  const convertTo = options?.convertTo;
  const base = typeof reportName === 'string' && reportName ? reportName : 'document';
  const ext = typeof convertTo === 'string' && convertTo ? `.${convertTo}` : '';
  return `${base}${ext}`;
}

/**
 * RFC 5987 Content-Disposition: a sanitized ASCII `filename` fallback plus a UTF-8 `filename*` so
 * modern clients render the real name. Both forms are injection-safe (ASCII strips CR/LF/quotes,
 * filename* is percent-encoded).
 */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
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
    case 'denied':
      throw accessDenial(req, 'Not authorized to generate this document');
    case 'unavailable':
      throw new ServiceUnavailableError('Document generation is not available for this submission');
    case 'no-content':
      throw new UnprocessableEntityError('Submission has no saved data to print');
    case 'ok':
      res.setHeader('Content-Type', outcome.contentType ?? 'application/octet-stream');
      res.setHeader('Content-Disposition', contentDisposition(filename));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(outcome.data);
      return;
    default: {
      const unhandled: never = outcome;
      throw new InternalError(`Unhandled document render outcome: ${String(unhandled)}`);
    }
  }
}

export async function previewDocumentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as RenderBody;
  const outcome = await documentGenerationService.preview(resolveCaller(req), {
    submissionId: req.params.id,
    template: body.template,
    options: body.options,
    data: body.data ?? {},
  });
  respond(req, res, outcome, buildFilename(body.options));
}

export async function printDocumentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as RenderBody;
  const outcome = await documentGenerationService.print(resolveCaller(req), {
    submissionId: req.params.id,
    template: body.template,
    options: body.options,
  });
  respond(req, res, outcome, buildFilename(body.options));
}
