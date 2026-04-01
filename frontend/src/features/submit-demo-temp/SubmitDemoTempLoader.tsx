'use client';

/**
 * TEMP(submit-demo): dynamic import wrapper so the Submit page stays a server component.
 */
import dynamic from 'next/dynamic';

const SubmitDemoTempPanel = dynamic(() => import('./SubmitDemoTempPanel'), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--typography-color-secondary)]">Loading…</p>,
});

export default function SubmitDemoTempLoader() {
  return <SubmitDemoTempPanel />;
}
