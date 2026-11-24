import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppSessionSnapshot } from '@/src/app/routing/appRoutePolicy';

// Mutable test doubles shared with the hoisted vi.mock factories below.
const h = vi.hoisted(() => ({
  refresh: vi.fn(),
  signInAfterRefusal: vi.fn(),
  replace: vi.fn(),
  refreshCurrentUser: vi.fn(),
  session: {} as AppSessionSnapshot,
  pathname: '/en/forms',
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ refresh: h.refresh, signInAfterRefusal: h.signInAfterRefusal }),
}));

vi.mock('@/src/shared/api/useCurrentUser', () => ({
  useRefreshCurrentUser: () => h.refreshCurrentUser,
}));

// The guard is the route policy; what feeds it is covered in useAppSession's own tests.
vi.mock('@/src/app/routing/useAppSession', () => ({
  useAppSession: () => h.session,
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: {
      loading: 'Loading…',
      sessionError: 'We could not load your session.',
      tryAgain: 'Try again',
    },
  }),
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<unknown>('next/navigation');
  return {
    ...(actual as Record<string, unknown>),
    useRouter: () => ({ replace: h.replace }),
    usePathname: () => h.pathname,
  };
});

import { AppAccessGuard } from '@/src/app/routing/AppAccessGuard';

const READY: AppSessionSnapshot = {
  authenticated: true,
  initializing: false,
  initStarted: true,
  sessionReady: true,
  sessionLoadedOnce: true,
  sessionFailed: false,
  authUnavailable: false,
  needsOnboarding: false,
  canCreateWorkspace: true,
  hasWorkspaces: true,
};

const SIGNED_OUT: AppSessionSnapshot = {
  ...READY,
  authenticated: false,
  sessionLoadedOnce: false,
};

function renderGuard(designMode = true) {
  return render(
    <AppAccessGuard locale="en" designMode={designMode}>
      visible child
    </AppAccessGuard>,
  );
}

describe('AppAccessGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.refresh.mockResolvedValue(undefined);
    h.refreshCurrentUser.mockResolvedValue(undefined);
    h.session = { ...READY };
    h.pathname = '/en/forms';
  });

  it('shows the spinner (not the error) while bootstrap loads are pending', async () => {
    h.session = { ...READY, sessionReady: false, sessionLoadedOnce: false };

    await act(async () => {
      renderGuard();
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('session-error-retry')).not.toBeInTheDocument();
  });

  it('renders the error + retry instead of an infinite spinner when a load fails', async () => {
    h.session = { ...READY, sessionReady: false, sessionLoadedOnce: false, sessionFailed: true };

    await act(async () => {
      renderGuard();
    });

    expect(screen.getByText('We could not load your session.')).toBeInTheDocument();
    expect(screen.getByTestId('session-error-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(h.replace).not.toHaveBeenCalled();
  });

  // A partial retry leaves the other reads failed, so the alert never clears and the button
  // looks dead.
  it('retry refreshes the token then re-reads every bootstrap load', async () => {
    h.session = { ...READY, sessionReady: false, sessionLoadedOnce: false, sessionFailed: true };

    await act(async () => {
      renderGuard();
    });

    await userEvent.click(screen.getByTestId('session-error-retry'));

    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.refreshCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('renders children once the session is ready', async () => {
    await act(async () => {
      renderGuard();
    });

    expect(screen.getByText('visible child')).toBeInTheDocument();
    expect(screen.queryByTestId('session-error-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('redirects to onboarding and holds the route while it does', async () => {
    h.session = { ...READY, needsOnboarding: true, hasWorkspaces: false };

    await act(async () => {
      renderGuard();
    });

    expect(h.replace).toHaveBeenCalledWith('/en/onboarding');
    expect(screen.queryByText('visible child')).not.toBeInTheDocument();
  });

  // An emailed deep link to a guarded page has to come back to that page after sign-in.
  it('starts sign-in back to this address for a signed-out visitor on a guarded page', async () => {
    h.session = { ...SIGNED_OUT };
    h.pathname = '/en/build/form-1';

    const view = await act(async () => renderGuard());
    // A new session object with the same answer must not start a second sign-in.
    h.session = { ...SIGNED_OUT };
    await act(async () => {
      view.rerender(
        <AppAccessGuard locale="en" designMode={true}>
          visible child
        </AppAccessGuard>,
      );
    });

    expect(h.signInAfterRefusal).toHaveBeenCalledTimes(1);
    expect(h.signInAfterRefusal).toHaveBeenCalledWith(globalThis.location.href);
    expect(h.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('visible child')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor home when Keycloak failed to start', async () => {
    h.session = { ...SIGNED_OUT, authUnavailable: true };
    h.pathname = '/en/build/form-1';

    await act(async () => {
      renderGuard();
    });

    expect(h.replace).toHaveBeenCalledWith('/en');
    expect(h.signInAfterRefusal).not.toHaveBeenCalled();
  });

  it('renders a public page for a signed-out visitor without starting sign-in', async () => {
    h.session = { ...SIGNED_OUT };
    h.pathname = '/en/form/form-1';

    await act(async () => {
      renderGuard();
    });

    expect(screen.getByText('visible child')).toBeInTheDocument();
    expect(h.signInAfterRefusal).not.toHaveBeenCalled();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('renders my forms for a user without workspaces when design mode is off', async () => {
    h.session = {
      ...READY,
      needsOnboarding: true,
      hasWorkspaces: false,
      canCreateWorkspace: false,
    };
    h.pathname = '/en/my-forms';

    await act(async () => {
      renderGuard(false);
    });

    expect(h.replace).not.toHaveBeenCalled();
    expect(screen.getByText('visible child')).toBeInTheDocument();
  });

  // Swapping children for the spinner unmounts the route: a form being filled loses its answers.
  it('keeps children mounted when a background load runs after bootstrap', async () => {
    const view = await act(async () => renderGuard());
    expect(screen.getByText('visible child')).toBeInTheDocument();

    // A token rotation re-reads /me: ready drops, but the session never stopped being valid.
    h.session = { ...READY, sessionReady: false };
    await act(async () => {
      view.rerender(
        <AppAccessGuard locale="en" designMode={true}>
          visible child
        </AppAccessGuard>,
      );
    });

    expect(screen.getByText('visible child')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('keeps children mounted when a background load FAILS after bootstrap', async () => {
    const view = await act(async () => renderGuard());

    h.session = { ...READY, sessionReady: false, sessionFailed: true };
    await act(async () => {
      view.rerender(
        <AppAccessGuard locale="en" designMode={true}>
          visible child
        </AppAccessGuard>,
      );
    });

    expect(screen.getByText('visible child')).toBeInTheDocument();
    expect(screen.queryByTestId('session-error-retry')).not.toBeInTheDocument();
  });
});
