import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    locale: 'en',
    general: {
      loading: 'Loading...',
      sessionExpired: 'Your session has ended.',
      noAccess: 'You do not have access to this.',
    },
    form: { nameLabel: 'Form' },
    submission: {
      notFound: 'Submission not found.',
      loadError: 'Could not load this submission.',
      noContent: 'No submitted answers to display.',
      submittedOn: 'Submitted',
      confirmationId: 'Confirmation ID',
      submitter: 'Submitter',
      anon: 'Anonymous',
      backToSubmissions: 'Back to submissions',
    },
  }),
}));

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
vi.mock('@/src/shared/api/sobaApi', () => ({
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
    });
    getFormVersionSchema.mockResolvedValue({ components: [] });
    getSobaSubmissionData.mockResolvedValue({ data: { field: 'value' } });
  });

  it('reads the submission, its version schema and its answers through the design API', async () => {
    signIn();
    await renderView();

    await waitFor(() => expect(screen.getByTestId('submission-view-form')).toBeInTheDocument());
    expect(getSobaSubmission).toHaveBeenCalledWith('token', 'sub-1');
    expect(getFormVersionSchema).toHaveBeenCalledWith('token', 'v3');
    expect(getSobaSubmissionData).toHaveBeenCalledWith('token', 'sub-1');
    expect(screen.getByTestId('submission-view-header')).toHaveTextContent(
      'Confirmation ID: 01a0a276',
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
});
