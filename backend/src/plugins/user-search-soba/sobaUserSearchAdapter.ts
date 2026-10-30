import { DEFAULT_SORT_LOCALE, USER_SEARCH_FIELDS } from '@soba/lib';
import type {
  UserSearchAdapter,
  UserSearchAdapterResult,
  UserSearchCapability,
  UserSearchHit,
  UserSearchRequest,
} from '../../core/integrations/user-search/UserSearchAdapter';
import { listLoginIdentityProviders } from '../../core/db/repos/identityProviderRepo';
import { searchSobaUsers, type SobaUserSearchRow } from '../../core/db/repos/userSearchRepo';

/** A non-blank string at `key` of a stored JSON object, else null. */
const textAt = (record: unknown, key: string): string | null => {
  const value: unknown =
    record && typeof record === 'object' ? (record as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' && value.trim() ? value : null;
};

function toHit(identityProvider: string, row: SobaUserSearchRow): UserSearchHit {
  const { profile, idpAttributes } = row;
  return {
    identityProvider,
    subject: row.subject,
    guid: textAt(idpAttributes, 'idir_user_guid') ?? textAt(idpAttributes, 'bceid_user_guid'),
    username: textAt(profile, 'idir_username') ?? textAt(profile, 'bceid_username'),
    displayName: textAt(profile, 'displayName'),
    firstName: textAt(profile, 'firstName'),
    lastName: textAt(profile, 'lastName'),
    email: textAt(profile, 'email'),
  };
}

/** Soba's own users, by the identities they signed in with. */
export class SobaUserSearchAdapter implements UserSearchAdapter {
  async capabilities(): Promise<readonly UserSearchCapability[]> {
    const identityProviders = await listLoginIdentityProviders(DEFAULT_SORT_LOCALE);
    return identityProviders.map(({ code }) => ({
      identityProvider: code,
      fields: USER_SEARCH_FIELDS,
    }));
  }

  async search(request: UserSearchRequest): Promise<UserSearchAdapterResult> {
    const rows = await searchSobaUsers(request);
    return {
      hits: rows.slice(0, request.limit).map((row) => toHit(request.identityProvider, row)),
      truncated: rows.length > request.limit,
    };
  }
}
