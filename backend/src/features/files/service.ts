import { getStorageAdapter } from '../../core/integrations/plugins/PluginRegistry';
import { actorBelongsToWorkspace } from '../../core/db/repos/membershipRepo';
import {
  associateFilesWithSubmission,
  createFileRecord,
  deleteFileRecordById,
  getFileRecordById,
  type FileRecord,
} from '../../core/db/repos/fileRepo';
import type { GetFileResult } from '../../core/integrations/storage-engine/StorageEngineAdapter';
import { extractChefsFileIds } from './fileReferences';

/** Storage profile this feature reads/writes. Other file features would select their own profile. */
const FILE_STORAGE_PROFILE = 'default';

// TODO(permissions): workspace membership is a coarse stand-in. Replace with real permission
// checks (per-file / role / submission ownership) once the permissions system exists.
export interface UploadFileParams {
  workspaceId: string;
  actorId: string;
  filename: string;
  contentType?: string;
  size?: number;
  buffer: Buffer;
  submissionId?: string | null;
}

export const filesService = {
  /** Store the bytes and record a file row. The returned record's id is the public reference. */
  async upload(params: UploadFileParams): Promise<FileRecord> {
    const adapter = getStorageAdapter(FILE_STORAGE_PROFILE);
    const result = await adapter.uploadFile({
      workspaceId: params.workspaceId,
      submissionId: params.submissionId ?? undefined,
      filename: params.filename,
      contentType: params.contentType,
      size: params.size,
      buffer: params.buffer,
    });
    return createFileRecord({
      workspaceId: params.workspaceId,
      profile: FILE_STORAGE_PROFILE,
      backendRef: result.engineFileRef,
      filename: params.filename,
      contentType: params.contentType ?? null,
      size: params.size ?? null,
      submissionId: params.submissionId ?? null,
      createdBy: params.actorId,
    });
  },

  /**
   * Fetch a file the actor may read. Returns null if it's missing or the actor isn't in its
   * workspace — callers 404 both, so existence isn't leaked.
   */
  async getForActor(
    id: string,
    actorId: string,
  ): Promise<{ record: FileRecord; file: GetFileResult } | null> {
    const record = await getFileRecordById(id);
    if (!record) return null;
    if (!(await actorBelongsToWorkspace(record.workspaceId, actorId))) return null;
    const file = await getStorageAdapter(record.profile).getFile(record.backendRef);
    if (!file) return null;
    return { record, file };
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

  /** Delete a file the actor is authorized for. 'notfound' when missing or not authorized. */
  async deleteForActor(id: string, actorId: string): Promise<'deleted' | 'notfound'> {
    const record = await getFileRecordById(id);
    if (!record) return 'notfound';
    if (!(await actorBelongsToWorkspace(record.workspaceId, actorId))) return 'notfound';
    await getStorageAdapter(record.profile).deleteFile(record.backendRef);
    await deleteFileRecordById(id);
    return 'deleted';
  },
};
