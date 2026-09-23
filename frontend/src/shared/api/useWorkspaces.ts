'use client';

import { useSWRConfig, type SWRConfiguration } from 'swr';
import { useCallback } from 'react';
import {
  createWorkspace,
  fetchWorkspaces,
  lookupWorkspaces,
  selectWorkspace,
  updateWorkspace,
} from './sobaApi';
import { useAuthedSWR } from './useAuthedSWR';
import { listReadConfig } from './swrConfig';
import { isSessionExpired } from './sobaFetch';
import { isForbidden, isNotFound } from './sobaHelpers';
import { classifyDataError } from './dataError';
import { useRefreshCurrentUser } from './useCurrentUser';
import type { ListResult, WriteOutcome } from './dataContracts';
import { EMPTY_LIST_PAGE, type ListQueryArgs, type OffsetPage } from '@/src/types/list';
import type {
  CreateWorkspaceBody,
  UpdateWorkspaceBody,
  WorkspaceItem,
  WorkspaceLookupItem,
  WorkspaceLookupResponse,
} from '@/src/types/workspaces';

/** Same pair as FormCreatePermissions: form + first design. Only form_admin matches form_create. */
const FORM_CREATE_PERMISSIONS = ['form_create', 'design_create'] as const;

const WORKSPACES_KEY = ['workspaces'] as const;
const OPTIONS_KEY = ['workspaces', 'lookup'] as const;
const FORM_CREATE_OPTIONS_KEY = ['workspaces', 'lookup', 'form_create'] as const;
const workspaceKey = (workspaceId: string) => ['workspace', workspaceId] as const;

const EMPTY: WorkspaceItem[] = [];
const EMPTY_OPTIONS: WorkspaceLookupItem[] = [];

const toItems = (items: unknown): WorkspaceItem[] => (Array.isArray(items) ? items : EMPTY);

function useWorkspaceLookup(
  key: readonly string[] | null,
  fetcher: (token: string) => Promise<WorkspaceLookupResponse>,
) {
  const { data, isLoading, error } = useAuthedSWR<WorkspaceLookupResponse>(key, fetcher);
  return {
    workspaces: Array.isArray(data?.items) ? data.items : EMPTY_OPTIONS,
    truncated: data?.truncated === true,
    limit: data?.limit,
    loaded: data !== undefined,
    isLoading,
    error,
  };
}

/**
 * Options for a picker of the user's workspaces. Stops at the lookup limit, so it cannot answer
 * whether the user belongs to a given workspace: read that workspace instead.
 */
export function useWorkspaceOptions() {
  return useWorkspaceLookup(OPTIONS_KEY, (token) => lookupWorkspaces(token));
}

/** Options for the new-form picker: workspaces the user can create a form in, disclaimer accepted. */
export function useFormCreateWorkspaceOptions(enabled = true) {
  return useWorkspaceLookup(enabled ? FORM_CREATE_OPTIONS_KEY : null, (token) =>
    lookupWorkspaces(token, {
      requiredPermissions: FORM_CREATE_PERMISSIONS,
      disclaimerAccepted: true,
    }),
  );
}

/** A refusal is the answer: retrying it only repeats the request. */
const workspaceReadConfig: SWRConfiguration = {
  shouldRetryOnError: (err: unknown) =>
    !isSessionExpired(err) && !isForbidden(err) && !isNotFound(err),
};

/** One workspace, carrying the caller's role in it. */
export function useWorkspace(workspaceId: string | undefined) {
  const { data, isLoading, error } = useAuthedSWR<WorkspaceItem>(
    workspaceId ? workspaceKey(workspaceId) : null,
    (token) => selectWorkspace(token, workspaceId as string),
    workspaceReadConfig,
  );
  return { workspace: data ?? null, isLoading, error: error ? classifyDataError(error) : null };
}

/**
 * One page of workspaces for the list screen. Not a session read: it revalidates normally, so a
 * workspace created or renamed on another screen shows up on the way back.
 */
export function useWorkspaceList(query: ListQueryArgs): ListResult<WorkspaceItem> {
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR<{
    items: WorkspaceItem[];
    page: OffsetPage;
  }>(
    ['workspaces', 'list', query.offset, query.limit, query.sort, query.q ?? ''],
    async (token) => {
      const response = await fetchWorkspaces(token, query);
      return { items: toItems(response.items), page: response.page ?? EMPTY_LIST_PAGE };
    },
    listReadConfig,
  );
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);
  return {
    rows: data?.items ?? EMPTY,
    total: data?.page.total,
    isLoading,
    isRefreshing: isValidating && data !== undefined,
    error: error ? classifyDataError(error) : null,
    refresh,
  };
}

/**
 * Every workspace read after a workspace write: the pickers and whichever page the list screen is
 * showing. The form-create options filter on the disclaimer, so they go stale on the same edits.
 */
export function useRefreshWorkspaces() {
  const { mutate } = useSWRConfig();
  return useCallback(
    () => mutate((key) => Array.isArray(key) && key[0] === WORKSPACES_KEY[0]),
    [mutate],
  );
}

/** The single record too, or reopening the manage screen seeds its form from the pre-save values. */
export function useRefreshWorkspace() {
  const { mutate } = useSWRConfig();
  return useCallback((workspaceId: string) => mutate(workspaceKey(workspaceId)), [mutate]);
}

/**
 * Create or update a workspace, refreshing the caches each write affects. The current user carries
 * whether they have a workspace and can create forms, and both move with a create or disclaimer
 * change, so it is refreshed too.
 */
export function useWorkspaceWriter() {
  const refreshWorkspaces = useRefreshWorkspaces();
  const refreshWorkspace = useRefreshWorkspace();
  const refreshCurrentUser = useRefreshCurrentUser();

  const create = useCallback(
    async (token: string, body: CreateWorkspaceBody): Promise<WriteOutcome<WorkspaceItem>> => {
      const value = await createWorkspace(token, body);
      await Promise.all([refreshWorkspaces(), refreshCurrentUser()]);
      return { status: 'applied', value };
    },
    [refreshWorkspaces, refreshCurrentUser],
  );

  const update = useCallback(
    async (
      token: string,
      id: string,
      patch: UpdateWorkspaceBody,
    ): Promise<WriteOutcome<WorkspaceItem>> => {
      const value = await updateWorkspace(token, id, patch);
      await Promise.all([refreshWorkspace(id), refreshWorkspaces(), refreshCurrentUser()]);
      return { status: 'applied', value };
    },
    [refreshWorkspace, refreshWorkspaces, refreshCurrentUser],
  );

  return { create, update };
}
