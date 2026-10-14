import { Request, Response } from 'express';
import { ApiErrorCodes } from '@soba/lib';
import { documentGenerationService, type DocumentRenderOutcome } from './service';
import { resolveCaller } from '../../core/middleware/actor';
import { accessDenial } from '../../core/middleware/formSubmitAccess';
import { contentDisposition } from '../../core/api/shared/contentDisposition';
import { checkedFileName, getUploadedFile } from '../../core/middleware/parseUpload';
import { templateExtensionsText } from '@soba/lib';
import { templateFileType } from '../../core/integrations/document-generation/templateFileType';
import {
  InternalError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
  UnsupportedMediaTypeError,
  ValidationError,
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
      throw new NotFoundError('Submission not found', ApiErrorCodes.submission_not_found);
    case 'template-notfound':
      throw new NotFoundError('Template not found', ApiErrorCodes.template_not_found);
    case 'template-unavailable':
      throw new ServiceUnavailableError(
        'Template content unavailable',
        ApiErrorCodes.template_unavailable,
      );
    case 'denied':
      throw accessDenial(req, NOT_AUTHORIZED, ApiErrorCodes.render_denied);
    case 'unavailable':
      throw new ServiceUnavailableError(
        'Document generation is not available for this submission',
        ApiErrorCodes.render_unavailable,
      );
    case 'busy':
      throw new ServiceUnavailableError(
        'Document generation is busy; try again shortly',
        ApiErrorCodes.render_busy,
      );
    case 'no-content':
      throw new UnprocessableEntityError(
        'Submission has no saved data to print',
        ApiErrorCodes.no_saved_data,
      );
    case 'infected':
      throw new UnprocessableEntityError('File failed virus scan');
    case 'scan-unavailable':
      throw new ServiceUnavailableError('Virus scanning unavailable');
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
  if (outcome.status === 'notfound') {
    throw new NotFoundError('Submission not found', ApiErrorCodes.submission_not_found);
  }
  if (outcome.status === 'denied')
    throw accessDenial(req, NOT_AUTHORIZED, ApiErrorCodes.render_denied);
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

/** Print with a template uploaded in this request; it is rendered and discarded. */
export async function printUploadedTemplateHandler(req: Request, res: Response): Promise<void> {
  const outcome = await documentGenerationService.printUpload(resolveCaller(req), {
    submissionId: req.params.id,
    template: uploadedTemplate(req),
  });
  respond(req, res, outcome, buildFilename(undefined));
}

/** Preview the caller's live data (multipart `data` field, JSON) with an uploaded template. */
export async function previewUploadedTemplateHandler(req: Request, res: Response): Promise<void> {
  const template = uploadedTemplate(req);
  const outcome = await documentGenerationService.previewUpload(resolveCaller(req), {
    submissionId: req.params.id,
    template,
    data: liveData((req.body as Record<string, unknown> | undefined)?.data),
  });
  respond(req, res, outcome, buildFilename(undefined));
}

function uploadedTemplate(req: Request) {
  const upload = getUploadedFile(req);
  const fileType = templateFileType(upload.originalname);
  if (!fileType) {
    throw new UnsupportedMediaTypeError(
      `Template must be one of: ${templateExtensionsText('cdogs')}`,
    );
  }
  return { content: upload.buffer, fileType, filename: checkedFileName(upload.originalname) };
}

function liveData(field: unknown): Record<string, unknown> {
  if (field === undefined) return {};
  let parsed: unknown;
  try {
    parsed = typeof field === 'string' ? JSON.parse(field) : undefined;
  } catch {
    parsed = undefined;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('data must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}
