import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import dict from '@/dictionaries/en.json';

let allowed: boolean | null;
vi.mock('@/app/[lang]/Providers', () => ({ useDictionary: () => dict }));
vi.mock('@/src/features/designer/data/formTeamApi', async () => {
  const { formTeamApiMock } = await import('./formTeamTestKit');
  return formTeamApiMock;
});
vi.mock('@/src/features/user-search/data/useUserSearch', () => ({
  useUserSearchAllowed: () => allowed,
  useUserFromSearchWriter: () => ({ create: vi.fn() }),
}));
vi.mock('@/src/features/user-search/ui/UserSearchPicker', () => ({
  UserSearchPicker: () => <div data-testid="picker" />,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/build/f1',
  useSearchParams: () => new URLSearchParams(''),
}));

import FormTeamTab from '@/src/features/designer/ui/FormTeamTab';
import {
  clickTestId,
  failWrites,
  formTeamApiMock,
  renderWithStore,
  resetTeam,
  serverMember,
} from './formTeamTestKit';

const renderTab = () => renderWithStore(<FormTeamTab dict={dict} formId="f1" />);

const confirmRemoveOf = async (memberId: string) => {
  await clickTestId(`${memberId}-remove-link`);
  await screen.findByTestId('confirm-modal-message');
  await clickTestId('confirm-modal-confirm');
};

describe('FormTeamTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowed = true;
    resetTeam();
  });

  it("lists each member with their groups, read from the form's team", async () => {
    renderTab();
    expect(await screen.findByTestId('m-dax-group-2-tag')).toBeInTheDocument();
    expect(screen.getByTestId('team-list')).toHaveTextContent('Dax Halloran');
    expect(screen.getByTestId('team-list')).toHaveTextContent('dax.halloran@example.gov.bc.ca');
    expect(screen.queryByTestId('m-dax-group-1-tag')).toBeNull();
    expect(formTeamApiMock.listFormTeam).toHaveBeenCalledWith(
      'token',
      'f1',
      expect.objectContaining({ offset: 0 }),
    );
  });

  it('marks the groups someone has on this form only', async () => {
    await formTeamApiMock.addFormTeamMember('token', 'f1', {
      userId: 'tobin',
      groupIds: ['group-3'],
    });
    renderTab();
    expect(await screen.findByTestId('m-tobin-group-3-tag')).toHaveTextContent(
      'Group 3 (this form only)',
    );
    expect(screen.getByTestId('m-dax-group-2-tag')).toHaveTextContent(/^Group 2$/);
  });

  // The team is real now: nothing on the tab says it is sample data.
  it('shows no sample data notice', async () => {
    renderTab();
    await screen.findByTestId('m-dax-edit-link');
    expect(screen.queryByTestId('team-sample-notice')).toBeNull();
  });

  it('opens the add form and comes back on cancel', async () => {
    renderTab();
    await clickTestId('team-add-button');
    expect(screen.getByTestId('team-member-form')).toHaveTextContent('1. Search for a user:');
    expect(screen.getByTestId('picker')).toBeInTheDocument();
    expect(screen.queryByTestId('team-list')).toBeNull();

    await clickTestId('team-cancel-button');
    expect(screen.getByTestId('team-list')).toBeInTheDocument();
  });

  it('offers no add when user search is not allowed, or until that is known', () => {
    allowed = false;
    const { unmount } = renderTab();
    expect(screen.getByTestId('team-list')).toBeInTheDocument();
    expect(screen.queryByTestId('team-add-button')).toBeNull();
    unmount();

    allowed = null;
    renderTab();
    expect(screen.queryByTestId('team-add-button')).toBeNull();
  });

  it('opens the edit form with the member and their groups', async () => {
    renderTab();
    await screen.findByTestId('m-dax-edit-link');
    await clickTestId('m-dax-edit-link');
    const form = screen.getByTestId('team-member-form');
    expect(form).toHaveTextContent('Edit Team Member');
    expect(form).toHaveTextContent('Dax Halloran');
    expect(form).not.toHaveTextContent('1. Search for a user:');
    expect(await screen.findByRole('checkbox', { name: 'Group 2' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Group 1' })).not.toBeChecked();
  });

  it('keeps the member when the remove is cancelled', async () => {
    renderTab();
    await screen.findByTestId('m-dax-remove-link');
    await clickTestId('m-dax-remove-link');
    expect(await screen.findByTestId('confirm-modal-message')).toHaveTextContent(
      'Dax Halloran will lose access to this form.',
    );
    await clickTestId('confirm-modal-cancel');

    await waitFor(() => expect(screen.queryByTestId('confirm-modal-message')).toBeNull());
    expect(screen.getByTestId('m-dax-edit-link')).toBeInTheDocument();
    expect(formTeamApiMock.removeFormTeamMember).not.toHaveBeenCalled();
  });

  // The ticket: what the tab shows is what was saved, so it survives a reload.
  it('removes the member on the server once confirmed, and lists the saved team', async () => {
    renderTab();
    await screen.findByTestId('m-dax-remove-link');
    await confirmRemoveOf('m-dax');

    await waitFor(() => expect(screen.queryByTestId('m-dax-edit-link')).toBeNull());
    expect(formTeamApiMock.removeFormTeamMember).toHaveBeenCalledWith('token', 'f1', 'm-dax');
    expect(serverMember('m-dax')).toBeUndefined();
    expect(screen.getByTestId('m-orla-edit-link')).toBeInTheDocument();
  });

  it('keeps the member when the remove fails', async () => {
    failWrites();
    renderTab();
    await screen.findByTestId('m-dax-remove-link');
    await confirmRemoveOf('m-dax');

    await waitFor(() => expect(screen.queryByTestId('confirm-modal-message')).toBeNull());
    expect(screen.getByTestId('m-dax-edit-link')).toBeInTheDocument();
    expect(serverMember('m-dax')).toBeDefined();
  });
});
