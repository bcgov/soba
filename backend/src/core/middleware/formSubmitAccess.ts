import { hasFormSubmitAccess, type FormAccessTarget } from '../db/repos/formSubmitAccessRepo';
import { getSubmissionListContext } from '../db/repos/submissionRepo';
import { getWorkspaceIdForForm } from '../db/repos/formRepo';
import {
  Permissions,
  PUBLIC_SUBMITTER_LABEL,
  WorkspaceMembershipRole,
  type PermissionCode,
} from '../db/codes';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../errors';
import { resolveCaller } from './actor';
import type { Request, Response, NextFunction } from 'express';

/** A denial that distinguishes an authenticated caller (403) from an anonymous one (401). */
export const accessDenial = (req: Request, message: string): Error =>
  req.user ? new ForbiddenError(message) : new UnauthorizedError(message);

/**
 * Resolve the form a submission request authorizes against. POST /submissions (open) names its form in
 * the body; the published version is resolved server-side by the service. POST
 * /submissions/:id/{save,submit} carry the submission id. Throws 404 when the named form or submission
 * doesn't exist, so the downstream controller never runs without a context.
 */
const resolveSubmitTarget = async (req: Request): Promise<FormAccessTarget> => {
  const bodyFormId = (req.body as { formId?: unknown } | undefined)?.formId;
  if (typeof bodyFormId === 'string' && bodyFormId) {
    const workspaceId = await getWorkspaceIdForForm(bodyFormId);
    if (!workspaceId) throw new NotFoundError('Form not found');
    return { workspaceId, formId: bodyFormId };
  }

  if (req.params.id) {
    const submission = await getSubmissionListContext(req.params.id);
    if (!submission) throw new NotFoundError('Submission not found');
    return { workspaceId: submission.workspaceId, formId: submission.formId };
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
 * Authorize a caller against a form's Form submitters audience (or their staff permissions) for
 * `permission`, then populate the public-submit req.coreContext; anonymous callers are attributed to
 * the seeded public user (already resolved as req.actorId). Shared by the submit routes and file
 * uploads. Throws 401 (anonymous) / 403 (authenticated non-member) on denial.
 */
export const authorizeSubmitterForForm = async (
  req: Request,
  res: Response,
  target: FormAccessTarget,
  permission: PermissionCode,
): Promise<void> => {
  const allowed = await hasFormSubmitAccess(target, resolveCaller(req), permission);
  if (!allowed) {
    throw accessDenial(req, 'Not authorized to submit this form');
  }
  // Guaranteed by resolveActorOrPublic upstream; guard so a missing id can't become an empty-string FK.
  if (!req.actorId) {
    throw new Error('authorizeSubmitterForForm requires a resolved actor');
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
 * Authorizes a submission (open / save / submit) against the target form's Form submitters audience
 * (or the caller's staff permissions), then populates req.coreContext for the downstream controller.
 */
export const requireFormSubmitAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const target = await resolveSubmitTarget(req);
    await authorizeSubmitterForForm(req, res, target, Permissions.submission_create);
    next();
  } catch (error) {
    next(error);
  }
};
