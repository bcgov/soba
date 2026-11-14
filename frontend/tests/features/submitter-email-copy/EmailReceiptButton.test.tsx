import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import en from '@/dictionaries/en.json';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const { mockSend, mockAddNotification } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockAddNotification: vi.fn(),
}));

vi.mock('@/app/[lang]/Providers', () => ({ useDictionary: () => en }));
vi.mock('@/src/shared/api/sobaApi', () => ({
  emailSubmitSubmissionCopy: (...args: unknown[]) => mockSend(...args),
}));
vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setIdTokenParsed, setToken } from '@/lib/slices/keycloakSlice';
import { EmailReceiptButton } from '@/src/features/submitter-email-copy/ui/EmailReceiptButton';

const t = en.submission.emailReceipt;
let store: ReturnType<typeof makeStore>;

const renderButton = () =>
  render(
    <Provider store={store}>
      <EmailReceiptButton submissionId="sub-1" />
    </Provider>,
  );

const address = () =>
  screen.getByTestId('submission-email-receipt-address').querySelector('input') as HTMLInputElement;

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId('submission-email-receipt'));
  await screen.findByTestId('submission-email-receipt-address');
};

/** A signed-in submitter whose sign-in carries their address. */
const signIn = (email: string) => {
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  store.dispatch(setIdTokenParsed({ email }));
};

beforeEach(() => {
  vi.clearAllMocks();
  store = makeStore();
  mockSend.mockResolvedValue(undefined);
});

describe('EmailReceiptButton', () => {
  it('starts an anonymous submitter with a blank address', async () => {
    const user = userEvent.setup();
    renderButton();
    await open(user);
    expect(address()).toHaveValue('');
    expect(screen.getByText(t.description)).toBeInTheDocument();
  });

  it('starts a signed-in submitter with their own address, which they can change', async () => {
    const user = userEvent.setup();
    signIn('pat@example.com');
    renderButton();
    await open(user);
    expect(address()).toHaveValue('pat@example.com');

    await user.clear(address());
    await user.type(address(), 'other@example.com');
    await user.click(screen.getByTestId('submission-email-receipt-send'));
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith('token', 'sub-1', 'other@example.com'),
    );
  });

  it('refuses an invalid address before sending anything', async () => {
    const user = userEvent.setup();
    renderButton();
    await open(user);
    await user.type(address(), 'not-an-email');
    await user.click(screen.getByTestId('submission-email-receipt-send'));
    expect(await screen.findByText(t.invalidAddress)).toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('answers Enter on an empty address with its own message, not the browser popup', async () => {
    const user = userEvent.setup();
    renderButton();
    await open(user);
    await user.click(address());
    await user.keyboard('{Enter}');
    expect(await screen.findByText(t.invalidAddress)).toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('stays open while sending, even when asked to close', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    mockSend.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderButton();
    await open(user);
    await user.type(address(), 'pat@example.com');
    await user.click(screen.getByTestId('submission-email-receipt-send'));
    await user.keyboard('{Escape}');
    expect(address()).toBeInTheDocument();
    finish();
    await waitFor(() => expect(mockAddNotification).toHaveBeenCalled());
  });

  it('sends the address trimmed and lower-cased, then closes and says where it went', async () => {
    const user = userEvent.setup();
    renderButton();
    await open(user);
    await user.type(address(), '  Pat@Example.COM ');
    await user.click(screen.getByTestId('submission-email-receipt-send'));

    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(undefined, 'sub-1', 'pat@example.com'),
    );
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: 'success',
      text: 'A copy is on its way to pat@example.com.',
    });
    await waitFor(() =>
      expect(screen.queryByTestId('submission-email-receipt-address')).not.toBeInTheDocument(),
    );
  });

  it("shows the server's reason in the modal, such as an hourly limit, and stays open", async () => {
    const user = userEvent.setup();
    mockSend.mockRejectedValue(new ApiError('too many', 429, 'email_copy_limit_reached'));
    renderButton();
    await open(user);
    await user.type(address(), 'pat@example.com');
    await user.click(screen.getByTestId('submission-email-receipt-send'));

    expect(await screen.findByTestId('submission-email-receipt-error')).toHaveTextContent(
      en.apiErrors.email_copy_limit_reached,
    );
    expect(address()).toBeInTheDocument();
    expect(mockAddNotification).not.toHaveBeenCalled();
  });

  it('says the copy could not be sent when the failure has no reason of its own', async () => {
    const user = userEvent.setup();
    mockSend.mockRejectedValue(new TypeError('Failed to fetch'));
    renderButton();
    await open(user);
    await user.type(address(), 'pat@example.com');
    await user.click(screen.getByTestId('submission-email-receipt-send'));

    expect(await screen.findByTestId('submission-email-receipt-error')).toHaveTextContent(
      /^The copy could not be sent\. Try again later\.$/,
    );
    expect(mockAddNotification).not.toHaveBeenCalled();
  });

  it('opens fresh after a failure: no old error, and the address starts over', async () => {
    const user = userEvent.setup();
    signIn('pat@example.com');
    mockSend.mockRejectedValue(new ApiError('too many', 429, 'email_copy_limit_reached'));
    renderButton();
    await open(user);
    await user.clear(address());
    await user.type(address(), 'other@example.com');
    await user.click(screen.getByTestId('submission-email-receipt-send'));
    await screen.findByTestId('submission-email-receipt-error');

    await user.click(screen.getByTestId('submission-email-receipt-cancel'));
    await waitFor(() =>
      expect(screen.queryByTestId('submission-email-receipt-address')).not.toBeInTheDocument(),
    );
    await open(user);
    expect(screen.queryByTestId('submission-email-receipt-error')).not.toBeInTheDocument();
    expect(address()).toHaveValue('pat@example.com');
  });

  it('sends once when Send is pressed twice', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    mockSend.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderButton();
    await open(user);
    await user.type(address(), 'pat@example.com');
    await user.click(screen.getByTestId('submission-email-receipt-send'));
    await user.click(screen.getByTestId('submission-email-receipt-send'));
    finish();
    await waitFor(() => expect(mockAddNotification).toHaveBeenCalled());
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
