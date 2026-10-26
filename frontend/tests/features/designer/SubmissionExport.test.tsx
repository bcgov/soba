import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const { mockPush, mockSaveBlob } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSaveBlob: vi.fn(),
}));

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/build/f1/submissions/export',
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/src/shared/util/saveBlob', () => ({
  saveBlob: (...args: unknown[]) => mockSaveBlob(...args),
}));

const getSobaForm = vi.fn();
const lookupFormVersions = vi.fn();
const getSobaExportFields = vi.fn();
const exportSobaSubmissions = vi.fn();

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: (...args: unknown[]) => getSobaForm(...args),
  lookupFormVersions: (...args: unknown[]) => lookupFormVersions(...args),
  getSobaExportFields: (...args: unknown[]) => getSobaExportFields(...args),
  exportSobaSubmissions: (...args: unknown[]) => exportSobaSubmissions(...args),
  downloadSobaSubmissionFile: vi.fn(),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { SubmissionExport } from '@/src/features/designer/ui/SubmissionExport';

const FIELDS = ['form.submissionId', 'form.version', 'name', 'email'];

async function renderExport() {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  await act(async () => {
    render(
      <Provider store={store}>
        <SWRConfig
          value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
        >
          <SubmissionExport formId="f1" />
        </SWRConfig>
      </Provider>,
    );
  });
}

async function openExport() {
  await renderExport();
  await screen.findByTestId('export-form');
}

const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
const exportButton = () => screen.getByTestId('export-submit') as HTMLButtonElement;
const lastFieldsFilters = () => getSobaExportFields.mock.calls.at(-1)?.[2];

describe('SubmissionExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSobaForm.mockResolvedValue({ id: 'f1', name: 'Housing Needs (sample)' });
    lookupFormVersions.mockResolvedValue({
      items: [
        { id: 'v1', versionNo: 1, state: 'archived' },
        { id: 'v2', versionNo: 2, state: 'published' },
      ],
    });
    getSobaExportFields.mockResolvedValue({ fields: FIELDS, lastExportedAt: null });
    exportSobaSubmissions.mockResolvedValue({
      blob: new Blob(['"a"\n"b"'], { type: 'text/csv' }),
      filename: 'housing_needs_sample_submissions.csv',
    });
  });

  it('starts as CSV, all versions, since my last export, without drafts', async () => {
    await openExport();

    expect(radio('CSV').checked).toBe(true);
    expect(radio('Since my last export').checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Include drafts' })).not.toBeChecked();
    expect(screen.getByTestId('export-version')).toHaveTextContent('All versions');
    await screen.findByTestId('export-last-exported');
    expect(screen.getByTestId('export-last-exported')).toHaveTextContent(
      'You have not exported this form before',
    );
    expect(lastFieldsFilters()).toEqual({
      formVersionId: undefined,
      dateMode: 'sinceLastExport',
      from: undefined,
      to: undefined,
      includeDrafts: false,
      template: 'multiRowEmptySpacesCSVExport',
    });
  });

  it('hides the CSV layout and field list for JSON', async () => {
    await openExport();
    await screen.findByTestId('export-fields');

    await act(async () => {
      fireEvent.click(radio('JSON'));
    });

    expect(screen.queryByTestId('export-layout')).toBeNull();
    expect(screen.queryByTestId('export-fields')).toBeNull();
  });

  it('hides the field list for the unformatted layout, which writes every field', async () => {
    await openExport();
    await screen.findByTestId('export-fields');

    await act(async () => {
      fireEvent.click(radio('4 - Unformatted'));
    });

    expect(screen.queryByTestId('export-fields')).toBeNull();
  });

  it('exports only the ticked fields and saves the CSV with a byte-order mark', async () => {
    await openExport();
    await screen.findByTestId('export-fields');

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Search fields' }), {
        target: { value: 'mail' },
      });
    });
    expect(screen.queryByRole('checkbox', { name: 'name' })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'email' }));
    });
    expect(screen.getByTestId('export-fields-count')).toHaveTextContent('3 of 4 fields selected');

    await act(async () => {
      fireEvent.click(exportButton());
    });

    await waitFor(() => expect(mockSaveBlob).toHaveBeenCalled());
    expect(exportSobaSubmissions).toHaveBeenCalledWith(
      'token',
      'f1',
      expect.objectContaining({
        format: 'csv',
        fields: ['form.submissionId', 'form.version', 'name'],
        dateMode: 'sinceLastExport',
      }),
    );
    const [saved, filename] = mockSaveBlob.mock.calls[0];
    expect(filename).toBe('housing_needs_sample_submissions.csv');
    // jsdom's Blob has no arrayBuffer(); FileReader reads its bytes.
    const buffer = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(saved as Blob);
    });
    const bytes = new Uint8Array(buffer);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('waits for both dates before reading or exporting a date range', async () => {
    await openExport();
    await screen.findByTestId('export-fields');
    const reads = getSobaExportFields.mock.calls.length;

    await act(async () => {
      fireEvent.click(radio('Date range'));
    });

    expect(screen.getByTestId('export-range')).toBeTruthy();
    expect(exportButton()).toBeDisabled();
    expect(getSobaExportFields.mock.calls).toHaveLength(reads);
  });

  it('includes drafts when ticked', async () => {
    await openExport();

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Include drafts' }));
    });

    await waitFor(() => expect(lastFieldsFilters()).toMatchObject({ includeDrafts: true }));
  });

  it('says so, and cannot export, when no submission matches', async () => {
    getSobaExportFields.mockResolvedValue({
      fields: [],
      lastExportedAt: '2026-10-01T00:00:00.000Z',
    });
    await openExport();

    await screen.findByTestId('export-no-submissions');
    expect(screen.getByTestId('export-last-exported')).toHaveTextContent(
      'Your last export included submissions up to',
    );
    expect(exportButton()).toBeDisabled();
  });

  it('shows a failed field read', async () => {
    getSobaExportFields.mockRejectedValue(new ApiError('boom', 500));
    await openExport();

    expect(await screen.findByTestId('export-fields-loaderror')).toHaveTextContent(
      'Could not load the export columns.',
    );
  });

  it('shows a refused field read as no access', async () => {
    getSobaExportFields.mockRejectedValue(new ApiError('nope', 403));
    await openExport();

    expect(await screen.findByTestId('export-fields-loaderror')).toHaveTextContent(
      'You do not have access',
    );
  });

  it('keeps the choices after a failed export', async () => {
    exportSobaSubmissions.mockRejectedValue(new ApiError('boom', 500));
    await openExport();
    await screen.findByTestId('export-fields');
    await act(async () => {
      fireEvent.click(radio('JSON'));
    });

    await act(async () => {
      fireEvent.click(exportButton());
    });

    await waitFor(() => expect(exportButton()).not.toBeDisabled());
    expect(mockSaveBlob).not.toHaveBeenCalled();
    expect(radio('JSON').checked).toBe(true);
  });

  it('shows a failed form read', async () => {
    getSobaForm.mockRejectedValue(new ApiError('boom', 500));
    await renderExport();

    expect(await screen.findByTestId('export-form-loaderror')).toHaveTextContent(
      'Could not load the form.',
    );
  });

  it('goes back to the submissions tab', async () => {
    await openExport();

    await act(async () => {
      fireEvent.click(screen.getByTestId('export-back'));
    });

    expect(mockPush).toHaveBeenCalledWith('/en/build/f1?tab=submissions');
  });
});
