import { Request, Response } from 'express';
import { documentGenerationService, type DocumentRenderOutcome } from './service';
import { resolveCaller } from '../../core/middleware/actor';
import { accessDenial } from '../../core/middleware/formSubmitAccess';
import {
  InternalError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
  ValidationError,
} from '../../core/errors';
import { documentGenerationConfigurationService } from './configurationService';

interface RenderBody {
  template?: Record<string, unknown>;
  options?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type ConfigurationResult = Awaited<ReturnType<typeof documentGenerationConfigurationService.get>>;

function serializeTemplate(template: ConfigurationResult['templates'][number]) {
  return {
    id: template.id,
    fileId: template.fileId,
    formId: template.formId,
    filename: template.file.filename,
    contentType: template.file.contentType,
    size: template.file.size,
    createdBy: template.createdBy,
    createdAt: template.createdAt.toISOString(),
    updatedBy: template.updatedBy,
    updatedAt: template.updatedAt.toISOString(),
  };
}

function serializeConfiguration(
  configuration: ConfigurationResult['configuration'],
  formId: string,
) {
  return {
    formId: configuration?.formId ?? formId,
    printableName: configuration?.printableName ?? null,
    defaultTemplateId: configuration?.defaultTemplateId ?? null,
    createdBy: configuration?.createdBy ?? null,
    createdAt: configuration?.createdAt.toISOString() ?? null,
    updatedBy: configuration?.updatedBy ?? null,
    updatedAt: configuration?.updatedAt.toISOString() ?? null,
  };
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
    case 'unconfigured':
      throw new UnprocessableEntityError('Document generation is not configured for this form');
    case 'no-content':
      throw new UnprocessableEntityError('Submission has no saved data to print');
    case 'error':
      // The backend call failed; re-throw the mapped AppError so httpErrorMapper's status is preserved.
      throw outcome.error;
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
    template: body.template!,
    options: body.options,
    data: body.data ?? {},
  });
  respond(req, res, outcome, buildFilename(body.options));
}

export async function printDocumentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as RenderBody;
  const outcome = await documentGenerationService.print(resolveCaller(req), {
    submissionId: req.params.id,
    options: body.options,
  });
  const options =
    outcome.status === 'ok' && outcome.reportName
      ? { ...body.options, reportName: outcome.reportName }
      : body.options;
  respond(req, res, outcome, buildFilename(options));
}

export async function getDocumentGenerationConfigurationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await documentGenerationConfigurationService.get(req.params.id);
  res.json({
    configuration: serializeConfiguration(result.configuration, req.params.id),
    templates: result.templates.map(serializeTemplate),
  });
}

export async function downloadDocumentGenerationTemplateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await documentGenerationConfigurationService.getTemplateFile(
    req.params.id,
    req.params.templateId,
  );
  if (!result) throw new NotFoundError('Document template not found');
  const { record, file } = result;
  res.setHeader(
    'Content-Type',
    record.contentType ?? file.contentType ?? 'application/octet-stream',
  );
  const size = record.size ?? file.size;
  if (size != null) res.setHeader('Content-Length', String(size));
  res.setHeader('Content-Disposition', contentDisposition(record.filename));
  if (file.downloadStream) {
    file.downloadStream.pipe(res);
    return;
  }
  if (file.publicUrl) {
    res.redirect(file.publicUrl);
    return;
  }
  throw new InternalError('no download available');
}

export async function uploadDocumentGenerationTemplateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const uploaded = (req as Request & { file?: UploadedFile }).file;
  if (!uploaded) throw new ValidationError('no file');
  const result = await documentGenerationConfigurationService.uploadTemplate({
    formId: req.params.id,
    workspaceId: req.coreContext!.workspaceId,
    actorId: req.coreContext!.actorId,
    filename: uploaded.originalname,
    contentType: uploaded.mimetype,
    size: uploaded.size,
    buffer: uploaded.buffer,
  });
  if (result === 'infected') throw new UnprocessableEntityError('File failed virus scan');
  if (result === 'scan-unavailable') {
    throw new ServiceUnavailableError('Virus scanning unavailable');
  }
  res.status(201).json(serializeTemplate(result));
}

export async function updateDocumentGenerationConfigurationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const configuration = await documentGenerationConfigurationService.updateConfiguration({
    formId: req.params.id,
    actorId: req.coreContext!.actorId,
    printableName: req.body.printableName,
    defaultTemplateId: req.body.defaultTemplateId,
  });
  res.json(serializeConfiguration(configuration, req.params.id));
}

export async function deleteDocumentGenerationTemplateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const deleted = await documentGenerationConfigurationService.deleteTemplate(
    req.params.id,
    req.params.templateId,
  );
  if (!deleted) throw new NotFoundError('Document template not found');
  res.status(204).end();
}
