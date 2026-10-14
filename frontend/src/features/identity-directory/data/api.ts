import type { IdirUserSearchQuery, IdirUserSearchResponse } from '@soba/lib';
import { isSessionExpired, sobaFetch } from '@/src/shared/api/sobaFetch';
import { isForbidden, parseJson } from '@/src/shared/api/sobaHelpers';

/**
 * Search the CSS IDIR directory using the signed-in user's Soba bearer token.
 * Requires workspace owner or admin membership in query.workspaceId; anonymous users cannot search.
 * Results can include users who have never signed in to Soba. Searching does not create accounts
 * or memberships, which the existing group-permission assignment flow requires.
 */
export async function searchIdirUsers(
  token: string,
  query: IdirUserSearchQuery,
): Promise<IdirUserSearchResponse> {
  return parseJson(await sobaFetch('/identity-search/idir', { token, query }));
}

export function idirSearchErrorMessage(error: unknown): string {
  if (isSessionExpired(error)) return 'Your session has expired. Sign in again.';
  if (isForbidden(error)) return 'You do not have permission to search this workspace’s directory.';
  return 'IDIR user search is unavailable. Please try again.';
}
