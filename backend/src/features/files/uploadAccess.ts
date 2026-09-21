import type { NextFunction, Request, Response } from 'express';
import { getSubmissionWorkspaceAndState } from '../../core/db/repos/submissionRepo';
import {
  assertSubmissionOwner,
  authorizeSubmitterForForm,
} from '../../core/middleware/formSubmitAccess';
import { Permissions, SubmissionWorkflowState } from '../../core/db/codes';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';

/**
 * Authorize a file upload against the submission it belongs to. The submission id is the source of
 * truth for the workspace; the caller must be in the form's Form submitters audience
 * (submission_create) and own the submission, and only an in-progress submission (opened/draft)
 * accepts uploads. Access is checked before state so a non-owner can't read the state from a 409.
 * Runs after multer so the multipart `submissionId` field is parsed.
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
    await authorizeSubmitterForForm(
      req,
      res,
      { workspaceId: submission.workspaceId, formId: submission.formId },
      Permissions.submission_create,
    );
    assertSubmissionOwner(req, { id: submissionId, ...submission });
    if (
      submission.workflowState !== SubmissionWorkflowState.opened &&
      submission.workflowState !== SubmissionWorkflowState.draft
    ) {
      throw new ConflictError('Submission is not accepting file uploads');
    }
    next();
  } catch (error) {
    next(error);
  }
};
