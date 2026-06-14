'use client';

import dynamic from 'next/dynamic';

const FormioV5FormRenderClient = dynamic(() => import('./FormioV5FormRenderClient'), {
  ssr: false,
  loading: () => (
    <p className="small" style={{ color: 'var(--typography-color-secondary)' }}>
      Loading…
    </p>
  ),
});

export default function FormioV5FormRenderLoader() {
  return <FormioV5FormRenderClient />;
}
