import type { NextFunction, Request, Response } from 'express';
import { getSubmissionWorkspaceAndState } from '../../core/db/repos/submissionRepo';
import { authorizeSubmitterForWorkspace } from '../../core/middleware/formSubmitAccess';
import { Permissions, SubmissionWorkflowState } from '../../core/db/codes';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';

/**
 * Authorize a file upload against the submission it belongs to. The submission id is the source of
 * truth for the workspace; only an in-progress submission (opened/draft) accepts uploads, and the
 * caller must be in that workspace's Form submitters audience (submission_create). Runs after multer
 * so the multipart `submissionId` field is parsed.
 */
export const requireUploadAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const submissionId = (req.body as { submissionId?: unknown } | undefined)?.submissionId;
    if (typeof submissionId !== 'string' || !submissionId) {
      throw new ValidationError('submissionId is required to upload a file');
    }
    const submission = await getSubmissionWorkspaceAndState(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }
    if (
      submission.workflowState !== SubmissionWorkflowState.opened &&
      submission.workflowState !== SubmissionWorkflowState.draft
    ) {
      throw new ConflictError('Submission is not accepting file uploads');
    }
    await authorizeSubmitterForWorkspace(
      req,
      res,
      submission.workspaceId,
      Permissions.submission_create,
    );
    next();
  } catch (error) {
    next(error);
  }
};
