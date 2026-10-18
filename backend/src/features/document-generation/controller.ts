import { NextFunction, Request, Response } from 'express';
import {
  ApiErrorCodes,
  templateExtensionsText,
  type PrintBody,
  type PrintOptions,
} from '@soba/lib';
import {
  documentGenerationService,
  staffDocumentService,
  type DocumentRenderOutcome,
  type UploadedTemplate,
} from './service';
import { RENDER_BUSY } from './renderSlots';
import { resolveCaller } from '../../core/middleware/actor';
import { accessDenial } from '../../core/middleware/formSubmitAccess';
import { contentDisposition } from '../../core/api/shared/contentDisposition';
import { checkedFileName, getUploadedFile } from '../../core/middleware/parseUpload';
import { templateFileType } from '../../core/integrations/document-generation/templateFileType';
import {
  InternalError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
  UnsupportedMediaTypeError,
} from '../../core/errors';

const NOT_AUTHORIZED = 'Not authorized to generate this document';
const SUBMISSION_NOT_FOUND = 'Submission not found';

/** Filename from the print options: `${reportName}.${convertTo}`, falling back to `document`. */
function buildFilename(options: PrintOptions | undefined): string {
  const base = options?.reportName ?? 'document';
  const ext = options?.convertTo ? `.${options.convertTo}` : '';
  return `${base}${ext}`;
}

/** Throw the API error for a render that produced no document. */
function throwRefusal(
  req: Request,
  outcome: Exclude<DocumentRenderOutcome, { status: 'ok' }>,
): never {
  switch (outcome.status) {
    case 'notfound':
      throw new NotFoundError(SUBMISSION_NOT_FOUND, ApiErrorCodes.submission_not_found);
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
      throw new ServiceUnavailableError(RENDER_BUSY, ApiErrorCodes.render_busy);
    case 'no-content':
      throw new UnprocessableEntityError(
        'Submission has no saved data to print',
        ApiErrorCodes.no_saved_data,
      );
    case 'infected':
      throw new UnprocessableEntityError('File failed virus scan', ApiErrorCodes.file_infected);
    case 'scan-unavailable':
      throw new ServiceUnavailableError(
        'Virus scanning unavailable',
        ApiErrorCodes.scan_unavailable,
      );
    case 'error':
      // The generic error for a failed render, or for a stored template that cannot be rendered.
      throw outcome.error;
    default: {
      const unhandled: never = outcome;
      throw new InternalError(`Unhandled document render outcome: ${String(unhandled)}`);
    }
  }
}

/** Stream the rendered document, or throw the error for the outcome. */
function respond(
  req: Request,
  res: Response,
  outcome: DocumentRenderOutcome,
  filename: string,
): void {
  if (outcome.status !== 'ok') throwRefusal(req, outcome);
  res.setHeader('Content-Type', outcome.contentType ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition('attachment', filename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(outcome.data);
}

function uploadedTemplate(req: Request): UploadedTemplate {
  const upload = getUploadedFile(req);
  const fileType = templateFileType(upload.originalname);
  if (!fileType) {
    throw new UnsupportedMediaTypeError(
      `Template must be one of: ${templateExtensionsText('cdogs')}`,
    );
  }
  return { content: upload.buffer, fileType, filename: checkedFileName(upload.originalname) };
}

export async function listSubmissionTemplatesHandler(req: Request, res: Response): Promise<void> {
  const outcome = await documentGenerationService.listTemplates(resolveCaller(req), req.params.id);
  if (outcome.status === 'notfound') {
    throw new NotFoundError(SUBMISSION_NOT_FOUND, ApiErrorCodes.submission_not_found);
  }
  if (outcome.status === 'denied')
    throw accessDenial(req, NOT_AUTHORIZED, ApiErrorCodes.render_denied);
  res.json(outcome.facts);
}

export async function printDocumentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as PrintBody;
  const outcome = await documentGenerationService.print(resolveCaller(req), {
    submissionId: req.params.id,
    templateId: body.templateId,
    options: body.options,
  });
  respond(req, res, outcome, buildFilename(body.options));
}

export async function listStaffSubmissionTemplatesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const outcome = await staffDocumentService.listTemplates(
    req.coreContext!.workspaceId,
    req.params.id,
  );
  if (outcome.status === 'notfound') {
    throw new NotFoundError(SUBMISSION_NOT_FOUND, ApiErrorCodes.submission_not_found);
  }
  res.json(outcome.facts);
}

export async function printStaffDocumentHandler(req: Request, res: Response): Promise<void> {
  const { workspaceId, actorId } = req.coreContext!;
  const body = req.body as PrintBody;
  const outcome = await staffDocumentService.print(workspaceId, actorId, {
    submissionId: req.params.id,
    templateId: body.templateId,
    options: body.options,
  });
  respond(req, res, outcome, buildFilename(body.options));
}

/** Refuse an upload print that cannot render before its body is read. */
export async function preparePrintUploadHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const outcome = await staffDocumentService.prepareUpload(
    req.coreContext!.workspaceId,
    req.params.id,
  );
  if (outcome.status !== 'ok') throwRefusal(req, outcome);
  req.printUpload = outcome.prepared;
  next();
}

/** Print with a template uploaded in this request; it is rendered and discarded. */
export async function printStaffUploadHandler(req: Request, res: Response): Promise<void> {
  const prepared = req.printUpload;
  if (!prepared)
    throw new Error('printStaffUploadHandler must run after preparePrintUploadHandler');
  const options = req.body as PrintOptions;
  const outcome = await staffDocumentService.printUpload(
    prepared,
    uploadedTemplate(req),
    options,
    req.coreContext!.actorId,
  );
  respond(req, res, outcome, buildFilename(options));
}
