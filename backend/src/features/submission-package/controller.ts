import type { Request, Response } from 'express';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { sendStoredFile } from '../../core/api/shared/sendStoredFile';
import { submissionPackageService } from './service';

type PackageParams = { id: string; jobId: string };

// The submission comes from the path; who is asking and the submission's workspace and form from
// the resolved context.
export const downloadPackage = asyncHandler(async (req: Request<PackageParams>, res: Response) => {
  const context = req.coreContext!;
  const opened = await submissionPackageService.openDownload(
    {
      actorId: context.actorId,
      workspaceId: context.workspaceId!,
      formId: context.formId!,
      submissionId: req.params.id,
    },
    req.params.jobId,
  );
  await sendStoredFile(res, opened.file, opened.content, 'attachment');
});
