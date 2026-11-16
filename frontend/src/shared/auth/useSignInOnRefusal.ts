'use client';

import { useEffect } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import type { DataError } from '@/src/shared/api/dataContracts';
import { isUnauthorized } from '@/src/shared/api/dataError';

/**
 * Sends a signed-out visitor the server refused (401) to sign in, back to this address. True while
 * that redirect is under way. A signed-in caller is refused with 403, so it never loops.
 */
export function useSignInOnRefusal(error: DataError | null): boolean {
  const { authenticated, initializing, login } = useKeycloak();
  const refused = !authenticated && !initializing && isUnauthorized(error?.cause);

  useEffect(() => {
    if (refused) void login(globalThis.location.href);
  }, [refused, login]);

  return refused;
}
