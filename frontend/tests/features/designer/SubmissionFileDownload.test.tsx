import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const { mockSaveBlob } = vi.hoisted(() => ({ mockSaveBlob: vi.fn() }));

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

vi.mock('@/src/shared/util/saveBlob', () => ({
  saveBlob: (...args: unknown[]) => mockSaveBlob(...args),
}));

const downloadSobaSubmissionFile = vi.fn();

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: vi.fn(),
  lookupFormVersions: vi.fn(),
  getSobaExportFields: vi.fn(),
  exportSobaSubmissions: vi.fn(),
  downloadSobaSubmissionFile: (...args: unknown[]) => downloadSobaSubmissionFile(...args),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { SubmissionFileDownload } from '@/src/features/designer/ui/SubmissionFileDownload';

async function renderDownload() {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  await act(async () => {
    render(
      <Provider store={store}>
        <SWRConfig
          value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
        >
          <SubmissionFileDownload submissionId="s1" fileId="file-9" />
        </SWRConfig>
      </Provider>,
    );
  });
}

describe('SubmissionFileDownload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves the file once it is read, and again on request', async () => {
    const file = { blob: new Blob(['pdf']), filename: 'plan.pdf' };
    downloadSobaSubmissionFile.mockResolvedValue(file);

    await renderDownload();

    expect(await screen.findByTestId('submission-file-saved')).toHaveTextContent(
      'plan.pdf has been downloaded.',
    );
    expect(downloadSobaSubmissionFile).toHaveBeenCalledWith('token', 's1', 'file-9');
    expect(mockSaveBlob).toHaveBeenCalledTimes(1);
    expect(mockSaveBlob).toHaveBeenCalledWith(file.blob, 'plan.pdf');

    await act(async () => {
      fireEvent.click(screen.getByTestId('submission-file-again'));
    });
    expect(mockSaveBlob).toHaveBeenCalledTimes(2);
  });

  it('shows a refused read as no access, and saves nothing', async () => {
    downloadSobaSubmissionFile.mockRejectedValue(new ApiError('nope', 403));

    await renderDownload();

    await waitFor(() =>
      expect(screen.getByTestId('submission-file-loaderror')).toHaveTextContent(
        'You do not have access',
      ),
    );
    expect(mockSaveBlob).not.toHaveBeenCalled();
  });

  it('shows a file that is gone as a failed download', async () => {
    downloadSobaSubmissionFile.mockRejectedValue(new ApiError('gone', 500));

    await renderDownload();

    expect(await screen.findByTestId('submission-file-loaderror')).toHaveTextContent(
      'Could not download this file.',
    );
  });
});
