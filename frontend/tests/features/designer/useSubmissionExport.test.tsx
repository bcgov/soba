import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const getSobaExportFields = vi.fn();
const exportSobaSubmissions = vi.fn();

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: vi.fn(),
  lookupFormVersions: vi.fn(),
  getSobaExportFields: (...args: unknown[]) => getSobaExportFields(...args),
  exportSobaSubmissions: (...args: unknown[]) => exportSobaSubmissions(...args),
  downloadSobaSubmissionFile: vi.fn(),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import {
  useExportFields,
  useSubmissionExporter,
} from '@/src/features/designer/data/useSubmissionExport';
import type { SubmissionExportFieldsBody } from '@/src/types/submissionExport';

const FILTERS: SubmissionExportFieldsBody = {
  dateMode: 'sinceLastExport',
  includeDrafts: false,
  template: 'multiRowEmptySpacesCSVExport',
};

function wrapper({ children }: { children: React.ReactNode }) {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
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

describe('useExportFields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the columns for the filters', async () => {
    getSobaExportFields.mockResolvedValue({ fields: ['name'], lastExportedAt: null });

    const { result } = renderHook(() => useExportFields('f1', FILTERS), { wrapper });

    await waitFor(() => expect(result.current.data?.fields).toEqual(['name']));
    expect(getSobaExportFields).toHaveBeenCalledWith('token', 'f1', FILTERS);
  });

  it('waits while the filters are incomplete', async () => {
    const { result } = renderHook(() => useExportFields('f1', null), { wrapper });

    await act(async () => {});
    expect(result.current.data).toBeNull();
    expect(getSobaExportFields).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'forbidden'],
    [500, 'failed'],
  ])('classifies a %s read as %s', async (status, kind) => {
    getSobaExportFields.mockRejectedValue(new ApiError('no', status));

    const { result } = renderHook(() => useExportFields('f1', FILTERS), { wrapper });

    await waitFor(() => expect(result.current.error?.kind).toBe(kind));
    expect(result.current.data).toBeNull();
  });
});

describe('useSubmissionExporter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the file and re-reads the last export date', async () => {
    getSobaExportFields.mockResolvedValue({ fields: ['name'], lastExportedAt: null });
    const file = { blob: new Blob(['x']), filename: 'f_submissions.csv' };
    exportSobaSubmissions.mockResolvedValue(file);

    const { result } = renderHook(
      () => ({ fields: useExportFields('f1', FILTERS), exporter: useSubmissionExporter('f1') }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.fields.data).not.toBeNull());
    const reads = getSobaExportFields.mock.calls.length;

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.exporter.exportFile('token', {
        ...FILTERS,
        format: 'csv',
        locale: 'en',
      });
    });

    expect(outcome).toEqual({ status: 'applied', value: file });
    await waitFor(() => expect(getSobaExportFields.mock.calls.length).toBeGreaterThan(reads));
  });

  it('throws a failed export to the caller', async () => {
    exportSobaSubmissions.mockRejectedValue(new ApiError('boom', 500));

    const { result } = renderHook(() => useSubmissionExporter('f1'), { wrapper });

    await expect(
      result.current.exportFile('token', { ...FILTERS, format: 'json', locale: 'en' }),
    ).rejects.toThrow('boom');
  });
});
