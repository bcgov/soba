import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  getSubmitFillBundle: vi.fn(),
  saveSobaFormSubmission: vi.fn(),
  submitSobaFormSubmission: vi.fn(),
  formData: {} as Record<string, unknown>,
  instance: {
    emit: vi.fn(),
    submit: vi.fn(),
    get submission() {
      return { data: h.formData };
    },
  },
  onSubmit: undefined as
    | undefined
    | ((submission: { data: Record<string, unknown> }) => Promise<void>),
  options: undefined as undefined | { readOnly?: boolean },
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: { sessionExpired: 'Your session has ended.', noAccess: 'You do not have access.' },
    submission: { notFound: 'Submission not found.', loadError: 'Could not load this submission.' },
    form: { loading: 'Loading...' },
    formioV5: {
      formRender: {
        loadError: 'Could not load the form.',
        rendererError: 'The form could not be displayed.',
        submitSuccess: 'Submitted.',
        missingId: 'Missing submission id.',
        readOnly: 'You can view this submission only.',
        saveDraft: 'Save draft',
        savingDraft: 'Saving draft...',
        draftSaved: 'Draft saved.',
        heldSave: 'Changed elsewhere; draft not saved.',
        heldSubmit: 'Changed elsewhere; not submitted.',
        reloadLatest: 'Reload latest version',
        saveMine: 'Save my version',
        submitMine: 'Submit my version',
        alreadySubmitted: 'Already submitted.',
      },
    },
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ submissionId: 'sub-1' }),
  useRouter: () => ({ replace: h.replace, push: h.push }),
  usePathname: () => '/en/submit/sub-1',
}));

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSubmitFillBundle: (...args: unknown[]) => h.getSubmitFillBundle(...args),
  saveSobaFormSubmission: (...args: unknown[]) => h.saveSobaFormSubmission(...args),
  submitSobaFormSubmission: (...args: unknown[]) => h.submitSobaFormSubmission(...args),
}));

vi.mock('@/src/features/formio-v5/useBcgovFileOption', () => ({
  useBcgovFileOption: () => ({}),
}));

vi.mock('@/src/features/formio-v5/ui/DynamicForm', () => ({
  DynamicForm: (props: {
    onSubmit: typeof h.onSubmit;
    options: typeof h.options;
    onFormReady?: (instance: unknown) => void;
  }) => {
    h.onSubmit = props.onSubmit;
    h.options = props.options;
    props.onFormReady?.(h.instance);
    return <div data-testid="fill-form">rendered</div>;
  },
}));

import makeStore from '@/lib/store';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import FormioV5SubmissionFillClient from '@/src/features/formio-v5/ui/FormioV5SubmissionFillClient';
import { answerInit, renderInStore } from './keycloakInit';

let store: ReturnType<typeof makeStore>;

const notices = () => store.getState().notification.notifications.map((n) => n.text);

describe('FormioV5SubmissionFillClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    h.formData = {};
    h.getSubmitFillBundle.mockResolvedValue({
      workflowState: 'opened',
      formVersionId: 'ver-1',
      headRevisionId: 'rev-0',
      schema: { components: [] },
      content: null,
      canWrite: true,
    });
  });

  // Before Keycloak answers, "no token" is the default rather than an answer. Reading there sends a
  // signed-in visitor's request anonymously.
  it('reads nothing until Keycloak has answered', async () => {
    await renderInStore(store, <FormioV5SubmissionFillClient />);
    expect(h.getSubmitFillBundle).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar', { name: 'Loading...' })).toBeInTheDocument();
  });

  it('reads once without a token when there is no session', async () => {
    await renderInStore(store, <FormioV5SubmissionFillClient />);
    await answerInit(store, { authenticated: false });
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    expect(h.getSubmitFillBundle).toHaveBeenCalledTimes(1);
    expect(h.getSubmitFillBundle).toHaveBeenCalledWith(undefined, 'sub-1');
  });

  it('reads once with the token when signed in', async () => {
    await renderInStore(store, <FormioV5SubmissionFillClient />);
    await answerInit(store, { authenticated: true, token: 'token' });
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    expect(h.getSubmitFillBundle).toHaveBeenCalledTimes(1);
    expect(h.getSubmitFillBundle).toHaveBeenCalledWith('token', 'sub-1');
  });

  const renderSignedOut = async () => {
    await renderInStore(store, <FormioV5SubmissionFillClient />);
    await answerInit(store, { authenticated: false });
  };

  it('renders an editable form when the caller may write', async () => {
    await renderSignedOut();
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    expect(h.options?.readOnly).toBe(false);
    expect(screen.queryByTestId('submission-fill-readonly')).not.toBeInTheDocument();
  });

  it('renders the form read-only, with a notice, when the caller may only read', async () => {
    h.getSubmitFillBundle.mockResolvedValue({
      workflowState: 'draft',
      formVersionId: 'ver-1',
      headRevisionId: 'rev-1',
      schema: { components: [] },
      content: null,
      canWrite: false,
    });
    await renderSignedOut();
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    expect(h.options?.readOnly).toBe(true);
    expect(screen.getByTestId('submission-fill-readonly')).toHaveTextContent(
      'You can view this submission only.',
    );
  });

  // An older backend sends no canWrite at all.
  it('renders an editable form when the bundle does not say whether the caller may write', async () => {
    h.getSubmitFillBundle.mockResolvedValue({
      workflowState: 'draft',
      formVersionId: 'ver-1',
      headRevisionId: 'rev-1',
      schema: { components: [] },
      content: null,
    });
    await renderSignedOut();
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    expect(h.options?.readOnly).toBe(false);
    expect(screen.queryByTestId('submission-fill-readonly')).not.toBeInTheDocument();
  });

  it('shows the translated no-access message when the read is refused', async () => {
    h.getSubmitFillBundle.mockRejectedValue(
      new ApiError('Not authorized to access this submission', 403),
    );
    await renderSignedOut();
    await waitFor(() =>
      expect(screen.getByTestId('submission-view-noaccess')).toHaveTextContent(
        'You do not have access.',
      ),
    );
    expect(screen.queryByText('Not authorized to access this submission')).not.toBeInTheDocument();
  });

  describe('submit', () => {
    const renderReady = async () => {
      await renderInStore(store, <FormioV5SubmissionFillClient />);
      await answerInit(store, { authenticated: false });
      await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    };
    const submit = (data: Record<string, unknown>) => act(() => h.onSubmit!({ data }));
    const sentBody = (call: number) =>
      h.submitSobaFormSubmission.mock.calls[call][2] as {
        revisionId: string;
        baseRevisionId: string;
      };
    const writeResponse = (status: 'current' | 'pending', reason = 'accepted') => ({
      revision: { id: 'r-1', revisionNo: 1, status, reason },
    });

    it('sends a new revision id based on the loaded head', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('current'));
      await renderReady();
      await submit({ a: 1 });
      expect(h.submitSobaFormSubmission).toHaveBeenCalledWith(undefined, 'sub-1', {
        data: { a: 1 },
        revisionId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7/),
        baseRevisionId: 'rev-0',
      });
    });

    it('reuses the revision id when unchanged answers are resubmitted after a failure', async () => {
      h.submitSobaFormSubmission.mockRejectedValueOnce(new Error('Failed to fetch'));
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('current'));
      await renderReady();
      await submit({ a: 1 });
      await submit({ a: 1 });
      expect(sentBody(1).revisionId).toBe(sentBody(0).revisionId);
    });

    it('mints a new revision id when the answers change', async () => {
      h.submitSobaFormSubmission.mockRejectedValueOnce(new Error('Failed to fetch'));
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('current'));
      await renderReady();
      await submit({ a: 1 });
      await submit({ a: 2 });
      expect(sentBody(1).revisionId).not.toBe(sentBody(0).revisionId);
      expect(sentBody(1).baseRevisionId).toBe('rev-0');
    });

    it('navigates to the confirmation when the submit becomes current', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('current'));
      await renderReady();
      await submit({ a: 1 });
      expect(h.push).toHaveBeenCalledWith('/en/submission/sub-1');
    });

    it('stays on the form with the held notice when the submit conflicts', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('pending', 'conflict'));
      await renderReady();
      await submit({ a: 1 });
      expect(h.push).not.toHaveBeenCalled();
      expect(screen.getByTestId('fill-form')).toBeInTheDocument();
      expect(screen.getByTestId('submission-fill-held')).toHaveTextContent(
        'Changed elsewhere; not submitted.',
      );
      expect(screen.getByTestId('submission-fill-write-mine')).toHaveTextContent(
        'Submit my version',
      );
      expect(h.instance.emit).toHaveBeenCalledWith('submitError', '');
      expect(h.instance.emit).not.toHaveBeenCalledWith('submitDone');
    });

    it('refuses another submit while the held notice shows', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('pending', 'conflict'));
      await renderReady();
      await submit({ a: 1 });
      h.instance.emit.mockClear();
      await submit({ a: 1 });
      expect(h.submitSobaFormSubmission).toHaveBeenCalledTimes(1);
      expect(h.instance.emit).toHaveBeenCalledWith('submitError', '');
    });

    it('submits over the latest version through Form.io when the filler keeps theirs', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('pending', 'conflict'));
      await renderReady();
      await submit({ a: 1 });
      h.getSubmitFillBundle.mockResolvedValueOnce({
        workflowState: 'draft',
        formVersionId: 'ver-1',
        headRevisionId: 'rev-9',
        schema: { components: [] },
        content: null,
        canWrite: true,
      });
      await userEvent.click(screen.getByTestId('submission-fill-write-mine'));
      await waitFor(() => expect(h.instance.submit).toHaveBeenCalled());
      expect(screen.queryByTestId('submission-fill-held')).not.toBeInTheDocument();
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('current'));
      await submit({ a: 1 });
      expect(sentBody(1).baseRevisionId).toBe('rev-9');
      expect(sentBody(1).revisionId).not.toBe(sentBody(0).revisionId);
    });

    it('redirects to the confirmation when the record was already submitted', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('pending', 'closed'));
      await renderReady();
      await submit({ a: 1 });
      expect(h.replace).toHaveBeenCalledWith('/en/submission/sub-1');
      expect(h.push).not.toHaveBeenCalled();
    });
  });

  describe('save draft', () => {
    const bundle = (overrides: Record<string, unknown> = {}) => ({
      workflowState: 'draft',
      formVersionId: 'ver-1',
      headRevisionId: 'rev-0',
      schema: { components: [] },
      content: null,
      canWrite: true,
      canSaveDraft: true,
      ...overrides,
    });
    const renderReady = async () => {
      await renderInStore(store, <FormioV5SubmissionFillClient />);
      await answerInit(store, { authenticated: false });
      await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    };
    const saveDraft = () => userEvent.click(screen.getByTestId('submission-fill-save-draft'));
    const savedBody = (call: number) =>
      h.saveSobaFormSubmission.mock.calls[call][2] as {
        data: Record<string, unknown>;
        revisionId: string;
        baseRevisionId: string;
      };
    const saveResponse = (id: string, status = 'current', reason = 'accepted') => ({
      revision: { id, revisionNo: 1, status, reason },
    });

    beforeEach(() => {
      h.getSubmitFillBundle.mockResolvedValue(bundle());
    });

    it.each([
      ['off', { canSaveDraft: false }],
      ['not reported', { canSaveDraft: undefined }],
    ])('shows no save action when drafts are %s', async (_label, overrides) => {
      h.getSubmitFillBundle.mockResolvedValue(bundle(overrides));
      await renderReady();
      expect(screen.queryByTestId('submission-fill-actions')).not.toBeInTheDocument();
    });

    it('saves the current answers based on the loaded head', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-1'));
      h.formData = { a: 1 };
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(1));
      expect(savedBody(0)).toEqual({
        data: { a: 1 },
        revisionId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7/),
        baseRevisionId: 'rev-0',
      });
      await waitFor(() => expect(notices()).toEqual(['Draft saved.']));
    });

    it('bases the next save and the submit on the revision the save produced', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-1'));
      h.submitSobaFormSubmission.mockResolvedValue(saveResponse('rev-2'));
      h.formData = { a: 1 };
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(1));
      h.formData = { a: 2 };
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(2));
      expect(savedBody(1).baseRevisionId).toBe('rev-1');
      await act(() => h.onSubmit!({ data: { a: 2 } }));
      expect(h.submitSobaFormSubmission.mock.calls[0][2]).toMatchObject({
        baseRevisionId: 'rev-1',
      });
    });

    it('mints a new revision id for an unchanged save after a successful one', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-1'));
      h.formData = { a: 1 };
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(1));
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(2));
      expect(savedBody(1).revisionId).not.toBe(savedBody(0).revisionId);
    });

    it('reuses the revision id when an unchanged save is retried after a failure', async () => {
      h.saveSobaFormSubmission.mockRejectedValueOnce(new Error('Failed to fetch'));
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-1'));
      h.formData = { a: 1 };
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(1));
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(2));
      expect(savedBody(1).revisionId).toBe(savedBody(0).revisionId);
    });

    it('leaves for the submission view when a replayed save finds the record submitted', async () => {
      h.saveSobaFormSubmission.mockResolvedValue({
        ...saveResponse('rev-1'),
        workflowState: 'submitted',
      });
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/en/submission/sub-1'));
      expect(notices()).toEqual(['Already submitted.']);
    });

    it('does not reload the form after a save', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-1'));
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(1));
      expect(h.getSubmitFillBundle).toHaveBeenCalledTimes(1);
    });

    it('shows the refusal when a save fails', async () => {
      h.saveSobaFormSubmission.mockRejectedValue(
        new ApiError('Drafts are not enabled for this form', 403),
      );
      await renderReady();
      await saveDraft();
      await waitFor(() =>
        expect(screen.getByTestId('submission-fill-render-error')).toHaveTextContent(
          'Drafts are not enabled for this form',
        ),
      );
    });

    it('offers to reload or keep the filler version when the save conflicts', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-x', 'pending', 'conflict'));
      await renderReady();
      await saveDraft();
      await waitFor(() =>
        expect(screen.getByTestId('submission-fill-held')).toHaveTextContent(
          'Changed elsewhere; draft not saved.',
        ),
      );
      expect(screen.getByTestId('submission-fill-write-mine')).toHaveTextContent('Save my version');
    });

    it('disables Save draft while the held notice shows', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-x', 'pending', 'conflict'));
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(screen.getByTestId('submission-fill-held')).toBeInTheDocument());
      expect(screen.getByTestId('submission-fill-save-draft')).toBeDisabled();
    });

    it('refuses a submit that waited on a save which was then held', async () => {
      let finishSave: (value: unknown) => void = () => undefined;
      h.saveSobaFormSubmission.mockReturnValue(
        new Promise((resolve) => {
          finishSave = resolve;
        }),
      );
      await renderReady();
      await saveDraft();
      const submitting = act(() => h.onSubmit!({ data: { a: 1 } }));
      finishSave(saveResponse('rev-x', 'pending', 'conflict'));
      await submitting;
      expect(h.submitSobaFormSubmission).not.toHaveBeenCalled();
      expect(screen.getByTestId('submission-fill-held')).toBeInTheDocument();
    });

    it('saves over the latest version with a fresh revision id when the filler keeps theirs', async () => {
      h.saveSobaFormSubmission.mockResolvedValueOnce(saveResponse('rev-x', 'pending', 'conflict'));
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-10'));
      h.formData = { a: 1 };
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(screen.getByTestId('submission-fill-held')).toBeInTheDocument());
      h.getSubmitFillBundle.mockResolvedValueOnce(bundle({ headRevisionId: 'rev-9' }));
      await userEvent.click(screen.getByTestId('submission-fill-write-mine'));
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(2));
      expect(savedBody(1).baseRevisionId).toBe('rev-9');
      expect(savedBody(1).revisionId).not.toBe(savedBody(0).revisionId);
      expect(screen.queryByTestId('submission-fill-held')).not.toBeInTheDocument();
    });

    it('reloads the latest version when the filler discards theirs', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-x', 'pending', 'conflict'));
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(screen.getByTestId('submission-fill-held')).toBeInTheDocument());
      h.getSubmitFillBundle.mockResolvedValue(bundle({ headRevisionId: 'rev-9' }));
      await userEvent.click(screen.getByTestId('submission-fill-reload-latest'));
      await waitFor(() => expect(h.getSubmitFillBundle).toHaveBeenCalledTimes(2));
      expect(screen.queryByTestId('submission-fill-held')).not.toBeInTheDocument();
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-10'));
      await saveDraft();
      await waitFor(() => expect(h.saveSobaFormSubmission).toHaveBeenCalledTimes(2));
      expect(savedBody(1).baseRevisionId).toBe('rev-9');
    });

    it('disables both held actions while one is running', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-x', 'pending', 'conflict'));
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(screen.getByTestId('submission-fill-held')).toBeInTheDocument());
      h.getSubmitFillBundle.mockReturnValueOnce(new Promise(() => undefined));
      await userEvent.click(screen.getByTestId('submission-fill-write-mine'));
      await waitFor(() => expect(screen.getByTestId('submission-fill-write-mine')).toBeDisabled());
      expect(screen.getByTestId('submission-fill-reload-latest')).toBeDisabled();
      expect(screen.getByTestId('submission-fill-save-draft')).toBeDisabled();
    });

    it('leaves with a notice when keeping theirs finds the record submitted', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-x', 'pending', 'conflict'));
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(screen.getByTestId('submission-fill-held')).toBeInTheDocument());
      h.getSubmitFillBundle.mockResolvedValueOnce(bundle({ workflowState: 'submitted' }));
      await userEvent.click(screen.getByTestId('submission-fill-write-mine'));
      await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/en/submission/sub-1'));
      expect(notices()).toContain('Already submitted.');
    });

    it('bases a submit made during a save on the revision that save produces', async () => {
      let finishSave: (value: unknown) => void = () => undefined;
      h.saveSobaFormSubmission.mockReturnValue(
        new Promise((resolve) => {
          finishSave = resolve;
        }),
      );
      h.submitSobaFormSubmission.mockResolvedValue(saveResponse('rev-2'));
      await renderReady();
      await saveDraft();
      const submitting = act(() => h.onSubmit!({ data: { a: 1 } }));
      expect(h.submitSobaFormSubmission).not.toHaveBeenCalled();
      finishSave(saveResponse('rev-1'));
      await submitting;
      expect(h.submitSobaFormSubmission.mock.calls[0][2]).toMatchObject({
        baseRevisionId: 'rev-1',
      });
    });

    it('leaves for the submission view when the record was already submitted', async () => {
      h.saveSobaFormSubmission.mockResolvedValue(saveResponse('rev-x', 'pending', 'closed'));
      await renderReady();
      await saveDraft();
      await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/en/submission/sub-1'));
    });
  });

  // The SWR cache outlives the page; a later visit must not render the copy read before a save.
  it('reads the bundle again when the page is visited again', async () => {
    const cache = new Map();
    const tree = (show: boolean) => (
      <Provider store={store}>
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
          {show ? <FormioV5SubmissionFillClient /> : null}
        </SWRConfig>
      </Provider>
    );
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(tree(true));
    });
    await answerInit(store, { authenticated: false });
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    await act(async () => view!.rerender(tree(false)));
    await act(async () => view!.rerender(tree(true)));
    await waitFor(() => expect(h.getSubmitFillBundle).toHaveBeenCalledTimes(2));
  });
});
