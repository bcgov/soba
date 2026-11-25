import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DataError } from '@/src/shared/api/dataContracts';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const signedOut = () => ({
  authenticated: false,
  initializing: false,
  initStarted: true,
  error: undefined as string | undefined,
  signInAfterRefusal: vi.fn(),
});

const h = vi.hoisted(() => ({ kc: {} as ReturnType<typeof signedOut> }));

vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => h.kc }));

import { useSignInOnRefusal } from '@/src/shared/auth/useSignInOnRefusal';

const refusal = (status: number): DataError => ({
  kind: status === 403 ? 'forbidden' : 'failed',
  cause: new ApiError('refused', status, 'read_denied'),
});

const run = (error: DataError | null) => renderHook(() => useSignInOnRefusal(error)).result.current;

beforeEach(() => {
  h.kc = signedOut();
});

describe('useSignInOnRefusal', () => {
  it('sends a signed-out visitor refused with 401 to sign in, back to this address', () => {
    expect(run(refusal(401))).toBe(true);
    expect(h.kc.signInAfterRefusal).toHaveBeenCalledWith(globalThis.location.href);
  });

  it('signs in once while the same refusal is read again', () => {
    const { rerender } = renderHook(({ error }) => useSignInOnRefusal(error), {
      initialProps: { error: refusal(401) },
    });
    rerender({ error: refusal(401) });
    expect(h.kc.signInAfterRefusal).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a signed-out visitor refused with 403', {}, refusal(403)],
    ['a 401 to a signed-in caller', { authenticated: true }, refusal(401)],
    ['a 401 before Keycloak starts', { initStarted: false }, refusal(401)],
    ['a 401 while Keycloak initializes', { initializing: true }, refusal(401)],
    ['a 401 when Keycloak could not be reached', { error: 'unreachable' }, refusal(401)],
    ['a server failure', {}, refusal(500)],
    ['no error', {}, null],
  ])('leaves %s alone', (_label, kc, error) => {
    h.kc = { ...h.kc, ...kc };
    expect(run(error)).toBe(false);
    expect(h.kc.signInAfterRefusal).not.toHaveBeenCalled();
  });
});
