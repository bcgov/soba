import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  getSubmitFillBundle: vi.fn(),
  submitSobaFormSubmission: vi.fn(),
  onSubmit: undefined as
    | undefined
    | ((submission: { data: Record<string, unknown> }) => Promise<void>),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: { sessionExpired: 'Your session has ended.' },
    form: { loading: 'Loading...' },
    formioV5: {
      formRender: {
        loadError: 'Could not load the form.',
        rendererError: 'The form could not be displayed.',
        submitSuccess: 'Submitted.',
        submitPending: 'Saved for review.',
        missingId: 'Missing submission id.',
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
  submitSobaFormSubmission: (...args: unknown[]) => h.submitSobaFormSubmission(...args),
}));

vi.mock('@/src/features/formio-v5/useBcgovFileOption', () => ({
  useBcgovFileOption: () => ({}),
}));

vi.mock('@/src/features/formio-v5/ui/DynamicForm', () => ({
  DynamicForm: (props: { onSubmit: typeof h.onSubmit }) => {
    h.onSubmit = props.onSubmit;
    return <div data-testid="fill-form">rendered</div>;
  },
}));

import makeStore from '@/lib/store';
import FormioV5SubmissionFillClient from '@/src/features/formio-v5/ui/FormioV5SubmissionFillClient';
import { answerInit, renderInStore } from './keycloakInit';

let store: ReturnType<typeof makeStore>;

describe('FormioV5SubmissionFillClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    h.getSubmitFillBundle.mockResolvedValue({
      workflowState: 'opened',
      formVersionId: 'ver-1',
      headRevisionId: 'rev-0',
      schema: { components: [] },
      content: null,
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
    const writeResponse = (status: 'current' | 'pending') => ({
      revision: { id: 'r-1', revisionNo: 1, status, reason: 'accepted' },
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

    it('stays on the form when the submit is held as pending', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('pending'));
      await renderReady();
      await submit({ a: 1 });
      expect(h.push).not.toHaveBeenCalled();
      expect(screen.getByTestId('fill-form')).toBeInTheDocument();
    });

    it('redirects to the confirmation when a pending submit finds the record already submitted', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('pending'));
      await renderReady();
      // The base-refresh after a pending result reports the record is now submitted.
      h.getSubmitFillBundle.mockResolvedValueOnce({
        workflowState: 'submitted',
        formVersionId: 'ver-1',
        headRevisionId: 'rev-1',
        schema: { components: [] },
        content: null,
      });
      await submit({ a: 1 });
      expect(h.replace).toHaveBeenCalledWith('/en/submission/sub-1');
      expect(h.push).not.toHaveBeenCalled();
    });

    it('mints a fresh revision id for a retry after a pending result', async () => {
      h.submitSobaFormSubmission.mockResolvedValue(writeResponse('pending'));
      await renderReady();
      await submit({ a: 1 });
      await submit({ a: 1 });
      expect(sentBody(1).revisionId).not.toBe(sentBody(0).revisionId);
    });
  });
});
