import type { NextFunction, Request, Response } from 'express';
import { getFileRecordById, getFormFileRecordById } from '../../core/db/repos/fileRepo';
import { getSubmissionRecordById } from '../../core/db/repos/submissionRepo';
import { hasFormSubmitAccess } from '../../core/db/repos/formSubmitAccessRepo';
import { Permissions, SubmissionWorkflowState } from '../../core/db/codes';
import { NotFoundError } from '../../core/errors';
import { resolveCaller } from '../../core/middleware/actor';
import { accessDenial } from '../../core/middleware/formSubmitAccess';

const FILE_NOT_FOUND = 'File not found';

export async function requireFormFile(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const context = req.coreContext!;
    const record = await getFormFileRecordById(
      req.params.fileId,
      req.params.id,
      context.workspaceId,
    );
    if (!record) throw new NotFoundError(FILE_NOT_FOUND);
    req.fileRecord = record;
    req.fileDownloadDisposition = 'attachment';
    next();
  } catch (error) {
    next(error);
  }
}

async function getSubmissionFile(req: Request) {
  const record = await getFileRecordById(req.params.id);
  if (!record?.submissionId) throw new NotFoundError(FILE_NOT_FOUND);
  const submission = await getSubmissionRecordById(record.workspaceId, record.submissionId);
  if (!submission) throw new NotFoundError(FILE_NOT_FOUND);
  return { record, submission };
}

export async function requireSubmissionFileReadAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { record } = await getSubmissionFile(req);
    const allowed = await hasFormSubmitAccess(
      record.workspaceId,
      resolveCaller(req),
      Permissions.submission_read,
    );
    if (!allowed) throw accessDenial(req, 'Not authorized to access this file');
    req.fileRecord = record;
    req.fileDownloadDisposition = 'inline';
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireSubmissionFileDeleteAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { record, submission } = await getSubmissionFile(req);
    const caller = resolveCaller(req);
    const allowed =
      submission.workflowState === SubmissionWorkflowState.submitted
        ? await hasFormSubmitAccess(record.workspaceId, caller, Permissions.submission_update)
        : !!caller.actorId &&
          submission.submittedBy === caller.actorId &&
          (await hasFormSubmitAccess(record.workspaceId, caller, Permissions.submission_create));
    if (!allowed) throw accessDenial(req, 'Not authorized to access this file');
    req.fileRecord = record;
    next();
  } catch (error) {
    next(error);
  }
}
