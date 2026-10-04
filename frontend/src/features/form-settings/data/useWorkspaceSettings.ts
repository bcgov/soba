import { useSWRConfig } from 'swr';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { classifyDataError } from '@/src/shared/api/dataError';
import { getWorkspaceSettings, setWorkspaceSettings } from './api';

/**
 * A settings group of a workspace, and a save that puts the saved settings in the cache. A save also
 * re-reads the group for any form already loaded, since a form that inherits shows the new values.
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
    await mutateAll(
      (cacheKey) =>
        Array.isArray(cacheKey) && cacheKey[0] === 'form-settings' && cacheKey[1] === key,
    );
  };

  return { settings: data, error: error ? classifyDataError(error) : null, save };
}
