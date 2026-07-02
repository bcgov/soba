/**
 * Per-route workspace context resolution.
 *
 * Replaces the global resolver-plugin chain. Workspace context is derived explicitly per route:
 * - `workspaceFromQuery`: workspace-scoped list/create routes read the `workspaceId` query param.
 * - `workspaceListScope`: list/search routes resolve workspace from a scope anchor (workspace or
 *   resource hierarchy id), verify membership, and restrict results to that single workspace.
 * - `workspaceFromResource`: resource (deep-link) routes derive the workspace from the target
 *   resource (form / form version / submission / workspace).
 *
 * All verify the actor's membership and echo the resolved workspace via the `x-soba-workspace-id`
 * response header so the frontend's per-tab store can capture it. Deep-link access is membership-only
 * for now (visibility-aware public access is a separate change).
 */
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { appUsers } from '../db/schema';
import { getWorkspaceForUser } from '../db/repos/membershipRepo';
import { getWorkspaceById } from '../db/repos/workspaceRepo';
import { getCacheAdapter } from '../integrations/plugins/PluginRegistry';
import { membershipKey } from '../integrations/cache/cacheKeys';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { getActorId } from './actor';
import { getFormListContext, getWorkspaceIdForForm } from '../db/repos/formRepo';
import {
  getFormVersionListContext,
  getWorkspaceIdForFormVersion,
} from '../db/repos/formVersionRepo';
import { getSubmissionListContext, getWorkspaceIdForSubmission } from '../db/repos/submissionRepo';
import type { CoreRequestContext } from './requestContext';

export const WORKSPACE_HEADER = 'x-soba-workspace-id';
const RESOURCE_NOT_FOUND = 'Resource not found';
const MISSING_ACTOR_IDENTITY = 'Missing actor identity (actorId or x-soba-user-id)';

export type ListAnchorKind = 'workspaceId' | 'formId' | 'formVersionId' | 'submissionId';

type ListScopeQuery = Partial<Record<ListAnchorKind, string>>;

export type ResolvedListScope = {
  workspaceId: string;
  anchorKind: ListAnchorKind;
};

const echoWorkspace = (res: Response, workspaceId: string): void => {
  res.set(WORKSPACE_HEADER, workspaceId);
};

const readQueryString = (query: ListScopeQuery, key: ListAnchorKind): string | undefined => {
  const value = query[key];
  return typeof value === 'string' && value ? value : undefined;
};

const assertHierarchyMatch = (
  field: ListAnchorKind,
  expected: string,
  actual: string | undefined,
): void => {
  if (actual !== undefined && actual !== expected) {
    throw new ValidationError(`${field} is inconsistent with the resolved resource hierarchy`);
  }
};

/**
 * Resolve the workspace for a list/search request from the most specific scope anchor present,
 * and verify any additional hierarchy ids in the query are consistent with that anchor.
 */
export const resolveListWorkspaceScope = async (
  query: ListScopeQuery,
  anchorOrder: ListAnchorKind[],
): Promise<ResolvedListScope> => {
  let anchorKind: ListAnchorKind | null = null;
  for (const key of anchorOrder) {
    if (readQueryString(query, key)) {
      anchorKind = key;
      break;
    }
  }

  if (!anchorKind) {
    throw new ValidationError('Missing scope anchor');
  }

  const qWorkspaceId = readQueryString(query, 'workspaceId');
  const qFormId = readQueryString(query, 'formId');
  const qFormVersionId = readQueryString(query, 'formVersionId');

  switch (anchorKind) {
    case 'submissionId': {
      const submissionId = readQueryString(query, 'submissionId')!;
      const context = await getSubmissionListContext(submissionId);
      if (!context) {
        throw new NotFoundError(RESOURCE_NOT_FOUND);
      }
      assertHierarchyMatch('formVersionId', context.formVersionId, qFormVersionId);
      assertHierarchyMatch('formId', context.formId, qFormId);
      assertHierarchyMatch('workspaceId', context.workspaceId, qWorkspaceId);
      return { workspaceId: context.workspaceId, anchorKind };
    }
    case 'formVersionId': {
      const formVersionId = readQueryString(query, 'formVersionId')!;
      const context = await getFormVersionListContext(formVersionId);
      if (!context) {
        throw new NotFoundError(RESOURCE_NOT_FOUND);
      }
      assertHierarchyMatch('formId', context.formId, qFormId);
      assertHierarchyMatch('workspaceId', context.workspaceId, qWorkspaceId);
      return { workspaceId: context.workspaceId, anchorKind };
    }
    case 'formId': {
      const formId = readQueryString(query, 'formId')!;
      const context = await getFormListContext(formId);
      if (!context) {
        throw new NotFoundError(RESOURCE_NOT_FOUND);
      }
      assertHierarchyMatch('workspaceId', context.workspaceId, qWorkspaceId);
      return { workspaceId: context.workspaceId, anchorKind };
    }
    case 'workspaceId': {
      return { workspaceId: readQueryString(query, 'workspaceId')!, anchorKind };
    }
  }
};

/**
 * Build the core request context for an already-resolved workspace: verify membership (cached) and
 * load the actor display label. Throws ForbiddenError when the actor is not a member.
 */
export const buildCoreContext = async (
  actorId: string,
  workspaceId: string,
  source: string,
): Promise<CoreRequestContext> => {
  const cache = getCacheAdapter();
  const cacheKey = membershipKey(workspaceId, actorId);
  const getOrSet = cache.getOrSet?.bind(cache);
  const membership = getOrSet
    ? await getOrSet(cacheKey, () => getWorkspaceForUser(workspaceId, actorId))
    : await getWorkspaceForUser(workspaceId, actorId);
  if (!membership) {
    throw new ForbiddenError('Actor does not belong to workspace');
  }

  const userRow = await db
    .select({ displayLabel: appUsers.displayLabel })
    .from(appUsers)
    .where(eq(appUsers.id, actorId))
    .limit(1);

  return {
    workspaceId,
    actorId,
    actorDisplayLabel: userRow[0]?.displayLabel ?? null,
    workspaceSource: source,
  };
};

/** Workspace-scoped routes (lists/creates): workspace comes from the `workspaceId` query param. */
export const workspaceFromQuery = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const actorId = getActorId(req);
    if (!actorId) {
      throw new ValidationError(MISSING_ACTOR_IDENTITY);
    }
    const raw = req.query.workspaceId;
    const workspaceId = typeof raw === 'string' ? raw : '';
    if (!workspaceId) {
      throw new ValidationError('Missing workspaceId query parameter');
    }
    req.coreContext = await buildCoreContext(actorId, workspaceId, 'query');
    echoWorkspace(res, workspaceId);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * List/search routes: resolve workspace from the most specific scope anchor in the query,
 * verify hierarchy consistency, membership, and restrict results to that single workspace.
 */
export const workspaceListScope = (config: { anchorOrder: ListAnchorKind[] }) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = getActorId(req);
      if (!actorId) {
        throw new ValidationError(MISSING_ACTOR_IDENTITY);
      }

      const query: ListScopeQuery = {};
      for (const key of config.anchorOrder) {
        const value = req.query[key];
        if (typeof value === 'string' && value) {
          query[key] = value;
        }
      }

      const resolved = await resolveListWorkspaceScope(query, config.anchorOrder);
      const context = await buildCoreContext(
        actorId,
        resolved.workspaceId,
        `list:${resolved.anchorKind}`,
      );
      req.coreContext = context;
      req.listScope = {
        actorId,
        workspaceIds: [resolved.workspaceId],
        selectedWorkspaceId: resolved.workspaceId,
      };
      echoWorkspace(res, resolved.workspaceId);
      next();
    } catch (error) {
      next(error);
    }
  };
};

export type WorkspaceResourceKind = 'form' | 'formVersion' | 'submission' | 'workspace';
export type ResourceIdSource = 'paramsId' | 'queryFormId' | 'bodyFormId';

const lookupWorkspaceId = async (
  kind: WorkspaceResourceKind,
  resourceId: string,
): Promise<string | null> => {
  switch (kind) {
    case 'form':
      return getWorkspaceIdForForm(resourceId);
    case 'formVersion':
      return getWorkspaceIdForFormVersion(resourceId);
    case 'submission':
      return getWorkspaceIdForSubmission(resourceId);
    case 'workspace': {
      // The resource is the workspace itself. Confirm it exists so a missing workspace
      // yields 404 (matching workspaces/schema.ts); membership is then verified by
      // buildCoreContext, which yields 403 for an existing workspace the actor can't access.
      const workspace = await getWorkspaceById(resourceId);
      return workspace ? resourceId : null;
    }
  }
};

const readResourceId = (req: Request, idFrom: ResourceIdSource): string | null => {
  if (idFrom === 'paramsId') {
    return typeof req.params.id === 'string' && req.params.id ? req.params.id : null;
  }
  if (idFrom === 'queryFormId') {
    return typeof req.query.formId === 'string' && req.query.formId ? req.query.formId : null;
  }
  const formId = (req.body as { formId?: unknown } | undefined)?.formId;
  return typeof formId === 'string' && formId ? formId : null;
};

/**
 * Resource (deep-link) routes: derive the workspace from the target resource, then verify access.
 * Missing resource -> 404 (no info leak). Non-member -> 403 (enforced by buildCoreContext).
 */
export const workspaceFromResource = (config: {
  kind: WorkspaceResourceKind;
  idFrom: ResourceIdSource;
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = getActorId(req);
      if (!actorId) {
        throw new ValidationError(MISSING_ACTOR_IDENTITY);
      }
      const resourceId = readResourceId(req, config.idFrom);
      if (!resourceId) {
        throw new ValidationError('Missing resource identifier for workspace resolution');
      }
      const workspaceId = await lookupWorkspaceId(config.kind, resourceId);
      if (!workspaceId) {
        throw new NotFoundError(RESOURCE_NOT_FOUND);
      }
      req.coreContext = await buildCoreContext(actorId, workspaceId, `resource:${config.kind}`);
      echoWorkspace(res, workspaceId);
      next();
    } catch (error) {
      next(error);
    }
  };
};
