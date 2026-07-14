import { Request, Response } from 'express';
import { filesService } from './service';
import { isBlockedExtension } from './config';
import { getActorIdpCode } from '../../core/middleware/actor';
import type { CallerIdentity } from '../../core/db/repos/formSubmitAccessRepo';

/** The caller identity for audience checks (`public` for anonymous). */
const callerFrom = (req: Request): CallerIdentity => ({
  actorId: req.actorId ?? null,
  idpCode: getActorIdpCode(req) ?? req.idpType?.toLowerCase() ?? null,
});

/** 401 for anonymous, 403 for an authenticated caller — the standard denial split. */
const deniedStatus = (req: Request): number => (req.user ? 403 : 401);

/** Minimal shape of a multer memory-storage file (this project has no @types/multer). */
interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export async function uploadFileHandler(req: Request, res: Response): Promise<void> {
  // requireUploadAccess has resolved + authorized the submission's workspace into coreContext.
  const ctx = req.coreContext!;

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

  const profile = req.header('storageProfile') || undefined;

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

  // Virus scan rejections (antivirus feature on): infected is a client-side content problem;
  // scan-unavailable is fail-closed — the scanner couldn't clear the file, so we don't store it.
  if (record === 'infected') {
    res.status(422).json({ error: 'File failed virus scan' });
    return;
  }
  if (record === 'scan-unavailable') {
    res.status(503).json({ error: 'Virus scanning unavailable' });
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
  const result = await filesService.getForCaller(req.params.id, callerFrom(req));
  if (result === 'notfound') {
    res.status(404).end();
    return;
  }
  if (result === 'denied') {
    res.status(deniedStatus(req)).end();
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

export async function deleteFileHandler(req: Request, res: Response): Promise<void> {
  const outcome = await filesService.deleteForCaller(req.params.id, callerFrom(req));
  if (outcome === 'deleted') {
    res.status(204).end();
    return;
  }
  if (outcome === 'notfound') {
    res.status(404).end();
    return;
  }
  res.status(deniedStatus(req)).end();
}
