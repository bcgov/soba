'use client';

import { FormioProvider } from '@formio/react';
import type { FormType, Submission } from '@formio/react';
import { DynamicForm } from './DynamicForm';

/**
 * Render a form schema read-only with a given submission — JSON mode, no proxy, no submit. Shared by
 * the renderer's post-submit confirmation and the standalone submission viewer.
 */
export function ReadOnlyFormView({
  schema,
  submission,
  testId,
}: {
  schema: FormType;
  submission: Submission;
  testId?: string;
}) {
  return (
    <div className="formio-v5-chrome" data-soba-formio-chrome data-testid={testId}>
      <FormioProvider>
        <DynamicForm
          className="formio-v5-form-root"
          src=""
          form={schema}
          submission={submission}
          options={{ readOnly: true }}
        />
      </FormioProvider>
    </div>
  );
}
