import { Request, Response } from 'express';
import { filesService } from './service';
import { isBlockedExtension } from './config';
import { resolveCaller } from '../../core/middleware/actor';
import { accessDenial } from '../../core/middleware/formSubmitAccess';
import { getUploadedFile } from '../../core/middleware/parseUpload';
import { storedOrThrow } from '../../core/services/fileStore';
import { sendStoredFile } from '../../core/api/shared/sendStoredFile';
import { NotFoundError, UnsupportedMediaTypeError } from '../../core/errors';

export async function uploadFileHandler(req: Request, res: Response): Promise<void> {
  // requireUploadAccess has checked submissionId, then resolved + authorized its workspace into
  // coreContext.
  const ctx = req.coreContext!;

  const uploaded = getUploadedFile(req);
  const filename =
    (req.body?.fileName as string) || (req.body?.name as string) || uploaded.originalname;
  const submissionId = req.body.submissionId as string;

  // Always reject blocked extensions, regardless of the form's designer-configured fileTypes.
  // Check both the stored name and the real uploaded name (they can differ via fileNameTemplate).
  if (isBlockedExtension(uploaded.originalname) || isBlockedExtension(filename)) {
    throw new UnsupportedMediaTypeError('File type not allowed');
  }

  const record = storedOrThrow(
    await filesService.upload({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      filename,
      contentType: uploaded.mimetype,
      size: uploaded.size,
      buffer: uploaded.buffer,
      submissionId,
    }),
  );

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
  const result = await filesService.getForCaller(req.params.id, resolveCaller(req));
  if (result === 'notfound') {
    throw new NotFoundError('File not found');
  }
  if (result === 'denied') {
    throw accessDenial(req, 'Not authorized to access this file');
  }
  await sendStoredFile(res, result.record, result.file, 'inline');
}

export async function deleteFileHandler(req: Request, res: Response): Promise<void> {
  const outcome = await filesService.deleteForCaller(req.params.id, resolveCaller(req));
  if (outcome === 'deleted') {
    res.status(204).end();
    return;
  }
  if (outcome === 'notfound') {
    throw new NotFoundError('File not found');
  }
  throw accessDenial(req, 'Not authorized to access this file');
}
