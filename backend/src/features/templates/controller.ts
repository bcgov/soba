import type { Request, Response } from 'express';
import { templatesService, type TemplateActor, type TemplateFile } from './service';
import { isTemplateFile, TEMPLATE_TYPES } from './config';
import { getUploadedFile } from '../../core/middleware/parseUpload';
import { sendStoredFile } from '../../core/api/shared/sendStoredFile';
import type { DocumentTemplateWithFile } from '../../core/db/repos/documentTemplateRepo';
import { NotFoundError, UnsupportedMediaTypeError } from '../../core/errors';

const TEMPLATE_NOT_FOUND = 'Template not found';

const toTemplateResponse = ({ template, file }: DocumentTemplateWithFile) => ({
  id: template.id,
  formId: template.formId,
  formVersionId: template.formVersionId,
  name: template.name,
  filename: file.filename,
  contentType: file.contentType,
  size: file.size,
  createdBy: template.createdBy,
  createdAt: template.createdAt.toISOString(),
  updatedBy: template.updatedBy,
  updatedAt: template.updatedAt.toISOString(),
});

// workspaceFromResource has resolved the form version or template into coreContext.
const actorOf = (req: Request): TemplateActor => {
  const ctx = req.coreContext!;
  return { workspaceId: ctx.workspaceId, actorId: ctx.actorId };
};

function templateFile(req: Request): TemplateFile {
  const upload = getUploadedFile(req);
  if (!isTemplateFile(upload.originalname)) {
    throw new UnsupportedMediaTypeError(`Template must be one of: ${TEMPLATE_TYPES}`);
  }
  return {
    filename: upload.originalname,
    contentType: upload.mimetype,
    size: upload.size,
    buffer: upload.buffer,
  };
}

const found = (template: DocumentTemplateWithFile | null): DocumentTemplateWithFile => {
  if (!template) throw new NotFoundError(TEMPLATE_NOT_FOUND);
  return template;
};

const findTemplate = async (req: Request): Promise<DocumentTemplateWithFile> =>
  found(await templatesService.get(req.params.id));

export async function listTemplatesHandler(req: Request, res: Response): Promise<void> {
  const templates = await templatesService.list(req.query.formVersionId as string);
  res.json({ items: templates.map(toTemplateResponse) });
}

export async function createTemplateHandler(req: Request, res: Response): Promise<void> {
  const { formId } = req.coreContext!;
  if (!formId) throw new NotFoundError('Form version not found');
  const created = await templatesService.create(
    actorOf(req),
    { id: req.query.formVersionId as string, formId },
    req.body.name as string,
    templateFile(req),
  );
  res.status(201).json(toTemplateResponse(found(created)));
}

export async function getTemplateHandler(req: Request, res: Response): Promise<void> {
  res.json(toTemplateResponse(await findTemplate(req)));
}

export async function downloadTemplateHandler(req: Request, res: Response): Promise<void> {
  const template = await findTemplate(req);
  const file = await templatesService.open(template);
  if (!file) throw new NotFoundError(TEMPLATE_NOT_FOUND);
  await sendStoredFile(res, template.file, file, 'attachment');
}

export async function replaceTemplateFileHandler(req: Request, res: Response): Promise<void> {
  const template = await findTemplate(req);
  const replaced = await templatesService.replaceFile(template, actorOf(req), templateFile(req));
  res.json(toTemplateResponse(found(replaced)));
}

export async function renameTemplateHandler(req: Request, res: Response): Promise<void> {
  const { actorId } = actorOf(req);
  const renamed = await templatesService.rename(req.params.id, req.body.name as string, actorId);
  res.json(toTemplateResponse(found(renamed)));
}

export async function deleteTemplateHandler(req: Request, res: Response): Promise<void> {
  await templatesService.remove(await findTemplate(req));
  res.status(204).end();
}
