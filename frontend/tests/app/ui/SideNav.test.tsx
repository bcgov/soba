import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { session, currentUser } = vi.hoisted(() => ({
  session: { authenticated: false, initializing: false },
  currentUser: {
    data: null as { capabilities: { isSobaAdmin: boolean } } | null,
    loaded: true,
  },
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => session,
}));

vi.mock('@/src/shared/api/useCurrentUser', () => ({
  useCurrentUser: () => currentUser,
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    locale: 'en',
    general: { forms: 'Forms', home: 'Home', feedback: 'Feedback', help: 'Help' },
    header: { workspaces: 'Workspaces' },
    admin: { heading: 'Administration' },
    sideNav: { toggleSidebar: 'Toggle sidebar' },
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/forms',
}));

import { SideNav } from '@/app/ui/SideNav';

async function renderNav() {
  await act(async () => {
    render(<SideNav showHome={false} showWorkspaces={false} />);
  });
}

function signIn(isSobaAdmin: boolean) {
  session.authenticated = true;
  currentUser.data = { capabilities: { isSobaAdmin } };
}

const navTestIds = () => screen.getAllByRole('link').map((link) => link.dataset.testid);

describe('SideNav', () => {
  beforeEach(() => {
    session.authenticated = false;
    currentUser.data = null;
  });

  it('links to feedback and help with every feature off', async () => {
    await renderNav();

    expect(navTestIds()).toEqual(['feedback-nav', 'help-nav']);
  });

  it('links an admin to administration', async () => {
    signIn(true);

    await renderNav();

    expect(navTestIds()).toEqual(['admin-nav', 'feedback-nav', 'help-nav']);
  });

  it('hides administration from a signed-in user who is not an admin', async () => {
    signIn(false);

    await renderNav();

    expect(screen.queryByTestId('admin-nav')).not.toBeInTheDocument();
  });
});
