'use client';
import { useState } from 'react';
import { Alert, Button } from 'react-bootstrap';

import { FormType } from '@formio/react';

import { useKeycloak } from '@/lib/hooks/useKeycloak';
import FormDesigner from '@/src/features/designer/ui/FormDesigner';
import { createFormioForm, createSobaFormioForm, SobaFormType } from '@/src/shared/api/sobaApi';

function FormForm() {
  const { authenticated, token, initializing } = useKeycloak();
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [ministry, setMinistry] = useState('');
  const [formSchema, setFormSchema] = useState<FormType>({} as FormType);

  const [alertVariant, setAlertVariant] = useState('');
  const [alertText, setAlertText] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormName(e.target.value);
  };

  const updateMinistry = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinistry(e.target.value);
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

  const saveForm = async () => {
    const data: SobaFormType = {
      name: formName,
      slug: formSlug,
      description: formDesc,
    };

    try {
      await createSobaFormioForm(token as string, data);
      const formioData = { ...formSchema };
      formioData.name = formName;
      //first remove illegal chars, then remove starting and ending / or -
      formioData.path = formSlug
        .toLowerCase()
        .replace(/[^a-z\-\/]/g, '')
        .replace(/^[/-]+|[/-]+$/g, '');
      formioData.title = formSlug;
      await createFormioForm(token as string, formioData);

      setAlertText('Form Saved to SOBA and FORMIO');
      setAlertVariant('success');
      setShowAlert(true);
    } catch (e: unknown) {
      console.error('error creating form', e);
      setAlertText('ERROR Saving Form to SOBA and FORMIO: ' + (e as Error).message);
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
          <label htmlFor="formName">Form Name</label>
          <input
            type="text"
            className="form-control"
            id="formName"
            aria-describedby="formName"
            placeholder="Enter form name"
            value={formName}
            onChange={updateName}
          />
        </div>
        <div className="form-group">
          <label htmlFor="formSlug">Form Slug</label>
          <input
            type="text"
            className="form-control"
            id="formSlug"
            aria-describedby="formSlug"
            placeholder="Enter form slug"
            value={formSlug}
            onChange={updateSlug}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ministryName">Ministry Name</label>
          <input
            type="text"
            className="form-control"
            id="ministryName"
            aria-describedby="ministryName"
            placeholder="Enter ministry name"
            value={ministry}
            onChange={updateMinistry}
          />
        </div>
        <div className="form-group">
          <label htmlFor="formDescription">Description</label>
          <textarea
            className="form-control"
            id="formDescription"
            aria-describedby="formDescription"
            placeholder="Enter form description"
            value={formDesc}
            onChange={updateDescription}
          />
        </div>
        <div className="form-group">
          <Button variant="primary" onClick={saveForm}>
            Save Form
          </Button>
        </div>
      </form>
      <FormDesigner onUpdateModel={updateFormSchema} />
    </>
  );
}

export default FormForm;
