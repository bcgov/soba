import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { useNameCheck, type NameCheckInput } from '@/src/shared/api/useNameCheck';

// The real store and SWR, so the check runs as it does in a form: once signed in, after the typing
// has settled.
let store: ReturnType<typeof makeStore>;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          shouldRetryOnError: false,
          revalidateOnFocus: false,
        }}
      >
        {children}
      </SWRConfig>
    </Provider>
  );
}

const LABELS = { checking: 'Checking…', available: 'Available', unavailable: 'Unavailable' };

const renderCheck = (input: Partial<NameCheckInput>) =>
  renderHook(
    (props: Partial<NameCheckInput>) =>
      useNameCheck({ name: '', scope: ['group', 'ws1'], check, labels: LABELS, ...props }),
    { wrapper, initialProps: input },
  );

const check = vi.fn();

describe('useNameCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token-1'));
    store.dispatch(setAuthenticated(true));
    check.mockResolvedValue({ available: true });
  });

  it('says a free name is available, once the typing settles, and lets the save go', async () => {
    const { result } = renderCheck({ name: '  Reviewers  ' });

    expect(result.current.status).toBe('checking');
    expect(result.current.description).toBe('Checking…');
    expect(result.current.blocksSave).toBe(true);
    // Only the result is announced.
    expect(result.current.announcement).toBe('');

    await waitFor(() => expect(result.current.status).toBe('available'));
    expect(check).toHaveBeenCalledWith('token-1', 'Reviewers');
    expect(result.current.description).toBe('Available ✓');
    expect(result.current.errorMessage).toBeUndefined();
    expect(result.current.announcement).toBe('Available');
    expect(result.current.blocksSave).toBe(false);
  });

  it('says a taken name is unavailable, and holds the save', async () => {
    check.mockResolvedValue({ available: false });
    const { result } = renderCheck({ name: 'Reviewers' });

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.errorMessage).toBe('Unavailable ✕');
    expect(result.current.description).toBeUndefined();
    expect(result.current.announcement).toBe('Unavailable');
    expect(result.current.blocksSave).toBe(true);
  });

  it('checks only the name the typing settled on', async () => {
    const { result, rerender } = renderCheck({ name: '' });
    rerender({ name: 'Rev' });
    expect(result.current.status).toBe('checking');
    rerender({ name: 'Revi' });
    rerender({ name: 'Reviewers' });

    await waitFor(() => expect(result.current.status).toBe('available'));
    expect(check.mock.calls.map(([, name]) => name)).toEqual(['Reviewers']);
  });

  it.each([
    ['a blank name', { name: '   ' }],
    ['nothing to check against yet', { name: 'Reviewers', scope: null }],
    ['the name the record already has', { name: ' Reviewers ', savedName: 'Reviewers' }],
  ])('reports nothing, and asks nothing, for %s', async (_case, input) => {
    const { result } = renderCheck(input);

    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(check).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
    expect(result.current.description).toBeUndefined();
    expect(result.current.blocksSave).toBe(false);
  });

  it('checks a changed name of a record that already has one', async () => {
    const { result } = renderCheck({ name: 'Approvers', savedName: 'Reviewers' });

    await waitFor(() => expect(result.current.status).toBe('available'));
    expect(check).toHaveBeenCalledWith('token-1', 'Approvers');
  });

  // The save is checked again on the server, so a check that could not answer holds nothing.
  it('leaves the save free when the check fails', async () => {
    check.mockRejectedValue(new ApiError('Request failed (500)', 500));
    const { result } = renderCheck({ name: 'Reviewers' });

    await waitFor(() => expect(check).toHaveBeenCalled());
    await waitFor(() => expect(result.current.status).toBeNull());
    expect(result.current.blocksSave).toBe(false);
  });

  it('asks again when told the name was just refused', async () => {
    const { result } = renderCheck({ name: 'Reviewers' });
    await waitFor(() => expect(result.current.status).toBe('available'));
    check.mockResolvedValue({ available: false });

    act(() => result.current.revalidate());

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(check).toHaveBeenCalledTimes(2);
  });
});
