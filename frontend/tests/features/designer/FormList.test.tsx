import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';

// Mocks
vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ authenticated: true, token: 'token', initializing: false }),
}));
vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    locale: 'en',
    general: {
      notAuthenticated: 'Not authed',
      forms: 'Forms',
      selectWorkspace: 'Select a workspace to view forms.',
    },
    form: { nameLabel: 'Form Name' },
    submission: {
      formList: {
        columns: {
          name: 'Name',
          actions: 'Actions',
          createdBy: 'Created By',
          createdAt: 'Created Date',
        },
      },
    },
  }),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<unknown>('next/navigation');
  return {
    ...(actual as Record<string, unknown>),
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/en/designer',
  };
});

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForms: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'f1',
        name: 'Form One',
        status: 'active',
        createdBy: 'alice',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'f2',
        name: 'Form Two',
        status: 'active',
        createdBy: 'bob',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  }),
}));

const { mockWorkspaceState } = vi.hoisted(() => ({
  mockWorkspaceState: { activeWorkspaceId: 'ws1' as string | null },
}));
vi.mock('@/lib/store', async () => ({
  useAppSelector: (fn: (s: unknown) => unknown) => fn({ workspace: mockWorkspaceState }),
}));

import FormList from '@/src/features/designer/ui/FormList';

describe('FormList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceState.activeWorkspaceId = 'ws1';
  });

  it('renders the header and search input', async () => {
    await act(async () => {
      render(<FormList />);
    });
    expect(screen.getByRole('heading', { name: 'Forms' })).toBeInTheDocument();
    // DS TextField puts data-testid on its wrapper; query the input by its
    // accessible label instead.
    const input = screen.getByLabelText('Search');
    expect(input).toBeInTheDocument();
  });

  it('loads and displays rows from API', async () => {
    await act(async () => {
      render(<FormList />);
    });
    await waitFor(() => expect(screen.getByText('Form One')).toBeInTheDocument());
    expect(screen.getByText('Form Two')).toBeInTheDocument();
  });

  it('navigates to designer on Manage action', async () => {
    let container: HTMLElement | null = null;
    await act(async () => {
      const res = render(<FormList />);
      container = res.container;
    });
    await waitFor(() => expect(screen.getByText('Form One')).toBeInTheDocument());
    const btn = container!.querySelector(
      '[data-testid="manage-f1-button"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    await userEvent.click(btn!);
    expect(mockPush).toHaveBeenCalledWith('/en/designer/f1');
  });

  it('disables the Create button when there is no active workspace', async () => {
    mockWorkspaceState.activeWorkspaceId = null;
    await act(async () => {
      render(<FormList />);
    });
    const createBtn = screen.getByTestId('create-form-button');
    expect(createBtn).toBeDisabled();
  });

  it('search works to filter forms', async () => {
    await act(async () => {
      render(<FormList />);
    });
    await waitFor(() => expect(screen.getByText('Form One')).toBeInTheDocument());
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'two' } });
    expect(screen.queryByText('Form One')).not.toBeInTheDocument();
    expect(screen.getByText('Form Two')).toBeInTheDocument();
  });
});
