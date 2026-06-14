'use client';

import dynamic from 'next/dynamic';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';

/** Client-only: BC DS `Button` (React Aria) emits unstable `id`s under SSR → hydration mismatch. */
const MetaReviewClient = dynamic(() => import('./MetaReviewClient'), {
  ssr: false,
  loading: () => <CenteredProgress />,
});

export default function MetaReviewClientLoader() {
  return <MetaReviewClient />;
}
