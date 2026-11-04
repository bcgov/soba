'use client';
import { useState } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Form,
  Heading,
  InlineAlert,
} from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/dictionary';
import type { TeamMember } from '@/src/types/formTeam';
import type { UserSearchScope, UserSearchUser } from '@/src/types/userSearch';
import { SecondaryText } from '@/src/components/SecondaryText';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useCallToken } from '@/src/shared/api/callToken';
import { apiErrorMessage } from '@/src/shared/api/dataError';
import { useFormTeamWriter, useTeamGroups } from '@/src/features/designer/data/useFormTeam';
import { useUserFromSearchWriter } from '@/src/features/user-search/data/useUserSearch';
import { UserSearchPicker } from '@/src/features/user-search/ui/UserSearchPicker';

interface FormTeamMemberFormProps {
  dict: Dictionary;
  formId: string;
  /** The member whose groups are being edited. Left out, the form searches for a user to add. */
  member?: TeamMember;
  onDone: () => void;
}

export default function FormTeamMemberForm({
  dict,
  formId,
  member,
  onDone,
}: Readonly<FormTeamMemberFormProps>) {
  const t = dict.team;
  const tAccess = dict.workspaces.access;
  const groups = useTeamGroups(formId);
  const teamWriter = useFormTeamWriter(formId);
  const scope: UserSearchScope = { kind: 'form', id: formId };
  const userWriter = useUserFromSearchWriter(scope);
  const { signedInToken } = useCallToken();
  const { addNotification } = useNotificationStore();
  const [selectedUser, setSelectedUser] = useState<UserSearchUser | null>(null);
  const [selectedGroups, setSelectedGroups] = useState(member?.groups ?? []);
  const [saving, setSaving] = useState(false);

  // Someone who has never signed in has no CHEFS user; adding them makes one from the directory,
  // which needs the directory's guid for them.
  const userId = selectedUser?.sobaUserId ?? null;
  const notSignedIn = selectedUser !== null && userId === null;
  const directoryGuid = (notSignedIn && selectedUser.guid) || null;
  const hasPerson = member !== undefined || userId !== null || directoryGuid !== null;

  /** The CHEFS user to add; one made for them is kept, so trying again goes straight to the add. */
  const userIdToAdd = async (): Promise<string> => {
    if (userId) return userId;
    if (!selectedUser || !directoryGuid) throw new Error('No person to add');
    const made = await userWriter.create(signedInToken(), {
      identityProvider: selectedUser.identityProvider,
      guid: directoryGuid,
    });
    if (made.status !== 'applied') throw new Error('The CHEFS user was not made');
    setSelectedUser({ ...selectedUser, sobaUserId: made.value.userId });
    return made.value.userId;
  };

  const save = async () => {
    setSaving(true);
    try {
      if (member) await teamWriter.setGroups(member.id, selectedGroups);
      else await teamWriter.add(await userIdToAdd(), selectedGroups);
      addNotification({ text: member ? t.editSuccess : t.addSuccess, type: 'success' });
      onDone();
    } catch (e: unknown) {
      // A coded refusal, such as someone already on the team, says why.
      addNotification({
        text: apiErrorMessage(e, dict.apiErrors) ?? (member ? t.editFailure : t.addFailure),
        type: 'error',
        consoleError: e,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="team-member-form">
      <Heading level={2}>{member ? t.editMember : t.addMember}</Heading>
      {member && (
        <p className="d-flex flex-column mb-4">
          <span>{member.name}</span>
          <SecondaryText>{member.email}</SecondaryText>
        </p>
      )}
      {!member && (
        <>
          <p>{t.searchStep}</p>
          <UserSearchPicker scope={scope} onSelect={setSelectedUser} />
          {notSignedIn ? (
            <div className="mt-3">
              <InlineAlert
                variant={directoryGuid ? 'info' : 'warning'}
                title={tAccess.notSignedInTitle}
                description={directoryGuid ? tAccess.notSignedIn : tAccess.notSignedInNoId}
                data-testid="team-not-signed-in"
              />
            </div>
          ) : null}
        </>
      )}
      <Form
        className="d-flex flex-column gap-4 my-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <CheckboxGroup
          label={member ? t.groups : t.groupsStep}
          description={t.formOnlyHelp}
          value={selectedGroups}
          onChange={setSelectedGroups}
          isRequired
          errorMessage={t.groupsRequired}
        >
          {groups.map((group) => (
            <Checkbox key={group.id} value={group.id} data-testid={`team-group-${group.id}`}>
              {group.name}
            </Checkbox>
          ))}
        </CheckboxGroup>
        <div className="d-flex gap-3">
          <Button
            variant="primary"
            data-testid="team-save-button"
            isDisabled={saving || !hasPerson || selectedGroups.length === 0}
            type="submit"
          >
            {member ? t.saveMember : t.addMember}
          </Button>
          <Button variant="secondary" data-testid="team-cancel-button" onPress={onDone}>
            {dict.general.cancel}
          </Button>
        </div>
      </Form>
    </div>
  );
}
