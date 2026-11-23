'use client';

import { useEffect } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { DataError } from '@/src/shared/api/dataContracts';
import { isUnauthorized } from '@/src/shared/api/dataError';

/**
 * Sends a signed-out visitor refused with 401 to sign in, back here; true while redirecting. Not
 * when signed in or Keycloak is down. Back from sign-in redirects again; a failed one keeps spinning.
 */
export function useSignInOnRefusal(error: DataError | null): boolean {
  const {
    authenticated,
    initializing,
    initStarted,
    error: keycloakError,
    signInAfterRefusal,
  } = useKeycloak();
  const refused =
    initStarted &&
    !initializing &&
    !keycloakError &&
    !authenticated &&
    isUnauthorized(error?.cause);

  useEffect(() => {
    if (refused) void signInAfterRefusal(globalThis.location.href);
  }, [refused, signInAfterRefusal]);

  return refused;
}
