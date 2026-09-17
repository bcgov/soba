import { env } from '../../core/config/env';
import { getStorageAdapter } from '../../core/integrations/plugins/PluginRegistry';
import {
  associateFilesWithSubmission,
  createFileRecord,
  deleteFileRecordById,
  type FileRecord,
} from '../../core/db/repos/fileRepo';
import type { GetFileResult } from '../../core/integrations/storage-engine/StorageEngineAdapter';
import { extractChefsFileIds } from './fileReferences';
import { scanUpload } from './scanUpload';

export interface UploadFileParams {
  workspaceId: string;
  actorId: string;
  filename: string;
  contentType?: string;
  size?: number;
  buffer: Buffer;
  formId?: string | null;
  submissionId?: string | null;
  useProfile?: string;
}

export const filesService = {
  /**
   * Store the bytes and record a file row. The returned record's id is the public reference.
   * Scans first when the antivirus feature is on: an infected or unscannable file is rejected
   * (discriminated result) before it reaches storage or the DB.
   */
  async upload(params: UploadFileParams): Promise<FileRecord | 'infected' | 'scan-unavailable'> {
    const scan = await scanUpload(params.buffer, params.filename);
    if (scan !== 'clean') return scan;

    const profile = params.useProfile ?? env.getFilesStorageProfile();
    const adapter = getStorageAdapter(profile);
    const result = await adapter.uploadFile({
      workspaceId: params.workspaceId,
      formId: params.formId ?? undefined,
      submissionId: params.submissionId ?? undefined,
      filename: params.filename,
      contentType: params.contentType,
      size: params.size,
      buffer: params.buffer,
    });
    try {
      return await createFileRecord({
        workspaceId: params.workspaceId,
        profile,
        backendRef: result.engineFileRef,
        filename: params.filename,
        contentType: params.contentType ?? null,
        size: params.size ?? null,
        formId: params.formId ?? null,
        submissionId: params.submissionId ?? null,
        createdBy: params.actorId,
      });
    } catch (err) {
      // The bytes are already stored; storage and DB can't share a transaction, so compensate by
      // dropping the blob (best-effort — deleteFile swallows its own errors) rather than orphan it.
      await adapter.deleteFile(result.engineFileRef);
      throw err;
    }
  },

  async get(record: FileRecord): Promise<GetFileResult | 'notfound'> {
    const file = await getStorageAdapter(record.profile).getFile(record.backendRef);
    if (!file) return 'notfound';
    return file;
  },

  async delete(record: FileRecord): Promise<void> {
    await deleteFileRecordById(record.id);
    await getStorageAdapter(record.profile).deleteFile(record.backendRef);
  },

  /**
   * Back-fill the `submission_id` of the files referenced in a submission's data. Called after a
   * submission save; scoped to the submission's workspace. Returns the number of files tagged.
   */
  async associateWithSubmission(
    submissionId: string,
    workspaceId: string,
    data: unknown,
  ): Promise<number> {
    const fileIds = extractChefsFileIds(data);
    return associateFilesWithSubmission(fileIds, submissionId, workspaceId);
  },
};
