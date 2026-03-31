'use client';

import dynamic from 'next/dynamic';

/** Client-only: BC DS `Button` (React Aria) emits unstable `id`s under SSR → hydration mismatch. */
const MetaReviewClient = dynamic(() => import('./MetaReviewClient'), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-[var(--typography-color-secondary)]">Loading…</p>
  ),
});

export default function MetaReviewClientLoader() {
  return <MetaReviewClient />;
}
