import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const getSobaForm = vi.fn();
const lookupFormVersions = vi.fn();
const getSobaFormVersion = vi.fn();
const getFormVersionSchema = vi.fn();
vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: (...args: unknown[]) => getSobaForm(...args),
  lookupFormVersions: (...args: unknown[]) => lookupFormVersions(...args),
  getSobaFormVersion: (...args: unknown[]) => getSobaFormVersion(...args),
  getFormVersionSchema: (...args: unknown[]) => getFormVersionSchema(...args),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { useForm } from '@/src/features/designer/data/useForm';

const V1 = { id: 'v1', versionNo: 1, state: 'published' };
const V2 = { id: 'v2', versionNo: 2, state: 'draft' };
const V3 = { id: 'v3', versionNo: 3, state: 'draft' };

let store: ReturnType<typeof makeStore>;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        {children}
      </SWRConfig>
    </Provider>
  );
}

describe('useForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
    getSobaForm.mockResolvedValue({ id: 'f1', name: 'Form', description: '', currentVersion: V2 });
    lookupFormVersions.mockResolvedValue({ items: [V2, V1], limit: 500, truncated: false });
    getSobaFormVersion.mockImplementation((_token: string, id: string) =>
      Promise.resolve([V1, V2].find((v) => v.id === id)),
    );
    getFormVersionSchema.mockResolvedValue({ components: [] });
  });

  // "Design" on the current version's history row would otherwise open the draft read-only.
  it('opens the current version as the editable draft when it is selected by id', async () => {
    const { result } = renderHook(() => useForm('f1'), { wrapper });
    await waitFor(() => expect(result.current.currentVersion?.id).toBe('v2'));

    act(() => result.current.selectVersion('v2'));

    expect(result.current.selectedVersionId).toBe('current');
    expect(result.current.isHistoryView).toBe(false);
    expect(getSobaFormVersion).not.toHaveBeenCalled();
  });

  // Edits made on v2 must not be saved onto a v3 someone else created.
  it('reports unsaved edits as stale once the current version moves on', async () => {
    const { result } = renderHook(() => useForm('f1'), { wrapper });
    await waitFor(() => expect(result.current.currentVersion?.id).toBe('v2'));

    act(() => result.current.setName('Renamed'));
    expect(result.current.editsStale).toBe(false);

    getSobaForm.mockResolvedValue({ id: 'f1', name: 'Form', description: '', currentVersion: V3 });
    await act(async () => {
      await result.current.refreshForm();
    });

    await waitFor(() => expect(result.current.currentVersion?.id).toBe('v3'));
    expect(result.current.editsStale).toBe(true);

    act(() => result.current.discardEdits());
    expect(result.current.editsStale).toBe(false);
  });

  it('opens an older version as history, read by id', async () => {
    const { result } = renderHook(() => useForm('f1'), { wrapper });
    await waitFor(() => expect(result.current.currentVersion?.id).toBe('v2'));

    act(() => result.current.selectVersion('v1'));

    expect(result.current.isHistoryView).toBe(true);
    await waitFor(() => expect(result.current.activeVersion?.id).toBe('v1'));
    expect(getSobaFormVersion).toHaveBeenCalledWith('token', 'v1');
  });
});
