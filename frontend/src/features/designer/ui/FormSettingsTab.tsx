import React from 'react';
import { Form } from 'react-bootstrap';
import type { Dictionary } from '@/src/types/plugins';

interface FormSettingsTabProps {
  dict: Dictionary;
}

export default function FormSettingsTab({ dict }: FormSettingsTabProps) {
  const [apiLey, setApiKey] = React.useState('');

  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(event.target.value);
  };

  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      <h5 className="mb-3">{dict.form.settingsTab || 'Settings'}</h5>
      <Form.Group controlId="formName">
        <Form.Label>{dict.form.apiKey}</Form.Label>
        <Form.Control
          type="text"
          placeholder={dict.form.apiKeyPlaceholder}
          value={apiLey}
          onChange={handleApiKeyChange}
        />
      </Form.Group>
    </div>
  );
}
