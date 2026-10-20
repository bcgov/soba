import type { UserSearchQuery, UserSearchResponse } from '@soba/lib';
import { isSessionExpired, sobaFetch } from '@/src/shared/api/sobaFetch';
import { isForbidden, parseJson } from '@/src/shared/api/sobaHelpers';

/**
 * Find people to add to a form's team, across the enabled search plugins. Results can include
 * people who have never signed in to Soba; searching creates no account or membership.
 */
export async function searchUsers(
  token: string,
  formId: string,
  identityProvider: string,
  query: UserSearchQuery,
): Promise<UserSearchResponse> {
  const path = `/design/forms/${encodeURIComponent(formId)}/user-search/${encodeURIComponent(identityProvider)}`;
  return parseJson(await sobaFetch(path, { token, query }));
}

export function idirSearchErrorMessage(error: unknown): string {
  if (isSessionExpired(error)) return 'Your session has expired. Sign in again.';
  if (isForbidden(error)) return 'You do not have permission to search this workspace’s directory.';
  return 'IDIR user search is unavailable. Please try again.';
}
