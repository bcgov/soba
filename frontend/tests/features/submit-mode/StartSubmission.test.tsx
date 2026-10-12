import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

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
    submitRefusals: {
      open_denied: 'This form is not open to you.',
      not_published: 'This form is closed.',
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
import StartSubmission from '@/src/features/submit-mode/ui/StartSubmission';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { answerInit, renderInStore } from './keycloakInit';

let store: ReturnType<typeof makeStore>;

describe('StartSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    h.openSobaFormSubmission.mockResolvedValue({ id: 'sub-1' });
  });

  // Before Keycloak answers, "no token" is the default rather than an answer. Opening there attributes
  // a signed-in visitor's submission to the public user.
  it('opens nothing until Keycloak has answered', async () => {
    await renderInStore(store, <StartSubmission />);
    expect(h.openSobaFormSubmission).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar', { name: 'Starting...' })).toBeInTheDocument();
  });

  it('opens one anonymous submission when there is no session', async () => {
    await renderInStore(store, <StartSubmission />);
    await answerInit(store, { authenticated: false });
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/en/submit/sub-1'));
    expect(h.openSobaFormSubmission).toHaveBeenCalledTimes(1);
    expect(h.openSobaFormSubmission).toHaveBeenCalledWith(undefined, 'form-1', expect.any(String));
  });

  it('opens one submission with the token when signed in', async () => {
    await renderInStore(store, <StartSubmission />);
    await answerInit(store, { authenticated: true, token: 'token' });
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/en/submit/sub-1'));
    expect(h.openSobaFormSubmission).toHaveBeenCalledTimes(1);
    expect(h.openSobaFormSubmission).toHaveBeenCalledWith('token', 'form-1', expect.any(String));
  });

  it.each([
    [
      'the message for its code',
      new ApiError('Not authorized to submit this form', 403, 'open_denied'),
      'This form is not open to you.',
    ],
    [
      'the message for an unpublished form',
      new ApiError('Form has no published version', 404, 'not_published'),
      'This form is closed.',
    ],
    ['the server text without a code', new ApiError('Form not found', 404), 'Form not found'],
  ])('shows %s when the open is refused', async (_label, refused, text) => {
    h.openSobaFormSubmission.mockRejectedValue(refused);
    await renderInStore(store, <StartSubmission />);
    await answerInit(store, { authenticated: true, token: 'token' });
    expect(await screen.findByTestId('start-submission-error')).toHaveTextContent(text);
  });
});
