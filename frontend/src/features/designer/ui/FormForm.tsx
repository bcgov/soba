'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Alert,
  Button,
  Spinner,
  Form as BSForm,
  Row,
  Col,
  Dropdown,
  Tabs,
  Tab,
} from 'react-bootstrap';
import { FaInfoCircle } from 'react-icons/fa';
import { Modal as CommonModal } from '@/src/components/Modal';
import dynamic from 'next/dynamic';
import styles from './FormForm.module.css';

import type { FormProps, FormType } from '@formio/react';

import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import FormDesigner from '@/src/features/designer/ui/FormDesigner';
import FormSettingsTab from './FormSettingsTab';
import FormTeamTab from './FormTeamTab';
import { useAppSelector } from '@/lib/store';

import {
  createFormioForm,
  createSobaFormioForm,
  getFormioForm,
  getSobaFormVersionFromFormioId,
  updateFormioForm,
  getSobaFormVersions,
  updateSobaFormVersionVisibility,
} from '@/src/shared/api/sobaApi';
import type {
  SobaFormWithVersionResponse,
  SobaFormType,
  SobaFormVersionType,
} from '@/src/types/forms';

const FormioFormRenderer = dynamic<FormProps>(
  () => import('@formio/react').then((mod) => mod.Form),
  {
    ssr: false,
  },
);

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
  const [activeTab, setActiveTab] = useState('designer');
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSchema, setFormSchema] = useState<FormType | null>(null);
  const [loadedSoba, setLoadedSoba] = useState<SobaFormWithVersionResponse | null>(null);
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

  const [alertVariant, setAlertVariant] = useState('');
  const [alertText, setAlertText] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);

  useEffect(() => {
    const formioId = id?.[0];
    if (formioId && token) {
      async function loadForm() {
        setLoading(true);
        try {
          const [sobaResp, formioResp] = await Promise.all([
            getSobaFormVersionFromFormioId(
              token as string,
              formioId as string,
              activeWorkspaceId || undefined,
            ),
            getFormioForm(token as string, formioId as string, activeWorkspaceId || undefined),
          ]);

          const parsed = sobaResp as SobaFormWithVersionResponse;
          setLoadedSoba(parsed ?? null);

          setFormSchema(formioResp as FormType);
          setFormName(parsed?.name ?? (formioResp as unknown as { title?: string })?.title ?? '');
          setFormSlug(parsed?.slug ?? (formioResp as unknown as { path?: string })?.path ?? '');
          setFormDesc(
            parsed?.description ??
              (formioResp as unknown as { description?: string })?.description ??
              '',
          );
          setVisibility(parsed?.formVersion?.visibility ?? []);
          setSlugManuallyEdited(true);
          setIsDirty(false);

          if (parsed && parsed.id) {
            try {
              const versionsData = await getSobaFormVersions(
                token as string,
                parsed.id,
                activeWorkspaceId || undefined,
              );
              setVersions(versionsData.items || []);
            } catch (err) {
              console.error('Failed to load form versions:', err);
            }
          }
        } catch (e: unknown) {
          console.error('Error loading form data', e);
          setAlertText('Failed to load form: ' + (e as Error).message);
          setAlertVariant('danger');
          setShowAlert(true);
        } finally {
          setLoading(false);
        }
      }
      loadForm();
    }
  }, [id, token, activeWorkspaceId]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      setFormName(name);
      if (!slugManuallyEdited) {
        setFormSlug(titleToSlug(name));
      }
      setIsDirty(true);
    },
    [slugManuallyEdited],
  );

  const updateDescription = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormDesc(e.target.value);
    setIsDirty(true);
  };

  const updateFormSchema = (data: FormType) => {
    setFormSchema(data);
    setIsDirty(true);
  };

  const handleVersionChange = async (versionId: string) => {
    if (!token || !loadedSoba) return;

    if (versionId === 'current') {
      setIsHistoryView(false);
      setSelectedVersionId('current');
      setHistoricalVersionNo(null);

      setLoading(true);
      try {
        const formioId = id?.[0];
        if (formioId) {
          const formioResp = await getFormioForm(
            token as string,
            formioId as string,
            activeWorkspaceId || undefined,
          );
          setFormSchema(formioResp as FormType);
          setVisibility(loadedSoba.formVersion?.visibility ?? []);
          setIsDirty(false);
        }
      } catch (err) {
        console.error('Failed to reload current draft:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    const targetVersion = versions.find((v: SobaFormVersionType) => v.id === versionId);
    if (!targetVersion) return;

    setIsHistoryView(true);
    setSelectedVersionId(versionId);
    setHistoricalVersionNo(targetVersion.versionNo);

    if (targetVersion.engineSchemaRef) {
      setLoading(true);
      try {
        const formioResp = await getFormioForm(
          token as string,
          targetVersion.engineSchemaRef,
          activeWorkspaceId || undefined,
        );
        setFormSchema(formioResp as FormType);
        setVisibility(targetVersion.visibility ?? []);
        setIsDirty(false);
      } catch (err) {
        console.error('Failed to load historical form schema:', err);
        setAlertText('Failed to load version schema.');
        setAlertVariant('danger');
        setShowAlert(true);
      } finally {
        setLoading(false);
      }
    } else {
      setFormSchema(null);
    }
  };

  const isCurrentPublished = loadedSoba?.formVersion?.state === 'published';

  const createNewVersion = async () => {
    if (isSaving || loading || !token || !loadedSoba) return;
    setIsSaving(true);
    setLoading(true);

    try {
      const nextVersionNo =
        Math.max(...versions.map((v: SobaFormVersionType) => v.versionNo), 0) + 1;
      const cleanSchema = { ...(formSchema ?? {}) };
      delete cleanSchema._id;
      delete cleanSchema.machineName;

      const slug = formSlug || titleToSlug(formName);
      // temporary fix - need unique suffix to avoid Form.io path/name collisions across forms;
      // removed when server-side provisioning (soba-{formVersionId}) lands.
      const uniqueSuffix = crypto.randomUUID().slice(0, 8);
      cleanSchema.name = `${formName}-v${nextVersionNo}-${uniqueSuffix}`;
      cleanSchema.path = `${slug}-v${nextVersionNo}-${uniqueSuffix}`;
      cleanSchema.title = `${formName} (v${nextVersionNo})`;

      const createdFormio = await createFormioForm(
        token as string,
        cleanSchema as FormType,
        loadedSoba.id,
        false, // publish is false for new draft
        visibility,
        activeWorkspaceId || undefined,
      );

      const formioIdForNav = (createdFormio as FormType)._id;

      setAlertText(`Version ${nextVersionNo} draft created successfully!`);
      setAlertVariant('success');
      setShowAlert(true);
      setIsDirty(false);

      if (formioIdForNav) {
        // Fetch the newly created SOBA form version immediately
        const newSobaData = await getSobaFormVersionFromFormioId(
          token as string,
          formioIdForNav,
          activeWorkspaceId || undefined,
        );
        if (!loadedSoba?.formVersion || !loadedSoba.formVersion.id) {
          setLoadedSoba(newSobaData as SobaFormWithVersionResponse);
          router.push(`/${lang}/designer/${formioIdForNav}`);
        }
      }
    } catch (e: unknown) {
      console.error('Error creating new form version:', e);
      setAlertText('Failed to create new version.');
      setAlertVariant('danger');
      setShowAlert(true);
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  const toggleVisibility = (val: string) => {
    if (isHistoryView || isCurrentPublished) return;
    setVisibility((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
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
    const data: SobaFormType = {
      name: formName,
      slug,
      description: formDesc,
    };

    try {
      const formioData = { ...(formSchema ?? {}) } as FormType;
      formioData.name = titleToSlug(formName);
      formioData.path = slug
        .toLowerCase()
        .replace(/[^a-z\-\/]/g, '')
        .replace(/^[\/-]+|[\/-]+$/g, '');
      formioData.title = formName;

      let formioIdForNav: string | undefined | null = null;

      if (loadedSoba?.formVersion && loadedSoba.formVersion.id) {
        // UPDATE Logic
        const existingFormioId =
          (formioData as Record<string, unknown>)._id ??
          (formioData as { id?: string }).id ??
          id?.[0];
        const formioIdToUse = existingFormioId ? String(existingFormioId) : String(id?.[0] ?? '');
        formioIdForNav = formioIdToUse;

        await updateFormioForm(
          token as string,
          formioIdToUse,
          formioData,
          String(loadedSoba.formVersion.id),
          publish,
          activeWorkspaceId || undefined,
        );
        await updateSobaFormVersionVisibility(
          token as string,
          String(loadedSoba.formVersion.id),
          visibility,
          activeWorkspaceId || undefined,
        );
      } else {
        // CREATE Logic
        const uniqueSuffix = crypto.randomUUID().slice(0, 8);
        formioData.name = `${formioData.name}-${uniqueSuffix}`;
        formioData.path = `${formioData.path}-${uniqueSuffix}`; //temporary fix path unique in formio

        const sobaFormData = await createSobaFormioForm(
          token as string,
          data,
          activeWorkspaceId || undefined,
        );
        const createdFormio = await createFormioForm(
          token as string,
          formioData as FormType,
          sobaFormData.id,
          publish,
          visibility,
          activeWorkspaceId || undefined,
        );
        formioIdForNav = (createdFormio as FormType)._id;
      }

      setAlertText(publish ? 'Form published successfully!' : dict.form.saved);
      setAlertVariant('success');
      setShowAlert(true);
      setIsDirty(false);

      if ((!id || id.length === 0) && formioIdForNav) {
        // Fetch the newly created SOBA form version immediately
        // so that if the user clicks Save again, it triggers UPDATE logic.
        const newSobaData = await getSobaFormVersionFromFormioId(
          token as string,
          formioIdForNav,
          activeWorkspaceId || undefined,
        );
        setLoadedSoba(newSobaData as SobaFormWithVersionResponse);
        router.push(`/${lang}/designer/${formioIdForNav}`);
      }
    } catch (e: unknown) {
      console.error('error saving form', e);
      setAlertText(dict.form.saveError);
      setAlertVariant('danger');
      setShowAlert(true);
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

  const visibilityLabel =
    visibility.length === 0
      ? dict.form.selectVisibility || 'Select Visibility'
      : VISIBILITY_OPTIONS.filter((o) => visibility.includes(o.value))
          .map((o) => o.label)
          .join(', ');
  const renderDesignerContent = () => (
    <>
      <BSForm>
        <Row className="mb-3 align-items-end">
          <Col md={8}>
            <BSForm.Group controlId="formName">
              <BSForm.Label>{dict.form.nameLabel}</BSForm.Label>
              <BSForm.Control
                type="text"
                placeholder={dict.form.namePlaceholder}
                value={formName}
                onChange={handleNameChange}
                disabled={isHistoryView || isCurrentPublished}
              />
            </BSForm.Group>
          </Col>

          {versions.length > 0 && (
            <Col md={8}>
              <BSForm.Group controlId="formVersionSelector">
                <BSForm.Label>{dict.form.formVersion || 'Form Version'}</BSForm.Label>
                <BSForm.Select
                  value={selectedVersionId || 'current'}
                  onChange={(e) => handleVersionChange(e.target.value)}
                >
                  <option value="current">
                    {dict.form.currentDraft || 'Current Draft'}{' '}
                    {loadedSoba?.formVersion?.versionNo
                      ? `(v${loadedSoba.formVersion.versionNo})`
                      : ''}
                  </option>
                  {versions
                    .filter((v) => v.id !== loadedSoba?.formVersion?.id)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNo} ({v.state})
                      </option>
                    ))}
                </BSForm.Select>
              </BSForm.Group>
            </Col>
          )}

          <Col md={8}>
            <BSForm.Group controlId="formVisibility">
              <BSForm.Label>
                {dict.form.visibilityLabel || 'Visibility / Access Control'}
              </BSForm.Label>
              <Dropdown className="w-100">
                <Dropdown.Toggle
                  variant="outline-secondary"
                  id="dropdown-visibility"
                  className="w-100 text-start d-flex justify-content-between align-items-center overflow-hidden"
                  disabled={isHistoryView || isCurrentPublished}
                >
                  <span className="text-truncate me-2">{visibilityLabel}</span>
                </Dropdown.Toggle>

                <Dropdown.Menu className="w-100 p-2">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <BSForm.Check
                      key={opt.value}
                      type="checkbox"
                      id={`check-${opt.value}`}
                      label={opt.label}
                      checked={visibility.includes(opt.value)}
                      onChange={() => toggleVisibility(opt.value)}
                      className="mx-2 my-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </BSForm.Group>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col>
            <BSForm.Group controlId="formDisclaimerCheckbox" className="d-flex align-items-center">
              <BSForm.Check
                type="checkbox"
                id="disclaimer-checkbox"
                label={
                  dict.form.disclaimerLabel ||
                  'I agree to the disclaimer and statement of responsibility'
                }
                checked={agreedDisclaimer}
                onChange={(e) => setAgreedDisclaimer(e.target.checked)}
                disabled={isHistoryView || isCurrentPublished}
                className="me-2"
              />
              <FaInfoCircle
                className="text-info cursor-pointer"
                style={{ cursor: 'pointer' }}
                onClick={() => setShowDisclaimerModal(true)}
              />
            </BSForm.Group>
          </Col>
        </Row>
      </BSForm>

      {/* Form Builder */}
      <div className={styles.designerWrapper}>
        {id && id[0] ? (
          loading ? (
            <div className="my-4 text-center">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">{dict.form.loading}</span>
              </Spinner>
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
      <BSForm className="mt-4 mb-5 pb-5">
        <BSForm.Group controlId="formDescription">
          <BSForm.Label>{dict.form.descriptionLabel}</BSForm.Label>
          <BSForm.Control
            as="textarea"
            rows={3}
            placeholder={dict.form.descriptionPlaceholder}
            value={formDesc}
            onChange={updateDescription}
            disabled={isHistoryView || isCurrentPublished}
          />
        </BSForm.Group>
      </BSForm>

      <div
        className={`${styles.floatingActions} shadow-lg p-3 rounded-pill d-flex gap-2 bg-white border`}
      >
        {id && id[0] && (
          <Button
            variant="outline-primary"
            className="rounded-pill px-4"
            onClick={createNewVersion}
            disabled={isSaving || loading}
          >
            {isSaving
              ? dict.form.creating || 'Creating...'
              : isHistoryView
                ? dict.form.restoreAsNewVersion || 'Restore as New Version'
                : dict.form.newVersion || 'New Version'}
          </Button>
        )}
        <Button
          variant="outline-primary"
          className="rounded-pill px-4"
          onClick={saveFormDraft}
          disabled={isHistoryView || isCurrentPublished || isSaving || loading || !agreedDisclaimer}
        >
          {isSaving ? dict.form.saving || 'Saving...' : dict.form.save || 'Save'}
        </Button>
        <Button
          variant="outline-primary"
          className="rounded-pill px-4"
          onClick={() => setShowPreview(true)}
          disabled={isSaving || loading}
        >
          {dict.form.preview || 'Preview'}
        </Button>
        {id && id[0] && (
          <Button
            variant="primary"
            className="rounded-pill px-4"
            onClick={saveFormPublish}
            disabled={
              isHistoryView ||
              isCurrentPublished ||
              isDirty ||
              isSaving ||
              loading ||
              !agreedDisclaimer
            }
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
            {dict.form.publish || 'Publish'}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <>
      {showAlert && (
        <Alert
          variant={alertVariant}
          onClose={() => setShowAlert(false)}
          dismissible
          className={styles.floatingAlert}
        >
          {alertText}
        </Alert>
      )}

      {isHistoryView && (
        <Alert variant="info" className="mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <span>
              <strong>{dict.form.readOnlyMode || 'Read-Only Mode:'}</strong>{' '}
              {dict.form.viewingHistoricalVersion || 'You are viewing historical version'}{' '}
              <strong>v{historicalVersionNo}</strong>.{' '}
              {dict.form.savePublishDisabled || 'Save and Publish options are disabled.'}
            </span>
            <Button size="sm" variant="outline-info" onClick={() => handleVersionChange('current')}>
              {dict.form.switchToCurrentDraft ||
                'Switch to ' + (dict.form.currentDraft || 'Current Draft')}
            </Button>
          </div>
        </Alert>
      )}

      {!isHistoryView && isCurrentPublished && (
        <Alert variant="info" className="mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <span>
              <strong>{dict.form.publishedVersion || 'Published Version:'}</strong>{' '}
              {dict.form.publishedVersionCannotBeModified ||
                'This version is published and cannot be modified'}
            </span>
          </div>
        </Alert>
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
          <Button variant="secondary" onClick={() => setShowPreview(false)}>
            {dict.form.closePreview || 'Close Preview'}
          </Button>
        }
      >
        {formSchema ? (
          <FormioFormRenderer src="" form={formSchema} />
        ) : (
          <p className="text-center p-5 text-muted">
            {dict.form.noFormLayout || 'No form layout designed yet.'}
          </p>
        )}
      </CommonModal>

      {/* Disclaimer Modal */}
      <CommonModal
        show={showDisclaimerModal}
        title={dict.form.disclaimerTitle || 'Disclaimer'}
        onClose={() => setShowDisclaimerModal(false)}
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setShowDisclaimerModal(false)}>
            Close
          </Button>
        }
      >
        <div>
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
        </div>
      </CommonModal>
    </>
  );
}

export default FormForm;
