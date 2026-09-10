import { Request, Response } from 'express';
import { filesService } from './service';
import { isBlockedExtension } from './config';
import {
  InternalError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableEntityError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../core/errors';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const FILE_NOT_FOUND = 'File not found';
const NOT_FOUND_OUTCOME = 'notfound';

const serializeMetadata = (record: NonNullable<Request['fileRecord']>) => {
  return {
    id: record.id,
    formId: record.formId,
    storageProfile: record.profile,
    filename: record.filename,
    contentType: record.contentType,
    size: record.size,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt.toISOString(),
  };
};

function getUploadedFile(req: Request): UploadedFile {
  const request = req as Request & { file?: UploadedFile; files?: UploadedFile[] };
  const uploaded = request.file ?? (Array.isArray(request.files) ? request.files[0] : undefined);
  if (!uploaded) throw new ValidationError('no file');
  return uploaded;
}

function sendFile(
  res: Response,
  record: NonNullable<Request['fileRecord']>,
  file: Exclude<Awaited<ReturnType<typeof filesService.get>>, 'notfound'>,
  disposition: 'inline' | 'attachment',
): void {
  res.setHeader(
    'Content-Type',
    record.contentType ?? file.contentType ?? 'application/octet-stream',
  );
  const size = record.size ?? file.size;
  if (size != null) res.setHeader('Content-Length', String(size));
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(record.filename)}"`,
  );
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

export async function uploadFileHandler(req: Request, res: Response): Promise<void> {
  const ctx = req.coreContext!;
  const uploaded = getUploadedFile(req);
  const formId = req.params.id || null;
  const filename = formId
    ? uploaded.originalname
    : (req.body?.fileName as string) || (req.body?.name as string) || uploaded.originalname;
  const submissionId = formId ? null : (req.body?.submissionId as string) || null;

  // Always reject blocked extensions, regardless of the form's designer-configured fileTypes.
  // Check both the stored name and the real uploaded name (they can differ via fileNameTemplate).
  if (isBlockedExtension(uploaded.originalname) || isBlockedExtension(filename)) {
    throw new UnsupportedMediaTypeError('File type not allowed');
  }

  const profile =
    (typeof req.body?.storageProfile === 'string' && req.body.storageProfile) ||
    req.header('storageProfile') ||
    undefined;

  const record = await filesService.upload({
    workspaceId: ctx.workspaceId,
    actorId: ctx.actorId,
    filename,
    contentType: uploaded.mimetype,
    size: uploaded.size,
    buffer: uploaded.buffer,
    formId,
    submissionId,
    useProfile: profile,
  });

  if (record === 'infected') throw new UnprocessableEntityError('File failed virus scan');
  if (record === 'scan-unavailable') {
    throw new ServiceUnavailableError('Virus scanning unavailable');
  }

  if (formId) {
    res.status(201).json(serializeMetadata(record));
    return;
  }

  // The chefs provider builds each file's URL as `${filesUrl}/${id}`, so it only needs the id
  // (name/size/type are used for the Form.io file value).
  res.json({
    id: record.id,
    name: record.filename,
    originalName: record.filename,
    size: record.size,
    type: record.contentType,
  });
}

export async function downloadFileHandler(req: Request, res: Response): Promise<void> {
  const record = req.fileRecord!;
  const file = await filesService.get(record);
  if (file === NOT_FOUND_OUTCOME) throw new NotFoundError(FILE_NOT_FOUND);
  sendFile(res, record, file, req.fileDownloadDisposition ?? 'inline');
}

export async function getFileMetadataHandler(req: Request, res: Response): Promise<void> {
  res.json(serializeMetadata(req.fileRecord!));
}

export async function deleteFileHandler(req: Request, res: Response): Promise<void> {
  await filesService.delete(req.fileRecord!);
  res.status(204).end();
}
