import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { getWorkspaceInheritingForms } from './api';

/**
 * How many live forms use a group's workspace values, read only while `enabled`. Forms change between
 * reads, so each enable reads again.
 */
export function useInheritingFormCount(
  key: string,
  workspaceId: string | null,
  enabled: boolean,
): number | null {
  const { data } = useAuthedSWR<{ count: number }>(
    enabled && workspaceId ? ['workspace-settings', key, workspaceId, 'inheriting-forms'] : null,
    (token) => getWorkspaceInheritingForms(token, workspaceId as string, key),
    { revalidateOnMount: true },
  );
  return data?.count ?? null;
}
