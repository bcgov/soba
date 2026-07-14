import { env } from '../../core/config/env';
import { getStorageAdapter } from '../../core/integrations/plugins/PluginRegistry';
import {
  associateFilesWithSubmission,
  createFileRecord,
  deleteFileRecordById,
  getFileRecordById,
  type FileRecord,
} from '../../core/db/repos/fileRepo';
import { getSubmissionRecordById } from '../../core/db/repos/submissionRepo';
import { hasFormSubmitAccess, type CallerIdentity } from '../../core/db/repos/formSubmitAccessRepo';
import { Permissions, SubmissionWorkflowState } from '../../core/db/codes';
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
    const result = await getStorageAdapter(profile).uploadFile({
      workspaceId: params.workspaceId,
      submissionId: params.submissionId ?? undefined,
      filename: params.filename,
      contentType: params.contentType,
      size: params.size,
      buffer: params.buffer,
    });
    return createFileRecord({
      workspaceId: params.workspaceId,
      profile,
      backendRef: result.engineFileRef,
      filename: params.filename,
      contentType: params.contentType ?? null,
      size: params.size ?? null,
      submissionId: params.submissionId ?? null,
      createdBy: params.actorId,
    });
  },

  /**
   * Fetch a file for a caller, scoped to its owning submission: the file must belong to a still-present
   * submission, and the caller must have submission_read on that submission's workspace (Form submitters
   * audience or staff). 'notfound' when missing / no live owning submission; 'denied' when unauthorized.
   */
  async getForCaller(
    id: string,
    caller: CallerIdentity,
  ): Promise<{ record: FileRecord; file: GetFileResult } | 'notfound' | 'denied'> {
    const record = await getFileRecordById(id);
    if (!record?.submissionId) return 'notfound';
    const submission = await getSubmissionRecordById(record.workspaceId, record.submissionId);
    if (!submission) return 'notfound';
    const allowed = await hasFormSubmitAccess(
      record.workspaceId,
      caller,
      Permissions.submission_read,
    );
    if (!allowed) return 'denied';
    const file = await getStorageAdapter(record.profile).getFile(record.backendRef);
    if (!file) return 'notfound';
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

  /**
   * Delete a file per its owning submission: while un-submitted, only the submission's owner
   * (submittedBy) may delete; once submitted, only staff with submission_update. 'notfound' when
   * missing; 'denied' when the caller isn't authorized.
   */
  async deleteForCaller(
    id: string,
    caller: CallerIdentity,
  ): Promise<'deleted' | 'notfound' | 'denied'> {
    const record = await getFileRecordById(id);
    if (!record?.submissionId) return 'notfound';
    const submission = await getSubmissionRecordById(record.workspaceId, record.submissionId);
    if (!submission) return 'notfound';
    const allowed =
      submission.workflowState === SubmissionWorkflowState.submitted
        ? await hasFormSubmitAccess(record.workspaceId, caller, Permissions.submission_update)
        : // Un-submitted: the submission owner may delete, but only where they're actually in the
          // submit audience — this bounds anonymous (shared public id) to forms they can submit to.
          !!caller.actorId &&
          submission.submittedBy === caller.actorId &&
          (await hasFormSubmitAccess(record.workspaceId, caller, Permissions.submission_create));
    if (!allowed) return 'denied';
    await getStorageAdapter(record.profile).deleteFile(record.backendRef);
    await deleteFileRecordById(id);
    return 'deleted';
  },
};
