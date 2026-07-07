import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { formVersions } from '../db/schema';
import { hasFormSubmitAccess, type CallerIdentity } from '../db/repos/formSubmitAccessRepo';
import { getWorkspaceIdForSubmission } from '../db/repos/submissionRepo';
import {
  Permissions,
  PUBLIC_SUBMITTER_LABEL,
  WorkspaceMembershipRole,
  type PermissionCode,
} from '../db/codes';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../errors';
import { getActorIdpCode } from './actor';
import { WORKSPACE_HEADER } from './workspaceContext';
import type { Request, Response, NextFunction } from 'express';

type FormVersionRow = typeof formVersions.$inferSelect;

/**
 * Guards the create path (POST /submissions), which names its target in the body: only the currently
 * published version accepts new submissions, and the body's formId must match that version. A save
 * (POST /submissions/:id/save) resolves its version from the existing submission and is exempt.
 */
export const assertCreateTargetConsistent = (
  formVersion: Pick<FormVersionRow, 'state' | 'formId'>,
  body: { formVersionId?: unknown; formId?: unknown } | undefined,
): void => {
  const bodyFormVersionId = body?.formVersionId;
  if (typeof bodyFormVersionId !== 'string' || !bodyFormVersionId) return;
  if (formVersion.state !== 'published') {
    throw new ValidationError('Form version is not accepting submissions');
  }
  if (body?.formId !== formVersion.formId) {
    throw new ValidationError('formId does not match the target form version');
  }
};

/** The caller's identity for audience checks: resolved actor id and provider code (`public` if anon). */
const resolveCaller = (req: Request): CallerIdentity => ({
  actorId: req.actorId ?? null,
  idpCode: getActorIdpCode(req) ?? req.idpType?.toLowerCase() ?? null,
});

/** A denial that distinguishes an authenticated caller (403) from an anonymous one (401). */
const accessDenial = (req: Request, message: string): Error =>
  req.user ? new ForbiddenError(message) : new UnauthorizedError(message);

/** The workspace to authorize a submission against, plus — for a create — the target form version. */
interface SubmitTarget {
  workspaceId: string;
  /** Present only for POST /submissions (create), where the create must be validated against it. */
  formVersion?: FormVersionRow;
}

/**
 * Resolve what a submission request authorizes against. POST /submissions carries the target version in
 * the body (loaded in full for the create-consistency check). POST /submissions/:id/save carries only
 * the submission id and just needs its workspace — the service reloads the submission + version itself,
 * so a single workspace lookup here avoids loading rows twice. Null when nothing resolves.
 */
const resolveSubmitTarget = async (req: Request): Promise<SubmitTarget | null> => {
  const bodyFormVersionId = (req.body as { formVersionId?: unknown } | undefined)?.formVersionId;
  if (typeof bodyFormVersionId === 'string' && bodyFormVersionId) {
    const [formVersion] = await db
      .select()
      .from(formVersions)
      .where(and(eq(formVersions.id, bodyFormVersionId), isNull(formVersions.deletedAt)))
      .limit(1);
    return formVersion ? { workspaceId: formVersion.workspaceId, formVersion } : null;
  }

  if (req.params.id) {
    const workspaceId = await getWorkspaceIdForSubmission(req.params.id);
    return workspaceId ? { workspaceId } : null;
  }

  return null;
};

/**
 * Authorizes a read of a form resource whose workspace was already resolved into req.coreContext (see
 * the open workspace resolvers). Grants staff with `required`, or the Form submitters audience for
 * form_read. On denial, 401 for anonymous / 403 for an authenticated non-member.
 */
export const requireFormAccess = (required: PermissionCode) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = req.coreContext;
      if (!context) {
        throw new Error('requireFormAccess must run after workspace resolution');
      }
      const allowed = await hasFormSubmitAccess(context.workspaceId, resolveCaller(req), required);
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
 * Authorizes a submission (POST /submissions, POST /submissions/:id/save) against the target form
 * version's workspace Form submitters audience (or the caller's staff permissions), then populates
 * req.coreContext for the downstream controller — anonymous submissions are attributed to the seeded
 * public user (already resolved as req.actorId). Replaces the retired visibility check.
 */
export const requireFormSubmitAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const target = await resolveSubmitTarget(req);
    if (!target) {
      // No resolvable target; let the controller/service produce the standard 404/validation error.
      return next();
    }

    const allowed = await hasFormSubmitAccess(
      target.workspaceId,
      resolveCaller(req),
      Permissions.submission_create,
    );
    if (!allowed) {
      throw accessDenial(req, 'Not authorized to submit this form');
    }

    if (target.formVersion) {
      assertCreateTargetConsistent(
        target.formVersion,
        req.body as { formVersionId?: unknown; formId?: unknown },
      );
    }

    req.coreContext = {
      workspaceId: target.workspaceId,
      actorId: req.actorId ?? '',
      actorDisplayLabel:
        req.user?.profile?.displayLabel || req.user?.profile?.displayName || PUBLIC_SUBMITTER_LABEL,
      workspaceSource: 'public-submit',
      // Public submitters have no membership; a non-manage role keeps them off workspace-admin routes.
      role: WorkspaceMembershipRole.member,
    };
    res.set(WORKSPACE_HEADER, target.workspaceId);
    next();
  } catch (error) {
    next(error);
  }
};
