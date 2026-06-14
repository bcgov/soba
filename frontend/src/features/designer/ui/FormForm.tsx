'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Tabs, Tab } from 'react-bootstrap';
import {
  ProgressCircle,
  InlineAlert,
  Button,
  Form,
  TextField,
  TextArea,
  Select,
  CheckboxGroup,
  Checkbox,
  Modal as BCModal,
  AlertDialog,
} from '@bcgov/design-system-react-components';
import { FaInfoCircle } from 'react-icons/fa';
import { Modal as CommonModal } from '@/src/components/Modal';
import styles from './FormForm.module.css';

import type { FormType } from '@formio/react';

import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import FormDesigner from '@/src/features/designer/ui/FormDesigner';
import { DynamicForm } from '@/src/features/formio-v5/ui/DynamicForm';
import FormSettingsTab from './FormSettingsTab';
import FormTeamTab from './FormTeamTab';
import { useAppSelector } from '@/lib/store';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';

import {
  createSobaFormioForm,
  createFormVersion,
  saveFormVersionSchema,
  getFormVersionSchema,
  getSobaForm,
  getSobaFormVersions,
  publishSobaFormVersion,
  updateSobaFormVersionVisibility,
} from '@/src/shared/api/sobaApi';
import type { SobaFormType, SobaFormVersionType } from '@/src/types/forms';

/** Converts a human-readable title into a URL-safe slug. */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function FormForm({ id }: { id?: string[] }) {
  const dict = useDictionary();
  const router = useRouter();
  const params = useParams();
  const lang = params.lang as string;

  const { authenticated, token, initializing } = useKeycloak();
  const { activeWorkspaceId } = useAppSelector((state) => state.workspace);
  const { addNotification } = useNotificationStore();
  const [activeTab, setActiveTab] = useState('designer');
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSchema, setFormSchema] = useState<FormType | null>(null);
  const [currentVersion, setCurrentVersion] = useState<SobaFormVersionType | null>(null);
  const [visibility, setVisibility] = useState<string[]>([]);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [versions, setVersions] = useState<SobaFormVersionType[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [historicalVersionNo, setHistoricalVersionNo] = useState<number | null>(null);

  const VISIBILITY_OPTIONS = [
    { value: 'public', label: dict.form.visibilityPublic || 'Public' },
    { value: 'azureidir', label: dict.form.visibilityAzureIDIR || 'IDIR - MFA' },
  ];

  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);

  useEffect(() => {
    const formId = id?.[0];
    if (formId && token) {
      async function loadForm() {
        setLoading(true);
        try {
          const ws = activeWorkspaceId || undefined;
          const [form, versionsData] = await Promise.all([
            getSobaForm(token as string, formId as string, ws),
            getSobaFormVersions(token as string, formId as string, ws),
          ]);

          setFormName(form?.name ?? '');
          setFormSlug(form?.slug ?? '');
          setFormDesc(form?.description ?? '');
          setSlugManuallyEdited(true);

          const items = versionsData.items || [];
          setVersions(items);

          // Default to the highest versionNo (the current/latest version).
          const current = items.reduce<SobaFormVersionType | null>(
            (acc, v) => (!acc || v.versionNo > acc.versionNo ? v : acc),
            null,
          );
          setCurrentVersion(current);
          setSelectedVersionId('current');
          setIsHistoryView(false);
          setVisibility(current?.visibility ?? []);

          if (current?.id) {
            const schema = await getFormVersionSchema(token as string, current.id, ws);
            setFormSchema((schema as FormType) ?? null);
          } else {
            setFormSchema(null);
          }
          setIsDirty(false);
        } catch (e: unknown) {
          addNotification({
            text: `${dict.form.loadFormError || 'Failed to load form:'} ${(e as Error).message}`,
            type: 'error',
            consoleError: e,
          });
        } finally {
          setLoading(false);
        }
      }
      loadForm();
    }
  }, [id, token, activeWorkspaceId, dict.form.loadFormError, addNotification]);

  const handleNameChange = useCallback(
    (name: string) => {
      setFormName(name);
      if (!slugManuallyEdited) {
        setFormSlug(titleToSlug(name));
      }
      setIsDirty(true);
    },
    [slugManuallyEdited],
  );

  const updateDescription = (value: string) => {
    setFormDesc(value);
    setIsDirty(true);
  };

  const updateFormSchema = useCallback((data: FormType) => {
    setFormSchema(data);
    setIsDirty(true);
  }, []);

  const loadVersionSchema = async (version: SobaFormVersionType) => {
    setLoading(true);
    try {
      const schema = await getFormVersionSchema(
        token as string,
        version.id,
        activeWorkspaceId || undefined,
      );
      setFormSchema((schema as FormType) ?? null);
      setVisibility(version.visibility ?? []);
      setIsDirty(false);
    } catch (err) {
      addNotification({
        text: dict.form.loadVersionSchemaError || 'Failed to load version schema.',
        type: 'error',
        consoleError: err,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVersionChange = async (versionId: string) => {
    if (!token) return;

    if (versionId === 'current') {
      setIsHistoryView(false);
      setSelectedVersionId('current');
      setHistoricalVersionNo(null);
      if (currentVersion) await loadVersionSchema(currentVersion);
      return;
    }

    const targetVersion = versions.find((v: SobaFormVersionType) => v.id === versionId);
    if (!targetVersion) return;

    setIsHistoryView(true);
    setSelectedVersionId(versionId);
    setHistoricalVersionNo(targetVersion.versionNo);
    await loadVersionSchema(targetVersion);
  };

  const isCurrentPublished = currentVersion?.state === 'published';

  const createNewVersion = async () => {
    if (isSaving || loading || !token) return;
    const formId = id?.[0];
    if (!formId) return;
    setIsSaving(true);
    setLoading(true);

    try {
      // The engine strips engine-managed fields on save, so the raw schema can be submitted as-is.
      const ws = activeWorkspaceId || undefined;
      const newVersion = await createFormVersion(token as string, formId, visibility, ws);
      await saveFormVersionSchema(token as string, newVersion.id, (formSchema ?? {}) as FormType, ws);

      // Refresh the version list and select the new draft in-page.
      const versionsData = await getSobaFormVersions(token as string, formId, ws);
      setVersions(versionsData.items || []);
      setCurrentVersion(newVersion);
      setSelectedVersionId('current');
      setIsHistoryView(false);
      setIsDirty(false);

      addNotification({
        text: (
          dict.form.versionDraftCreated || 'Version {version} draft created successfully!'
        ).replace('{version}', String(newVersion.versionNo)),
        type: 'success',
      });
    } catch (e: unknown) {
      addNotification({
        text: dict.form.createVersionError || 'Failed to create new version.',
        type: 'error',
        consoleError: e,
      });
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  const handleVisibilityChange = (values: string[]) => {
    if (isHistoryView || isCurrentPublished) return;
    setVisibility(values);
    setIsDirty(true);
  };

  const saveFormPublish = async () => {
    await saveForm(true);
  };

  const saveFormDraft = async () => {
    await saveForm(false);
  };

  const saveForm = async (publish: boolean = false) => {
    if (isSaving || loading) return;
    setIsSaving(true);
    const slug = formSlug || titleToSlug(formName);
    const ws = activeWorkspaceId || undefined;
    const schema = (formSchema ?? {}) as FormType;

    try {
      if (currentVersion?.id) {
        // UPDATE: re-provision the current version's schema + visibility (server owns name/path).
        await saveFormVersionSchema(token as string, currentVersion.id, schema, ws);
        await updateSobaFormVersionVisibility(token as string, currentVersion.id, visibility, ws);
        if (publish) {
          await publishSobaFormVersion(token as string, currentVersion.id, ws);
        }
      } else {
        // CREATE: one-call create (form + empty v1), then provision the schema.
        const data: SobaFormType = { name: formName, slug, description: formDesc, visibility };
        const created = await createSobaFormioForm(token as string, data, ws);
        const versionId = created.formVersion?.id;
        if (versionId) {
          await saveFormVersionSchema(token as string, versionId, schema, ws);
          if (publish) {
            await publishSobaFormVersion(token as string, versionId, ws);
          }
        }
        router.push(`/${lang}/designer/${created.id}`);
      }

      addNotification({
        text: publish ? dict.form.published || 'Form published successfully!' : dict.form.saved,
        type: 'success',
      });
      setIsDirty(false);
    } catch (e: unknown) {
      addNotification({ text: dict.form.saveError, type: 'error', consoleError: e });
    } finally {
      setIsSaving(false);
    }
  };

  if (!authenticated) {
    return <div>You must be logged in</div>;
  }

  if (initializing) {
    return <div>Forms initializing</div>;
  }

  const renderDesignerContent = () => (
    <>
      <Form
        onSubmit={(e) => e.preventDefault()}
        className="d-flex flex-column gap-3 mb-3"
        style={{ maxWidth: '640px' }}
      >
        <TextField
          label={dict.form.nameLabel}
          value={formName}
          onChange={handleNameChange}
          isDisabled={isHistoryView || isCurrentPublished}
        />

        {versions.length > 0 && (
          <Select
            label={dict.form.formVersion || 'Form Version'}
            selectedKey={selectedVersionId || 'current'}
            onSelectionChange={(key) => handleVersionChange(String(key))}
            items={[
              {
                id: 'current',
                label: `${dict.form.currentDraft || 'Current Draft'}${
                  currentVersion?.versionNo ? ` (v${currentVersion.versionNo})` : ''
                }`,
              },
              ...versions
                .filter((v) => v.id !== currentVersion?.id)
                .map((v) => ({ id: v.id, label: `v${v.versionNo} (${v.state})` })),
            ]}
          />
        )}

        <CheckboxGroup
          label={dict.form.visibilityLabel || 'Visibility / Access Control'}
          value={visibility}
          onChange={handleVisibilityChange}
          isDisabled={isHistoryView || isCurrentPublished}
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <Checkbox key={opt.value} value={opt.value}>
              {opt.label}
            </Checkbox>
          ))}
        </CheckboxGroup>

        <div className="d-flex align-items-center gap-2">
          <Checkbox
            isSelected={agreedDisclaimer}
            onChange={setAgreedDisclaimer}
            isDisabled={isHistoryView || isCurrentPublished}
          >
            {dict.form.disclaimerLabel ||
              'I agree to the disclaimer and statement of responsibility'}
          </Checkbox>
          <Button
            variant="tertiary"
            size="small"
            isIconButton
            data-testid="view-disclaimer-button"
            aria-label={dict.form.viewDisclaimer || 'View disclaimer'}
            onPress={() => setShowDisclaimerModal(true)}
          >
            <FaInfoCircle className="text-info" aria-hidden="true" />
          </Button>
        </div>
      </Form>

      {/* Form Builder */}
      <div className={styles.designerWrapper}>
        {id && id[0] ? (
          loading ? (
            <div className="my-4 text-center">
              <ProgressCircle isIndeterminate aria-label={dict.form.loading} />
            </div>
          ) : formSchema ? (
            <FormDesigner onUpdateModel={updateFormSchema} initialModel={formSchema} />
          ) : (
            <div className="my-4">{dict.form.schemaNotAvailable}</div>
          )
        ) : (
          <FormDesigner onUpdateModel={updateFormSchema} initialModel={null} />
        )}
      </div>

      {/* Description */}
      <div className="mt-4 mb-5 pb-5" style={{ maxWidth: '640px' }}>
        <TextArea
          label={dict.form.descriptionLabel}
          value={formDesc}
          onChange={updateDescription}
          isDisabled={isHistoryView || isCurrentPublished}
        />
      </div>

      <div
        className={`${styles.floatingActions} shadow-lg p-3 rounded-pill d-flex gap-2 bg-white border`}
      >
        {id && id[0] && (
          <Button
            variant="secondary"
            onPress={createNewVersion}
            isDisabled={isSaving || loading}
          >
            {isSaving
              ? dict.form.creating || 'Creating...'
              : isHistoryView
                ? dict.form.restoreAsNewVersion || 'Restore as New Version'
                : dict.form.newVersion || 'New Version'}
          </Button>
        )}
        <Button
          variant="secondary"
          onPress={saveFormDraft}
          isDisabled={isHistoryView || isCurrentPublished || isSaving || loading || !agreedDisclaimer}
        >
          {isSaving ? dict.form.saving || 'Saving...' : dict.form.save || 'Save'}
        </Button>
        <Button variant="secondary" onPress={() => setShowPreview(true)} isDisabled={isSaving || loading}>
          {dict.form.preview || 'Preview'}
        </Button>
        {id && id[0] && (
          <span
            className="d-inline-flex"
            title={
              !agreedDisclaimer
                ? dict.form.mustAgreeDisclaimer || 'Must agree to disclaimer'
                : isHistoryView
                  ? dict.form.cannotPublishHistory || 'Cannot publish history'
                  : isCurrentPublished
                    ? dict.form.versionAlreadyPublished || 'Version already published'
                    : isDirty
                      ? dict.form.saveChangesBeforePublishing || 'Save changes before publishing'
                      : dict.form.publishForm || 'Publish form'
            }
          >
            <Button
              variant="primary"
              onPress={saveFormPublish}
              isDisabled={
                isHistoryView ||
                isCurrentPublished ||
                isDirty ||
                isSaving ||
                loading ||
                !agreedDisclaimer
              }
            >
              {dict.form.publish || 'Publish'}
            </Button>
          </span>
        )}
      </div>
    </>
  );

  return (
    <>

      {isHistoryView && (
        <div className="mb-4">
          <InlineAlert
            variant="info"
            buttons={
              <Button
                size="small"
                variant="secondary"
                onPress={() => handleVersionChange('current')}
              >
                {dict.form.switchToCurrentDraft ||
                  'Switch to ' + (dict.form.currentDraft || 'Current Draft')}
              </Button>
            }
          >
            <strong>{dict.form.readOnlyMode || 'Read-Only Mode:'}</strong>{' '}
            {dict.form.viewingHistoricalVersion || 'You are viewing historical version'}{' '}
            <strong>v{historicalVersionNo}</strong>.{' '}
            {dict.form.savePublishDisabled || 'Save and Publish options are disabled.'}
          </InlineAlert>
        </div>
      )}

      {!isHistoryView && isCurrentPublished && (
        <div className="mb-4">
          <InlineAlert variant="info">
            <strong>{dict.form.publishedVersion || 'Published Version:'}</strong>{' '}
            {dict.form.publishedVersionCannotBeModified ||
              'This version is published and cannot be modified'}
          </InlineAlert>
        </div>
      )}

      {id && id[0] ? (
        <Tabs
          id="form-designer-tabs"
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || 'designer')}
          className="mb-3"
        >
          <Tab eventKey="designer" title="Designer">
            {renderDesignerContent()}
          </Tab>
          <Tab eventKey="settings" title={dict.form.settingsTab || 'Settings'}>
            <FormSettingsTab dict={dict} />
          </Tab>
          <Tab eventKey="team" title={dict.form.teamTab || 'Team'}>
            <FormTeamTab dict={dict} />
          </Tab>
        </Tabs>
      ) : (
        renderDesignerContent()
      )}

      {/* Preview Modal */}
      <CommonModal
        show={showPreview}
        title={`${dict.form.formPreview || 'Form Preview:'} ${formName || dict.form.untitledForm || 'Untitled Form'}`}
        onClose={() => setShowPreview(false)}
        size="lg"
        footer={
          <Button variant="secondary" onPress={() => setShowPreview(false)}>
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

      {/* Disclaimer Dialog */}
      <BCModal
        isOpen={showDisclaimerModal}
        onOpenChange={(open) => {
          if (!open) setShowDisclaimerModal(false);
        }}
        isDismissable
      >
        <AlertDialog
          variant="info"
          title={dict.form.disclaimerTitle || 'Disclaimer'}
          isCloseable
          buttons={
            <Button variant="primary" onPress={() => setShowDisclaimerModal(false)}>
              {dict.form.close || 'Close'}
            </Button>
          }
        >
          <p>
            {dict.form.disclaimerText1 ||
              'It is your responsibility to comply with Privacy laws governing the collection, use and disclosure of personally identifiable information.'}
          </p>
          <p>
            {dict.form.disclaimerText2 ||
              'Access to this form designer tool does not inherently grant permission to collect, use or disclose any personally identifiable information.'}
          </p>
          <p>
            {dict.form.disclaimerText3 ||
              'It is your responsibility to obtain consent to collect information as required by law.'}
          </p>
          <p>
            {dict.form.disclaimerText4 ||
              'If you use BCeID or BC Services Card as form access options, you MUST notify the Identity Information Management (IDIM) team by email (IDIM.Consulting@gov.bc.ca) your intent to leverage BCeID or BC Services Card.'}
          </p>
        </AlertDialog>
      </BCModal>
    </>
  );
}

export default FormForm;
