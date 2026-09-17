import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const { mockGetSubmissions, mockPush, dict } = vi.hoisted(() => ({
  mockGetSubmissions: vi.fn(),
  mockPush: vi.fn(),
  dict: {
    locale: 'en',
    general: {
      loading: 'Loading...',
      version: 'Version',
      sortBy: 'Sort by',
      sessionExpired: 'Your session has ended.',
      noAccess: 'You do not have access to this.',
    },
    dataTable: { itemName: 'items', pageOf: 'of {totalPages} page(s)' },
    modal: { close: 'Close' },
    form: { status: 'Status' },
    workspaces: { cancel: 'Cancel' },
    submission: {
      confirmationId: 'Confirmation ID',
      submitter: 'Submitter',
      anon: 'Anonymous',
      submittedAt: 'Submission Date',
      actions: 'Actions',
      view: 'View',
      delete: 'Delete',
      emptyList: 'No submissions',
      submissions: 'Submissions',
      error: 'Could not load submissions.',
    },
  },
}));

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaSubmissions: (...args: unknown[]) => mockGetSubmissions(...args),
  deleteSobaSubmission: vi.fn(),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => dict,
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<unknown>('next/navigation');
  return {
    ...(actual as Record<string, unknown>),
    useRouter: () => ({ push: mockPush, replace: vi.fn() }),
    usePathname: () => '/en/build/f1',
    useSearchParams: () => new URLSearchParams(''),
  };
});

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import FormSubmissionTab from '@/src/features/designer/ui/FormSubmissionTab';
import type { Dictionary } from '@/src/types/dictionary';

describe('FormSubmissionTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubmissions.mockResolvedValue({
      items: [
        {
          id: 'sub-1',
          formId: 'f1',
          formVersionId: 'v1',
          versionNo: 1,
          workflowState: 'submitted',
          engineSyncStatus: 'ready',
          submittedAt: '2026-01-02T03:04:05.000Z',
          createdAt: '2026-01-02T03:04:05.000Z',
          updatedAt: '2026-01-02T03:04:05.000Z',
          createdBy: 'Ada Lovelace',
        },
      ],
      page: { offset: 0, limit: 10, total: 1 },
    });
  });

  it('opens a submission on the staff submission page', async () => {
    const store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));

    await act(async () => {
      render(
        <Provider store={store}>
          <SWRConfig
            value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
          >
            <FormSubmissionTab dict={dict as unknown as Dictionary} formId="f1" opened />
          </SWRConfig>
        </Provider>,
      );
    });

    const view = await waitFor(() => screen.getByTestId('sub-1-view-link'));
    await act(async () => {
      fireEvent.click(view);
    });

    expect(mockPush).toHaveBeenCalledWith('/en/build/f1/submissions/sub-1');
  });
});
