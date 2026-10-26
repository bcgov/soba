'use client';

import { useCallback, useEffect, useState, useMemo, type Key } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { navLink } from '@/src/shared/list/listQueryMemory';
import { Tabs, Tab } from 'react-bootstrap';
import {
  Button,
  Form,
  Checkbox,
  TextField,
  Select,
  InlineAlert,
} from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { usePageHeading } from '@/src/components/PageHeader';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { codeItems } from '@/src/shared/util/codeList';
import { useSortLocale } from '@/src/shared/list/useSortLocale';
import { useWorkspace, useWorkspaceWriter } from '@/src/shared/api/useWorkspaces';
import { useCurrentUser } from '@/src/shared/api/useCurrentUser';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { isWorkspaceManageRole } from '../workspaceRoles';
import WorkspaceFormSettings from '@/src/features/form-settings/ui/WorkspaceFormSettings';
import type { UpdateWorkspaceBody, WorkspaceItem } from '@/src/types/workspaces';
import styles from './WorkspaceForm.module.css';
import WorkspaceGroupTab from './WorkspaceGroupTab';

/** Only the fields that differ from what the form was seeded with. */
function changedFields(
  seed: WorkspaceItem,
  fields: { name: string; org: string; useCase: string; disclaimerAccepted: boolean },
): UpdateWorkspaceBody {
  const patch: UpdateWorkspaceBody = {};
  if (fields.name !== seed.name) patch.name = fields.name;
  if (fields.org !== seed.org) patch.org = fields.org;
  if (fields.useCase !== seed.useCase) patch.useCase = fields.useCase;
  if (fields.disclaimerAccepted !== seed.disclaimerAccepted) {
    patch.disclaimerAccepted = fields.disclaimerAccepted;
  }
  return patch;
}

type WorkspaceSettingsProps = {
  /** The workspace being edited, or null to create one. Seeds the fields on mount. */
  workspace: WorkspaceItem | null;
  first: boolean;
};

function WorkspaceSettings({ workspace, first }: Readonly<WorkspaceSettingsProps>) {
  const isCreate = workspace === null;
  const dict = useDictionary();
  const sortLocale = useSortLocale();
  const dictWorkspaces = dict.workspaces;
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const { token } = useKeycloak();
  const workspaceWriter = useWorkspaceWriter();
  const { addNotification } = useNotificationStore();

  // What the fields were seeded from. The `workspace` prop moves with a revalidation while the
  // fields cannot, so the saved value is diffed against what the user was actually shown.
  const [seed] = useState(workspace);
  const [name, setName] = useState(seed?.name ?? '');
  const [org, setOrg] = useState(seed?.org ?? '');
  const [useCase, setUseCase] = useState(seed?.useCase ?? '');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(seed?.disclaimerAccepted ?? false);
  const [saving, setSaving] = useState(false);

  const valid = useMemo(() => {
    return name.trim().length > 0 && useCase !== '' && org !== '';
  }, [name, useCase, org]);

  const handleUseCaseChange = useCallback((newUseCase: Key | null) => {
    setUseCase(newUseCase?.toString() ?? '');
  }, []);

  const handleOrgChange = useCallback((newOrg: Key | null) => {
    setOrg(newOrg?.toString() ?? '');
  }, []);

  const handleCancel = useCallback(() => {
    router.push(navLink(`/${locale}/workspaces`));
  }, [router, locale]);

  const handleSave = useCallback(async () => {
    if (!token) return;
    const trimmedName = name.trim();

    setSaving(true);
    try {
      if (!seed) {
        await workspaceWriter.create(token, {
          name: trimmedName,
          disclaimerAccepted,
          useCase,
          org,
        });
      } else {
        // Sending the untouched fields too would carry the values this person was shown over
        // anything edited elsewhere since, reverting it without either of them seeing.
        const patch = changedFields(seed, { name: trimmedName, org, useCase, disclaimerAccepted });
        // Saving an unchanged workspace is a no-op, not a request.
        if (Object.keys(patch).length === 0) {
          router.push(navLink(`/${locale}/workspaces`));
          return;
        }
        await workspaceWriter.update(token, seed.id, patch);
      }

      router.push(navLink(`/${locale}/workspaces`));
    } catch (error) {
      addNotification({
        text: seed ? dictWorkspaces.saveError : dictWorkspaces.createError,
        type: 'error',
        consoleError: error,
      });
    } finally {
      setSaving(false);
    }
  }, [
    name,
    org,
    useCase,
    token,
    seed,
    disclaimerAccepted,
    workspaceWriter,
    router,
    locale,
    addNotification,
    dictWorkspaces.createError,
    dictWorkspaces.saveError,
  ]);

  const saveLabel = isCreate ? dictWorkspaces.create : dictWorkspaces.save;

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        handleSave().catch(() => undefined);
      }}
      className={`${styles.fieldStack} ${first ? styles.fieldStackFill : ''}`}
    >
      <TextField
        label={dictWorkspaces.nameLabel}
        value={name}
        onChange={setName}
        isRequired
        isDisabled={saving}
        data-testid="workspace-name"
      />
      <Select
        items={codeItems(dict.ministries, seed?.org, sortLocale)}
        label={dictWorkspaces.yourOrgReq}
        selectionMode="single"
        size="medium"
        data-testid="workspace-your-org"
        isRequired={true}
        isDisabled={saving}
        value={org}
        onChange={handleOrgChange}
      />
      <Select
        items={codeItems(dict.useCases, seed?.useCase, sortLocale)}
        label={dictWorkspaces.useCase}
        selectionMode="single"
        size="medium"
        data-testid="workspace-use-case"
        isRequired={true}
        isDisabled={saving}
        value={useCase}
        onChange={handleUseCaseChange}
      />
      <InlineAlert
        description={dictWorkspaces.disclaimer}
        title={dictWorkspaces.disclaimerTitle}
        variant="info"
        data-testid="workspace-disclaimer-alert"
      />
      <Checkbox
        isSelected={disclaimerAccepted}
        onChange={setDisclaimerAccepted}
        isDisabled={saving}
        aria-label={dictWorkspaces.disclaimerLabel}
        data-testid="workspace-disclaimer-switch"
      >
        {dictWorkspaces.disclaimerLabel}
      </Checkbox>
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={saving || !valid}
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
}

type WorkspaceFormProps = {
  workspaceId?: string;
  first?: boolean;
};

function WorkspaceForm({ workspaceId, first = false }: Readonly<WorkspaceFormProps>) {
  const isCreate = !workspaceId;
  const dict = useDictionary();
  const dictWorkspaces = dict.workspaces;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname);
  const { authenticated, initializing } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const { data: currentUser, loaded: currentUserLoaded } = useCurrentUser();
  const { workspace, isLoading } = useWorkspace(workspaceId);

  const tabParam = searchParams.get('tab');
  const validTabs = useMemo(() => ['settings', 'form-settings', 'groups'], []);
  const currentTabFromUrl = tabParam && validTabs.includes(tabParam) ? tabParam : 'settings';

  const [activeTab, setActiveTab] = useState(currentTabFromUrl);
  const [prevTabParam, setPrevTabParam] = useState(tabParam);

  if (tabParam !== prevTabParam) {
    setPrevTabParam(tabParam);
    setActiveTab(currentTabFromUrl);
  }

  useEffect(() => {
    if (!authenticated || initializing || !currentUserLoaded) {
      return;
    }
    if (isCreate && !currentUser?.capabilities?.canCreateWorkspace) {
      addNotification({
        text: dictWorkspaces.createForbidden,
        type: 'error',
      });
      router.push(navLink(`/${locale}/workspaces`));
    }
  }, [
    isCreate,
    currentUser,
    currentUserLoaded,
    authenticated,
    initializing,
    addNotification,
    dictWorkspaces.createForbidden,
    router,
    locale,
  ]);

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

  const heading = isCreate ? dictWorkspaces.createHeading : dictWorkspaces.manageHeading;
  // The first-workspace flow runs inside a modal over another page, whose heading it must not take.
  usePageHeading({ heading: first ? undefined : heading });

  if (!authenticated && !initializing) {
    return <p>{dict.general.notAuthenticated}</p>;
  }

  if (isLoading) {
    return <CenteredProgress label={dict.general.loading} />;
  }

  if (isCreate) {
    return (
      <>
        {first && <p>{dictWorkspaces.defaultWorkspaceIntro}</p>}
        <WorkspaceSettings workspace={null} first={first} />
      </>
    );
  }

  // Editing without the record would post the empty form as a new workspace.
  if (!workspace) {
    return (
      <InlineAlert
        description={dictWorkspaces.loadError}
        title={dictWorkspaces.manageHeading}
        variant="warning"
        data-testid="workspace-load-error"
      />
    );
  }

  return (
    <Tabs
      id="workspace-manage-tabs"
      activeKey={activeTab}
      onSelect={(k) => {
        const nextTab = k || 'settings';
        setActiveTab(nextTab);
        setPrevTabParam(nextTab === 'settings' ? null : nextTab);
        if (workspace?.id) {
          const params = new URLSearchParams(window.location.search);
          if (nextTab === 'settings') {
            params.delete('tab');
          } else {
            params.set('tab', nextTab);
          }
          const qs = params.toString();
          const targetUrl = qs
            ? `/${locale}/workspace/${workspace.id}?${qs}`
            : `/${locale}/workspace/${workspace.id}`;
          window.history.replaceState(null, '', targetUrl);
        }
      }}
      className="mb-3"
      mountOnEnter
    >
      <Tab eventKey="settings" title={dictWorkspaces.settingsTab}>
        <div className={styles.tabContent}>
          <WorkspaceSettings key={workspace.id} workspace={workspace} first={first} />
        </div>
      </Tab>
      <Tab
        eventKey="form-settings"
        title={dictWorkspaces.formSettingsTab}
        tabAttrs={{ 'data-testid': 'workspace-form-settings-tab' }}
      >
        <div className={styles.tabContent}>
          <WorkspaceFormSettings key={workspace.id} dict={dict} workspaceId={workspace.id} />
        </div>
      </Tab>
      <Tab
        eventKey="groups"
        title={dictWorkspaces.groupsTab}
        tabAttrs={{ 'data-testid': 'workspace-groups-tab' }}
      >
        <div className={styles.tabContent}>
          <WorkspaceGroupTab
            dict={dict}
            workspaceId={workspace.id}
            formId={workspace.id}
            opened={true}
          />
        </div>
      </Tab>
    </Tabs>
  );
}

export default WorkspaceForm;
