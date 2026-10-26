import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceGroupTab from '@/src/features/workspaces/ui/WorkspaceGroupTab';
import type { Dictionary } from '@/src/types/dictionary';
import type { WorkspaceGroup, RoleMeta } from '@/src/features/workspaces/types/groups';
import * as workspaceGroupsApi from '@/src/features/workspaces/data/workspaceGroupsApi';

const mockPush = vi.fn();
const mockAddNotification = vi.fn();
const mockRemove = vi.fn();
const mockRefresh = vi.fn();

const sampleGroups: WorkspaceGroup[] = [
  {
    id: 'grp-system-1',
    name: 'Form administrators',
    description: 'System group for administrators',
    status: 'active',
    system: true,
    roles: ['form_admin'],
  },
  {
    id: 'grp-custom-2',
    name: 'Form Reviewers',
    description: 'Group to review form submissions',
    status: 'active',
    system: false,
    roles: ['submission_reviewer'],
  },
];

const sampleRoles: RoleMeta[] = [
  {
    roleCode: 'form_admin',
    name: 'Form Administrator',
    description: 'Full form access',
  },
  {
    roleCode: 'submission_reviewer',
    name: 'Submission Reviewer',
    description: 'Can review submissions',
  },
  {
    roleCode: 'form_designer',
    name: 'Form Designer',
    description: 'Can design forms',
  },
];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/en/workspace/ws-1',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ authenticated: true, token: 'mock-token', initializing: false }),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}));

vi.mock('@/src/features/workspaces/data/workspaceGroupsApi', () => ({
  useWorkspaceGroups: vi.fn(() => ({
    rows: sampleGroups,
    groups: sampleGroups,
    total: sampleGroups.length,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: mockRefresh,
    mutate: vi.fn(),
  })),
  useRolesMeta: () => ({
    roles: sampleRoles,
    isLoading: false,
    error: null,
  }),
  useWorkspaceGroupsWriter: () => ({
    remove: mockRemove,
  }),
}));

const mockDict = {
  general: {
    loading: 'Loading…',
    cancel: 'Cancel',
    sortBy: 'Sort by',
  },
  modal: {
    dialogActions: 'Dialog actions',
  },
  dataTable: {
    emptyMessage: 'No items found.',
    loadingMessage: 'Loading...',
    itemName: 'items',
    itemsPerPage: 'Items per page',
    itemsPerPageAria: 'Items per page',
    pageAria: 'Page',
    of: 'of',
    pageOf: 'of {totalPages}',
    previousPage: 'Previous page',
    nextPage: 'Next page',
  },
  searchField: {
    search: 'Search',
    clearSearch: 'Clear search',
    submitSearch: 'Submit search',
  },
  workspaces: {
    groupsTab: 'Groups',
    groups: {
      addGroup: 'Add Group',
      editGroup: 'Edit Group',
      deleteGroup: 'Remove Group',
      name: 'Group Name',
      namePlaceholder: 'e.g., Form Reviewers',
      description: 'Description',
      descriptionPlaceholder: 'Optional description of what this group does',
      roles: 'Roles',
      rolesHelp: 'Roles granted to all members of this group across all forms in the workspace.',
      noRolesSelected: 'No roles selected',
      selectedCount: '{count} selected',
      systemGroup: 'System Group',
      customGroup: 'Custom Group',
      systemGroupTooltip: 'System groups are protected and cannot be deleted.',
      deleteConfirmTitle: 'Remove Group',
      deleteConfirmMessage: 'Are you sure you want to remove group "{name}"?',
      deleteSuccess: 'Group removed successfully.',
      deleteError: 'Failed to remove group.',
      loadError: 'Failed to load workspace groups.',
      empty: 'No groups found in this workspace.',
      columns: {
        name: 'Name',
        description: 'Description',
        roles: 'Roles',
        actions: 'Actions',
      },
      roleNames: {
        form_admin: 'Form Administrator',
        submission_reviewer: 'Submission Reviewer',
        form_designer: 'Form Designer',
      },
    },
  },
} as unknown as Dictionary;

describe('WorkspaceGroupTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workspaceGroupsApi.useWorkspaceGroups).mockReturnValue({
      rows: sampleGroups,
      groups: sampleGroups,
      total: sampleGroups.length,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      mutate: vi.fn(),
    });
  });

  it('renders search field, toolbar, and groups table with rows and roles', () => {
    render(<WorkspaceGroupTab dict={mockDict} workspaceId="ws-1" />);

    expect(screen.getByTestId('create-ws-group-button')).toBeInTheDocument();
    expect(screen.getByTestId('forms-search-field')).toBeInTheDocument();

    // Group rows
    expect(screen.getByText('Form administrators')).toBeInTheDocument();
    expect(screen.getByText('Form Reviewers')).toBeInTheDocument();

    // Roles column
    expect(screen.getByTestId('group-role-grp-system-1-form_admin')).toHaveTextContent('Form Administrator');
    expect(screen.getByTestId('group-role-grp-custom-2-submission_reviewer')).toHaveTextContent('Submission Reviewer');

    // System group cannot be deleted (no delete button)
    expect(screen.queryByTestId('delete-group-button-grp-system-1')).not.toBeInTheDocument();
    // Custom group can be deleted
    expect(screen.getByTestId('delete-group-button-grp-custom-2')).toBeInTheDocument();
  });

  it('allows typing into the search field and submitting a search', async () => {
    const user = userEvent.setup();

    render(<WorkspaceGroupTab dict={mockDict} workspaceId="ws-1" />);

    const searchInput = screen.getByTestId('forms-search-field');
    expect(searchInput).toBeInTheDocument();

    await user.type(searchInput, 'Reviewers{enter}');
    expect(searchInput).toHaveValue('Reviewers');
  });

  it('renders empty message when no groups exist in the workspace', () => {
    vi.mocked(workspaceGroupsApi.useWorkspaceGroups).mockReturnValue({
      rows: [],
      groups: [],
      total: 0,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      mutate: vi.fn(),
    });

    render(<WorkspaceGroupTab dict={mockDict} workspaceId="ws-1" />);
    expect(screen.getByText('No groups found in this workspace.')).toBeInTheDocument();
  });

  it('displays no roles selected message when group has no roles', () => {
    const groupWithoutRoles: WorkspaceGroup = {
      id: 'grp-no-roles',
      name: 'Unassigned Group',
      description: 'Group with no roles',
      status: 'active',
      system: false,
      roles: [],
    };

    vi.mocked(workspaceGroupsApi.useWorkspaceGroups).mockReturnValue({
      rows: [groupWithoutRoles],
      groups: [groupWithoutRoles],
      total: 1,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: mockRefresh,
      mutate: vi.fn(),
    });

    render(<WorkspaceGroupTab dict={mockDict} workspaceId="ws-1" />);
    expect(screen.getByText('No roles selected')).toBeInTheDocument();
  });

  it('navigates to add group page when clicking Add Group button', async () => {
    const user = userEvent.setup();

    render(<WorkspaceGroupTab dict={mockDict} workspaceId="ws-1" />);

    const addButton = screen.getByTestId('create-ws-group-button');
    await user.click(addButton);

    expect(mockPush).toHaveBeenCalledWith('/en/workspace/ws-1/group');
  });

  it('navigates to edit group page when clicking Edit button', async () => {
    const user = userEvent.setup();

    render(<WorkspaceGroupTab dict={mockDict} workspaceId="ws-1" />);

    const editBtn = screen.getByTestId('edit-group-button-grp-custom-2');
    await user.click(editBtn);

    expect(mockPush).toHaveBeenCalledWith('/en/workspace/ws-1/group/grp-custom-2');
  });

  it('confirms and deletes a group, then refreshes the list', async () => {
    const user = userEvent.setup();
    mockRemove.mockResolvedValueOnce(undefined);

    render(<WorkspaceGroupTab dict={mockDict} workspaceId="ws-1" />);

    const deleteBtn = screen.getByTestId('delete-group-button-grp-custom-2');
    await user.click(deleteBtn);

    // Confirmation modal should appear
    expect(screen.getByText('Are you sure you want to remove group "Form Reviewers"?')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Remove Group' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith('mock-token', 'grp-custom-2');
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', text: 'Group removed successfully.' }),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
