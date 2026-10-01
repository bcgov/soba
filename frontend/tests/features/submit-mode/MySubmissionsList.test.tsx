import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { kc, search } = vi.hoisted(() => ({
  kc: { authenticated: true, initializing: false },
  search: { value: '' },
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ ...kc, token: 'token' }),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    locale: 'en',
    general: {
      notAuthenticated: 'Not authed',
      sessionExpired: 'Your session has ended.',
      noAccess: 'No access.',
      loading: 'Loading…',
      search: 'Search',
      cancel: 'Cancel',
      clearFilters: 'Reset Filters',
      mySubmissions: 'My Submissions',
    },
    mySubmissions: {
      columns: {
        form: 'Form',
        status: 'Status',
        confirmationId: 'Confirmation ID',
        updatedAt: 'Last updated',
        actions: 'Actions',
      },
      states: { draft: 'Draft', submitted: 'Submitted' },
      statusFilter: 'Status',
      allStates: 'All',
      continue: 'Continue',
      view: 'View',
      delete: 'Delete',
      continueLabel: 'Continue {form}, last updated {updated}',
      viewLabel: 'View {form}, last updated {updated}',
      deleteLabel: 'Delete draft of {form}, last updated {updated}',
      empty: 'You have no submissions yet.',
      noMatches: 'No submissions match your search or filter.',
      loadError: 'Could not load your submissions.',
      itemName: 'submissions',
      deleteTitle: 'Delete draft',
      deleteMessage: 'Your draft of {form}, last updated {updated}, will be deleted.',
      deleteSuccess: 'Draft deleted.',
      deleteError: 'Could not delete this draft.',
      deleteSubmitted: 'This draft has been submitted and can no longer be deleted.',
      viewAll: 'View my submissions',
      noCode: 'No confirmation ID yet',
    },
    dataTable: { itemName: 'items', pageOf: 'of {totalPages} page(s)' },
    modal: { dialogActions: 'Dialog actions' },
  }),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<unknown>('next/navigation');
  return {
    ...(actual as Record<string, unknown>),
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/en/my-submissions',
    useSearchParams: () => new URLSearchParams(search.value),
  };
});

const getMySubmissions = vi.fn();
const deleteSubmitSubmission = vi.fn();
vi.mock('@/src/shared/api/sobaApi', () => ({
  getMySubmissions: (...args: unknown[]) => getMySubmissions(...args),
  deleteSubmitSubmission: (...args: unknown[]) => deleteSubmitSubmission(...args),
}));

const addNotification = vi.fn();
vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification }),
}));

import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { SessionExpiredError } from '@/src/shared/api/sobaFetch';
import { MySubmissionsList } from '@/src/features/submit-mode/ui/MySubmissionsList';

const DRAFT = {
  id: 's1',
  formId: 'f1',
  formName: 'Permit application',
  workflowState: 'draft',
  role: 'owner',
  submittedAt: null,
  createdAt: '2026-09-01T18:00:00.000Z',
  updatedAt: '2026-09-02T18:30:00.000Z',
  confirmationCode: null,
};
const SUBMITTED = {
  id: 's2',
  formId: 'f2',
  formName: 'Grant report',
  workflowState: 'submitted',
  role: 'owner',
  submittedAt: '2026-09-03T18:00:00.000Z',
  createdAt: '2026-09-01T18:00:00.000Z',
  updatedAt: '2026-09-03T18:00:00.000Z',
  confirmationCode: 'K7M2Q9XA',
};
const SHARED_DRAFT = { ...DRAFT, id: 's3', role: 'collaborator' };

const DRAFT_UPDATED = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(DRAFT.updatedAt));

const page = (items: unknown[]) => ({
  items,
  page: { offset: 0, limit: 10, total: items.length },
  filters: {},
  sort: 'updatedAt:desc',
});

let store: ReturnType<typeof makeStore>;
let replaceState: ReturnType<typeof vi.spyOn>;

function listTree() {
  return (
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <MySubmissionsList />
      </SWRConfig>
    </Provider>
  );
}

async function renderList() {
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(listTree());
  });
  return view!;
}

/** Next keeps useSearchParams in sync with replaceState; the mock does not, so the test does. */
async function syncUrl(view: ReturnType<typeof render>) {
  const url = replaceState.mock.calls.at(-1)?.[2];
  search.value = typeof url === 'string' ? (url.split('?')[1] ?? '') : '';
  await act(async () => {
    view.rerender(listTree());
  });
}

const lastRequest = () => getMySubmissions.mock.calls.at(-1)?.[1];

/** Holds a delete open until the test settles it. */
function deferredDelete() {
  let settle!: () => void;
  deleteSubmitSubmission.mockReturnValue(
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );
  return () => settle();
}

describe('MySubmissionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    search.value = '';
    kc.authenticated = true;
    kc.initializing = false;
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
    getMySubmissions.mockResolvedValue(page([DRAFT, SUBMITTED]));
    deleteSubmitSubmission.mockResolvedValue(undefined);
    replaceState = vi.spyOn(window.history, 'replaceState');
  });

  afterEach(() => {
    replaceState.mockRestore();
  });

  it('reads the latest activity first, with no state filter', async () => {
    await renderList();
    expect(lastRequest()).toMatchObject({ offset: 0, limit: 10, sort: 'updatedAt:desc' });
    expect(lastRequest().workflowState).toBeUndefined();
  });

  it('shows each state in words, and a code only once submitted', async () => {
    await renderList();
    expect(await screen.findByTestId('s1-status')).toHaveTextContent('Draft');
    expect(screen.getByTestId('s2-status')).toHaveTextContent('Submitted');
    expect(screen.getByTestId('s1-confirmation-id')).toHaveTextContent('No confirmation ID yet');
    expect(screen.getByTestId('s2-confirmation-id')).toHaveTextContent('K7M2Q9XA');
  });

  it('shows the time of the last update, so same-day rows differ', async () => {
    await renderList();
    expect(await screen.findByTestId('s1-updated-date')).toHaveTextContent(DRAFT_UPDATED);
  });

  it('names the row in each action, with its last update', async () => {
    await renderList();
    expect(await screen.findByTestId('s1-continue')).toHaveAccessibleName(
      `Continue Permit application, last updated ${DRAFT_UPDATED}`,
    );
    expect(screen.getByTestId('s1-delete')).toHaveAccessibleName(
      `Delete draft of Permit application, last updated ${DRAFT_UPDATED}`,
    );
    expect(screen.getByTestId('s2-view')).toHaveAccessibleName(
      expect.stringMatching(/^View Grant report, last updated /),
    );
  });

  it('keeps `$` in a form name literal', async () => {
    getMySubmissions.mockResolvedValue(page([{ ...DRAFT, formName: 'Fees $& $$ form' }]));
    await renderList();
    expect(await screen.findByTestId('s1-continue')).toHaveAccessibleName(
      `Continue Fees $& $$ form, last updated ${DRAFT_UPDATED}`,
    );
  });

  it('continues a draft in the fill page and views a submitted one read-only', async () => {
    await renderList();
    await userEvent.click(await screen.findByTestId('s1-continue'));
    expect(mockPush).toHaveBeenCalledWith('/en/submit/s1');
    await userEvent.click(screen.getByTestId('s2-view'));
    expect(mockPush).toHaveBeenCalledWith('/en/submission/s2');
    await userEvent.click(screen.getByTestId('my-submission-link-s2'));
    expect(mockPush).toHaveBeenLastCalledWith('/en/submission/s2');
  });

  it('offers delete on an owned draft only', async () => {
    getMySubmissions.mockResolvedValue(page([DRAFT, SUBMITTED, SHARED_DRAFT]));
    await renderList();
    expect(await screen.findByTestId('s1-delete')).toBeInTheDocument();
    expect(screen.queryByTestId('s1-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('s2-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('s2-continue')).not.toBeInTheDocument();
    expect(screen.getByTestId('s3-continue')).toBeInTheDocument();
    expect(screen.queryByTestId('s3-delete')).not.toBeInTheDocument();
  });

  it.each([
    ['mySubmissions.state=draft', 'draft'],
    ['mySubmissions.state=submitted', 'submitted'],
  ])('reads the state filter from %s', async (query, expected) => {
    search.value = query;
    await renderList();
    expect(lastRequest().workflowState).toBe(expected);
  });

  it('drops a state the API would refuse from the URL', async () => {
    search.value = 'mySubmissions.state=opened';
    await renderList();
    expect(lastRequest().workflowState).toBeUndefined();
    await waitFor(() => expect(replaceState).toHaveBeenCalled());
    expect(String(replaceState.mock.calls.at(-1)?.[2])).not.toContain('mySubmissions.state');
  });

  it('reads again when the status filter changes', async () => {
    const view = await renderList();
    await screen.findByTestId('s1-status');

    const picker = screen.getByTestId('my-submissions-state-select').querySelector('select')!;
    await act(async () => {
      fireEvent.change(picker, { target: { value: 'submitted' } });
    });
    await waitFor(() => expect(replaceState).toHaveBeenCalled());
    expect(String(replaceState.mock.calls.at(-1)?.[2])).toContain('mySubmissions.state=submitted');

    await syncUrl(view);
    await waitFor(() => expect(lastRequest().workflowState).toBe('submitted'));
  });

  it('resets the filter and the search together', async () => {
    search.value = 'mySubmissions.state=draft&mySubmissions.q=tax';
    await renderList();
    await userEvent.click(screen.getByTestId('my-submissions-clear-filters'));
    await waitFor(() => expect(replaceState).toHaveBeenCalled());
    const url = String(replaceState.mock.calls.at(-1)?.[2]);
    expect(url).not.toContain('mySubmissions.state');
    expect(url).not.toContain('mySubmissions.q');
  });

  it('says there is nothing yet when the unfiltered list is empty', async () => {
    getMySubmissions.mockResolvedValue(page([]));
    await renderList();
    expect(await screen.findByTestId('datatable-empty')).toHaveTextContent(
      'You have no submissions yet.',
    );
  });

  it('says nothing matched when a search or filter is applied', async () => {
    getMySubmissions.mockResolvedValue(page([]));
    search.value = 'mySubmissions.q=tax';
    await renderList();
    expect(await screen.findByTestId('datatable-empty')).toHaveTextContent(
      'No submissions match your search or filter.',
    );
  });

  it('deletes a draft after confirmation and re-reads the list', async () => {
    await renderList();
    await userEvent.click(await screen.findByTestId('s1-delete'));
    expect(screen.getByTestId('confirm-modal-message')).toHaveTextContent(
      `Your draft of Permit application, last updated ${DRAFT_UPDATED}, will be deleted.`,
    );

    getMySubmissions.mockResolvedValue(page([SUBMITTED]));
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));

    expect(deleteSubmitSubmission).toHaveBeenCalledWith('token', 's1');
    await waitFor(() =>
      expect(addNotification).toHaveBeenCalledWith({ text: 'Draft deleted.', type: 'success' }),
    );
    await waitFor(() => expect(screen.queryByTestId('s1-status')).not.toBeInTheDocument());
    expect(screen.queryByTestId('confirm-modal-message')).not.toBeInTheDocument();
  });

  it('holds the dialog open, with confirm disabled, until the delete settles', async () => {
    const settle = deferredDelete();
    await renderList();
    await userEvent.click(await screen.findByTestId('s1-delete'));
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));

    expect(screen.getByTestId('confirm-modal-confirm')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('confirm-modal-message')).toBeInTheDocument();

    await act(async () => settle());
    await waitFor(() =>
      expect(screen.queryByTestId('confirm-modal-message')).not.toBeInTheDocument(),
    );
  });

  it.each([
    [
      'a draft submitted elsewhere',
      new ApiError('Submission is submitted', 409),
      'This draft has been submitted and can no longer be deleted.',
    ],
    ['an ended session', new SessionExpiredError(), 'Your session has ended.'],
    ['any other failure', new Error('boom'), 'Could not delete this draft.'],
  ])('reports %s and still re-reads the list', async (_label, refused, text) => {
    deleteSubmitSubmission.mockRejectedValue(refused);
    await renderList();
    await userEvent.click(await screen.findByTestId('s1-delete'));
    const calls = getMySubmissions.mock.calls.length;
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() =>
      expect(addNotification).toHaveBeenCalledWith({ text, type: 'error', consoleError: refused }),
    );
    expect(getMySubmissions.mock.calls.length).toBeGreaterThan(calls);
  });

  it('does not delete when the confirmation is cancelled', async () => {
    await renderList();
    await userEvent.click(await screen.findByTestId('s1-delete'));
    await userEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(deleteSubmitSubmission).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in', async () => {
    kc.authenticated = false;
    await renderList();
    expect(screen.getByText('Not authed')).toBeInTheDocument();
    expect(within(document.body).queryByRole('table')).not.toBeInTheDocument();
  });
});
