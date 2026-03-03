import {
  listMembersForWorkspace,
  type MemberListCursorMode,
  type MemberListSort,
} from '../../db/repos/membershipRepo';
import { decodeCursorAndMode, buildNextCursor, type CursorSort } from '../shared/pagination';

export const membersApiService = {
  async list(
    workspaceId: string,
    query: {
      limit: number;
      cursor?: string;
      role?: string;
      status?: string;
      sort?: CursorSort;
    },
  ) {
    const { cursorMode, sort, afterId, afterUpdatedAt } = decodeCursorAndMode({
      cursor: query.cursor,
      sort: query.sort ?? 'id:desc',
    });
    const { items, hasMore } = await listMembersForWorkspace({
      workspaceId,
      limit: query.limit,
      sort: (sort ?? 'id:desc') as MemberListSort,
      cursorMode: cursorMode as MemberListCursorMode,
      afterId,
      afterUpdatedAt,
      role: query.role,
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
        userId: r.userId,
        displayLabel: r.displayLabel,
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
        role: query.role,
        status: query.status,
      },
      sort: sort ?? 'id:desc',
    };
  },
};
