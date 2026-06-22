/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { getStorageAdapterFor } from '../../integrations/plugins/PluginRegistry';
import { submissionsApiService } from '../submissions/service';
import { formsApiService } from '../forms/service';
import { actorBelongsToWorkspace } from '../../db/repos/membershipRepo';

export async function uploadFileHandler(req: Request, res: Response) {
  const pluginCode = req.params.plugin;
  let adapter: any;
  try {
    adapter = getStorageAdapterFor(pluginCode);
  } catch {
    return res.status(404).json({ error: 'plugin not found' });
  }

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
    console.log(
      `File Name: ${file.originalname}, Buffer Present: ${!!file.buffer}, Buffer Size: ${file.buffer?.length ?? 0} bytes`,
    );
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
    let createdSubmission: any = null;
    let targetSubmissionId = submissionId;

    if (!targetSubmissionId) {
      let formId = (req as any).body.formId;
      if (!formId) {
        const formVersion = await formsApiService.getFormVersion(
          { workspaceId: String(workspaceId), actorId: actorId ?? '', actorDisplayLabel: null },
          formVersionId,
        );
        if (!formVersion) {
          return res.status(404).json({ error: 'formVersion not found' });
        }
        formId = formVersion.formId;
      }

      // create draft submission
      const created = await submissionsApiService.create(
        { workspaceId: String(workspaceId), actorId: actorId ?? '', actorDisplayLabel: null },
        formId,
        formVersionId,
      );
      createdSubmission = created;
      targetSubmissionId = createdSubmission.id;
    }

    // Save: call save to push to engine and append revision. Store files in data.files array.
    const savePayload = {
      data: { files: uploaded, _plugin: pluginCode },
      eventType: 'file_upload',
    };
    const saved = await submissionsApiService.save(
      { workspaceId: String(workspaceId), actorId: actorId ?? '', actorDisplayLabel: null },
      targetSubmissionId as string,
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
      storage: pluginCode,
      url: `/api/v1/files/${pluginCode}/${firstFile.engineFileRef}`,
      submissionId: saved?.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}

export async function downloadFileHandler(req: Request, res: Response) {
  const pluginCode = req.params.plugin;
  let adapter: any;
  try {
    adapter = getStorageAdapterFor(pluginCode);
  } catch {
    return res.status(404).json({ error: 'plugin not found' });
  }
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
  const pluginCode = req.params.plugin;
  let adapter: any;
  try {
    adapter = getStorageAdapterFor(pluginCode);
  } catch {
    return res.status(404).json({ error: 'plugin not found' });
  }
  const id = req.params.id;
  await adapter.deleteFile(id);
  return res.status(204).end();
}

export async function listFilesHandler(req: Request, res: Response) {
  const pluginCode = req.params.plugin;
  let adapter: any;
  try {
    adapter = getStorageAdapterFor(pluginCode);
  } catch {
    return res.status(404).json({ error: 'plugin not found' });
  }
  const workspaceId = String((req as any).workspace?.id ?? 'default');
  const list = (await adapter.listFiles?.(workspaceId)) ?? { items: [] };
  return res.json(list);
}

export async function presignHandler(req: Request, res: Response) {
  const pluginCode = req.params.plugin;
  let adapter: any;
  try {
    adapter = getStorageAdapterFor(pluginCode);
  } catch {
    return res.status(404).json({ error: 'plugin not found' });
  }
  const body = req.body;
  if (typeof adapter.generatePresignedUrl !== 'function') {
    return res.status(501).json({ error: 'presign not supported' });
  }
  const result = await adapter.generatePresignedUrl(body);
  return res.json(result);
}
