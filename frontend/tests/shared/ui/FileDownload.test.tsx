import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

const { mockSaveBlob } = vi.hoisted(() => ({ mockSaveBlob: vi.fn() }));

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

vi.mock('@/src/shared/util/saveBlob', () => ({
  saveBlob: (...args: unknown[]) => mockSaveBlob(...args),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { FileDownload } from '@/src/shared/ui/FileDownload';

const load = vi.fn();

async function renderDownload() {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  await act(async () => {
    render(
      <Provider store={store}>
        <FileDownload load={load} />
      </Provider>,
    );
  });
}

describe('FileDownload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves the file once it is read, and again on request', async () => {
    const file = { blob: new Blob(['pdf']), filename: 'plan.pdf' };
    load.mockResolvedValue(file);

    await renderDownload();

    expect(await screen.findByTestId('file-download-saved')).toHaveTextContent(
      'plan.pdf has been downloaded.',
    );
    expect(load).toHaveBeenCalledWith('token');
    expect(mockSaveBlob).toHaveBeenCalledTimes(1);
    expect(mockSaveBlob).toHaveBeenCalledWith(file.blob, 'plan.pdf');

    await act(async () => {
      fireEvent.click(screen.getByTestId('file-download-again'));
    });
    expect(mockSaveBlob).toHaveBeenCalledTimes(2);
  });

  it('shows a refused read as no access, and saves nothing', async () => {
    load.mockRejectedValue(new ApiError('nope', 403));

    await renderDownload();

    expect(await screen.findByTestId('file-download-loaderror')).toHaveTextContent(
      'You do not have access',
    );
    expect(mockSaveBlob).not.toHaveBeenCalled();
  });

  it('shows a file that is gone as a failed download', async () => {
    load.mockRejectedValue(new ApiError('gone', 500));

    await renderDownload();

    expect(await screen.findByTestId('file-download-loaderror')).toHaveTextContent(
      'Could not download this file.',
    );
    expect(mockSaveBlob).not.toHaveBeenCalled();
  });
});
