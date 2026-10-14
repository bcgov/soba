import type { IdirUser, IdirUserSearch } from '@soba/lib';

export interface UserDirectoryReadinessResult {
  ok: boolean;
  message?: string;
}
export interface UserDirectoryAdapter {
  readinessCheck?(): Promise<UserDirectoryReadinessResult>;
  queryIdirUsers(input: IdirUserSearch): Promise<IdirUser[]>;
}
