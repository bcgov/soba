import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DataError } from '@/src/shared/api/dataContracts';
import { ApiError } from '@/src/shared/api/sobaHelpers';

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

const h = vi.hoisted(() => ({
  kc: {
    authenticated: false,
    initializing: false,
    initStarted: true,
    error: undefined,
    signInAfterRefusal: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({ useKeycloak: () => h.kc }));

import en from '@/dictionaries/en.json';
import { SubmissionLoadAlert } from '@/src/features/submissions/ui/SubmissionLoadAlert';

const refused = (status: number): DataError => ({
  kind: status === 403 ? 'forbidden' : 'failed',
  cause: new ApiError('refused', status, 'read_denied'),
});

beforeEach(() => {
  h.kc = { ...h.kc, authenticated: false, signInAfterRefusal: vi.fn() };
});

describe('SubmissionLoadAlert', () => {
  it('sends a signed-out visitor refused with 401 to sign in, without the no-access message', () => {
    render(<SubmissionLoadAlert error={refused(401)} />);
    expect(h.kc.signInAfterRefusal).toHaveBeenCalledWith(globalThis.location.href);
    expect(screen.getByRole('progressbar', { name: en.general.loading })).toBeInTheDocument();
    expect(screen.queryByText(en.apiErrors.read_denied)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not send a signed-in caller to sign in again on a 401', () => {
    h.kc.authenticated = true;
    render(<SubmissionLoadAlert error={refused(401)} />);
    expect(h.kc.signInAfterRefusal).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it.each([
    ['signed in', true],
    ['signed out', false],
  ])('shows the refusal for a 403 to a caller %s', (_label, authenticated) => {
    h.kc.authenticated = authenticated;
    render(<SubmissionLoadAlert error={refused(403)} />);
    expect(h.kc.signInAfterRefusal).not.toHaveBeenCalled();
    expect(screen.getByTestId('submission-view-noaccess')).toBeInTheDocument();
  });
});
