'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ListPageToolbar } from '@/src/components/ListPageLayout';
import { DataTable, type Column } from '@/src/components/DataTable';
import { RowActionButton } from '@/src/components/RowActionButton';
import { Button } from '@bcgov/design-system-react-components';
import { ConfirmModal } from '@/src/components/ConfirmModal';
import { Tag } from '@/src/components/Tag';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { navLink, WORKSPACE_GROUPS_LIST_QUERY } from '@/src/shared/list/listQueryMemory';
import { useListQuery } from '@/src/shared/list/useListQuery';
import { useDataTable } from '@/src/shared/list/useDataTable';
import { ListPageSearchField } from '@/src/components/ListPageSearchField';
import type { Dictionary } from '@/src/types/dictionary';
import {
  useRolesMeta,
  useWorkspaceGroups,
  useWorkspaceGroupsWriter,
} from '../data/workspaceGroupsApi';
import type { WorkspaceGroup } from '../types/groups';

export interface WorkspaceGroupTabProps {
  dict: Dictionary;
  workspaceId?: string;
  formId?: string;
  opened?: boolean;
}

export function WorkspaceGroupTab({ dict, workspaceId, formId }: Readonly<WorkspaceGroupTabProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const actualWorkspaceId = workspaceId ?? formId;
  const t = dict.workspaces.groups;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();

  const query = useListQuery(WORKSPACE_GROUPS_LIST_QUERY);
  const { searchInput, setSearchInput, commitSearch } = query;

  const groupsResult = useWorkspaceGroups(actualWorkspaceId, {
    offset: query.offset,
    limit: query.pageSize,
    sort: query.sort,
    q: query.q,
  });
  const { table, refresh } = useDataTable(query, groupsResult, t.loadError);

  const { roles } = useRolesMeta();
  const writer = useWorkspaceGroupsWriter(actualWorkspaceId);

  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<WorkspaceGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenAdd = useCallback(() => {
    if (!actualWorkspaceId) return;
    router.push(navLink(`/${locale}/workspace/${actualWorkspaceId}/group`));
  }, [actualWorkspaceId, router, locale]);

  const handleOpenEdit = useCallback(
    (group: WorkspaceGroup) => {
      if (!actualWorkspaceId) return;
      router.push(navLink(`/${locale}/workspace/${actualWorkspaceId}/group/${group.id}`));
    },
    [actualWorkspaceId, router, locale],
  );

  const handleOpenDelete = useCallback((group: WorkspaceGroup) => {
    setConfirmDeleteGroup(group);
  }, []);

  const handleDeleteGroup = async () => {
    if (!token || !confirmDeleteGroup) return;
    setIsDeleting(true);
    try {
      await writer.remove(token, confirmDeleteGroup.id);
      addNotification({ text: t.deleteSuccess, type: 'success' });
      setConfirmDeleteGroup(null);
      await refresh();
    } catch (err: unknown) {
      addNotification({
        text: t.deleteError,
        type: 'error',
        consoleError: err,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const roleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const custom = t.roleNames as Record<string, string> | undefined;
    for (const r of roles) {
      map.set(r.roleCode, custom?.[r.roleCode] ?? r.name);
    }
    return map;
  }, [roles, t.roleNames]);

  const columns: Column<WorkspaceGroup>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t.columns.name,
        width: '30%',
        sortField: 'name',
        render: (group) => <span data-testid={`group-name-${group.id}`}>{group.name}</span>,
      },
      {
        key: 'roles',
        label: t.columns.roles,
        width: '30%',
        render: (group) => {
          if (!group.roles || group.roles.length === 0) {
            return <span>{t.noRolesSelected}</span>;
          }
          return (
            <>
              {group.roles.map((code) => {
                const custom = (t.roleNames as Record<string, string> | undefined)?.[code];
                const label = custom ?? roleNameMap.get(code) ?? code;
                return (
                  <Tag
                    key={code}
                    text={label}
                    color="blue"
                    data-testid={`group-role-${group.id}-${code}`}
                  />
                );
              })}
            </>
          );
        },
      },
      {
        key: 'actions',
        label: t.columns.actions,
        width: '10%',
        align: 'end',
        render: (group) => (
          <div>
            <RowActionButton
              onPress={() => handleOpenEdit(group)}
              aria-label={`${t.editGroup}: ${group.name}`}
              data-testid={`edit-group-button-${group.id}`}
            >
              {t.editGroup}
            </RowActionButton>
            {!group.system && (
              <RowActionButton
                onPress={() => handleOpenDelete(group)}
                aria-label={`${t.deleteGroup}: ${group.name}`}
                data-testid={`delete-group-button-${group.id}`}
              >
                {t.deleteGroup}
              </RowActionButton>
            )}
          </div>
        ),
      },
    ],
    [t, roleNameMap, handleOpenEdit, handleOpenDelete],
  );

  return (
    <div data-testid="workspace-groups-tab-content">
      <ListPageToolbar>
        <ListPageSearchField
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={commitSearch}
          testIdPrefix="forms"
        />
        <Button
          variant="primary"
          data-testid="create-ws-group-button"
          onPress={() => handleOpenAdd()}
        >
          {t.addGroup}
        </Button>
      </ListPageToolbar>

      <DataTable<WorkspaceGroup>
        {...table}
        columns={columns}
        emptyMessage={t.empty}
        loadingMessage={dict.general.loading}
        itemName="items"
        keyExtractor={(item) => item.id}
      />

      {confirmDeleteGroup && (
        <ConfirmModal
          show={Boolean(confirmDeleteGroup)}
          title={t.deleteConfirmTitle}
          message={t.deleteConfirmMessage.replace('{name}', confirmDeleteGroup.name)}
          confirmLabel={t.deleteGroup}
          onConfirm={() => void handleDeleteGroup()}
          onCancel={() => {
            if (!isDeleting) setConfirmDeleteGroup(null);
          }}
          pending={isDeleting}
        />
      )}
    </div>
  );
}

export default WorkspaceGroupTab;
