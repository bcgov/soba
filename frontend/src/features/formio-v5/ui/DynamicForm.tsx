'use client';

import dynamic from 'next/dynamic';
import type { FormProps } from '@formio/react';
import { useFormioV5FormChrome } from '@/lib/hooks/useFormioV5FormChrome';

function FormioV5FormChrome({ children }: { children: React.ReactNode }) {
  useFormioV5FormChrome(true);
  return children;
}

/**
 * The Form.io renderer loaded client-side only (no SSR). Shared by the designer preview, the live
 * renderer, and the read-only submission viewer so the dynamic-import boilerplate lives in one place.
 * V5 renderer styles are injected only while this component is mounted.
 */
const FormioForm = dynamic<FormProps>(() => import('@formio/react').then((m) => m.Form), {
  ssr: false,
  loading: () => <p className="text-muted small">Loading form renderer…</p>,
});

export function DynamicForm(props: FormProps) {
  return (
    <FormioV5FormChrome>
      <FormioForm {...props} />
    </FormioV5FormChrome>
  );
}
