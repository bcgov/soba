import {
  getWorkspaceForUser,
  listWorkspacesForUser,
  getActiveUserIdsForWorkspace,
  type WorkspaceListCursorMode,
  type WorkspaceListSort,
} from '../../db/repos/membershipRepo';
import { canCreateWorkspaceByIdp } from '../../db/repos/idpGroupRepo';
import { createTeamWorkspace, updateWorkspace } from '../../db/repos/workspaceRepo';
import { ForbiddenError } from '../../errors';
import { decodeCursorAndMode, buildNextCursor, type CursorSort } from '../shared/pagination';
import { emitWorkspaceUpdate } from './stream';

export class WorkspacesApiService {
  async list(
    actorId: string,
    query: {
      limit: number;
      cursor?: string;
      kind?: string;
      status?: string;
      sort?: CursorSort;
      updatedSince?: string;
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
      updatedSince: query.updatedSince ? new Date(query.updatedSince) : undefined,
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
        kind: r.kind,
        role: r.role,
        status: r.status,
        disclaimerAccepted: r.disclaimerAcceptedAt != null,
        updatedAt: r.updatedAt.toISOString(),
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
    kind: string;
    role: string;
    status: string;
    disclaimerAcceptedAt: Date | null;
    updatedAt?: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      role: row.role,
      status: row.status,
      disclaimerAccepted: row.disclaimerAcceptedAt != null,
      updatedAt: row.updatedAt?.toISOString(),
    };
  }

  async create(
    actorId: string,
    idpCode: string | null,
    body: { id?: string; name: string; disclaimerAccepted?: boolean },
  ) {
    const canCreate = await canCreateWorkspaceByIdp(idpCode);
    if (!canCreate) {
      throw new ForbiddenError(
        'Only users authenticated through a BC Government identity provider can create workspaces',
      );
    }
    const workspaceId = await createTeamWorkspace(
      actorId,
      body.name,
      body.disclaimerAccepted ?? false,
      body.id,
    );
    const row = await getWorkspaceForUser(workspaceId, actorId);
    if (!row) {
      throw new Error('Created workspace could not be loaded');
    }
    const item = this.toWorkspaceItem(row);
    const userIds = await getActiveUserIdsForWorkspace(workspaceId);
    emitWorkspaceUpdate(item, userIds);
    return item;
  }

  async update(
    workspaceId: string,
    actorId: string,
    body: { name?: string; disclaimerAccepted?: boolean },
  ) {
    const updated = await updateWorkspace(workspaceId, actorId, body);
    if (!updated) {
      throw new ForbiddenError('Only workspace owners or admins can manage this workspace');
    }
    const row = await getWorkspaceForUser(workspaceId, actorId);
    if (!row) return null;
    const item = this.toWorkspaceItem(row);
    const userIds = await getActiveUserIdsForWorkspace(workspaceId);
    emitWorkspaceUpdate(item, userIds);
    return item;
  }
}

export const workspacesApiService = new WorkspacesApiService();
