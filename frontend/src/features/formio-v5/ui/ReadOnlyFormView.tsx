'use client';

import dynamic from 'next/dynamic';
import type { FormType, Submission, FormioProvider as FormioProviderComponent } from '@formio/react';
import { DynamicForm } from './DynamicForm';

// `@formio/react` references `document` at module evaluation, so it must never be imported on the
// server. Loading FormioProvider via a dynamic ssr:false import keeps this view SSR-safe even when
// it's reached from a server component (e.g. the standalone submission viewer page).
const FormioProvider = dynamic(
  async () => {
    const mod = await import('@formio/react');
    return mod.FormioProvider;
  },
  { ssr: false },
) as React.ComponentType<React.ComponentProps<typeof FormioProviderComponent>>;

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
