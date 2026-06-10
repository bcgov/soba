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
import styles from './FormForm.module.css';

import type { FormType } from '@formio/react';

import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import FormDesigner from '@/src/features/designer/ui/FormDesigner';
import { DynamicForm } from '@/src/features/formio-v5/ui/DynamicForm';
import FormSettingsTab from './FormSettingsTab';
import FormTeamTab from './FormTeamTab';
import { useAppSelector } from '@/lib/store';

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
      console.error('Failed to load version schema:', err);
      setAlertText('Failed to load version schema.');
      setAlertVariant('danger');
      setShowAlert(true);
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

      setAlertText(`Version ${newVersion.versionNo} draft created successfully!`);
      setAlertVariant('success');
      setShowAlert(true);
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

      setAlertText(publish ? 'Form published successfully!' : dict.form.saved);
      setAlertVariant('success');
      setShowAlert(true);
      setIsDirty(false);
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
                    {currentVersion?.versionNo ? `(v${currentVersion.versionNo})` : ''}
                  </option>
                  {versions
                    .filter((v) => v.id !== currentVersion?.id)
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
          <DynamicForm src="" form={formSchema} />
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
