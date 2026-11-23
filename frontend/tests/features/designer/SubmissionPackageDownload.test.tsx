import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

const { mockDownload, mockSave } = vi.hoisted(() => ({ mockDownload: vi.fn(), mockSave: vi.fn() }));

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/build/f1/submissions/sub-1/packages/job-1',
}));

vi.mock('@/src/shared/api/sobaApi', () => ({
  downloadSobaSubmissionPackage: (...args: unknown[]) => mockDownload(...args),
}));

vi.mock('@/src/shared/util/saveBlob', () => ({
  saveBlob: (...args: unknown[]) => mockSave(...args),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { SubmissionPackageDownload } from '@/src/features/designer/ui/SubmissionPackageDownload';

async function renderDownload() {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  await act(async () => {
    render(
      <Provider store={store}>
        <SubmissionPackageDownload formId="f1" submissionId="sub-1" jobId="job-1" />
      </Provider>,
    );
  });
}

const expectBackToSubmission = () =>
  expect(screen.getByTestId('submission-package-back')).toHaveAttribute(
    'href',
    '/en/build/f1/submissions/sub-1',
  );

describe('SubmissionPackageDownload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves the package for staff and links back to the submission', async () => {
    const blob = new Blob(['PK']);
    mockDownload.mockResolvedValue({ blob, filename: 'Permit ABC123.zip' });
    await renderDownload();

    expect(await screen.findByTestId('file-download-saved')).toHaveTextContent('Permit ABC123.zip');
    expect(mockDownload).toHaveBeenCalledWith('token', 'sub-1', 'job-1');
    expect(mockSave.mock.calls).toEqual([[blob, 'Permit ABC123.zip']]);
    expect(screen.getByTestId('file-download-package-id')).toHaveTextContent('job-1');
    expect(screen.getByTestId('file-download-submission-id')).toHaveTextContent('sub-1');
    expectBackToSubmission();
  });

  // file_not_found: the package expired or is not this submission's; route_not_found: packages are
  // off for the form.
  it.each(['file_not_found', 'route_not_found'] as const)(
    'says the package is no longer available on a 404 with %s, and links back to the submission',
    async (code) => {
      mockDownload.mockRejectedValue(new ApiError('gone', 404, code));
      await renderDownload();

      expect(await screen.findByTestId('file-download-notfound')).toHaveTextContent(
        'This package is no longer available.',
      );
      expect(screen.getByTestId('file-download-package-id')).toHaveTextContent('job-1');
      expect(mockSave).not.toHaveBeenCalled();
      expectBackToSubmission();
    },
  );
});
