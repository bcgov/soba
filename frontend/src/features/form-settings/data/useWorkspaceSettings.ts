import { useSWRConfig } from 'swr';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import type { WorkspaceSettings } from '@/src/types/formSettings';
import { getWorkspaceSettings, setWorkspaceSettings } from './api';

/**
 * A settings group of a workspace, and a save that puts the saved settings in the cache. A save refused
 * because someone else saved first reads the group again before the error reaches the caller. A save also
 * drops the group's cached form views, since a form that inherits shows the new values: a mounted
 * view reads again now, an unmounted one when it next mounts.
 */
export function useWorkspaceSettings<TValues>(key: string, workspaceId: string | null) {
  const { mutate: mutateAll } = useSWRConfig();
  const { data, error, mutate } = useAuthedSWR<WorkspaceSettings<TValues>>(
    workspaceId ? ['workspace-settings', key, workspaceId] : null,
    (token) => getWorkspaceSettings<WorkspaceSettings<TValues>>(token, workspaceId as string, key),
    sessionReadConfig,
  );

  const save = async (token: string, body: WorkspaceSettings<TValues>): Promise<void> => {
    if (!workspaceId) return;
    try {
      await mutate(setWorkspaceSettings(token, workspaceId, key, body), { revalidate: false });
    } catch (err) {
      if (isConflict(err)) await mutate();
      throw err;
    }
    // Without data, mutate re-reads mounted keys only; undefined clears the rest as well.
    await mutateAll(
      (cacheKey) =>
        Array.isArray(cacheKey) && cacheKey[0] === 'form-settings' && cacheKey[1] === key,
      undefined,
      { revalidate: true },
    );
  };

  return { settings: data, error: error ? classifyDataError(error) : null, save };
}
