import type {
  CreateCredential,
  CredentialScope,
  CredentialSecret,
  CredentialState,
} from '@/src/types/credentials';
import { CredentialSecretSchema, CredentialStateSchema } from '@soba/lib';
import { sobaFetch } from '@/src/shared/api/sobaFetch';
import { parseJson } from '@/src/shared/api/sobaHelpers';
import { toListRequestQuery, type ListQueryArgs } from '@/src/types/list';
import { sortLocaleHeaders } from '@/src/shared/api/sortLocaleRequest';

const path = (scope: CredentialScope) =>
  scope.kind === 'workspace'
    ? `/workspaces/${encodeURIComponent(scope.id)}/credentials`
    : `/design/forms/${encodeURIComponent(scope.id)}/credentials`;
export const listCredentials = async (
  token: string,
  scope: CredentialScope,
  query: ListQueryArgs,
): Promise<CredentialState> =>
  CredentialStateSchema.parse(
    await parseJson<unknown>(
      await sobaFetch(path(scope), {
        token,
        query: toListRequestQuery(query),
        headers: sortLocaleHeaders(query.locale),
      }),
    ),
  );
export const issueCredential = async (
  token: string,
  scope: CredentialScope,
  input: CreateCredential,
): Promise<CredentialSecret> =>
  CredentialSecretSchema.parse(
    await parseJson<unknown>(await sobaFetch(path(scope), { token, method: 'POST', json: input })),
  );
