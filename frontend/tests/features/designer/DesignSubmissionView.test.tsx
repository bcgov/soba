import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/build/f1/submissions/sub-1',
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/src/features/formio-v5/ui/ReadOnlyFormView', () => ({
  ReadOnlyFormView: () => <div data-testid="submission-view-form">rendered</div>,
}));

const getSobaSubmission = vi.fn();
const getSobaSubmissionData = vi.fn();
const getFormVersionSchema = vi.fn();
const deleteSobaSubmission = vi.fn();
const getSobaSubmissionReview = vi.fn();
const addSobaSubmissionNote = vi.fn();
const recordSobaSubmissionEdit = vi.fn();

const SUBMISSION_ID = '01a0a276-8dee-71e4-8951-5effdc491be0';
const REVIEW = {
  assignees: ['Grace Hopper'],
  statusHistory: [
    {
      id: 's1',
      status: 'SUBMITTED',
      assignee: null,
      changedAt: '2026-01-02T03:04:05Z',
      updatedBy: 'Ada Lovelace',
    },
  ],
  notes: [],
  editHistory: [],
};
vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaSubmissionReview: (...args: unknown[]) => getSobaSubmissionReview(...args),
  addSobaSubmissionNote: (...args: unknown[]) => addSobaSubmissionNote(...args),
  recordSobaSubmissionEdit: (...args: unknown[]) => recordSobaSubmissionEdit(...args),
  updateSobaSubmissionStatus: vi.fn(),
  fetchCurrentUser: async () => ({ actor: { displayLabel: 'Rev Iewer' } }),
  deleteSobaSubmission: (...args: unknown[]) => deleteSobaSubmission(...args),
  getSobaSubmission: (...args: unknown[]) => getSobaSubmission(...args),
  getSobaSubmissionData: (...args: unknown[]) => getSobaSubmissionData(...args),
  getFormVersionSchema: (...args: unknown[]) => getFormVersionSchema(...args),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { DesignSubmissionView } from '@/src/features/designer/ui/DesignSubmissionView';

let store: ReturnType<typeof makeStore>;

function signIn() {
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
}

async function renderView() {
  await act(async () => {
    render(
      <Provider store={store}>
        <SWRConfig
          value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
        >
          <DesignSubmissionView formId="f1" submissionId="sub-1" />
        </SWRConfig>
      </Provider>,
    );
  });
}

describe('DesignSubmissionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    getSobaSubmission.mockResolvedValue({
      id: '01a0a276-8dee-71e4-8951-5effdc491be0',
      formId: 'f1',
      formName: 'Form One',
      formVersionId: 'v3',
      versionNo: 3,
      workflowState: 'submitted',
      submittedAt: new Date('2026-01-02T03:04:05Z').toISOString(),
      createdBy: 'Ada Lovelace',
      confirmationCode: 'K7M2Q9XA',
    });
    getFormVersionSchema.mockResolvedValue({ components: [] });
    getSobaSubmissionData.mockResolvedValue({ data: { field: 'value' } });
    getSobaSubmissionReview.mockResolvedValue(REVIEW);
  });

  it('reads the submission, its version schema and its answers through the design API', async () => {
    signIn();
    await renderView();

    await waitFor(() => expect(screen.getByTestId('submission-view-form')).toBeInTheDocument());
    expect(getSobaSubmission).toHaveBeenCalledWith('token', 'sub-1');
    expect(getFormVersionSchema).toHaveBeenCalledWith('token', 'v3');
    expect(getSobaSubmissionData).toHaveBeenCalledWith('token', 'sub-1');
    expect(screen.getByTestId('submission-view-confirmation')).toHaveTextContent(
      'Confirmation ID: K7M2Q9XA',
    );
    expect(screen.getByTestId('submission-view-submitter')).toHaveTextContent('Ada Lovelace');
  });

  it('reads nothing until the session is ready', async () => {
    await renderView();

    expect(getSobaSubmission).not.toHaveBeenCalled();
    expect(screen.queryByTestId('submission-view-notfound')).not.toBeInTheDocument();
  });

  it('shows an anonymous submitter as anonymous', async () => {
    signIn();
    getSobaSubmission.mockResolvedValue({
      id: 'sub-1',
      formId: 'f1',
      formVersionId: 'v3',
      workflowState: 'draft',
      createdBy: null,
    });
    await renderView();

    await waitFor(() =>
      expect(screen.getByTestId('submission-view-submitter')).toHaveTextContent('Anonymous'),
    );
  });

  it('goes back to the form submissions tab', async () => {
    signIn();
    await renderView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('design-submission-back'));
    });

    expect(mockPush).toHaveBeenCalledWith('/en/build/f1?tab=submissions');
  });

  it('says there are no answers when the submission has no engine document', async () => {
    signIn();
    getSobaSubmissionData.mockResolvedValue(null);
    await renderView();

    await waitFor(() =>
      expect(screen.getByTestId('submission-view-nocontent')).toBeInTheDocument(),
    );
  });

  it('says not found for a submission that belongs to another form', async () => {
    signIn();
    getSobaSubmission.mockResolvedValue({
      id: 'sub-1',
      formId: 'other-form',
      formVersionId: 'v3',
      workflowState: 'submitted',
    });
    await renderView();

    await waitFor(() => expect(screen.getByTestId('submission-view-notfound')).toBeInTheDocument());
    expect(screen.queryByTestId('submission-view-form')).not.toBeInTheDocument();
  });

  it('says not found when the submission does not exist', async () => {
    signIn();
    getSobaSubmission.mockRejectedValue(new ApiError('Submission not found', 404));
    await renderView();

    await waitFor(() => expect(screen.getByTestId('submission-view-notfound')).toBeInTheDocument());
  });

  it('reports a server failure as a failed load, not a missing submission', async () => {
    signIn();
    getFormVersionSchema.mockRejectedValue(new ApiError('Request failed (500)', 500));
    await renderView();

    await waitFor(() =>
      expect(screen.getByTestId('submission-view-loaderror')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('submission-view-notfound')).not.toBeInTheDocument();
  });

  it('distinguishes a refused read from a missing submission', async () => {
    signIn();
    getSobaSubmission.mockRejectedValue(new ApiError('Forbidden', 403));
    await renderView();

    await waitFor(() => expect(screen.getByTestId('submission-view-noaccess')).toBeInTheDocument());
  });

  it('distinguishes an ended session from a missing submission', async () => {
    signIn();
    const expired = new Error('Session expired');
    expired.name = 'SessionExpiredError';
    getSobaSubmission.mockRejectedValue(expired);
    await renderView();

    await waitFor(() =>
      expect(screen.getByTestId('submission-view-session-expired')).toBeInTheDocument(),
    );
  });

  it('adds a note and lists it under the reviewer', async () => {
    signIn();
    addSobaSubmissionNote.mockResolvedValue({
      ...REVIEW,
      notes: [
        {
          id: 'n1',
          text: 'Needs a second look',
          createdAt: '2026-01-03T03:04:05Z',
          createdBy: 'Rev Iewer',
        },
      ],
    });
    await renderView();
    // The test id lands on the design-system wrapper, so the field is found by its label.
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Note' })).toBeInTheDocument());

    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), {
      target: { value: 'Needs a second look' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('submission-note-add'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('submission-notes-list')).toHaveTextContent('Needs a second look'),
    );
    expect(addSobaSubmissionNote).toHaveBeenCalledWith(
      'token',
      SUBMISSION_ID,
      'Needs a second look',
    );
    expect(screen.getByTestId('submission-notes-list')).toHaveTextContent('Rev Iewer');
  });

  it('starts a submission as submitted and unassigned', async () => {
    signIn();
    await renderView();

    await waitFor(() =>
      expect(screen.getByTestId('submission-status-current')).toHaveTextContent(
        'Current Status: Submitted',
      ),
    );
    expect(screen.getByTestId('submission-status-assignee')).toHaveTextContent('Unassigned');
    expect(screen.getByTestId('submission-status-update')).toBeDisabled();
  });

  it('records an edit of the answers once the change is confirmed', async () => {
    signIn();
    recordSobaSubmissionEdit.mockResolvedValue({
      ...REVIEW,
      editHistory: [{ id: 'e1', editedAt: '2026-01-03T03:04:05Z', editedBy: 'Rev Iewer' }],
    });
    await renderView();
    await waitFor(() => expect(screen.getByTestId('submission-data-update')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('submission-data-update'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('submission-view-modified-by')).toHaveTextContent('Rev Iewer'),
    );
  });

  it('deletes the submission and returns to the submissions tab', async () => {
    signIn();
    deleteSobaSubmission.mockResolvedValue(undefined);
    await renderView();
    await waitFor(() => expect(screen.getByTestId('submission-review-delete')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('submission-review-delete'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    });

    await waitFor(() => expect(deleteSobaSubmission).toHaveBeenCalledWith('token', SUBMISSION_ID));
    expect(mockPush).toHaveBeenCalledWith('/en/build/f1?tab=submissions');
  });
});
