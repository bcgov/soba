'use client';

import dynamic from 'next/dynamic';

const FormioV5FormListClient = dynamic(() => import('./FormioV5FormListClient'), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--typography-color-secondary)]">Loading…</p>,
});

export default function FormioV5FormListLoader() {
  return <FormioV5FormListClient />;
}
