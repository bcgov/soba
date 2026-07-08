import { Request, Response } from 'express';
import { filesService } from './service';
import { getFilesConfig, isBlockedExtension } from './config';

/** Minimal shape of a multer memory-storage file (this project has no @types/multer). */
interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export async function uploadFileHandler(req: Request, res: Response): Promise<void> {
  const ctx = req.coreContext;
  if (!ctx) {
    res.status(400).json({ error: 'workspace context required' });
    return;
  }

  const files = (req as Request & { files?: UploadedFile[] }).files;
  const uploaded = Array.isArray(files) ? files[0] : undefined;
  if (!uploaded) {
    res.status(400).json({ error: 'no file' });
    return;
  }

  const filename =
    (req.body?.fileName as string) || (req.body?.name as string) || uploaded.originalname;
  const submissionId = (req.body?.submissionId as string) || null;

  // Always reject blocked extensions, regardless of the form's designer-configured fileTypes.
  // Check both the stored name and the real uploaded name (they can differ via fileNameTemplate).
  if (isBlockedExtension(uploaded.originalname) || isBlockedExtension(filename)) {
    res.status(415).json({ error: 'File type not allowed' });
    return;
  }

  const profile = req.params.storageProfile || undefined;

  const record = await filesService.upload({
    workspaceId: ctx.workspaceId,
    actorId: ctx.actorId,
    filename,
    contentType: uploaded.mimetype,
    size: uploaded.size,
    buffer: uploaded.buffer,
    submissionId,
    useProfile: profile,
  });

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
  const actorId = req.actorId;
  if (!actorId) {
    res.status(401).end();
    return;
  }
  const result = await filesService.getForActor(req.params.id, actorId);
  if (!result) {
    res.status(404).end();
    return;
  }
  const { record, file } = result;
  res.setHeader(
    'Content-Type',
    record.contentType ?? file.contentType ?? 'application/octet-stream',
  );
  const size = record.size ?? file.size;
  if (size != null) res.setHeader('Content-Length', String(size));
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.filename)}"`);

  if (file.downloadStream) {
    file.downloadStream.pipe(res);
    return;
  }
  if (file.publicUrl) {
    res.redirect(file.publicUrl);
    return;
  }
  res.status(500).json({ error: 'no download available' });
}

/** Client-facing files config (upload size limit + always-blocked extensions). */
export function getFilesConfigHandler(_req: Request, res: Response): void {
  res.json(getFilesConfig());
}

export async function deleteFileHandler(req: Request, res: Response): Promise<void> {
  const actorId = req.actorId;
  if (!actorId) {
    res.status(401).end();
    return;
  }
  const outcome = await filesService.deleteForActor(req.params.id, actorId);
  res.status(outcome === 'notfound' ? 404 : 204).end();
}
