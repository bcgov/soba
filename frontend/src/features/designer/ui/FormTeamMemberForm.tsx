'use client';
import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Form,
  Heading,
  Radio,
  RadioGroup,
} from '@bcgov/design-system-react-components';

import type { Dictionary } from '@/src/types/dictionary';
import type { TeamMember, UserSearchResult } from '@/src/types/formTeam';
import { DataTable, type Column } from '@/src/components/DataTable';
import { ListPageSearchField } from '@/src/components/ListPageSearchField';
import { SecondaryText } from '@/src/components/SecondaryText';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import {
  useFormTeamWriter,
  useTeamGroups,
  useUserSearch,
} from '@/src/features/designer/data/useFormTeam';
import { DEFAULT_PAGE_SIZE } from '@/src/shared/list/useListQuery';

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
  const groups = useTeamGroups();
  const teamWriter = useFormTeamWriter(formId);
  const { addNotification } = useNotificationStore();
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedGroups, setSelectedGroups] = useState(member?.groups ?? []);
  const [saving, setSaving] = useState(false);
  const users = useUserSearch(formId, q);

  const search = () => {
    setQ(searchInput);
    setPage(1);
    setSelectedUser(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (member) await teamWriter.setGroups(member.id, selectedGroups);
      if (selectedUser) await teamWriter.add(selectedUser, selectedGroups);
      addNotification({ text: member ? t.editSuccess : t.addSuccess, type: 'success' });
      onDone();
    } catch (e: unknown) {
      addNotification({
        text: member ? t.editFailure : t.addFailure,
        type: 'error',
        consoleError: e,
      });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<UserSearchResult>[] = useMemo(
    () => [
      {
        key: 'select',
        label: '',
        // Someone already on the team is changed through Edit, so they are marked and cannot be
        // picked. Text inside the radio group needs a slot, so the mark is the radio's own label.
        render: (user) => {
          const name = `${user.firstName} ${user.lastName}`;
          return (
            <Radio
              value={user.id}
              isDisabled={user.onTeam}
              aria-label={(user.onTeam ? t.onTeamLabel : t.select).replace('{name}', name)}
              data-testid={`${user.id}-select`}
            >
              {user.onTeam ? t.onTeam : undefined}
            </Radio>
          );
        },
      },
      { key: 'firstName', label: t.firstName },
      { key: 'lastName', label: t.lastName },
      { key: 'email', label: t.email },
      { key: 'identityProvider', label: t.identityProvider },
    ],
    [t],
  );

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
          <div className="mb-3">
            <ListPageSearchField
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={search}
              testIdPrefix="team-user"
            />
          </div>
          {q.trim() && (
            // One user is added at a time, so the rows are a single radio group.
            <RadioGroup
              aria-label={t.searchResults}
              value={selectedUser?.id ?? null}
              onChange={(id) => setSelectedUser(users.find((user) => user.id === id) ?? null)}
            >
              <DataTable<UserSearchResult>
                data={users.slice((page - 1) * pageSize, page * pageSize)}
                columns={columns}
                emptyMessage={t.noUsersFound}
                caption={t.searchResults}
                totalItems={users.length}
                pageSize={pageSize}
                currentPage={page}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                keyExtractor={(user) => user.id}
              />
            </RadioGroup>
          )}
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
            isDisabled={saving || !(member || selectedUser)}
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
