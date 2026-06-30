'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';

/**
 * Client-only dynamic import with the standard centered-spinner fallback.
 *
 * Consolidates the near-identical `*Loader` wrappers that each feature used to declare
 * by hand. Props are inferred from the imported component, so the returned loader has
 * the same call signature as the wrapped component.
 */
export function clientOnly<P extends object>(
  importer: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<P> {
  return dynamic(importer, {
    ssr: false,
    loading: () => <CenteredProgress />,
  });
}
