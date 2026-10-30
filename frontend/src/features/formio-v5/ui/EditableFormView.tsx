'use client';

import { useMemo } from 'react';
import type { FormType, Submission } from '@formio/react';
import { DynamicForm } from './DynamicForm';
import styles from './EditableFormView.module.css';

/**
 * Render a form schema editable with a given submission, reporting each change of the answers. It
 * has no submit of its own: staff save through their own Update, and the server validates.
 */
export function EditableFormView({
  schema,
  submission,
  onDataChange,
  testId,
}: Readonly<{
  schema: FormType;
  submission: Submission;
  onDataChange: (data: Record<string, unknown>) => void;
  testId?: string;
}>) {
  // Stable, so the webform is not rebuilt as the answers change.
  const options = useMemo(() => ({ readOnly: false, noAlerts: true }), []);
  return (
    <div
      className={`formio-v5-chrome ${styles.editing}`}
      data-soba-formio-chrome
      data-testid={testId}
    >
      <DynamicForm
        className="formio-v5-form-root"
        src=""
        form={schema}
        submission={submission}
        options={options}
        onChange={(value: { data?: Record<string, unknown> }) => {
          if (value?.data) onDataChange(value.data);
        }}
      />
    </div>
  );
}
