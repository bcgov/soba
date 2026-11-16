import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DataError } from '@/src/shared/api/dataContracts';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const h = vi.hoisted(() => ({
  kc: { authenticated: false, initializing: false, login: vi.fn() },
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => h.kc }));

import { useSignInOnRefusal } from '@/src/shared/auth/useSignInOnRefusal';

const refusal = (status: number): DataError => ({
  kind: status === 403 ? 'forbidden' : 'failed',
  cause: new ApiError('refused', status, 'read_denied'),
});

const run = (error: DataError | null) => renderHook(() => useSignInOnRefusal(error)).result.current;

beforeEach(() => {
  h.kc = { authenticated: false, initializing: false, login: vi.fn() };
});

describe('useSignInOnRefusal', () => {
  it('sends a signed-out visitor refused with 401 to sign in, back to this address', () => {
    expect(run(refusal(401))).toBe(true);
    expect(h.kc.login).toHaveBeenCalledWith(globalThis.location.href);
  });

  it.each([
    ['a signed-in caller refused with 403', { authenticated: true }, refusal(403)],
    ['a 401 while Keycloak initializes', { initializing: true }, refusal(401)],
    ['a server failure', {}, refusal(500)],
    ['no error', {}, null],
  ])('leaves %s alone', (_label, kc, error) => {
    h.kc = { ...h.kc, ...kc };
    expect(run(error)).toBe(false);
    expect(h.kc.login).not.toHaveBeenCalled();
  });
});
