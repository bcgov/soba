import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { parseJson } from '@/src/shared/api/sobaHelpers';
import { useAuthedSWR, useMaybeAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { useSortLocale } from '@/src/shared/list/useSortLocale';
import { classifyDataError } from '@/src/shared/api/dataError';
import { listReadConfig } from '@/src/shared/api/swrConfig';
import type { ListResult } from '@/src/shared/api/dataContracts';
import type { SortLocale } from '@soba/lib';
import type { ListQueryArgs } from '@/src/types/list';
import { toListRequestQuery } from '@/src/types/list';
import type { CreateGroupInput, RoleMeta, UpdateGroupInput, WorkspaceGroup } from '../types/groups';

export const workspaceGroupsKey = (workspaceId: string) =>
  ['workspace-groups', workspaceId] as const;

export const rolesMetaKey = ['meta-roles'] as const;

export async function listWorkspaceGroups(
  token: string,
  workspaceId: string,
  locale?: string,
  query?: ListQueryArgs,
): Promise<{ items: WorkspaceGroup[]; page?: { total: number } }> {
  const queryParams: Record<string, string | number> = {
    ...(query ? toListRequestQuery({ ...query, locale: locale as SortLocale }) : {}),
    ...(locale && !query ? { locale } : {}),
  };

  const response = await sobaFetch(`/workspaces/${workspaceId}/groups`, {
    token,
    query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
  });
  return parseJson(response);
}

export async function createWorkspaceGroup(
  token: string,
  workspaceId: string,
  input: CreateGroupInput,
): Promise<WorkspaceGroup> {
  const response = await sobaFetch(`/workspaces/${workspaceId}/groups`, {
    token,
    method: 'POST',
    json: {
      name: input.name,
      description: input.description,
      roleCodes: input.roleCodes,
    },
  });
  return parseJson(response);
}

export async function renameWorkspaceGroup(
  token: string,
  workspaceId: string,
  groupId: string,
  input: { name?: string; description?: string | null },
): Promise<WorkspaceGroup> {
  const response = await sobaFetch(`/workspaces/${workspaceId}/groups/${groupId}`, {
    token,
    method: 'PATCH',
    json: input,
  });
  return parseJson(response);
}

export async function deleteWorkspaceGroup(
  token: string,
  workspaceId: string,
  groupId: string,
): Promise<void> {
  await sobaFetch(`/workspaces/${workspaceId}/groups/${groupId}`, {
    token,
    method: 'DELETE',
  });
}

export async function setWorkspaceGroupRoles(
  token: string,
  workspaceId: string,
  groupId: string,
  roleCodes: string[],
): Promise<WorkspaceGroup> {
  const response = await sobaFetch(`/workspaces/${workspaceId}/groups/${groupId}/roles`, {
    token,
    method: 'PUT',
    json: { roleCodes },
  });
  return parseJson(response);
}

export async function listRolesMeta(token?: string): Promise<{ roles: RoleMeta[] }> {
  const response = await sobaFetch(`/meta/roles`, { token });
  return parseJson(response);
}

const EMPTY_GROUPS: WorkspaceGroup[] = [];
const EMPTY_ROLES: RoleMeta[] = [];

export function useWorkspaceGroups(
  workspaceId?: string,
  query?: ListQueryArgs,
): ListResult<WorkspaceGroup> & { groups: WorkspaceGroup[]; mutate: () => Promise<unknown> } {
  const locale = useSortLocale();
  const offset = query?.offset;
  const limit = query?.limit;
  const sort = query?.sort;
  const q = query?.q;

  let swrKey: readonly unknown[] | null = null;
  if (workspaceId) {
    swrKey = query
      ? [...workspaceGroupsKey(workspaceId), offset, limit, sort, q ?? '', locale]
      : [...workspaceGroupsKey(workspaceId), locale];
  }

  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR<{
    items: WorkspaceGroup[];
    page?: { total: number };
  }>(
    swrKey,
    (token) => listWorkspaceGroups(token, workspaceId as string, locale, query),
    listReadConfig,
  );

  const rawItems = data?.items ?? EMPTY_GROUPS;

  const filteredItems = useMemo(() => {
    if (!q) return rawItems;
    const term = q.toLowerCase().trim();
    return rawItems.filter(
      (g) =>
        g.name.toLowerCase().includes(term) || Boolean(g.description?.toLowerCase().includes(term)),
    );
  }, [rawItems, q]);

  const backendTotal = data?.page?.total;
  const total = backendTotal ?? (q ? filteredItems.length : rawItems.length);

  const rows = useMemo(() => {
    if (backendTotal !== undefined) {
      return rawItems;
    }
    if (limit !== undefined && offset !== undefined) {
      return filteredItems.slice(offset, offset + limit);
    }
    return filteredItems;
  }, [backendTotal, rawItems, filteredItems, offset, limit]);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    rows,
    groups: rawItems,
    total,
    isLoading,
    isRefreshing: isValidating && data !== undefined,
    error: error ? classifyDataError(error) : null,
    refresh,
    mutate,
  };
}

export function useRolesMeta() {
  const { data, isLoading, error } = useMaybeAuthedSWR<{ roles: RoleMeta[] }>(
    rolesMetaKey,
    (token) => listRolesMeta(token),
  );

  return {
    roles: data?.roles ?? EMPTY_ROLES,
    isLoading,
    error: error ? classifyDataError(error) : null,
  };
}

const ERR_MISSING_WORKSPACE = 'Missing workspaceId';

const compareRoleCodes = (a: string, b: string) => a.localeCompare(b);

async function syncGroupRoles(
  token: string,
  workspaceId: string,
  existing: WorkspaceGroup,
  roleCodes?: string[],
) {
  if (existing.system || roleCodes === undefined) return;
  const currentRoles = [...existing.roles].sort(compareRoleCodes).join(',');
  const nextRoles = [...roleCodes].sort(compareRoleCodes).join(',');
  if (currentRoles !== nextRoles) {
    await setWorkspaceGroupRoles(token, workspaceId, existing.id, roleCodes);
  }
}

export function useWorkspaceGroupsWriter(workspaceId?: string) {
  const { mutate: mutateAll } = useSWRConfig();

  const refreshGroups = () => {
    if (!workspaceId) return Promise.resolve();
    return mutateAll(
      (key) => Array.isArray(key) && key[0] === 'workspace-groups' && key[1] === workspaceId,
      undefined,
      { revalidate: true },
    );
  };

  return useMemo(
    () => ({
      async create(token: string, input: CreateGroupInput) {
        if (!workspaceId) throw new Error(ERR_MISSING_WORKSPACE);
        const res = await createWorkspaceGroup(token, workspaceId, input);
        await refreshGroups();
        return res;
      },

      async update(token: string, existing: WorkspaceGroup, input: UpdateGroupInput) {
        if (!workspaceId) throw new Error(ERR_MISSING_WORKSPACE);

        const nameChanged = input.name !== undefined && input.name !== existing.name;
        const descChanged =
          input.description !== undefined && input.description !== existing.description;
        if (nameChanged || descChanged) {
          await renameWorkspaceGroup(token, workspaceId, existing.id, {
            name: input.name,
            description: input.description,
          });
        }

        await syncGroupRoles(token, workspaceId, existing, input.roleCodes);
        await refreshGroups();
      },

      async remove(token: string, groupId: string) {
        if (!workspaceId) throw new Error(ERR_MISSING_WORKSPACE);
        await deleteWorkspaceGroup(token, workspaceId, groupId);
        await refreshGroups();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, mutateAll],
  );
}
