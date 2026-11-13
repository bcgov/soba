'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Tabs, Tab } from 'react-bootstrap';
import { Button, Select } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { Modal as CommonModal } from '@/src/components/Modal';
import styles from './FormForm.module.css';

import type { FormType } from '@formio/react';
import { newFormSchema } from '@soba/lib';

import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import FormDesigner from '@/src/features/designer/ui/FormDesigner';
import { DynamicForm } from '@/src/features/formio-v5/ui/DynamicForm';
import { usePageHeading, usePageNotices, type PageNotice } from '@/src/components/PageHeader';
import FormSettingsTab from './FormSettingsTab';
import FormTeamTab from './FormTeamTab';
import FormHistoryTab from './FormHistoryTab';
import FormSubmissionTab from './FormSubmissionTab';
import FormShareTab from './FormShareTab';
import FormPostSubmissionTab from '@/src/features/post-submission/ui/FormPostSubmissionTab';
import { usePostSubmissionAvailable } from '@/src/features/post-submission/data/usePostSubmissionAvailable';
import { FormJobsTab } from '@/src/features/jobs/ui/ScopedJobsTabs';
import { withBasePath } from '@/src/shared/config/basePath';
import { useWorkspace } from '@/src/shared/api/useWorkspaces';
import { lookupTruncatedNote, withSelectedOption } from '@/src/shared/list/lookupOptions';
import { useForm, useFormWriter } from '@/src/features/designer/data/useForm';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { useLeaveGuard } from '@/src/shared/hooks/useLeaveGuard';

import type { FormVersionSummary, SobaFormVersionListItem } from '@/src/types/forms';
import { messageForDataError } from '@/src/shared/api/dataError';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import type { DataError } from '@/src/shared/api/dataContracts';
import { Permissions } from '@/src/types/permissions';
import { hasPermission } from '@/src/shared/util/permissions';

type Dict = ReturnType<typeof useDictionary>;

const CREATE_NEW_VERSION_KEY = 'create';

function noticeForLoadError(dict: Dict, loadError: DataError): string {
  return messageForDataError(loadError, {
    sessionExpired: dict.general.sessionExpired,
    forbidden: dict.general.noAccess,
    failed: dict.form.loadFormError,
  });
}

function draftNotices(args: {
  dict: Dict;
  loadError: DataError | null;
  isHistoryView: boolean;
  historicalVersionNo: number | null;
  isCurrentPublished: boolean;
  editsStale: boolean;
  onSwitchToCurrent: () => void;
  onDiscardEdits: () => void;
}): Array<PageNotice | false> {
  const { dict, loadError, isHistoryView, historicalVersionNo, isCurrentPublished } = args;
  return [
    !!loadError && {
      id: 'load-error',
      variant: 'danger' as const,
      body: noticeForLoadError(dict, loadError),
    },
    args.editsStale && {
      id: 'stale-edits',
      variant: 'warning' as const,
      body: dict.form.staleEdits,
      action: { label: dict.form.discardEdits, onPress: args.onDiscardEdits },
    },
    isHistoryView && {
      id: 'history-view',
      variant: 'info' as const,
      title: dict.form.readOnlyMode || 'Read-Only Mode:',
      body: `${dict.form.viewingHistoricalVersion || 'You are viewing historical version'} v${historicalVersionNo}. ${dict.form.savePublishDisabled || 'Save and Publish options are disabled.'}`,
      action: {
        label:
          dict.form.switchToCurrentDraft ||
          'Switch to ' + (dict.form.currentDraft || 'Current Draft'),
        onPress: args.onSwitchToCurrent,
      },
    },
    !isHistoryView &&
      isCurrentPublished && {
        id: 'published-version',
        variant: 'info' as const,
        title: dict.form.publishedVersion || 'Published Version:',
        body:
          dict.form.publishedVersionCannotBeModified ||
          'This version is published and cannot be modified',
      },
  ];
}

const DESIGNER_TAB = 'designer';
const SETTINGS_TAB = 'settings';
const POST_SUBMISSION_TAB = 'post-submission';
const JOBS_TAB = 'jobs';
const ACCESS_TAB = 'team';
const HISTORY_TAB = 'version';
const SUBMISSIONS_TAB = 'submissions';
const SHARE_TAB = 'share';

function useActiveTab(permissions: {
  canSeeDesignTab?: boolean;
  canSeeSettingsTab?: boolean;
  /** Undefined until the feature check answers. */
  canSeePostSubmissionTab?: boolean;
  canSeeAccessTab?: boolean;
  canSeeHistoryTab?: boolean;
  canSeeSubmissionsTab?: boolean;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const requestedTab = searchParams.get('tab') ?? '';
  const [selectedTab, setSelectedTab] = useState('');
  const [openedTabs, setOpenedTabs] = useState<string[]>([]);

  const openTab = (key: string) => {
    setSelectedTab(key);
    setOpenedTabs((opened) => (opened.includes(key) ? opened : [...opened, key]));
    // Kept in the URL, so Back from a page a tab opened returns to that tab. The other params, such
    // as a list's, stay. usePathname omits the base path and replaceState takes the URL as given.
    const params = new URLSearchParams(window.location.search);
    params.set('tab', key);
    window.history.replaceState(null, '', `${withBasePath(pathname)}?${params.toString()}`);
  };

  const permsLoaded =
    permissions.canSeeDesignTab !== undefined &&
    permissions.canSeeSettingsTab !== undefined &&
    permissions.canSeeAccessTab !== undefined &&
    permissions.canSeeHistoryTab !== undefined &&
    permissions.canSeeSubmissionsTab !== undefined;
  // A link to the After Submission tab waits for the feature check rather than open another tab
  // first; no other link waits on it.
  const waitsForRequested =
    requestedTab === POST_SUBMISSION_TAB && permissions.canSeePostSubmissionTab === undefined;

  let activeTab = selectedTab;
  if (!selectedTab && permsLoaded && !waitsForRequested) {
    const validTabs = [
      permissions.canSeeDesignTab && DESIGNER_TAB,
      permissions.canSeeSettingsTab && SETTINGS_TAB,
      permissions.canSeePostSubmissionTab && POST_SUBMISSION_TAB,
      permissions.canSeeAccessTab && ACCESS_TAB,
      permissions.canSeeHistoryTab && HISTORY_TAB,
      permissions.canSeeSubmissionsTab && SUBMISSIONS_TAB,
      // The Jobs tab takes the Settings tab's permission.
      permissions.canSeeSettingsTab && JOBS_TAB,
      SHARE_TAB,
    ].filter(Boolean) as string[];

    activeTab = validTabs.includes(requestedTab) ? requestedTab : validTabs[0];
  }

  if (activeTab && !openedTabs.includes(activeTab)) {
    setOpenedTabs((prev) => [...prev, activeTab]);
  }

  return { activeTab, openedTabs, openTab };
}

function FormForm({ formId }: Readonly<{ formId: string }>) {
  const dict = useDictionary();
  const { authenticated, token, initializing } = useKeycloak();
  const { addNotification } = useNotificationStore();

  const [isSaving, setIsSaving] = useState(false);
  // isSaving lags a render, so a second call in the same task still sees false; this does not.
  const writing = useRef(false);
  const [showPreview, setShowPreview] = useState(false);

  const {
    form,
    versions,
    versionsTruncated,
    versionsLimit,
    currentVersion,
    activeVersion,
    isHistoryView,
    historicalVersionNo,
    selectedVersionId,
    schema: formSchema,
    schemaVersionId,
    name: formName,
    description: formDesc,
    isDirty,
    editsStale,
    loading,
    error: loadError,
    setSchema,
    discardEdits,
    selectVersion,
    openVersion,
    refreshVersions,
  } = useForm(formId);
  const formWriter = useFormWriter(formId);

  // A draft that failed to load leaves nothing to edit, save or publish. Distinct from `loading`,
  // which these reads leave behind for good once a read has failed.
  const draftUnavailable = loading || !!loadError;

  const isCurrentPublished = currentVersion?.state === 'published';
  // When save would take the edits: not on history, a published version, or a version since replaced.
  const canSaveEdits = !isHistoryView && !isCurrentPublished && !editsStale;

  const selectedWorkspaceId = form?.workspaceId ?? null;
  const { workspace: formWorkspace } = useWorkspace(form?.workspaceId);

  usePageHeading({
    heading: formName || undefined,
    eyebrow: formWorkspace?.name || selectedWorkspaceId,
  });

  usePageNotices(
    draftNotices({
      dict,
      loadError,
      isHistoryView,
      historicalVersionNo,
      isCurrentPublished,
      editsStale,
      onSwitchToCurrent: () => selectVersionGuarded('current'),
      onDiscardEdits: discardEdits,
    }),
  );

  useEffect(() => {
    if (!loading && form && !formSchema) {
      setSchema(newFormSchema() as FormType);
    }
  }, [loading, form, formSchema, setSchema]);

  const permissions = useMemo(() => {
    return form?.permissions;
  }, [form?.permissions]);

  const canSeeDesignTab = useMemo(() => {
    return hasPermission(permissions, Permissions.design_update);
  }, [permissions]);

  const canSeeSettingsTab = useMemo(() => {
    return hasPermission(permissions, Permissions.form_update);
  }, [permissions]);

  const canSeeAccessTab = useMemo(() => {
    return hasPermission(permissions, Permissions.team_update);
  }, [permissions]);

  const canSeeHistoryTab = useMemo(() => {
    return hasPermission(permissions, Permissions.design_update);
  }, [permissions]);

  const canSeeSubmissionsTab = useMemo(() => {
    return hasPermission(permissions, Permissions.submission_read);
  }, [permissions]);

  // The tab needs the Settings tab's permission and post-submission available for this form.
  const postSubmissionAvailable = usePostSubmissionAvailable(
    canSeeSettingsTab && form?.workspaceId ? { workspaceId: form.workspaceId, formId } : null,
  );
  const canSeePostSubmissionTab = canSeeSettingsTab && postSubmissionAvailable;

  const { activeTab, openedTabs, openTab } = useActiveTab({
    canSeeDesignTab,
    canSeeSettingsTab,
    canSeePostSubmissionTab,
    canSeeAccessTab,
    canSeeHistoryTab,
    canSeeSubmissionsTab,
  });

  const reportWriteFailure = async (e: unknown, failedText: string) => {
    if (!isConflict(e)) {
      addNotification({ text: failedText, type: 'error', consoleError: e });
      return;
    }
    addNotification({ text: dict.form.versionConflict, type: 'error', consoleError: e });
    // Unsaved edits are kept. The re-read shows the version the server now treats as current.
    await refreshVersions().catch(() => undefined);
  };

  /**
   * Run a new-version write, open the new version in the designer as the current one, and report.
   * it stays out of the form's versions until it is saved. Navigate only on true.
   */
  const applyNewVersion = async (
    run: () => ReturnType<typeof formWriter.createVersion>,
  ): Promise<boolean> => {
    if (writing.current || draftUnavailable || !token) return false;
    writing.current = true;
    setIsSaving(true);
    try {
      const outcome = await run();
      if (outcome.status === 'applied') {
        openVersion(outcome.value);
        addNotification({
          text: dict.form.versionOpened.replace('{version}', String(outcome.value.versionNo)),
          type: 'success',
        });
      }
      return true;
    } catch (e: unknown) {
      // A new version's 409 carries the backend's own reason (the version to copy has no schema),
      // not a form that changed since it was opened.
      if (isConflict(e) && e instanceof Error && e.message) {
        addNotification({ text: e.message, type: 'error', consoleError: e });
        return false;
      }
      await reportWriteFailure(e, dict.form.createVersionError || 'Failed to create new version.');
      return false;
    } finally {
      writing.current = false;
      setIsSaving(false);
    }
  };

  const createNewVersion = (sourceSchema?: FormType): Promise<boolean> =>
    applyNewVersion(() =>
      formWriter.createVersion(
        token as string,
        sourceSchema ?? formSchema,
        schemaVersionId ?? undefined,
      ),
    );

  const restoreVersionAsNew = (version: SobaFormVersionListItem): Promise<boolean> =>
    applyNewVersion(() => formWriter.restoreVersion(token as string, version.id));

  /** Delete a draft version and report. True when it is gone, so the caller can close its prompt. */
  const deleteVersion = async (version: SobaFormVersionListItem): Promise<boolean> => {
    if (writing.current || !token) return false;
    writing.current = true;
    setIsSaving(true);
    try {
      await formWriter.deleteVersion(token, version.id);
      // The designer must not stay on a version that no longer exists.
      if (selectedVersionId === version.id) selectVersion('current');
      addNotification({
        text: dict.form.versionDeleted.replace('{version}', String(version.versionNo)),
        type: 'success',
      });
      return true;
    } catch (e: unknown) {
      // The conflict text is about unsaved edits, which a delete has nothing to do with. A 409 here
      // means the version is no longer a draft, so the re-read shows why the delete was refused.
      addNotification({ text: dict.form.deleteVersionError, type: 'error', consoleError: e });
      if (isConflict(e)) await refreshVersions().catch(() => undefined);
      return false;
    } finally {
      writing.current = false;
      setIsSaving(false);
    }
  };

  const saveFormPublish = async () => {
    await saveForm(true);
  };

  const saveFormDraft = async () => {
    await saveForm(false);
  };

  /** True once the edits are saved. */
  const saveForm = async (publish: boolean = false): Promise<boolean> => {
    if (writing.current || draftUnavailable || !token) return false;
    writing.current = true;
    setIsSaving(true);
    try {
      const schema = (formSchema ?? {}) as FormType;
      let targetId = currentVersion?.id;
      // A form with no saved version, such as a new one left before its first save, gets one here.
      if (!targetId) {
        const created = await formWriter.createVersion(token, schema);
        if (created.status !== 'applied') return false;
        targetId = created.value.id;
      }
      await formWriter.saveSchema(token, targetId, schema, publish);
      addNotification({
        text: publish ? dict.form.published || 'Form published successfully!' : dict.form.saved,
        type: 'success',
      });
      discardEdits();
      return true;
    } catch (e: unknown) {
      await reportWriteFailure(e, dict.form.saveError);
      return false;
    } finally {
      writing.current = false;
      setIsSaving(false);
    }
  };

  // An action that would throw the unsaved edits away, waiting on the person's answer.
  const [pendingLeave, setPendingLeave] = useState<{
    proceed: () => void;
    cancel: () => void;
  } | null>(null);

  /**
   * Runs `action` at once when there is nothing unsaved. Otherwise asks first: save and go on,
   * discard and go on, or stay. Settles with `stayed` when the person stays or the save fails.
   */
  const confirmDiscard = <T,>(action: () => T | Promise<T>, stayed: T): Promise<T> => {
    if (!isDirty) return Promise.resolve(action());
    return new Promise<T>((resolve) => {
      setPendingLeave({
        proceed: () => resolve(action()),
        cancel: () => resolve(stayed),
      });
    });
  };

  useLeaveGuard(isDirty, (proceed) => {
    setPendingLeave({ proceed, cancel: () => undefined });
  });

  const answerLeave = async (answer: 'save' | 'discard' | 'stay') => {
    if (!pendingLeave) return;
    if (answer === 'stay') {
      setPendingLeave(null);
      pendingLeave.cancel();
      return;
    }
    if (answer === 'save' && !(await saveForm(false))) {
      // The failure is reported; the edits are still here to save again or discard.
      setPendingLeave(null);
      pendingLeave.cancel();
      return;
    }
    if (answer === 'discard') discardEdits();
    setPendingLeave(null);
    pendingLeave.proceed();
  };

  const selectVersionGuarded = (versionId: string): void => {
    void confirmDiscard(() => selectVersion(versionId), undefined);
  };

  const restoreVersionGuarded = (version: SobaFormVersionListItem): Promise<boolean> =>
    confirmDiscard(() => restoreVersionAsNew(version), false);

  if (initializing) {
    return <CenteredProgress label={dict.form.loading} />;
  }

  if (!authenticated) {
    return <div className="p-5 text-center">{dict.general.notAuthenticated}</div>;
  }

  // The page notice reports the error. With no form there are no permissions to pick a tab from.
  if (loadError && !form) {
    return null;
  }

  if (!activeTab) {
    return <CenteredProgress label={dict.form.loading} />;
  }

  const renderFormBuilder = () => {
    if (loadError) {
      return (
        <div className="my-4" data-testid="designer-load-error">
          {noticeForLoadError(dict, loadError)}
        </div>
      );
    }
    if (loading) {
      return <CenteredProgress label={dict.form.loading} />;
    }
    return (
      <FormDesigner
        // FormDesigner takes its model once at mount. Switching to a version already in the cache
        // produces no loading frame, so without this the previous version stays on screen.
        key={activeVersion?.id}
        onUpdateModel={setSchema}
        initialModel={formSchema}
        formName={formName}
        versionNo={currentVersion?.versionNo ?? null}
        state={currentVersion?.state ?? null}
        isDirty={isDirty}
      />
    );
  };

  const getNewVersionLabel = (): string => {
    if (isSaving) return dict.form.creating || 'Creating...';
    if (isHistoryView) return dict.form.restoreAsNewVersion || 'Restore as New Version';
    return dict.form.newVersion || 'New Version';
  };

  function versionSelectItems(
    currentLabel: string,
    currentVersion: FormVersionSummary | null,
    options: FormVersionSummary[],
  ) {
    return [
      {
        id: CREATE_NEW_VERSION_KEY,
        label: getNewVersionLabel(),
      },
      {
        id: 'current',
        label: currentVersion?.versionNo
          ? `${currentLabel} (v${currentVersion.versionNo})`
          : currentLabel,
      },
      ...options
        .filter((v) => v.id !== currentVersion?.id)
        .map((v) => ({ id: v.id, label: `v${v.versionNo} (${v.state})` })),
    ];
  }

  const renderToolBar = () => {
    if (draftUnavailable) {
      return <></>;
    }
    return (
      <div className={`${styles.stickyActions} p-3 d-flex align-items-end gap-2 w-100`}>
        <div className="d-flex gap-2">
          <Button
            variant="secondary"
            onPress={saveFormDraft}
            data-testid="save-form-button"
            isDisabled={isHistoryView || isCurrentPublished || editsStale || isSaving || loading}
          >
            {isSaving ? dict.form.saving || 'Saving...' : dict.form.save || 'Save'}
          </Button>
          <Button
            variant="secondary"
            data-testid="preview-form-button"
            onPress={() => setShowPreview(true)}
            isDisabled={isSaving || loading}
          >
            {dict.form.preview || 'Preview'}
          </Button>
          <span className="d-inline-flex" title={getPublishTitle()}>
            <Button
              variant="primary"
              data-testid="publish-form-button"
              onPress={saveFormPublish}
              isDisabled={isHistoryView || isCurrentPublished || isDirty || isSaving || loading}
            >
              {dict.form.publish || 'Publish'}
            </Button>
          </span>
          <div className="border-start border-secondary mx-2" style={{ borderWidth: '2px' }} />
        </div>
        <span className="d-inline-flex">
          <Select
            data-testid="form-version-select"
            aria-label={dict.form.formVersion || 'Form Version'}
            selectedKey={selectedVersionId || 'current'}
            onSelectionChange={(key) => selectVersionFromDrop(String(key))}
            description={lookupTruncatedNote(dict.general.lookupTruncated, {
              truncated: versionsTruncated,
              limit: versionsLimit,
            })}
            items={versionSelectItems(
              dict.form.currentDraft || 'Current Draft',
              currentVersion,
              withSelectedOption(versions, isHistoryView ? activeVersion : null),
            )}
          />
        </span>
      </div>
    );
  };

  const getPublishTitle = (): string => {
    if (isHistoryView) return dict.form.cannotPublishHistory || 'Cannot publish history';
    if (isCurrentPublished) return dict.form.versionAlreadyPublished || 'Version already published';
    if (isDirty) return dict.form.saveChangesBeforePublishing || 'Save changes before publishing';
    return dict.form.publishForm || 'Publish form';
  };

  const selectVersionFromDrop = (key: string): void => {
    // A new version carries the edits with it, so only opening another version loses them.
    if (key === CREATE_NEW_VERSION_KEY) {
      void createNewVersion();
    } else {
      selectVersionGuarded(key);
    }
  };

  const renderDesignerContent = () => (
    <>
      {renderToolBar()}
      {/* Form Builder */}
      <div className={styles.designerWrapper}>{renderFormBuilder()}</div>
    </>
  );

  return (
    <>
      <Tabs
        id="form-designer-tabs"
        aria-label={dict.form.designerTabs || 'Form Designer tabs'}
        activeKey={activeTab}
        onSelect={(k) => {
          if (k) openTab(k);
        }}
        className="mb-3"
        // A tab's data is read when it is opened, not before: the reads behind these tabs are
        // gated on permissions a given user may not hold.
        mountOnEnter
      >
        {canSeeDesignTab && (
          <Tab
            eventKey={DESIGNER_TAB}
            tabAttrs={{ 'data-testid': 'designer-tab' }}
            title={dict.form.designerTab || 'Designer'}
          >
            {renderDesignerContent()}
          </Tab>
        )}
        {canSeeSettingsTab && (
          <Tab
            eventKey={SETTINGS_TAB}
            tabAttrs={{ 'data-testid': 'settings-tab' }}
            disabled={isSaving || draftUnavailable}
            title={dict.form.settingsTab || 'Settings'}
          >
            <FormSettingsTab dict={dict} formId={formId} />
          </Tab>
        )}
        {canSeePostSubmissionTab && (
          <Tab
            eventKey={POST_SUBMISSION_TAB}
            tabAttrs={{ 'data-testid': 'post-submission-tab' }}
            disabled={isSaving || draftUnavailable}
            title={dict.postSubmission.tab}
          >
            <FormPostSubmissionTab dict={dict} formId={formId} />
          </Tab>
        )}
        {canSeeAccessTab && (
          <Tab
            eventKey={ACCESS_TAB}
            tabAttrs={{ 'data-testid': 'team-tab' }}
            disabled={isSaving || draftUnavailable}
            title={dict.form.teamTab || 'Team'}
          >
            <FormTeamTab dict={dict} formId={formId} />
          </Tab>
        )}
        {canSeeHistoryTab && (
          <Tab
            eventKey={HISTORY_TAB}
            tabAttrs={{ 'data-testid': 'version-tab' }}
            disabled={isSaving || draftUnavailable}
            title={dict.form.historyTab || 'History'}
          >
            <FormHistoryTab
              dict={dict}
              formId={formId}
              onSelectVersion={selectVersionGuarded}
              onRestoreVersion={restoreVersionGuarded}
              onDeleteVersion={deleteVersion}
              onNavigateToDesigner={() => openTab(DESIGNER_TAB)}
            />
          </Tab>
        )}
        {canSeeSubmissionsTab && (
          <Tab
            eventKey={SUBMISSIONS_TAB}
            tabAttrs={{ 'data-testid': 'submission-tab' }}
            disabled={isSaving || draftUnavailable}
            title={dict.form.submissionTab || 'Submissions'}
          >
            <FormSubmissionTab
              dict={dict}
              formId={formId}
              opened={openedTabs.includes(SUBMISSIONS_TAB)}
            />
          </Tab>
        )}
        {canSeeSettingsTab && (
          <Tab
            eventKey={JOBS_TAB}
            tabAttrs={{ 'data-testid': 'jobs-tab' }}
            // Not held back by the draft: jobs do not depend on the form's schema.
            disabled={isSaving}
            title={dict.jobs.heading}
          >
            <FormJobsTab formId={formId} />
          </Tab>
        )}
        <Tab
          eventKey={SHARE_TAB}
          tabAttrs={{ 'data-testid': 'share-tab' }}
          disabled={isSaving || draftUnavailable}
          title={dict.form.shareTab || 'Share'}
        >
          <FormShareTab
            dict={dict}
            formId={formId}
            formName={formName}
            formDesc={formDesc}
            workspaceId={selectedWorkspaceId}
          />
        </Tab>
      </Tabs>

      <CommonModal
        show={!!pendingLeave}
        title={dict.form.unsavedChangesTitle}
        onClose={() => void answerLeave('stay')}
        size="sm"
        footer={
          <>
            {canSaveEdits && (
              <Button
                variant="primary"
                isDisabled={isSaving}
                onPress={() => void answerLeave('save')}
                data-testid="pending-unsaved-save"
              >
                {dict.form.unsavedChangesSave}
              </Button>
            )}
            <Button
              variant="secondary"
              isDisabled={isSaving}
              onPress={() => void answerLeave('discard')}
              data-testid="pending-unsaved-discard"
            >
              {dict.form.unsavedChangesDiscard}
            </Button>
            <Button
              variant="tertiary"
              isDisabled={isSaving}
              onPress={() => void answerLeave('stay')}
              data-testid="pending-unsaved-stay"
            >
              {dict.form.unsavedChangesStay}
            </Button>
          </>
        }
      >
        <p data-testid="pending-unsaved-message">
          {canSaveEdits ? dict.form.unsavedChangesMessage : dict.form.unsavedChangesCannotSave}
        </p>
      </CommonModal>

      {/* Preview Modal */}
      <CommonModal
        show={showPreview}
        title={`${dict.form.formPreview || 'Form Preview:'} ${formName || dict.form.untitledForm || 'Untitled Form'}`}
        onClose={() => setShowPreview(false)}
        size="lg"
        footer={
          <Button
            variant="secondary"
            data-testid="close-preview-button"
            onPress={() => setShowPreview(false)}
          >
            {dict.form.closePreview || 'Close Preview'}
          </Button>
        }
      >
        {formSchema ? (
          <DynamicForm src="" form={formSchema} />
        ) : (
          <p className="text-center p-5 text-muted">
            {dict.form.noFormLayout || 'No form layout designed yet.'}
          </p>
        )}
      </CommonModal>
    </>
  );
}

export default FormForm;
