'use client';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, Tab } from 'react-bootstrap';
import { Button, Select } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { Modal as CommonModal } from '@/src/components/Modal';
import styles from './FormForm.module.css';

import type { FormType } from '@formio/react';

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
import { useWorkspace } from '@/src/shared/api/useWorkspaces';
import { lookupTruncatedNote, withSelectedOption } from '@/src/shared/list/lookupOptions';
import { useForm, useFormWriter } from '@/src/features/designer/data/useForm';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

import type { FormVersionSummary, SobaFormVersionListItem } from '@/src/types/forms';
import { messageForDataError } from '@/src/shared/api/dataError';
import { isConflict } from '@/src/shared/api/sobaHelpers';
import type { DataError } from '@/src/shared/api/dataContracts';

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

function FormForm({ formId }: Readonly<{ formId: string }>) {
  const dict = useDictionary();
  const { authenticated, token, initializing } = useKeycloak();
  const { addNotification } = useNotificationStore();

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'designer');
  // A tab's read starts when it is first opened and stays cached after: leaving is not a reason to
  // drop what it loaded, and the reads behind these tabs are gated on permissions a user may lack.
  const [openedTabs, setOpenedTabs] = useState<string[]>(() => [activeTab]);
  const openTab = useCallback((key: string) => {
    setActiveTab(key);
    setOpenedTabs((opened) => (opened.includes(key) ? opened : [...opened, key]));
  }, []);
  const [isSaving, setIsSaving] = useState(false);
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
    name: formName,
    description: formDesc,
    isDirty,
    editsStale,
    loading,
    error: loadError,
    setSchema,
    discardEdits,
    selectVersion,
    refreshVersions,
  } = useForm(formId);
  const formWriter = useFormWriter(formId);

  // A draft that failed to load leaves nothing to edit, save or publish. Distinct from `loading`,
  // which these reads leave behind for good once a read has failed.
  const draftUnavailable = loading || !!loadError;

  const isCurrentPublished = currentVersion?.state === 'published';

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
      onSwitchToCurrent: () => selectVersion('current'),
      onDiscardEdits: discardEdits,
    }),
  );

  useEffect(() => {
    if (!loading && form && !formSchema) {
      setSchema({ components: [] });
    }
  }, [loading, form, formSchema, setSchema]);

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
   * Run a new-version write, then select the new draft in-page (it has the highest versionNo, so it
   * is the form's current version once the form is read again) and report. Navigate only on true.
   */
  const applyNewVersion = async (
    run: () => ReturnType<typeof formWriter.createVersion>,
  ): Promise<boolean> => {
    if (isSaving || draftUnavailable || !token) return false;
    setIsSaving(true);
    try {
      const outcome = await run();
      selectVersion('current');
      if (outcome.status === 'applied') {
        addNotification({
          text: (
            dict.form.versionDraftCreated || 'Version {version} draft created successfully!'
          ).replace('{version}', String(outcome.value.versionNo)),
          type: 'success',
        });
      }
      return true;
    } catch (e: unknown) {
      await reportWriteFailure(e, dict.form.createVersionError || 'Failed to create new version.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const createNewVersion = (sourceSchema?: FormType): Promise<boolean> =>
    applyNewVersion(() =>
      formWriter.createVersion(token as string, (sourceSchema ?? formSchema ?? {}) as FormType),
    );

  const restoreVersionAsNew = (version: SobaFormVersionListItem): Promise<boolean> =>
    applyNewVersion(() => formWriter.restoreVersion(token as string, version.id));

  const saveFormPublish = async () => {
    await saveForm(true);
  };

  const saveFormDraft = async () => {
    await saveForm(false);
  };

  const saveForm = async (publish: boolean = false) => {
    if (isSaving || draftUnavailable) return;
    // An existing form with no current version. Saving here would file the edits under a second form.
    if (!currentVersion?.id) return;
    setIsSaving(true);
    try {
      await formWriter.saveSchema(
        token as string,
        currentVersion.id,
        (formSchema ?? {}) as FormType,
        publish,
      );
      addNotification({
        text: publish ? dict.form.published || 'Form published successfully!' : dict.form.saved,
        type: 'success',
      });
      discardEdits();
    } catch (e: unknown) {
      await reportWriteFailure(e, dict.form.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  if (initializing) {
    return <CenteredProgress label={dict.form.loading} />;
  }

  if (!authenticated) {
    return <div className="p-5 text-center">{dict.general.notAuthenticated}</div>;
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
    if (key === CREATE_NEW_VERSION_KEY) {
      createNewVersion();
    } else {
      selectVersion(key);
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
        onSelect={(k) => openTab(k || 'designer')}
        className="mb-3"
        // A tab's data is read when it is opened, not before: the reads behind these tabs are
        // gated on permissions a given user may not hold.
        mountOnEnter
      >
        <Tab
          eventKey="designer"
          tabAttrs={{ 'data-testid': 'designer-tab' }}
          title={dict.form.designerTab || 'Designer'}
        >
          {renderDesignerContent()}
        </Tab>
        <Tab
          eventKey="settings"
          tabAttrs={{ 'data-testid': 'settings-tab' }}
          disabled={isSaving || draftUnavailable}
          title={dict.form.settingsTab || 'Settings'}
        >
          <FormSettingsTab dict={dict} formId={formId} />
        </Tab>
        <Tab
          eventKey="team"
          tabAttrs={{ 'data-testid': 'team-tab' }}
          disabled={isSaving || draftUnavailable}
          title={dict.form.teamTab || 'Team'}
        >
          <FormTeamTab dict={dict} />
        </Tab>
        <Tab
          eventKey="version"
          tabAttrs={{ 'data-testid': 'version-tab' }}
          disabled={isSaving || draftUnavailable}
          title={dict.form.historyTab || 'History'}
        >
          <FormHistoryTab
            dict={dict}
            formId={formId}
            onSelectVersion={selectVersion}
            onRestoreVersion={restoreVersionAsNew}
            onNavigateToDesigner={() => openTab('designer')}
          />
        </Tab>
        <Tab
          eventKey="submissions"
          tabAttrs={{ 'data-testid': 'submission-tab' }}
          disabled={isSaving || draftUnavailable}
          title={dict.form.submissionTab || 'Submissions'}
        >
          <FormSubmissionTab
            dict={dict}
            formId={formId}
            opened={openedTabs.includes('submissions')}
          />
        </Tab>
        <Tab
          eventKey="share"
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
