'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Form,
  Heading,
  InlineAlert,
  TextField,
} from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { apiErrorMessage, messageForDataError } from '@/src/shared/api/dataError';
import { useAuthErrorDefaults } from '@/src/shared/api/useDataErrorNotice';
import { useRolesMeta } from '@/src/shared/api/useRolesMeta';
import type { Dictionary } from '@/src/types/dictionary';
import type { RoleWithSourceMeta, WorkspaceGroup } from '@/src/types/workspaceGroups';
import { useWorkspaceGroup } from '../data/useWorkspaceGroup';
import { useWorkspaceGroupsWriter } from '../data/useWorkspaceGroupsWriter';
import { groupRoleLabel } from '../groupRoleLabel';
import styles from './WorkspaceForm.module.css';

export interface WorkspaceGroupFormProps {
  dict: Dictionary;
  workspaceId: string;
  /** The group to edit. Left out, the form creates one. */
  groupId?: string;
  onDone: () => void;
}

/**
 * Create or edit a workspace group. An edit reads the group on its own rather than taking the
 * list's row, so the fields start from the group as it is now.
 */
export function WorkspaceGroupForm({
  dict,
  workspaceId,
  groupId,
  onDone,
}: Readonly<WorkspaceGroupFormProps>) {
  const t = dict.workspaces.groups;
  const authDefaults = useAuthErrorDefaults();
  const roles = useRolesMeta();
  const record = useWorkspaceGroup(workspaceId, groupId ?? null);
  const sectionRef = useRevealOnOpen();
  const headingId = useId();

  let content: React.ReactNode;
  if (record.error) {
    // Editing without the record would post the empty fields as a new group.
    content = (
      <Unavailable
        message={messageForDataError(record.error, { ...authDefaults, failed: t.groupLoadError })}
        testId="group-load-error"
        cancelLabel={t.cancel}
        onCancel={onDone}
      />
    );
  } else if (roles.error) {
    // Without the role list there is nothing to choose from, and a save would send no roles.
    content = (
      <Unavailable
        message={messageForDataError(roles.error, { ...authDefaults, failed: t.rolesLoadError })}
        testId="group-roles-error"
        cancelLabel={t.cancel}
        onCancel={onDone}
      />
    );
  } else if (!roles.data || (groupId && !record.group)) {
    // Also covers a read still waiting on the session, which reports no loading of its own.
    content = <CenteredProgress label={dict.general.loading} />;
  } else {
    content = (
      <GroupFields
        key={record.group?.id ?? 'new'}
        dict={dict}
        workspaceId={workspaceId}
        group={record.group}
        roles={roles.data}
        onDone={onDone}
      />
    );
  }

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="mt-4 pt-3 border-top"
      data-testid={groupId ? 'workspace-group-edit-form' : 'workspace-group-create-form'}
    >
      <Heading level={2} id={headingId}>
        {groupId ? t.editGroup : t.addGroup}
      </Heading>
      {content}
    </section>
  );
}

/**
 * The form opens under the table, which on a long list is below the fold. Bring it into view and
 * move focus to it, so the press visibly did something and a keyboard or screen reader user lands
 * on it rather than on the button above. Runs once per opening: the tab remounts the form for each.
 */
function useRevealOnOpen() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Optional: jsdom has no layout, so no scrollIntoView.
    element.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);
  return ref;
}

interface UnavailableProps {
  message: string;
  testId: string;
  cancelLabel: string;
  onCancel: () => void;
}

function Unavailable({ message, testId, cancelLabel, onCancel }: Readonly<UnavailableProps>) {
  return (
    <>
      <InlineAlert description={message} variant="danger" data-testid={testId} />
      <div className={styles.actions}>
        <Button variant="secondary" onPress={onCancel} data-testid="group-cancel-button">
          {cancelLabel}
        </Button>
      </div>
    </>
  );
}

interface GroupFieldsProps {
  dict: Dictionary;
  workspaceId: string;
  /** The group as read for this form, or null to create one. Seeds the fields on mount. */
  group: WorkspaceGroup | null;
  roles: RoleWithSourceMeta[];
  onDone: () => void;
}

function GroupFields({ dict, workspaceId, group, roles, onDone }: Readonly<GroupFieldsProps>) {
  const t = dict.workspaces.groups;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const writer = useWorkspaceGroupsWriter(workspaceId);

  const [name, setName] = useState(group?.name ?? '');
  const [roleCodes, setRoleCodes] = useState<string[]>(group?.roles ?? []);
  const [saving, setSaving] = useState(false);
  const [seed] = useState(group);

  // A system group is protected: shown for reference, with nothing to save.
  const isSystem = group?.system === true;
  const trimmedName = name.trim();
  const canSave = Boolean(token) && trimmedName.length > 0 && !saving && !isSystem;

  const save = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    try {
      const fields = { name: trimmedName, roleCodes };
      if (group) await writer.update(token, seed, fields);
      else await writer.create(token, fields);
      addNotification({ text: group ? t.updateSuccess : t.createSuccess, type: 'success' });
      onDone();
    } catch (err: unknown) {
      // A coded refusal, such as a name already in use, says why; anything else is generic.
      addNotification({
        text: apiErrorMessage(err, dict.apiErrors) ?? (group ? t.updateError : t.createError),
        type: 'error',
        consoleError: err,
      });
    } finally {
      setSaving(false);
    }
  };

  let saveLabel = group ? t.save : t.create;
  if (saving) saveLabel = t.saving;

  return (
    <Form
      className={styles.fieldStack}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {isSystem && (
        <InlineAlert
          title={t.systemGroup}
          description={t.systemGroupTooltip}
          variant="info"
          data-testid="system-group-alert"
        />
      )}
      <TextField
        label={t.name}
        value={name}
        onChange={setName}
        isRequired
        isDisabled={saving || isSystem}
        data-testid="group-name-input"
      />
      <CheckboxGroup
        label={t.roles}
        description={t.rolesHelp}
        value={roleCodes}
        onChange={setRoleCodes}
        isDisabled={saving || isSystem}
      >
        {roles.map((role) => (
          <Checkbox
            key={role.roleCode}
            value={role.roleCode}
            data-testid={`role-checkbox-${role.roleCode}`}
          >
            {groupRoleLabel(dict, role.roleCode, role.name)}
          </Checkbox>
        ))}
      </CheckboxGroup>
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={!canSave}
          data-testid="group-submit-button"
        >
          {saveLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          isDisabled={saving}
          onPress={onDone}
          data-testid="group-cancel-button"
        >
          {t.cancel}
        </Button>
      </div>
    </Form>
  );
}

export default WorkspaceGroupForm;
