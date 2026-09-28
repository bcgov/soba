import { hasFormSubmitAccess, type FormAccessTarget } from '../db/repos/formSubmitAccessRepo';
import { getSubmissionWorkspaceAndState } from '../db/repos/submissionRepo';
import { getWorkspaceIdForForm } from '../db/repos/formRepo';
import { PUBLIC_SUBMITTER_LABEL, WorkspaceMembershipRole, type PermissionCode } from '../db/codes';
import {
  isSubmitterAllowed,
  SubmitterOperation,
  type SubmitterAccessTarget,
  type SubmitterOperationCode,
} from '../services/submitterAccess';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../errors';
import { log } from '../logging';
import { resolveCaller } from './actor';
import type { Request, Response, NextFunction } from 'express';

/** A denial that distinguishes an authenticated caller (403) from an anonymous one (401). */
export const accessDenial = (req: Request, message: string): Error =>
  req.user ? new ForbiddenError(message) : new UnauthorizedError(message);

const DENIAL_MESSAGES: Record<SubmitterOperationCode, string> = {
  open: 'Not authorized to submit this form',
  read: 'Not authorized to access this submission',
  write: 'Not authorized to change this submission',
  deleteSubmittedFile: 'Not authorized to change this submission',
};

/**
 * Throws unless the caller may perform the submit-mode operation: 401 for anonymous, 403 for an
 * authenticated caller.
 */
export const assertSubmitterAllowed = async (
  req: Request,
  operation: SubmitterOperationCode,
  target: SubmitterAccessTarget,
): Promise<void> => {
  if (await isSubmitterAllowed(operation, target, resolveCaller(req))) return;
  log.warn(
    {
      operation,
      formId: target.formId,
      submissionId: target.submissionId,
      actorId: req.actorId,
    },
    'Submit-mode access refused',
  );
  throw accessDenial(req, DENIAL_MESSAGES[operation]);
};

/**
 * Populate the public-submit req.coreContext for an authorized open, save, submit or upload.
 * Anonymous callers are attributed to the seeded public user, already resolved as req.actorId.
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
    // Public submitters have no membership; a non-manage role keeps them off workspace-admin routes.
    role: WorkspaceMembershipRole.member,
  };
};

/**
 * Resolve the target a submission request authorizes against. POST /submissions (open) names its form
 * in the body; the published version is resolved server-side by the service. POST
 * /submissions/:id/{save,submit} carry the submission id. Throws 404 when the named form or submission
 * doesn't exist, so the downstream controller never runs without a context.
 */
const resolveSubmitTarget = async (req: Request): Promise<SubmitterAccessTarget> => {
  // The :id branch goes first so a body formId can never turn a write into an open.
  if (req.params.id) {
    const submission = await getSubmissionWorkspaceAndState(req.params.id);
    if (!submission) throw new NotFoundError('Submission not found');
    return {
      workspaceId: submission.workspaceId,
      formId: submission.formId,
      submissionId: req.params.id,
    };
  }

  const bodyFormId = (req.body as { formId?: unknown } | undefined)?.formId;
  if (typeof bodyFormId === 'string' && bodyFormId) {
    const workspaceId = await getWorkspaceIdForForm(bodyFormId);
    if (!workspaceId) throw new NotFoundError('Form not found');
    return { workspaceId, formId: bodyFormId };
  }

  throw new ValidationError('Missing submission target');
};

/**
 * Authorizes a read of a form resource whose workspace and form were already resolved into
 * req.coreContext (see openWorkspaceFromResource). Grants staff with `required`, or the form's Form
 * submitters audience when `required` is in AUDIENCE_PERMISSIONS. On denial, 401 for anonymous / 403
 * for an authenticated non-member.
 */
export const requireFormAccess = (required: PermissionCode) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = req.coreContext;
      if (!context?.formId) {
        throw new Error('requireFormAccess must run after form resource resolution');
      }
      const allowed = await hasFormSubmitAccess(
        { workspaceId: context.workspaceId, formId: context.formId },
        resolveCaller(req),
        required,
      );
      if (!allowed) {
        throw accessDenial(req, 'Not authorized to access this form');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Authorizes POST /submissions (open) and POST /submissions/:id/{save,submit} (write), then populates
 * req.coreContext for the downstream controller.
 */
export const requireFormSubmitAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const target = await resolveSubmitTarget(req);
    const operation = target.submissionId ? SubmitterOperation.write : SubmitterOperation.open;
    await assertSubmitterAllowed(req, operation, target);
    setSubmitContext(req, target);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorizes a submit-mode read of an existing submission. Runs after openWorkspaceFromResource, which
 * 404s a missing submission and resolves its form.
 */
export const requireSubmissionRead = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const context = req.coreContext;
    if (!context?.formId || !req.params.id) {
      throw new Error('requireSubmissionRead must run after submission resource resolution');
    }
    await assertSubmitterAllowed(req, SubmitterOperation.read, {
      workspaceId: context.workspaceId,
      formId: context.formId,
      submissionId: req.params.id,
    });
    next();
  } catch (error) {
    next(error);
  }
};
