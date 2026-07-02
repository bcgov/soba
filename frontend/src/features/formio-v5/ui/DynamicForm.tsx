'use client';

import dynamic from 'next/dynamic';
import type { FormProps } from '@formio/react';

/**
 * The Form.io renderer loaded client-side only (no SSR). Shared by the designer preview, the live
 * renderer, and the read-only submission viewer so the dynamic-import boilerplate lives in one place.
 */
export const DynamicForm = dynamic<FormProps>(() => import('@formio/react').then((m) => m.Form), {
  ssr: false,
  loading: () => <p className="text-muted small">Loading form renderer…</p>,
});
