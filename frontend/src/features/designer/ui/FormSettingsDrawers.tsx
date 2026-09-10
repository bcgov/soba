'use client';

import { Button, Accordion, Form } from '@bcgov/design-system-react-components';

interface FormSettingsDrawersProps {
  dict: Dictionary;
  children: React.ReactNode;
  id: string;
  label: string;
  onSave: () => void;
  onCancel: () => void;
}

export default function FormSettingsDrawers({
  dict,
  children,
  id,
  label,
  onSave,
  onCancel,
}: Readonly<FormSettingsDrawersProps>) {
  return (
    <Accordion id={id} data-testid={`accordion-${id}`} label={label}>
      <div className="d-block w-100">
        <Form>
          {children}
          <div className="d-md-flex mt-2 justify-content-start gap-2 mt-3 w-100">
            <Button data-testid={`form-settings-${id}-save`} onClick={onSave}>
              {dict.general.save}
            </Button>
            <Button
              data-testid={`form-settings-${id}-cancel`}
              onClick={onCancel}
              variant="secondary"
            >
              {dict.general.cancel}
            </Button>
          </div>
        </Form>
      </div>
    </Accordion>
  );
}
