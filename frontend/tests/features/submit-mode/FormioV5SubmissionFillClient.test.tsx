import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  getSubmitFillBundle: vi.fn(),
  submitSobaFormSubmission: vi.fn(),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: { sessionExpired: 'Your session has ended.' },
    form: { loading: 'Loading...' },
    formioV5: {
      formRender: {
        loadError: 'Could not load the form.',
        unavailable: 'This form is unavailable.',
        rendererError: 'The form could not be displayed.',
        submitSuccess: 'Submitted.',
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
  DynamicForm: () => <div data-testid="fill-form">rendered</div>,
}));

import makeStore from '@/lib/store';
import { initKeycloak } from '@/lib/slices/keycloakSlice';
import FormioV5SubmissionFillClient from '@/src/features/formio-v5/ui/FormioV5SubmissionFillClient';

let store: ReturnType<typeof makeStore>;

async function renderFill() {
  await act(async () => {
    render(
      <Provider store={store}>
        <FormioV5SubmissionFillClient />
      </Provider>,
    );
  });
}

// Keycloak never runs here, so the init lifecycle is driven directly.
async function answerInit(payload: { authenticated: boolean; token?: string }) {
  await act(async () => {
    store.dispatch({ type: initKeycloak.pending.type });
  });
  await act(async () => {
    store.dispatch({ type: initKeycloak.fulfilled.type, payload });
  });
}

describe('FormioV5SubmissionFillClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    h.getSubmitFillBundle.mockResolvedValue({
      workflowState: 'opened',
      schema: { components: [] },
      content: null,
    });
  });

  // Before Keycloak answers, "no token" is the default rather than an answer. Reading there sends a
  // signed-in visitor's request anonymously.
  it('reads nothing until Keycloak has answered', async () => {
    await renderFill();
    expect(h.getSubmitFillBundle).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar', { name: 'Loading...' })).toBeInTheDocument();
  });

  it('reads once without a token when there is no session', async () => {
    await renderFill();
    await answerInit({ authenticated: false });
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    expect(h.getSubmitFillBundle).toHaveBeenCalledTimes(1);
    expect(h.getSubmitFillBundle).toHaveBeenCalledWith(undefined, 'sub-1');
  });

  it('reads once with the token when signed in', async () => {
    await renderFill();
    await answerInit({ authenticated: true, token: 'token' });
    await waitFor(() => expect(screen.getByTestId('fill-form')).toBeInTheDocument());
    expect(h.getSubmitFillBundle).toHaveBeenCalledTimes(1);
    expect(h.getSubmitFillBundle).toHaveBeenCalledWith('token', 'sub-1');
  });
});
