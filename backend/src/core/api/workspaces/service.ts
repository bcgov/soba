import {
  getWorkspaceForUser,
  listWorkspacesForUser,
  type WorkspaceListCursorMode,
  type WorkspaceListSort,
} from '../../db/repos/membershipRepo';
import { canCreateWorkspaceByIdp } from '../../db/repos/idpGroupRepo';
import { createTeamWorkspace, updateWorkspaceName } from '../../db/repos/workspaceRepo';
import { ForbiddenError } from '../../errors';
import { decodeCursorAndMode, buildNextCursor, type CursorSort } from '../shared/pagination';

export class WorkspacesApiService {
  async list(
    actorId: string,
    query: {
      limit: number;
      cursor?: string;
      kind?: string;
      status?: string;
      sort?: CursorSort;
    },
  ) {
    const { cursorMode, sort, afterId, afterUpdatedAt } = decodeCursorAndMode({
      cursor: query.cursor,
      sort: query.sort ?? 'id:desc',
    });
    const { items, hasMore } = await listWorkspacesForUser({
      userId: actorId,
      limit: query.limit,
      sort: (sort ?? 'id:desc') as WorkspaceListSort,
      cursorMode: cursorMode as WorkspaceListCursorMode,
      afterId,
      afterUpdatedAt,
      kind: query.kind,
      status: query.status,
    });
    const lastItem = items[items.length - 1];
    const nextCursor = buildNextCursor(
      lastItem ? { id: lastItem.id, updatedAt: lastItem.updatedAt } : undefined,
      hasMore,
      cursorMode,
    );
    return {
      items: items.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        kind: r.kind,
        role: r.role,
        status: r.status,
      })),
      page: {
        limit: query.limit,
        hasMore,
        nextCursor,
        cursorMode,
      },
      filters: {
        kind: query.kind,
        status: query.status,
      },
      sort: sort ?? 'id:desc',
    };
  }

  async getCurrent(workspaceId: string, actorId: string) {
    const row = await getWorkspaceForUser(workspaceId, actorId);
    if (!row) return null;
    return this.toWorkspaceItem(row);
  }

  private toWorkspaceItem(row: {
    id: string;
    name: string;
    slug: string | null;
    kind: string;
    role: string;
    status: string;
  }) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: row.kind,
      role: row.role,
      status: row.status,
    };
  }

  async create(actorId: string, idpCode: string | null, body: { name: string }) {
    const canCreate = await canCreateWorkspaceByIdp(idpCode);
    if (!canCreate) {
      throw new ForbiddenError(
        'Only users authenticated through a BC Government identity provider can create workspaces',
      );
    }
    const workspaceId = await createTeamWorkspace(actorId, body.name);
    const row = await getWorkspaceForUser(workspaceId, actorId);
    if (!row) {
      throw new Error('Created workspace could not be loaded');
    }
    return this.toWorkspaceItem(row);
  }

  async updateName(workspaceId: string, actorId: string, body: { name: string }) {
    const updated = await updateWorkspaceName(workspaceId, actorId, body.name);
    if (!updated) {
      throw new ForbiddenError('Only workspace owners or admins can rename this workspace');
    }
    const row = await getWorkspaceForUser(workspaceId, actorId);
    if (!row) return null;
    return this.toWorkspaceItem(row);
  }
}

export const workspacesApiService = new WorkspacesApiService();
