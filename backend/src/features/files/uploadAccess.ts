import type { NextFunction, Request, Response } from 'express';
import { getSubmissionWorkspaceAndState } from '../../core/db/repos/submissionRepo';
import { assertSubmitterAllowed, setSubmitContext } from '../../core/middleware/formSubmitAccess';
import { SubmitterOperation } from '../../core/services/submitterAccess';
import { SubmissionWorkflowState } from '../../core/db/codes';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';

/**
 * Authorize a file upload against the submission it belongs to. The submission id is the source of
 * truth for the workspace; the caller must be allowed to write the submission, and only an in-progress
 * submission (opened/draft) accepts uploads. Access is checked before state so a caller who may not
 * write can't read the state from a 409. Runs after multer so the multipart `submissionId` field is
 * parsed.
 */
export const requireUploadAccess = async (
  req: Request,
  _res: Response,
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
    const target = {
      workspaceId: submission.workspaceId,
      formId: submission.formId,
      submissionId,
    };
    await assertSubmitterAllowed(req, SubmitterOperation.write, target);
    setSubmitContext(req, target);
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
