'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { useCallToken } from '@/src/shared/api/callToken';
import { classifyDataError } from '@/src/shared/api/dataError';
import type {
  CreateCredential,
  CredentialSecret,
  CredentialScope,
  CredentialState,
} from '@/src/types/credentials';
import type { ListQueryArgs } from '@/src/types/list';
import { listReadConfig } from '@/src/shared/api/swrConfig';
import { useSortLocale } from '@/src/shared/list/useSortLocale';
import * as api from './api';

const credentialKey = (scope: CredentialScope, subject: string | undefined) =>
  ['credentials', scope.kind, scope.id, subject] as const;

/** Reads and refreshes credential metadata. Secrets never enter the shared cache. */
export function useCredentials(scope: CredentialScope, query: ListQueryArgs) {
  const locale = useSortLocale();
  const { idTokenParsed } = useKeycloak();
  const { data, error, isLoading, mutate } = useAuthedSWR<CredentialState>(
    [
      ...credentialKey(scope, idTokenParsed?.sub),
      query.offset,
      query.limit,
      query.sort,
      query.q ?? '',
      locale,
    ],
    (token) => api.listCredentials(token, scope, { ...query, locale }),
    { ...listReadConfig, shouldRetryOnError: false },
  );
  const refresh = useCallback(() => mutate(), [mutate]);
  return { data, error: error ? classifyDataError(error) : null, isLoading, refresh };
}

/** Writes update metadata only; the caller owns the returned one-time secret. */
export function useCredentialWriter(scope: CredentialScope) {
  const { idTokenParsed } = useKeycloak();
  const { signedInToken } = useCallToken();
  const { mutate } = useSWRConfig();
  const subject = idTokenParsed?.sub;
  const { kind, id } = scope;
  const generate = useCallback(
    async (input: CreateCredential): Promise<CredentialSecret> => {
      const prefix = credentialKey({ kind, id }, subject);
      const matchesScope = (key: unknown) =>
        Array.isArray(key) && prefix.every((part, index) => key[index] === part);
      let result: CredentialSecret;
      try {
        result = await api.issueCredential(signedInToken(), { kind, id }, input);
      } catch (error) {
        await mutate(matchesScope).catch(() => undefined);
        throw error;
      }
      // Cache failure must never discard a successfully issued one-time secret.
      await mutate(matchesScope).catch(() => undefined);
      return result;
    },
    [kind, id, subject, signedInToken, mutate],
  );
  return { generate };
}
