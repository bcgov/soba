'use client';

import React from 'react';
import { TextField } from '@bcgov/design-system-react-components';
import type { Dictionary } from '@/src/types/plugins';

interface FormSettingsTabProps {
  dict: Dictionary;
}

export default function FormSettingsTab({ dict }: FormSettingsTabProps) {
  const [apiKey, setApiKey] = React.useState('');

  return (
    <div className="p-3 border rounded-bottom bg-white border-top-0">
      <h3 className="h5 mb-3">{dict.form.settingsTab || 'Settings'}</h3>
      <TextField
        label={dict.form.apiKey}
        description={dict.form.apiKeyPlaceholder}
        value={apiKey}
        onChange={setApiKey}
      />
    </div>
  );
}
