'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button, Checkbox, InlineAlert, TextField } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { usePageHeading } from '@/src/components/PageHeader';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { navLink } from '@/src/shared/list/listQueryMemory';
import { useWorkspace } from '@/src/shared/api/useWorkspaces';
import { isWorkspaceManageRole } from '../workspaceRoles';
import {
  useRolesMeta,
  useWorkspaceGroups,
  useWorkspaceGroupsWriter,
} from '../data/workspaceGroupsApi';
import type { RoleMeta, WorkspaceGroup } from '../types/groups';

interface GroupFieldsProps {
  workspaceId: string;
  group: WorkspaceGroup | null;
  roles: RoleMeta[];
}

function GroupFields({ workspaceId, group, roles }: Readonly<GroupFieldsProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const dict = useDictionary();
  const t = dict.workspaces.groups;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const writer = useWorkspaceGroupsWriter(workspaceId);

  const isEdit = group !== null;
  const isSystem = group?.system === true;

  const [name, setName] = useState(group?.name ?? '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(group?.roles ?? []);
  const [saving, setSaving] = useState(false);

  const isValid = useMemo(() => name.trim().length > 0, [name]);

  const toggleRole = (roleCode: string) => {
    if (isSystem || saving) return;
    setSelectedRoles((prev) =>
      prev.includes(roleCode) ? prev.filter((r) => r !== roleCode) : [...prev, roleCode],
    );
  };

  const handleCancel = () => {
    router.push(navLink(`/${locale}/workspace/${workspaceId}?tab=groups`));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isValid || saving) return;

    setSaving(true);
    try {
      if (group) {
        await writer.update(token, group, {
          name: name.trim(),
          roleCodes: selectedRoles,
        });
        addNotification({ text: t.updateSuccess, type: 'success' });
      } else {
        await writer.create(token, {
          name: name.trim(),
          roleCodes: selectedRoles,
        });
        addNotification({ text: t.createSuccess, type: 'success' });
      }
      router.push(navLink(`/${locale}/workspace/${workspaceId}?tab=groups`));
    } catch (err: unknown) {
      addNotification({
        text: group ? t.updateError : t.createError,
        type: 'error',
        consoleError: err,
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleDisplayName = (roleCode: string, defaultName: string): string => {
    const custom = t.roleNames as Record<string, string> | undefined;
    return custom?.[roleCode] ?? defaultName;
  };

  let submitLabel = isEdit ? t.save : t.create;
  if (saving) {
    submitLabel = t.saving;
  }

  return (
    <form onSubmit={(e) => void handleSave(e)}>
      {isSystem && (
        <div>
          <InlineAlert
            title={t.systemGroup}
            description={t.systemGroupTooltip}
            variant="info"
            data-testid="system-group-alert"
          />
        </div>
      )}

      <div>
        <TextField
          label={t.name}
          value={name}
          onChange={setName}
          isRequired
          isDisabled={saving || isSystem}
          data-testid="group-name-input"
        />
      </div>

      <div>
        <div className="my-2">
          <p>{t.roles}:</p>
        </div>

        <div>
          {roles.map((role) => {
            const isSelected = selectedRoles.includes(role.roleCode);
            return (
              <div key={role.roleCode} className="my-2">
                <Checkbox
                  isSelected={isSelected}
                  onChange={() => toggleRole(role.roleCode)}
                  isDisabled={saving || isSystem}
                  aria-label={getRoleDisplayName(role.roleCode, role.name)}
                  data-testid={`role-checkbox-${role.roleCode}`}
                >
                  <span>{getRoleDisplayName(role.roleCode, role.name)}</span>
                </Checkbox>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Button
          type="submit"
          variant="primary"
          isDisabled={!isValid || saving}
          data-testid="group-submit-button"
          className="me-2 bcds-react-aria-Button medium primary"
        >
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          isDisabled={saving}
          onPress={handleCancel}
          data-testid="group-cancel-button"
        >
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

export interface WorkspaceGroupFormProps {
  workspaceId: string;
  groupId?: string;
}

export function WorkspaceGroupForm({ workspaceId, groupId }: Readonly<WorkspaceGroupFormProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const dict = useDictionary();
  const dictWorkspaces = dict.workspaces;
  const t = dictWorkspaces.groups;
  const { authenticated, initializing } = useKeycloak();
  const { addNotification } = useNotificationStore();

  const isEdit = Boolean(groupId && groupId !== 'new');

  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceId);
  const { groups, isLoading: isGroupsLoading } = useWorkspaceGroups(workspaceId);
  const { roles } = useRolesMeta();

  useEffect(() => {
    if (!workspace || isWorkspaceManageRole(workspace.role)) {
      return;
    }
    addNotification({
      text: dictWorkspaces.manageForbidden,
      type: 'error',
    });
    router.push(navLink(`/${locale}/workspaces`));
  }, [workspace, addNotification, dictWorkspaces.manageForbidden, router, locale]);

  const existingGroup = useMemo(() => {
    if (!isEdit || !groupId) return null;
    return groups.find((g) => g.id === groupId) ?? null;
  }, [groups, isEdit, groupId]);

  const heading = isEdit ? t.editGroup : t.addGroup;
  usePageHeading({ heading, eyebrow: workspace?.name });

  if (initializing || isWorkspaceLoading || (isEdit && isGroupsLoading)) {
    return <CenteredProgress label={dict.general.loading} />;
  }

  if (!authenticated) {
    return <p>{dict.general.notAuthenticated}</p>;
  }

  if (isEdit && !isGroupsLoading && !existingGroup) {
    return (
      <div>
        <InlineAlert
          title={t.loadError}
          description={t.empty}
          variant="warning"
          data-testid="group-not-found-alert"
        />
        <div>
          <Button
            variant="secondary"
            onPress={() => router.push(navLink(`/${locale}/workspace/${workspaceId}?tab=groups`))}
            data-testid="group-back-button"
          >
            {t.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <GroupFields
      key={existingGroup?.id ?? 'create'}
      workspaceId={workspaceId}
      group={existingGroup}
      roles={roles}
    />
  );
}

export default WorkspaceGroupForm;
