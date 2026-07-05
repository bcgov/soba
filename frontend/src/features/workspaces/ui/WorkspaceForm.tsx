'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Tabs, Tab } from 'react-bootstrap';
import {
  Button,
  Form,
  Switch,
  TextField,
} from '@bcgov/design-system-react-components';
import { FormSubmitterAudience } from '@/src/features/designer/ui/FormSubmitterAudience';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { ListPageLayout } from '@/src/components/ListPageLayout';
import { DsPageHeading } from '@/app/ui/DsPageHeading';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { useAppDispatch, useAppSelector } from '@/lib/store';
import { loadWorkspaces } from '@/lib/slices/workspaceSlice';
import { loadCurrentUser, updateDefaultWorkspace } from '@/lib/slices/currentUserSlice';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import {
  createWorkspace,
  selectWorkspace,
  updateWorkspace,
} from '@/src/shared/api/sobaApi';
import { isWorkspaceManageRole } from '../workspaceRoles';
import styles from './WorkspaceForm.module.css';

type WorkspaceFormProps = {
  workspaceId?: string;
};

function WorkspaceForm({ workspaceId }: Readonly<WorkspaceFormProps>) {
  const isCreate = !workspaceId;
  const dict = useDictionary();
  const dictWorkspaces = dict.workspaces;
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const { authenticated, token, initializing } = useKeycloak();
  const dispatch = useAppDispatch();
  const { addNotification } = useNotificationStore();
  const { data: currentUser, status: currentUserStatus } = useAppSelector(
    (state) => state.currentUser,
  );

  const savedDefaultId = currentUser?.preferences?.defaultWorkspaceId ?? null;

  const [name, setName] = useState('');
  const [loadedName, setLoadedName] = useState('');
  const [defaultTouched, setDefaultTouched] = useState(false);
  const [isDefaultChoice, setIsDefaultChoice] = useState(false);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  let savedDefaultMatches = false;
  if (!isCreate) {
    savedDefaultMatches = savedDefaultId === workspaceId;
  }
  const isDefault = defaultTouched ? isDefaultChoice : savedDefaultMatches;

  useEffect(() => {
    if (authenticated && token && currentUserStatus === 'idle') {
      dispatch(loadCurrentUser(token));
    }
  }, [authenticated, token, currentUserStatus, dispatch]);

  useEffect(() => {
    if (!authenticated || initializing || currentUserStatus !== 'succeeded') {
      return;
    }
    if (isCreate && !currentUser?.capabilities?.canCreateWorkspace) {
      addNotification({
        text: dictWorkspaces.createForbidden,
        type: 'error',
      });
      router.push(`/${locale}/workspaces`);
    }
  }, [
    isCreate,
    currentUser,
    currentUserStatus,
    authenticated,
    initializing,
    addNotification,
    dictWorkspaces.createForbidden,
    router,
    locale,
  ]);

  useEffect(() => {
    if (!token || isCreate) return;

    let cancelled = false;
    void selectWorkspace(token, workspaceId)
      .then((workspace) => {
        if (cancelled) return;
        if (!isWorkspaceManageRole(workspace.role)) {
          addNotification({
            text: dictWorkspaces.manageForbidden,
            type: 'error',
          });
          router.push(`/${locale}/workspaces`);
          return;
        }
        setName(workspace.name);
        setLoadedName(workspace.name);
      })
      .catch((error) => {
        if (cancelled) return;
        addNotification({
          text: dictWorkspaces.loadError,
          type: 'error',
          consoleError: error,
        });
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per workspace id
  }, [token, workspaceId, isCreate]);

  const handleDefaultChange = useCallback((selected: boolean) => {
    setDefaultTouched(true);
    setIsDefaultChoice(selected);
  }, []);

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/workspaces`);
  }, [router, locale]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!token || !trimmedName) return;

    setSaving(true);
    try {
      let savedId = workspaceId ?? null;

      if (isCreate) {
        const created = await createWorkspace(token, { name: trimmedName });
        savedId = created.id;
      } else if (trimmedName !== loadedName) {
        await updateWorkspace(token, workspaceId, { name: trimmedName });
      }

      // Only change the stored default when the user's intent is explicit. An untouched
      // switch must preserve the existing default — otherwise creating a second
      // (non-default) workspace would clear the first one's default.
      let nextDefaultId: string | null;
      if (isDefault) {
        nextDefaultId = savedId;
      } else if (!isCreate && savedDefaultMatches) {
        // The user turned the switch off on the workspace that is currently the default.
        nextDefaultId = null;
      } else {
        nextDefaultId = savedDefaultId;
      }
      if (nextDefaultId !== savedDefaultId) {
        await dispatch(
          updateDefaultWorkspace({
            token,
            defaultWorkspaceId: nextDefaultId,
          }),
        ).unwrap();
      }

      await dispatch(loadWorkspaces(token));
      router.push(`/${locale}/workspaces`);
    } catch (error) {
      addNotification({
        text: isCreate ? dictWorkspaces.createError : dictWorkspaces.saveError,
        type: 'error',
        consoleError: error,
      });
    } finally {
      setSaving(false);
    }
  }, [
    name,
    token,
    isCreate,
    workspaceId,
    loadedName,
    isDefault,
    savedDefaultMatches,
    savedDefaultId,
    dispatch,
    router,
    locale,
    addNotification,
    dictWorkspaces.createError,
    dictWorkspaces.saveError,
  ]);

  if (!authenticated && !initializing) {
    return <p>{dict.general.notAuthenticated}</p>;
  }

  if (loading) {
    return <CenteredProgress label={dict.general.loading} />;
  }

  const heading = isCreate ? dictWorkspaces.createHeading : dictWorkspaces.manageHeading;
  const saveLabel = isCreate ? dictWorkspaces.create : dictWorkspaces.save;
  const defaultLabel = dictWorkspaces.defaultWorkspaceFormLabel;

  const settingsForm = (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        handleSave().catch(() => undefined);
      }}
      className={styles.fieldStack}
    >
      <TextField
        label={dictWorkspaces.nameLabel}
        value={name}
        onChange={setName}
        isRequired
        isDisabled={saving}
        data-testid="workspace-name"
      />
      <Switch
        isSelected={isDefault}
        onChange={handleDefaultChange}
        isDisabled={saving}
        aria-label={defaultLabel}
        data-testid="workspace-default-switch"
      >
        {defaultLabel}
      </Switch>
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={saving || !name.trim()}
          data-testid="workspace-save"
        >
          {saving ? dict.general.loading : saveLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onPress={handleCancel}
          isDisabled={saving}
          data-testid="workspace-cancel"
        >
          {dictWorkspaces.cancel}
        </Button>
      </div>
    </Form>
  );

  return (
    <ListPageLayout>
      <DsPageHeading id="workspace-form-heading">{heading}</DsPageHeading>
      {isCreate ? (
        settingsForm
      ) : (
        <Tabs
          id="workspace-manage-tabs"
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || 'settings')}
          className="mb-3"
          mountOnEnter
        >
          <Tab eventKey="settings" title={dictWorkspaces.settingsTab}>
            <div className={styles.tabContent}>{settingsForm}</div>
          </Tab>
          <Tab eventKey="team" title={dictWorkspaces.teamTab}>
            <div className={styles.tabContent}>
              <FormSubmitterAudience
                workspaceId={workspaceId ?? null}
                token={token ?? undefined}
                canManage
              />
            </div>
          </Tab>
        </Tabs>
      )}
    </ListPageLayout>
  );
}

export default WorkspaceForm;
