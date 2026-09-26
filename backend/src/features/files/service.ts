import { env } from '../../core/config/env';
import type { FileRecord } from '../../core/db/repos/fileRepo';
import {
  getSubmissionFileByFileId,
  linkFileToSubmission,
  unlinkSubmissionFile,
} from '../../core/db/repos/submissionFileRepo';
import { getSubmissionRecordById } from '../../core/db/repos/submissionRepo';
import type { CallerIdentity } from '../../core/db/repos/formSubmitAccessRepo';
import { isSubmitterAllowed, SubmitterOperation } from '../../core/services/submitterAccess';
import { fileStore, type StoreFileOutcome } from '../../core/services/fileStore';
import { SubmissionWorkflowState } from '../../core/db/codes';
import type { GetFileResult } from '../../core/integrations/storage-engine/StorageEngineAdapter';

export interface UploadFileParams {
  workspaceId: string;
  actorId: string;
  submissionId: string;
  filename: string;
  contentType?: string;
  size?: number;
  buffer: Buffer;
}

/** The attachment and its still-present submission; null when either is missing. */
async function findAttachment(id: string) {
  const attachment = await getSubmissionFileByFileId(id);
  if (!attachment) return null;
  const submission = await getSubmissionRecordById(
    attachment.file.workspaceId,
    attachment.submissionId,
  );
  return submission ? { record: attachment.file, submission } : null;
}

export const filesService = {
  /** Store a file attached to a submission. The returned record's id is the public reference. */
  upload(params: UploadFileParams): Promise<StoreFileOutcome> {
    return fileStore.put(
      {
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        profile: env.getFilesStorageProfile(),
        prefix: env.getFilesStoragePrefix(),
        filename: params.filename,
        contentType: params.contentType,
        size: params.size,
        buffer: params.buffer,
      },
      (tx, record) =>
        linkFileToSubmission(tx, {
          fileId: record.id,
          submissionId: params.submissionId,
          workspaceId: params.workspaceId,
          createdBy: params.actorId,
        }),
    );
  },

  /**
   * Fetch a file for a caller, scoped to its owning submission: the file must belong to a still-present
   * submission, and the caller must be allowed to read it. 'notfound' when missing / no live owning
   * submission; 'denied' when unauthorized.
   */
  async getForCaller(
    id: string,
    caller: CallerIdentity,
  ): Promise<{ record: FileRecord; file: GetFileResult } | 'notfound' | 'denied'> {
    const attachment = await findAttachment(id);
    if (!attachment) return 'notfound';
    const { record, submission } = attachment;
    const target = {
      workspaceId: record.workspaceId,
      formId: submission.formId,
      submissionId: submission.id,
    };
    if (!(await isSubmitterAllowed(SubmitterOperation.read, target, caller))) return 'denied';
    const file = await fileStore.open(record);
    if (!file) return 'notfound';
    return { record, file };
  },

  /**
   * Delete a file per its owning submission: while un-submitted, a caller allowed to write it; once
   * submitted, only a caller with submission_update on the form. 'notfound' when missing; 'denied' when
   * the caller isn't authorized.
   */
  async deleteForCaller(
    id: string,
    caller: CallerIdentity,
  ): Promise<'deleted' | 'notfound' | 'denied'> {
    const attachment = await findAttachment(id);
    if (!attachment) return 'notfound';
    const { record, submission } = attachment;
    const operation =
      submission.workflowState === SubmissionWorkflowState.submitted
        ? SubmitterOperation.deleteSubmittedFile
        : SubmitterOperation.write;
    const allowed = await isSubmitterAllowed(
      operation,
      { workspaceId: record.workspaceId, formId: submission.formId, submissionId: submission.id },
      caller,
    );
    if (!allowed) return 'denied';
    await fileStore.remove(record, (tx) => unlinkSubmissionFile(tx, record.id));
    return 'deleted';
  },
};
