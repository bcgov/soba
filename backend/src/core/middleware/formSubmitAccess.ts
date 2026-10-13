import {
  canReadSubmission,
  canWriteSubmission,
  isIdentifiedCaller,
  ownDeleteStatusOf,
  startStatusOf,
  SubmissionChangeStatus,
  ApiErrorCodes,
  type ApiErrorCode,
} from '@soba/lib';
import type { CallerIdentity, FormAccessTarget } from '../db/repos/formSubmitAccessRepo';
import { findLiveSubmitterForm } from '../db/repos/submitterFormRepo';
import {
  findSubmitterSubmission,
  type SubmitterSubmission,
} from '../db/repos/submitterSubmissionRepo';
import { PUBLIC_PROVIDER_CODE, PUBLIC_SUBMITTER_LABEL } from '../db/codes';
import { SubmitterOperation, type SubmitterOperationCode } from '../services/submitterAccess';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../errors';
import { log } from '../logging';
import { resolveCaller } from './actor';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** A denial that distinguishes an authenticated caller (403) from an anonymous one (401). */
export const accessDenial = (req: Request, message: string, code?: ApiErrorCode): Error =>
  req.user ? new ForbiddenError(message, code) : new UnauthorizedError(message, code);

const CHANGE_DENIED = 'Not authorized to change this submission';

const DENIAL_MESSAGES: Record<SubmitterOperationCode, string> = {
  open: 'Not authorized to submit this form',
  read: 'Not authorized to access this submission',
  write: CHANGE_DENIED,
  upload: CHANGE_DENIED,
  deleteFile: CHANGE_DENIED,
  render: 'Not authorized to generate this document',
  delete: 'Not authorized to delete this submission',
};

/** Logs and throws the refusal: 401 for anonymous, 403 for an authenticated caller. */
export const refuseSubmitter = (
  req: Request,
  operation: SubmitterOperationCode,
  target: { formId?: string; submissionId?: string },
  code: ApiErrorCode,
): never => {
  log.warn(
    {
      operation,
      code,
      formId: target.formId,
      submissionId: target.submissionId,
      actorId: req.actorId,
    },
    'Submit-mode access refused',
  );
  throw accessDenial(req, DENIAL_MESSAGES[operation], code);
};

/**
 * Populate the public-submit req.coreContext for a submit-mode request. Anonymous callers are
 * attributed to the seeded public user, already resolved as req.actorId.
 */
export const setSubmitContext = (req: Request, target: FormAccessTarget): void => {
  // Guaranteed by resolveActorOrPublic upstream; guard so a missing id can't become an empty-string FK.
  if (!req.actorId) {
    throw new Error('setSubmitContext requires a resolved actor');
  }
  req.coreContext = {
    workspaceId: target.workspaceId,
    formId: target.formId,
    actorId: req.actorId,
    actorDisplayLabel:
      req.user?.profile?.displayLabel || req.user?.profile?.displayName || PUBLIC_SUBMITTER_LABEL,
    workspaceSource: 'public-submit',
    // Submit-mode handlers read no role; without one, no workspace role check passes.
    role: null,
  };
};

/** The actor resolveActorOrPublic resolved; every submit route has one. */
export const actorIdOf = (req: Request): string => {
  if (!req.actorId) throw new Error('Submit routes require a resolved actor');
  return req.actorId;
};

/** The user whose form permissions count: none for the public user, which belongs to no workspace. */
const permissionUserId = (actorId: string, caller: CallerIdentity): string | null =>
  caller.idpCode === PUBLIC_PROVIDER_CODE ? null : actorId;

/**
 * Reads the submission named by :id once, with the caller's grant and its form's facts, for the
 * guards and handlers after it. 404 when it, its form or its version is deleted.
 */
export const loadSubmitterSubmission = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const loaded = await findSubmitterSubmission({
      submissionId: req.params.id,
      actorId: actorIdOf(req),
      idpCode: resolveCaller(req).idpCode,
    });
    if (!loaded)
      throw new NotFoundError('Submission not found', ApiErrorCodes.submission_not_found);
    req.submitterSubmission = loaded;
    setSubmitContext(req, {
      workspaceId: loaded.submission.workspaceId,
      formId: loaded.submission.formId,
    });
    next();
  } catch (error) {
    next(error);
  }
};

/** The read loadSubmitterSubmission stored. */
export const loadedSubmission = (req: Request): SubmitterSubmission => {
  if (!req.submitterSubmission) {
    throw new Error('Submit-mode guards and handlers must run after loadSubmitterSubmission');
  }
  return req.submitterSubmission;
};

/** Runs a decision over the loaded read; a refusal is 401 or 403 by caller. */
const decide = (
  req: Request,
  next: NextFunction,
  operation: SubmitterOperationCode,
  code: ApiErrorCode,
  allows: (loaded: SubmitterSubmission, caller: CallerIdentity) => boolean,
): void => {
  try {
    const loaded = loadedSubmission(req);
    if (!allows(loaded, resolveCaller(req))) {
      refuseSubmitter(
        req,
        operation,
        { formId: loaded.submission.formId, submissionId: loaded.submission.id },
        code,
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};

/** Authorizes a read of an existing submission: confirmation, data, schema, fill bundle. */
export const requireSubmissionRead: RequestHandler = (req, _res, next) =>
  decide(req, next, SubmitterOperation.read, ApiErrorCodes.read_denied, ({ access }) =>
    canReadSubmission(access),
  );

/** Authorizes a save or submit. Its state does not refuse it; the write may be kept as pending. */
export const requireSubmissionWrite: RequestHandler = (req, _res, next) =>
  decide(
    req,
    next,
    SubmitterOperation.write,
    ApiErrorCodes.write_denied,
    ({ access, form }, caller) => canWriteSubmission(access, form, caller),
  );

/** Authorizes the owner's delete of their own submission: 409 once it is submitted. */
export const requireSubmissionDelete: RequestHandler = (req, _res, next) => {
  try {
    const { submission, access } = loadedSubmission(req);
    const change = ownDeleteStatusOf(access, resolveCaller(req));
    if (change.status === SubmissionChangeStatus.denied) {
      refuseSubmitter(
        req,
        SubmitterOperation.delete,
        { formId: submission.formId, submissionId: submission.id },
        change.code,
      );
    }
    if (change.status === SubmissionChangeStatus.closed) {
      throw new ConflictError(
        `Submission is ${submission.workflowState} and can no longer be deleted`,
        change.code,
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorizes POST /submissions from one read of the form named in the body. 404 when the form is
 * missing or deleted, or has no published version.
 */
export const requireSubmissionOpen = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { formId } = req.body as { formId: string };
    const actorId = actorIdOf(req);
    const caller = resolveCaller(req);
    const form = await findLiveSubmitterForm({
      userId: permissionUserId(actorId, caller),
      formId,
    });
    if (!form) throw new NotFoundError('Form not found', ApiErrorCodes.form_not_found);
    const change = startStatusOf(form, caller);
    if (change.status === SubmissionChangeStatus.denied) {
      refuseSubmitter(req, SubmitterOperation.open, { formId }, change.code);
    }
    if (change.status === SubmissionChangeStatus.closed) {
      throw new NotFoundError('Form has no published version', change.code);
    }
    setSubmitContext(req, { workspaceId: form.workspaceId, formId });
    next();
  } catch (error) {
    next(error);
  }
};

/** Authorizes a list of the caller's own forms or submissions: signed-in only, otherwise 401. */
export const requireSignedInSubmitter = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (isIdentifiedCaller(resolveCaller(req))) {
    next();
    return;
  }
  next(
    accessDenial(
      req,
      'Sign in to list your own forms and submissions',
      ApiErrorCodes.sign_in_required,
    ),
  );
};
