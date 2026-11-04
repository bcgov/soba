import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import dict from '@/dictionaries/en.json';
import type { UserSearchScope, UserSearchUser } from '@/src/types/userSearch';

const { createUser } = vi.hoisted(() => ({ createUser: vi.fn() }));

vi.mock('@/src/features/designer/data/formTeamApi', async () => {
  const { formTeamApiMock } = await import('./formTeamTestKit');
  return formTeamApiMock;
});
vi.mock('@/src/features/user-search/data/useUserSearch', () => ({
  useUserFromSearchWriter: () => ({ create: createUser }),
}));
vi.mock('@/src/features/user-search/ui/UserSearchPicker', () => ({
  UserSearchPicker: ({
    scope,
    onSelect,
  }: {
    scope: UserSearchScope;
    onSelect?: (user: UserSearchUser | null) => void;
  }) => (
    <div data-testid="picker" data-scope={`${scope.kind}:${scope.id}`}>
      {[tobin, dax, noId].map((person) => (
        <button
          key={person.subject}
          type="button"
          data-testid={`pick-${person.subject}`}
          onClick={() => onSelect?.(person)}
        >
          {person.displayName}
        </button>
      ))}
      <button type="button" data-testid="pick-clear" onClick={() => onSelect?.(null)}>
        Clear
      </button>
    </div>
  ),
}));

import FormTeamMemberForm from '@/src/features/designer/ui/FormTeamMemberForm';
import type { TeamMember } from '@/src/types/formTeam';
import {
  click,
  clickTestId,
  failWrites,
  foundPerson,
  formTeamApiMock,
  renderWithStore,
  resetTeam,
  serverMember,
} from './formTeamTestKit';

const onDone = vi.fn();
const FORM_ID = 'f1';
const GROUPS_REQUIRED = 'Select at least one group.';
/** Never signed in: adding them makes their CHEFS user first. */
const tobin = foundPerson('tobin', 'Venn, Tobin');
/** Signed in before, and already on the team as m-dax. */
const dax = foundPerson('dax', 'Halloran, Dax', 'dax');
/** Never signed in, and the directory gave no id to make their user with. */
const noId = foundPerson('noid', 'Nobody, Noid', null, null);
const DAX: TeamMember = {
  id: 'm-dax',
  name: 'Dax Halloran',
  email: 'dax.halloran@example.gov.bc.ca',
  groups: ['group-2'],
  formOnlyGroups: [],
};

const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const tick = async (name: string) => click(await screen.findByRole('checkbox', { name }));
const pick = (person: UserSearchUser) => clickTestId(`pick-${person.subject}`);
const save = () => clickTestId('team-save-button');

const renderForm = (member?: TeamMember) =>
  renderWithStore(
    <FormTeamMemberForm dict={dict} formId={FORM_ID} member={member} onDone={onDone} />,
  );

describe('FormTeamMemberForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeam();
    createUser.mockResolvedValue({ status: 'applied', value: { userId: 'tobin' } });
  });

  it('searches the form for a person to add', () => {
    renderForm();
    expect(screen.getByTestId('team-member-form')).toHaveTextContent('1. Search for a user:');
    expect(screen.getByTestId('picker')).toHaveAttribute('data-scope', `form:${FORM_ID}`);
  });

  it('does not search when editing a member', () => {
    renderForm(DAX);
    expect(screen.queryByTestId('picker')).toBeNull();
  });

  it('says the groups apply to this form only', async () => {
    renderForm();
    await screen.findByRole('checkbox', { name: 'Group 1' });
    expect(screen.getByTestId('team-member-form')).toHaveTextContent(
      'These groups apply to this form only.',
    );
  });

  it('holds the add until a person and a group are picked', async () => {
    renderForm();
    expect(screen.getByTestId('team-save-button')).toBeDisabled();

    await pick(tobin);
    expect(screen.getByTestId('team-save-button')).toBeDisabled();
    await tick('Group 3');
    expect(screen.getByTestId('team-save-button')).toBeEnabled();

    await clickTestId('pick-clear');
    expect(screen.getByTestId('team-save-button')).toBeDisabled();
  });

  it('makes the CHEFS user of someone who never signed in, then adds them', async () => {
    renderForm();
    await pick(tobin);
    expect(screen.getByTestId('team-not-signed-in')).toBeInTheDocument();
    await tick('Group 3');
    await save();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(createUser).toHaveBeenCalledWith('token', {
      identityProvider: 'azureidir',
      guid: 'guid-tobin',
    });
    expect(formTeamApiMock.addFormTeamMember).toHaveBeenCalledWith('token', FORM_ID, {
      userId: 'tobin',
      groupIds: ['group-3'],
    });
    expect(serverMember('m-tobin')?.groups).toEqual(['group-3']);
  });

  it('cannot add someone the directory gave no id for until they sign in', async () => {
    renderForm();
    await pick(noId);
    await tick('Group 1');

    expect(screen.getByTestId('team-not-signed-in')).toHaveTextContent('They can be added once');
    expect(screen.getByTestId('team-save-button')).toBeDisabled();
  });

  it('says why when the person is already on the team, and keeps their groups', async () => {
    renderForm();
    await pick(dax);
    await tick('Group 1');
    await save();

    await waitFor(() => expect(screen.getByTestId('team-save-button')).toBeEnabled());
    expect(onDone).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
    expect(serverMember('m-dax')?.groups).toEqual(['group-2']);
  });

  it('saves the edited groups of a member', async () => {
    renderForm(DAX);
    await tick('Group 1');
    await save();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(serverMember('m-dax')?.groups).toEqual(['group-2', 'group-1']);
  });

  it('asks for a group instead of saving a member with none', async () => {
    renderForm(DAX);
    await tick('Group 2');
    expect(screen.getByTestId('team-save-button')).toBeDisabled();
    expect(serverMember('m-dax')?.groups).toEqual(['group-2']);
  });

  it('marks the groups as required', async () => {
    renderForm();
    await screen.findByRole('checkbox', { name: 'Group 1' });
    expect(screen.getByRole('group', { name: /Assign groups.*\(required\)/ })).toBeInTheDocument();
    expect(screen.queryByText(GROUPS_REQUIRED)).toBeNull();
  });

  it('keeps the picked person and groups when the add fails', async () => {
    failWrites();
    renderForm();
    await pick(tobin);
    await tick('Group 3');
    await save();

    await waitFor(() => expect(screen.getByTestId('team-save-button')).toBeEnabled());
    expect(onDone).not.toHaveBeenCalled();
    expect(checkbox('Group 3')).toBeChecked();
    expect(serverMember('m-tobin')).toBeUndefined();
  });

  it('changes nothing on cancel', async () => {
    renderForm();
    await pick(tobin);
    await clickTestId('team-cancel-button');
    expect(onDone).toHaveBeenCalled();
    expect(formTeamApiMock.addFormTeamMember).not.toHaveBeenCalled();
  });
});
