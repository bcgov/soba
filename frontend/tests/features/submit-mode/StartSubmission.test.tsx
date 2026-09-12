import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  openSobaFormSubmission: vi.fn(),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: { sessionExpired: 'Your session has ended.' },
    formioV5: {
      formRender: {
        starting: 'Starting...',
        startError: 'Could not start the form.',
        missingId: 'Missing form id.',
      },
    },
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ formId: 'form-1' }),
  useRouter: () => ({ replace: h.replace }),
  usePathname: () => '/en/form/form-1',
}));

vi.mock('@/src/shared/api/sobaApi', () => ({
  openSobaFormSubmission: (...args: unknown[]) => h.openSobaFormSubmission(...args),
}));

import makeStore from '@/lib/store';
import { initKeycloak } from '@/lib/slices/keycloakSlice';
import StartSubmission from '@/src/features/submit-mode/ui/StartSubmission';

let store: ReturnType<typeof makeStore>;

async function renderStart() {
  await act(async () => {
    render(
      <Provider store={store}>
        <StartSubmission />
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

describe('StartSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    h.openSobaFormSubmission.mockResolvedValue({ id: 'sub-1' });
  });

  // Before Keycloak answers, "no token" is the default rather than an answer. Opening there attributes
  // a signed-in visitor's submission to the public user.
  it('opens nothing until Keycloak has answered', async () => {
    await renderStart();
    expect(h.openSobaFormSubmission).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar', { name: 'Starting...' })).toBeInTheDocument();
  });

  it('opens one anonymous submission when there is no session', async () => {
    await renderStart();
    await answerInit({ authenticated: false });
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/en/submit/sub-1'));
    expect(h.openSobaFormSubmission).toHaveBeenCalledTimes(1);
    expect(h.openSobaFormSubmission).toHaveBeenCalledWith(undefined, 'form-1', expect.any(String));
  });

  it('opens one submission with the token when signed in', async () => {
    await renderStart();
    await answerInit({ authenticated: true, token: 'token' });
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/en/submit/sub-1'));
    expect(h.openSobaFormSubmission).toHaveBeenCalledTimes(1);
    expect(h.openSobaFormSubmission).toHaveBeenCalledWith('token', 'form-1', expect.any(String));
  });
});
