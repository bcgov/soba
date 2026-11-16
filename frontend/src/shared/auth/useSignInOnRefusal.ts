'use client';

import { useEffect } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { DataError } from '@/src/shared/api/dataContracts';
import { isUnauthorized } from '@/src/shared/api/dataError';

/**
 * Sends a signed-out visitor the server refused (401) to sign in, back to this address. True while
 * that redirect is under way. A signed-in caller is refused with 403, so it never loops; with
 * Keycloak unreachable the caller shows its alert rather than wait on a redirect that cannot happen.
 */
export function useSignInOnRefusal(error: DataError | null): boolean {
  const { authenticated, initializing, initStarted, error: keycloakError, login } = useKeycloak();
  const refused =
    initStarted &&
    !initializing &&
    !keycloakError &&
    !authenticated &&
    isUnauthorized(error?.cause);

  useEffect(() => {
    if (refused) void login(globalThis.location.href);
  }, [refused, login]);

  return refused;
}
