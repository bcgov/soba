'use client';

import { Button, Accordion, Form } from '@bcgov/design-system-react-components';

interface FormSettingsDrawersProps {
  children: React.ReactNode;
  id: string;
  label: string;
  onSave: () => void;
  onCancel: () => void;
}

export default function FormSettingsDrawers({
  children,
  id,
  label,
  onSave,
  onCancel,
}: FormSettingsDrawersProps) {
  return (
    <Accordion id={id} data-testid={`accordion-${id}`} label={label}>
      <div className="d-block w-100">
        <Form>
          {children}
          <div className="d-md-flex mt-2 justify-content-start gap-2 mt-3 w-100">
            <Button data-testid={`form-settings-${id}-save`} onClick={onSave}>
              Save
            </Button>
            <Button
              data-testid={`form-settings-${id}-cancel`}
              onClick={onCancel}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    </Accordion>
  );
}
