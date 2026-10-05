import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const { mockGetSubmissions, mockDelete, mockPush, dict } = vi.hoisted(() => ({
  mockGetSubmissions: vi.fn(),
  mockDelete: vi.fn(),
  mockPush: vi.fn(),
  dict: {
    locale: 'en',
    general: {
      loading: 'Loading...',
      version: 'Version',
      sortBy: 'Sort by',
      sessionExpired: 'Your session has ended.',
      noAccess: 'You do not have access to this.',
      cancel: 'Cancel',
    },
    dataTable: { itemName: 'items', pageOf: 'of {totalPages} page(s)' },
    modal: { close: 'Close', dialogActions: 'Dialog actions' },
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
      deleteTitle: 'Delete submission',
      deleteMessage: 'Submission {confirmation} from {submitter} will be deleted.',
      deleteDraftMessage:
        'The unsubmitted submission from {submitter}, last updated {updated}, will be deleted.',
      deleteSuccess: 'Submission deleted.',
      deleteFailure: 'Could not delete the submission.',
      emptyList: 'No submissions',
      submissions: 'Submissions',
      error: 'Could not load submissions.',
    },
  },
}));

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaSubmissions: (...args: unknown[]) => mockGetSubmissions(...args),
  deleteSobaSubmission: (...args: unknown[]) => mockDelete(...args),
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
          confirmationCode: 'K7M2Q9XA',
        },
        {
          id: 'sub-2',
          formId: 'f1',
          formVersionId: 'v1',
          versionNo: 1,
          workflowState: 'draft',
          engineSyncStatus: 'ready',
          submittedAt: null,
          createdAt: '2026-01-02T03:04:05.000Z',
          updatedAt: '2026-01-02T03:04:05.000Z',
          createdBy: 'Ada Lovelace',
          confirmationCode: null,
        },
      ],
      page: { offset: 0, limit: 10, total: 2 },
    });
  });

  async function renderTab() {
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
  }

  it('shows the confirmation code of a submitted row and N/A for a draft', async () => {
    await renderTab();
    await waitFor(() => expect(screen.getByTestId('sub-1-confirmation-id')).toBeInTheDocument());
    expect(screen.getByTestId('sub-1-confirmation-id')).toHaveTextContent('K7M2Q9XA');
    expect(screen.getByTestId('sub-2-confirmation-id')).toHaveTextContent('N/A');
  });

  it('opens a submission on the staff submission page', async () => {
    await renderTab();

    const view = await waitFor(() => screen.getByTestId('sub-1-view-link'));
    await act(async () => {
      fireEvent.click(view);
    });

    expect(mockPush).toHaveBeenCalledWith('/en/build/f1/submissions/sub-1');
  });

  const openDelete = async (id: string) => {
    const link = await waitFor(() => screen.getByTestId(`${id}-delete-link`));
    await act(async () => {
      fireEvent.click(link);
    });
    return screen.findByTestId('confirm-modal-message');
  };

  it('names a submitted submission by its confirmation code before deleting', async () => {
    await renderTab();
    const message = await openDelete('sub-1');
    expect(message).toHaveTextContent('Submission K7M2Q9XA from Ada Lovelace will be deleted.');
  });

  it('names an unsubmitted one by its submitter and last change', async () => {
    await renderTab();
    const message = await openDelete('sub-2');
    expect(message).toHaveTextContent('The unsubmitted submission from Ada Lovelace, last updated');
  });

  it('deletes nothing when the delete is cancelled', async () => {
    await renderTab();
    await openDelete('sub-1');
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    });

    await waitFor(() => expect(screen.queryByTestId('confirm-modal-message')).toBeNull());
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes the submission once confirmed', async () => {
    mockDelete.mockResolvedValue(undefined);
    await renderTab();
    await openDelete('sub-1');
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    });

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('token', 'sub-1'));
    await waitFor(() => expect(screen.queryByTestId('confirm-modal-message')).toBeNull());
  });
});
