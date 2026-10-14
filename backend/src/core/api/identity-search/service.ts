import type { IdirUserSearch, IdirUserSearchResponse } from '@soba/lib';
import { createDefaultUserDirectoryAdapter } from '../../integrations/user-directory/UserDirectoryRegistry';
import { ServiceUnavailableError } from '../../errors';
export async function searchIdirUsers(input: IdirUserSearch): Promise<IdirUserSearchResponse> {
  try {
    return { users: await createDefaultUserDirectoryAdapter().queryIdirUsers(input) };
  } catch {
    throw new ServiceUnavailableError('User directory is unavailable');
  }
}
