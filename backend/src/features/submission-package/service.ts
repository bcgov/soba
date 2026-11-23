import { ApiErrorCodes } from '@soba/lib';
import { quietDb } from '../../core/db/client';
import { SubmissionPackageAuditAction } from '../../core/db/codes';
import { insertPackageAudit, isPackageJobOf } from '../../core/db/repos/submissionPackageRepo';
import { NotFoundError, ServiceUnavailableError } from '../../core/errors';
import { openJobResult } from '../../core/jobs/outputs';
import { getCorrelationId, log } from '../../core/logging';

/** Who is asking, and the submission the package was built from. */
export interface PackageContext {
  actorId: string;
  workspaceId: string;
  formId: string;
  submissionId: string;
}

export const submissionPackageService = {
  /** The package's file, after recording the download; anything else is not found. */
  async openDownload(ctx: PackageContext, jobId: string) {
    const ours = await isPackageJobOf(ctx.workspaceId, ctx.submissionId, jobId);
    const opened = ours ? await openJobResult(jobId) : null;
    if (opened?.state !== 'ready') {
      throw new NotFoundError('Package not available', ApiErrorCodes.file_not_found);
    }
    try {
      await insertPackageAudit(quietDb, {
        workspaceId: ctx.workspaceId,
        formId: ctx.formId,
        submissionId: ctx.submissionId,
        jobId,
        fileId: opened.file.id,
        action: SubmissionPackageAuditAction.downloaded,
        size: opened.file.size,
        actorId: ctx.actorId,
        requestId: getCorrelationId() ?? null,
      });
    } catch (err) {
      opened.content.downloadStream?.destroy();
      log.error({ err, jobId }, 'Package download not recorded; refused');
      throw new ServiceUnavailableError('The download could not be recorded; try again');
    }
    log.info({ jobId, submissionId: ctx.submissionId, actorId: ctx.actorId }, 'Package downloaded');
    return opened;
  },
};
