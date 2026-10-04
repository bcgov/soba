import { useSWRConfig } from 'swr';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import { getWorkspaceSettings, setWorkspaceSettings } from './api';

/**
 * A settings group of a workspace, and a save that puts the saved settings in the cache. A save also
 * drops the group's cached form views, since a form that inherits shows the new values: a mounted
 * view reads again now, an unmounted one when it next mounts.
 */
export function useWorkspaceSettings<TSettings>(key: string, workspaceId: string | null) {
  const { mutate: mutateAll } = useSWRConfig();
  const { data, error, mutate } = useAuthedSWR<TSettings>(
    workspaceId ? ['workspace-settings', key, workspaceId] : null,
    (token) => getWorkspaceSettings<TSettings>(token, workspaceId as string, key),
    sessionReadConfig,
  );

  const save = async (token: string, body: TSettings): Promise<void> => {
    if (!workspaceId) return;
    await mutate(setWorkspaceSettings<TSettings>(token, workspaceId, key, body), {
      revalidate: false,
    });
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
