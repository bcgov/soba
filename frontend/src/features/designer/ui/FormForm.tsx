'use client';
import { useState, useEffect } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';

import { FormType } from '@formio/react';

import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import FormDesigner from '@/src/features/designer/ui/FormDesigner';
import {
  createFormioForm,
  createSobaFormioForm,
  getFormioForm,
  getSobaFormVersionFromFormioId,
  updateFormioForm,
  saveSobaFormVersion,
} from '@/src/shared/api/sobaApi';
import type { SobaFormWithVersionResponse, SobaFormType } from '@/src/types/forms';

function FormForm({ id }: { id?: string[] }) {
  const dict = useDictionary();
  const { authenticated, token, initializing } = useKeycloak();
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSchema, setFormSchema] = useState<FormType | null>(null);
  const [loadedSoba, setLoadedSoba] = useState<SobaFormWithVersionResponse | null>(null);

  const [alertVariant, setAlertVariant] = useState('');
  const [alertText, setAlertText] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If we have an ID, we are editing an existing form, so we should load it
    const formioId = id?.[0];
    if (formioId && token) {
      // starting load for edit view
      //setLoading(true);
      async function loadForm() {
        try {
          // Fetch the SOBA form (using engine ref lookup) and the Form.io definition in parallel
          const [sobaResp, formioResp] = await Promise.all([
            getSobaFormVersionFromFormioId(token as string, formioId as string),
            getFormioForm(token as string, formioId as string),
          ]);

          const parsed = sobaResp as SobaFormWithVersionResponse;
          setLoadedSoba(parsed ?? null);

          // preload fields and metadata
          setFormSchema(formioResp as FormType);
          setFormName(parsed?.name ?? (formioResp as unknown as { title?: string })?.title ?? '');
          setFormSlug(parsed?.slug ?? (formioResp as unknown as { path?: string })?.path ?? '');
          setFormDesc(
            parsed?.description ??
              (formioResp as unknown as { description?: string })?.description ??
              '',
          );
        } catch (e: unknown) {
          console.error('Error loading form data', e);
          setAlertText('Failed to load form: ' + (e as Error).message);
          setAlertVariant('danger');
          setShowAlert(true);
        } finally {
          // finished load
          setLoading(false);
        }
      }
      loadForm();
    }
  }, [id, token]);

  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormName(e.target.value);
  };

  const updateSlug = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormSlug(e.target.value);
  };

  const updateDescription = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormDesc(e.target.value);
  };

  const updateFormSchema = (data: FormType) => {
    setFormSchema(data);
  };

  const saveFormPublish = async () => {
    await saveForm(true);
  };

  const saveFormDraft = async () => {
    await saveForm(false);
  };

  const saveForm = async (publish: boolean = false) => {
    const data: SobaFormType = {
      name: formName,
      slug: formSlug,
      description: formDesc,
    };

    try {
      const formioData = { ...(formSchema ?? {}) } as FormType;
      formioData.name = formName;
      // first remove illegal chars, then remove starting and ending / or -
      formioData.path = formSlug
        .toLowerCase()
        .replace(/[^a-z\-\/]/g, '')
        .replace(/^[\/-]+|[\/-]+$/g, '');
      formioData.title = formSlug;

      if (loadedSoba?.formVersion && loadedSoba.formVersion.id) {
        // Edit/update path: update Form.io form and save to existing SOBA form version
        const existingFormioId =
          (formioData as Record<string, unknown>)._id ??
          (formioData as { id?: string }).id ??
          id?.[0];
        const formioIdToUse = existingFormioId ? String(existingFormioId) : String(id?.[0] ?? '');
        await updateFormioForm(
          token as string,
          formioIdToUse,
          formioData,
          String(loadedSoba.formVersion.id),
          publish,
        );
        await saveSobaFormVersion(token as string, loadedSoba.formVersion.id, formioData, publish);
      } else {
        // Create path (new form)
        const sobaFormData = await createSobaFormioForm(token as string, data);
        await createFormioForm(token as string, formioData as FormType, sobaFormData.id, publish);
      }

      setAlertText(dict.form.saved);
      setAlertVariant('success');
      setShowAlert(true);
    } catch (e: unknown) {
      console.error('error creating form', e);
      setAlertText(dict.form.saveError);
      setAlertVariant('danger');
      setShowAlert(true);
    }
  };

  if (!authenticated) {
    return <div>You must be logged in</div>;
  }

  if (initializing) {
    return <div>Forms initializing</div>;
  }

  return (
    <>
      {showAlert && (
        <Alert variant={alertVariant} onClose={() => setShowAlert(false)} dismissible>
          {alertText}
        </Alert>
      )}

      <form>
        {/* On submission, the input value will be appended to
            the URL, e.g. /search?query=abc */}
        <div className="form-group">
          <label htmlFor="formName">{dict.form.nameLabel}</label>
          <input
            type="text"
            className="form-control"
            id="formName"
            aria-describedby="formName"
            placeholder={dict.form.namePlaceholder}
            value={formName}
            onChange={updateName}
          />
        </div>
        <div className="form-group">
          <label htmlFor="formSlug">{dict.form.slugLabel}</label>
          <input
            type="text"
            className="form-control"
            id="formSlug"
            aria-describedby="formSlug"
            placeholder={dict.form.slugPlaceholder}
            value={formSlug}
            onChange={updateSlug}
          />
        </div>
        <div className="form-group">
          <label htmlFor="formDescription">{dict.form.descriptionLabel}</label>
          <textarea
            className="form-control"
            id="formDescription"
            aria-describedby="formDescription"
            placeholder={dict.form.descriptionPlaceholder}
            value={formDesc}
            onChange={updateDescription}
          />
        </div>
        <div className="form-group">
          <Button className="me-2" variant="primary" onClick={saveFormDraft}>
            Save Form
          </Button>
          <Button variant="primary" onClick={saveFormPublish}>
            Save and Publish Form
          </Button>
        </div>
      </form>
      {/* If we are editing an existing form (id present) show spinner while loading.
          For the create page (no id) render the designer immediately with no initial model.
          For editing, only mount the designer after load completes and we have a schema. */}
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
          // If not loading and no schema, show a message (error state is shown via Alert)
          <div className="my-4">{dict.form.schemaNotAvailable}</div>
        )
      ) : (
        <FormDesigner onUpdateModel={updateFormSchema} initialModel={null} />
      )}
    </>
  );
}

export default FormForm;
