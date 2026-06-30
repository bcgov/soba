/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { getStorageAdapter } from '../../core/integrations/plugins/PluginRegistry';
import { submissionsApiService } from '../../core/api/submissions/service';
import { formsApiService } from '../../core/api/forms/service';
import { actorBelongsToWorkspace } from '../../core/db/repos/membershipRepo';
import type { StorageEngineAdapter } from '../../core/integrations/storage-engine/StorageEngineAdapter';

/** Storage profile this feature reads/writes. Other file features select their own profile. */
const FILE_STORAGE_PROFILE = 'default';

/** Resolve this feature's storage adapter, or send a 500 and return null. */
function resolveAdapter(res: Response): StorageEngineAdapter | null {
  try {
    return getStorageAdapter(FILE_STORAGE_PROFILE);
  } catch {
    res.status(500).json({ error: 'storage not configured' });
    return null;
  }
}

/**
 * Resolve the submission id to attach uploads to, creating a draft submission when none is given.
 * Sends a 404 and returns null when the referenced form version cannot be found.
 */
async function resolveTargetSubmissionId(
  ctx: { workspaceId: string; actorId: string },
  params: { formVersionId: string; formId?: string; submissionId?: string },
  res: Response,
): Promise<string | null> {
  if (params.submissionId) return params.submissionId;

  const serviceCtx = { ...ctx, actorDisplayLabel: null };
  let formId = params.formId;
  if (!formId) {
    const formVersion = await formsApiService.getFormVersion(serviceCtx, params.formVersionId);
    if (!formVersion) {
      res.status(404).json({ error: 'formVersion not found' });
      return null;
    }
    formId = formVersion.formId;
  }

  const created = await submissionsApiService.create(serviceCtx, formId, params.formVersionId);
  return created.id;
}

export async function uploadFileHandler(req: Request, res: Response) {
  const adapter = resolveAdapter(res);
  if (!adapter) return;

  const files = (req as any).files as any[] | undefined;
  if (!files || files.length === 0) return res.status(400).json({ error: 'no files' });

  // Expect multipart fields: formVersionId (required), submissionId (optional)
  const formVersionId = (req as any).body?.formVersionId as string | undefined;
  const submissionId = (req as any).body?.submissionId as string | undefined;
  if (!formVersionId) return res.status(400).json({ error: 'formVersionId required' });

  const workspaceId =
    (req as any).coreContext?.workspaceId ?? (req as any).workspace?.id ?? 'default';
  const actorId = (req as any).coreContext?.actorId ?? req.actorId;

  // Permission check: ensure actor belongs to workspace (or public system actor handled upstream)
  if (actorId && !(await actorBelongsToWorkspace(workspaceId, actorId))) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const uploaded: Array<Record<string, unknown>> = [];

  for (const file of files) {
    try {
      const result = await adapter.uploadFile({
        workspaceId: String(workspaceId),
        submissionId: submissionId,
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      });

      uploaded.push({
        engineFileRef: result.engineFileRef,
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        publicUrl: result.publicUrl,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: `Upload to storage failed: ${err?.message ?? String(err)}` });
    }
  }

  // Attach to submission: create submission if needed, then save a revision with files data
  try {
    const targetSubmissionId = await resolveTargetSubmissionId(
      { workspaceId: String(workspaceId), actorId: actorId ?? '' },
      { formVersionId, formId: (req as any).body.formId, submissionId },
      res,
    );
    if (!targetSubmissionId) return;

    // Save: call save to push to engine and append revision. Store files in data.files array.
    const savePayload = {
      data: { files: uploaded, _plugin: FILE_STORAGE_PROFILE },
      eventType: 'file_upload',
    };
    const saved = await submissionsApiService.save(
      { workspaceId: String(workspaceId), actorId: actorId ?? '', actorDisplayLabel: null },
      targetSubmissionId,
      savePayload,
    );

    // Return standard Formio file info for the first file (BCGovFile uploads one at a time)
    const firstFile = uploaded[0];
    if (!firstFile) {
      return res.status(500).json({ error: 'No file was successfully uploaded' });
    }

    // Return precisely what Formio expects so `data.id` resolves to the engineFileRef
    return res.json({
      id: firstFile.engineFileRef,
      name: firstFile.filename,
      originalName: firstFile.filename,
      size: firstFile.size,
      storage: FILE_STORAGE_PROFILE,
      url: `/api/v1/files/${FILE_STORAGE_PROFILE}/${firstFile.engineFileRef}`,
      submissionId: saved?.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}

export async function downloadFileHandler(req: Request, res: Response) {
  const adapter = resolveAdapter(res);
  if (!adapter) return;
  const id = req.params.id;
  const file = await adapter.getFile(id);
  if (!file) return res.status(404).end();
  if (file.downloadStream) {
    res.setHeader('Content-Type', file.contentType ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size ?? ''));
    return file.downloadStream.pipe(res);
  }
  if (file.publicUrl) {
    return res.redirect(file.publicUrl);
  }
  return res.status(500).json({ error: 'no download available' });
}

export async function deleteFileHandler(req: Request, res: Response) {
  const adapter = resolveAdapter(res);
  if (!adapter) return;
  const id = req.params.id;
  await adapter.deleteFile(id);
  return res.status(204).end();
}

export async function listFilesHandler(req: Request, res: Response) {
  const adapter = resolveAdapter(res);
  if (!adapter) return;
  const workspaceId = String((req as any).workspace?.id ?? 'default');
  const list = (await adapter.listFiles?.(workspaceId)) ?? { items: [] };
  return res.json(list);
}

export async function presignHandler(req: Request, res: Response) {
  const adapter = resolveAdapter(res);
  if (!adapter) return;
  const body = req.body;
  if (typeof adapter.generatePresignedUrl !== 'function') {
    return res.status(501).json({ error: 'presign not supported' });
  }
  const result = await adapter.generatePresignedUrl(body);
  return res.json(result);
}
